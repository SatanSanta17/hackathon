# TRD — Phase 2: Hackathon Creation + Landing Page

**Document ID:** TRD-007  
**Date:** April 16, 2026  
**Author:** Burhanuddin C.  
**Status:** Draft — Parts 1–3 Written  
**PRD Reference:** `docs/007-hackathon-creation/prd.md`  
**Architecture Reference:** `docs/004-architecture.md`  
**Conventions Reference:** `docs/003-coding-conventions.md`

---

## Part 1: Database Schema + StorageProvider + Template System

**PRD Requirements Covered:** P1.R1 through P1.R14

---

### 1.1 Dependencies (New for Part 1)

```bash
npm install @supabase/supabase-js
```

- **@supabase/supabase-js** — Used exclusively for Supabase Storage operations (signed URL generation, file upload/delete). NOT used for database access (Drizzle handles that). This is the only Supabase SDK dependency in the project.

No other new dependencies for Part 1. Drizzle, Zod, and postgres are already installed from Phase 1.

---

### 1.2 Database Enums (P1.R1)

Add the following enums to the existing `src/db/schema/enums.ts`:

```typescript
// Existing Phase 1 enums
export const platformRoleEnum = pgEnum('platform_role', ['user', 'super_admin']);
export const orgRoleEnum = pgEnum('org_role', ['org_admin', 'member']);

// Phase 2 enums
export const hackathonStatusEnum = pgEnum('hackathon_status', [
  'draft',
  'published',
  'active',
  'judging',
  'completed',
  'archived',
]);

export const templateTypeEnum = pgEnum('template_type', [
  'idea_sprint',
  'build_and_ship',
  'innovation_pipeline',
  'open_challenge',
]);

export const visibilityEnum = pgEnum('visibility', [
  'public',
  'org_only',
  'invite_only',
]);

export const phaseTypeEnum = pgEnum('phase_type', [
  'registration',
  'submission',
  'screening',
  'judging',
  'results',
]);

export const phaseStatusEnum = pgEnum('phase_status', [
  'upcoming',
  'active',
  'completed',
]);
```

**Forward compatibility note:** Future phases will add enums here: `registration_status`, `team_role`, `submission_status`, `eval_status`, `notification_type`. The enums file remains the single source of truth.

---

### 1.3 Database Schema — Hackathons (P1.R2)

**New file: `src/db/schema/hackathons.ts`**

```typescript
import { pgTable, uuid, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { hackathonStatusEnum, templateTypeEnum, visibilityEnum } from './enums';
import { organizations } from './organizations';
import { users } from './users';

export const hackathons = pgTable('hackathons', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  coverImageKey: text('cover_image_key'),
  status: hackathonStatusEnum('status').notNull().default('draft'),
  templateType: templateTypeEnum('template_type').notNull(),
  visibility: visibilityEnum('visibility').notNull().default('public'),
  teamMinSize: integer('team_min_size').notNull().default(1),
  teamMaxSize: integer('team_max_size').notNull().default(5),
  allowIndividual: boolean('allow_individual').notNull().default(true),
  rulesHtml: text('rules_html'),
  faqsHtml: text('faqs_html'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('hackathons_org_id_idx').on(table.orgId),
  index('hackathons_slug_idx').on(table.slug),
  index('hackathons_status_idx').on(table.status),
  index('hackathons_created_by_idx').on(table.createdBy),
]);
```

**Design decisions:**
- `slug` is globally unique (UNIQUE constraint, not scoped to org). This supports the `/hackathons/[slug]` public URL pattern.
- `coverImageKey` stores the StorageProvider key, NOT the full URL. URLs are generated on-demand via `getSignedUrl()`.
- `rulesHtml` and `faqs_html` store Tiptap's HTML output directly. No separate rich-text table — these are 1:1 with the hackathon and rarely queried independently.
- `deletedAt` supports soft delete. All queries filter `WHERE deleted_at IS NULL`.
- Indexes on `org_id` (multi-tenant scoping), `slug` (public page lookup), `status` (list filtering), `created_by` (dashboard queries).

**Forward compatibility:** Phase 3 will add `registrations` and `teams` tables that FK to `hackathons.id`. Phase 4 will add `submissions`. Phase 5 will add `evaluation_criteria`, `judge_assignments`, and `evaluations`. The hackathon record serves as the central entity they all reference.

---

### 1.4 Database Schema — Phases (P1.R3)

**New file: `src/db/schema/phases.ts`**

```typescript
import { pgTable, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { phaseTypeEnum, phaseStatusEnum } from './enums';
import { hackathons } from './hackathons';

export const phases = pgTable('phases', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathonId: uuid('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: phaseTypeEnum('type').notNull(),
  order: integer('order').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  config: jsonb('config'),
  status: phaseStatusEnum('status').notNull().default('upcoming'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('phases_hackathon_id_idx').on(table.hackathonId),
]);
```

**Design decisions:**
- `onDelete: 'cascade'` — if a hackathon draft is hard-deleted, its phases go with it. For published hackathons, we use soft delete on the hackathon level (phases don't need their own `deleted_at` since they're always accessed through a hackathon).
- `startDate` and `endDate` are nullable — phases are created from templates without dates; dates are set in Step 4 of the wizard.
- `config` (JSONB) holds phase-specific settings. For V1, this is largely unused but exists for forward compatibility. Example: a submission phase might store `{ allowedFileTypes: [...], maxFileSize: 50 }` in Phase 4.
- `order` determines display sequence. Template phases are created with sequential order values.

**Forward compatibility:** Phase 4 (submissions) will query phases by `hackathon_id` + `type = 'submission'` to determine which phase a submission belongs to. Phase 5 (judging) will query `type = 'judging'`. The `type` enum enables these lookups without hardcoding phase names.

---

### 1.5 Database Schema — Tracks (P1.R4)

**New file: `src/db/schema/tracks.ts`**

```typescript
import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { hackathons } from './hackathons';

export const tracks = pgTable('tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathonId: uuid('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  resourcesUrl: text('resources_url'),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('tracks_hackathon_id_idx').on(table.hackathonId),
]);
```

**Forward compatibility:** Phase 3 (teams) will add a `track_id` FK on the `teams` table. Phase 5 (judging) will use `track_id` on `judge_assignments` to scope judges to specific tracks.

---

### 1.6 Database Schema — Prizes (P1.R5)

**New file: `src/db/schema/prizes.ts`**

```typescript
import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { hackathons } from './hackathons';

export const prizes = pgTable('prizes', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathonId: uuid('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  rank: integer('rank').notNull(),
  imageKey: text('image_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('prizes_hackathon_id_idx').on(table.hackathonId),
]);
```

**Design decisions:**
- `imageKey` stores the StorageProvider key (not URL), same pattern as `hackathons.coverImageKey`.
- `rank` is an integer (1, 2, 3, etc.) used for ordering and display. Not a unique constraint — multiple prizes can share a rank (e.g., multiple "Special Mention" prizes at rank 4).

---

### 1.7 Database Schema — Hackathon Templates (P1.R6)

**New file: `src/db/schema/hackathon-templates.ts`**

```typescript
import { pgTable, uuid, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { templateTypeEnum } from './enums';

export const hackathonTemplates = pgTable('hackathon_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  templateType: templateTypeEnum('template_type').notNull().unique(),
  defaultPhases: jsonb('default_phases').notNull(),
  icon: text('icon'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Design decisions:**
- `templateType` is UNIQUE — one template per type in V1. V2's custom template feature will relax this by adding a `is_custom` flag and allowing multiple templates without the unique constraint (via migration).
- `defaultPhases` is a JSONB array with the structure:
  ```typescript
  interface TemplatePhase {
    name: string;
    type: PhaseType; // 'registration' | 'submission' | 'screening' | 'judging' | 'results'
    order: number;
    config?: Record<string, unknown>;
  }
  ```
- `icon` stores a Lucide icon name string (e.g., `'lightbulb'`, `'rocket'`, `'layers'`, `'globe'`). The UI renders the corresponding Lucide React component.
- `isActive` allows disabling a template without deleting it.
- No `updated_at` or `deleted_at` — templates are system-managed, not user-editable in V1.

---

### 1.8 Barrel Export Update

**Modified file: `src/db/schema/index.ts`**

```typescript
export * from './enums';
export * from './users';
export * from './organizations';
export * from './org-memberships';
export * from './org-invites';
export * from './verification-tokens';
export * from './hackathons';
export * from './phases';
export * from './tracks';
export * from './prizes';
export * from './hackathon-templates';
```

---

### 1.9 Migration (P1.R7)

**Steps:**

1. Run `npm run db:generate` — Drizzle Kit generates a new migration containing all 5 new tables, 5 new enums, foreign keys, and indexes.
2. Review the generated SQL — verify:
   - 5 new enums: `hackathon_status`, `template_type`, `visibility`, `phase_type`, `phase_status`
   - 5 new tables: `hackathons`, `phases`, `tracks`, `prizes`, `hackathon_templates`
   - All FK constraints reference correct parent tables
   - Cascade delete on `phases`, `tracks`, `prizes` FK to `hackathons`
   - Unique constraints on `hackathons.slug` and `hackathon_templates.slug` and `hackathon_templates.template_type`
   - Indexes on: `hackathons(org_id, slug, status, created_by)`, `phases(hackathon_id)`, `tracks(hackathon_id)`, `prizes(hackathon_id)`
3. Run `npm run db:migrate` — applies the migration.
4. Verify via `npm run db:studio` — all tables and enums visible.

---

### 1.10 StorageProvider Interface (P1.R8)

**New file: `src/lib/storage/types.ts`**

```typescript
/**
 * StorageProvider — abstraction over file storage backends.
 *
 * V1: Supabase Storage
 * Future: S3, Cloudflare R2, local disk, etc.
 *
 * All file references in the database store the `key` (not the URL).
 * URLs are generated on-demand via getSignedUrl().
 */

export interface StorageObject {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
}

export interface UploadResult {
  key: string;
  url: string;
}

export interface UploadOptions {
  /** MIME type of the file */
  contentType: string;
  /** Maximum file size in bytes. Validated before upload. */
  maxSize?: number;
  /** Allowed MIME types. Validated before upload. */
  allowedTypes?: string[];
}

export interface StorageProvider {
  /**
   * Upload a file to storage.
   * @param file - File buffer or Blob
   * @param path - Storage path (e.g., 'hackathons/{id}/cover.png')
   * @param options - Upload options (content type, validation)
   * @returns The storage key and a public/signed URL
   */
  upload(file: Buffer | Blob, path: string, options: UploadOptions): Promise<UploadResult>;

  /**
   * Generate a signed URL for a stored file.
   * @param key - Storage key returned from upload()
   * @param expiresIn - Expiry in seconds (default: 3600 = 1 hour)
   * @returns Signed URL string
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Delete a file from storage.
   * @param key - Storage key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * List files under a given prefix.
   * @param prefix - Path prefix (e.g., 'hackathons/{id}/')
   * @returns Array of StorageObject metadata
   */
  list(prefix: string): Promise<StorageObject[]>;
}
```

**Design decisions:**
- `upload()` accepts `Buffer | Blob` — Buffer for server-side operations, Blob for client-side (though in practice, the client uploads directly to storage via signed URLs in Phase 4; for Phase 2, the API route handles the upload).
- `UploadOptions` includes validation params (`maxSize`, `allowedTypes`) so the provider can reject invalid files before attempting upload.
- All methods are async — storage operations are inherently I/O-bound.

**Forward compatibility:** Phase 4 (submissions) will add a `getSignedUploadUrl(path, options)` method for direct client-to-storage uploads (bypassing the API route). This method is not needed in Phase 2 since cover images are small enough to upload through the API route. The interface can be extended without breaking existing consumers.

---

### 1.11 Supabase Storage Adapter (P1.R9)

**New file: `src/lib/storage/adapters/supabase-adapter.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';
import type { StorageProvider, StorageObject, UploadResult, UploadOptions } from '../types';

const BUCKET_NAME = 'hackforge';

/**
 * Supabase Storage implementation of StorageProvider.
 *
 * Uses the Supabase service role key for server-side operations.
 * Files are stored in the 'hackforge' bucket.
 */
