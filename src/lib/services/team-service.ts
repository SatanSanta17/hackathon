import crypto from 'crypto';
import { and, asc, count, eq, inArray, isNull, ne } from 'drizzle-orm';

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
import {
  joinRequestAcceptedEmail,
  joinRequestReceivedEmail,
  joinRequestRejectedEmail,
  teamApprovedEmail,
  teamCreatedPendingReviewEmail,
  teamDisbandedAdminEmail,
  teamInviteExistingUserEmail,
  teamInviteNewUserEmail,
  teamRejectedEmail,
} from '@/lib/email/templates';
import { ERR } from '@/lib/constants/error-codes';
import { JOIN_REQUEST_STATUS, TEAM_ADMIN_STATUS, TEAM_MEMBER_ROLE } from '@/lib/constants/enums';
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
// Module-level constants
// ---------------------------------------------------------------------------

const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_RETRY_ATTEMPTS = 5;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';
if (!APP_URL) {
  console.warn('[team-service] NEXT_PUBLIC_APP_URL is not set — email invite links will be broken');
}

// ---------------------------------------------------------------------------
// Invite Code
// ---------------------------------------------------------------------------

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < INVITE_CODE_RETRY_ATTEMPTS; attempt++) {
    const code = Array.from(
      { length: INVITE_CODE_LENGTH },
      () => INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)],
    ).join('');

    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.inviteCode, code))
      .limit(1);

    if (!existing) return code;
  }
  throw new Error(ERR.INVITE_CODE_GENERATION_FAILED);
}

// ---------------------------------------------------------------------------
// Dissolve Team — explicit exported function (P1.R20)
// ---------------------------------------------------------------------------

