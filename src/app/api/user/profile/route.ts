import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { getStorageProvider } from '@/lib/storage';
import { STORAGE_CONSTANTS } from '@/lib/storage/constants';
import { updateProfileSchema } from '@/lib/validations/auth';

export async function PATCH(request: Request) {
  console.log('[api/user/profile] PATCH');

  const authResult = await requireVerifiedUser();
  if ('error' in authResult) return authResult.error;
  const { user } = authResult;

  try {
    const formData = await request.formData();
    const name = formData.get('name') as string | null;
    const removeAvatar = formData.get('removeAvatar') === 'true';
    const file = formData.get('file') as File | null;

    const parsed = updateProfileSchema.safeParse({
      name: name ?? undefined,
      removeAvatar: removeAvatar || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid input', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const storage = getStorageProvider();
    const updates: Partial<{ name: string; avatarUrl: string | null; updatedAt: Date }> = {
      updatedAt: new Date(),
    };

    if (parsed.data.name) {
      updates.name = parsed.data.name;
    }

    if (removeAvatar) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { avatarUrl: true },
      });
      if (currentUser?.avatarUrl) {
        await storage.delete(currentUser.avatarUrl).catch(() => {
          // Non-fatal — proceed even if storage delete fails
        });
      }
      updates.avatarUrl = null;
    } else if (file && file.size > 0) {
      if (!STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(file.type as typeof STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES[number])) {
        return NextResponse.json(
          { message: `Invalid file type. Allowed: ${STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES.join(', ')}` },
          { status: 400 },
        );
      }
      if (file.size > STORAGE_CONSTANTS.MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { message: `File too large. Maximum size: ${STORAGE_CONSTANTS.MAX_IMAGE_SIZE / (1024 * 1024)}MB` },
          { status: 413 },
        );
      }
      const ext = file.type.split('/').pop() ?? 'png';
      const path = STORAGE_CONSTANTS.paths.avatar(user.id, ext);
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await storage.upload(buffer, path, { contentType: file.type });
      updates.avatarUrl = result.key;
    }

    await db.update(users).set(updates).where(eq(users.id, user.id));

    console.log('[api/user/profile] PATCH success:', { userId: user.id });
    return NextResponse.json({ message: 'Profile updated.' });
  } catch (err) {
    console.error('[api/user/profile] PATCH error:', err);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
