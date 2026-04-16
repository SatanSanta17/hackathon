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

**Already completed.** The project was scaffolded with:

- **Next.js 16.2.3** with React 19, TypeScript, App Router, `src/` directory, `@/*` import alias
- **Tailwind CSS v4** — CSS-based configuration (no `tailwind.config.ts`), uses `@import "tailwindcss"` and `@theme inline` in `globals.css`
- **ESLint 9** with flat config (`eslint.config.mjs`)

**Post-init configuration:**

- Verify TypeScript strict mode is enabled in `tsconfig.json` (`"strict": true`)
- Set Node engine in `package.json`: `"engines": { "node": ">=18.17.0" }`

**Existing key files:**

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout (html, body, global providers) |
| `src/app/page.tsx` | Landing page (temporary — will be replaced) |
| `next.config.ts` | Next.js configuration (TypeScript) |
| `tsconfig.json` | TypeScript config with strict mode |
| `postcss.config.mjs` | PostCSS config for Tailwind v4 (`@tailwindcss/postcss`) |
| `eslint.config.mjs` | ESLint 9 flat config |
| `components.json` | shadcn configuration |

**Note:** Tailwind v4 does NOT use a `tailwind.config.ts` file. All theme customization is done via CSS using `@theme inline` in `src/app/globals.css`.

---

### 1.2 Tailwind CSS + shadcn + Dual-Tone Design System (P1.R2)

**shadcn initialization (already completed):**

```bash
npx shadcn@latest init
```

Configuration (from `components.json`):
- Style: `radix-nova`
- Base color: `neutral`
- CSS variables: Yes
- Icon library: `lucide`
- Component library: Radix
- Components directory: `@/components/ui`
- Utils directory: `@/lib/utils`

**Additional shadcn components to install** (forward-compatible with Parts 2–3):

```bash
npx shadcn@latest add card input label sonner
```

Note: `button` and `utils` were already created during init. The `form` and `toast` components are **not available** in the radix-nova style. Instead:
- **Toasts:** Sonner is the toast solution for this preset (already installed and configured with `next-themes` integration).
- **Forms:** `react-hook-form` + `@hookform/resolvers` + `zod` are installed as direct dependencies. Form components are built using the existing `input` and `label` primitives with react-hook-form bindings. Custom form wrapper components will be created in Part 2 as needed.

**Additional dependencies installed:**

```bash
npm install react-hook-form @hookform/resolvers zod
```

**Dual-tone design tokens in `src/app/globals.css`:**

The existing `globals.css` already defines `:root` (light/admin mode) and `.dark` (dark mode) using oklch color space. The competitive theme builds on the `.dark` base but overrides accent colors with vibrant, high-energy values.

The design system uses three visual modes via CSS custom properties:

**Admin mode (`:root` — default):**
- Already defined by shadcn Nova preset
- Light background, neutral greys, professional palette
- Used for all admin/organizer-facing pages (dashboard, member management, hackathon setup)

**Dark mode (`.dark` — shadcn default):**
- Already defined by shadcn Nova preset
- Standard dark mode with neutral tones

**Competitive mode (`.theme-competitive` — custom addition):**
- Extends `.dark` as base (dark backgrounds)
- Overrides key tokens with vibrant, neon accent colors using oklch:
  - `--primary`: electric green/cyan for CTAs and highlights (e.g., `oklch(0.75 0.2 160)`)
  - `--accent`: vibrant secondary accent (e.g., `oklch(0.7 0.25 290)` — magenta/purple)
  - `--ring`: bright glow effect for focus states
  - `--chart-*`: vibrant data visualization colors
- Bold, high-energy feel — strong contrast between background and neon foreground elements
- Used for participant-facing pages (hackathon landing page, registration, leaderboard, results)

**Token categories (already defined by shadcn, extended for competitive):**

| Category | Custom Properties |
|----------|-----------------|
| Colors | `--background`, `--foreground`, `--card`, `--card-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1` through `--chart-5` |
| Sidebar | `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` |
| Radius | `--radius` (default: `0.625rem`) |

**How modes are applied:**
- Admin pages use the default `:root` tokens (no class needed)
- Participant-facing layouts (Phase 2+) wrap content in a `<div className="theme-competitive">` to switch tokens
- All shadcn components automatically pick up the correct tokens since they reference CSS variables
- The `@custom-variant dark (&:is(.dark *))` directive (already in globals.css) enables Tailwind's `dark:` variant

**Typography system:**

Two font families, loaded via `next/font` in the root layout:

| Font | Usage | Loaded Via |
|------|-------|-----------|
| **Geist Sans** (or Inter) | Admin body text, UI labels, form inputs, dashboard content. Clean, highly readable at small sizes. Used across all admin/organizer-facing pages. | `next/font/google` or `next/font/local` (already set up by Next.js init as `--font-sans`) |
| **Space Grotesk** | Competitive headings, hero titles, leaderboard ranks, hackathon names on landing pages. Geometric, bold, technical feel — conveys competition and precision. | `next/font/google`, assigned to `--font-heading-competitive` |

**How typography is applied:**

- `--font-sans` (Geist/Inter) is the global default for all text. Already mapped in `@theme inline` as `--font-sans`.
- `--font-heading` defaults to `--font-sans` in admin mode (clean, professional headings).
- In `.theme-competitive`, `--font-heading` is overridden to use Space Grotesk, so any element using `font-heading` automatically switches to the display font.
- Tailwind utility classes: `font-sans` for body text, `font-heading` for headings. Components use `font-heading` on h1–h3 elements, and the competitive theme swaps the underlying font without changing any component code.

**Typography scale (consistent across both modes):**

| Element | Tailwind Class | Admin | Competitive |
|---------|---------------|-------|-------------|
| H1 (page titles) | `text-3xl font-heading font-bold` | Geist Sans, bold | Space Grotesk, bold |
| H2 (section headers) | `text-2xl font-heading font-semibold` | Geist Sans, semibold | Space Grotesk, semibold |
| H3 (card titles) | `text-xl font-heading font-semibold` | Geist Sans, semibold | Space Grotesk, semibold |
| Body | `text-base font-sans` | Geist Sans, regular | Geist Sans, regular |
| Small/caption | `text-sm text-muted-foreground` | Geist Sans, regular | Geist Sans, regular |

**Implementation in `src/app/layout.tsx`:**

```typescript
import { Geist, Space_Grotesk } from 'next/font/google';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-heading-competitive' });
```

Both font variables are applied to the `<body>` tag. The `@theme inline` block maps them, and `.theme-competitive` swaps `--font-heading` to `var(--font-heading-competitive)`.

**Implementation in `src/app/globals.css`:**

```css
@theme inline {
  --font-sans: var(--font-sans);
  --font-heading: var(--font-sans); /* admin: same as body */
  --font-heading-competitive: var(--font-heading-competitive);
  /* ...existing tokens... */
}

.theme-competitive {
  --font-heading: var(--font-heading-competitive); /* swap to Space Grotesk */
}
```

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

The following reflects what exists after Part 1 completion. Files marked with `[existing]` were created during project init/shadcn setup. Files marked with `[new]` are created in Part 1.

```
hackforge/
├── .env.example                          # [new] Environment variable template
├── .env.local                            # [new] Local env (gitignored)
├── .gitignore                            # [existing]
├── CLAUDE.md                             # [existing]
├── CHANGELOG.md                          # [existing]
├── components.json                       # [existing] shadcn configuration
├── docs/                                 # [existing] Project documentation
│   ├── 000-project-context.md
│   ├── 001-technical-decisions.md
│   ├── 002-v1-development-phases.md
│   ├── 003-coding-conventions.md
│   ├── 004-architecture.md
│   ├── 005-development-workflow.md
│   └── 006-foundation-auth/
│       ├── prd.md
│       └── trd.md
├── drizzle.config.ts                     # [new] Drizzle Kit configuration
├── eslint.config.mjs                     # [existing] ESLint 9 flat config
├── next.config.ts                        # [existing] Next.js configuration (TypeScript)
├── next-env.d.ts                         # [existing] Next.js type declarations
├── package.json                          # [existing, modified] Added Drizzle deps + scripts
├── postcss.config.mjs                    # [existing] PostCSS config (@tailwindcss/postcss)
├── tsconfig.json                         # [existing]
└── src/
    ├── app/
    │   ├── globals.css                   # [existing, modified] Add .theme-competitive tokens
    │   ├── layout.tsx                    # [existing, modified] Root layout (fonts, metadata, Toaster)
    │   └── page.tsx                      # [existing] Temporary landing page
    ├── components/
    │   └── ui/                           # [existing + new] shadcn components (button + card, input, label, form, toast, sonner)
    ├── db/
    │   ├── index.ts                      # [new] Drizzle client instance
    │   ├── schema/
    │   │   ├── index.ts                  # [new] Barrel export
    │   │   ├── enums.ts                  # [new] platform_role, org_role
    │   │   ├── users.ts                  # [new] users table
    │   │   ├── organizations.ts          # [new] organizations table
    │   │   ├── org-memberships.ts        # [new] org_memberships table
    │   │   ├── org-invites.ts            # [new] org_invites table
    │   │   └── verification-tokens.ts    # [new] verification_tokens table (for Part 2)
    │   └── migrations/                   # [new] Generated by drizzle-kit
    ├── lib/
    │   ├── utils.ts                      # [existing] cn() helper (installed by shadcn)
    │   └── validations/                  # [new] Directory created; schemas added in Part 2+
    └── types/                            # [new] Directory created; types added in Part 2+
```

