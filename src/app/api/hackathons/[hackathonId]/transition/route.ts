import { NextResponse } from 'next/server';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { transitionStatusSchema } from '@/lib/validations/hackathon';
import { transitionHackathonStatus } from '@/lib/services/hackathon-service';

/**
 * POST /api/hackathons/[hackathonId]/transition — Manually transition hackathon status
 *
 * Body: { orgId: string, targetStatus: string }
 *
 * Valid transitions: draft→published, published→active, active→judging,
 *                    judging→completed, completed→archived
 *
 * Note: draft→published delegates to publishHackathon() internally for validation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;
  console.log('[api/hackathons/[id]/transition] POST:', { hackathonId });

  try {
    const body = await request.json();
    const { orgId, ...data } = body;

    if (!orgId) {
      return NextResponse.json(
        { message: 'Organization ID is required.' },
        { status: 400 },
      );
    }

    // Only org_admin can transition statuses
    const authResult = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
    if ('error' in authResult) return authResult.error;

    const parsed = transitionStatusSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await transitionHackathonStatus({
      hackathonId,
      orgId,
      targetStatus: parsed.data.targetStatus,
    });

    if (!result.success) {
      if (result.error === 'HACKATHON_NOT_FOUND') {
        return NextResponse.json({ message: 'Hackathon not found.' }, { status: 404 });
      }
      return NextResponse.json(
        { message: result.error ?? 'Transition failed.' },
        { status: 400 },
      );
    }

    console.log('[api/hackathons/[id]/transition] POST: transitioned:', {
      id: hackathonId,
      to: parsed.data.targetStatus,
    });
    return NextResponse.json({ message: 'Status updated.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    console.error('[api/hackathons/[id]/transition] POST error:', message);
    return NextResponse.json({ message }, { status: 500 });
  }
}
