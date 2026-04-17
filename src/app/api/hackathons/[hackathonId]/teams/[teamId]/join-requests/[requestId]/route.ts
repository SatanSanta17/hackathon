import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons } from '@/db/schema';
import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { ERR } from '@/lib/constants/error-codes';
import { getTeamWithMembers, respondToJoinRequest } from '@/lib/services/team-service';
import { respondToJoinRequestSchema } from '@/lib/validations/team';

/**
 * PATCH /api/hackathons/[hackathonId]/teams/[teamId]/join-requests/[requestId]
 * Approve or reject a join request. Lead only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string; teamId: string; requestId: string }> },
) {
  const { hackathonId, teamId, requestId } = await params;

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  const team = await getTeamWithMembers(teamId);
  if (!team || team.hackathonId !== hackathonId) {
    return NextResponse.json({ message: 'Team not found.' }, { status: 404 });
  }

  const viewer = team.members.find((m) => m.userId === user.id);
  if (!viewer || viewer.role !== 'lead') {
    return NextResponse.json({ message: 'Only the team lead can respond to join requests.' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = respondToJoinRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [hackathon] = await db
    .select({ teamMaxSize: hackathons.teamMaxSize })
    .from(hackathons)
    .where(and(eq(hackathons.id, hackathonId), isNull(hackathons.deletedAt)))
    .limit(1);

  if (!hackathon) {
    return NextResponse.json({ message: 'Hackathon not found.' }, { status: 404 });
  }

  try {
    await respondToJoinRequest(requestId, parsed.data.status, hackathon.teamMaxSize);
    return NextResponse.json({ message: `Request ${parsed.data.status}.` });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === ERR.REQUEST_NOT_FOUND) {
        return NextResponse.json({ message: 'Join request not found.' }, { status: 404 });
      }
      if (err.message === ERR.REQUEST_ALREADY_RESOLVED) {
        return NextResponse.json({ message: 'This request has already been resolved.' }, { status: 409 });
      }
      if (err.message === ERR.TEAM_FULL) {
        return NextResponse.json({ message: 'The team is full.' }, { status: 400 });
      }
    }
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