**Directories created but empty** (ready for future parts): `src/lib/auth/`, `src/lib/email/`, `src/lib/hooks/`, `src/lib/services/`, `src/lib/storage/`, `src/app/(auth)/`, `src/app/(dashboard)/`, `src/app/api/`, `src/app/(public)/`.

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

Part 1 is implemented in 3 increments. Each increment is a self-contained, pushable commit. Note: project init and shadcn init are already complete — Increment 1 builds on the existing state.

#### Increment 1: Design System + Typography + Additional shadcn Components

**What:** Install remaining shadcn components, load Space Grotesk font, add the `.theme-competitive` CSS custom properties (colors + typography overrides) to `globals.css`, update root layout with font variables and Toaster provider.

**Files created/modified:**
- `src/components/ui/*` — new shadcn components (card, input, label, form, toast, sonner)
- `src/app/globals.css` — add `.theme-competitive` color + typography token overrides after `.dark` block; update `@theme inline` with `--font-heading` and `--font-heading-competitive`
- `src/app/layout.tsx` — import Space Grotesk via `next/font/google`, add both font CSS variables to `<body>`, add Toaster provider from sonner

**Verify:** `npm run dev` starts successfully. Admin mode renders with Geist Sans headings. A test div with `className="theme-competitive"` renders headings in Space Grotesk. Both color palettes display correctly.

#### Increment 2: Database Schema + Migration

**What:** Install Drizzle ORM + postgres driver, create all schema files, configure Drizzle Kit, generate and apply the initial migration.

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
- `package.json` (new dependencies: `drizzle-orm`, `postgres`; new devDependencies: `drizzle-kit`; new scripts: `db:generate`, `db:migrate`, `db:studio`)

**Prerequisite:** `.env.local` must have `DATABASE_URL` and `DIRECT_URL` set (see section 1.8).

**Verify:** `npm run db:generate` creates migration files. `npm run db:migrate` applies cleanly. `npm run db:studio` shows all 5 tables and 2 enums.

#### Increment 3: Folder Structure + Environment Config

**What:** Create remaining directory structure, `.env.example`, verify `.gitignore`, and create empty placeholder directories for future parts.

**Files created/modified:**
- `.env.example`
- `.gitignore` (verify `.env.local` and `.env` are ignored)
- Empty directories with `.gitkeep`: `src/lib/auth/`, `src/lib/email/`, `src/lib/hooks/`, `src/lib/services/`, `src/lib/storage/`, `src/lib/validations/`, `src/types/`, `src/app/(auth)/`, `src/app/(dashboard)/`, `src/app/api/`, `src/app/(public)/`

**Verify:** Folder structure matches section 1.6 above. `.env.example` contains all variables from section 1.7. `npx tsc --noEmit` passes with no errors.

---

### 1.10 Files Changed Summary

| File | Action | Requirement |
|------|--------|-------------|
| `next.config.ts` | Existing | P1.R1 |
| `tsconfig.json` | Existing | P1.R1 |
| `postcss.config.mjs` | Existing | P1.R2 |
| `eslint.config.mjs` | Existing | P1.R1 |
| `components.json` | Existing | P1.R2 |
| `package.json` | Modified | P1.R3 (Drizzle deps + scripts) |
| `drizzle.config.ts` | Created | P1.R3 |
| `src/app/globals.css` | Modified | P1.R2 (add `.theme-competitive` tokens) |
| `src/app/layout.tsx` | Modified | P1.R2 (add Toaster provider) |
| `src/components/ui/*` | Created (additional) | P1.R2 (card, input, label, form, toast, sonner) |
| `src/lib/utils.ts` | Existing | P1.R2 |
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

## Part 2: Authentication

**PRD Requirements Covered:** P2.R1 through P2.R12

---

### 2.1 Dependencies (New for Part 2)

```bash
npm install next-auth@beta bcryptjs resend
npm install -D @types/bcryptjs
```

- **next-auth@beta** — NextAuth.js v5 (Auth.js). The beta tag is the v5 release line for Next.js App Router.
- **bcryptjs** — Pure JS bcrypt implementation (no native deps, works on Vercel serverless). Cost factor 12.
- **resend** — Email sending SDK.
- **@types/bcryptjs** — TypeScript types for bcryptjs.

---

### 2.2 NextAuth.js v5 Configuration (P2.R1, P2.R9)

#### `src/lib/auth/auth.ts` — Core auth configuration

```typescript
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { loginSchema } from '@/lib/validations/auth';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        });

        if (!user || user.deletedAt) return null;

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        // Return user object — this is passed to jwt callback
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          platformRole: user.platformRole,
          isEmailVerified: user.emailVerified,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      // On initial sign-in, user object is populated
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.platformRole = user.platformRole;
        token.isEmailVerified = user.isEmailVerified;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.platformRole = token.platformRole as string;
      session.user.isEmailVerified = token.isEmailVerified as boolean;
      return session;
    },
  },
});
```

**Key decisions:**
- `authorize` performs email lookup + bcrypt compare. Returns null for invalid credentials (NextAuth translates to error).
- Soft-deleted users (`deletedAt` not null) are treated as non-existent.
- Unverified users ARE allowed to log in (Option B). `isEmailVerified` is included in the JWT so downstream checks can gate actions.
- Email is lowercased before lookup to ensure case-insensitive matching.
- Custom NextAuth field is `isEmailVerified` (not `emailVerified`) to avoid conflict with NextAuth v5's base `User.emailVerified?: Date | null` type. Database column remains `email_verified` and Drizzle field remains `emailVerified`.

#### `src/lib/auth/types.ts` — NextAuth type extensions

```typescript
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    platformRole?: string;
    isEmailVerified?: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      platformRole: string;
      isEmailVerified: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    platformRole?: string;
    isEmailVerified?: boolean;
  }
}
```

#### `src/app/api/auth/[...nextauth]/route.ts` — API route handler

```typescript
import { handlers } from '@/lib/auth/auth';

export const { GET, POST } = handlers;
```

---

### 2.3 Zod Validation Schemas (P2.R2)

#### `src/lib/validations/auth.ts`

