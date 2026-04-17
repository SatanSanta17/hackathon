import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons } from '@/db/schema';
import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { ERR } from '@/lib/constants/error-codes';
import {
  getRegistrationByUserAndHackathon,
  updateRegistration,
} from '@/lib/services/registration-service';
import { updateRegistrationSchema } from '@/lib/validations/registration';

/**
 * GET /api/hackathons/[hackathonId]/registration
 * Returns the authenticated user's registration for this hackathon.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  const registration = await getRegistrationByUserAndHackathon(user.id, hackathonId);
  if (!registration) {
    return NextResponse.json({ message: 'Not registered for this hackathon.' }, { status: 404 });
  }

  return NextResponse.json({ registration });
}

/**
 * PATCH /api/hackathons/[hackathonId]/registration
 * Update the authenticated user's registration (formData, isDiscoverable).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  // Verify the hackathon exists and is not deleted
  const [hackathon] = await db
    .select({ id: hackathons.id })
    .from(hackathons)
    .where(and(eq(hackathons.id, hackathonId), isNull(hackathons.deletedAt)))
    .limit(1);

  if (!hackathon) {
    return NextResponse.json({ message: 'Hackathon not found.' }, { status: 404 });
  }

  const registration = await getRegistrationByUserAndHackathon(user.id, hackathonId);
  if (!registration) {
    return NextResponse.json({ message: 'Not registered for this hackathon.' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const updated = await updateRegistration(registration.id, parsed.data);
    return NextResponse.json({ registration: updated });
  } catch (err) {
    if (err instanceof Error && err.message === ERR.REGISTRATION_NOT_FOUND) {
      return NextResponse.json({ message: 'Registration not found.' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
