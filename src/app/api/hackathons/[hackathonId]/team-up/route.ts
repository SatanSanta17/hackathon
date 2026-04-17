import { NextResponse } from 'next/server';

import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { createTeamUpRequest } from '@/lib/services/team-up-service';
import { createTeamUpRequestSchema } from '@/lib/validations/team-up';

/**
 * POST /api/hackathons/[hackathonId]/team-up
 * Create a team-up request targeting another discoverable participant.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  const body = await request.json();
  const parsed = createTeamUpRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const teamUpRequest = await createTeamUpRequest(
      hackathonId,
      user.id,
      parsed.data.toUserId,
      parsed.data.proposedTeamName,
      parsed.data.message ?? null,
    );
    return NextResponse.json({ request: teamUpRequest }, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'FROM_USER_NOT_REGISTERED') {
        return NextResponse.json(
          { message: 'You must register for this hackathon first.' },
          { status: 403 },
        );
      }
      if (err.message === 'TO_USER_NOT_REGISTERED') {
        return NextResponse.json(
          { message: 'That participant is not registered for this hackathon.' },
          { status: 400 },
        );
      }
      if (err.message === 'FROM_USER_ALREADY_IN_TEAM') {
        return NextResponse.json(
          { message: 'You are already on a team for this hackathon.' },
          { status: 403 },
        );
      }
      if (err.message === 'TO_USER_ALREADY_IN_TEAM') {
        return NextResponse.json(
          { message: 'That participant is already on a team.' },
          { status: 400 },
        );
      }
      if (err.message === 'TEAM_UP_REQUEST_ALREADY_PENDING') {
        return NextResponse.json(
          { message: 'You already have a pending team-up request with this participant.' },
          { status: 409 },
        );
      }
    }
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