```typescript
import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be under 100 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

---

### 2.4 Email Service — Provider-Agnostic Architecture (P2.R3, P2.R7)

The email service uses a **provider-agnostic interface + adapter pattern**. All application code (auth service, future notification service, etc.) depends on the `EmailService` interface, never on Resend directly. Swapping to SendGrid, AWS SES, or any other provider means writing a new adapter — zero changes to business logic.

#### `src/lib/email/types.ts` — Email service interface and types

```typescript
export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailService {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
```

The `EmailService` interface is the contract. Every adapter implements `send()`. Application code imports `EmailService`, never a concrete adapter.

#### `src/lib/email/adapters/resend-adapter.ts` — Resend implementation

```typescript
import { Resend } from 'resend';
import type { EmailService, SendEmailParams, SendEmailResult } from '../types';

export class ResendEmailAdapter implements EmailService {
  private client: Resend;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.client = new Resend(apiKey);
    this.fromEmail = fromEmail;
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      if (error) {
        console.error('[email] Resend error:', error);
        return { success: false, error: error.message };
      }

      console.log('[email] Sent successfully:', { to: params.to, messageId: data?.id });
      return { success: true, messageId: data?.id };
    } catch (err) {
      console.error('[email] Unexpected error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
```

**Key decisions:**
- Constructor takes `apiKey` and `fromEmail` as parameters (not read from env inside the class) — makes it testable and explicit.
- Never throws — returns a result object. Callers decide how to handle failures.
- Logs on success and error per coding conventions.

#### `src/lib/email/index.ts` — Email service factory (singleton)

```typescript
import type { EmailService } from './types';
import { ResendEmailAdapter } from './adapters/resend-adapter';

let emailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailService) {
    // Current provider: Resend
    // To swap providers, replace this with a different adapter:
    //   emailService = new SendGridAdapter(process.env.SENDGRID_API_KEY!, ...);
    emailService = new ResendEmailAdapter(
      process.env.RESEND_API_KEY!,
      process.env.FROM_EMAIL!,
    );
  }
  return emailService;
}

// Re-export types for convenience
export type { EmailService, SendEmailParams, SendEmailResult } from './types';
```

**How application code uses it:**

```typescript
import { getEmailService } from '@/lib/email';
import { verificationEmail } from '@/lib/email/templates';

const email = getEmailService();
const template = verificationEmail({ name: 'Alice', verifyUrl: '...' });
const result = await email.send({ to: 'alice@example.com', ...template });
```

**To swap providers:** Create a new adapter (e.g., `src/lib/email/adapters/sendgrid-adapter.ts`), implement `EmailService`, and change the factory in `index.ts`. No other files change.

#### `src/lib/email/templates.ts` — Email template functions

Plain text + HTML emails. No React Email dependency in V1 — keeps it simple. Templates are functions that return `{ subject, html, text }`.

```typescript
export function verificationEmail(params: { name: string; verifyUrl: string }): { subject: string; html: string; text: string };
export function passwordResetEmail(params: { name: string; resetUrl: string }): { subject: string; html: string; text: string };
```

Each template returns a styled HTML email with HackForge branding and a clear CTA button, plus a plain-text fallback. Templates are provider-agnostic — they produce raw HTML/text, not Resend-specific objects.

---

### 2.5 Auth Constants (Single Source of Truth)

#### `src/lib/auth/constants.ts`

All magic numbers and configurable auth values live here. Every file that needs an expiry time, cost factor, or label imports from this file — never hardcodes its own.

```typescript
export const AUTH_CONSTANTS = {
  /** bcrypt cost factor for password hashing */
  BCRYPT_COST: 12,

  /** Email verification token expiry in minutes */
  EMAIL_VERIFICATION_EXPIRY_MINUTES: 1440, // 24 hours

  /** Password reset token expiry in minutes */
  PASSWORD_RESET_EXPIRY_MINUTES: 60, // 1 hour

  /** Org invite expiry in days */
  ORG_INVITE_EXPIRY_DAYS: 7,
} as const;

/** Human-readable expiry labels — derived from the constants above.
 *  Used in email templates, UI messages, and error responses.
 *  If you change the expiry durations, these update automatically. */
export const AUTH_EXPIRY_LABELS = {
  emailVerification: formatExpiry(AUTH_CONSTANTS.EMAIL_VERIFICATION_EXPIRY_MINUTES),
  passwordReset: formatExpiry(AUTH_CONSTANTS.PASSWORD_RESET_EXPIRY_MINUTES),
} as const;

function formatExpiry(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440} day(s)`;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hour(s)`;
  return `${minutes} minute(s)`;
}
```

**How it's consumed:**

- **Token service** — `createToken({ ..., expiresInMinutes: AUTH_CONSTANTS.EMAIL_VERIFICATION_EXPIRY_MINUTES })`
- **Auth service** — `AUTH_CONSTANTS.BCRYPT_COST` for password hashing
- **Email templates** — `AUTH_EXPIRY_LABELS.passwordReset` to render "This link expires in 1 hour(s)" in the email body
- **Error responses** — "Your token has expired. Verification links are valid for ${AUTH_EXPIRY_LABELS.emailVerification}."

One change in `constants.ts` → every token, template, and message updates. No grep-and-replace needed.

---

### 2.6 Token Service (P2.R3, P2.R7, P2.R12)

#### `src/lib/services/token-service.ts`

Handles creation and validation of verification/reset tokens.

```typescript
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, and, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { verificationTokens } from '@/db/schema';

// Generate a secure random token, store its hash in DB
export async function createToken(params: {
  userId: string;
  type: 'email_verification' | 'password_reset';
  expiresInMinutes: number;
}): Promise<string>;  // returns the raw token (sent via email)

// Validate a raw token against the DB hash
export async function validateToken(params: {
  rawToken: string;
  type: 'email_verification' | 'password_reset';
}): Promise<{ valid: boolean; userId?: string; tokenId?: string }>;

// Mark a token as used
export async function markTokenUsed(tokenId: string): Promise<void>;

// Invalidate all unused tokens for a user+type (e.g., on new request)
export async function invalidateTokens(params: {
  userId: string;
  type: 'email_verification' | 'password_reset';
}): Promise<void>;
```

**Token security model:**
1. `crypto.randomBytes(32)` generates a 32-byte random token.
2. The raw token is encoded as hex and sent to the user via email URL.
3. A SHA-256 hash of the raw token is stored in `verification_tokens.token`.
4. On validation, the submitted raw token is hashed and compared against stored hashes.
5. SHA-256 (not bcrypt) is used for tokens because tokens are high-entropy random strings — dictionary attacks don't apply, and SHA-256 is fast for comparison.

**Expiry (from `AUTH_CONSTANTS`):**
- Email verification tokens: `AUTH_CONSTANTS.EMAIL_VERIFICATION_EXPIRY_MINUTES` (default: 1440 = 24 hours).
- Password reset tokens: `AUTH_CONSTANTS.PASSWORD_RESET_EXPIRY_MINUTES` (default: 60 = 1 hour).
- Change once in `src/lib/auth/constants.ts` — token creation, email templates, and UI messages all reflect the new value.

---

### 2.7 Auth Service (P2.R2, P2.R3, P2.R6, P2.R7, P2.R8)

#### `src/lib/services/auth-service.ts`

Business logic for auth operations. Framework-agnostic (no Next.js imports).

```typescript
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { createToken, validateToken, markTokenUsed, invalidateTokens } from './token-service';
import { getEmailService } from '@/lib/email';
import { verificationEmail, passwordResetEmail } from '@/lib/email/templates';
import { AUTH_CONSTANTS } from '@/lib/auth/constants';

export async function signUp(params: {
  name: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; error?: string }>;
// 1. Check if email already exists → return error if so
// 2. Hash password with bcrypt (cost 12)
// 3. Insert user record
// 4. Create email verification token
// 5. Send verification email
// 6. Return success

export async function verifyEmail(params: {
  token: string;
}): Promise<{ success: boolean; error?: string }>;
// 1. Validate token (type: email_verification)
// 2. If valid, set user.emailVerified = true
// 3. Mark token as used
// 4. Return success

export async function requestPasswordReset(params: {
  email: string;
}): Promise<{ success: boolean }>;
// 1. Find user by email
// 2. If user exists, invalidate old tokens and create new one
// 3. Send password reset email
// 4. Always return success (prevent email enumeration)

export async function resetPassword(params: {
  token: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }>;
// 1. Validate token (type: password_reset)
// 2. Hash new password
// 3. Update user.passwordHash
// 4. Mark token as used
// 5. Invalidate all other reset tokens for this user
// 6. Return success

export async function resendVerificationEmail(params: {
  userId: string;
}): Promise<{ success: boolean; error?: string }>;
// 1. Find user by ID
// 2. If already verified, return error
// 3. Invalidate old verification tokens
// 4. Create new token and send email
// 5. Return success
```

**Key decisions:**
- `requestPasswordReset` always returns success even if the email doesn't exist. This prevents email enumeration attacks.
- `signUp` checks for existing email case-insensitively.
- All operations log entry, exit, and errors per coding conventions.

---

### 2.8 API Routes (P2.R2, P2.R3, P2.R6, P2.R7, P2.R8)

All routes validate input with Zod, call service functions, and return appropriate HTTP status codes.

#### `src/app/api/auth/signup/route.ts` — POST

```
Request:  { name, email, password }
Validate: signUpSchema
Call:     authService.signUp()
Success:  201 { message: "Account created. Check your email to verify." }
Error:    400 (validation) | 409 (email exists) | 500 (server error)
```

#### `src/app/api/auth/verify-email/route.ts` — POST

```
Request:  { token }
Call:     authService.verifyEmail()
Success:  200 { message: "Email verified successfully." }
Error:    400 (invalid/expired token) | 500
```

#### `src/app/api/auth/forgot-password/route.ts` — POST

```
Request:  { email }
Validate: forgotPasswordSchema
Call:     authService.requestPasswordReset()
Success:  200 { message: "If an account exists, a reset link has been sent." }
Error:    400 (validation) | 500
Note:     Always returns 200 to prevent email enumeration.
```

#### `src/app/api/auth/reset-password/route.ts` — POST

```
Request:  { token, password }
Validate: resetPasswordSchema
Call:     authService.resetPassword()
Success:  200 { message: "Password reset successfully." }
Error:    400 (validation / invalid token) | 500
```

#### `src/app/api/auth/resend-verification/route.ts` — POST

```
Auth:     Requires session (call auth())
Request:  {} (uses session.user.id)
Call:     authService.resendVerificationEmail()
Success:  200 { message: "Verification email sent." }
Error:    401 (unauthenticated) | 400 (already verified) | 500
```

---

### 2.9 Auth Middleware (P2.R10)

#### `src/middleware.ts` — Next.js middleware (project root of src/)

```typescript
import { auth } from '@/lib/auth/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;
  const isAuthPage = nextUrl.pathname.startsWith('/login') ||
                     nextUrl.pathname.startsWith('/signup') ||
                     nextUrl.pathname.startsWith('/forgot-password') ||
                     nextUrl.pathname.startsWith('/reset-password');
  const isDashboardPage = nextUrl.pathname.startsWith('/dashboard');
  const isAdminPage = nextUrl.pathname.startsWith('/admin');

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  // Protect dashboard routes — redirect unauthenticated to login
  if (!isLoggedIn && (isDashboardPage || isAdminPage)) {
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl));
  }

  // Unverified users ARE allowed into /dashboard (Option B).
  // Action restrictions are enforced at the API route level, not middleware.

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login', '/signup', '/forgot-password', '/reset-password'],
};
```

**Key decisions:**
- Middleware only handles redirect logic (unauthenticated → login, authenticated → away from auth pages).
- Email verification is NOT enforced in middleware. Unverified users can access `/dashboard`. Action restrictions happen in API routes (checking `session.user.isEmailVerified`).
- Callback URL is preserved for post-login redirect.

---

### 2.10 Shared Form Components (P2.R2, P2.R6, P2.R7, P2.R8)

Since shadcn's `Form` component is unavailable in the radix-nova preset, we build thin shared wrappers around react-hook-form + shadcn primitives (`Input`, `Label`). These components eliminate repetitive form plumbing across auth pages and are reusable in future forms (org management, hackathon settings, etc.).

All shared form components live in `src/components/ui/form/`.

#### `src/components/ui/form/form-field.tsx` — Core wrapper

```typescript
'use client';

