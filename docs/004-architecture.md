# HackForge — Architecture

**Document ID:** ARCH-004  
**Date:** April 18, 2026  
**Status:** Phase 3.5 Parts 1–2 Complete + Convention Audit (Core Hardening)  
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
│   ├── 006-foundation-auth/            # Phase 1 PRD + TRD
│   │   ├── prd.md
│   │   └── trd.md
│   ├── 007-hackathon-creation/         # Phase 2 PRD + TRD
│   │   ├── prd.md
│   │   └── trd.md
│   ├── 008-registration-teams/         # Phase 3 PRD + TRD
│   │   ├── prd.md
│   │   └── trd.md
│   └── 009-core-hardening/             # Phase 3.5 PRD + TRD
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
    │   │   │       ├── page.tsx         # Org dashboard (real hackathon stats)
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
    │   │   │       │   ├── page.tsx     # Hackathon list (server: fetches hackathons + role)
    │   │   │       │   ├── loading.tsx  # Hackathon list skeleton
    │   │   │       │   ├── _components/
    │   │   │       │   │   └── hackathon-list.tsx  # Client: filters, cards, context menu, actions
    │   │   │       │   ├── create/
    │   │   │       │   │   ├── page.tsx  # Wizard entry (server: auth + draft detection + templates)
    │   │   │       │   │   └── _components/
    │   │   │       │   │       ├── wizard-shell.tsx       # 9-step indicator + navigation + state manager
    │   │   │       │   │       ├── step-template.tsx      # Step 1: Choose Template
    │   │   │       │   │       ├── step-basic-info.tsx    # Step 2: Title, desc, cover, slug
    │   │   │       │   │       ├── step-tracks.tsx        # Step 3: Tracks (DnD reorder)
    │   │   │       │   │       ├── step-timeline.tsx      # Step 4: Phase dates
    │   │   │       │   │       ├── step-team-rules.tsx    # Step 5: Team size, visibility
    │   │   │       │   │       ├── step-participation.tsx # Step 6: Requires-approval + custom reg fields (DnD)
    │   │   │       │   │       ├── step-prizes.tsx        # Step 7: Prizes (DnD reorder)
    │   │   │       │   │       ├── step-rules-faqs.tsx    # Step 8: Tiptap rich text editors
    │   │   │       │   │       ├── step-review.tsx        # Step 9: Review & Publish
    │   │   │       │   │       ├── image-crop-modal.tsx   # 16:9 cover image cropper
    │   │   │       │   │       └── tiptap-editor.tsx      # Reusable Tiptap editor w/ toolbar
    │   │   │       │   └── [hackathonId]/
    │   │   │       │       ├── edit/
    │   │   │       │       │   └── page.tsx  # Edit wizard (server: loads hackathon + registrationFields)
    │   │   │       │       ├── participants/
    │   │   │       │       │   ├── page.tsx     # Admin roster: registered vs participating counts, CSV export, sub-nav
    │   │   │       │       │   ├── loading.tsx  # Table skeleton
    │   │   │       │       │   └── _components/
    │   │   │       │       │       └── participants-table.tsx  # Client: search + team/track filters + custom fields
    │   │   │       │       └── teams/
    │   │   │       │           ├── page.tsx     # Admin team list (org_admin gated): all teams + approve/reject queue, sub-nav
    │   │   │       │           ├── loading.tsx  # Table skeleton
    │   │   │       │           └── _components/
    │   │   │       │               └── admin-teams-client.tsx  # Pending Review section + full table with filters (client)
    │   │   │       ├── my-hackathons/
    │   │   │       │   ├── page.tsx     # Registered hackathons for current user with signed cover images
    │   │   │       │   ├── loading.tsx  # Card grid skeleton
    │   │   │       │   └── _components/
    │   │   │       │       └── my-hackathon-card.tsx  # Card: cover, status badge, team state, profile nudge
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
    │   ├── (public)/                   # Public pages (no auth required)
    │   │   ├── layout.tsx              # Competitive dark theme wrapper (.theme-competitive)
    │   │   ├── hackathons/
    │   │   │   └── [slug]/
    │   │   │       ├── page.tsx         # Landing page (SSR + generateMetadata for SEO/OG)
    │   │   │       ├── not-found.tsx    # Styled 404 for invalid/draft/archived slugs
    │   │   │       ├── _components/
    │   │   │       │   ├── landing-hero.tsx            # Cover image/gradient, title, status, RegistrationCta
    │   │   │       │   ├── registration-cta.tsx        # 8-variant CtaState button + modal host (client)
    │   │   │       │   ├── auth-registration-modal.tsx # 4-mode dialog: auth → signup → register → success (client)
    │   │   │       │   ├── registration-form.tsx       # Dynamic reg form with custom fields + discoverability (client)
    │   │   │       │   ├── profile-nudge-banner.tsx    # Dismissible amber nudge for incomplete profile (client)
    │   │   │       │   ├── share-buttons.tsx           # Copy Link, X, LinkedIn, WhatsApp (client)
    │   │   │       │   ├── landing-about.tsx           # Description section
    │   │   │       │   ├── landing-tracks.tsx          # Track cards (single inline / multi grid)
    │   │   │       │   ├── landing-timeline.tsx        # Horizontal (lg+) / vertical timeline
    │   │   │       │   ├── landing-prizes.tsx          # Prize cards with rank styling
    │   │   │       │   ├── landing-rules.tsx           # Rich text (prose prose-invert)
    │   │   │       │   ├── landing-faqs.tsx            # Accordion with CSS grid animation (client)
    │   │   │       │   ├── landing-nav.tsx             # Sticky scroll-spy nav (client)
    │   │   │       │   └── landing-footer.tsx          # "Powered by HackForge"
    │   │   │       ├── teams/
    │   │   │       │   ├── page.tsx         # Team browse (public); CreateTeamButton shown when registered+unteamed
    │   │   │       │   ├── loading.tsx      # Card grid skeleton
    │   │   │       │   ├── _components/
    │   │   │       │   │   ├── create-team-button.tsx   # Client wrapper holding modal open state
    │   │   │       │   │   ├── create-team-modal.tsx    # Create team dialog: name/desc/track/open (client)
    │   │   │       │   │   ├── team-browse-client.tsx   # Fetch teams + track pill filter (client)
    │   │   │       │   │   ├── team-browse-card.tsx     # Card with role-aware join CTA (client)
    │   │   │       │   │   └── join-request-dialog.tsx  # Optional message textarea → POST join-request (client)
    │   │   │       │   ├── [teamId]/
    │   │   │       │   │   ├── page.tsx         # Team profile (auth required, redirects to login)
    │   │   │       │   │   ├── loading.tsx      # Profile skeleton
    │   │   │       │   │   └── _components/
    │   │   │       │   │       ├── team-profile-client.tsx    # All sections: header, alerts, members, actions, join link, requests (client)
    │   │   │       │   │       ├── edit-team-dialog.tsx       # Edit name/desc/track/open (lead, client)
    │   │   │       │   │       ├── invite-by-email-dialog.tsx # Email invite (lead, client)
    │   │   │       │   │       └── transfer-lead-dialog.tsx   # Select new lead from members (lead, client)
    │   │   │       │   └── join/
    │   │   │       │       ├── page.tsx         # Join via invite link (?code=); fetches memberCount separately
    │   │   │       │       └── _components/
    │   │   │       │           └── join-link-client.tsx  # Closed/full/requested/auth states (client)
    │   │   │       └── participants/
    │   │   │           ├── page.tsx         # Discoverable participants browse (auth required)
    │   │   │           ├── loading.tsx      # Skeleton grid
    │   │   │           └── _components/
    │   │   │               ├── participants-browse-client.tsx  # Fetch + useMemo search; excludes viewer (client)
    │   │   │               ├── participant-card.tsx            # Initials avatar, formData fields, Team Up / Invite CTA (client)
    │   │   │               └── team-up-dialog.tsx              # Proposed team name + message → POST /team-up (client)
    │   │   └── team-invites/
    │   │       └── accept/
    │   │           ├── page.tsx         # Email invite acceptance (?token=); InvalidInvitePage for bad states
    │   │           └── _components/
    │   │               └── team-invite-accept-client.tsx  # Accept button (auth) / login+signup CTAs (unauth); shows team-full banner on 409
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
    │       ├── hackathons/
    │       │   ├── route.ts                 # POST create draft from template
    │       │   └── [hackathonId]/
    │       │       ├── route.ts             # PATCH update hackathon fields
    │       │       ├── publish/
    │       │       │   └── route.ts         # POST publish hackathon
    │       │       ├── transition/
    │       │       │   └── route.ts         # POST manual status transition (publish/archive)
    │       │       ├── delete/
    │       │       │   └── route.ts         # POST soft-delete draft hackathon
    │       │       ├── tracks/
    │       │       │   ├── route.ts         # POST add track
    │       │       │   └── [trackId]/
    │       │       │       └── route.ts     # PATCH edit / DELETE remove track
    │       │       ├── phases/
    │       │       │   └── [phaseId]/
    │       │       │       └── route.ts     # PATCH update phase dates/name
    │       │       ├── prizes/
    │       │       │   ├── route.ts         # POST add prize
    │       │       │   └── [prizeId]/
    │       │       │       └── route.ts     # PATCH edit / DELETE remove prize
    │       │       ├── register/
    │       │       │   └── route.ts         # POST register participant (201/409/403)
    │       │       ├── registration/
    │       │       │   └── route.ts         # GET own registration status / PATCH update profile
    │       │       ├── registration-fields/
    │       │       │   └── route.ts         # GET fields (public) / POST upsert (admin)
    │       │       └── registrations/
    │       │           ├── route.ts         # GET full roster with user + team info (admin)
    │       │           └── export/
    │       │               └── route.ts     # GET CSV download with custom field columns (admin)
    │       ├── hackathons/ (continued)
    │       │   └── [hackathonId]/
    │       │       ├── teams/
    │       │       │   ├── route.ts         # GET browse (public) / POST create team (auth)
    │       │       │   ├── all/
    │       │       │   │   └── route.ts     # GET all teams (org_admin); supports trackId/isOpen/adminStatus filters
    │       │       │   └── [teamId]/
    │       │       │       ├── route.ts     # GET team details (auth, strips inviteCode for non-members) / PATCH update (lead)
    │       │       │       ├── approve/
    │       │       │       │   └── route.ts # POST approve team (org_admin); guards pending_review status
    │       │       │       ├── reject/
    │       │       │       │   └── route.ts # POST reject team (org_admin); no status precondition
    │       │       │       ├── join-request/
    │       │       │       │   └── route.ts # POST send join request (validates isOpen + size)
    │       │       │       ├── join-requests/
    │       │       │       │   ├── route.ts # GET pending requests (lead only)
    │       │       │       │   └── [requestId]/
    │       │       │       │       └── route.ts  # PATCH approve/reject (lead, passes teamMaxSize)
    │       │       │       ├── invite/
    │       │       │       │   └── route.ts # POST invite by email (lead only)
    │       │       │       ├── leave/
    │       │       │       │   └── route.ts # POST leave team (auto-transfer + dissolve-if-last)
    │       │       │       └── transfer-lead/
    │       │       │           └── route.ts # POST transfer leadership (lead only)
    │       │       ├── participants/
    │       │       │   └── route.ts         # GET discoverable unteamed participants (auth, excludes self)
    │       │       ├── team-up/
    │       │       │   └── route.ts         # POST create team-up request
    │       │       └── team-up-requests/
    │       │           ├── route.ts         # GET incoming pending team-up requests (auth)
    │       │           └── [requestId]/
    │       │               └── route.ts     # PATCH accept/reject (recipient only)
    │       ├── teams/
    │       │   └── by-invite-code/
    │       │       └── [inviteCode]/
    │       │           └── route.ts         # GET team by invite code (public, never exposes inviteCode)
    │       ├── team-invites/
    │       │   └── accept/
    │       │       └── route.ts             # POST accept email invite by raw token (auth); verifies session user email matches invite recipient
    │       ├── user/
    │       │   └── hackathons/
    │       │       └── route.ts             # GET current user's registered hackathons
    │       ├── upload/
    │       │   └── image/
    │       │       └── route.ts             # POST upload image (cover/prize)
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
    │       ├── alert.tsx
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
    │       ├── switch.tsx
    │       ├── table.tsx
    │       ├── tabs.tsx
    │       ├── textarea.tsx
    │       └── tooltip.tsx
    │
    ├── db/
    │   ├── index.ts                    # Drizzle client instance (postgres.js driver)
    │   ├── schema/
    │   │   ├── index.ts                # Barrel export
    │   │   ├── enums.ts                # All enums (Phase 1 + Phase 2 + Phase 3)
    │   │   ├── users.ts                # users table + User/NewUser types
    │   │   ├── organizations.ts        # organizations table + types
    │   │   ├── org-memberships.ts      # org_memberships table + types
    │   │   ├── org-invites.ts          # org_invites table + types
    │   │   ├── verification-tokens.ts  # verification_tokens table + types
    │   │   ├── hackathons.ts           # hackathons table + types (incl. requires_approval)
    │   │   ├── phases.ts               # phases table + Phase/NewPhase types
    │   │   ├── tracks.ts               # tracks table + Track/NewTrack types
    │   │   ├── prizes.ts               # prizes table + Prize/NewPrize types
    │   │   ├── hackathon-templates.ts  # hackathon_templates table + types
    │   │   ├── registrations.ts        # registrations table + types (Phase 3)
    │   │   ├── registration-fields.ts  # registration_fields table + types (Phase 3)
    │   │   ├── teams.ts                # teams table + types (Phase 3)
    │   │   ├── team-members.ts         # team_members table + types (Phase 3)
    │   │   ├── team-join-requests.ts   # team_join_requests table + types (Phase 3)
    │   │   ├── team-invites.ts         # team_invites table + types (Phase 3)
    │   │   └── team-up-requests.ts     # team_up_requests table + types (Phase 3)
    │   ├── seed/
    │   │   ├── index.ts               # Seed runner (npm run db:seed)
    │   │   └── templates.ts           # 4 default hackathon templates
    │   └── migrations/                 # Drizzle-kit generated SQL migrations
    │
    └── lib/
        ├── utils.ts                    # cn() + slugify() helpers
        ├── rate-limit.ts               # Upstash Redis sliding-window limiters (signup, login, forgot-password, resend-verification, reset-password); fail-open on Redis errors
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
        │   ├── templates.ts           # Email HTML builders (13 Phase 3 templates added)
        │   └── adapters/
        │       └── resend-adapter.ts  # ResendEmailAdapter implementation
        ├── constants/
        │   ├── error-codes.ts         # ERR object — all error code strings thrown by services and caught by API routes
        │   └── enums.ts               # Typed const objects mirroring DB enum values (HACKATHON_STATUS, TEAM_ADMIN_STATUS, JOIN_REQUEST_STATUS, TEAM_MEMBER_ROLE, JOIN_ENTRY_POINT, etc.)
        ├── services/
        │   ├── auth-service.ts        # Signup, verify, password reset logic
        │   ├── token-service.ts       # SHA-256 token generation + hashing
        │   ├── org-service.ts         # Org CRUD, membership, invites
        │   ├── admin-service.ts       # Platform-wide queries (super_admin)
        │   ├── hackathon-service.ts   # Hackathon CRUD, slug gen, stats, transitions; slug mangling on soft-delete
        │   ├── hackathon-lifecycle.ts # Check-on-access status resolution engine
        │   ├── registration-service.ts # Registration CRUD, autoRegister, discoverability, getRegistrationsByUser, updateRegistration, getOrgParticipantStats (Phase 3)
        │   ├── team-service.ts        # Team CRUD, membership, join requests, invites, approval; acceptTeamInvite verifies authenticated user matches invite email; addMember enforces capacity inside transaction (Phase 3)
        │   └── team-up-service.ts     # Team-up request flow between unteamed participants (Phase 3)
        ├── storage/
        │   ├── types.ts               # StorageProvider interface + types
        │   ├── index.ts               # getStorageProvider() factory + re-exports
        │   ├── constants.ts           # STORAGE_CONSTANTS (types, sizes, paths)
        │   └── adapters/
        │       └── supabase-adapter.ts # SupabaseStorageProvider + StorageValidationError
        └── validations/
            ├── auth.ts                # Zod schemas: signup, login, forgot/reset password
            ├── org.ts                 # Zod schemas: createOrg, invite, changeRole, remove
            ├── hackathon.ts           # Zod schemas: hackathon, track, phase, prize, publish, transition
            ├── registration.ts        # Zod schemas: createRegistration, registrationField, upsertFields, updateRegistration (Phase 3)
            ├── team.ts                # Zod schemas: createTeam, updateTeam, joinRequest, inviteByEmail, etc. (Phase 3)
            └── team-up.ts             # Zod schemas: createTeamUpRequest, respondToTeamUpRequest (Phase 3)