export async function dissolveTeam(
  teamId: string,
  reason: string = 'Team disbanded',
): Promise<void> {
  console.log('[team-service] dissolveTeam:', { teamId, reason });
  const [team] = await db
    .select({ hackathonId: teams.hackathonId, name: teams.name })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!team) {
    console.log('[team-service] dissolveTeam: team not found or already dissolved:', { teamId });
    return;
  }

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
  } catch (err) {
    console.error('[team-service] dissolveTeam: email send failed:', err);
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
  console.log('[team-service] createTeam:', { hackathonId, userId, name: data.name });
  const [hackathon] = await db
    .select({ requiresApproval: hackathons.requiresApproval, title: hackathons.title, slug: hackathons.slug })
    .from(hackathons)
    .where(eq(hackathons.id, hackathonId))
    .limit(1);

  if (!hackathon) throw new Error(ERR.HACKATHON_NOT_FOUND);

  const existingTeam = await getUserTeamForHackathon(userId, hackathonId);
  if (existingTeam) throw new Error(ERR.ALREADY_IN_TEAM);

  const inviteCode = await generateUniqueInviteCode();
  const adminStatus = hackathon.requiresApproval ? TEAM_ADMIN_STATUS.PENDING_REVIEW : TEAM_ADMIN_STATUS.APPROVED;
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
      role: TEAM_MEMBER_ROLE.LEAD,
    });

    return [created];
  });

  if (hackathon.requiresApproval) {
    try {
      const [lead] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const teamUrl = `${APP_URL}/hackathons/${hackathon.slug}/teams/${team.id}`;
      const emailService = getEmailService();
      await emailService.send({
        to: lead.email,
        ...teamCreatedPendingReviewEmail({
          leadName: lead.name,
          teamName: data.name,
          hackathonTitle: hackathon.title,
          teamUrl,
        }),
      });
    } catch (err) {
      console.error('[team-service] createTeam: email send failed:', err);
    }
  }

  return team;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getTeamById(teamId: string): Promise<TeamWithMembers | null> {
  console.log('[team-service] getTeamById:', { teamId });
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
        eq(teamJoinRequests.status, JOIN_REQUEST_STATUS.PENDING),
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
  console.log('[team-service] getTeamByInviteCode:', { inviteCode });
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
    isAdmin?: boolean; // when true, skips the isOpen/capacity filters so admins see all teams
    trackId?: string;
    isOpen?: boolean;
    adminStatus?: string;
    maxSize?: number;
  } = {},
): Promise<TeamBrowseItem[]> {
  console.log('[team-service] getTeamsByHackathon:', { hackathonId, filters });
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
  console.log('[team-service] getUserTeamForHackathon:', { userId, hackathonId });
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
  console.log('[team-service] getPendingTeams:', { hackathonId });
  const pending = await db
    .select({ id: teams.id })
    .from(teams)
    .where(
      and(
        eq(teams.hackathonId, hackathonId),
        eq(teams.adminStatus, TEAM_ADMIN_STATUS.PENDING_REVIEW),
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
  console.log('[team-service] updateTeam:', { teamId, ...data });
  const [row] = await db
    .select({ hackathonId: teams.hackathonId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!row) throw new Error(ERR.TEAM_NOT_FOUND);

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
        ? { adminStatus: TEAM_ADMIN_STATUS.PENDING_REVIEW, reviewReason: 'Team profile edited' }
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
  console.log('[team-service] addMember:', { teamId, userId });
  const [team] = await db
    .select({ hackathonId: teams.hackathonId })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!team) throw new Error(ERR.TEAM_NOT_FOUND);

  const [hackathon] = await db
    .select({ requiresApproval: hackathons.requiresApproval, teamMaxSize: hackathons.teamMaxSize })
    .from(hackathons)
    .where(eq(hackathons.id, team.hackathonId))
    .limit(1);

  const requiresApproval = hackathon?.requiresApproval ?? false;

  // Auto-register before the transaction to keep the transaction scope tight
  await autoRegister(team.hackathonId, userId);

  await db.transaction(async (tx) => {
    // Definitive capacity check inside the transaction — reduces over-enrollment under concurrency
    if (hackathon && hackathon.teamMaxSize > 0) {
      const [sizeResult] = await tx
        .select({ memberCount: count() })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId));
      if ((sizeResult?.memberCount ?? 0) >= hackathon.teamMaxSize) {
        throw new Error(ERR.TEAM_FULL);
      }
    }
    await tx.insert(teamMembers).values({ teamId, userId, role: TEAM_MEMBER_ROLE.MEMBER });

    if (requiresApproval) {
      await tx
        .update(teams)
        .set({
          adminStatus: TEAM_ADMIN_STATUS.PENDING_REVIEW,
          reviewReason: `Member added: ${memberName}`,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, teamId));
    }
  });
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  console.log('[team-service] removeMember:', { teamId, userId });
  const [member] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  if (!member) throw new Error(ERR.MEMBER_NOT_FOUND);

  let isLastMember = false;

  await db.transaction(async (tx) => {
    await tx
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

    if (member.role === TEAM_MEMBER_ROLE.LEAD) {
      const [next] = await tx
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId))
        .orderBy(asc(teamMembers.joinedAt))
        .limit(1);

      if (next) {
        await tx
          .update(teamMembers)
          .set({ role: TEAM_MEMBER_ROLE.LEAD })
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
  console.log('[team-service] transferLeadership:', { teamId, fromUserId, toUserId });
  await db.transaction(async (tx) => {
    await tx
      .update(teamMembers)
      .set({ role: TEAM_MEMBER_ROLE.MEMBER })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, fromUserId)));

    await tx
      .update(teamMembers)
      .set({ role: TEAM_MEMBER_ROLE.LEAD })
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
  console.log('[team-service] createJoinRequest:', { teamId, userId, entryPoint });
  const [existing] = await db
    .select({ id: teamJoinRequests.id })
    .from(teamJoinRequests)
    .where(
      and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.userId, userId),
        eq(teamJoinRequests.status, JOIN_REQUEST_STATUS.PENDING),
      ),
    )
    .limit(1);

  if (existing) throw new Error(ERR.JOIN_REQUEST_ALREADY_PENDING);

  const [request] = await db
    .insert(teamJoinRequests)
    .values({ teamId, userId, message, entryPoint })
    .returning();

  try {
    const [teamRow] = await db
      .select({ name: teams.name, hackathonId: teams.hackathonId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    const [requester] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!teamRow || !requester) return request;
    const [hackathonRow] = await db
      .select({ title: hackathons.title, slug: hackathons.slug })
      .from(hackathons)
      .where(eq(hackathons.id, teamRow.hackathonId))
      .limit(1);
    const [lead] = await db
      .select({ name: users.name, email: users.email })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, TEAM_MEMBER_ROLE.LEAD)))
      .limit(1);
    if (!hackathonRow || !lead) return request;
    const teamUrl = `${APP_URL}/hackathons/${hackathonRow.slug}/teams/${teamId}`;
    const emailService = getEmailService();
    await emailService.send({
      to: lead.email,
      ...joinRequestReceivedEmail({
        leadName: lead.name,
        requesterName: requester.name,
        teamName: teamRow.name,
        hackathonTitle: hackathonRow.title,
        message,
        teamUrl,
      }),
    });
  } catch (err) {
    console.error('[team-service] createJoinRequest: email send failed:', err);
  }

  return request;
}

