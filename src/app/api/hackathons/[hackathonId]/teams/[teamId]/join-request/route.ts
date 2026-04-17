import { and, count, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons, teamMembers, teams } from '@/db/schema';
import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { getUserTeamForHackathon, createJoinRequest } from '@/lib/services/team-service';
import { joinRequestSchema } from '@/lib/validations/team';

/**
 * POST /api/hackathons/[hackathonId]/teams/[teamId]/join-request
 * Send a join request to a team.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string; teamId: string }> },
) {
  const { hackathonId, teamId } = await params;

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  const existingTeam = await getUserTeamForHackathon(user.id, hackathonId);
  if (existingTeam) {
    return NextResponse.json(
      { message: 'You are already on a team for this hackathon.' },
      { status: 403 },
    );
  }

  const [team] = await db
    .select({ id: teams.id, isOpen: teams.isOpen, hackathonId: teams.hackathonId })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!team || team.hackathonId !== hackathonId) {
    return NextResponse.json({ message: 'Team not found.' }, { status: 404 });
  }

  if (!team.isOpen) {
    return NextResponse.json({ message: 'This team is not accepting requests.' }, { status: 400 });
  }

  const [hackathon] = await db
    .select({ teamMaxSize: hackathons.teamMaxSize })
    .from(hackathons)
    .where(eq(hackathons.id, hackathonId))
    .limit(1);

  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));

  if (hackathon && memberCount >= hackathon.teamMaxSize) {
    return NextResponse.json({ message: 'This team is full.' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = joinRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const joinRequest = await createJoinRequest(
      teamId,
      user.id,
      parsed.data.message ?? null,
      parsed.data.entryPoint,
    );
    return NextResponse.json({ request: { id: joinRequest.id, status: joinRequest.status } }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'JOIN_REQUEST_ALREADY_PENDING') {
      return NextResponse.json(
        { message: 'You already have a pending request for this team.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