import { type Control, type FieldPath, type FieldValues, useController } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  type?: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  type = 'text',
  placeholder,
  description,
  disabled,
  className,
}: FormFieldProps<T>) {
  const {
    field,
    fieldState: { error },
  } = useController({ control, name });

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={name} className={cn(error && 'text-destructive')}>
        {label}
      </Label>
      <Input
        id={name}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : description ? `${name}-desc` : undefined}
        {...field}
      />
      {description && !error && (
        <p id={`${name}-desc`} className="text-sm text-muted-foreground">{description}</p>
      )}
      {error && (
        <p id={`${name}-error`} role="alert" className="text-sm text-destructive">{error.message}</p>
      )}
    </div>
  );
}
```

**Key decisions:**
- Generic over `FieldValues` — works with any Zod schema / form shape.
- Uses `useController` (not `register`) for full control over field state and error display.
- Accessibility: `aria-invalid`, `aria-describedby`, `role="alert"` on errors.
- Destructive color on label and error message when validation fails.
- Accepts all standard input props (`type`, `placeholder`, `disabled`).

#### `src/components/ui/form/form-password-field.tsx` — Password with show/hide toggle

Extends `FormField` with a visibility toggle button (eye icon via Lucide). Used on signup, login, and reset-password forms.

```typescript
'use client';

// Same pattern as FormField, but with:
// - Internal state for show/hide password
// - Toggle button with Eye / EyeOff icons from lucide-react
// - type switches between 'password' and 'text'
// - aria-label on toggle button for accessibility
```

#### `src/components/ui/form/form-message.tsx` — Standalone form-level message

For displaying form-level success/error messages (not field-level). Used after form submission.

```typescript
interface FormMessageProps {
  type: 'success' | 'error';
  message: string;
}
```

Renders a styled alert box — green/success or red/destructive.

#### `src/components/ui/form/index.ts` — Barrel export

```typescript
export { FormField } from './form-field';
export { FormPasswordField } from './form-password-field';
export { FormMessage } from './form-message';
```

**Usage in auth forms:**

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField, FormPasswordField, FormMessage } from '@/components/ui/form';
import { signUpSchema, type SignUpInput } from '@/lib/validations/auth';

function SignUpForm() {
  const { control, handleSubmit } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormField control={control} name="name" label="Full Name" placeholder="Jane Doe" />
      <FormField control={control} name="email" label="Email" type="email" placeholder="jane@example.com" />
      <FormPasswordField control={control} name="password" label="Password" />
      <Button type="submit">Create Account</Button>
    </form>
  );
}
```

This keeps every auth form to ~20 lines of JSX instead of repeating Label + Input + error handling for each field.

---

### 2.11 Auth Pages — Frontend (P2.R2, P2.R4, P2.R5, P2.R6, P2.R7, P2.R8, P2.R11)

All auth pages live under `src/app/(auth)/` route group. They share a centered card layout with HackForge branding. All use the admin design tokens (light mode).

#### Auth Layout — `src/app/(auth)/layout.tsx`

A centered layout: full-height screen, content centered vertically and horizontally. HackForge logo/name at top. No sidebar or nav — clean, focused auth experience.

#### Sign Up Page — `src/app/(auth)/signup/page.tsx`

- **Route:** `/signup`
- **Fields:** Name, Email, Password (with show/hide toggle)
- **Validation:** Client-side via react-hook-form + zodResolver(signUpSchema). Server-side in API route.
- **On submit:** POST to `/api/auth/signup`. On success, redirect to a "Check your email" confirmation page.
- **Links:** "Already have an account? Log in" → `/login`
- **Co-located components in `_components/`:** `signup-form.tsx` (client component with `'use client'`)

#### Login Page — `src/app/(auth)/login/page.tsx`

- **Route:** `/login`
- **Fields:** Email, Password (with show/hide toggle)
- **Validation:** Client-side via react-hook-form + zodResolver(loginSchema).
- **On submit:** Call `signIn('credentials', { email, password, redirect: false })`. Handle errors inline.
- **On success:** Redirect to `callbackUrl` (from query param) or `/dashboard`.
- **Links:** "Forgot password?" → `/forgot-password`, "Don't have an account? Sign up" → `/signup`
- **Co-located components:** `login-form.tsx`

#### Forgot Password Page — `src/app/(auth)/forgot-password/page.tsx`

- **Route:** `/forgot-password`
- **Fields:** Email
- **On submit:** POST to `/api/auth/forgot-password`. Always show success message ("If an account exists, a reset link has been sent.") regardless of whether the email exists.
- **Links:** "Back to login" → `/login`
- **Co-located components:** `forgot-password-form.tsx`

#### Reset Password Page — `src/app/(auth)/reset-password/page.tsx`

- **Route:** `/reset-password?token=xxx`
- **Fields:** New Password, Confirm Password
- **Validation:** Passwords must match (client-side). Password complexity (Zod).
- **On submit:** POST to `/api/auth/reset-password` with token from URL + new password.
- **On success:** Show success message + "Go to login" link.
- **On invalid/expired token:** Show error with "Request a new reset link" → `/forgot-password`.
- **Co-located components:** `reset-password-form.tsx`

#### Verify Email Page — `src/app/(auth)/verify-email/page.tsx`

- **Route:** `/verify-email?token=xxx`
- **On load:** Automatically POST to `/api/auth/verify-email` with token from URL.
- **On success:** Show "Email verified!" message + "Go to dashboard" link.
- **On invalid/expired token:** Show error with "Resend verification email" button.
- **No form — this is a confirmation page that auto-verifies on mount.**

#### Check Email Page — `src/app/(auth)/check-email/page.tsx`

- **Route:** `/check-email`
- **Shown after:** Successful sign-up or forgot-password submission.
- **Content:** "Check your email" message with icon. "Didn't receive it? Resend" link. "Back to login" link.

---

### 2.12 Email Verification Banner (P2.R5)

#### `src/components/verification-banner.tsx`

A client component (`'use client'`) that:
- Checks `session.user.isEmailVerified` from the session.
- If `false`, renders a persistent, non-dismissible banner at the top of the page:
  - Yellow/amber background, warning icon.
  - Text: "Please verify your email to unlock all features."
  - "Resend verification email" button — POSTs to `/api/auth/resend-verification`.
  - Shows toast on success/error.
- If `true`, renders nothing.

**Placement:** Imported in the dashboard layout (`src/app/(dashboard)/layout.tsx` — built in Part 3). For Part 2, the component is created and exported but not yet placed in a layout (no dashboard layout exists yet).

---

### 2.13 Verified Email Guard Utility (P2.R4)

#### `src/lib/auth/require-verified.ts`

A server-side utility used by API routes to enforce verified email on actions:

```typescript
import { auth } from './auth';

export async function requireVerifiedUser(): Promise<{
  user: { id: string; email: string; name: string; platformRole: string; isEmailVerified: boolean };
} | { error: Response }>;
```

Usage in API routes:

```typescript
const result = await requireVerifiedUser();
if ('error' in result) return result.error;
const { user } = result;
// proceed with the action
```

Returns a 401 JSON response if unauthenticated, or a 403 JSON response with message "Please verify your email to perform this action" if unverified.

---