export async function getJoinRequests(teamId: string): Promise<JoinRequestWithUser[]> {
  console.log('[team-service] getJoinRequests:', { teamId });
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
        eq(teamJoinRequests.status, JOIN_REQUEST_STATUS.PENDING),
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
  console.log('[team-service] respondToJoinRequest:', { requestId, status });
  const [request] = await db
    .select()
    .from(teamJoinRequests)
    .where(eq(teamJoinRequests.id, requestId))
    .limit(1);

  if (!request) throw new Error(ERR.REQUEST_NOT_FOUND);
  if (request.status !== JOIN_REQUEST_STATUS.PENDING) throw new Error(ERR.REQUEST_ALREADY_RESOLVED);

  if (status === 'accepted') {
    const [sizeResult] = await db
      .select({ memberCount: count() })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, request.teamId));

    if ((sizeResult?.memberCount ?? 0) >= hackathonMaxSize) throw new Error(ERR.TEAM_FULL);

    const [user] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    // addMember calls autoRegister internally
    await addMember(request.teamId, request.userId, user?.name ?? request.userId);

    await db
      .update(teamJoinRequests)
      .set({ status: JOIN_REQUEST_STATUS.ACCEPTED, updatedAt: new Date() })
      .where(eq(teamJoinRequests.id, requestId));

    try {
      const [teamRow] = await db
        .select({ name: teams.name, hackathonId: teams.hackathonId })
        .from(teams)
        .where(eq(teams.id, request.teamId))
        .limit(1);
      if (teamRow && user) {
        const [hackathonRow] = await db
          .select({ title: hackathons.title, slug: hackathons.slug })
          .from(hackathons)
          .where(eq(hackathons.id, teamRow.hackathonId))
          .limit(1);
        if (hackathonRow) {
          const teamUrl = `${APP_URL}/hackathons/${hackathonRow.slug}/teams/${request.teamId}`;
          const emailService = getEmailService();
          await emailService.send({
            to: user.email,
            ...joinRequestAcceptedEmail({
              name: user.name,
              teamName: teamRow.name,
              hackathonTitle: hackathonRow.title,
              teamUrl,
            }),
          });
        }
      }
    } catch (err) {
      console.error('[team-service] respondToJoinRequest: accepted email send failed:', err);
    }

    // Auto-reject remaining pending requests if team is now full
    const [newSizeResult] = await db
      .select({ memberCount: count() })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, request.teamId));

    if ((newSizeResult?.memberCount ?? 0) >= hackathonMaxSize) {
      await db
        .update(teamJoinRequests)
        .set({ status: JOIN_REQUEST_STATUS.REJECTED, updatedAt: new Date() })
        .where(
          and(
            eq(teamJoinRequests.teamId, request.teamId),
            eq(teamJoinRequests.status, JOIN_REQUEST_STATUS.PENDING),
            ne(teamJoinRequests.id, requestId),
          ),
        );
    }
  } else {
    await db
      .update(teamJoinRequests)
      .set({ status: JOIN_REQUEST_STATUS.REJECTED, updatedAt: new Date() })
      .where(eq(teamJoinRequests.id, requestId));

    try {
      const [userData] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);
      const [teamRow] = await db
        .select({ name: teams.name, hackathonId: teams.hackathonId })
        .from(teams)
        .where(eq(teams.id, request.teamId))
        .limit(1);
      if (userData && teamRow) {
        const [hackathonRow] = await db
          .select({ title: hackathons.title, slug: hackathons.slug })
          .from(hackathons)
          .where(eq(hackathons.id, teamRow.hackathonId))
          .limit(1);
        if (hackathonRow) {
          const browseUrl = `${APP_URL}/hackathons/${hackathonRow.slug}/teams`;
          const emailService = getEmailService();
          await emailService.send({
            to: userData.email,
            ...joinRequestRejectedEmail({
              name: userData.name,
              teamName: teamRow.name,
              hackathonTitle: hackathonRow.title,
              browseUrl,
            }),
          });
        }
      }
    } catch (err) {
      console.error('[team-service] respondToJoinRequest: rejected email send failed:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Email Invites
// ---------------------------------------------------------------------------

export async function inviteMemberByEmail(
  teamId: string,
  invitedByUserId: string,
  email: string,
): Promise<void> {
  console.log('[team-service] inviteMemberByEmail:', { teamId, invitedByUserId, email });

  const [teamRow] = await db
    .select({ name: teams.name, hackathonId: teams.hackathonId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  const [hackathonRow] = teamRow
    ? await db
        .select({ title: hackathons.title, slug: hackathons.slug })
        .from(hackathons)
        .where(eq(hackathons.id, teamRow.hackathonId))
        .limit(1)
    : [];

  // Block duplicate pending invites for the same (teamId, email)
  const [existingInvite] = await db
    .select({ id: teamInvites.id })
    .from(teamInvites)
    .where(
      and(
        eq(teamInvites.teamId, teamId),
        eq(teamInvites.email, email),
        isNull(teamInvites.acceptedAt),
      ),
    )
    .limit(1);
  if (existingInvite) return;

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

  const acceptUrl = `${APP_URL}/team-invites/accept?token=${rawToken}`;

  const [existingUser] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  try {
    if (teamRow && hackathonRow) {
      const emailService = getEmailService();
      if (existingUser) {
        await emailService.send({
          to: email,
          ...teamInviteExistingUserEmail({
            name: existingUser.name,
            teamName: teamRow.name,
            hackathonTitle: hackathonRow.title,
            acceptUrl,
          }),
        });
      } else {
        await emailService.send({
          to: email,
          ...teamInviteNewUserEmail({
            teamName: teamRow.name,
            hackathonTitle: hackathonRow.title,
            acceptUrl,
          }),
        });
      }
    }
  } catch (err) {
    console.error('[team-service] inviteMemberByEmail: email send failed:', err);
  }
}

export async function acceptTeamInvite(
  rawToken: string,
  authenticatedUserId: string,
): Promise<{ teamId: string; userId: string }> {
  console.log('[team-service] acceptTeamInvite:', { authenticatedUserId });
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const [invite] = await db
    .select()
    .from(teamInvites)
    .where(eq(teamInvites.token, hashedToken))
    .limit(1);

  if (!invite) throw new Error(ERR.INVITE_NOT_FOUND);
  if (invite.acceptedAt) throw new Error(ERR.INVITE_ALREADY_USED);
  if (invite.expiresAt < new Date()) throw new Error(ERR.INVITE_EXPIRED);

  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, invite.email))
    .limit(1);

  if (!user) throw new Error(ERR.USER_NOT_FOUND);
  if (user.id !== authenticatedUserId) throw new Error(ERR.INVITE_EMAIL_MISMATCH);

  // Capacity check — team may have filled between invite creation and acceptance
  const [hackathonRow] = await db
    .select({ teamMaxSize: hackathons.teamMaxSize })
    .from(hackathons)
    .innerJoin(teams, eq(teams.hackathonId, hackathons.id))
    .where(eq(teams.id, invite.teamId))
    .limit(1);
  const [sizeResult] = await db
    .select({ memberCount: count() })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, invite.teamId));
  if (hackathonRow && (sizeResult?.memberCount ?? 0) >= hackathonRow.teamMaxSize) {
    throw new Error(ERR.TEAM_FULL);
  }

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
  console.log('[team-service] approveTeam:', { teamId });
  await db
    .update(teams)
    .set({ adminStatus: TEAM_ADMIN_STATUS.APPROVED, reviewReason: null, updatedAt: new Date() })
    .where(eq(teams.id, teamId));

  // Send approval emails outside the update so email failure cannot roll back the status change
  try {
    const [teamRow] = await db
      .select({ name: teams.name, hackathonId: teams.hackathonId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!teamRow) {
      console.warn('[team-service] approveTeam: team not found post-update, skipping emails:', { teamId });
      return;
    }

    const [hackathon] = await db
      .select({ title: hackathons.title, slug: hackathons.slug })
      .from(hackathons)
      .where(eq(hackathons.id, teamRow.hackathonId))
      .limit(1);

    if (!hackathon) {
      console.warn('[team-service] approveTeam: hackathon not found, skipping emails:', { hackathonId: teamRow.hackathonId });
      return;
    }

    const members = await db
      .select({ name: users.name, email: users.email })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, teamId));

    const teamUrl = `${APP_URL}/hackathons/${hackathon.slug}/teams/${teamId}`;
    const emailService = getEmailService();

    for (const member of members) {
      await emailService.send({
        to: member.email,
        ...teamApprovedEmail({
          memberName: member.name,
          teamName: teamRow.name,
          hackathonTitle: hackathon.title,
          teamUrl,
        }),
      });
    }
  } catch (err) {
    console.error('[team-service] approveTeam: email send failed:', err);
  }
}

