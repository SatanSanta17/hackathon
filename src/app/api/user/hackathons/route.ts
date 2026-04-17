import { NextResponse } from 'next/server';

import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { getRegistrationsByUser } from '@/lib/services/registration-service';

/**
 * GET /api/user/hackathons
 * Returns all hackathons the authenticated user is registered for.
 */
export async function GET() {
  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  const hackathons = await getRegistrationsByUser(user.id);
  return NextResponse.json({ hackathons });
}