### 2.14 Implementation Increments

Part 2 is implemented in 4 increments.

#### Increment 1: Auth Config + Validation Schemas + Email Service

**What:** Install dependencies, configure NextAuth.js v5, create Zod validation schemas, set up provider-agnostic email service with Resend adapter.

**Files created/modified:**
- `package.json` — new dependencies (next-auth, bcryptjs, resend, @types/bcryptjs)
- `src/lib/auth/auth.ts` — NextAuth configuration
- `src/lib/auth/types.ts` — NextAuth type extensions
- `src/lib/auth/constants.ts` — Centralized auth constants (expiry durations, bcrypt cost)
- `src/lib/validations/auth.ts` — Zod schemas (signUp, login, forgotPassword, resetPassword)
- `src/lib/email/types.ts` — EmailService interface and SendEmailParams/SendEmailResult types
- `src/lib/email/adapters/resend-adapter.ts` — Resend implementation of EmailService
- `src/lib/email/index.ts` — Email service factory (getEmailService singleton)
- `src/lib/email/templates.ts` — Email template functions (provider-agnostic HTML/text)
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth API route handler

**Verify:** `tsc --noEmit` passes. NextAuth handler responds at `/api/auth/providers`.

#### Increment 2: Token Service + Auth Service + API Routes

**What:** Build the token service (create, validate, invalidate), auth service (signUp, verifyEmail, requestPasswordReset, resetPassword, resendVerification), and all API route handlers.

**Files created/modified:**
- `src/lib/services/token-service.ts` — Token CRUD operations
- `src/lib/services/auth-service.ts` — Auth business logic
- `src/app/api/auth/signup/route.ts`
- `src/app/api/auth/verify-email/route.ts`
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`
- `src/app/api/auth/resend-verification/route.ts`

**Verify:** `tsc --noEmit` passes. Test sign-up API with curl. Verify email appears in Resend dashboard.

#### Increment 3: Shared Form Components + Auth Pages (Frontend)

**What:** Build shared form wrapper components (FormField, FormPasswordField, FormMessage), then build all auth pages — signup, login, forgot-password, reset-password, verify-email, check-email — with the auth layout. Auth forms use the shared components for DRY, consistent form plumbing.

**Files created/modified:**
- `src/components/ui/form/form-field.tsx` — Generic FormField wrapper (Label + Input + error)
- `src/components/ui/form/form-password-field.tsx` — Password field with show/hide toggle
- `src/components/ui/form/form-message.tsx` — Form-level success/error message
- `src/components/ui/form/index.ts` — Barrel export
- `src/app/(auth)/layout.tsx` — Centered auth layout
- `src/app/(auth)/signup/page.tsx`
- `src/app/(auth)/signup/_components/signup-form.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/login/_components/login-form.tsx`
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/forgot-password/_components/forgot-password-form.tsx`
- `src/app/(auth)/reset-password/page.tsx`
- `src/app/(auth)/reset-password/_components/reset-password-form.tsx`
- `src/app/(auth)/verify-email/page.tsx`
- `src/app/(auth)/check-email/page.tsx`

**Verify:** `tsc --noEmit` passes. Full sign-up → check-email → verify → login flow works in browser.

#### Increment 4: Middleware + Verification Banner + Guard Utility

**What:** Build the Next.js middleware for route protection, the verification banner component, and the requireVerifiedUser guard utility.

**Files created/modified:**
- `src/middleware.ts` — Route protection middleware
- `src/components/verification-banner.tsx` — Email verification banner
- `src/lib/auth/require-verified.ts` — Server-side verified email guard

**Verify:** `tsc --noEmit` passes. Unauthenticated users are redirected to `/login`. Logged-in users are redirected away from auth pages. Callback URL is preserved.

---

### 2.15 Files Changed Summary

| File | Action | Requirement |
|------|--------|-------------|
| `package.json` | Modified | P2.R1 (next-auth, bcryptjs, resend) |
| `src/lib/auth/auth.ts` | Created | P2.R1, P2.R9 |
| `src/lib/auth/types.ts` | Created | P2.R9 |
| `src/lib/auth/constants.ts` | Created | P2.R3, P2.R7, P2.R12 |
| `src/lib/auth/require-verified.ts` | Created | P2.R4 |
| `src/lib/validations/auth.ts` | Created | P2.R2 |
| `src/lib/email/types.ts` | Created | P2.R3, P2.R7 |
| `src/lib/email/adapters/resend-adapter.ts` | Created | P2.R3, P2.R7 |
| `src/lib/email/index.ts` | Created | P2.R3, P2.R7 |
| `src/lib/email/templates.ts` | Created | P2.R3, P2.R7 |
| `src/lib/services/token-service.ts` | Created | P2.R12 |
| `src/lib/services/auth-service.ts` | Created | P2.R2, P2.R3, P2.R7, P2.R8 |
| `src/app/api/auth/[...nextauth]/route.ts` | Created | P2.R1 |
| `src/app/api/auth/signup/route.ts` | Created | P2.R2 |
| `src/app/api/auth/verify-email/route.ts` | Created | P2.R3 |
| `src/app/api/auth/forgot-password/route.ts` | Created | P2.R7 |
| `src/app/api/auth/reset-password/route.ts` | Created | P2.R8 |
| `src/app/api/auth/resend-verification/route.ts` | Created | P2.R5 |
| `src/middleware.ts` | Created | P2.R10 |
| `src/components/ui/form/form-field.tsx` | Created | P2.R2, P2.R6, P2.R7, P2.R8 |
| `src/components/ui/form/form-password-field.tsx` | Created | P2.R2, P2.R6, P2.R8 |
| `src/components/ui/form/form-message.tsx` | Created | P2.R2 |
| `src/components/ui/form/index.ts` | Created | P2.R2 |
| `src/app/(auth)/layout.tsx` | Created | P2.R11 |
| `src/app/(auth)/signup/page.tsx` | Created | P2.R2 |
| `src/app/(auth)/signup/_components/signup-form.tsx` | Created | P2.R2 |
| `src/app/(auth)/login/page.tsx` | Created | P2.R6 |
| `src/app/(auth)/login/_components/login-form.tsx` | Created | P2.R6 |
| `src/app/(auth)/forgot-password/page.tsx` | Created | P2.R7 |
| `src/app/(auth)/forgot-password/_components/forgot-password-form.tsx` | Created | P2.R7 |
| `src/app/(auth)/reset-password/page.tsx` | Created | P2.R8 |
| `src/app/(auth)/reset-password/_components/reset-password-form.tsx` | Created | P2.R8 |
| `src/app/(auth)/verify-email/page.tsx` | Created | P2.R3 |
| `src/app/(auth)/check-email/page.tsx` | Created | P2.R3 |
| `src/components/verification-banner.tsx` | Created | P2.R5 |

---

## Part 3: Organization Management + App Shell + Admin Panel

**PRD Requirements Covered:** P3.R1 through P3.R11

---

### 3.1 Dependencies (New for Part 3)

```bash
npx shadcn@latest add avatar badge dialog dropdown-menu select separator sheet sidebar skeleton table tabs tooltip
```

These shadcn components are needed for the app shell (sidebar, dropdown menus, avatar, tooltips), member management (table, badge, dialog, select), and admin panel (table, tabs). All are part of the radix-nova preset.

No new npm dependencies — shadcn components install from the local preset and only add files to `src/components/ui/`.

---

### 3.2 Zod Validation Schemas — Org (P3.R1, P3.R3, P3.R5)

#### `src/lib/validations/org.ts`

```typescript
import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be under 100 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be under 50 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens'),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['org_admin', 'member']),
});

export const changeMemberRoleSchema = z.object({
  membershipId: z.string().uuid('Invalid membership ID'),
  role: z.enum(['org_admin', 'member']),
});

export const removeMemberSchema = z.object({
  membershipId: z.string().uuid('Invalid membership ID'),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
```

**Slug generation helper** (used in the create-org form to auto-generate from name):

```typescript
// In src/lib/utils.ts or a dedicated helper
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

---

### 3.3 Email Template — Org Invite (P3.R3)

#### `src/lib/email/templates.ts` — Add `orgInviteEmail`

```typescript
export function orgInviteEmail(params: {
  inviterName: string;
  orgName: string;
  role: string;
  acceptUrl: string;
}): { subject: string; html: string; text: string };
```

Uses the same `emailLayout` and `ctaButton` helpers from Part 2. Includes expiry label from `AUTH_CONSTANTS.ORG_INVITE_EXPIRY_DAYS` via a new `AUTH_EXPIRY_LABELS.orgInvite` entry. The email contains the org name, the inviter's name, the assigned role, and a CTA button to accept.

**Update `src/lib/auth/constants.ts`** — add to `AUTH_EXPIRY_LABELS`:

```typescript
export const AUTH_EXPIRY_LABELS = {
  emailVerification: formatExpiry(AUTH_CONSTANTS.EMAIL_VERIFICATION_EXPIRY_MINUTES),
  passwordReset: formatExpiry(AUTH_CONSTANTS.PASSWORD_RESET_EXPIRY_MINUTES),
  orgInvite: `${AUTH_CONSTANTS.ORG_INVITE_EXPIRY_DAYS} day(s)`,
} as const;
```

---

### 3.4 Org Service (P3.R1, P3.R3, P3.R4, P3.R5)

#### `src/lib/services/org-service.ts`

Business logic for organization operations. Framework-agnostic.

```typescript
import crypto from 'crypto';
import { eq, and, isNull, count } from 'drizzle-orm';

