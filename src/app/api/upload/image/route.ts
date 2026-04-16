import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';

import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { requireOrgRole } from '@/lib/auth/require-org-role';
import { getStorageProvider } from '@/lib/storage';
import { STORAGE_CONSTANTS } from '@/lib/storage/constants';
import { db } from '@/db';
import { hackathons } from '@/db/schema';

/**
 * POST /api/upload/image — Upload a cover image or prize image
 *
 * Uses multipart/form-data with fields:
 * - file: the image file
 * - hackathonId: UUID of the hackathon
 * - orgId: UUID of the organization
 * - imageType: 'cover' | 'prize'
 * - prizeId?: UUID of the prize (required if imageType is 'prize')
 */
export async function POST(request: Request) {
  console.log('[api/upload/image] POST');

  try {
    // Auth check — must be a verified user
    const verifiedResult = await requireVerifiedUser();
    if ('error' in verifiedResult) return verifiedResult.error;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const hackathonId = formData.get('hackathonId') as string | null;
    const orgId = formData.get('orgId') as string | null;
    const imageType = formData.get('imageType') as string | null;
    const prizeId = formData.get('prizeId') as string | null;

    // Validate required fields
    if (!file || !hackathonId || !orgId || !imageType) {
      return NextResponse.json(
        { message: 'Missing required fields: file, hackathonId, orgId, imageType.' },
        { status: 400 },
      );
    }

    if (imageType !== 'cover' && imageType !== 'prize') {
      return NextResponse.json(
        { message: 'imageType must be "cover" or "prize".' },
        { status: 400 },
      );
    }

    if (imageType === 'prize' && !prizeId) {
      return NextResponse.json(
        { message: 'prizeId is required for prize image uploads.' },
        { status: 400 },
      );
    }

    // Verify user has org_admin access to the hackathon's org
    const authResult = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
    if ('error' in authResult) return authResult.error;

    // Verify hackathon belongs to org
    const hackathon = await db.query.hackathons.findFirst({
      where: and(
        eq(hackathons.id, hackathonId),
        eq(hackathons.orgId, orgId),
        isNull(hackathons.deletedAt),
      ),
      columns: { id: true },
    });

    if (!hackathon) {
      return NextResponse.json(
        { message: 'Hackathon not found.' },
        { status: 404 },
      );
    }

    // Validate file type
    if (!STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(file.type as typeof STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES[number])) {
      return NextResponse.json(
        { message: `Invalid file type. Allowed: ${STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > STORAGE_CONSTANTS.MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { message: `File too large. Maximum size: ${STORAGE_CONSTANTS.MAX_IMAGE_SIZE / (1024 * 1024)}MB` },
        { status: 413 },
      );
    }

    // Determine storage path
    const ext = file.type.split('/').pop() ?? 'png';
    const storagePath =
      imageType === 'cover'
        ? STORAGE_CONSTANTS.paths.coverImage(hackathonId, ext)
        : STORAGE_CONSTANTS.paths.prizeImage(hackathonId, prizeId!, ext);

    // Upload via StorageProvider
    const storage = getStorageProvider();
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await storage.upload(buffer, storagePath, {
      contentType: file.type,
    });

    console.log('[api/upload/image] POST: uploaded:', { key: result.key });
    return NextResponse.json({
      message: 'Image uploaded.',
      key: result.key,
      url: result.url,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    console.error('[api/upload/image] POST error:', message);
    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
