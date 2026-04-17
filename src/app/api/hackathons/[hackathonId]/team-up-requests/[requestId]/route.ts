import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { teamUpRequests } from '@/db/schema';
import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { respondToTeamUpRequest } from '@/lib/services/team-up-service';
import { respondToTeamUpRequestSchema } from '@/lib/validations/team-up';

/**
 * PATCH /api/hackathons/[hackathonId]/team-up-requests/[requestId]
 * Accept or decline a team-up request. Recipient only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string; requestId: string }> },
) {
  const { requestId } = await params;

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  const [teamUpRequest] = await db
    .select({ toUserId: teamUpRequests.toUserId, status: teamUpRequests.status })
    .from(teamUpRequests)
    .where(eq(teamUpRequests.id, requestId))
    .limit(1);

  if (!teamUpRequest) {
    return NextResponse.json({ message: 'Team-up request not found.' }, { status: 404 });
  }

  if (teamUpRequest.toUserId !== user.id) {
    return NextResponse.json({ message: 'You are not the recipient of this request.' }, { status: 403 });
  }

  if (teamUpRequest.status !== 'pending') {
    return NextResponse.json({ message: 'This request has already been resolved.' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = respondToTeamUpRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await respondToTeamUpRequest(requestId, parsed.data.status);
    return NextResponse.json({ ...result, status: parsed.data.status });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'REQUEST_NOT_FOUND' || err.message === 'REQUEST_ALREADY_RESOLVED') {
        return NextResponse.json({ message: 'Request not found or already resolved.' }, { status: 404 });
      }
      if (err.message === 'FROM_USER_ALREADY_IN_TEAM' || err.message === 'TO_USER_ALREADY_IN_TEAM') {
        return NextResponse.json(
          { message: 'One or both users are now on a team.' },
          { status: 400 },
        );
      }
    }
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
