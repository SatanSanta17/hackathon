import { NextResponse } from 'next/server';

import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { getJoinRequestsForTeam, getTeamWithMembers } from '@/lib/services/team-service';

/**
 * GET /api/hackathons/[hackathonId]/teams/[teamId]/join-requests
 * List pending join requests. Lead only.
 */
export async function GET(
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

  const viewer = team.members.find((m) => m.userId === user.id);
  if (!viewer || viewer.role !== 'lead') {
    return NextResponse.json({ message: 'Only the team lead can view join requests.' }, { status: 403 });
  }

  const requests = await getJoinRequestsForTeam(teamId);
  return NextResponse.json({ requests });
}
