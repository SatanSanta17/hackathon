import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons } from '@/db/schema';
import { requireOrgRole } from '@/lib/auth/require-org-role';
import { getRegistrationsByHackathon } from '@/lib/services/registration-service';

/**
 * GET /api/hackathons/[hackathonId]/registrations
 * Org-admin only — full participant roster with user and team data.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;

  // Fetch hackathon to get orgId for auth check
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

  const registrations = await getRegistrationsByHackathon(hackathonId);
  return NextResponse.json({ registrations });
}
