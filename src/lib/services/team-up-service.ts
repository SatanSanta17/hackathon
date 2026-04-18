import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { hackathons, teamUpRequests, users } from '@/db/schema';

import { ERR } from '@/lib/constants/error-codes';
import { JOIN_REQUEST_STATUS } from '@/lib/constants/enums';
import { getEmailService } from '@/lib/email';
import {
  teamUpAcceptedEmail,
  teamUpDeclinedEmail,
  teamUpRequestEmail,
} from '@/lib/email/templates';

import { getRegistrationByUserAndHackathon } from '@/lib/services/registration-service';
import { addMember, createTeam, getUserTeamForHackathon } from '@/lib/services/team-service';

import type { TeamUpRequest } from '@/db/schema';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';
if (!APP_URL) {
  console.warn('[team-up-service] NEXT_PUBLIC_APP_URL is not set — email links will be broken');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamUpRequestWithUser extends TeamUpRequest {
  fromUser: { name: string; email: string; avatarUrl: string | null };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createTeamUpRequest(
  hackathonId: string,
  fromUserId: string,
  toUserId: string,
  proposedTeamName: string,
  message: string | null,
): Promise<TeamUpRequest> {
  console.log('[team-up-service] createTeamUpRequest:', { hackathonId, fromUserId, toUserId });
  const fromReg = await getRegistrationByUserAndHackathon(fromUserId, hackathonId);
  if (!fromReg) throw new Error(ERR.FROM_USER_NOT_REGISTERED);

  const toReg = await getRegistrationByUserAndHackathon(toUserId, hackathonId);
  if (!toReg) throw new Error(ERR.TO_USER_NOT_REGISTERED);

  const fromTeam = await getUserTeamForHackathon(fromUserId, hackathonId);
  if (fromTeam) throw new Error(ERR.FROM_USER_ALREADY_IN_TEAM);

  const toTeam = await getUserTeamForHackathon(toUserId, hackathonId);
  if (toTeam) throw new Error(ERR.TO_USER_ALREADY_IN_TEAM);

  const [existing] = await db
    .select({ id: teamUpRequests.id })
    .from(teamUpRequests)
    .where(
      and(
        eq(teamUpRequests.hackathonId, hackathonId),
        eq(teamUpRequests.fromUserId, fromUserId),
        eq(teamUpRequests.toUserId, toUserId),
        eq(teamUpRequests.status, JOIN_REQUEST_STATUS.PENDING),
      ),
    )
    .limit(1);

  if (existing) throw new Error(ERR.TEAM_UP_REQUEST_ALREADY_PENDING);

  const [request] = await db
    .insert(teamUpRequests)
    .values({ hackathonId, fromUserId, toUserId, proposedTeamName, message })
    .returning();

  try {
    const [fromUser] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, fromUserId))
      .limit(1);
    const [toUser] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, toUserId))
      .limit(1);
    const [hackathon] = await db
      .select({ title: hackathons.title, slug: hackathons.slug })
      .from(hackathons)
      .where(eq(hackathons.id, hackathonId))
      .limit(1);
    if (fromUser && toUser && hackathon) {
      const respondUrl = `${APP_URL}/hackathons/${hackathon.slug}/participants`;
      const emailService = getEmailService();
      await emailService.send({
        to: toUser.email,
        ...teamUpRequestEmail({
          recipientName: toUser.name,
          requesterName: fromUser.name,
          proposedTeamName,
          hackathonTitle: hackathon.title,
          message,
          respondUrl,
        }),
      });
    }
  } catch (err) {
    console.error('[team-up-service] createTeamUpRequest: email send failed:', err);
  }

  return request;
}

// ---------------------------------------------------------------------------
// Respond
// ---------------------------------------------------------------------------

