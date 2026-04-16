import { NextResponse } from 'next/server';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { publishHackathon, getHackathonById } from '@/lib/services/hackathon-service';

/**
 * POST /api/hackathons/[hackathonId]/publish — Publish a draft hackathon
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;
  console.log('[api/hackathons/[id]/publish] POST:', { hackathonId });

  try {
    const body = await request.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json(
        { message: 'Organization ID is required.' },
        { status: 400 },
      );
    }

    const authResult = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
    if ('error' in authResult) return authResult.error;

    const result = await publishHackathon({ hackathonId, orgId });

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        HACKATHON_NOT_FOUND: 'Hackathon not found.',
        ONLY_DRAFTS_CAN_BE_PUBLISHED: 'Only draft hackathons can be published.',
        TITLE_REQUIRED: 'A hackathon title is required before publishing.',
        AT_LEAST_ONE_TRACK_REQUIRED: 'At least one track is required before publishing.',
        ALL_PHASE_DATES_REQUIRED: 'All phase dates must be set before publishing.',
      };

      const message = errorMessages[result.error ?? ''] ?? result.error ?? 'Something went wrong.';
      const status = result.error === 'HACKATHON_NOT_FOUND' ? 404 : 400;

      return NextResponse.json({ message, errorCode: result.error }, { status });
    }

    // Fetch the published hackathon to return its slug for redirect
    const hackathon = await getHackathonById({ hackathonId, orgId });

    console.log('[api/hackathons/[id]/publish] POST: published:', { id: hackathonId });
    return NextResponse.json({
      message: 'Hackathon published.',
      slug: hackathon?.hackathon.slug,
    });
  } catch (err) {
    console.error('[api/hackathons/[id]/publish] POST error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
