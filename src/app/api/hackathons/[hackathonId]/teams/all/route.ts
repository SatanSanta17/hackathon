import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons } from '@/db/schema';
import { requireOrgRole } from '@/lib/auth/require-org-role';
import { getAllTeamsForHackathon, type AdminTeamRow } from '@/lib/services/team-service';

/**
 * GET /api/hackathons/[hackathonId]/teams/all
 * Org-admin only — all teams regardless of open/closed or approval status.
 * Distinct from the public GET /teams (which returns only open+approved for browse).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;

  const [hackathon] = await db
    .select({ orgId: hackathons.orgId, requiresApproval: hackathons.requiresApproval })
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

  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('trackId') ?? undefined;
  const isOpenParam = searchParams.get('isOpen');
  const isOpen = isOpenParam === null ? undefined : isOpenParam === 'true';
  const adminStatus = (searchParams.get('adminStatus') ?? undefined) as
    | AdminTeamRow['adminStatus']
    | undefined;

  const teams = await getAllTeamsForHackathon(hackathonId, { trackId, isOpen, adminStatus });

  return NextResponse.json({ teams, requiresApproval: hackathon.requiresApproval });
}
