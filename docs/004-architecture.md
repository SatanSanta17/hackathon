# HackForge — Architecture

**Document ID:** ARCH-004  
**Date:** April 16, 2026  
**Status:** Phase 1 Complete (Foundation + Auth + Org Management + Admin)  
**Update Frequency:** Every development phase

---

## System Overview

HackForge is a multi-tenant hackathon management platform deployed as a Next.js application on Vercel, backed by PostgreSQL (via Supabase) and object storage (via Supabase Storage).

```
┌─────────────────────────────────────────────────────┐
│                     VERCEL                          │
│  ┌───────────────────────────────────────────────┐  │
│  │              Next.js Application              │  │
│  │  ┌─────────────-┐  ┌──────────────────────┐   │  │
│  │  │  App Router  │  │   API Routes /       │   │  │
│  │  │  (SSR/RSC)   │  │   Server Actions     │   │  │
│  │  └──────┬───────┘  └──────────┬───────────┘   │  │
│  │         │                     │               │  │
│  │         │    ┌────────────────┤               │  │
│  │         │    │    NextAuth.js │               │  │
│  │         │    │    (JWT Auth)  │               │  │
│  │         │    └────────────────┤               │  │
│  │         │                     │               │  │
│  │         │         ┌───────────▼────────────┐  │  │
│  │         │         │    Service Layer       │  │  │
│  │         │         │  (lib/services/*.ts)   │  │  │
│  │         │         └───────────┬────────────┘  │  │
│  │         │                     │               │  │
│  │         │         ┌───────────▼────────────┐  │  │
│  │         │         │     Drizzle ORM        │  │  │
│  │         │         │  (db/schema/*.ts)      │  │  │
│  │         │         └───────────┬────────────┘  │  │
│  └─────────┼─────────────────────┼───────────────┘  │
└────────────┼─────────────────────┼──────────────────┘
             │                     │
     ┌────────▼──────┐    ┌────────▼──────────┐
     │  Supabase     │    │  Supabase         │
     │  Storage      │    │  PostgreSQL       │
     │  (files)      │    │  (data)           │
     └───────────────┘    └───────────────────┘
              │
     ┌────────▼──────┐
     │  Resend       │
     │  (email)      │
     └───────────────┘
```

### Request Flow

1. **Browser** → Vercel Edge → Next.js App Router (Server Components render on server)
2. **Client interaction** → API Route / Server Action → NextAuth session check → Service Layer → Drizzle → PostgreSQL
3. **File upload** → Client generates signed URL via API → uploads directly to Supabase Storage (bypasses serverless functions)
4. **Email** → Service Layer → Resend API (async, non-blocking)

### Authorization Flow

1. NextAuth middleware intercepts all `/dashboard/*` routes — redirects to `/login` if no session
2. API routes call `auth()` to get session — returns 401 if missing
3. Service layer receives `orgId` and `userId` from the API route — scopes all queries to the org
4. No RLS — authorization is enforced entirely in the application layer

---

## Folder Structure

> **Note:** This section reflects what CURRENTLY EXISTS in the codebase. It is updated after each development phase. Do not pre-fill with planned-but-unbuilt structures.

