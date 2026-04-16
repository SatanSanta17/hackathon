import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/auth/require-super-admin';
import { listOrganizations } from '@/lib/services/admin-service';

/**
 * GET /api/admin/orgs — List all organizations (super admin only)
 */
export async function GET() {
  console.log('[api/admin/orgs] GET');

  try {
    const result = await requireSuperAdmin();
    if ('error' in result) return result.error;

    const orgs = await listOrganizations();

    return NextResponse.json({ organizations: orgs });
  } catch (err) {
    console.error('[api/admin/orgs] GET error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
