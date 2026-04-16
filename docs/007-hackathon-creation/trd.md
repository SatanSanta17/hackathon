# TRD — Phase 2: Hackathon Creation + Landing Page

**Document ID:** TRD-007  
**Date:** April 16, 2026  
**Author:** Burhanuddin C.  
**Status:** Draft — Part 1 Written  
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

*Part 1 complete. Parts 2–4 will be written after Part 1 is approved and implemented.*
