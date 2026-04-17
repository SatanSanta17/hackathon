import crypto from 'crypto';
import { and, asc, count, eq, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import {
  hackathons,
  orgMemberships,
  teamInvites,
  teamJoinRequests,
  teamMembers,
  teams,
  tracks,
  users,
} from '@/db/schema';
import { getEmailService } from '@/lib/email';
import { teamDisbandedAdminEmail } from '@/lib/email/templates';
import { autoRegister } from '@/lib/services/registration-service';
import type { Team, TeamInvite, TeamJoinRequest, TeamMember } from '@/db/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamWithMembers extends Team {
  members: Array<
    TeamMember & { user: { name: string; email: string; avatarUrl: string | null } }
  >;
  pendingRequestCount: number;
}

export interface TeamBrowseItem {
  id: string;
  name: string;
  description: string | null;
  trackId: string | null;
  trackName: string | null;
  isOpen: boolean;
  adminStatus: string;
  memberCount: number;
  maxSize: number;
}

export interface JoinRequestWithUser extends TeamJoinRequest {
  user: { name: string; email: string; avatarUrl: string | null };
}

// ---------------------------------------------------------------------------
// Invite Code
// ---------------------------------------------------------------------------

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from(
      { length: 8 },
      () => INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)],
    ).join('');

    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.inviteCode, code))
      .limit(1);

    if (!existing) return code;
  }
  throw new Error('INVITE_CODE_GENERATION_FAILED');
}

// ---------------------------------------------------------------------------
// Dissolve Team — explicit exported function (P1.R20)
// ---------------------------------------------------------------------------

export async function dissolveTeam(
  teamId: string,
  reason: string = 'Team disbanded',
): Promise<void> {
  const [team] = await db
    .select({ hackathonId: teams.hackathonId, name: teams.name })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!team) return; // already dissolved

  await db.transaction(async (tx) => {
    await tx.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
    await tx
      .update(teams)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(teams.id, teamId));
  });

  // Notify org admins — outside the transaction so email failure cannot roll back dissolution
  try {
    const [hackathon] = await db
      .select({ title: hackathons.title, orgId: hackathons.orgId })
      .from(hackathons)
      .where(eq(hackathons.id, team.hackathonId))
      .limit(1);

    if (hackathon) {
      const admins = await db
        .select({ email: users.email, name: users.name })
        .from(orgMemberships)
        .innerJoin(users, eq(users.id, orgMemberships.userId))
        .where(
          and(
            eq(orgMemberships.orgId, hackathon.orgId),
            eq(orgMemberships.role, 'org_admin'),
            isNull(orgMemberships.deletedAt),
          ),
        );

      const emailService = getEmailService();
      for (const admin of admins) {
        await emailService.send({
          to: admin.email,
          ...teamDisbandedAdminEmail({
            adminName: admin.name,
            teamName: team.name,
            hackathonTitle: hackathon.title,
            reason,
          }),
        });
      }
    }
  } catch {
    // Email failure must not surface — dissolution is already committed
  }
}

// ---------------------------------------------------------------------------
// Create Team
// ---------------------------------------------------------------------------

export async function createTeam(
  hackathonId: string,
  userId: string,
  data: {
    name: string;
    description?: string;
    trackId?: string;
    isOpen: boolean;
  },
): Promise<Team> {
  const [hackathon] = await db
    .select({ requiresApproval: hackathons.requiresApproval })
    .from(hackathons)
    .where(eq(hackathons.id, hackathonId))
    .limit(1);

  if (!hackathon) throw new Error('HACKATHON_NOT_FOUND');

  const existingTeam = await getUserTeamForHackathon(userId, hackathonId);
  if (existingTeam) throw new Error('ALREADY_IN_TEAM');

  const inviteCode = await generateUniqueInviteCode();
  const adminStatus = hackathon.requiresApproval ? 'pending_review' : 'approved';
  const reviewReason = hackathon.requiresApproval ? 'New team' : null;

  const [team] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(teams)
      .values({
        hackathonId,
        name: data.name,
        description: data.description ?? null,
        inviteCode,
        isOpen: data.isOpen,
        trackId: data.trackId ?? null,
        adminStatus,
        reviewReason,
        createdBy: userId,
      })
      .returning();

    await tx.insert(teamMembers).values({
      teamId: created.id,
      userId,
      role: 'lead',
    });

    return [created];
  });

  return team;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getTeamById(teamId: string): Promise<TeamWithMembers | null> {
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!team) return null;

  const members = await db
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      createdAt: teamMembers.createdAt,
      userName: users.name,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(teamMembers.joinedAt));

  const [pendingResult] = await db
    .select({ pendingCount: count() })
    .from(teamJoinRequests)
    .where(
      and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.status, 'pending'),
      ),
    );

  return {
    ...team,
    members: members.map((m) => ({
      id: m.id,
      teamId: m.teamId,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      createdAt: m.createdAt,
      user: { name: m.userName, email: m.userEmail, avatarUrl: m.userAvatarUrl },
    })),
    pendingRequestCount: pendingResult?.pendingCount ?? 0,
  };
}

