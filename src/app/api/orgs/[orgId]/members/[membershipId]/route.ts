import { NextResponse } from 'next/server';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { ERR } from '@/lib/constants/error-codes';
import { removeMember } from '@/lib/services/org-service';

/**
 * DELETE /api/orgs/[orgId]/members/[membershipId] — Remove a member from the organization
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> },
) {
  const { orgId, membershipId } = await params;
  console.log('[api/orgs/members] DELETE:', { orgId, membershipId });

  try {
    const result = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
    if ('error' in result) return result.error;

    const removeResult = await removeMember({ membershipId, orgId });

    if (!removeResult.success) {
      if (removeResult.error === ERR.MEMBERSHIP_NOT_FOUND) {
        return NextResponse.json(
          { message: 'Membership not found.' },
          { status: 404 },
        );
      }
      if (removeResult.error === ERR.LAST_ADMIN) {
        return NextResponse.json(
          { message: 'Cannot remove the last admin. Promote another member first.' },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { message: removeResult.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/orgs/members] DELETE: member removed');
    return NextResponse.json({ message: 'Member removed.' });
  } catch (err) {
    console.error('[api/orgs/members] DELETE error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
