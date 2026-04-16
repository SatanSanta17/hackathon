import { NextResponse } from 'next/server';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { createHackathonSchema } from '@/lib/validations/hackathon';
import { createHackathon } from '@/lib/services/hackathon-service';

/**
 * POST /api/hackathons — Create a new hackathon draft from a template
 */
export async function POST(request: Request) {
  console.log('[api/hackathons] POST: create hackathon');

  try {
    const body = await request.json();

    const { orgId, ...rest } = body;
    if (!orgId) {
      return NextResponse.json(
        { message: 'Organization ID is required.' },
        { status: 400 },
      );
    }

    const authResult = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
    if ('error' in authResult) return authResult.error;
    const { user } = authResult;

    const parsed = createHackathonSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await createHackathon({
      orgId,
      templateId: parsed.data.templateId,
      userId: user.id,
    });

    if (!result.success) {
      if (result.error === 'TEMPLATE_NOT_FOUND') {
        return NextResponse.json(
          { message: 'Template not found.' },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { message: result.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/hackathons] POST: hackathon created:', { id: result.hackathon?.id });
    return NextResponse.json(
      { message: 'Hackathon created.', hackathon: result.hackathon },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/hackathons] POST error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