export async function getTeamByInviteCode(inviteCode: string): Promise<Team | null> {
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.inviteCode, inviteCode), isNull(teams.deletedAt)))
    .limit(1);

  return team ?? null;
}

export async function getTeamsByHackathon(
  hackathonId: string,
  filters: {
    isAdmin?: boolean;
    trackId?: string;
    isOpen?: boolean;
    adminStatus?: string;
    maxSize?: number;
  } = {},
): Promise<TeamBrowseItem[]> {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      trackId: teams.trackId,
      isOpen: teams.isOpen,
      adminStatus: teams.adminStatus,
      createdAt: teams.createdAt,
      memberCount: count(teamMembers.id),
    })
    .from(teams)
    .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .where(and(eq(teams.hackathonId, hackathonId), isNull(teams.deletedAt)))
    .groupBy(teams.id)
    .orderBy(asc(teams.createdAt));

  const filtered = rows.filter((row) => {
    if (!filters.isAdmin) {
      if (!row.isOpen) return false;
      if (filters.maxSize !== undefined && row.memberCount >= filters.maxSize) return false;
    }
    if (filters.trackId && row.trackId !== filters.trackId) return false;
    if (filters.isOpen !== undefined && row.isOpen !== filters.isOpen) return false;
    if (filters.adminStatus && row.adminStatus !== filters.adminStatus) return false;
    return true;
  });

  return filtered.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    trackId: row.trackId,
    trackName: null, // enriched by caller when needed
    isOpen: row.isOpen,
    adminStatus: row.adminStatus,
    memberCount: row.memberCount,
    maxSize: filters.maxSize ?? 0,
  }));
}

export async function getUserTeamForHackathon(
  userId: string,
  hackathonId: string,
): Promise<Team | null> {
  const [row] = await db
    .select({ team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teams.hackathonId, hackathonId),
        isNull(teams.deletedAt),
      ),
    )
    .limit(1);

  return row?.team ?? null;
}

export async function getPendingTeams(hackathonId: string): Promise<TeamWithMembers[]> {
  const pending = await db
    .select({ id: teams.id })
    .from(teams)
    .where(
      and(
        eq(teams.hackathonId, hackathonId),
        eq(teams.adminStatus, 'pending_review'),
        isNull(teams.deletedAt),
      ),
    );

  return Promise.all(pending.map((t) => getTeamById(t.id) as Promise<TeamWithMembers>));
}

// ---------------------------------------------------------------------------
// Update Team
// ---------------------------------------------------------------------------

export async function updateTeam(
  teamId: string,
  data: Partial<{ name: string; description: string; trackId: string; isOpen: boolean }>,
): Promise<Team> {
  const [row] = await db
    .select({ hackathonId: teams.hackathonId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!row) throw new Error('TEAM_NOT_FOUND');

  const [hackathon] = await db
    .select({ requiresApproval: hackathons.requiresApproval })
    .from(hackathons)
    .where(eq(hackathons.id, row.hackathonId))
    .limit(1);

  const requiresApproval = hackathon?.requiresApproval ?? false;

  const [updated] = await db
    .update(teams)
    .set({
      ...data,
      ...(requiresApproval
        ? { adminStatus: 'pending_review', reviewReason: 'Team profile edited' }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId))
    .returning();

  return updated;
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export async function addMember(
  teamId: string,
  userId: string,
  memberName: string,
): Promise<void> {
  const [team] = await db
    .select({ hackathonId: teams.hackathonId })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!team) throw new Error('TEAM_NOT_FOUND');

  const [hackathon] = await db
    .select({ requiresApproval: hackathons.requiresApproval })
    .from(hackathons)
    .where(eq(hackathons.id, team.hackathonId))
    .limit(1);

  const requiresApproval = hackathon?.requiresApproval ?? false;

  // Auto-register before the transaction to keep the transaction scope tight
  await autoRegister(team.hackathonId, userId);

  await db.transaction(async (tx) => {
    await tx.insert(teamMembers).values({ teamId, userId, role: 'member' });

    if (requiresApproval) {
      await tx
        .update(teams)
        .set({
          adminStatus: 'pending_review',
          reviewReason: `Member added: ${memberName}`,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, teamId));
    }
  });
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  const [member] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  if (!member) throw new Error('MEMBER_NOT_FOUND');

  let isLastMember = false;

  await db.transaction(async (tx) => {
    await tx
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

    if (member.role === 'lead') {
      const [next] = await tx
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId))
        .orderBy(asc(teamMembers.joinedAt))
        .limit(1);

      if (next) {
        await tx
          .update(teamMembers)
          .set({ role: 'lead' })
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, next.userId)));
      } else {
        isLastMember = true;
      }
    }
    // admin_status intentionally NOT changed on removal
  });

  if (isLastMember) {
    await dissolveTeam(teamId, 'Last member left the team');
  }
}