```
hackforge/                              # PROJECT ROOT
├── .env.example                        # Environment variable template
├── CLAUDE.md                           # Session bootstrap for AI assistants
├── CHANGELOG.md                        # What shipped, when
├── components.json                     # shadcn configuration (radix-nova)
├── docs/                               # Project documentation
│   ├── 000-project-context.md
│   ├── 001-technical-decisions.md
│   ├── 002-v1-development-phases.md
│   ├── 003-coding-conventions.md
│   ├── 004-architecture.md             # ← THIS FILE
│   ├── 005-development-workflow.md
│   └── 006-foundation-auth/            # Phase 1 PRD + TRD
│       ├── prd.md
│       └── trd.md
├── drizzle.config.ts                   # Drizzle Kit configuration
├── eslint.config.mjs                   # ESLint 9 flat config
├── next.config.ts                      # Next.js 16 configuration
├── postcss.config.mjs                  # PostCSS config (@tailwindcss/postcss)
├── tsconfig.json                       # TypeScript strict mode config
└── src/
    ├── middleware.ts                    # NextAuth route protection (/dashboard/*)
    ├── hooks/
    │   └── use-mobile.ts               # Mobile breakpoint detection hook
    ├── app/
    │   ├── globals.css                 # Dual-tone design tokens (admin + competitive)
    │   ├── layout.tsx                  # Root layout (Geist + Space Grotesk fonts, Toaster)
    │   ├── page.tsx                    # Temporary landing page
    │   │
    │   ├── (auth)/                     # Auth route group (unauthenticated)
    │   │   ├── layout.tsx              # Centered card layout
    │   │   ├── login/
    │   │   │   ├── page.tsx
    │   │   │   └── _components/
    │   │   │       └── login-form.tsx
    │   │   ├── signup/
    │   │   │   ├── page.tsx
    │   │   │   └── _components/
    │   │   │       └── signup-form.tsx
    │   │   ├── check-email/
    │   │   │   └── page.tsx            # Post-signup confirmation
    │   │   ├── verify-email/
    │   │   │   └── page.tsx            # Token verification handler
    │   │   ├── forgot-password/
    │   │   │   ├── page.tsx
    │   │   │   └── _components/
    │   │   │       └── forgot-password-form.tsx
    │   │   ├── reset-password/
    │   │   │   ├── page.tsx
    │   │   │   └── _components/
    │   │   │       └── reset-password-form.tsx
    │   │   └── invite/
    │   │       └── accept/
    │   │           └── page.tsx        # Org invite acceptance handler
    │   │
    │   ├── (dashboard)/                # Protected route group (authenticated)
    │   │   ├── layout.tsx              # SessionProvider + SidebarProvider + VerificationBanner
    │   │   ├── _components/
    │   │   │   ├── app-sidebar.tsx      # Navigation sidebar (org-scoped)
    │   │   │   └── top-bar.tsx          # Org switcher + user menu + mobile trigger
    │   │   ├── dashboard/
    │   │   │   ├── page.tsx             # Org picker / redirect / welcome
    │   │   │   ├── loading.tsx          # Skeleton for org picker
    │   │   │   ├── create-org/
    │   │   │   │   ├── page.tsx
    │   │   │   │   └── _components/
    │   │   │   │       └── create-org-form.tsx
    │   │   │   └── [orgSlug]/
    │   │   │       ├── layout.tsx       # Org validation + sidebar + top bar
    │   │   │       ├── loading.tsx      # Dashboard skeleton
    │   │   │       ├── page.tsx         # Org dashboard (stat cards)
    │   │   │       ├── _components/
    │   │   │       │   └── stat-card.tsx
    │   │   │       ├── members/
    │   │   │       │   ├── page.tsx
    │   │   │       │   ├── loading.tsx  # Members table skeleton
    │   │   │       │   └── _components/
    │   │   │       │       ├── member-table.tsx
    │   │   │       │       ├── invite-dialog.tsx
    │   │   │       │       └── role-select.tsx
    │   │   │       ├── hackathons/
    │   │   │       │   └── page.tsx     # Placeholder (Phase 2)
    │   │   │       └── settings/
    │   │   │           └── page.tsx     # Placeholder (future phase)
    │   │   └── admin/
    │   │       ├── layout.tsx           # Super-admin gate
    │   │       ├── loading.tsx          # Admin skeleton
    │   │       ├── page.tsx             # Tabs: Organizations + Users
    │   │       └── _components/
    │   │           ├── orgs-table.tsx
    │   │           └── users-table.tsx
    │   │
    │   ├── (public)/                   # Public pages (Phase 2+ — empty)
    │   │
    │   └── api/
    │       ├── auth/
    │       │   ├── [...nextauth]/route.ts   # NextAuth catch-all handler
    │       │   ├── signup/route.ts
    │       │   ├── verify-email/route.ts
    │       │   ├── resend-verification/route.ts
    │       │   ├── forgot-password/route.ts
    │       │   └── reset-password/route.ts
    │       ├── orgs/
    │       │   ├── route.ts                 # POST create / GET list user orgs
    │       │   └── [orgId]/
    │       │       └── members/
    │       │           ├── route.ts          # GET list members
    │       │           ├── invite/
    │       │           │   └── route.ts      # POST invite member
    │       │           └── [membershipId]/
    │       │               ├── route.ts      # DELETE remove member
    │       │               └── role/
    │       │                   └── route.ts  # PATCH change role
    │       ├── invite/
    │       │   └── accept/
    │       │       └── route.ts             # POST accept org invite
    │       └── admin/
    │           ├── orgs/route.ts            # GET list all orgs (super_admin)
    │           └── users/route.ts           # GET list all users (super_admin)
    │
    ├── components/
    │   ├── providers/
    │   │   └── session-provider.tsx     # NextAuth SessionProvider wrapper
    │   ├── verification-banner.tsx      # Email verification reminder banner
    │   └── ui/                         # shadcn/ui components (radix-nova)
    │       ├── avatar.tsx
    │       ├── badge.tsx
    │       ├── button.tsx
    │       ├── card.tsx
    │       ├── dialog.tsx
    │       ├── dropdown-menu.tsx
    │       ├── form/                   # Custom form primitives
    │       │   ├── index.ts            # Barrel export
    │       │   ├── form-field.tsx      # Generic FormField<T> wrapper
    │       │   ├── form-message.tsx    # Error message display
    │       │   └── form-password-field.tsx  # Password with toggle
    │       ├── input.tsx
    │       ├── label.tsx
    │       ├── select.tsx
    │       ├── separator.tsx
    │       ├── sheet.tsx
    │       ├── sidebar.tsx
    │       ├── skeleton.tsx
    │       ├── sonner.tsx
    │       ├── table.tsx
    │       ├── tabs.tsx
    │       └── tooltip.tsx
    │
    ├── db/
    │   ├── index.ts                    # Drizzle client instance (postgres.js driver)
    │   ├── schema/
    │   │   ├── index.ts                # Barrel export
    │   │   ├── enums.ts                # platform_role, org_role
    │   │   ├── users.ts                # users table + User/NewUser types
    │   │   ├── organizations.ts        # organizations table + types
    │   │   ├── org-memberships.ts      # org_memberships table + types
    │   │   ├── org-invites.ts          # org_invites table + types
    │   │   └── verification-tokens.ts  # verification_tokens table + types
    │   └── migrations/                 # Drizzle-kit generated SQL migrations
    │
    └── lib/
        ├── utils.ts                    # cn() + slugify() helpers
        ├── auth/
        │   ├── auth.ts                 # NextAuth v5 config (Credentials, JWT, callbacks)
        │   ├── constants.ts            # AUTH_CONSTANTS + AUTH_EXPIRY_LABELS
        │   ├── types.ts                # VerifiedUser, session/JWT augmentations
        │   ├── require-verified.ts     # requireVerifiedUser() API guard
        │   ├── require-org-role.ts     # requireOrgRole() API guard
        │   └── require-super-admin.ts  # requireSuperAdmin() API guard
        ├── email/
        │   ├── index.ts               # getEmailService() factory
        │   ├── types.ts               # EmailService interface + EmailTemplate type
        │   ├── templates.ts           # Email HTML builders (verify, reset, invite)
        │   └── adapters/
        │       └── resend-adapter.ts  # ResendEmailAdapter implementation
        ├── services/
        │   ├── auth-service.ts        # Signup, verify, password reset logic
        │   ├── token-service.ts       # SHA-256 token generation + hashing
        │   ├── org-service.ts         # Org CRUD, membership, invites
        │   └── admin-service.ts       # Platform-wide queries (super_admin)
        ├── storage/                    # StorageProvider interface (Phase 4 — empty)
        └── validations/
            ├── auth.ts                # Zod schemas: signup, login, forgot/reset password
            └── org.ts                 # Zod schemas: createOrg, invite, changeRole, remove
```

