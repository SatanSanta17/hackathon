import { NextResponse } from 'next/server';

import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { createOrgSchema } from '@/lib/validations/org';
import { createOrg, getUserOrgs } from '@/lib/services/org-service';

/**
 * POST /api/orgs — Create a new organization
 */
export async function POST(request: Request) {
  console.log('[api/orgs] POST: create org');

  try {
    const result = await requireVerifiedUser();
    if ('error' in result) return result.error;
    const { user } = result;

    const body = await request.json();
    const parsed = createOrgSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const orgResult = await createOrg({
      name: parsed.data.name,
      slug: parsed.data.slug,
      userId: user.id,
    });

    if (!orgResult.success) {
      if (orgResult.error === 'SLUG_TAKEN') {
        return NextResponse.json(
          { message: 'This slug is already taken. Please choose another.' },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { message: orgResult.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/orgs] POST: org created:', { orgId: orgResult.org?.id });
    return NextResponse.json(
      { message: 'Organization created.', org: orgResult.org },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/orgs] POST error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/orgs — List current user's organizations
 */
export async function GET() {
  console.log('[api/orgs] GET: list user orgs');

  try {
    const result = await requireVerifiedUser();
    if ('error' in result) return result.error;
    const { user } = result;

    const orgs = await getUserOrgs(user.id);

    return NextResponse.json({ orgs });
  } catch (err) {
    console.error('[api/orgs] GET error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
