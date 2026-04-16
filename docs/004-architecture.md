# HackForge — Architecture

**Document ID:** ARCH-004  
**Date:** April 15, 2026  
**Status:** Pre-Build (will be updated every phase)  
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
    ├── app/
    │   ├── (auth)/                     # Auth pages (Part 2 — empty)
    │   ├── (dashboard)/                # Protected app routes (Part 3 — empty)
    │   ├── (public)/                   # Public pages (Phase 2+ — empty)
    │   ├── api/                        # API route handlers (Part 2+ — empty)
    │   ├── globals.css                 # Dual-tone design tokens (admin + competitive)
    │   ├── layout.tsx                  # Root layout (Geist + Space Grotesk fonts, Toaster)
    │   └── page.tsx                    # Temporary landing page
    ├── components/
    │   └── ui/                         # shadcn components (button, card, input, label, sonner)
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
    │   └── migrations/                 # Drizzle-kit generated migrations
    ├── lib/
    │   ├── auth/                       # NextAuth config + helpers (Part 2 — empty)
    │   ├── email/                      # Resend client + templates (Part 2 — empty)
    │   ├── hooks/                      # Custom React hooks (Part 3 — empty)
    │   ├── services/                   # Business logic (Part 2+ — empty)
    │   ├── storage/                    # StorageProvider interface (Phase 4 — empty)
    │   ├── utils.ts                    # cn() helper (shadcn)
    │   └── validations/                # Shared Zod schemas (Part 2 — empty)
    └── types/                          # Global TypeScript types (Part 2 — empty)
```

---

## Data Model

> **Note:** This section will be populated with actual table definitions during Phase 1. Below is the planned schema for reference.

### Core Tables (Phase 1)

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
| email_verified | boolean | default false |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |
| deleted_at | timestamptz | nullable |

**org_memberships**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| org_id | uuid | FK → organizations.id |
| role | org_role enum | super_admin, org_admin, member |
| invited_at | timestamptz | nullable |
| joined_at | timestamptz | nullable |

### Hackathon Tables (Phase 2)

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

### Registration & Teams (Phase 3)

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

### Submissions (Phase 4)

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

### Judging (Phase 5)

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

### Notifications (Phase 6)

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

```
org_role: super_admin, org_admin, member
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

*This document reflects what EXISTS in the codebase. It is updated after each development phase. The planned schema above will be validated against actual implementation during each phase.*
