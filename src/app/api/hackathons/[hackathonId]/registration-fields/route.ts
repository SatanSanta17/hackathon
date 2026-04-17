import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { hackathons } from '@/db/schema';
import { requireOrgRole } from '@/lib/auth/require-org-role';
import {
  getRegistrationFields,
  upsertRegistrationFields,
} from '@/lib/services/registration-service';
import { upsertRegistrationFieldsSchema } from '@/lib/validations/registration';

/**
 * GET /api/hackathons/[hackathonId]/registration-fields
 * Public — returns custom registration fields for this hackathon.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;

  const fields = await getRegistrationFields(hackathonId);
  return NextResponse.json({ fields });
}

/**
 * POST /api/hackathons/[hackathonId]/registration-fields
 * Org-admin only — upsert the full set of custom registration fields.
 * Body: { orgId: string; fields: RegistrationFieldInput[] }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;

  const body = await request.json();
  const { orgId, fields: rawFields } = body;

  if (!orgId) {
    return NextResponse.json({ message: 'Organization ID is required.' }, { status: 400 });
  }

  const authResult = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
  if ('error' in authResult) return authResult.error;

  // Verify hackathon belongs to this org
  const [hackathon] = await db
    .select({ id: hackathons.id })
    .from(hackathons)
    .where(
      and(
        eq(hackathons.id, hackathonId),
        eq(hackathons.orgId, orgId),
        isNull(hackathons.deletedAt),
      ),
    )
    .limit(1);

  if (!hackathon) {
    return NextResponse.json({ message: 'Hackathon not found.' }, { status: 404 });
  }

  const parsed = upsertRegistrationFieldsSchema.safeParse({ fields: rawFields });
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  await upsertRegistrationFields(
    hackathonId,
    parsed.data.fields.map((f) => ({ ...f, options: f.options ?? null })),
  );
  return NextResponse.json({ ok: true });
}
