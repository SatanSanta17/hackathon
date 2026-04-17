import { NextResponse } from 'next/server';

import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { getTeamUpRequestsForUser } from '@/lib/services/team-up-service';

/**
 * GET /api/hackathons/[hackathonId]/team-up-requests
 * Get incoming pending team-up requests for the current user.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  const requests = await getTeamUpRequestsForUser(user.id, hackathonId);
  return NextResponse.json({ requests });
}
