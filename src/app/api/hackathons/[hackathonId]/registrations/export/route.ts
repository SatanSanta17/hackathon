import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { hackathons } from '@/db/schema';
import { requireOrgRole } from '@/lib/auth/require-org-role';
import {
  getRegistrationsByHackathon,
  getRegistrationFields,
} from '@/lib/services/registration-service';

/**
 * GET /api/hackathons/[hackathonId]/registrations/export
 * Org-admin only — returns a CSV download of all registrations.
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
    return new Response('Hackathon not found.', { status: 404 });
  }

  const authResult = await requireOrgRole({
    orgId: hackathon.orgId,
    allowedRoles: ['org_admin'],
  });
  if ('error' in authResult) return authResult.error;

  const [rows, fields] = await Promise.all([
    getRegistrationsByHackathon(hackathonId),
    getRegistrationFields(hackathonId),
  ]);

  const customFieldLabels = fields.map((f) => `"${f.label}"`);
  const header = [
    'Name', 'Email', 'Department', 'Designation',
    'Registration Date', 'Team Name', 'Track', 'Discoverable',
    ...customFieldLabels,
  ].join(',');

  const dataRows = rows.map((r) => {
    const base = [
      `"${r.user.name.replace(/"/g, '""')}"`,
      `"${r.user.email.replace(/"/g, '""')}"`,
      `"${(r.formData?.department ?? '').replace(/"/g, '""')}"`,
      `"${(r.formData?.designation ?? '').replace(/"/g, '""')}"`,
      `"${r.registeredAt.toISOString()}"`,
      `"${(r.team?.name ?? '').replace(/"/g, '""')}"`,
      `"${(r.team?.trackName ?? '').replace(/"/g, '""')}"`,
      r.isDiscoverable ? 'Yes' : 'No',
    ];
    const customValues = fields.map((f) => `"${(r.formData?.[f.id] ?? '').replace(/"/g, '""')}"`);
    return [...base, ...customValues].join(',');
  });

  const csv = [header, ...dataRows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="registrations-${hackathonId}.csv"`,
    },
  });
}
