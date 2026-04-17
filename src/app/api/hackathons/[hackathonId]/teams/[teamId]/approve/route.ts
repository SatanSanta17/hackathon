import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons, teams } from '@/db/schema';
import { requireOrgRole } from '@/lib/auth/require-org-role';
import { approveTeam } from '@/lib/services/team-service';

/**
 * POST /api/hackathons/[hackathonId]/teams/[teamId]/approve
 * Org-admin only — approve a pending-review team.
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
    .select({ id: teams.id, hackathonId: teams.hackathonId, adminStatus: teams.adminStatus })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!team || team.hackathonId !== hackathonId) {
    return NextResponse.json({ message: 'Team not found.' }, { status: 404 });
  }

  if (team.adminStatus !== 'pending_review') {
    return NextResponse.json({ message: 'Team is not pending review.' }, { status: 400 });
  }

  await approveTeam(teamId);

  return NextResponse.json({ success: true });
}
