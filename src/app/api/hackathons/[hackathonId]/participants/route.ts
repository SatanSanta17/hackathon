import { NextResponse } from 'next/server';

import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { getDiscoverableParticipants } from '@/lib/services/registration-service';

/**
 * GET /api/hackathons/[hackathonId]/participants
 * List discoverable, unteamed participants.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';

  let participants = await getDiscoverableParticipants(hackathonId);

  // Exclude the requesting user
  participants = participants.filter((p) => p.userId !== user.id);

  // Case-insensitive name search
  if (search) {
    const q = search.toLowerCase();
    participants = participants.filter((p) =>
      p.user.name.toLowerCase().includes(q),
    );
  }

  return NextResponse.json({ participants });
}