import { db } from '@/db';
import { organizations, orgMemberships, orgInvites, users } from '@/db/schema';
import { getEmailService } from '@/lib/email';
import { orgInviteEmail } from '@/lib/email/templates';
import { AUTH_CONSTANTS } from '@/lib/auth/constants';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function createOrg(params: {
  name: string;
  slug: string;
  userId: string;
}): Promise<{ success: boolean; org?: { id: string; slug: string }; error?: string }>;
// 1. Check slug uniqueness
// 2. Insert organization record
// 3. Insert org_membership (org_admin role, joinedAt = now)
// 4. Return the org

export async function getOrgBySlug(slug: string): Promise<Organization | null>;
// Find by slug, exclude soft-deleted

export async function getUserOrgs(userId: string): Promise<Array<{
  org: Organization;
  role: string;
}>>;
// Return all orgs for a user (via org_memberships, exclude deleted memberships and deleted orgs)

export async function inviteMember(params: {
  orgId: string;
  email: string;
  role: 'org_admin' | 'member';
  invitedByUserId: string;
  inviterName: string;
  orgName: string;
}): Promise<{ success: boolean; error?: string }>;
// 1. Check if email is already a member of this org → error
// 2. Check if a pending (non-expired, non-accepted) invite already exists → error
// 3. Generate secure token (crypto.randomBytes, stored as SHA-256 hash)
// 4. Insert org_invites record with expiresAt = now + ORG_INVITE_EXPIRY_DAYS
// 5. Send invite email with accept URL: /invite/accept?token=<rawToken>
// 6. Return success

export async function acceptInvite(params: {
  rawToken: string;
  userId: string;
}): Promise<{ success: boolean; orgSlug?: string; error?: string }>;
// 1. Hash the raw token and find matching invite (not expired, not accepted)
// 2. Verify user email is verified → error if not
// 3. Check user isn't already a member → if already, mark invite accepted and return org slug
// 4. Insert org_membership (role from invite, joinedAt = now)
// 5. Mark invite as accepted (acceptedAt = now)
// 6. Return success + org slug for redirect

export async function getOrgMembers(orgId: string): Promise<Array<{
  membership: OrgMembership;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}>>;
// Join org_memberships with users, exclude deleted memberships

export async function changeMemberRole(params: {
  membershipId: string;
  orgId: string;
  newRole: 'org_admin' | 'member';
}): Promise<{ success: boolean; error?: string }>;
// 1. Find the membership
// 2. If demoting to member, check this isn't the last org_admin → error
// 3. Update role
// 4. Return success

export async function removeMember(params: {
  membershipId: string;
  orgId: string;
}): Promise<{ success: boolean; error?: string }>;
// 1. Find the membership
// 2. If member is org_admin, check this isn't the last org_admin → error
// 3. Soft-delete: set deletedAt on membership (user retains platform account)
// 4. Return success

export async function getPendingInvitesForUser(email: string): Promise<Array<{
  invite: OrgInvite;
  org: Organization;
}>>;
// Find non-expired, non-accepted invites matching email. Used to show pending invites on the post-login redirect.

export async function checkUserOrgRole(params: {
  userId: string;
  orgId: string;
}): Promise<{ role: string } | null>;
// Return the user's role in the org, or null if not a member. Used by RBAC checks.
```

**Key decisions:**
- Invite tokens use the same SHA-256 pattern as verification tokens (raw token emailed, hash stored).
- `removeMember` soft-deletes the membership (sets `deletedAt`), not hard-delete.
- "Last org_admin" check: count active org_admins before allowing demotion or removal.
- `acceptInvite` requires the user to be email-verified — enforced in the service, not just the API route.

---

### 3.5 Admin Service (P3.R10)

#### `src/lib/services/admin-service.ts`

Queries for the super admin panel. Framework-agnostic.

```typescript
import { db } from '@/db';
import { organizations, orgMemberships, users } from '@/db/schema';

export async function listOrganizations(): Promise<Array<{
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  createdAt: Date;
}>>;
// Select orgs (exclude soft-deleted), count members per org via subquery or join

export async function listUsers(): Promise<Array<{
  id: string;
  name: string;
  email: string;
  platformRole: string;
  emailVerified: boolean;
  createdAt: Date;
}>>;
// Select users (exclude soft-deleted), ordered by createdAt desc
```

---

### 3.6 RBAC Utilities (P3.R8)

#### `src/lib/auth/require-org-role.ts` — Org-level permission guard

```typescript
import { NextResponse } from 'next/server';

import { auth } from './auth';
import { checkUserOrgRole } from '@/lib/services/org-service';

export async function requireOrgRole(params: {
  orgId: string;
  allowedRoles: Array<'org_admin' | 'member'>;
}): Promise<{
  user: { id: string; email: string; name: string; platformRole: string; isEmailVerified: boolean };
  role: string;
} | { error: NextResponse }>;
```

Combines `requireVerifiedUser()` + org role check in one call. Returns 401 (unauthenticated), 403 (unverified or insufficient org role), or the user + role.

**Usage:**

```typescript
const result = await requireOrgRole({ orgId, allowedRoles: ['org_admin'] });
if ('error' in result) return result.error;
const { user, role } = result;
```

#### `src/lib/auth/require-super-admin.ts` — Platform-level guard

```typescript
export async function requireSuperAdmin(): Promise<{
  user: VerifiedUser;
} | { error: NextResponse }>;
```

Returns 401/403 if not authenticated, not verified, or not `super_admin`. Used exclusively by `/admin` API routes.

---

### 3.7 API Routes — Org Management (P3.R1, P3.R3, P3.R4, P3.R5)

All routes use `requireVerifiedUser()` or `requireOrgRole()` for auth/RBAC.

#### `src/app/api/orgs/route.ts` — POST (Create Org)

```
Auth:     requireVerifiedUser()
Request:  { name, slug }
Validate: createOrgSchema
Call:     orgService.createOrg()
Success:  201 { message: "Organization created.", org: { id, slug } }
Error:    400 (validation) | 409 (slug taken) | 401/403 | 500
```

#### `src/app/api/orgs/route.ts` — GET (List User's Orgs)

```
Auth:     requireVerifiedUser()
Call:     orgService.getUserOrgs(user.id)
Success:  200 { orgs: [...] }
Error:    401/403 | 500
```

#### `src/app/api/orgs/[orgId]/members/route.ts` — GET (List Members)

```
Auth:     requireOrgRole({ orgId, allowedRoles: ['org_admin', 'member'] })
Call:     orgService.getOrgMembers(orgId)
Success:  200 { members: [...] }
Error:    401/403 | 500
```

#### `src/app/api/orgs/[orgId]/members/invite/route.ts` — POST (Invite Member)

```
Auth:     requireOrgRole({ orgId, allowedRoles: ['org_admin'] })
Request:  { email, role }
Validate: inviteMemberSchema
Call:     orgService.inviteMember()
Success:  201 { message: "Invitation sent." }
Error:    400 (validation / already member / pending invite) | 401/403 | 500
```

#### `src/app/api/orgs/[orgId]/members/[membershipId]/role/route.ts` — PATCH (Change Role)

```
Auth:     requireOrgRole({ orgId, allowedRoles: ['org_admin'] })
Request:  { role }
Validate: changeMemberRoleSchema (membershipId from URL param)
Call:     orgService.changeMemberRole()
Success:  200 { message: "Role updated." }
Error:    400 (last admin) | 401/403 | 500
```

#### `src/app/api/orgs/[orgId]/members/[membershipId]/route.ts` — DELETE (Remove Member)

```
Auth:     requireOrgRole({ orgId, allowedRoles: ['org_admin'] })
Call:     orgService.removeMember()
Success:  200 { message: "Member removed." }
Error:    400 (last admin) | 401/403 | 500
```

#### `src/app/api/invite/accept/route.ts` — POST (Accept Invite)

```
Auth:     requireVerifiedUser()
Request:  { token }
Call:     orgService.acceptInvite()
Success:  200 { message: "Joined organization.", orgSlug }
Error:    400 (invalid/expired token / not verified) | 401/403 | 500
```

---

### 3.8 API Routes — Admin Panel (P3.R10)

#### `src/app/api/admin/orgs/route.ts` — GET

```
Auth:     requireSuperAdmin()
Call:     adminService.listOrganizations()
Success:  200 { organizations: [...] }
Error:    401/403 | 500
```

#### `src/app/api/admin/users/route.ts` — GET

```
Auth:     requireSuperAdmin()
Call:     adminService.listUsers()
Success:  200 { users: [...] }
Error:    401/403 | 500
```

---

### 3.9 SessionProvider Wrapper (P3.R6)

#### `src/components/providers/session-provider.tsx`

NextAuth's `useSession()` hook (used by the verification banner, user menu, org switcher) requires a `<SessionProvider>` client component wrapping the tree.

```typescript
'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
```

Imported in the dashboard layout to wrap dashboard content. NOT placed in the root layout (auth pages don't need sessions loaded client-side).

---

### 3.10 App Shell — Dashboard Layout (P3.R6, P3.R9, P3.R11)

#### `src/app/(dashboard)/layout.tsx`

The dashboard layout composes the app shell:

```
┌──────────────────────────────────────────────────────┐
│ [VerificationBanner — if unverified]                 │
├────────────┬─────────────────────────────────────────┤
│            │  [TopBar: org name/switcher + user menu]│
│  Sidebar   ├─────────────────────────────────────────┤
│  (nav)     │                                         │
│            │  [Page Content — children]               │
│            │                                         │
└────────────┴─────────────────────────────────────────┘
```

**Structure:**

```typescript
import { SessionProvider } from '@/components/providers/session-provider';
import { VerificationBanner } from '@/components/verification-banner';
import { AppSidebar } from './_components/app-sidebar';
import { TopBar } from './_components/top-bar';

