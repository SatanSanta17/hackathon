import { NextResponse } from 'next/server';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { getOrgMembers } from '@/lib/services/org-service';

/**
 * GET /api/orgs/[orgId]/members — List organization members
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  console.log('[api/orgs/members] GET: list members:', { orgId });

  try {
    const result = await requireOrgRole({ orgId, allowedRoles: ['org_admin', 'member'] });
    if ('error' in result) return result.error;

    const members = await getOrgMembers(orgId);

    return NextResponse.json({ members });
  } catch (err) {
    console.error('[api/orgs/members] GET error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
