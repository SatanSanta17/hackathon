import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { acceptInvite } from '@/lib/services/org-service';

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

/**
 * POST /api/invite/accept — Accept an org invite
 */
export async function POST(request: Request) {
  console.log('[api/invite/accept] POST');

  try {
    const result = await requireVerifiedUser();
    if ('error' in result) return result.error;
    const { user } = result;

    const body = await request.json();
    const parsed = acceptInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const acceptResult = await acceptInvite({
      rawToken: parsed.data.token,
      userId: user.id,
    });

    if (!acceptResult.success) {
      if (acceptResult.error === 'INVALID_TOKEN') {
        return NextResponse.json(
          { message: 'This invitation link is invalid or has expired.' },
          { status: 400 },
        );
      }
      if (acceptResult.error === 'ORG_NOT_FOUND') {
        return NextResponse.json(
          { message: 'The organization no longer exists.' },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { message: acceptResult.error ?? 'Something went wrong.' },
        { status: 500 },
      );
    }

    console.log('[api/invite/accept] POST: invite accepted:', { orgSlug: acceptResult.orgSlug });
    return NextResponse.json({
      message: 'Joined organization.',
      orgSlug: acceptResult.orgSlug,
    });
  } catch (err) {
    console.error('[api/invite/accept] POST error:', err);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 },
    );
  }
}