export class SupabaseStorageProvider implements StorageProvider {
  private client;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_STORAGE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Missing SUPABASE_STORAGE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
      );
    }

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }

  async upload(file: Buffer | Blob, path: string, options: UploadOptions): Promise<UploadResult> {
    console.log('[storage] upload:', { path, contentType: options.contentType });

    // Validate file type
    if (options.allowedTypes && !options.allowedTypes.includes(options.contentType)) {
      throw new StorageValidationError(
        `File type '${options.contentType}' is not allowed. Allowed types: ${options.allowedTypes.join(', ')}`
      );
    }

    // Validate file size
    const size = file instanceof Buffer ? file.byteLength : file.size;
    if (options.maxSize && size > options.maxSize) {
      const maxMB = (options.maxSize / (1024 * 1024)).toFixed(1);
      throw new StorageValidationError(
        `File size (${(size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size (${maxMB}MB)`
      );
    }

    const { data, error } = await this.client.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        contentType: options.contentType,
        upsert: true, // overwrite if exists (e.g., re-uploading cover image)
      });

    if (error) {
      console.error('[storage] upload failed:', error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const url = await this.getSignedUrl(data.path);
    console.log('[storage] upload success:', { key: data.path });

    return { key: data.path, url };
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(BUCKET_NAME)
      .createSignedUrl(key, expiresIn);

    if (error) {
      console.error('[storage] getSignedUrl failed:', { key, error });
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  async delete(key: string): Promise<void> {
    console.log('[storage] delete:', { key });

    const { error } = await this.client.storage
      .from(BUCKET_NAME)
      .remove([key]);

    if (error) {
      console.error('[storage] delete failed:', { key, error });
      throw new Error(`Storage delete failed: ${error.message}`);
    }
  }

  async list(prefix: string): Promise<StorageObject[]> {
    const { data, error } = await this.client.storage
      .from(BUCKET_NAME)
      .list(prefix);

    if (error) {
      console.error('[storage] list failed:', { prefix, error });
      throw new Error(`Storage list failed: ${error.message}`);
    }

    return (data || []).map((item) => ({
      key: `${prefix}/${item.name}`,
      size: item.metadata?.size ?? 0,
      contentType: item.metadata?.mimetype ?? 'application/octet-stream',
      lastModified: new Date(item.updated_at ?? item.created_at),
    }));
  }
}

/**
 * Typed error for file validation failures (type, size).
 * Consumers can catch this specifically to return 400 vs 500.
 */
export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageValidationError';
  }
}
```

**Design decisions:**
- `upsert: true` on upload — re-uploading a cover image overwrites the previous one. No orphaned files.
- `persistSession: false` — server-side only, no browser session management.
- `StorageValidationError` — a typed error class so API routes can distinguish between validation failures (400) and storage failures (500).
- Logging at entry/exit/error per coding conventions.

**Supabase Storage setup required:**
1. In Supabase dashboard → Storage → Create bucket named `hackforge`
2. Set bucket to **private** (files accessed only via signed URLs)
3. No RLS policies needed — we're using the service role key

---

### 1.12 Storage Provider Factory (P1.R10)

**New file: `src/lib/storage/index.ts`**

```typescript
import type { StorageProvider } from './types';
import { SupabaseStorageProvider } from './adapters/supabase-adapter';

let providerInstance: StorageProvider | null = null;

/**
 * Factory function that returns the configured StorageProvider.
 *
 * Currently returns SupabaseStorageProvider.
 * To swap providers, change this factory — no other code changes needed.
 *
 * Uses singleton pattern to avoid creating multiple Supabase clients.
 */
export function getStorageProvider(): StorageProvider {
  if (!providerInstance) {
    providerInstance = new SupabaseStorageProvider();
  }
  return providerInstance;
}

export type { StorageProvider, StorageObject, UploadResult, UploadOptions } from './types';
export { StorageValidationError } from './adapters/supabase-adapter';
```

**Design decisions:**
- Singleton pattern — one provider instance per process. Avoids creating new Supabase clients on every request.
- Re-exports types and error class from the barrel so consumers only import from `@/lib/storage`.

---

### 1.13 Storage Constants

**New file: `src/lib/storage/constants.ts`**

```typescript
/**
 * Storage configuration constants.
 * Centralized so validation rules are consistent between client and server.
 */

export const STORAGE_CONSTANTS = {
  /** Allowed MIME types for image uploads (Phase 2: cover images + prize images) */
  ALLOWED_IMAGE_TYPES: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ] as const,

  /** Maximum image file size: 5MB */
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,

  /** Cover image aspect ratio (width / height) */
  COVER_IMAGE_ASPECT_RATIO: 16 / 9,

  /** Storage path builders */
  paths: {
    coverImage: (hackathonId: string, ext: string) =>
      `hackathons/${hackathonId}/cover.${ext}`,
    prizeImage: (hackathonId: string, prizeId: string, ext: string) =>
      `hackathons/${hackathonId}/prizes/${prizeId}.${ext}`,
  },
} as const;
```

---

### 1.14 Template Seed Data (P1.R11)

**New file: `src/db/seed/templates.ts`**

This is a standalone seed script executed via `npm run db:seed`.

```typescript
import { db } from '@/db';
import { hackathonTemplates } from '@/db/schema';

const TEMPLATES = [
  {
    name: 'Idea Sprint',
    slug: 'idea-sprint',
    description:
      'A fast-paced format for collecting and evaluating ideas. Participants submit ideas in a structured format, organizers screen for quality, and the best ideas win. Best for: innovation challenges, ideation weeks, problem-statement-driven events.',
    templateType: 'idea_sprint' as const,
    icon: 'lightbulb',
    defaultPhases: [
      { name: 'Registration', type: 'registration', order: 1, config: {} },
      { name: 'Idea Submission', type: 'submission', order: 2, config: {} },
      { name: 'Screening', type: 'screening', order: 3, config: {} },
      { name: 'Winners Announced', type: 'results', order: 4, config: {} },
    ],
  },
  {
    name: 'Build & Ship',
    slug: 'build-and-ship',
    description:
      'The classic hackathon format. Teams register, build a working prototype, submit their project, and present to judges. Best for: weekend hackathons, internal build days, product-focused innovation events.',
    templateType: 'build_and_ship' as const,
    icon: 'rocket',
    defaultPhases: [
      { name: 'Registration', type: 'registration', order: 1, config: {} },
      { name: 'Building Phase', type: 'submission', order: 2, config: {} },
      { name: 'Project Submission', type: 'submission', order: 3, config: {} },
      { name: 'Judging', type: 'judging', order: 4, config: {} },
      { name: 'Winners Announced', type: 'results', order: 5, config: {} },
    ],
  },
  {
    name: 'Innovation Pipeline',
    slug: 'innovation-pipeline',
    description:
      'A multi-stage format that starts with ideas and progressively narrows down to polished prototypes. Each stage has its own evaluation. Best for: corporate innovation programs, multi-week challenges, R&D-driven events with executive judging.',
    templateType: 'innovation_pipeline' as const,
    icon: 'layers',
    defaultPhases: [
      { name: 'Registration', type: 'registration', order: 1, config: {} },
      { name: 'Idea Submission', type: 'submission', order: 2, config: {} },
      { name: 'Screening', type: 'screening', order: 3, config: {} },
      { name: 'Prototype Submission', type: 'submission', order: 4, config: {} },
      { name: 'Demo Day & Final Judging', type: 'judging', order: 5, config: {} },
      { name: 'Winners Announced', type: 'results', order: 6, config: {} },
    ],
  },
  {
    name: 'Open Challenge',
    slug: 'open-challenge',
    description:
      'An open-entry format where anyone can submit a solution and experts pick the winners. Simple and broad. Best for: public challenges, community-driven events, bounty-style competitions, open-source hackathons.',
    templateType: 'open_challenge' as const,
    icon: 'globe',
    defaultPhases: [
      { name: 'Registration', type: 'registration', order: 1, config: {} },
      { name: 'Submission', type: 'submission', order: 2, config: {} },
      { name: 'Expert Judging', type: 'judging', order: 3, config: {} },
      { name: 'Winners Announced', type: 'results', order: 4, config: {} },
    ],
  },
];

export async function seedTemplates() {
  console.log('[seed] Seeding hackathon templates...');

  for (const template of TEMPLATES) {
    const existing = await db.query.hackathonTemplates.findFirst({
      where: (t, { eq }) => eq(t.templateType, template.templateType),
    });

    if (existing) {
      console.log(`[seed] Template '${template.name}' already exists, skipping.`);
      continue;
    }

    await db.insert(hackathonTemplates).values(template);
    console.log(`[seed] Inserted template: ${template.name}`);
  }

  console.log('[seed] Template seeding complete.');
}
```

**npm script in `package.json`:**

```json
{
  "db:seed": "npx tsx src/db/seed/templates.ts"
}
```

**Seed runner — `src/db/seed/index.ts`:**

```typescript
import { seedTemplates } from './templates';

async function main() {
  await seedTemplates();
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
```

**Design decisions:**
- Idempotent — checks for existing templates by `templateType` before inserting. Safe to run multiple times.
- Templates are seeded as a separate script, not as a migration. Migrations handle schema; seeds handle data. This is a common Drizzle pattern.
- The `config: {}` on each phase is an empty object placeholder. Future phases can populate it with phase-specific settings.
- `tsx` is used to run TypeScript seed files directly without compiling. Add as devDependency: `npm install -D tsx`.

---

### 1.15 Hackathon Service (P1.R12)

**New file: `src/lib/services/hackathon-service.ts`**

```typescript
import { eq, and, isNull, desc, sql, ne } from 'drizzle-orm';

import { db } from '@/db';
import {
  hackathons,
  phases,
  tracks,
  prizes,
  hackathonTemplates,
} from '@/db/schema';
import { slugify } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Inferred types from Drizzle schema */
export type Hackathon = typeof hackathons.$inferSelect;
export type NewHackathon = typeof hackathons.$inferInsert;
export type Phase = typeof phases.$inferSelect;
export type Track = typeof tracks.$inferSelect;
export type Prize = typeof prizes.$inferSelect;
export type HackathonTemplate = typeof hackathonTemplates.$inferSelect;

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

  const [hackathonPhases, hackathonTracks, hackathonPrizes] = await Promise.all([
    db.query.phases.findMany({
      where: eq(phases.hackathonId, hackathon.id),
      orderBy: phases.order,
    }),
    db.query.tracks.findMany({
      where: eq(tracks.hackathonId, hackathon.id),
      orderBy: tracks.order,
    }),
    db.query.prizes.findMany({
      where: eq(prizes.hackathonId, hackathon.id),
      orderBy: prizes.rank,
    }),
  ]);

  return {
    hackathon,
    phases: hackathonPhases,
    tracks: hackathonTracks,
    prizes: hackathonPrizes,
  };
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
    const updateData = { ...params.data, updatedAt: new Date() };

    if (updateData.slug && updateData.slug !== existing.slug) {
      const slugResult = await generateUniqueSlug(updateData.slug, params.hackathonId);
      updateData.slug = slugResult.slug;
      slugModified = slugResult.modified;
      newSlug = slugResult.modified ? slugResult.slug : undefined;
    }

    // If title is changing and no explicit slug change, regenerate slug from title
    if (updateData.title && !params.data.slug && updateData.title !== existing.title) {
      const slugResult = await generateUniqueSlug(updateData.title, params.hackathonId);
      updateData.slug = slugResult.slug;
      slugModified = slugResult.modified;
      newSlug = slugResult.modified ? slugResult.slug : undefined;
    }

    const [updated] = await db
      .update(hackathons)
      .set(updateData)
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

  await db
    .update(hackathons)
    .set({ status: params.targetStatus as typeof hackathon.status, updatedAt: new Date() })
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
```

**Design decisions:**
- `createHackathon` creates with a placeholder title ("Untitled Hackathon") and auto-generated slug. The wizard updates the title in Step 2, which regenerates the slug.
- `updateHackathon` returns `slugModified` and `newSlug` so the UI can display the collision notification message.
- `publishHackathon` validates all required fields before allowing publish. This is the gatekeeping function.
- `transitionHackathonStatus` enforces the valid transition map. The UI and API both rely on this.
- `generateUniqueSlug` tries suffixes -2 through -100, then falls back to a timestamp-based suffix. The loop is bounded to prevent infinite iteration.
- All queries scope to `orgId` and filter `deletedAt IS NULL`.

---

### 1.16 Zod Validation Schemas (P1.R14)

**New file: `src/lib/validations/hackathon.ts`**

```typescript
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Hackathon creation (from template selection — Step 1)
// ---------------------------------------------------------------------------

export const createHackathonSchema = z.object({
  templateId: z.string().uuid('Invalid template ID'),
});

export type CreateHackathonInput = z.infer<typeof createHackathonSchema>;

// ---------------------------------------------------------------------------
// Hackathon update (Steps 2, 5 — basic info and team rules)
// ---------------------------------------------------------------------------

export const updateHackathonSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().max(5000, 'Description too long').optional().nullable(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug too long')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only')
    .optional(),
  coverImageKey: z.string().optional().nullable(),
  visibility: z.enum(['public', 'org_only', 'invite_only']).optional(),
  teamMinSize: z.number().int().min(1).max(20).optional(),
  teamMaxSize: z.number().int().min(1).max(20).optional(),
  allowIndividual: z.boolean().optional(),
  rulesHtml: z.string().max(50000, 'Rules content too long').optional().nullable(),
  faqsHtml: z.string().max(50000, 'FAQs content too long').optional().nullable(),
}).refine(
  (data) => {
    if (data.teamMinSize !== undefined && data.teamMaxSize !== undefined) {
      return data.teamMinSize <= data.teamMaxSize;
    }
    return true;
  },
  { message: 'Minimum team size cannot exceed maximum team size', path: ['teamMinSize'] }
);