export async function rejectTeam(teamId: string): Promise<void> {
  console.log('[team-service] rejectTeam:', { teamId });
  await db
    .update(teams)
    .set({ adminStatus: TEAM_ADMIN_STATUS.REJECTED, updatedAt: new Date() })
    .where(eq(teams.id, teamId));

  try {
    const [teamRow] = await db
      .select({ name: teams.name, hackathonId: teams.hackathonId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!teamRow) {
      console.warn('[team-service] rejectTeam: team not found post-update, skipping emails:', { teamId });
      return;
    }

    const [hackathon] = await db
      .select({ title: hackathons.title, orgId: hackathons.orgId })
      .from(hackathons)
      .where(eq(hackathons.id, teamRow.hackathonId))
      .limit(1);

    if (!hackathon) {
      console.warn('[team-service] rejectTeam: hackathon not found, skipping emails:', { hackathonId: teamRow.hackathonId });
      return;
    }

    const [leadRow] = await db
      .select({ name: users.name, email: users.email })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, TEAM_MEMBER_ROLE.LEAD)))
      .limit(1);

    if (!leadRow) {
      console.warn('[team-service] rejectTeam: lead not found, skipping emails:', { teamId });
      return;
    }

    const [adminRow] = await db
      .select({ email: users.email })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .where(
        and(
          eq(orgMemberships.orgId, hackathon.orgId),
          eq(orgMemberships.role, 'org_admin'),
          isNull(orgMemberships.deletedAt),
        ),
      )
      .limit(1);

    const emailService = getEmailService();
    await emailService.send({
      to: leadRow.email,
      ...teamRejectedEmail({
        leadName: leadRow.name,
        teamName: teamRow.name,
        hackathonTitle: hackathon.title,
        organizerEmail: adminRow?.email ?? (process.env.FROM_EMAIL ?? ''),
      }),
    });
  } catch (err) {
    console.error('[team-service] rejectTeam: email send failed:', err);
  }
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
  console.log('[team-service] getTeamWithMembers:', { teamId });
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
  console.log('[team-service] getJoinRequestsForTeam:', { teamId });
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
        eq(teamJoinRequests.status, JOIN_REQUEST_STATUS.PENDING),
      ),
    )
    .orderBy(asc(teamJoinRequests.requestedAt));
}