---

## Data Model

> **Note:** Core Tables below reflect the ACTUAL implemented schema (Phase 1). Tables marked "Planned" are not yet built.

### Core Tables (Phase 1 — Implemented)

**organizations**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| name | text | NOT NULL |
| slug | text | UNIQUE, NOT NULL |
| logo_url | text | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |
| deleted_at | timestamptz | nullable (soft delete) |

**users**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| email | text | UNIQUE, NOT NULL |
| name | text | NOT NULL |
| password_hash | text | NOT NULL |
| avatar_url | text | nullable |
| email_verified | boolean | NOT NULL, default false |
| platform_role | platform_role enum | NOT NULL, default 'user' (user, super_admin) |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | nullable (soft delete) |

**org_memberships**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| user_id | uuid | FK → users.id, NOT NULL, indexed |
| org_id | uuid | FK → organizations.id, NOT NULL, indexed |
| role | org_role enum | NOT NULL (org_admin, member) |
| invited_at | timestamptz | nullable |
| joined_at | timestamptz | nullable |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | nullable (soft delete) |

**org_invites**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| org_id | uuid | FK → organizations.id, NOT NULL |
| email | text | NOT NULL, indexed |
| role | org_role enum | NOT NULL |
| token | text | NOT NULL, UNIQUE, indexed (SHA-256 hash) |
| invited_by | uuid | FK → users.id, NOT NULL |
| expires_at | timestamptz | NOT NULL |
| accepted_at | timestamptz | nullable |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