export type UpdateHackathonInput = z.infer<typeof updateHackathonSchema>;

// ---------------------------------------------------------------------------
// Track CRUD (Step 3)
// ---------------------------------------------------------------------------

export const createTrackSchema = z.object({
  name: z.string().min(1, 'Track name is required').max(100, 'Name too long'),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  resourcesUrl: z.string().url('Invalid URL').optional().nullable().or(z.literal('')),
  order: z.number().int().min(0).optional(),
});

export type CreateTrackInput = z.infer<typeof createTrackSchema>;

export const updateTrackSchema = createTrackSchema.partial();

export type UpdateTrackInput = z.infer<typeof updateTrackSchema>;

// ---------------------------------------------------------------------------
// Phase update (Step 4 — dates and name only)
// ---------------------------------------------------------------------------

export const updatePhaseSchema = z.object({
  name: z.string().min(1, 'Phase name is required').max(100, 'Name too long').optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  },
  { message: 'End date must be after start date', path: ['endDate'] }
);

export type UpdatePhaseInput = z.infer<typeof updatePhaseSchema>;

// ---------------------------------------------------------------------------
// Prize CRUD (Step 6)
// ---------------------------------------------------------------------------

export const createPrizeSchema = z.object({
  name: z.string().min(1, 'Prize name is required').max(100, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional().nullable(),
  rank: z.number().int().min(1),
  imageKey: z.string().optional().nullable(),
});

export type CreatePrizeInput = z.infer<typeof createPrizeSchema>;

export const updatePrizeSchema = createPrizeSchema.partial();

export type UpdatePrizeInput = z.infer<typeof updatePrizeSchema>;

// ---------------------------------------------------------------------------
// Publish validation (Step 8)
// ---------------------------------------------------------------------------

export const publishHackathonSchema = z.object({
  hackathonId: z.string().uuid('Invalid hackathon ID'),
});

// ---------------------------------------------------------------------------
// Status transition
// ---------------------------------------------------------------------------

export const transitionStatusSchema = z.object({
  targetStatus: z.enum([
    'published',
    'active',
    'judging',
    'completed',
    'archived',
  ]),
});

export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;
```

**Design decisions:**
- Schemas are written for **all 4 parts of the PRD**, not just Part 1. This is intentional forward compatibility — the validation schemas are needed by the API routes in Part 2, the list management in Part 3, etc. Having them in place means Part 2's TRD can reference them without re-defining.
- `updateHackathonSchema` uses `.optional()` on all fields — the wizard sends partial updates per step.
- `updatePhaseSchema` only allows `name`, `startDate`, `endDate` — admins cannot change phase `type` or `order` (template-locked).
- The refine on `updateHackathonSchema` validates `teamMinSize <= teamMaxSize` only when both are present.
- `resourcesUrl` accepts an empty string (from clearing the field in the UI) or a valid URL.

---

### 1.17 Implementation Increments

Part 1 is implemented in 4 increments. Each is a self-contained, pushable commit.

#### Increment 1: Database Schema + Enums + Migration

**What:** Add all Phase 2 enums to `enums.ts`, create 5 new schema files (`hackathons.ts`, `phases.ts`, `tracks.ts`, `prizes.ts`, `hackathon-templates.ts`), update the barrel export, generate and apply the migration.

**Files created/modified:**
- `src/db/schema/enums.ts` — modified (add 5 new enums)
- `src/db/schema/hackathons.ts` — created
- `src/db/schema/phases.ts` — created
- `src/db/schema/tracks.ts` — created
- `src/db/schema/prizes.ts` — created
- `src/db/schema/hackathon-templates.ts` — created
- `src/db/schema/index.ts` — modified (add new exports)
- `src/db/migrations/*` — generated

**Verify:**
- `npm run db:generate` creates migration with all 5 tables and 5 enums
- `npm run db:migrate` applies cleanly
- `npm run db:studio` shows all tables
- `npx tsc --noEmit` passes

#### Increment 2: StorageProvider Interface + Supabase Adapter

**What:** Create the StorageProvider interface, Supabase adapter, factory, and constants.

**Files created/modified:**
- `src/lib/storage/types.ts` — created
- `src/lib/storage/adapters/supabase-adapter.ts` — created
- `src/lib/storage/index.ts` — created
- `src/lib/storage/constants.ts` — created
- `package.json` — modified (add `@supabase/supabase-js`)

**Prerequisite:** `.env.local` must have `SUPABASE_STORAGE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Supabase Storage bucket `hackforge` must exist.

**Verify:**
- `npx tsc --noEmit` passes
- Manual test: write a small script that uploads a test image via `getStorageProvider().upload()`, retrieves a signed URL, and deletes the file. Verify all three operations succeed.

#### Increment 3: Template Seed Data

**What:** Create the seed script with 4 default templates, add the `db:seed` npm script, run the seed.

**Files created/modified:**
- `src/db/seed/index.ts` — created
- `src/db/seed/templates.ts` — created
- `package.json` — modified (add `db:seed` script, add `tsx` devDependency)

**Verify:**
- `npm run db:seed` inserts 4 templates
- Running `npm run db:seed` again is idempotent (no duplicates)
- `npm run db:studio` shows 4 rows in `hackathon_templates` with correct `default_phases` JSON

#### Increment 4: Hackathon Service + Zod Validations

**What:** Create the hackathon service with all CRUD + slug generation, and the Zod validation schemas.

**Files created/modified:**
- `src/lib/services/hackathon-service.ts` — created
- `src/lib/validations/hackathon.ts` — created

**Verify:**
- `npx tsc --noEmit` passes
- All exported types resolve correctly
- Slug generation logic: test with duplicate titles to verify suffix appending

---

### 1.18 Files Changed Summary

| File | Action | Requirement |
|------|--------|-------------|
| `src/db/schema/enums.ts` | Modified | P1.R1 |
| `src/db/schema/hackathons.ts` | Created | P1.R2 |
| `src/db/schema/phases.ts` | Created | P1.R3 |
| `src/db/schema/tracks.ts` | Created | P1.R4 |
| `src/db/schema/prizes.ts` | Created | P1.R5 |
| `src/db/schema/hackathon-templates.ts` | Created | P1.R6 |
| `src/db/schema/index.ts` | Modified | P1.R2–P1.R6 |
| `src/db/migrations/*` | Generated | P1.R7 |
| `src/lib/storage/types.ts` | Created | P1.R8 |
| `src/lib/storage/adapters/supabase-adapter.ts` | Created | P1.R9 |
| `src/lib/storage/index.ts` | Created | P1.R10 |
| `src/lib/storage/constants.ts` | Created | P1.R10 |
| `src/db/seed/index.ts` | Created | P1.R11 |
| `src/db/seed/templates.ts` | Created | P1.R11 |
| `src/lib/services/hackathon-service.ts` | Created | P1.R12, P1.R13 |
| `src/lib/validations/hackathon.ts` | Created | P1.R14 |
| `package.json` | Modified | Dependencies + scripts |

---

### 1.19 Environment Variables (New for Phase 2)

No new environment variables. `SUPABASE_STORAGE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already documented in `.env.example` from Phase 1.

**Supabase Storage setup (manual, one-time):**
1. Supabase Dashboard → Storage → New Bucket → Name: `hackforge` → Private (not public)
2. No bucket policies needed — service role key bypasses RLS

---

*Part 1 complete.*

---
---

## Part 2: Hackathon Creation Wizard

**PRD Requirements Covered:** P2.R1 through P2.R16

---

### 2.1 Dependencies (New for Part 2)

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/pm react-cropper cropperjs @hello-pangea/dnd
```

| Package | Purpose | Notes |
|---------|---------|-------|
| `@tiptap/react` | Headless rich text editor for React | Rules & FAQs editor (Step 7) |
| `@tiptap/starter-kit` | Bundle: bold, italic, headings, lists, history | Core formatting for P2.R8 |
| `@tiptap/extension-link` | Link support for Tiptap | Rules/FAQs need hyperlinks |
| `@tiptap/pm` | ProseMirror core (Tiptap peer dependency) | Required by @tiptap/react |
| `react-cropper` | React wrapper around Cropper.js | Cover image 16:9 cropping (P2.R3) |
| `cropperjs` | Image cropping library | Peer dependency for react-cropper |
| `@hello-pangea/dnd` | Drag-and-drop for React (Atlassian fork) | Track and prize reordering (P2.R4, P2.R7) |

**Why these libraries:**
- **Tiptap over Slate/Quill:** Headless, extensible, outputs clean HTML, excellent TypeScript support, active maintenance. Non-technical admins get a WYSIWYG experience without markdown knowledge.
- **react-cropper over react-image-crop:** More mature, supports aspect ratio locking natively, generates canvas blobs directly (needed for client-side crop → upload flow).
- **@hello-pangea/dnd over dnd-kit:** Simpler API for vertical list reordering (our only use case). The Atlassian fork of react-beautiful-dnd is actively maintained and has better accessibility defaults.

---

### 2.2 Route Structure

All wizard routes live under the existing `(dashboard)` route group:

```
src/app/(dashboard)/dashboard/[orgSlug]/hackathons/
├── page.tsx                          # Hackathon list (Part 3 — placeholder exists)
└── create/
    ├── page.tsx                      # Wizard entry point (server component)
    └── _components/
        ├── wizard-shell.tsx          # Step indicator + navigation + layout
        ├── step-template.tsx         # Step 1: Choose Template
        ├── step-basic-info.tsx       # Step 2: Title, description, cover, slug
        ├── step-tracks.tsx           # Step 3: Tracks/Themes
        ├── step-timeline.tsx         # Step 4: Phase dates
        ├── step-team-rules.tsx       # Step 5: Team config + visibility
        ├── step-prizes.tsx           # Step 6: Prizes
        ├── step-rules-faqs.tsx       # Step 7: Tiptap editors
        ├── step-review.tsx           # Step 8: Summary + Publish
        ├── image-crop-modal.tsx      # Cover image crop dialog (16:9)
        └── tiptap-editor.tsx         # Reusable Tiptap wrapper
```

**Edit mode route:** Editing an existing hackathon reuses the same wizard components. Route: `/dashboard/[orgSlug]/hackathons/[hackathonId]/edit`. The `edit/page.tsx` loads the existing hackathon data and passes it to the wizard shell.

```
src/app/(dashboard)/dashboard/[orgSlug]/hackathons/
└── [hackathonId]/
    └── edit/
        └── page.tsx                  # Edit wizard entry (server component — loads data, renders wizard shell)
```

---

### 2.3 API Route Structure (P2.R13)

All hackathon API routes live under `src/app/api/hackathons/`:

```
src/app/api/
├── hackathons/
│   ├── route.ts                                # POST — create draft from template
│   └── [hackathonId]/
│       ├── route.ts                            # PATCH — update hackathon fields
│       ├── publish/
│       │   └── route.ts                        # POST — publish hackathon
│       ├── tracks/
│       │   ├── route.ts                        # POST — add track
│       │   └── [trackId]/
│       │       └── route.ts                    # PATCH — edit track, DELETE — remove track
│       ├── phases/
│       │   └── [phaseId]/
│       │       └── route.ts                    # PATCH — update phase dates/name
│       └── prizes/
│           ├── route.ts                        # POST — add prize
│           └── [prizeId]/
│               └── route.ts                    # PATCH — edit prize, DELETE — remove prize
└── upload/
    └── image/
        └── route.ts                            # POST — upload image via StorageProvider
```

---

### 2.4 API Route Implementations (P2.R13, P2.R14)

Every API route follows the established pattern from Phase 1:
1. Auth check via `requireOrgRole({ orgId, allowedRoles: ['org_admin'] })`
2. Input validation via Zod `.safeParse()`
3. Service call
4. Structured JSON response

#### 2.4.1 `POST /api/hackathons` — Create Hackathon Draft

**File:** `src/app/api/hackathons/route.ts`

```typescript
// Auth: requireOrgRole with org_admin
// Validation: createHackathonSchema (templateId)
// Service: createHackathon({ orgId, templateId, userId })
// Response: 201 { hackathon } | 400 | 401 | 403 | 404
```

**Logic:**
1. Parse body with `createHackathonSchema` — extract `templateId` and `orgId`
2. The `orgId` comes from the request body (the client knows which org it's operating in). The auth guard verifies the user is an `org_admin` of that org.
3. Call `createHackathon()` — creates draft with placeholder title, clones template phases
4. Return the created hackathon object (needed for client redirect to Step 2)

**Org resolution note:** Unlike Phase 1's `/api/orgs/[orgId]/...` pattern which embeds `orgId` in the URL, hackathon API routes accept `orgId` in the request body. This is because hackathons are also accessed via slug in public-facing contexts (Part 4), and the API URL pattern (`/api/hackathons/[hackathonId]`) is hackathon-centric, not org-centric. The org ownership check happens in the service layer.

#### 2.4.2 `PATCH /api/hackathons/[hackathonId]` — Update Hackathon

**File:** `src/app/api/hackathons/[hackathonId]/route.ts`

```typescript
// Auth: requireOrgRole with org_admin
// Validation: updateHackathonSchema (partial fields)
// Service: updateHackathon({ hackathonId, orgId, data })
// Response: 200 { hackathon, slugModified?, newSlug? } | 400 | 401 | 403 | 404
```

**Logic:**
1. Parse body with `updateHackathonSchema`
2. Call `updateHackathon()` — handles slug regeneration, collision detection
3. If `slugModified` is true, include `newSlug` in response for the UI to display the collision notification

**Stale-data detection (P2.R16):** The client sends `updatedAt` (the timestamp it loaded) along with the update payload. The API route compares it against the current `updatedAt` in the database. If they differ, the response includes `{ staleWarning: true }` — but the update still proceeds (last-write-wins). The client displays a non-blocking toast.

#### 2.4.3 `POST /api/hackathons/[hackathonId]/tracks` — Add Track

**File:** `src/app/api/hackathons/[hackathonId]/tracks/route.ts`

```typescript
// Auth: requireOrgRole with org_admin
// Validation: createTrackSchema
// Service: direct Drizzle insert into tracks table
// Response: 201 { track } | 400 | 401 | 403
```

**Logic:**
1. Verify hackathon belongs to the user's org (fetch hackathon, compare orgId)
2. Auto-assign `order` as `max(order) + 1` for the hackathon's existing tracks
3. Insert track, return created record

#### 2.4.4 `PATCH /api/hackathons/[hackathonId]/tracks/[trackId]` — Edit Track

**File:** `src/app/api/hackathons/[hackathonId]/tracks/[trackId]/route.ts`

```typescript
// Auth: requireOrgRole with org_admin
// Validation: updateTrackSchema (partial)
// Service: direct Drizzle update on tracks table
// Response: 200 { track } | 400 | 401 | 403 | 404
```

#### 2.4.5 `DELETE /api/hackathons/[hackathonId]/tracks/[trackId]` — Remove Track

**File:** Same file as PATCH (co-located in `route.ts`)

```typescript
// Auth: requireOrgRole with org_admin
// Service: hard delete from tracks table (not a domain entity — cascade child)
// Response: 200 { message } | 401 | 403 | 404
```

**Note:** Tracks are hard-deleted (not soft-deleted). They are child entities of hackathons with CASCADE delete. The PRD allows track removal during creation.

#### 2.4.6 `PATCH /api/hackathons/[hackathonId]/phases/[phaseId]` — Update Phase

**File:** `src/app/api/hackathons/[hackathonId]/phases/[phaseId]/route.ts`

```typescript
// Auth: requireOrgRole with org_admin
// Validation: updatePhaseSchema (name, startDate, endDate only)
// Service: direct Drizzle update on phases table
// Response: 200 { phase } | 400 | 401 | 403 | 404
```

**Restriction:** Only `name`, `startDate`, and `endDate` can be updated. `type` and `order` are template-locked and cannot be changed after creation.

#### 2.4.7 `POST /api/hackathons/[hackathonId]/prizes` — Add Prize

**File:** `src/app/api/hackathons/[hackathonId]/prizes/route.ts`

```typescript
// Auth: requireOrgRole with org_admin
// Validation: createPrizeSchema
// Service: direct Drizzle insert into prizes table
// Response: 201 { prize } | 400 | 401 | 403
```

#### 2.4.8 `PATCH /api/hackathons/[hackathonId]/prizes/[prizeId]` — Edit Prize

**File:** `src/app/api/hackathons/[hackathonId]/prizes/[prizeId]/route.ts`

#### 2.4.9 `DELETE /api/hackathons/[hackathonId]/prizes/[prizeId]` — Remove Prize

**File:** Same file as PATCH (co-located)

Same pattern as tracks — hard delete for child entities.

#### 2.4.10 `POST /api/hackathons/[hackathonId]/publish` — Publish Hackathon

**File:** `src/app/api/hackathons/[hackathonId]/publish/route.ts`

```typescript
// Auth: requireOrgRole with org_admin
// Service: publishHackathon({ hackathonId, orgId })
// Response: 200 { message, slug } | 400 | 401 | 403 | 404
```

**Logic:** Delegates entirely to `publishHackathon()` in the service layer, which validates: title set, ≥1 track, all phase dates configured. Returns the slug for client-side redirect to the landing page.

#### 2.4.11 `POST /api/upload/image` — Upload Image

**File:** `src/app/api/upload/image/route.ts`

```typescript
// Auth: requireVerifiedUser()
// Validation: multipart form data — file + hackathonId + imageType ('cover' | 'prize') + prizeId?
// Service: getStorageProvider().upload()
// Response: 200 { key, url } | 400 | 401 | 413
```

**Logic:**
1. Parse multipart form data (`request.formData()`)
2. Extract file, hackathonId, imageType, optional prizeId
3. Verify the user has org_admin access to the hackathon's org
4. Validate file type and size using `STORAGE_CONSTANTS`
5. Generate storage path using `STORAGE_CONSTANTS.paths.coverImage()` or `.prizeImage()`
6. Upload via `getStorageProvider().upload()`
7. Return the storage key (client saves it to the hackathon/prize record via PATCH)

**Why a separate upload route instead of embedding in PATCH:** File uploads use `multipart/form-data`, while all other routes use `application/json`. Mixing them complicates both client and server code. The upload route returns a `key`, which the client then sends as `coverImageKey` in the regular PATCH call. This two-step pattern is standard and keeps each route simple.

---

### 2.5 Wizard Shell Component (P2.R1)

**File:** `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/wizard-shell.tsx`

**Type:** Client component (`'use client'`)

```typescript
interface WizardShellProps {
  orgSlug: string;
  orgId: string;
  hackathon?: HackathonWithRelations;      // null for create, populated for edit
  existingDraft?: HackathonWithRelations;   // passed by create page if user has an unfinished draft
  templates: HackathonTemplate[];           // fetched server-side, passed as prop
  className?: string;
}
```

**State management:**
- `currentStep: number` (1–8) — tracks which step is active
- `highestStepReached: number` — ratchets upward via `Math.max(h, next)` on every step transition; controls how far forward sidebar clicks can navigate
- `hackathonId: string | null` — set after Step 1 creates the draft
- `hackathonData: Partial<Hackathon>` — local cache of saved data (synced on each step save)
- `phasesData: Phase[]` — local cache of phases
- `tracksData: Track[]` — local cache of tracks
- `prizesData: Prize[]` — local cache of prizes
- `visitedSteps: Set<number>` — tracks which steps the user has visited and left; used for "incomplete" vs "not started" distinction on optional steps
- `saveStatus: SaveStatus` (`'idle' | 'saving' | 'saved' | 'error'`) — drives the save indicator
- `showResumeDialog: boolean` — controls the resume-draft dialog on the create page

**Step indicator (data-driven three-state system):**
- Rendered as a vertical sidebar on desktop (≥1024px), horizontal stepper on mobile
- Each step shows: step number, step name, and a **data-driven status icon** with four possible states:
  - `complete` — green check (`Check` icon, `bg-green-500/15 text-green-600`): data requirements are met
  - `incomplete` — amber dot (`CircleDot` icon, `bg-amber-500/15 text-amber-600`): step was visited but data requirements not yet met
  - `not_started` — empty circle (`Circle` icon, border only): not yet visited
  - `current` — filled dot (bg-current), `bg-primary text-primary-foreground`
- Completion criteria per step:
  - **Step 1 (Template):** complete if `hackathonId` exists
  - **Step 2 (Basic Info):** complete if title is set and ≠ "Untitled Hackathon"; incomplete if visited but title not set
  - **Step 3 (Tracks):** complete if ≥1 track exists; incomplete if visited but no tracks
  - **Step 4 (Timeline):** complete if all phases have both `startDate` and `endDate`; incomplete if visited but dates missing
  - **Step 5 (Team Rules):** optional — complete once visited (has valid defaults)
  - **Step 6 (Prizes):** optional — complete once visited (zero prizes is valid)
  - **Step 7 (Rules & FAQs):** optional — complete once visited (empty rules/FAQs is valid)
  - **Step 8 (Review):** always `not_started` (it's the publish action, never "complete")
- Sidebar steps are clickable up to `highestStepReached`. Unreached steps show `cursor-not-allowed` and are disabled.
- Step 1 is always viewable (read-only once a draft exists, with a lock notice).

**Navigation logic:**
- `setCurrentStep` wrapper: ratchets `highestStepReached` via `Math.max`, and marks the departing step as visited in `visitedSteps`.
- "Back" button: always available after Step 1. Decrements `currentStep`.
- "Next" button: shown on steps that don't have their own Save & Continue (hidden for steps 2, 4, 5, 7, 8). Increments `currentStep`.
- "Save Draft" button: persistent in footer on every step (P2.R15). Shows confirmation toast and navigates to the hackathon list.
- Sidebar clicks: navigate to any step ≤ `highestStepReached`.

**Auto-save implementation (P2.R10):**
- Steps 2, 4, 5, 7 have their own "Save & Continue" buttons that save to the API before advancing.
- Steps 3, 6 (Tracks, Prizes) perform immediate API calls on add/edit/delete/reorder — no separate save action needed.
- UI feedback: a subtle text indicator in the sidebar — "Saving..." (with spinner) → "Saved" (with checkmark, fades after 2s) → "Save failed" (red, persists until next attempt).

**Edit mode (P2.R8 from Part 3, P2.R11):**
- When `hackathon` prop is provided (edit mode), the wizard pre-fills all steps with existing data.
- `currentStep` starts at Step 2 (Step 1 is template selection — locked after creation).
- For published hackathons: template selection (Step 1) and phase structure (Step 4 type/order) are read-only. All other fields remain editable.

**Resume draft (P2.R11):**
- The `create/page.tsx` server component checks for existing drafts before rendering.
- If a draft exists: shows a dialog — "You have an unfinished draft: [title]. Resume editing or start fresh?"
- "Resume" loads the draft data and navigates to the furthest completed step (determined by which fields are populated: title set → past Step 2, tracks exist → past Step 3, etc.)
- "Start fresh" navigates to Step 1 with no pre-filled data.

---

### 2.6 Step 1: Choose Template (P2.R2)

**File:** `step-template.tsx` — Client component

```typescript
interface StepTemplateProps {
  templates: HackathonTemplate[];
  onSelect: (templateId: string) => Promise<void>;
  className?: string;
}
```

**Rendering:**
- 4 template cards in a 2×2 grid (desktop) or single column (mobile)
- Each card shows: Lucide icon (mapped from `template.icon` string), template name, description
- Selected card has `ring-2 ring-primary` styling
- Cards use `cursor-pointer hover:border-primary` for interaction

**Icon mapping:** A static map converts the `icon` string from the template record to a Lucide component:
```typescript
const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  lightbulb: Lightbulb,
  rocket: Rocket,
  layers: Layers,
  globe: Globe,
};
```

**On select:**
1. Set visual selection state
2. Call `POST /api/hackathons` with `{ templateId, orgId }`
3. On success: store `hackathonId` in wizard state, advance to Step 2
4. On error: show error toast, remain on Step 1

**This is the only step that creates a DB record.** All subsequent steps update the existing record.

---

### 2.7 Step 2: Basic Info (P2.R3)

**File:** `step-basic-info.tsx` — Client component

**Form fields (react-hook-form + Zod):**
- **Title** (required): text input. On change, auto-generates slug preview (same pattern as create-org-form: watch title → slugify → set slug, until user manually edits slug).
- **Description** (optional): textarea, max 5000 chars.
- **Slug** (auto-generated, editable): text input prefixed with `hackforge.com/hackathons/`. Validated with slug regex. If the user edits it manually, auto-generation from title stops (tracked via `isSlugManuallyEdited` ref).
- **Cover image** (optional): drag-and-drop zone + click-to-browse. Accepts PNG, JPG, WEBP up to 5MB (validated client-side using `STORAGE_CONSTANTS`).

**Cover image upload flow (P2.R3):**
1. User selects/drops an image file
2. Client-side validation: file type and size against `STORAGE_CONSTANTS`
3. **Crop modal opens** (`image-crop-modal.tsx`) with 16:9 aspect ratio locked
4. User adjusts crop region, clicks "Crop & Upload"
5. Cropped image is generated as a canvas blob on the client (`cropper.getCroppedCanvas().toBlob()`)
6. Blob is uploaded to `POST /api/upload/image` as multipart form data
7. API returns `{ key, url }` — `key` is stored in form state as `coverImageKey`, `url` is used for preview
8. On step save, `coverImageKey` is sent in the PATCH request

**Slug collision handling:**
- On step save (when slug or title changes), the PATCH response may include `{ slugModified: true, newSlug: 'innovation-2026-2' }`
- If `slugModified`, show an inline info message below the slug input: "A hackathon with this slug already exists. We've modified yours to **[new-slug]**. You can edit it manually."
- Update the slug field value to the new slug

---

### 2.8 Image Crop Modal (P2.R3)

**File:** `image-crop-modal.tsx` — Client component

```typescript
interface ImageCropModalProps {
  imageFile: File;
  aspectRatio: number;              // 16/9 from STORAGE_CONSTANTS
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (blob: Blob) => void;
  className?: string;
}
```

**Implementation:**
- Uses `react-cropper` (Cropper.js wrapper)
- Modal rendered via shadcn `Dialog` component
- Aspect ratio locked to 16:9 (passed as prop, sourced from `STORAGE_CONSTANTS.COVER_IMAGE_ASPECT_RATIO`)
- Preview area shows the crop region in real-time
- "Crop & Upload" button: calls `cropper.getCroppedCanvas({ width: 1280, height: 720 }).toBlob()` — outputs a 1280×720 image for consistent hero sizes
- "Cancel" button: closes modal, discards the file selection
- Loading state during crop canvas generation (can take a moment for large images)

**No server-side image processing.** The canvas blob is the final image. The server receives and stores it as-is.

---

### 2.9 Step 3: Tracks/Themes (P2.R4)

**File:** `step-tracks.tsx` — Client component

**State:** Array of tracks managed locally, synced to DB on individual add/edit/remove operations (not batched on step save).

**UI:**
- List of track cards, each showing: name, description preview, resources URL, drag handle, edit/delete buttons
- "Add Track" button at the bottom opens an inline form (not a modal — keeps context visible)
- Inline form: name (required), description (optional textarea), resources URL (optional)
- **Drag-and-drop reordering** via `@hello-pangea/dnd`: `DragDropContext` → `Droppable` → `Draggable` per track
- Minimum 1 track required for publish (validated in Step 8, not enforced here — admin can have 0 tracks while drafting)

**API calls (immediate, not batched):**
- Add: `POST /api/hackathons/[id]/tracks` → appends to local state
- Edit: `PATCH /api/hackathons/[id]/tracks/[trackId]` → updates local state
- Remove: `DELETE /api/hackathons/[id]/tracks/[trackId]` → removes from local state
- Reorder: `PATCH /api/hackathons/[id]/tracks/[trackId]` with new `order` value for each moved track

**Why immediate saves (not batched):** Tracks are separate DB records, not fields on the hackathon. Batching would require a complex diff algorithm. Immediate saves are simpler, and the "Saving..." indicator provides feedback. If any individual operation fails, the error is shown immediately and the local state rolls back.

---

### 2.10 Step 4: Timeline (P2.R5)

**File:** `step-timeline.tsx` — Client component

**Rendering:**
- Phases displayed as a vertical list in template-defined order
- Each phase shows: name (editable text input), type badge (read-only), start date picker, end date picker
- Phase type and order are **read-only** (template-locked)
- Date pickers use native `<input type="datetime-local" />` (sufficient for V1, no third-party date picker library needed)

**Validation (client-side before save):**
- Each phase: `endDate > startDate` (per `updatePhaseSchema` refine)
- Cross-phase: phases should be in chronological order — phase N's `startDate` should be ≥ phase (N-1)'s `startDate`. Show a warning (orange border + message) if violated, but don't block saves (admins may have overlapping phases intentionally).
- All dates required for publish (validated in Step 8)

**Save behavior:**
- On step transition, all phases with changed dates are saved via `PATCH /api/hackathons/[id]/phases/[phaseId]`
- Only phases with dirty fields are sent (tracked via `useForm` dirty state per phase)

---

### 2.11 Step 5: Team Rules (P2.R6)

**File:** `step-team-rules.tsx` — Client component

**Form fields:**
- **Team minimum size** (number input, default 1, min 1, max 20)
- **Team maximum size** (number input, default 5, min 1, max 20)
- **Allow individual participation** (toggle/switch, default true)
- **Visibility** (select dropdown): `public` (default, functional), `org_only` (shown, disabled with "Coming soon" badge), `invite_only` (shown, disabled with "Coming soon" badge)

**Validation:** `teamMinSize <= teamMaxSize` (from `updateHackathonSchema` refine)

**Save:** All fields saved as a single PATCH to `/api/hackathons/[id]` on step transition.

---

### 2.12 Step 6: Prizes (P2.R7)

**File:** `step-prizes.tsx` — Client component

**UI pattern:** Same as Step 3 (Tracks) — list of cards with inline add/edit, drag-and-drop reordering.

**Prize fields:** name (required), description (optional), rank (auto-assigned from order, editable), image (optional upload via crop modal or direct upload — no crop enforced for prize images, just file type/size validation).

**Preset buttons:** Quick-add buttons for common prizes: "1st Place", "2nd Place", "3rd Place", "Best Innovation", "People's Choice". Clicking a preset adds a prize with that name and auto-incremented rank.

**Prizes are optional.** A hackathon can have zero prizes. No minimum enforced.

**API calls:** Same immediate-save pattern as tracks — `POST`, `PATCH`, `DELETE` per operation.

**Prize image upload:** Uses the same `POST /api/upload/image` route with `imageType: 'prize'` and `prizeId`. Storage path: `hackathons/[id]/prizes/[prizeId].[ext]`. No 16:9 crop — prize images are stored as-is (within 5MB / image type constraints).

---

### 2.13 Step 7: Rules & FAQs (P2.R8)

**File:** `step-rules-faqs.tsx` — Client component

**Layout:** Two Tiptap editors stacked vertically, each with a label and toolbar:
- **Rules** — "Hackathon Rules" heading
- **FAQs** — "Frequently Asked Questions" heading

Both are optional. Empty content is saved as `null`.

**Save:** `rulesHtml` and `faqsHtml` saved via PATCH to `/api/hackathons/[id]` on step transition. Tiptap's `editor.getHTML()` provides the HTML string.

---

### 2.14 Tiptap Editor Component (P2.R8)

**File:** `tiptap-editor.tsx` — Client component (shared between Rules and FAQs)

```typescript
interface TiptapEditorProps {
  content: string | null;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}
```

**Extensions (from `@tiptap/starter-kit` + `@tiptap/extension-link`):**
- `StarterKit` (includes: Bold, Italic, Heading, BulletList, OrderedList, History, Paragraph, HardBreak)
- `Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } })`
- Headings restricted to levels 2 and 3 only: `Heading.configure({ levels: [2, 3] })`

**Toolbar buttons:**
| Button | Action | Icon |
|--------|--------|------|
| **B** | Toggle bold | `Bold` (Lucide) |
| *I* | Toggle italic | `Italic` (Lucide) |
| H2 | Toggle heading level 2 | `Heading2` (Lucide) |
| H3 | Toggle heading level 3 | `Heading3` (Lucide) |
| • | Toggle bullet list | `List` (Lucide) |
| 1. | Toggle ordered list | `ListOrdered` (Lucide) |
| 🔗 | Set/unset link (prompt for URL) | `Link` (Lucide) |
| ↩ | Undo | `Undo` (Lucide) |
| ↪ | Redo | `Redo` (Lucide) |

**Toolbar styling:**
- Sticky toolbar at the top of the editor area
- Buttons styled with `cn('p-2 rounded', isActive && 'bg-muted')` — active state matches the current selection's formatting
- Separator lines between formatting groups (text, headings, lists, links, history)

**Editor area styling:**
- `min-h-[200px]` for comfortable editing area
- `prose prose-sm` Tailwind typography classes for content rendering (requires `@tailwindcss/typography` — add as devDependency if not present)
- Focus ring: `focus-within:ring-2 focus-within:ring-ring`

**Output:** `editor.getHTML()` — returns clean HTML. Stored directly in `hackathons.rules_html` / `hackathons.faqs_html`.

---

### 2.15 Step 8: Review & Publish (P2.R9)

**File:** `step-review.tsx` — Client component

**Layout:** Read-only summary of all wizard data, organized into sections:

| Section | Data Shown | Edit Link Target |
|---------|-----------|-----------------|
| Template | Template name + icon | Step 1 (disabled in edit mode) |
| Basic Info | Title, description, cover image preview, slug URL | Step 2 |
| Tracks | Track names + descriptions | Step 3 |
| Timeline | Phase names + dates | Step 4 |
| Team Rules | Min/max size, individual toggle, visibility | Step 5 |
| Prizes | Prize names + ranks | Step 6 |
| Rules & FAQs | Rendered HTML preview (truncated) | Step 7 |

**Edit links:** Each section has a pencil icon / "Edit" link that calls `setCurrentStep(N)` to navigate back to the relevant step.

**Action buttons:**
- **"Save as Draft"** — saves current state, redirects to `/dashboard/[orgSlug]/hackathons` with a success toast
- **"Publish"** — calls `POST /api/hackathons/[id]/publish`. On success: redirects to `/hackathons/[slug]` (the public landing page). On failure: shows error toast with the specific reason (TITLE_REQUIRED, AT_LEAST_ONE_TRACK_REQUIRED, ALL_PHASE_DATES_REQUIRED)

**Publish validation feedback:** Before calling the API, the client performs a pre-check on the local data:
- Title is not "Untitled Hackathon" and not empty
- At least one track exists
- All phases have start and end dates

If any check fails, the relevant section is highlighted with a red border and an inline error message, and the "Publish" button is disabled. The section's "Edit" link is emphasized. This provides immediate feedback without a round-trip.

---

### 2.16 Stale-Data Detection (P2.R16)

**Implementation:**
- When the wizard loads (create or edit), it stores the hackathon's `updatedAt` timestamp in component state
- On every save (step transition, Save Draft, Publish), the client sends `{ ...data, expectedUpdatedAt: storedTimestamp }` in the request body
- The API route compares `expectedUpdatedAt` against the current DB `updatedAt`
- If they differ, the response includes `{ staleWarning: true, lastUpdatedAt: currentDbTimestamp }`
- The client shows a non-blocking warning toast: "This hackathon was recently edited by another admin. Your changes have been saved and will overwrite the latest version."
- The client updates its stored `updatedAt` to the new value from the response
- **This does NOT block the save** — last-write-wins as per PRD decision #9

---

### 2.17 Resume Draft Flow (P2.R11)

**File:** `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/page.tsx` — Server component

**Logic:**
1. Auth check: `requireOrgRole` with `org_admin`
2. Fetch templates: `getTemplates()`
3. Fetch user's existing drafts: `getHackathonsByOrgId({ orgId, status: 'draft' })` — filter to drafts created by the current user
4. If drafts exist: pass `existingDraft` prop to `WizardShell`
5. WizardShell shows a resume dialog on mount if `existingDraft` is present

**Determining the furthest completed step:**
```typescript
function getFurthestStep(hackathon: HackathonWithRelations): number {
  const { hackathon: h, phases, tracks } = hackathon;
  if (h.rulesHtml || h.faqsHtml) return 8;                    // Rules/FAQs set → show Review
  if (prizes.length > 0) return 7;                              // Prizes added → show Rules
  if (h.teamMinSize !== 1 || h.teamMaxSize !== 5) return 6;   // Team rules changed → show Prizes
  const allPhaseDates = phases.every(p => p.startDate && p.endDate);
  if (allPhaseDates) return 5;                                  // Phase dates set → show Team Rules
  if (tracks.length > 0) return 4;                              // Tracks added → show Timeline
  if (h.title !== 'Untitled Hackathon') return 3;              // Title set → show Tracks
  return 2;                                                     // Template selected → show Basic Info
}
```

---

### 2.18 Permissions (P2.R12)

All wizard pages and API routes enforce:

| Check | Implementation | Failure Response |
|-------|---------------|-----------------|
| Authenticated | `requireOrgRole()` calls `auth()` | 401 → redirect to `/login` |
| Email verified | `requireOrgRole()` checks `isEmailVerified` | 403 |
| Org membership | `requireOrgRole()` queries `org_memberships` | 403 |
| `org_admin` role | `requireOrgRole({ allowedRoles: ['org_admin'] })` | 403 |
| Hackathon ownership | Service layer checks `hackathon.orgId === user's orgId` | 404 (not 403 — don't leak existence) |

**`member` role:** Can view the hackathon list page but sees no "Create Hackathon" button and cannot access `/hackathons/create` (server component redirects to the hackathon list with a toast).

---

### 2.19 New Utility: Hackathon Service Extensions

The following methods are added to `src/lib/services/hackathon-service.ts` during Part 2 implementation:

```typescript
// Get drafts by user (for resume-draft flow)
export async function getDraftsByUser(params: {
  orgId: string;
  userId: string;
}): Promise<Hackathon[]>

// Reorder tracks (batch update order values)
export async function reorderTracks(params: {
  hackathonId: string;
  orgId: string;
  trackIds: string[];     // ordered array of track IDs
}): Promise<{ success: boolean; error?: string }>

// Reorder prizes (batch update rank values)
export async function reorderPrizes(params: {
  hackathonId: string;
  orgId: string;
  prizeIds: string[];     // ordered array of prize IDs
}): Promise<{ success: boolean; error?: string }>
```

These methods follow the same patterns as existing service functions: console.log at entry/exit, org scoping, error handling with typed returns.

---

### 2.20 Implementation Increments

Part 2 is implemented in 5 increments. Each is a self-contained, pushable commit.

#### Increment 1: API Routes (All 11 routes)

**What:** Create all API route handlers for hackathon CRUD, track/phase/prize management, publish, and image upload.

**Files created:**
- `src/app/api/hackathons/route.ts`
- `src/app/api/hackathons/[hackathonId]/route.ts`
- `src/app/api/hackathons/[hackathonId]/publish/route.ts`
- `src/app/api/hackathons/[hackathonId]/tracks/route.ts`
- `src/app/api/hackathons/[hackathonId]/tracks/[trackId]/route.ts`
- `src/app/api/hackathons/[hackathonId]/phases/[phaseId]/route.ts`
- `src/app/api/hackathons/[hackathonId]/prizes/route.ts`
- `src/app/api/hackathons/[hackathonId]/prizes/[prizeId]/route.ts`
- `src/app/api/upload/image/route.ts`

**Files modified:**
- `src/lib/services/hackathon-service.ts` — add `getDraftsByUser()`, `reorderTracks()`, `reorderPrizes()`

**Verify:**
- `npx tsc --noEmit` passes
- Manual test: create a hackathon via `POST /api/hackathons` with a valid template ID and org

#### Increment 2: Wizard Shell + Step 1 (Template Selection)

**What:** Build the wizard page, shell component with step indicator and navigation, and the template selection step.

**Files created:**
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/page.tsx`
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/wizard-shell.tsx`
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/step-template.tsx`

**Verify:**
- Navigate to `/dashboard/[orgSlug]/hackathons/create`
- 4 template cards render from DB
- Selecting a template creates a draft and advances to Step 2
- Step indicator shows Step 1 as complete (green check)

#### Increment 3: Steps 2–5 (Basic Info, Tracks, Timeline, Team Rules)

**What:** Build the data-entry steps including image upload with crop modal, track management with drag-and-drop, timeline phase editing, and team configuration.

**Files created:**
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/step-basic-info.tsx`
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/step-tracks.tsx`
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/step-timeline.tsx`
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/step-team-rules.tsx`
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/image-crop-modal.tsx`

**Dependencies installed:** `react-cropper`, `cropperjs`, `@hello-pangea/dnd`

**Verify:**
- Step 2: title auto-generates slug, cover image upload with 16:9 crop works
- Step 3: add/edit/remove/reorder tracks, at least one visible
- Step 4: phase dates set, validation catches end < start
- Step 5: team size config, visibility dropdown shows "coming soon" for non-public options
- Auto-save triggers on every step transition with visual indicator

#### Increment 4: Steps 6–8 (Prizes, Rules/FAQs, Review)

**What:** Build prize management, Tiptap rich text editors, and the review/publish step.

**Files created:**
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/step-prizes.tsx`
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/step-rules-faqs.tsx`
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/step-review.tsx`
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/tiptap-editor.tsx`

**Dependencies installed:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/pm`

**Verify:**
- Step 6: add/edit/remove/reorder prizes, preset buttons work, optional image upload
- Step 7: both Tiptap editors render with toolbar, formatting works (bold, italic, headings, lists, links)
- Step 8: review shows all data, edit links navigate back, "Save as Draft" returns to list, "Publish" validates and redirects to landing page
- Full wizard flow: template → basic info → tracks → timeline → team rules → prizes → rules → publish

#### Increment 5: Edit Mode + Resume Draft

**What:** Build the edit wizard route and the resume-draft flow for the create page.

**Files created:**
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/[hackathonId]/edit/page.tsx`

**Files modified:**
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/page.tsx` — add draft detection and resume dialog
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/wizard-shell.tsx` — add edit mode support (pre-fill, lock template step)

**Verify:**
- Creating a draft, closing browser, navigating back to `/create` shows resume dialog
- Editing a published hackathon pre-fills all fields, template and phase structure are locked
- Stale-data warning shows when another admin has edited the hackathon

---

### 2.21 Files Changed Summary

| File | Action | Requirement |
|------|--------|-------------|
| `src/app/api/hackathons/route.ts` | Created | P2.R13 |
| `src/app/api/hackathons/[hackathonId]/route.ts` | Created | P2.R13 |
| `src/app/api/hackathons/[hackathonId]/publish/route.ts` | Created | P2.R13 |
| `src/app/api/hackathons/[hackathonId]/tracks/route.ts` | Created | P2.R13 |
| `src/app/api/hackathons/[hackathonId]/tracks/[trackId]/route.ts` | Created | P2.R13 |
| `src/app/api/hackathons/[hackathonId]/phases/[phaseId]/route.ts` | Created | P2.R13 |
| `src/app/api/hackathons/[hackathonId]/prizes/route.ts` | Created | P2.R13 |
| `src/app/api/hackathons/[hackathonId]/prizes/[prizeId]/route.ts` | Created | P2.R13 |
| `src/app/api/upload/image/route.ts` | Created | P2.R13 |
| `src/lib/services/hackathon-service.ts` | Modified | P2.R11 |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/page.tsx` | Created | P2.R1, P2.R11, P2.R12 |
| `...create/_components/wizard-shell.tsx` | Created | P2.R1, P2.R10, P2.R15, P2.R16 |
| `...create/_components/step-template.tsx` | Created | P2.R2 |
| `...create/_components/step-basic-info.tsx` | Created | P2.R3 |
| `...create/_components/step-tracks.tsx` | Created | P2.R4 |
| `...create/_components/step-timeline.tsx` | Created | P2.R5 |
| `...create/_components/step-team-rules.tsx` | Created | P2.R6 |
| `...create/_components/step-prizes.tsx` | Created | P2.R7 |
| `...create/_components/step-rules-faqs.tsx` | Created | P2.R8 |
| `...create/_components/step-review.tsx` | Created | P2.R9 |
| `...create/_components/image-crop-modal.tsx` | Created | P2.R3 |
| `...create/_components/tiptap-editor.tsx` | Created | P2.R8 |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/[hackathonId]/edit/page.tsx` | Created | P2.R11 |
| `package.json` | Modified | Dependencies |

---

### 2.22 Dependencies (New for Phase 2 — Full List)

| Package | Version | Type | Added In |
|---------|---------|------|----------|
| `@supabase/supabase-js` | ^2.x | dependency | Part 1 |
| `tsx` | ^4.x | devDependency | Part 1 |
| `@tiptap/react` | ^2.x | dependency | Part 2 |
| `@tiptap/starter-kit` | ^2.x | dependency | Part 2 |
| `@tiptap/extension-link` | ^2.x | dependency | Part 2 |
| `@tiptap/pm` | ^2.x | dependency | Part 2 |
| `react-cropper` | ^2.x | dependency | Part 2 |
| `cropperjs` | ^1.x | dependency | Part 2 |
| `@hello-pangea/dnd` | ^16.x | dependency | Part 2 |
| `@tailwindcss/typography` | ^0.5.x | devDependency | Part 2 (if not already installed) |

---

*Part 2 complete.*

---

## Part 3: Hackathon List + Management

**PRD Requirements Covered:** P3.R1 through P3.R13

---

### 3.1 Dependencies (New for Part 3)

No new npm dependencies for Part 3. All required packages are already installed from Parts 1–2 (shadcn/ui components, Lucide icons, Sonner toasts, etc.).

New shadcn/ui components to generate if not already present:

```bash
npx shadcn@latest add dropdown-menu   # Already present from Phase 1
npx shadcn@latest add popover         # For date filter popovers
npx shadcn@latest add calendar        # For date picker (uses react-day-picker)
npx shadcn@latest add command         # For searchable filter dropdowns (optional)
npx shadcn@latest add alert-dialog    # For delete confirmation
```

Check if `popover`, `calendar`, and `alert-dialog` already exist before running. If they do, skip.

---

### 3.2 Check-on-Access: Automated Status Transitions (P3.R13)

**Decision: Check-on-access only (no cron job).** The daily cron job described in the PRD is deferred to V2. For V1 with a single customer (InMobi), every hackathon that matters will be visited regularly by admins or participants, making check-on-access sufficient.

**New file: `src/lib/services/hackathon-lifecycle.ts`**

This file is a standalone module. It contains the status resolution logic and is called by the service layer — it does not import from `next/server` or any framework-specific module.

```typescript
import { eq, and, isNull, lte } from 'drizzle-orm';

import { db } from '@/db';
import { hackathons, phases } from '@/db/schema';
import type { Hackathon, Phase } from '@/db/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status transitions that can happen automatically based on dates */
type AutoTransitionableStatus = 'published' | 'active' | 'judging';

/** Result of a status resolution check */
interface StatusResolution {
  hackathonChanged: boolean;
  newHackathonStatus?: Hackathon['status'];
  phaseChanges: Array<{ phaseId: string; newStatus: Phase['status'] }>;
}

// ---------------------------------------------------------------------------
// Valid auto-transitions (date-driven only — never draft→published)
// ---------------------------------------------------------------------------

const AUTO_TRANSITIONS: Record<AutoTransitionableStatus, Hackathon['status']> = {
  published: 'active',
  active: 'judging',
  judging: 'completed',
};

// ---------------------------------------------------------------------------
// Core: Resolve hackathon + phase statuses based on current time
// ---------------------------------------------------------------------------

/**
 * Compares a hackathon's phase dates against the current time and determines
 * if any status transitions are due. Does NOT write to the database — returns
 * what needs to change so the caller can decide when to persist.
 *
 * Rules:
 * 1. Phase-level: if now >= phase.end_date and phase is 'active' → 'completed'.
 *    If now >= phase.start_date and now < phase.end_date and phase is 'upcoming' → 'active'.
 * 2. Hackathon-level:
 *    - 'published' → 'active': when the first phase's start_date has passed.
 *    - 'active' → 'judging': when all non-judging/non-results phases are completed
 *      AND a judging phase exists and its start_date has passed.
 *    - 'judging' → 'completed': when the last phase's end_date has passed.
 * 3. 'draft' → 'published' is NEVER automatic (manual admin action only).
 * 4. 'completed' → 'archived' is NEVER automatic (manual admin action only).
 */
export function resolveStatuses(
  hackathon: Hackathon,
  hackathonPhases: Phase[],
  now: Date = new Date(),
): StatusResolution {
  const result: StatusResolution = {
    hackathonChanged: false,
    phaseChanges: [],
  };

  // Skip statuses that don't auto-transition
  if (hackathon.status === 'draft' || hackathon.status === 'completed' || hackathon.status === 'archived') {
    return result;
  }

  // Sort phases by order for reliable processing
  const sortedPhases = [...hackathonPhases].sort((a, b) => a.order - b.order);

  // --- Phase-level transitions ---
  for (const phase of sortedPhases) {
    if (!phase.startDate || !phase.endDate) continue;

    const start = new Date(phase.startDate);
    const end = new Date(phase.endDate);

    if (phase.status === 'upcoming' && now >= start && now < end) {
      result.phaseChanges.push({ phaseId: phase.id, newStatus: 'active' });
    } else if (phase.status === 'upcoming' && now >= end) {
      // Phase was missed entirely (start and end both passed while 'upcoming')
      result.phaseChanges.push({ phaseId: phase.id, newStatus: 'completed' });
    } else if (phase.status === 'active' && now >= end) {
      result.phaseChanges.push({ phaseId: phase.id, newStatus: 'completed' });
    }
  }

  // --- Hackathon-level transitions ---
  // Apply phase changes in-memory to evaluate hackathon status
  const effectivePhases = sortedPhases.map((p) => {
    const change = result.phaseChanges.find((c) => c.phaseId === p.id);
    return change ? { ...p, status: change.newStatus } : p;
  });

  const firstPhase = effectivePhases[0];
  const lastPhase = effectivePhases[effectivePhases.length - 1];

  if (hackathon.status === 'published' && firstPhase?.startDate) {
    // published → active: first phase has started
    if (now >= new Date(firstPhase.startDate)) {
      result.hackathonChanged = true;
      result.newHackathonStatus = 'active';
    }
  } else if (hackathon.status === 'active') {
    // active → judging: look for a judging phase whose start_date has passed
    const judgingPhase = effectivePhases.find((p) => p.type === 'judging');
    if (judgingPhase?.startDate && now >= new Date(judgingPhase.startDate)) {
      result.hackathonChanged = true;
      result.newHackathonStatus = 'judging';
    }
  } else if (hackathon.status === 'judging' && lastPhase?.endDate) {
    // judging → completed: last phase has ended
    if (now >= new Date(lastPhase.endDate)) {
      result.hackathonChanged = true;
      result.newHackathonStatus = 'completed';
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Apply: Persist resolved status changes to the database
// ---------------------------------------------------------------------------

/**
 * Runs resolveStatuses() and writes any changes to the database.
 * Returns the (possibly updated) hackathon status.
 *
 * Call this from getHackathonBySlug, getHackathonById, and
 * getHackathonsByOrgId before returning results.
 */
export async function applyStatusResolution(
  hackathon: Hackathon,
  hackathonPhases: Phase[],
): Promise<{ hackathonStatus: Hackathon['status']; phasesChanged: boolean }> {
  const resolution = resolveStatuses(hackathon, hackathonPhases);

  let phasesChanged = false;

  // Apply phase changes
  if (resolution.phaseChanges.length > 0) {
    phasesChanged = true;
    for (const change of resolution.phaseChanges) {
      await db
        .update(phases)
        .set({ status: change.newStatus, updatedAt: new Date() })
        .where(eq(phases.id, change.phaseId));
    }
    console.log('[hackathon-lifecycle] Phase statuses updated:', resolution.phaseChanges);
  }

  // Apply hackathon status change
  if (resolution.hackathonChanged && resolution.newHackathonStatus) {
    await db
      .update(hackathons)
      .set({ status: resolution.newHackathonStatus, updatedAt: new Date() })
      .where(eq(hackathons.id, hackathon.id));

    console.log('[hackathon-lifecycle] Hackathon status updated:', {
      id: hackathon.id,
      from: hackathon.status,
      to: resolution.newHackathonStatus,
    });

    return { hackathonStatus: resolution.newHackathonStatus, phasesChanged };
  }

  return { hackathonStatus: hackathon.status, phasesChanged };
}
```

**Integration into `hackathon-service.ts`:**

Modify three existing functions to call `applyStatusResolution` after fetching:

1. **`getHackathonById`** — after fetching the hackathon and relations, call `applyStatusResolution(hackathon, relations.phases)`. If the hackathon status changed, update the returned object. If phases changed, re-fetch phases to return the updated statuses.

2. **`getHackathonBySlug`** — same pattern as above.

3. **`getHackathonsByOrgId`** — for each hackathon in the list, fetch its phases and call `applyStatusResolution`. Since this is a list view, optimize by only fetching phases for hackathons with status in `['published', 'active', 'judging']` (the only statuses that auto-transition). Drafts, completed, and archived are skipped.

**Example modification to `getHackathonById`:**

```typescript
import { applyStatusResolution } from './hackathon-lifecycle';

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

  let relations = await fetchHackathonRelations(hackathon.id);

  // Check-on-access: resolve status based on current date
  const { hackathonStatus, phasesChanged } = await applyStatusResolution(
    hackathon,
    relations.phases,
  );

  // If phases changed, re-fetch to get updated statuses
  if (phasesChanged) {
    relations = await fetchHackathonRelations(hackathon.id);
  }

  return {
    hackathon: { ...hackathon, status: hackathonStatus },
    ...relations,
  };
}
```

**Example modification to `getHackathonsByOrgId`:**

```typescript
import { applyStatusResolution } from './hackathon-lifecycle';

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

  // Check-on-access for auto-transitionable statuses only
  const autoTransitionable = ['published', 'active', 'judging'];
  const resolved = await Promise.all(
    result.map(async (h) => {
      if (!autoTransitionable.includes(h.status)) return h;

      const hackathonPhases = await db.query.phases.findMany({
        where: eq(phases.hackathonId, h.id),
        orderBy: phases.order,
      });

      const { hackathonStatus } = await applyStatusResolution(h, hackathonPhases);
      return { ...h, status: hackathonStatus };
    }),
  );

  return resolved;
}
```

**Why a separate file?** The lifecycle logic is pure — it takes data in, returns decisions out. `resolveStatuses` is independently testable without touching the database. `applyStatusResolution` is the side-effecting wrapper. This separation makes it easy to add unit tests and to reuse the resolution logic if a cron job is added in V2.

---

### 3.3 New API Routes (P3.R6, P3.R7)

Two new API routes are needed for Part 3 actions.

**New file: `src/app/api/hackathons/[hackathonId]/transition/route.ts`**

```typescript
import { NextResponse } from 'next/server';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { transitionStatusSchema } from '@/lib/validations/hackathon';
import { transitionHackathonStatus } from '@/lib/services/hackathon-service';

/**
 * POST /api/hackathons/[hackathonId]/transition — Manually transition hackathon status
 *
 * Body: { orgId: string, targetStatus: 'published' | 'archived' }
 *
 * Only two manual transitions are allowed:
 *   - draft → published (delegates to publishHackathon() for validation)
 *   - completed → archived
 *
 * Middle-state transitions (published→active, active→judging, judging→completed)
 * are date-driven via check-on-access and cannot be triggered manually.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;
  console.log('[api/hackathons/[id]/transition] POST:', { hackathonId });

  try {
    const body = await request.json();
    const { orgId, ...data } = body;

    if (!orgId) {
      return NextResponse.json(
        { message: 'Organization ID is required.' },
        { status: 400 },
      );
    }

    // Only org_admin can transition statuses
    const authResult = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
    if ('error' in authResult) return authResult.error;

    const parsed = transitionStatusSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await transitionHackathonStatus({
      hackathonId,
      orgId,
      targetStatus: parsed.data.targetStatus,
    });

    if (!result.success) {
      if (result.error === 'HACKATHON_NOT_FOUND') {
        return NextResponse.json({ message: 'Hackathon not found.' }, { status: 404 });
      }
      return NextResponse.json({ message: result.error ?? 'Transition failed.' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Status updated.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    console.error('[api/hackathons/[id]/transition] POST error:', message);
    return NextResponse.json({ message }, { status: 500 });
  }
}
```

**New file: `src/app/api/hackathons/[hackathonId]/delete/route.ts`**

```typescript
import { NextResponse } from 'next/server';

import { requireOrgRole } from '@/lib/auth/require-org-role';
import { softDeleteHackathon } from '@/lib/services/hackathon-service';

/**
 * POST /api/hackathons/[hackathonId]/delete — Soft-delete a draft hackathon
 *
 * Body: { orgId: string }
 *
 * Only draft hackathons can be deleted.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;
  console.log('[api/hackathons/[id]/delete] POST:', { hackathonId });

  try {
    const body = await request.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json(
        { message: 'Organization ID is required.' },
        { status: 400 },
      );
    }

    // Only org_admin can delete
    const authResult = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
    if ('error' in authResult) return authResult.error;

    const result = await softDeleteHackathon({ hackathonId, orgId });

    if (!result.success) {
      if (result.error === 'HACKATHON_NOT_FOUND') {
        return NextResponse.json({ message: 'Hackathon not found.' }, { status: 404 });
      }
      if (result.error === 'ONLY_DRAFTS_CAN_BE_DELETED') {
        return NextResponse.json(
          { message: 'Only draft hackathons can be deleted.' },
          { status: 400 },
        );
      }
      return NextResponse.json({ message: result.error ?? 'Delete failed.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Hackathon deleted.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    console.error('[api/hackathons/[id]/delete] POST error:', message);
    return NextResponse.json({ message }, { status: 500 });
  }
}
```

**Note:** The existing `transitionHackathonStatus` and `softDeleteHackathon` functions in `hackathon-service.ts` already contain all the business logic. These API routes are thin wrappers that add auth checks and HTTP formatting.

---

### 3.4 Hackathon Stats Service Method (P3.R12)

**Add to `src/lib/services/hackathon-service.ts`:**

```typescript
// ---------------------------------------------------------------------------
// Get Hackathon Stats (P3.R12 — dashboard stat cards)
// ---------------------------------------------------------------------------

export interface HackathonStats {
  total: number;
  active: number;
  draft: number;
}

export async function getHackathonStats(orgId: string): Promise<HackathonStats> {
  console.log('[hackathon-service] getHackathonStats:', { orgId });

  const allHackathons = await db.query.hackathons.findMany({
    where: and(
      eq(hackathons.orgId, orgId),
      isNull(hackathons.deletedAt),
    ),
    columns: { id: true, status: true },
  });

  return {
    total: allHackathons.length,
    active: allHackathons.filter((h) => h.status === 'active').length,
    draft: allHackathons.filter((h) => h.status === 'draft').length,
  };
}
```

**Why not SQL COUNT?** For V1 with small hackathon counts per org (likely under 50), fetching all and counting in JS is simpler, avoids multiple queries, and is fast enough. If counts grow to hundreds, this can be refactored to SQL aggregate queries.

---

### 3.5 Hackathon List Page (P3.R1 – P3.R6, P3.R9 – P3.R11)

**Replace: `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/page.tsx`**

The current page is a placeholder. Replace it entirely with a server component that fetches hackathon data and renders the list.

```typescript
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { getOrgBySlug, checkUserOrgRole } from '@/lib/services/org-service';
import { getHackathonsByOrgId } from '@/lib/services/hackathon-service';
import { HackathonList } from './_components/hackathon-list';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Hackathons — ${orgSlug} — HackForge` };
}

export default async function HackathonsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect('/dashboard');
  }

  // Fetch with archived for filtering
  const hackathons = await getHackathonsByOrgId({
    orgId: org.id,
    includeArchived: true,
  });

  // Determine user role for permission gating
  const orgRole = await checkUserOrgRole({
    userId: session.user.id,
    orgId: org.id,
  });

  const isAdmin = orgRole?.role === 'org_admin';

  return (
    <div className="space-y-6">
      <HackathonList
        hackathons={hackathons}
        orgSlug={orgSlug}
        orgId={org.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
```

**Key notes:**
- Fetches with `includeArchived: true` because the client-side filter needs access to all statuses.
- Passes `isAdmin` boolean to the client component so it can show/hide admin actions.
- `getHackathonsByOrgId` now runs check-on-access (from Section 3.2), so statuses are auto-resolved before rendering.

---

### 3.6 Hackathon List Client Component (P3.R1 – P3.R6, P3.R9 – P3.R11)

**New file: `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/_components/hackathon-list.tsx`**

This is the main client component for the hackathon management page. It handles search, filters, and actions.

```typescript
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Trophy,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  ExternalLink,
  ArrowRight,
  Archive,
  Trash2,
  Calendar,
  Filter,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { Hackathon } from '@/lib/services/hackathon-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HackathonListProps {
  hackathons: Hackathon[];
  orgSlug: string;
  orgId: string;
  isAdmin: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'active', label: 'Active' },
  { value: 'judging', label: 'Judging' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
] as const;

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  published: 'default',
  active: 'default',
  judging: 'default',
  completed: 'outline',
  archived: 'outline',
};

/**
 * Manual transitions only — middle states (published→active, active→judging,
 * judging→completed) are date-driven via check-on-access. Admins who want to
 * influence timing should edit the hackathon's phase dates.
 */
const MANUAL_TRANSITIONS: Record<string, { label: string; target: string } | undefined> = {
  draft: { label: 'Publish', target: 'published' },
  completed: { label: 'Archive', target: 'archived' },
};

// ... (component implementation follows)
```

**Component structure:**

The `HackathonList` component contains:

1. **Header row:** Title "Hackathons" + "Create Hackathon" button (visible only if `isAdmin`).
2. **Filter bar:** Search input (filters by title, client-side) + status pill selector + date range pickers ("Created after" / "Created before").
3. **Hackathon cards grid:** Responsive grid (`sm:grid-cols-2 lg:grid-cols-3`) of hackathon cards.
4. **Empty state:** When no hackathons match filters (or none exist at all).

**Each hackathon card shows:**
- Cover image thumbnail (or a gradient placeholder using `templateType` as seed for color).
- Title (truncated if long).
- Status badge (color-coded using `STATUS_BADGE_VARIANT`).
- Template type (human-readable label, e.g., "Build & Ship").
- Created date (formatted with `Intl.DateTimeFormat`).
- Participant count placeholder ("0 participants").
- Three-dot context menu (admin only).

**Context menu actions (admin only):**

| Action | Condition | Behavior |
|--------|-----------|----------|
| Edit | Always (admin) | Navigate to `/dashboard/[orgSlug]/hackathons/[hackathonId]/edit` |
| View Landing Page | Status is not `draft` | Open `/hackathons/[slug]` in new tab |
| Publish | Status is `draft` | Call `POST /api/hackathons/[id]/transition` with `targetStatus: 'published'` → refresh |
| Archive | Status is `completed` | Call `POST /api/hackathons/[id]/transition` with `targetStatus: 'archived'` → refresh |
| Delete | Status is `draft` | Show AlertDialog confirmation → Call `POST /api/hackathons/[id]/delete` → refresh |

**Note:** Middle-state transitions (published→active, active→judging, judging→completed) are **not** shown in the context menu. These are date-driven and handled automatically by the check-on-access lifecycle engine. Admins who want to influence timing should edit the hackathon's phase dates via the Edit action.

**Filtering logic (client-side, P3.R2 – P3.R4):**

```typescript
const filtered = useMemo(() => {
  let result = hackathons;

  // Status filter (default: 'all' excludes archived)
  if (statusFilter === 'all') {
    result = result.filter((h) => h.status !== 'archived');
  } else {
    result = result.filter((h) => h.status === statusFilter);
  }

  // Search filter (by title, case-insensitive)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter((h) => h.title.toLowerCase().includes(q));
  }

  // Date filter
  if (dateFrom) {
    result = result.filter((h) => new Date(h.createdAt) >= dateFrom);
  }
  if (dateTo) {
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    result = result.filter((h) => new Date(h.createdAt) <= endOfDay);
  }

  return result;
}, [hackathons, statusFilter, searchQuery, dateFrom, dateTo]);
```

**API call helper within the component:**

```typescript
async function handleTransition(hackathonId: string, targetStatus: string) {
  try {
    const res = await fetch(`/api/hackathons/${hackathonId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, targetStatus }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.message ?? 'Failed to update status.');
      return;
    }

    toast.success('Status updated.');
    router.refresh(); // Re-run server component to get fresh data
  } catch {
    toast.error('Something went wrong.');
  }
}

async function handleDelete(hackathonId: string) {
  try {
    const res = await fetch(`/api/hackathons/${hackathonId}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.message ?? 'Failed to delete hackathon.');
      return;
    }

    toast.success('Draft deleted.');
    router.refresh();
  } catch {
    toast.error('Something went wrong.');
  }
}
```

**Empty state (P3.R9):**

```tsx
{filtered.length === 0 && (
  <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center">
    <Trophy className="size-10 text-muted-foreground" />
    <h2 className="mt-4 text-lg font-semibold">
      {hackathons.length === 0 ? 'No hackathons yet' : 'No hackathons match your filters'}
    </h2>
    <p className="mt-1 text-sm text-muted-foreground">
      {hackathons.length === 0
        ? 'Create your first hackathon to get started.'
        : 'Try adjusting your search or filters.'}
    </p>
    {hackathons.length === 0 && isAdmin && (
      <Button asChild className="mt-4">
        <Link href={`/dashboard/${orgSlug}/hackathons/create`}>
          <Plus className="mr-2 size-4" />
          Create your first hackathon
        </Link>
      </Button>
    )}
  </div>
)}
```

**Member vs Admin view (P3.R11):**

- `member` sees the same list and filters but:
  - No "Create Hackathon" button.
  - No three-dot context menu on cards.
  - Can click a card title to view the landing page (if not draft).
- `isAdmin` prop controls all of these visibility toggles.

---

### 3.7 Org Dashboard Update (P3.R12)

**Modify: `src/app/(dashboard)/dashboard/[orgSlug]/page.tsx`**

Replace the hardcoded stat values with real data from `getHackathonStats`:

```typescript
import { redirect } from 'next/navigation';
import { Trophy, Users, Calendar } from 'lucide-react';