// ---------------------------------------------------------------------------
// Part 4 — Admin team management
// ---------------------------------------------------------------------------

export interface AdminTeamRow {
  id: string;
  name: string;
  trackId: string | null;
  trackName: string | null;
  isOpen: boolean;
  memberCount: number;
  leadName: string | null;
  adminStatus: 'pending_review' | 'approved' | 'rejected';
  reviewReason: string | null;
  createdAt: Date;
}

export async function getAllTeamsForHackathon(
  hackathonId: string,
  filters?: {
    trackId?: string;
    isOpen?: boolean;
    adminStatus?: 'pending_review' | 'approved' | 'rejected';
  },
): Promise<AdminTeamRow[]> {
  console.log('[team-service] getAllTeamsForHackathon:', { hackathonId, filters });
  const conditions = [eq(teams.hackathonId, hackathonId), isNull(teams.deletedAt)];
  if (filters?.trackId) conditions.push(eq(teams.trackId, filters.trackId));
  if (filters?.isOpen !== undefined) conditions.push(eq(teams.isOpen, filters.isOpen));
  if (filters?.adminStatus) conditions.push(eq(teams.adminStatus, filters.adminStatus));

  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      trackId: teams.trackId,
      trackName: tracks.name,
      isOpen: teams.isOpen,
      adminStatus: teams.adminStatus,
      reviewReason: teams.reviewReason,
      createdAt: teams.createdAt,
    })
    .from(teams)
    .leftJoin(tracks, eq(tracks.id, teams.trackId))
    .where(and(...conditions))
    .orderBy(asc(teams.createdAt));

  if (teamRows.length === 0) return [];

  const teamIds = teamRows.map((t) => t.id);
  const memberRows = await db
    .select({
      teamId: teamMembers.teamId,
      role: teamMembers.role,
      userName: users.name,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(inArray(teamMembers.teamId, teamIds));

  return teamRows.map((team) => {
    const members = memberRows.filter((m) => m.teamId === team.id);
    const lead = members.find((m) => m.role === TEAM_MEMBER_ROLE.LEAD);
    return {
      id: team.id,
      name: team.name,
      trackId: team.trackId,
      trackName: team.trackName ?? null,
      isOpen: team.isOpen,
      adminStatus: team.adminStatus as AdminTeamRow['adminStatus'],
      reviewReason: team.reviewReason,
      createdAt: team.createdAt,
      memberCount: members.length,
      leadName: lead?.userName ?? null,
    };
  });
}

export async function getTeamInviteByToken(token: string): Promise<{
  // Note: token is the raw token (not hashed) — hashing happens inside this function
  id: string;
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  teamName: string;
  hackathonTitle: string;
  hackathonSlug: string;
} | null> {
  console.log('[team-service] getTeamInviteByToken');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
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
    .where(eq(teamInvites.token, hashedToken))
    .limit(1);

  return row ?? null;
}