**verification_tokens**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| user_id | uuid | FK → users.id, NOT NULL, indexed |
| token | text | NOT NULL (SHA-256 hash) |
| type | text | NOT NULL ('email_verification' or 'password_reset') |
| expires_at | timestamptz | NOT NULL |
| used_at | timestamptz | nullable |
| created_at | timestamptz | NOT NULL, default now() |

### Hackathon Tables (Phase 2 — Planned)

**hackathons**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_id | uuid | FK → organizations.id |
| title | text | NOT NULL |
| slug | text | UNIQUE within org |
| description | text | nullable |
| cover_image_key | text | StorageProvider key |
| status | hackathon_status enum | draft, published, active, judging, completed, archived |
| template_type | template_type enum | idea_sprint, build_and_ship, innovation_pipeline, open_challenge |
| visibility | visibility enum | public, org_only, invite_only |
| team_min_size | integer | default 1 |
| team_max_size | integer | default 5 |
| allow_individual | boolean | default true |
| created_by | uuid | FK → users.id |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz | nullable |

**phases**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| hackathon_id | uuid | FK → hackathons.id |
| name | text | NOT NULL |
| type | phase_type enum | registration, submission, screening, mentorship, judging, results |
| order | integer | Phase sequence |
| start_date | timestamptz | |
| end_date | timestamptz | |
| config | jsonb | Phase-specific settings |
| status | phase_status enum | upcoming, active, completed |

**tracks**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| hackathon_id | uuid | FK → hackathons.id |
| name | text | NOT NULL |
| description | text | nullable |
| resources_url | text | nullable |

**prizes**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| hackathon_id | uuid | FK → hackathons.id |
| name | text | NOT NULL |
| description | text | nullable |
| rank | integer | 1st, 2nd, 3rd, etc. |
| image_key | text | nullable |

### Registration & Teams (Phase 3 — Planned)