export async function transferLeadership(
  teamId: string,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(teamMembers)
      .set({ role: 'member' })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, fromUserId)));

    await tx
      .update(teamMembers)
      .set({ role: 'lead' })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, toUserId)));
  });
  // admin_status intentionally NOT changed
}

// ---------------------------------------------------------------------------
// Join Requests
// ---------------------------------------------------------------------------

export async function createJoinRequest(
  teamId: string,
  userId: string,
  message: string | null,
  entryPoint: 'browse' | 'link' | 'participant_browse',
): Promise<TeamJoinRequest> {
  const [existing] = await db
    .select({ id: teamJoinRequests.id })
    .from(teamJoinRequests)
    .where(
      and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.userId, userId),
        eq(teamJoinRequests.status, 'pending'),
      ),
    )
    .limit(1);

  if (existing) throw new Error('JOIN_REQUEST_ALREADY_PENDING');

  const [request] = await db
    .insert(teamJoinRequests)
    .values({ teamId, userId, message, entryPoint })
    .returning();

  return request;
}

export async function getJoinRequests(teamId: string): Promise<JoinRequestWithUser[]> {
  const rows = await db
    .select({
      id: teamJoinRequests.id,
      teamId: teamJoinRequests.teamId,
      userId: teamJoinRequests.userId,
      status: teamJoinRequests.status,
      message: teamJoinRequests.message,
      entryPoint: teamJoinRequests.entryPoint,
      requestedAt: teamJoinRequests.requestedAt,
      updatedAt: teamJoinRequests.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
    })
    .from(teamJoinRequests)
    .innerJoin(users, eq(teamJoinRequests.userId, users.id))
    .where(
      and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.status, 'pending'),
      ),
    )
    .orderBy(asc(teamJoinRequests.requestedAt));

  return rows.map((row) => ({
    id: row.id,
    teamId: row.teamId,
    userId: row.userId,
    status: row.status,
    message: row.message,
    entryPoint: row.entryPoint,
    requestedAt: row.requestedAt,
    updatedAt: row.updatedAt,
    user: { name: row.userName, email: row.userEmail, avatarUrl: row.userAvatarUrl },
  }));
}

export async function respondToJoinRequest(
  requestId: string,
  status: 'accepted' | 'rejected',
  hackathonMaxSize: number,
): Promise<void> {
  const [request] = await db
    .select()
    .from(teamJoinRequests)
    .where(eq(teamJoinRequests.id, requestId))
    .limit(1);

  if (!request) throw new Error('REQUEST_NOT_FOUND');
  if (request.status !== 'pending') throw new Error('REQUEST_ALREADY_RESOLVED');

  if (status === 'accepted') {
    const [sizeResult] = await db
      .select({ memberCount: count() })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, request.teamId));

    if ((sizeResult?.memberCount ?? 0) >= hackathonMaxSize) throw new Error('TEAM_FULL');

    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    // addMember calls autoRegister internally
    await addMember(request.teamId, request.userId, user?.name ?? request.userId);

    await db
      .update(teamJoinRequests)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(teamJoinRequests.id, requestId));

    // Auto-reject remaining pending requests if team is now full
    const [newSizeResult] = await db
      .select({ memberCount: count() })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, request.teamId));

    if ((newSizeResult?.memberCount ?? 0) >= hackathonMaxSize) {
      await db
        .update(teamJoinRequests)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(
          and(
            eq(teamJoinRequests.teamId, request.teamId),
            eq(teamJoinRequests.status, 'pending'),
            ne(teamJoinRequests.id, requestId),
          ),
        );
    }
  } else {
    await db
      .update(teamJoinRequests)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(teamJoinRequests.id, requestId));
  }
}

// ---------------------------------------------------------------------------
// Email Invites
// ---------------------------------------------------------------------------

