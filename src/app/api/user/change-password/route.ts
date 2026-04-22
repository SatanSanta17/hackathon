import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { AUTH_CONSTANTS } from '@/lib/auth/constants';
import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { changePasswordSchema } from '@/lib/validations/auth';

export async function POST(request: Request) {
  console.log('[api/user/change-password] POST');

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try {
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid input', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { passwordHash: true },
    });

    if (!dbUser) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json(
        { message: 'Current password is incorrect.' },
        { status: 400 },
      );
    }

    const newHash = await bcrypt.hash(newPassword, AUTH_CONSTANTS.BCRYPT_COST);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    console.log('[api/user/change-password] POST success:', { userId: user.id });
    return NextResponse.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[api/user/change-password] POST error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