```

---

## Data Model

> **Note:** All tables below reflect the ACTUAL implemented schema (Phase 1 + Phase 2 + Phase 3). Tables in Phase 4+ sections are not yet built.

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

### Hackathon Tables (Phase 2 Part 1 — Implemented)

**hackathons**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| org_id | uuid | FK → organizations.id, NOT NULL, indexed |
| title | text | NOT NULL |
| slug | text | UNIQUE (global), NOT NULL, indexed |
| description | text | nullable |
| cover_image_key | text | nullable, StorageProvider key |
| status | hackathon_status enum | NOT NULL, default 'draft' |
| template_type | template_type enum | NOT NULL |
| visibility | visibility enum | NOT NULL, default 'public' |
| team_min_size | integer | NOT NULL, default 1 |
| team_max_size | integer | NOT NULL, default 5 |
| allow_individual | boolean | NOT NULL, default true |
| requires_approval | boolean | NOT NULL, default false — when true, teams require admin approval |
| rules_html | text | nullable, Tiptap HTML output |
| faqs_html | text | nullable, Tiptap HTML output |
| created_by | uuid | FK → users.id, NOT NULL, indexed |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | nullable (soft delete) |

**phases**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| hackathon_id | uuid | FK → hackathons.id, NOT NULL, indexed, CASCADE delete |
| name | text | NOT NULL |
| type | phase_type enum | NOT NULL |
| order | integer | NOT NULL, phase sequence |
| start_date | timestamptz | nullable (set in wizard Step 4) |
| end_date | timestamptz | nullable (set in wizard Step 4) |
| config | jsonb | nullable, phase-specific settings |
| status | phase_status enum | NOT NULL, default 'upcoming' |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

**tracks**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| hackathon_id | uuid | FK → hackathons.id, NOT NULL, indexed, CASCADE delete |
| name | text | NOT NULL |
| description | text | nullable |
| resources_url | text | nullable |
| order | integer | NOT NULL, default 0 |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

**prizes**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| hackathon_id | uuid | FK → hackathons.id, NOT NULL, indexed, CASCADE delete |
| name | text | NOT NULL |
| description | text | nullable |
| rank | integer | NOT NULL (1st, 2nd, 3rd, etc.) |
| image_key | text | nullable, StorageProvider key |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

**hackathon_templates**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| name | text | NOT NULL |
| slug | text | UNIQUE, NOT NULL |
| description | text | NOT NULL |
| template_type | template_type enum | NOT NULL, UNIQUE |
| default_phases | jsonb | NOT NULL, array of {name, type, order, config} |
| icon | text | nullable, Lucide icon identifier |
| is_active | boolean | NOT NULL, default true |
| created_at | timestamptz | NOT NULL, default now() |

### Registration & Teams (Phase 3 — Implemented)

**registrations**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| hackathon_id | uuid | FK → hackathons.id, NOT NULL, indexed |
| user_id | uuid | FK → users.id, NOT NULL, indexed |
| form_data | jsonb | nullable, `Record<string, string>` field responses |
| is_discoverable | boolean | NOT NULL, default true — controls /browse/participants visibility |
| registered_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | nullable (soft delete) |
| UNIQUE | | (hackathon_id, user_id) |

**registration_fields**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| hackathon_id | uuid | FK → hackathons.id, NOT NULL, indexed |
| label | text | NOT NULL |
| field_type | text | NOT NULL — 'text' \| 'textarea' \| 'dropdown' (Zod-validated, not pgEnum) |
| options | jsonb | nullable, `string[]` — dropdown choices only |
| required | boolean | NOT NULL, default false |
| order | integer | NOT NULL, default 0 |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

**teams**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| hackathon_id | uuid | FK → hackathons.id, NOT NULL, indexed |
| name | text | NOT NULL |
| description | text | nullable |
| invite_code | text | NOT NULL, UNIQUE — 8-char alphanumeric, indexed |
| is_open | boolean | NOT NULL, default true — whether team accepts new members |
| track_id | uuid | FK → tracks.id, nullable, indexed |
| admin_status | team_admin_status enum | NOT NULL, default 'approved' — set to 'pending_review' when hackathon.requires_approval=true |
| review_reason | text | nullable — set on pending_review transitions, cleared on approval |
| created_by | uuid | FK → users.id, NOT NULL |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |
| deleted_at | timestamptz | nullable (soft delete — dissolution) |

**team_members**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| team_id | uuid | FK → teams.id, NOT NULL, indexed |
| user_id | uuid | FK → users.id, NOT NULL, indexed |
| role | team_role enum | NOT NULL, default 'member' (lead, member) |
| joined_at | timestamptz | NOT NULL, default now() — used for lead-transfer ordering |
| created_at | timestamptz | NOT NULL, default now() |
| UNIQUE | | (team_id, user_id) — hard-deleted on removal, no deleted_at |

**team_join_requests**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| team_id | uuid | FK → teams.id, NOT NULL, indexed |
| user_id | uuid | FK → users.id, NOT NULL, indexed |
| status | join_request_status enum | NOT NULL, default 'pending', indexed |
| message | text | nullable |
| entry_point | text | NOT NULL — 'browse' \| 'link' \| 'participant_browse' |
| requested_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

**team_invites**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| team_id | uuid | FK → teams.id, NOT NULL, indexed |
| email | text | NOT NULL, indexed |
| token | text | NOT NULL, UNIQUE, indexed — SHA-256 hash, 7-day expiry |
| invited_by | uuid | FK → users.id, NOT NULL |
| expires_at | timestamptz | NOT NULL |
| accepted_at | timestamptz | nullable |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

**team_up_requests**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| hackathon_id | uuid | FK → hackathons.id, NOT NULL, indexed — scoped to hackathon (no team exists yet at request time) |
| from_user_id | uuid | FK → users.id, NOT NULL, indexed |
| to_user_id | uuid | FK → users.id, NOT NULL, indexed |
| proposed_team_name | text | NOT NULL |
| message | text | nullable |
| status | join_request_status enum | NOT NULL, default 'pending' |
| requested_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

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

### Implemented (Phase 1 + Phase 2 + Phase 3)
```
platform_role: user, super_admin
org_role: org_admin, member
hackathon_status: draft, published, active, judging, completed, archived
template_type: idea_sprint, build_and_ship, innovation_pipeline, open_challenge
visibility: public, org_only, invite_only
phase_type: registration, submission, screening, judging, results
phase_status: upcoming, active, completed
team_role: lead, member
team_admin_status: pending_review, approved, rejected
join_request_status: pending, accepted, rejected
```

### Planned (Phase 4+)
```
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
| `UPSTASH_REDIS_REST_URL` | Server | Upstash Redis REST endpoint (rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Upstash Redis REST token (rate limiting) |

---

*This document reflects what EXISTS in the codebase as of Phase 3.5 Part 1 (Rate Limiting, April 18, 2026). It is updated after each development part. Planned tables will be validated against actual implementation during their respective phases.*
