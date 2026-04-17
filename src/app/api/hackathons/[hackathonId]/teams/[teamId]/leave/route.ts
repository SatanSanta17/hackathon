import { NextResponse } from 'next/server';

import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { getTeamWithMembers, removeMember } from '@/lib/services/team-service';

/**
 * POST /api/hackathons/[hackathonId]/teams/[teamId]/leave
 * Leave a team.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ hackathonId: string; teamId: string }> },
) {
  const { hackathonId, teamId } = await params;

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  const team = await getTeamWithMembers(teamId);
  if (!team || team.hackathonId !== hackathonId) {
    return NextResponse.json({ message: 'Team not found.' }, { status: 404 });
  }

  const isMember = team.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ message: 'You are not a member of this team.' }, { status: 403 });
  }

  try {
    await removeMember(teamId, user.id);
    return NextResponse.json({ message: 'Left team.' });
  } catch (err) {
    if (err instanceof Error && err.message === 'MEMBER_NOT_FOUND') {
      return NextResponse.json({ message: 'Member not found.' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
