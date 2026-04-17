import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons } from '@/db/schema';
import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { getTeamWithMembers, updateTeam } from '@/lib/services/team-service';
import { updateTeamSchema } from '@/lib/validations/team';

/**
 * GET /api/hackathons/[hackathonId]/teams/[teamId]
 * Fetch team details for the profile page.
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

  const [hackathon] = await db
    .select({
      title: hackathons.title,
      slug: hackathons.slug,
      requiresApproval: hackathons.requiresApproval,
      teamMaxSize: hackathons.teamMaxSize,
    })
    .from(hackathons)
    .where(and(eq(hackathons.id, hackathonId), isNull(hackathons.deletedAt)))
    .limit(1);

  if (!hackathon) {
    return NextResponse.json({ message: 'Hackathon not found.' }, { status: 404 });
  }

  const isMember = team.members.some((m) => m.userId === user.id);

  return NextResponse.json({
    team: {
      ...team,
      inviteCode: isMember ? team.inviteCode : undefined,
    },
    hackathon,
  });
}

/**
 * PATCH /api/hackathons/[hackathonId]/teams/[teamId]
 * Update team profile. Lead only.
 */
export async function PATCH(
  request: Request,
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
    return NextResponse.json({ message: 'Only the team lead can edit team details.' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const updated = await updateTeam(teamId, parsed.data);
    return NextResponse.json({ team: updated });
  } catch (err) {
    if (err instanceof Error && err.message === 'TEAM_NOT_FOUND') {
      return NextResponse.json({ message: 'Team not found.' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
