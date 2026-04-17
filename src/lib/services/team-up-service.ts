import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { teamUpRequests, users } from '@/db/schema';
import { getRegistrationByUserAndHackathon } from '@/lib/services/registration-service';
import { addMember, createTeam, getUserTeamForHackathon } from '@/lib/services/team-service';
import type { TeamUpRequest } from '@/db/schema';

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
  const fromReg = await getRegistrationByUserAndHackathon(fromUserId, hackathonId);
  if (!fromReg) throw new Error('FROM_USER_NOT_REGISTERED');

  const toReg = await getRegistrationByUserAndHackathon(toUserId, hackathonId);
  if (!toReg) throw new Error('TO_USER_NOT_REGISTERED');

  const fromTeam = await getUserTeamForHackathon(fromUserId, hackathonId);
  if (fromTeam) throw new Error('FROM_USER_ALREADY_IN_TEAM');

  const toTeam = await getUserTeamForHackathon(toUserId, hackathonId);
  if (toTeam) throw new Error('TO_USER_ALREADY_IN_TEAM');

  const [existing] = await db
    .select({ id: teamUpRequests.id })
    .from(teamUpRequests)
    .where(
      and(
        eq(teamUpRequests.hackathonId, hackathonId),
        eq(teamUpRequests.fromUserId, fromUserId),
        eq(teamUpRequests.toUserId, toUserId),
        eq(teamUpRequests.status, 'pending'),
      ),
    )
    .limit(1);

  if (existing) throw new Error('TEAM_UP_REQUEST_ALREADY_PENDING');

  const [request] = await db
    .insert(teamUpRequests)
    .values({ hackathonId, fromUserId, toUserId, proposedTeamName, message })
    .returning();

  return request;
}

// ---------------------------------------------------------------------------
// Respond
// ---------------------------------------------------------------------------

export async function respondToTeamUpRequest(
  requestId: string,
  status: 'accepted' | 'rejected',
): Promise<{ teamId?: string }> {
  const [request] = await db
    .select()
    .from(teamUpRequests)
    .where(eq(teamUpRequests.id, requestId))
    .limit(1);

  if (!request) throw new Error('REQUEST_NOT_FOUND');
  if (request.status !== 'pending') throw new Error('REQUEST_ALREADY_RESOLVED');

  if (status === 'accepted') {
    // Re-validate at acceptance time — either user may have joined a team since the request
    const fromTeam = await getUserTeamForHackathon(request.fromUserId, request.hackathonId);
    if (fromTeam) throw new Error('FROM_USER_ALREADY_IN_TEAM');

    const toTeam = await getUserTeamForHackathon(request.toUserId, request.hackathonId);
    if (toTeam) throw new Error('TO_USER_ALREADY_IN_TEAM');

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
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(teamUpRequests.id, requestId));

    return { teamId: team.id };
  } else {
    await db
      .update(teamUpRequests)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(teamUpRequests.id, requestId));

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
        eq(teamUpRequests.status, 'pending'),
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