import { auth } from '@/lib/auth/auth';
import { getOrgBySlug } from '@/lib/services/org-service';
import { getHackathonStats } from '@/lib/services/hackathon-service';
import { StatCard } from './_components/stat-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return { title: `Dashboard — ${orgSlug} — HackForge` };
}

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    redirect('/dashboard');
  }

  const stats = await getHackathonStats(org.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Hackathons"
          value={stats.total}
          icon={<Trophy className="size-5" />}
        />
        <StatCard
          title="Active"
          value={stats.active}
          icon={<Calendar className="size-5" />}
        />
        <StatCard
          title="Drafts"
          value={stats.draft}
          icon={<Users className="size-5" />}
        />
      </div>
    </div>
  );
}
```

**Changes from current implementation:**
- Imports `auth`, `getOrgBySlug`, and `getHackathonStats`.
- Resolves org from slug to get `org.id`.
- Calls `getHackathonStats(org.id)` for real counts.
- Replaces the hardcoded "0" values and "None" with `stats.total`, `stats.active`, `stats.draft`.
- Changes the third stat card from "Upcoming" / "None" to "Drafts" / count (more actionable for admin — "you have X drafts to finish").
- Updates icons: second card becomes `Calendar` (active), third becomes a relevant icon for drafts.

**Note on the "Participants" stat:** Participant count requires the `registrations` table from Phase 3. It's replaced with "Drafts" for now and will become "Participants" once Phase 3 (Registration & Teams) is implemented.

---

### 3.8 Edit Published Hackathon Restrictions (P3.R8)

The edit page already exists at `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/[hackathonId]/edit/page.tsx` and reuses `WizardShell` with the `hackathon` prop (from Part 2).

**What Part 3 adds:** When editing a **published** (or later-stage) hackathon, certain fields are locked:

1. **Template (Step 1):** Already locked in edit mode — `WizardShell` renders Step 1 as read-only with a lock notice when `hackathon` prop is provided.
2. **Phase structure (Step 4):** Phases cannot be added, removed, or reordered. Only dates and names can be edited. This is already the behavior (the wizard only shows date pickers for existing phases, no add/remove UI).

**Modification to `WizardShell`:** Add a prop `isPublished` (derived from `hackathon.hackathon.status !== 'draft'`) that the wizard passes to step components. Steps that need to restrict editing for published hackathons can check this prop. For V1, the current behavior already satisfies this requirement since:
- Step 1 is already read-only in edit mode.
- Steps 2, 3, 5, 6, 7 allow editing (PRD says published hackathons can edit title, description, tracks, prizes, rules).
- Step 4 already only allows date/name editing (no structural changes).

**No code changes needed** — the existing wizard behavior already satisfies P3.R8. Document this as a verification item.

---

### 3.9 Loading State (P3.R10)

**New file: `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/loading.tsx`**

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export default function HackathonsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-44" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Card grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-32 w-full rounded-md" />
            <Skeleton className="h-5 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

This is a Next.js loading convention file. It renders automatically while the server component is fetching data.

---

### 3.10 Implementation Increments

Part 3 should be implemented in the following order:

---

**Increment 3A: Check-on-access lifecycle engine**

- Create `src/lib/services/hackathon-lifecycle.ts` with `resolveStatuses()` and `applyStatusResolution()`
- Modify `getHackathonById()` in `hackathon-service.ts` to call `applyStatusResolution` after fetch
- Modify `getHackathonBySlug()` in `hackathon-service.ts` to call `applyStatusResolution` after fetch
- Modify `getHackathonsByOrgId()` in `hackathon-service.ts` to call `applyStatusResolution` for auto-transitionable statuses

**Verify:**
- Create a hackathon, publish it, set the first phase start_date to the past → on next fetch, status should auto-transition to `active`
- Set a phase's end_date to the past → on next fetch, phase status should flip to `completed` and next phase to `active`
- Draft hackathons are never auto-transitioned
- Completed and archived hackathons are never auto-transitioned

---

**Increment 3B: API routes + stats service method**

- Create `src/app/api/hackathons/[hackathonId]/transition/route.ts`
- Create `src/app/api/hackathons/[hackathonId]/delete/route.ts`
- Add `getHackathonStats()` to `hackathon-service.ts`

**Verify:**
- `POST /api/hackathons/[id]/transition` with `{ orgId, targetStatus: 'active' }` on a published hackathon returns 200
- Invalid transition (e.g., draft → active) returns 400
- `POST /api/hackathons/[id]/delete` on a draft returns 200; on a published returns 400
- Non-admin gets 403 on both routes
- `getHackathonStats` returns correct counts

---

**Increment 3C: Hackathon list page**

- Replace `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/page.tsx` with the server component
- Create `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/_components/hackathon-list.tsx` (client component)
- Create `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/loading.tsx`
- Add any missing shadcn/ui components (`alert-dialog`, `popover`, `calendar`)

**Verify:**
- Hackathon list renders all org hackathons with correct info
- Search filters by title in real-time
- Status filter works; "All" excludes archived; "Archived" shows only archived
- Date filter narrows by creation date
- "Create Hackathon" button visible only for admin
- Context menu actions work: Edit navigates, View opens new tab, Publish/Transition/Archive/Delete call APIs and refresh
- Delete shows confirmation dialog before executing
- Empty state shows when no hackathons exist
- Empty state shows "no matches" message when filters return zero results
- Loading skeleton renders during data fetch
- Member role sees list but no admin actions

---

**Increment 3D: Dashboard stat cards**

- Modify `src/app/(dashboard)/dashboard/[orgSlug]/page.tsx` to fetch real stats
- Wire stat cards to `getHackathonStats()` data

**Verify:**
- Dashboard shows correct total/active/draft hackathon counts
- Counts update after creating, publishing, or deleting a hackathon

---

### 3.11 Files Changed Summary

| File | Action | Requirement |
|------|--------|-------------|
| `src/lib/services/hackathon-lifecycle.ts` | Created | P3.R13 |
| `src/lib/services/hackathon-service.ts` | Modified | P3.R12, P3.R13 (check-on-access integration + getHackathonStats) |
| `src/app/api/hackathons/[hackathonId]/transition/route.ts` | Created | P3.R6, P3.R7 |
| `src/app/api/hackathons/[hackathonId]/delete/route.ts` | Created | P3.R6 |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/page.tsx` | Replaced | P3.R1, P3.R11 |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/_components/hackathon-list.tsx` | Created | P3.R1–P3.R6, P3.R9, P3.R11 |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/loading.tsx` | Created | P3.R10 |
| `src/app/(dashboard)/dashboard/[orgSlug]/page.tsx` | Modified | P3.R12 |
| `src/components/ui/alert-dialog.tsx` | Created (shadcn generate) | P3.R6 (delete confirmation) |
| `src/components/ui/popover.tsx` | Created (shadcn generate, if missing) | P3.R4 (date filter) |
| `src/components/ui/calendar.tsx` | Created (shadcn generate, if missing) | P3.R4 (date filter) |

---

### 3.12 Deferred from Part 3

| Item | Reason | Target |
|------|--------|--------|
| Daily cron job for stale status updates | Check-on-access is sufficient for V1 with single customer | V2 |
| Server-side search/pagination | Client-side filtering is sufficient for small hackathon counts per org | V2 (when count exceeds ~100) |
| Bulk actions (archive multiple, delete multiple) | Not critical for V1 | V2 |

---

*Part 3 complete. Part 4 (Public Hackathon Landing Page) will be written after Part 3 is approved and implemented.*
