import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons, phases } from '@/db/schema';
import { users } from '@/db/schema/users';
import { getEmailService } from '@/lib/email';
import { registrationConfirmedEmail } from '@/lib/email/templates';
import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { createRegistration } from '@/lib/services/registration-service';
import { createRegistrationSchema } from '@/lib/validations/registration';

/**
 * POST /api/hackathons/[hackathonId]/register
 * Register the authenticated user for a hackathon.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  // Fetch hackathon without org scoping (participant route)
  const [hackathon] = await db
    .select({
      id: hackathons.id,
      status: hackathons.status,
      title: hackathons.title,
      slug: hackathons.slug,
    })
    .from(hackathons)
    .where(and(eq(hackathons.id, hackathonId), isNull(hackathons.deletedAt)))
    .limit(1);

  if (!hackathon) {
    return NextResponse.json({ message: 'Hackathon not found.' }, { status: 404 });
  }

  if (hackathon.status !== 'published' && hackathon.status !== 'active') {
    return NextResponse.json({ message: 'Registration is not open.' }, { status: 403 });
  }

  // Check if registration phase has closed
  const [regPhase] = await db
    .select({ status: phases.status })
    .from(phases)
    .where(and(eq(phases.hackathonId, hackathonId), eq(phases.type, 'registration')))
    .limit(1);

  if (regPhase?.status === 'completed') {
    return NextResponse.json({ message: 'Registration has closed.' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const registration = await createRegistration(
      hackathonId,
      user.id,
      parsed.data.formData ?? null,
      parsed.data.isDiscoverable,
    );

    // Confirmation email — fire-and-forget; must not fail the registration
    try {
      const [userData] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      if (userData) {
        await getEmailService().send({
          to: userData.email,
          ...registrationConfirmedEmail({
            name: userData.name,
            hackathonTitle: hackathon.title,
            hackathonSlug: hackathon.slug,
            appUrl: process.env.NEXT_PUBLIC_APP_URL!,
          }),
        });
      }
    } catch {
      // Swallow email errors
    }

    return NextResponse.json({ registration }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_REGISTERED') {
      return NextResponse.json({ message: 'Already registered for this hackathon.' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