export async function inviteMemberByEmail(
  teamId: string,
  invitedByUserId: string,
  email: string,
): Promise<{ type: 'direct' | 'invite'; userId?: string }> {
  const [existingUser] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    // addMember calls autoRegister internally
    await addMember(teamId, existingUser.id, existingUser.name);
    return { type: 'direct', userId: existingUser.id };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(teamInvites).values({
    teamId,
    email,
    token: hashedToken,
    invitedBy: invitedByUserId,
    expiresAt,
  });

  // rawToken must be sent to the caller so it can be included in the email link
  return { type: 'invite' };
}

export async function acceptTeamInvite(
  rawToken: string,
): Promise<{ teamId: string; userId: string }> {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const [invite] = await db
    .select()
    .from(teamInvites)
    .where(eq(teamInvites.token, hashedToken))
    .limit(1);

  if (!invite) throw new Error('INVITE_NOT_FOUND');
  if (invite.acceptedAt) throw new Error('INVITE_ALREADY_USED');
  if (invite.expiresAt < new Date()) throw new Error('INVITE_EXPIRED');

  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, invite.email))
    .limit(1);

  if (!user) throw new Error('USER_NOT_FOUND');

  // addMember calls autoRegister internally
  await addMember(invite.teamId, user.id, user.name);

  await db
    .update(teamInvites)
    .set({ acceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(teamInvites.id, invite.id));

  return { teamId: invite.teamId, userId: user.id };
}

// ---------------------------------------------------------------------------
// Admin Approval
// ---------------------------------------------------------------------------

export async function approveTeam(teamId: string): Promise<void> {
  await db
    .update(teams)
    .set({ adminStatus: 'approved', reviewReason: null, updatedAt: new Date() })
    .where(eq(teams.id, teamId));
}

export async function rejectTeam(teamId: string): Promise<void> {
  await db
    .update(teams)
    .set({ adminStatus: 'rejected', updatedAt: new Date() })
    .where(eq(teams.id, teamId));
}

// ---------------------------------------------------------------------------
// Part 3 — Profile page service methods
// ---------------------------------------------------------------------------

export interface TeamMemberDetail {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: Date;
}

export interface TeamProfileData {
  id: string;
  hackathonId: string;
  name: string;
  description: string | null;
  inviteCode: string;
  isOpen: boolean;
  trackId: string | null;
  trackName: string | null;
  adminStatus: string;
  reviewReason: string | null;
  createdBy: string;
  memberCount: number;
  members: TeamMemberDetail[];
}

export async function getTeamWithMembers(teamId: string): Promise<TeamProfileData | null> {
  const [row] = await db
    .select({ team: teams, trackName: tracks.name })
    .from(teams)
    .leftJoin(tracks, eq(tracks.id, teams.trackId))
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!row) return null;

  const members = await db
    .select({
      userId: teamMembers.userId,
      name: users.name,
      avatarUrl: users.avatarUrl,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(teamMembers.joinedAt));

  return {
    id: row.team.id,
    hackathonId: row.team.hackathonId,
    name: row.team.name,
    description: row.team.description,
    inviteCode: row.team.inviteCode,
    isOpen: row.team.isOpen,
    trackId: row.team.trackId,
    trackName: row.trackName ?? null,
    adminStatus: row.team.adminStatus,
    reviewReason: row.team.reviewReason,
    createdBy: row.team.createdBy,
    memberCount: members.length,
    members,
  };
}

export interface JoinRequestForTeam {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  message: string | null;
  entryPoint: string;
  requestedAt: Date;
}

export async function getJoinRequestsForTeam(teamId: string): Promise<JoinRequestForTeam[]> {
  return db
    .select({
      id: teamJoinRequests.id,
      userId: teamJoinRequests.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
      message: teamJoinRequests.message,
      entryPoint: teamJoinRequests.entryPoint,
      requestedAt: teamJoinRequests.requestedAt,
    })
    .from(teamJoinRequests)
    .innerJoin(users, eq(users.id, teamJoinRequests.userId))
    .where(
      and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.status, 'pending'),
      ),
    )
    .orderBy(asc(teamJoinRequests.requestedAt));
}

export async function getTeamInviteByToken(token: string): Promise<{
  id: string;
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  teamName: string;
  hackathonTitle: string;
  hackathonSlug: string;
} | null> {
  const [row] = await db
    .select({
      id: teamInvites.id,
      email: teamInvites.email,
      expiresAt: teamInvites.expiresAt,
      acceptedAt: teamInvites.acceptedAt,
      teamName: teams.name,
      hackathonTitle: hackathons.title,
      hackathonSlug: hackathons.slug,
    })
    .from(teamInvites)
    .innerJoin(teams, eq(teams.id, teamInvites.teamId))
    .innerJoin(hackathons, eq(hackathons.id, teams.hackathonId))
    .where(eq(teamInvites.token, token))
    .limit(1);

  return row ?? null;
}
