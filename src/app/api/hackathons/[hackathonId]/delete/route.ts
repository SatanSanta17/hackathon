import { NextResponse } from 'next/server';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { softDeleteHackathon } from '@/lib/services/hackathon-service';

/**
 * POST /api/hackathons/[hackathonId]/delete — Soft-delete a draft hackathon
 *
 * Body: { orgId: string }
 *
 * Only draft hackathons can be deleted. Sets deleted_at timestamp (soft delete).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;
  console.log('[api/hackathons/[id]/delete] POST:', { hackathonId });

  try {
    const body = await request.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json(
        { message: 'Organization ID is required.' },
        { status: 400 },
      );
    }

    // Only org_admin can delete
    const authResult = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
    if ('error' in authResult) return authResult.error;

    const result = await softDeleteHackathon({ hackathonId, orgId });

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        HACKATHON_NOT_FOUND: 'Hackathon not found.',
        ONLY_DRAFTS_CAN_BE_DELETED: 'Only draft hackathons can be deleted.',
      };

      const message = errorMessages[result.error ?? ''] ?? result.error ?? 'Something went wrong.';
      const status = result.error === 'HACKATHON_NOT_FOUND' ? 404 : 400;

      return NextResponse.json({ message, errorCode: result.error }, { status });
    }

    console.log('[api/hackathons/[id]/delete] POST: deleted:', { id: hackathonId });
    return NextResponse.json({ message: 'Hackathon deleted.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    console.error('[api/hackathons/[id]/delete] POST error:', message);
    return NextResponse.json({ message }, { status: 500 });
  }
}