export default async function DashboardLayout({ children, params }) {
  return (
    <SessionProvider>
      <VerificationBanner />
      <div className="flex flex-1">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <TopBar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
```

**Org context:** The dashboard is scoped to a specific org via the URL: `/dashboard/[orgSlug]/...`. The layout reads `orgSlug` from the route params, fetches the org, and validates the user is a member. If invalid, redirects to org selection.

Revised route structure:

```
src/app/(dashboard)/dashboard/[orgSlug]/
  layout.tsx          — fetches org, validates membership, provides org context
  page.tsx            — org dashboard (stat cards)
  members/
    page.tsx          — member list + management
    _components/
      member-table.tsx
      invite-dialog.tsx
      role-select.tsx
  settings/           — placeholder for future
    page.tsx
  hackathons/         — placeholder for future
    page.tsx
```

#### `src/app/(dashboard)/dashboard/page.tsx` — Org Selection / Redirect

If the user navigates to `/dashboard` (no org slug), this page:
1. Fetches user's orgs
2. If user has exactly one org → redirect to `/dashboard/[slug]`
3. If user has multiple orgs → show org picker
4. If user has zero orgs → show "Create Organization" prompt (disabled with verification message for unverified users)

---

### 3.11 App Shell — Sidebar (P3.R6)

#### `src/app/(dashboard)/_components/app-sidebar.tsx`

Uses shadcn's `Sidebar` component (collapsible). Navigation items:

| Icon | Label | Route | Visible To |
|------|-------|-------|-----------|
| LayoutDashboard | Dashboard | `/dashboard/[orgSlug]` | All |
| Trophy | Hackathons | `/dashboard/[orgSlug]/hackathons` | All |
| Users | Members | `/dashboard/[orgSlug]/members` | All (manage actions gated to org_admin) |
| Settings | Settings | `/dashboard/[orgSlug]/settings` | All (edit actions gated to org_admin) |

The sidebar highlights the active route. On mobile, it collapses into a sheet (hamburger menu trigger in the top bar).

---

### 3.12 App Shell — Top Bar (P3.R6, P3.R9)

#### `src/app/(dashboard)/_components/top-bar.tsx`

Contains:
- **Mobile sidebar trigger** (hamburger icon, visible on small screens)
- **Org switcher** (dropdown showing all orgs the user belongs to, with the current org highlighted). Only shown when user belongs to 2+ orgs. Links to `/dashboard/[otherOrgSlug]`.
- **Current org name** (displayed as breadcrumb or heading)
- **User menu** (dropdown): user name, email, separator, "Log out" button (calls `signOut()`)

Uses shadcn `DropdownMenu`, `Avatar`, `Separator`.

---

### 3.13 Org Dashboard Page (P3.R7)

#### `src/app/(dashboard)/dashboard/[orgSlug]/page.tsx`

Skeleton dashboard with placeholder stat cards:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Hackathons   │  │ Participants │  │ Upcoming     │
│      0       │  │      0       │  │   None       │
└─────────────┘  └─────────────┘  └─────────────┘
```

Uses shadcn `Card` components. Values are hardcoded to 0/None in V1 — wired to real data in Phase 2+.

**Co-located components:** `_components/stat-card.tsx`

---

### 3.14 Create Org Page (P3.R1, P3.R2)

#### `src/app/(dashboard)/dashboard/create-org/page.tsx`

Accessed when user has no orgs, or via a "Create new org" option.

- **Fields:** Organization Name, Slug (auto-generated from name, editable)
- **Validation:** Client-side via react-hook-form + zodResolver(createOrgSchema)
- **On submit:** POST to `/api/orgs`. On success, redirect to `/dashboard/[slug]`.
- **Requires verified email** — if unverified, show the form disabled with a message.

**Co-located components:** `_components/create-org-form.tsx`

---

### 3.15 Invite Accept Page (P3.R4)

#### `src/app/(auth)/invite/accept/page.tsx`

- **Route:** `/invite/accept?token=xxx`
- **On load:** If user is logged in and verified, auto-POST to `/api/invite/accept`. Show success → redirect to org dashboard.
- **If not logged in:** Show "Log in to accept this invite" with a link to `/login?callbackUrl=/invite/accept?token=xxx`.
- **If logged in but unverified:** Show "Verify your email to accept this invite".
- **If token is invalid/expired:** Show error with explanation.

This page lives under the `(auth)` route group since it's a transitional page, not part of the dashboard shell.

---

### 3.16 Member Management Page (P3.R5)

#### `src/app/(dashboard)/dashboard/[orgSlug]/members/page.tsx`

Displays a table of org members and provides management actions for org_admins.

**Member table columns:** Avatar, Name, Email, Role (badge), Joined Date, Actions (dropdown)

**Actions (visible to `org_admin` only):**
- **Change role** — opens a dialog with a role select dropdown
- **Remove from org** — opens a confirmation dialog

**Edge cases enforced at API level (also reflected in UI):**
- Cannot demote the last remaining `org_admin` — button disabled with tooltip
- Cannot remove the last remaining `org_admin` — button disabled with tooltip
- Cannot remove yourself (the current user must leave via a separate flow — deferred)

**Invite section:** Above the table, org_admins see an "Invite Member" button that opens a dialog (email + role selector). Members see a read-only list.

**Empty state:** "No members yet" (shouldn't happen — creator is always first member)

**Co-located components:**
- `_components/member-table.tsx` — client component, data table
- `_components/invite-dialog.tsx` — client component, invite form in a dialog
- `_components/role-select.tsx` — shared role dropdown (used in invite + change role)

---

### 3.17 Admin Panel (P3.R10)

#### `src/app/(dashboard)/admin/layout.tsx`

Admin layout — similar to dashboard but without org context. Server-side check: fetch session, verify `platformRole === 'super_admin'`, redirect to `/dashboard` if not.

#### `src/app/(dashboard)/admin/page.tsx`

Two tabs: **Organizations** and **Users**.

**Organizations tab:**
- Table: Name, Slug, Member Count, Created Date
- Read-only in V1 (no admin actions on orgs)

**Users tab:**
- Table: Name, Email, Platform Role (badge), Email Verified (icon), Created Date
- Read-only in V1 (no admin actions on users)

**Co-located components:**
- `_components/orgs-table.tsx`
- `_components/users-table.tsx`

Uses shadcn `Tabs`, `Table`, `Badge`.

---

### 3.18 Middleware Update (P3.R8, P3.R10)

Update `src/middleware.ts` to add `/admin` page protection (already in the matcher from Part 2 — the middleware redirects unauthenticated users). The `super_admin` role check happens at the layout/API level, not middleware (middleware only has the JWT, which has `platformRole` — but doing role redirects in middleware is fragile; better to check at the page level and show a 403 or redirect).

No changes to the middleware file itself — the existing matcher already covers `/admin/:path*`.

---

### 3.19 Implementation Increments

Part 3 is implemented in 4 increments.

#### Increment 1: Org Service + Org API Routes + Validation Schemas + Invite Email Template

**What:** Install shadcn components, create org validation schemas, add org invite email template, build the org service and admin service, create all org and admin API routes, add RBAC utilities.

**Files created/modified:**
- `src/components/ui/*` — new shadcn components (avatar, badge, dialog, dropdown-menu, select, separator, sheet, sidebar, skeleton, table, tabs, tooltip)
- `src/lib/validations/org.ts` — Zod schemas (createOrg, inviteMember, changeMemberRole, removeMember)
- `src/lib/utils.ts` — add `slugify()` helper
- `src/lib/email/templates.ts` — add `orgInviteEmail` template
- `src/lib/auth/constants.ts` — add `orgInvite` to `AUTH_EXPIRY_LABELS`
- `src/lib/auth/require-org-role.ts` — Org-level RBAC guard
- `src/lib/auth/require-super-admin.ts` — Platform-level super admin guard
- `src/lib/services/org-service.ts` — Org business logic
- `src/lib/services/admin-service.ts` — Admin panel queries
- `src/app/api/orgs/route.ts` — POST (create org), GET (list user orgs)
- `src/app/api/orgs/[orgId]/members/route.ts` — GET (list members)
- `src/app/api/orgs/[orgId]/members/invite/route.ts` — POST (invite)
- `src/app/api/orgs/[orgId]/members/[membershipId]/role/route.ts` — PATCH (change role)
- `src/app/api/orgs/[orgId]/members/[membershipId]/route.ts` — DELETE (remove)
- `src/app/api/invite/accept/route.ts` — POST (accept invite)
- `src/app/api/admin/orgs/route.ts` — GET (list all orgs)
- `src/app/api/admin/users/route.ts` — GET (list all users)

**Verify:** `tsc --noEmit` passes. Test create-org and invite APIs with curl.

#### Increment 2: App Shell — Dashboard Layout + Sidebar + Top Bar + SessionProvider

**What:** Build the SessionProvider wrapper, dashboard layout with sidebar and top bar, org switcher, user menu. Set up the `(dashboard)/dashboard/[orgSlug]` route structure.

**Files created/modified:**
- `src/components/providers/session-provider.tsx` — SessionProvider wrapper
- `src/app/(dashboard)/layout.tsx` — Outer dashboard layout (SessionProvider + VerificationBanner)
- `src/app/(dashboard)/dashboard/[orgSlug]/layout.tsx` — Org-scoped layout (fetches org, validates membership)
- `src/app/(dashboard)/dashboard/page.tsx` — Org selection / redirect page
- `src/app/(dashboard)/_components/app-sidebar.tsx` — Sidebar navigation
- `src/app/(dashboard)/_components/top-bar.tsx` — Top bar with org switcher and user menu

**Verify:** `tsc --noEmit` passes. Dashboard renders with sidebar and top bar. Org switcher shows user's orgs.

#### Increment 3: Org Dashboard + Create Org + Invite Accept + Member Management Pages

**What:** Build the org dashboard page (stat cards), create-org page, invite accept page, and member management page with invite dialog, role change, and remove actions.

**Files created/modified:**
- `src/app/(dashboard)/dashboard/[orgSlug]/page.tsx` — Org dashboard
- `src/app/(dashboard)/dashboard/[orgSlug]/_components/stat-card.tsx` — Stat card component
- `src/app/(dashboard)/dashboard/create-org/page.tsx` — Create org page
- `src/app/(dashboard)/dashboard/create-org/_components/create-org-form.tsx` — Create org form
- `src/app/(auth)/invite/accept/page.tsx` — Invite accept page
- `src/app/(dashboard)/dashboard/[orgSlug]/members/page.tsx` — Member management
- `src/app/(dashboard)/dashboard/[orgSlug]/members/_components/member-table.tsx` — Member table
- `src/app/(dashboard)/dashboard/[orgSlug]/members/_components/invite-dialog.tsx` — Invite dialog
- `src/app/(dashboard)/dashboard/[orgSlug]/members/_components/role-select.tsx` — Role select
- `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/page.tsx` — Placeholder
- `src/app/(dashboard)/dashboard/[orgSlug]/settings/page.tsx` — Placeholder

**Verify:** `tsc --noEmit` passes. Full flow: create org → see dashboard → invite member → member accepts → see member in table → change role → remove member.

#### Increment 4: Admin Panel + Loading/Empty States + End-of-Part Audit

**What:** Build the admin panel (orgs table, users table, tabs), add loading states (skeletons) and empty states to all pages, and run the end-of-part audit.

**Files created/modified:**
- `src/app/(dashboard)/admin/layout.tsx` — Admin layout with super_admin check
- `src/app/(dashboard)/admin/page.tsx` — Admin panel with tabs
- `src/app/(dashboard)/admin/_components/orgs-table.tsx` — Orgs data table
- `src/app/(dashboard)/admin/_components/users-table.tsx` — Users data table
- Various pages — add `loading.tsx` files for Suspense boundaries and skeleton UIs
- Various pages — add empty state components where applicable

**Verify:** `tsc --noEmit` passes. Super admin can access `/admin`. Non-super-admin is redirected. All pages have loading and empty states.

---

### 3.20 Files Changed Summary

| File | Action | Requirement |
|------|--------|-------------|
| `src/components/ui/*` (12 components) | Created | P3.R6, P3.R5, P3.R10 |
| `src/lib/validations/org.ts` | Created | P3.R1, P3.R3, P3.R5 |
| `src/lib/utils.ts` | Modified | P3.R1 (add slugify) |
| `src/lib/email/templates.ts` | Modified | P3.R3 (add orgInviteEmail) |
| `src/lib/auth/constants.ts` | Modified | P3.R3 (add orgInvite expiry label) |
| `src/lib/auth/require-org-role.ts` | Created | P3.R8 |
| `src/lib/auth/require-super-admin.ts` | Created | P3.R10 |
| `src/lib/services/org-service.ts` | Created | P3.R1, P3.R3, P3.R4, P3.R5 |
| `src/lib/services/admin-service.ts` | Created | P3.R10 |
| `src/app/api/orgs/route.ts` | Created | P3.R1 |
| `src/app/api/orgs/[orgId]/members/route.ts` | Created | P3.R5 |
| `src/app/api/orgs/[orgId]/members/invite/route.ts` | Created | P3.R3 |
| `src/app/api/orgs/[orgId]/members/[membershipId]/role/route.ts` | Created | P3.R5 |
| `src/app/api/orgs/[orgId]/members/[membershipId]/route.ts` | Created | P3.R5 |
| `src/app/api/invite/accept/route.ts` | Created | P3.R4 |
| `src/app/api/admin/orgs/route.ts` | Created | P3.R10 |
| `src/app/api/admin/users/route.ts` | Created | P3.R10 |
| `src/components/providers/session-provider.tsx` | Created | P3.R6 |
| `src/app/(dashboard)/layout.tsx` | Created | P3.R6 |
| `src/app/(dashboard)/dashboard/page.tsx` | Created | P3.R2 |
| `src/app/(dashboard)/dashboard/[orgSlug]/layout.tsx` | Created | P3.R6, P3.R8 |
| `src/app/(dashboard)/dashboard/[orgSlug]/page.tsx` | Created | P3.R7 |
| `src/app/(dashboard)/dashboard/[orgSlug]/_components/stat-card.tsx` | Created | P3.R7 |
| `src/app/(dashboard)/dashboard/create-org/page.tsx` | Created | P3.R1 |
| `src/app/(dashboard)/dashboard/create-org/_components/create-org-form.tsx` | Created | P3.R1 |
| `src/app/(auth)/invite/accept/page.tsx` | Created | P3.R4 |
| `src/app/(dashboard)/dashboard/[orgSlug]/members/page.tsx` | Created | P3.R5 |
| `src/app/(dashboard)/dashboard/[orgSlug]/members/_components/member-table.tsx` | Created | P3.R5 |
| `src/app/(dashboard)/dashboard/[orgSlug]/members/_components/invite-dialog.tsx` | Created | P3.R3 |
| `src/app/(dashboard)/dashboard/[orgSlug]/members/_components/role-select.tsx` | Created | P3.R5 |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/page.tsx` | Created | P3.R6 (placeholder) |
| `src/app/(dashboard)/dashboard/[orgSlug]/settings/page.tsx` | Created | P3.R6 (placeholder) |
| `src/app/(dashboard)/admin/layout.tsx` | Created | P3.R10 |
| `src/app/(dashboard)/admin/page.tsx` | Created | P3.R10 |
| `src/app/(dashboard)/admin/_components/orgs-table.tsx` | Created | P3.R10 |
| `src/app/(dashboard)/admin/_components/users-table.tsx` | Created | P3.R10 |
| `src/middleware.ts` | Unchanged | P3.R8 (already covers /admin) |

---

*Phase 1 TRD is now complete. After Part 3 implementation, update `docs/004-architecture.md` with the final folder structure and `CHANGELOG.md` with the Phase 1 summary.*
