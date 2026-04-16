import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '@/lib/auth/require-super-admin';
import { listUsers } from '@/lib/services/admin-service';

/**
 * GET /api/admin/users — List all users (super admin only)
 */
export async function GET() {
  console.log('[api/admin/users] GET');

  try {
    const result = await requireSuperAdmin();
    if ('error' in result) return result.error;

    const allUsers = await listUsers();

    return NextResponse.json({ users: allUsers });
  } catch (err) {
    console.error('[api/admin/users] GET error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
