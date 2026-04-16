import { NextResponse } from 'next/server';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { updateHackathonSchema } from '@/lib/validations/hackathon';
import { updateHackathon, getHackathonById } from '@/lib/services/hackathon-service';

/**
 * PATCH /api/hackathons/[hackathonId] — Update hackathon fields
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;
  console.log('[api/hackathons/[id]] PATCH:', { hackathonId });

  try {
    const body = await request.json();

    const { orgId, expectedUpdatedAt, ...data } = body;
    if (!orgId) {
      return NextResponse.json(
        { message: 'Organization ID is required.' },
        { status: 400 },
      );
    }

    const authResult = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
    if ('error' in authResult) return authResult.error;

    const parsed = updateHackathonSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Stale-data detection (P2.R16)
    let staleWarning = false;
    if (expectedUpdatedAt) {
      const current = await getHackathonById({ hackathonId, orgId });
      if (current && current.hackathon.updatedAt.toISOString() !== expectedUpdatedAt) {
        staleWarning = true;
      }
    }

    const result = await updateHackathon({
      hackathonId,
      orgId,
      data: parsed.data,
    });

    if (!result.success) {
      if (result.error === 'HACKATHON_NOT_FOUND') {
        return NextResponse.json(
          { message: 'Hackathon not found.' },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { message: result.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/hackathons/[id]] PATCH: updated:', { id: hackathonId, staleWarning });
    return NextResponse.json({
      message: 'Hackathon updated.',
      hackathon: result.hackathon,
      slugModified: result.slugModified,
      newSlug: result.newSlug,
      staleWarning,
      lastUpdatedAt: result.hackathon?.updatedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    console.error('[api/hackathons/[id]] PATCH error:', message);
    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
