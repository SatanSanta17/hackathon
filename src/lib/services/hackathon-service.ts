import { eq, and, isNull, desc, ne } from 'drizzle-orm';

import { db } from '@/db';
import {
  hackathons,
  phases,
  tracks,
  prizes,
  hackathonTemplates,
} from '@/db/schema';
import type {
  Hackathon,
  NewHackathon,
  Phase,
  Track,
  Prize,
  HackathonTemplate,
} from '@/db/schema';
import { slugify } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Template phase structure stored in defaultPhases JSONB */
export interface TemplatePhase {
  name: string;
  type: 'registration' | 'submission' | 'screening' | 'judging' | 'results';
  order: number;
  config?: Record<string, unknown>;
}

/** Full hackathon with related entities */
export interface HackathonWithRelations {
  hackathon: Hackathon;
  phases: Phase[];
  tracks: Track[];
  prizes: Prize[];
}

// Re-export schema types for consumers
export type { Hackathon, NewHackathon, Phase, Track, Prize, HackathonTemplate };

// ---------------------------------------------------------------------------
// Get Templates
// ---------------------------------------------------------------------------

export async function getTemplates(): Promise<HackathonTemplate[]> {
  console.log('[hackathon-service] getTemplates');

  const result = await db.query.hackathonTemplates.findMany({
    where: eq(hackathonTemplates.isActive, true),
    orderBy: hackathonTemplates.createdAt,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Create Hackathon (from template)
// ---------------------------------------------------------------------------

export async function createHackathon(params: {
  orgId: string;
  templateId: string;
  userId: string;
}): Promise<{ success: boolean; hackathon?: Hackathon; error?: string }> {
  console.log('[hackathon-service] createHackathon:', {
    orgId: params.orgId,
    templateId: params.templateId,
  });

  try {
    // 1. Fetch the template
    const template = await db.query.hackathonTemplates.findFirst({
      where: eq(hackathonTemplates.id, params.templateId),
    });

    if (!template) {
      return { success: false, error: 'TEMPLATE_NOT_FOUND' };
    }

    // 2. Generate a placeholder title and slug
    const placeholderTitle = 'Untitled Hackathon';
    const slug = await generateUniqueSlug(placeholderTitle);

    // 3. Create hackathon record in draft status
    const [hackathon] = await db
      .insert(hackathons)
      .values({
        orgId: params.orgId,
        title: placeholderTitle,
        slug: slug.slug,
        templateType: template.templateType,
        status: 'draft',
        createdBy: params.userId,
      })
      .returning();

    // 4. Clone template phases into the phases table
    const templatePhases = template.defaultPhases as TemplatePhase[];
    for (const tp of templatePhases) {
      await db.insert(phases).values({
        hackathonId: hackathon.id,
        name: tp.name,
        type: tp.type,
        order: tp.order,
        config: tp.config ?? {},
        status: 'upcoming',
      });
    }

    console.log('[hackathon-service] createHackathon success:', {
      id: hackathon.id,
      slug: hackathon.slug,
    });

    return { success: true, hackathon };
  } catch (err) {
    console.error('[hackathon-service] createHackathon failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create hackathon',
    };
  }
}

// ---------------------------------------------------------------------------
// Fetch Hackathon Relations (private helper — DRY)
// ---------------------------------------------------------------------------

async function fetchHackathonRelations(
  hackathonId: string
): Promise<{ phases: Phase[]; tracks: Track[]; prizes: Prize[] }> {
  const [hackathonPhases, hackathonTracks, hackathonPrizes] = await Promise.all([
    db.query.phases.findMany({
      where: eq(phases.hackathonId, hackathonId),
      orderBy: phases.order,
    }),
    db.query.tracks.findMany({
      where: eq(tracks.hackathonId, hackathonId),
      orderBy: tracks.order,
    }),
    db.query.prizes.findMany({
      where: eq(prizes.hackathonId, hackathonId),
      orderBy: prizes.rank,
    }),
  ]);

  return {
    phases: hackathonPhases,
    tracks: hackathonTracks,
    prizes: hackathonPrizes,
  };
}

// ---------------------------------------------------------------------------
// Get Hackathon by ID (admin operations)
// ---------------------------------------------------------------------------

export async function getHackathonById(params: {
  hackathonId: string;
  orgId: string;
}): Promise<HackathonWithRelations | null> {
  console.log('[hackathon-service] getHackathonById:', { hackathonId: params.hackathonId });

  const hackathon = await db.query.hackathons.findFirst({
    where: and(
      eq(hackathons.id, params.hackathonId),
      eq(hackathons.orgId, params.orgId),
      isNull(hackathons.deletedAt),
    ),
  });

  if (!hackathon) return null;

  const relations = await fetchHackathonRelations(hackathon.id);
  return { hackathon, ...relations };
}

// ---------------------------------------------------------------------------
// Get Hackathon by Slug (public page)
// ---------------------------------------------------------------------------

export async function getHackathonBySlug(
  slug: string
): Promise<HackathonWithRelations | null> {
  console.log('[hackathon-service] getHackathonBySlug:', { slug });

  const hackathon = await db.query.hackathons.findFirst({
    where: and(
      eq(hackathons.slug, slug),
      isNull(hackathons.deletedAt),
    ),
  });

  if (!hackathon) return null;

  const relations = await fetchHackathonRelations(hackathon.id);
  return { hackathon, ...relations };
}

// ---------------------------------------------------------------------------
// Get Hackathons by Org (dashboard list)
// ---------------------------------------------------------------------------

export async function getHackathonsByOrgId(params: {
  orgId: string;
  includeArchived?: boolean;
}): Promise<Hackathon[]> {
  console.log('[hackathon-service] getHackathonsByOrgId:', { orgId: params.orgId });

  const conditions = [
    eq(hackathons.orgId, params.orgId),
    isNull(hackathons.deletedAt),
  ];

  if (!params.includeArchived) {
    conditions.push(ne(hackathons.status, 'archived'));
  }

  const result = await db.query.hackathons.findMany({
    where: and(...conditions),
    orderBy: desc(hackathons.createdAt),
  });

  return result;
}

// ---------------------------------------------------------------------------
// Update Hackathon
// ---------------------------------------------------------------------------

export async function updateHackathon(params: {
  hackathonId: string;
  orgId: string;
  data: Partial<Pick<
    NewHackathon,
    | 'title'
    | 'description'
    | 'slug'
    | 'coverImageKey'
    | 'visibility'
    | 'teamMinSize'
    | 'teamMaxSize'
    | 'allowIndividual'
    | 'rulesHtml'
    | 'faqsHtml'
  >>;
}): Promise<{ success: boolean; hackathon?: Hackathon; error?: string; slugModified?: boolean; newSlug?: string }> {
  console.log('[hackathon-service] updateHackathon:', {
    hackathonId: params.hackathonId,
    fields: Object.keys(params.data),
  });

  try {
    // Verify hackathon belongs to org
    const existing = await db.query.hackathons.findFirst({
      where: and(
        eq(hackathons.id, params.hackathonId),
        eq(hackathons.orgId, params.orgId),
        isNull(hackathons.deletedAt),
      ),
    });

    if (!existing) {
      return { success: false, error: 'HACKATHON_NOT_FOUND' };
    }

    // If slug is being changed, handle collision
    let slugModified = false;
    let newSlug: string | undefined;
    let resolvedSlug: string | undefined = params.data.slug;

    if (params.data.slug && params.data.slug !== existing.slug) {
      const slugResult = await generateUniqueSlug(params.data.slug, params.hackathonId);
      resolvedSlug = slugResult.slug;
      slugModified = slugResult.modified;
      newSlug = slugResult.modified ? slugResult.slug : undefined;
    }

    // If title is changing and no explicit slug change, regenerate slug from title
    if (params.data.title && !params.data.slug && params.data.title !== existing.title) {
      const slugResult = await generateUniqueSlug(params.data.title, params.hackathonId);
      resolvedSlug = slugResult.slug;
      slugModified = slugResult.modified;
      newSlug = slugResult.modified ? slugResult.slug : undefined;
    }

    const [updated] = await db
      .update(hackathons)
      .set({
        ...params.data,
        ...(resolvedSlug ? { slug: resolvedSlug } : {}),
        updatedAt: new Date(),
      })
      .where(eq(hackathons.id, params.hackathonId))
      .returning();

    console.log('[hackathon-service] updateHackathon success:', { id: updated.id });

    return { success: true, hackathon: updated, slugModified, newSlug };
  } catch (err) {
    console.error('[hackathon-service] updateHackathon failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update hackathon',
    };
  }
}

// ---------------------------------------------------------------------------
// Publish Hackathon
// ---------------------------------------------------------------------------

export async function publishHackathon(params: {
  hackathonId: string;
  orgId: string;
}): Promise<{ success: boolean; error?: string }> {
  console.log('[hackathon-service] publishHackathon:', params);

  const hackathon = await db.query.hackathons.findFirst({
    where: and(
      eq(hackathons.id, params.hackathonId),
      eq(hackathons.orgId, params.orgId),
      isNull(hackathons.deletedAt),
    ),
  });

  if (!hackathon) {
    return { success: false, error: 'HACKATHON_NOT_FOUND' };
  }

  if (hackathon.status !== 'draft') {
    return { success: false, error: 'ONLY_DRAFTS_CAN_BE_PUBLISHED' };
  }

  // Validate publish requirements: title, at least one track, all phase dates set
  if (!hackathon.title || hackathon.title === 'Untitled Hackathon') {
    return { success: false, error: 'TITLE_REQUIRED' };
  }

  const hackathonTracks = await db.query.tracks.findMany({
    where: eq(tracks.hackathonId, params.hackathonId),
  });

  if (hackathonTracks.length === 0) {
    return { success: false, error: 'AT_LEAST_ONE_TRACK_REQUIRED' };
  }

  const hackathonPhases = await db.query.phases.findMany({
    where: eq(phases.hackathonId, params.hackathonId),
  });

  const phasesWithoutDates = hackathonPhases.filter(
    (p) => !p.startDate || !p.endDate
  );

  if (phasesWithoutDates.length > 0) {
    return { success: false, error: 'ALL_PHASE_DATES_REQUIRED' };
  }

  await db
    .update(hackathons)
    .set({ status: 'published', updatedAt: new Date() })
    .where(eq(hackathons.id, params.hackathonId));

  console.log('[hackathon-service] publishHackathon success:', { id: params.hackathonId });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Transition Hackathon Status
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['published'],
  published: ['active'],
  active: ['judging'],
  judging: ['completed'],
  completed: ['archived'],
};

export async function transitionHackathonStatus(params: {
  hackathonId: string;
  orgId: string;
  targetStatus: string;
}): Promise<{ success: boolean; error?: string }> {
  console.log('[hackathon-service] transitionStatus:', params);

  const hackathon = await db.query.hackathons.findFirst({
    where: and(
      eq(hackathons.id, params.hackathonId),
      eq(hackathons.orgId, params.orgId),
      isNull(hackathons.deletedAt),
    ),
  });

  if (!hackathon) {
    return { success: false, error: 'HACKATHON_NOT_FOUND' };
  }

  const allowed = VALID_TRANSITIONS[hackathon.status] || [];
  if (!allowed.includes(params.targetStatus)) {
    return {
      success: false,
      error: `Cannot transition from '${hackathon.status}' to '${params.targetStatus}'`,
    };
  }

  // draft → published must go through publishHackathon() for validation
  if (hackathon.status === 'draft' && params.targetStatus === 'published') {
    return publishHackathon({ hackathonId: params.hackathonId, orgId: params.orgId });
  }

  await db
    .update(hackathons)
    .set({ status: params.targetStatus as Hackathon['status'], updatedAt: new Date() })
    .where(eq(hackathons.id, params.hackathonId));

  console.log('[hackathon-service] transitionStatus success:', {
    id: params.hackathonId,
    from: hackathon.status,
    to: params.targetStatus,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Soft Delete Hackathon (draft only)
// ---------------------------------------------------------------------------

export async function softDeleteHackathon(params: {
  hackathonId: string;
  orgId: string;
}): Promise<{ success: boolean; error?: string }> {
  console.log('[hackathon-service] softDeleteHackathon:', params);

  const hackathon = await db.query.hackathons.findFirst({
    where: and(
      eq(hackathons.id, params.hackathonId),
      eq(hackathons.orgId, params.orgId),
      isNull(hackathons.deletedAt),
    ),
  });

  if (!hackathon) {
    return { success: false, error: 'HACKATHON_NOT_FOUND' };
  }

  if (hackathon.status !== 'draft') {
    return { success: false, error: 'ONLY_DRAFTS_CAN_BE_DELETED' };
  }

  await db
    .update(hackathons)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(hackathons.id, params.hackathonId));

  console.log('[hackathon-service] softDeleteHackathon success:', { id: params.hackathonId });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Slug Generation (P1.R13)
// ---------------------------------------------------------------------------

/**
 * Generate a globally unique slug from a title.
 * If the slug is taken, appends a numeric suffix (-2, -3, etc.).
 *
 * @param input - Title or slug string to slugify
 * @param excludeHackathonId - Optional hackathon ID to exclude from collision check
 *                             (for updates — don't collide with yourself)
 * @returns { slug, modified } — modified is true if suffix was appended
 */
async function generateUniqueSlug(
  input: string,
  excludeHackathonId?: string
): Promise<{ slug: string; modified: boolean }> {
  const baseSlug = slugify(input);

  // Check if base slug is available
  const isAvailable = await isSlugAvailable(baseSlug, excludeHackathonId);
  if (isAvailable) {
    return { slug: baseSlug, modified: false };
  }

  // Find next available suffix
  let suffix = 2;
  while (suffix <= 100) {
    const candidateSlug = `${baseSlug}-${suffix}`;
    const available = await isSlugAvailable(candidateSlug, excludeHackathonId);
    if (available) {
      return { slug: candidateSlug, modified: true };
    }
    suffix++;
  }

  // Fallback: append random string (extremely unlikely to reach here)
  const fallbackSlug = `${baseSlug}-${Date.now().toString(36)}`;
  return { slug: fallbackSlug, modified: true };
}

async function isSlugAvailable(
  slug: string,
  excludeHackathonId?: string
): Promise<boolean> {
  const conditions = [eq(hackathons.slug, slug), isNull(hackathons.deletedAt)];

  if (excludeHackathonId) {
    conditions.push(ne(hackathons.id, excludeHackathonId));
  }

  const existing = await db.query.hackathons.findFirst({
    where: and(...conditions),
    columns: { id: true },
  });

  return !existing;
}