**registrations**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| hackathon_id | uuid | FK |
| user_id | uuid | FK |
| status | registration_status enum | pending, approved, rejected |
| form_data | jsonb | Custom field responses |
| registered_at | timestamptz | |

**teams**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| hackathon_id | uuid | FK |
| name | text | NOT NULL |
| description | text | nullable |
| invite_code | text | UNIQUE |
| track_id | uuid | FK → tracks.id, nullable |
| created_by | uuid | FK → users.id |
| created_at | timestamptz | |

**team_members**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| team_id | uuid | FK → teams.id |
| user_id | uuid | FK → users.id |
| role | team_role enum | lead, member |
| joined_at | timestamptz | |

### Submissions (Phase 4 — Planned)

**submissions**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| team_id | uuid | FK |
| phase_id | uuid | FK |
| hackathon_id | uuid | FK |
| status | submission_status enum | draft, submitted, late, withdrawn |
| submitted_at | timestamptz | nullable |
| updated_at | timestamptz | |

**submission_fields**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| submission_id | uuid | FK |
| field_name | text | e.g., "title", "description", "demo_url" |
| field_type | text | text, url, file |
| value | text | nullable |
| file_key | text | nullable (StorageProvider key) |

### Judging (Phase 5 — Planned)

**evaluation_criteria**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| hackathon_id | uuid | FK |
| phase_id | uuid | FK |
| name | text | e.g., "Innovation" |
| description | text | nullable |
| weight | integer | Percentage (all must sum to 100) |
| max_score | integer | default 10 |
| order | integer | Display order |

**judge_assignments**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| hackathon_id | uuid | FK |
| judge_user_id | uuid | FK → users.id |
| track_id | uuid | FK, nullable (null = all tracks) |
| assigned_by | uuid | FK → users.id |
| assigned_at | timestamptz | |

**evaluations**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| submission_id | uuid | FK |
| judge_user_id | uuid | FK |
| criteria_scores | jsonb | [{criterion_id, score, comment}] |
| total_score | decimal | Weighted total |
| feedback | text | Overall feedback |
| status | eval_status enum | pending, in_progress, completed |
| evaluated_at | timestamptz | nullable |

### Notifications (Phase 6 — Planned)

**notifications**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK |
| hackathon_id | uuid | FK, nullable |
| type | notification_type enum | registration, submission, judging, result, announcement |
| title | text | |
| body | text | |
| read | boolean | default false |
| link | text | nullable (in-app navigation) |
| created_at | timestamptz | |

---

## Enums

### Implemented (Phase 1)
```
platform_role: user, super_admin
org_role: org_admin, member
```

### Planned (Phase 2+)
```
hackathon_status: draft, published, active, judging, completed, archived
template_type: idea_sprint, build_and_ship, innovation_pipeline, open_challenge
visibility: public, org_only, invite_only
phase_type: registration, submission, screening, mentorship, judging, results
phase_status: upcoming, active, completed
registration_status: pending, approved, rejected
team_role: lead, member
submission_status: draft, submitted, late, withdrawn
eval_status: pending, in_progress, completed
notification_type: registration, submission, judging, result, announcement
```

---

## Environment Variables

| Variable | Context | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Server | Supabase Postgres connection string (pooled) |
| `DIRECT_URL` | Server | Supabase Postgres direct connection (for migrations) |
| `NEXTAUTH_SECRET` | Server | Random string for JWT signing |
| `NEXTAUTH_URL` | Server | Base URL of the app (e.g., http://localhost:3000) |
| `NEXT_PUBLIC_APP_URL` | Client | Public-facing base URL |
| `SUPABASE_STORAGE_URL` | Server | Supabase Storage endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | For storage operations |
| `RESEND_API_KEY` | Server | Resend email service API key |
| `FROM_EMAIL` | Server | Sender email address |

---

*This document reflects what EXISTS in the codebase as of Phase 1 completion (April 16, 2026). It is updated after each development phase. Planned tables will be validated against actual implementation during their respective phases.*
