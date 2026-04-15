# TRD — Phase 1: Foundation + Auth

**Document ID:** TRD-006  
**Date:** April 16, 2026  
**Author:** Burhanuddin C.  
**Status:** Draft — Part 1 Written  
**PRD Reference:** `docs/006-foundation-auth/prd.md`  
**Architecture Reference:** `docs/004-architecture.md`  
**Conventions Reference:** `docs/003-coding-conventions.md`

---

## Part 1: Project Scaffolding + Database Schema

**PRD Requirements Covered:** P1.R1 through P1.R12

---

### 1.1 Project Initialization (P1.R1)

**Command sequence:**

```bash
npx create-next-app@latest hackforge --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**Post-init configuration:**

- Enable TypeScript strict mode in `tsconfig.json` (`"strict": true`)
- Configure path aliases: `@/*` maps to `src/*`
- Set Node engine in `package.json`: `"engines": { "node": ">=18.17.0" }`

**Resulting key files:**

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout (html, body, global providers) |
| `src/app/page.tsx` | Landing page (temporary — will be replaced) |
| `next.config.js` | Next.js configuration |
| `tsconfig.json` | TypeScript config with strict mode |
| `tailwind.config.ts` | Tailwind configuration |
| `postcss.config.js` | PostCSS config for Tailwind |

---

### 1.2 Tailwind CSS + shadcn/ui + Dual-Tone Design System (P1.R2)

**shadcn/ui initialization:**

```bash
npx shadcn-ui@latest init
```

Configuration choices:
- Style: Default
- Base color: Slate
- CSS variables: Yes
- Tailwind config: `tailwind.config.ts`
- Components directory: `src/components/ui`
- Utils directory: `src/lib/utils.ts`

**Initial shadcn/ui components to install** (needed by Part 1 and forward-compatible with Parts 2–3):

```bash
npx shadcn-ui@latest add button card input label form toast sonner
```

**Dual-tone design tokens in `src/app/globals.css`:**

The design system defines two visual modes via CSS custom properties under `:root` and a `.theme-competitive` class:

**Admin mode (`:root` — default):**
- Light background (`--background: 0 0% 100%`) with neutral greys
- Professional, clean, high-contrast palette
- Readable typography, functional spacing
- Accent color for CTAs and interactive elements (e.g., indigo/blue family)

**Competitive mode (`.theme-competitive`):**
- Dark background (`--background: 222 47% 6%`) 
- Neon/vibrant accent colors (e.g., electric green `--accent: 142 71% 45%`, cyan, magenta)
- Bold, high-energy feel — strong contrast between background and foreground
- Larger, bolder heading typography

**Token categories defined:**

| Category | Custom Properties |
|----------|-----------------|
| Colors | `--background`, `--foreground`, `--card`, `--card-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring` |
| Radius | `--radius` (admin: `0.5rem`, competitive: `0.75rem`) |

**How modes are applied:**
- Admin pages use the default `:root` tokens (no class needed)
- Participant-facing layouts (Phase 2+) wrap content in a `<div className="theme-competitive">` to switch tokens
- All shadcn/ui components automatically pick up the correct tokens since they use CSS variables

**Tailwind config extensions (`tailwind.config.ts`):**

- Extend `fontFamily` with a system font stack plus a bold display font for competitive headings
- Map CSS custom properties to Tailwind color utilities (shadcn/ui does this by default)
- No arbitrary pixel values — all spacing uses Tailwind's scale

---

### 1.3 Drizzle ORM Setup (P1.R3)

**Dependencies:**

```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

**`postgres` driver** (not `pg`) — the `postgres` package is a modern, lightweight Postgres driver well-suited for serverless. It supports both pooled and direct connections.

**Drizzle client — `src/db/index.ts`:**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  prepare: false, // required for Supabase connection pooling (PgBouncer)
});

export const db = drizzle(client, { schema });
```

**Drizzle config — `drizzle.config.ts` (project root):**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL!, // direct connection for migrations (bypasses PgBouncer)
  },
});
```

**Why two connection strings:**
- `DATABASE_URL` — pooled connection via Supabase's PgBouncer. Used at runtime by the app. Requires `prepare: false`.
- `DIRECT_URL` — direct Postgres connection. Used only by Drizzle Kit for migrations (DDL statements don't work well through PgBouncer).

**npm scripts in `package.json`:**

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio"
}
```

---

### 1.4 Database Schema (P1.R4 – P1.R8)

All schema files live in `src/db/schema/`. Each domain entity has its own file. A barrel `index.ts` re-exports everything.

#### 1.4.1 Enums — `src/db/schema/enums.ts` (P1.R8)

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const platformRoleEnum = pgEnum('platform_role', ['user', 'super_admin']);
export const orgRoleEnum = pgEnum('org_role', ['org_admin', 'member']);
```

**Forward compatibility note:** Future phases will add more enums here: `hackathon_status`, `template_type`, `visibility`, `phase_type`, `phase_status`, `registration_status`, `team_role`, `submission_status`, `eval_status`, `notification_type`. The enums file is the single source of truth for all Postgres enums.

#### 1.4.2 Users — `src/db/schema/users.ts` (P1.R4)

```typescript
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { platformRoleEnum } from './enums';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url'),
  emailVerified: boolean('email_verified').notNull().default(false),
  platformRole: platformRoleEnum('platform_role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
```

**Indexes:** `email` has a unique constraint (implicit index). No additional indexes needed in Part 1.

#### 1.4.3 Organizations — `src/db/schema/organizations.ts` (P1.R5)

```typescript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
```

#### 1.4.4 Org Memberships — `src/db/schema/org-memberships.ts` (P1.R6)

```typescript
import { pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { orgRoleEnum } from './enums';
import { users } from './users';
import { organizations } from './organizations';

export const orgMemberships = pgTable('org_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  role: orgRoleEnum('role').notNull(),
  invitedAt: timestamp('invited_at', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }),
}, (table) => [
  index('org_memberships_user_id_idx').on(table.userId),
  index('org_memberships_org_id_idx').on(table.orgId),
]);
```

**Design decision:** No unique constraint on `(user_id, org_id)` at the DB level — enforced at the service layer. This avoids migration headaches if we later allow re-invites after removal.

#### 1.4.5 Org Invites — `src/db/schema/org-invites.ts` (P1.R7)

```typescript
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { orgRoleEnum } from './enums';
import { organizations } from './organizations';
import { users } from './users';

export const orgInvites = pgTable('org_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  email: text('email').notNull(),
  role: orgRoleEnum('role').notNull(),
  token: text('token').notNull().unique(),
  invitedBy: uuid('invited_by').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('org_invites_email_idx').on(table.email),
  index('org_invites_token_idx').on(table.token),
]);
```

#### 1.4.6 Verification Tokens — `src/db/schema/verification-tokens.ts` (Forward Compatibility for Part 2)

Part 2 (Authentication) requires storing email verification tokens and password reset tokens. The table is created now so that the initial migration includes everything and we avoid a second migration just for auth.

```typescript
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';

export const verificationTokens = pgTable('verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  token: text('token').notNull(), // stored as hash (bcrypt or sha256)
  type: text('type').notNull(), // 'email_verification' | 'password_reset'
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('verification_tokens_user_id_idx').on(table.userId),
]);
```

**Why included in Part 1:** The TRD must account for forward compatibility. Including this table in the initial migration avoids a disruptive schema change in Part 2. The table is not used until Part 2, but it exists and is ready.

#### 1.4.7 Barrel Export — `src/db/schema/index.ts`

```typescript
export * from './enums';
export * from './users';
export * from './organizations';
export * from './org-memberships';
export * from './org-invites';
export * from './verification-tokens';
```

---

### 1.5 Migration (P1.R9)

**Steps:**

1. Run `npm run db:generate` — Drizzle Kit reads the schema files and generates a SQL migration in `src/db/migrations/`.
2. Review the generated SQL — verify table names, column types, constraints, indexes, and enum definitions match the schema above.
3. Run `npm run db:migrate` — applies the migration to the Supabase Postgres database.
4. Verify via `npm run db:studio` — open Drizzle Studio to confirm all tables and enums exist.

**Migration naming:** Drizzle Kit auto-generates timestamped migration folders. Do not rename them.

---

### 1.6 Folder Structure (P1.R10)

The following directories and files are created in Part 1. Only what's built in this part is listed — no placeholders for future phases.

```
hackforge/
├── .env.example                          # Environment variable template
├── .env.local                            # Local env (gitignored)
├── .gitignore
├── CLAUDE.md
├── CHANGELOG.md
├── docs/                                 # Existing documentation
│   ├── 000-project-context.md
│   ├── 001-technical-decisions.md
│   ├── 002-v1-development-phases.md
│   ├── 003-coding-conventions.md
│   ├── 004-architecture.md
│   ├── 005-development-workflow.md
│   └── 006-foundation-auth/
│       ├── prd.md
│       └── trd.md
├── drizzle.config.ts                     # Drizzle Kit configuration
├── next.config.js                        # Next.js configuration
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── src/
    ├── app/
    │   ├── globals.css                   # Dual-tone design tokens + Tailwind base
    │   ├── layout.tsx                    # Root layout (fonts, metadata, Toaster)
    │   └── page.tsx                      # Temporary landing page
    ├── components/
    │   └── ui/                           # shadcn/ui primitives (button, card, input, label, form, toast)
    ├── db/
    │   ├── index.ts                      # Drizzle client instance
    │   ├── schema/
    │   │   ├── index.ts                  # Barrel export
    │   │   ├── enums.ts                  # platform_role, org_role
    │   │   ├── users.ts                  # users table
    │   │   ├── organizations.ts          # organizations table
    │   │   ├── org-memberships.ts        # org_memberships table
    │   │   ├── org-invites.ts            # org_invites table
    │   │   └── verification-tokens.ts    # verification_tokens table (for Part 2)
    │   └── migrations/                   # Generated by drizzle-kit
    ├── lib/
    │   ├── utils.ts                      # cn() helper (installed by shadcn/ui)
    │   └── validations/                  # Directory created; schemas added in Part 2+
    └── types/                            # Directory created; types added in Part 2+
```

**Directories created but empty** (ready for future parts): `src/lib/auth/`, `src/lib/email/`, `src/lib/hooks/`, `src/lib/services/`, `src/lib/storage/`, `src/app/(auth)/`, `src/app/(dashboard)/`, `src/app/api/`.

---

### 1.7 Environment Variables (P1.R11)

**`.env.example`:**

```bash
# =========================
# Database (Supabase Postgres)
# =========================
# Pooled connection — used at runtime by the app
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
# Direct connection — used by Drizzle Kit for migrations only
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# =========================
# Auth (NextAuth.js)
# =========================
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET="your-random-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# =========================
# App
# =========================
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# =========================
# Email (Resend)
# =========================
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
FROM_EMAIL="HackForge <noreply@yourdomain.com>"
```

---

### 1.8 Guided Setup Instructions (P1.R12)

These instructions are for the developer (Burhanuddin) to follow manually. They are NOT automated.

#### Supabase Postgres Setup

1. Go to [supabase.com](https://supabase.com) and open your project (or create one).
2. Navigate to **Project Settings → Database**.
3. Under **Connection string**, select **URI** format.
4. Copy the **pooled connection string** (port `6543`) → paste as `DATABASE_URL` in `.env.local`.
5. Copy the **direct connection string** (port `5432`) → paste as `DIRECT_URL` in `.env.local`.
6. Replace `[YOUR-PASSWORD]` in both strings with your database password.
7. Verify connection: run `npm run db:studio` — Drizzle Studio should open and show an empty database.

#### Resend Email Setup

1. Go to [resend.com](https://resend.com) and log in to your account.
2. Navigate to **API Keys** → create a new API key with "Sending access" permission.
3. Copy the API key → paste as `RESEND_API_KEY` in `.env.local`.
4. Navigate to **Domains** → add and verify your sending domain (for production). For development, Resend allows sending from `onboarding@resend.dev` without domain verification.
5. Set `FROM_EMAIL` in `.env.local` to your verified sender address (or `HackForge <onboarding@resend.dev>` for development).

#### NextAuth Secret

1. Run: `openssl rand -base64 32`
2. Copy the output → paste as `NEXTAUTH_SECRET` in `.env.local`.

---

### 1.9 Implementation Increments

Part 1 is implemented in 3 increments. Each increment is a self-contained, pushable commit.

#### Increment 1: Project Init + Tailwind + shadcn/ui

**What:** Scaffold the Next.js project, configure Tailwind, install shadcn/ui, define the dual-tone design tokens in `globals.css`.

**Files created/modified:**
- All root config files (`next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `package.json`)
- `src/app/globals.css` — dual-tone design tokens
- `src/app/layout.tsx` — root layout with fonts and metadata
- `src/app/page.tsx` — temporary landing page
- `src/components/ui/*` — shadcn/ui components
- `src/lib/utils.ts` — `cn()` helper

**Verify:** `npm run dev` starts successfully, temporary page renders with correct styling.

#### Increment 2: Database Schema + Migration

**What:** Install Drizzle, create all schema files, generate and apply the initial migration.

**Files created/modified:**
- `drizzle.config.ts`
- `src/db/index.ts`
- `src/db/schema/enums.ts`
- `src/db/schema/users.ts`
- `src/db/schema/organizations.ts`
- `src/db/schema/org-memberships.ts`
- `src/db/schema/org-invites.ts`
- `src/db/schema/verification-tokens.ts`
- `src/db/schema/index.ts`
- `src/db/migrations/*` (generated)
- `package.json` (new dependencies + scripts)

**Verify:** `npm run db:migrate` applies cleanly. `npm run db:studio` shows all 5 tables and 2 enums.

#### Increment 3: Folder Structure + Environment Config

**What:** Create remaining directory structure, `.env.example`, `.gitignore` updates, and empty placeholder directories for future parts.

**Files created/modified:**
- `.env.example`
- `.gitignore` (ensure `.env.local` is ignored)
- Empty directories: `src/lib/auth/`, `src/lib/email/`, `src/lib/hooks/`, `src/lib/services/`, `src/lib/storage/`, `src/lib/validations/`, `src/types/`, `src/app/(auth)/`, `src/app/(dashboard)/`, `src/app/api/`, `src/app/(public)/`

**Verify:** Folder structure matches section 1.6 above. `.env.example` contains all variables from section 1.7. `npx tsc --noEmit` passes with no errors.

---

### 1.10 Files Changed Summary

| File | Action | Requirement |
|------|--------|-------------|
| `next.config.js` | Created | P1.R1 |
| `tsconfig.json` | Created/Modified | P1.R1 |
| `tailwind.config.ts` | Created/Modified | P1.R2 |
| `postcss.config.js` | Created | P1.R2 |
| `package.json` | Modified | P1.R1, P1.R3 |
| `drizzle.config.ts` | Created | P1.R3 |
| `src/app/globals.css` | Modified | P1.R2 |
| `src/app/layout.tsx` | Modified | P1.R1, P1.R2 |
| `src/app/page.tsx` | Modified | P1.R1 |
| `src/components/ui/*` | Created | P1.R2 |
| `src/lib/utils.ts` | Created | P1.R2 |
| `src/db/index.ts` | Created | P1.R3 |
| `src/db/schema/enums.ts` | Created | P1.R8 |
| `src/db/schema/users.ts` | Created | P1.R4 |
| `src/db/schema/organizations.ts` | Created | P1.R5 |
| `src/db/schema/org-memberships.ts` | Created | P1.R6 |
| `src/db/schema/org-invites.ts` | Created | P1.R7 |
| `src/db/schema/verification-tokens.ts` | Created | Forward compat (Part 2) |
| `src/db/schema/index.ts` | Created | P1.R4–P1.R8 |
| `src/db/migrations/*` | Generated | P1.R9 |
| `.env.example` | Created | P1.R11 |

---

*Part 2 (Authentication) and Part 3 (Org Management + App Shell + Admin Panel) TRDs will be written after Part 1 implementation is complete, per the workflow convention of writing TRD parts one at a time.*