export async function respondToTeamUpRequest(
  requestId: string,
  status: 'accepted' | 'rejected',
): Promise<{ teamId?: string }> {
  console.log('[team-up-service] respondToTeamUpRequest:', { requestId, status });
  const [request] = await db
    .select()
    .from(teamUpRequests)
    .where(eq(teamUpRequests.id, requestId))
    .limit(1);

  if (!request) throw new Error(ERR.REQUEST_NOT_FOUND);
  if (request.status !== JOIN_REQUEST_STATUS.PENDING) throw new Error(ERR.REQUEST_ALREADY_RESOLVED);

  if (status === 'accepted') {
    // Re-validate at acceptance time — either user may have joined a team since the request
    const fromTeam = await getUserTeamForHackathon(request.fromUserId, request.hackathonId);
    if (fromTeam) throw new Error(ERR.FROM_USER_ALREADY_IN_TEAM);

    const toTeam = await getUserTeamForHackathon(request.toUserId, request.hackathonId);
    if (toTeam) throw new Error(ERR.TO_USER_ALREADY_IN_TEAM);

    // Create team with requester as lead (also inserts them into team_members)
    const team = await createTeam(request.hackathonId, request.fromUserId, {
      name: request.proposedTeamName,
      isOpen: true,
    });

    const [toUser] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, request.toUserId))
      .limit(1);

    // addMember calls autoRegister — acceptee is already registered so this is a no-op
    await addMember(team.id, request.toUserId, toUser?.name ?? request.toUserId);

    await db
      .update(teamUpRequests)
      .set({ status: JOIN_REQUEST_STATUS.ACCEPTED, updatedAt: new Date() })
      .where(eq(teamUpRequests.id, requestId));

    try {
      const [fromUser] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, request.fromUserId))
        .limit(1);
      const [hackathon] = await db
        .select({ title: hackathons.title, slug: hackathons.slug })
        .from(hackathons)
        .where(eq(hackathons.id, request.hackathonId))
        .limit(1);
      if (fromUser && toUser && hackathon) {
        const teamUrl = `${APP_URL}/hackathons/${hackathon.slug}/teams/${team.id}`;
        const emailService = getEmailService();
        await emailService.send({
          to: fromUser.email,
          ...teamUpAcceptedEmail({
            requesterName: fromUser.name,
            accepteeName: toUser.name,
            teamName: request.proposedTeamName,
            hackathonTitle: hackathon.title,
            teamUrl,
          }),
        });
      }
    } catch (err) {
      console.error('[team-up-service] respondToTeamUpRequest: accepted email send failed:', err);
    }

    return { teamId: team.id };
  } else {
    await db
      .update(teamUpRequests)
      .set({ status: JOIN_REQUEST_STATUS.REJECTED, updatedAt: new Date() })
      .where(eq(teamUpRequests.id, requestId));

    try {
      const [fromUser] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, request.fromUserId))
        .limit(1);
      const [toUser] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, request.toUserId))
        .limit(1);
      const [hackathon] = await db
        .select({ title: hackathons.title, slug: hackathons.slug })
        .from(hackathons)
        .where(eq(hackathons.id, request.hackathonId))
        .limit(1);
      if (fromUser && toUser && hackathon) {
        const browseUrl = `${APP_URL}/hackathons/${hackathon.slug}/participants`;
        const emailService = getEmailService();
        await emailService.send({
          to: fromUser.email,
          ...teamUpDeclinedEmail({
            requesterName: fromUser.name,
            declineeName: toUser.name,
            proposedTeamName: request.proposedTeamName,
            hackathonTitle: hackathon.title,
            browseUrl,
          }),
        });
      }
    } catch (err) {
      console.error('[team-up-service] respondToTeamUpRequest: rejected email send failed:', err);
    }

    return {};
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getTeamUpRequestsForUser(
  userId: string,
  hackathonId: string,
): Promise<TeamUpRequestWithUser[]> {
  console.log('[team-up-service] getTeamUpRequestsForUser:', { userId, hackathonId });
  const rows = await db
    .select({
      id: teamUpRequests.id,
      hackathonId: teamUpRequests.hackathonId,
      fromUserId: teamUpRequests.fromUserId,
      toUserId: teamUpRequests.toUserId,
      proposedTeamName: teamUpRequests.proposedTeamName,
      message: teamUpRequests.message,
      status: teamUpRequests.status,
      requestedAt: teamUpRequests.requestedAt,
      updatedAt: teamUpRequests.updatedAt,
      fromUserName: users.name,
      fromUserEmail: users.email,
      fromUserAvatarUrl: users.avatarUrl,
    })
    .from(teamUpRequests)
    .innerJoin(users, eq(teamUpRequests.fromUserId, users.id))
    .where(
      and(
        eq(teamUpRequests.toUserId, userId),
        eq(teamUpRequests.hackathonId, hackathonId),
        eq(teamUpRequests.status, JOIN_REQUEST_STATUS.PENDING),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    hackathonId: row.hackathonId,
    fromUserId: row.fromUserId,
    toUserId: row.toUserId,
    proposedTeamName: row.proposedTeamName,
    message: row.message,
    status: row.status,
    requestedAt: row.requestedAt,
    updatedAt: row.updatedAt,
    fromUser: {
      name: row.fromUserName,
      email: row.fromUserEmail,
      avatarUrl: row.fromUserAvatarUrl,
    },
  }));
}
