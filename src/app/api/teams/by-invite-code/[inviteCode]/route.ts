import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons, teamMembers, teams } from '@/db/schema';
import { count } from 'drizzle-orm';
import { getTeamByInviteCode } from '@/lib/services/team-service';

/**
 * GET /api/teams/by-invite-code/[inviteCode]
 * Look up a team by its invite code. Public route.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await params;

  const team = await getTeamByInviteCode(inviteCode);
  if (!team) {
    return NextResponse.json({ message: 'Team not found.' }, { status: 404 });
  }

  const [hackathon] = await db
    .select({
      id: hackathons.id,
      slug: hackathons.slug,
      title: hackathons.title,
      teamMaxSize: hackathons.teamMaxSize,
    })
    .from(hackathons)
    .where(and(eq(hackathons.id, team.hackathonId), isNull(hackathons.deletedAt)))
    .limit(1);

  if (!hackathon) {
    return NextResponse.json({ message: 'Hackathon not found.' }, { status: 404 });
  }

  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, team.id));

  return NextResponse.json({
    team: {
      id: team.id,
      name: team.name,
      hackathonId: team.hackathonId,
      hackathonSlug: hackathon.slug,
      hackathonTitle: hackathon.title,
      isOpen: team.isOpen,
      memberCount,
      teamMaxSize: hackathon.teamMaxSize,
    },
  });
}
