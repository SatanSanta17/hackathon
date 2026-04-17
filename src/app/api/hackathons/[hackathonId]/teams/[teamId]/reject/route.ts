import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons, teams } from '@/db/schema';
import { requireOrgRole } from '@/lib/auth/require-org-role';
import { rejectTeam } from '@/lib/services/team-service';

/**
 * POST /api/hackathons/[hackathonId]/teams/[teamId]/reject
 * Org-admin only — reject a team (pending or approved).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ hackathonId: string; teamId: string }> },
) {
  const { hackathonId, teamId } = await params;

  const [hackathon] = await db
    .select({ orgId: hackathons.orgId })
    .from(hackathons)
    .where(and(eq(hackathons.id, hackathonId), isNull(hackathons.deletedAt)))
    .limit(1);

  if (!hackathon) {
    return NextResponse.json({ message: 'Hackathon not found.' }, { status: 404 });
  }

  const authResult = await requireOrgRole({
    orgId: hackathon.orgId,
    allowedRoles: ['org_admin'],
  });
  if ('error' in authResult) return authResult.error;

  const [team] = await db
    .select({ id: teams.id, hackathonId: teams.hackathonId })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!team || team.hackathonId !== hackathonId) {
    return NextResponse.json({ message: 'Team not found.' }, { status: 404 });
  }

  await rejectTeam(teamId);

  return NextResponse.json({ success: true });
}
