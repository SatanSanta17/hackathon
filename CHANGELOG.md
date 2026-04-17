# HackForge — Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased]

### Phase 3, Part 1: Registration + Team Formation — Schema & Data Layer (April 17, 2026)

#### Added
- Database schema: `registrations`, `registration_fields`, `teams`, `team_members`, `team_join_requests`, `team_invites`, `team_up_requests` tables (7 new schema files)
- Postgres enums: `team_role` (lead, member), `team_admin_status` (pending_review, approved, rejected), `join_request_status` (pending, accepted, rejected)
- `hackathons.requires_approval` column — boolean flag; when true, new teams are created with `admin_status = 'pending_review'`
- `registrations.is_discoverable` — boolean flag controlling per-user visibility on `/browse/participants`
- `registration_fields.field_type` as plain `text` (not pgEnum) — validated by Zod, easier to extend in V2
- `teams.admin_status`, `teams.review_reason`, `teams.is_open`, `teams.invite_code` (8-char alphanumeric UNIQUE)
- `team_up_requests` scoped to `hackathon_id` (not `team_id`) — no team exists at request time
- Database migration `0003_minor_deathbird.sql` applied successfully
- `registration-service.ts`: 8 methods including `autoRegister()` (idempotent, sets `formData: null`, `isDiscoverable: true`), `getDiscoverableParticipants()` (N+1 team membership check; acceptable at V1 scale)
- `team-service.ts`: full team lifecycle — `createTeam`, `updateTeam`, `addMember`, `removeMember`, `dissolveTeam`, `transferLeadership`, `createJoinRequest`, `respondToJoinRequest`, `createTeamInvite`, `acceptTeamInvite`, `getTeamsByHackathon`, `getUserTeamForHackathon`, `approveTeam`, `rejectTeam`
- `dissolveTeam()` runs hard-delete of members + soft-delete of team in a transaction; admin notification emails sent OUTSIDE transaction so email failure cannot roll back dissolution
- `addMember()` calls `autoRegister()` BEFORE its transaction to keep transaction scope tight; `removeMember()` dissolves team AFTER its transaction commits if last member
- `team-up-service.ts`: `createTeamUpRequest`, `respondToTeamUpRequest` (re-validates both users unteamed at acceptance time, then creates team + adds acceptee), `getTeamUpRequestsForUser`
- Zod validation schemas: `registration.ts`, `team.ts`, `team-up.ts` (3 new validation files)
- 13 new email templates in `templates.ts`: `teamCreatedEmail`, `teamJoinRequestEmail`, `teamJoinRequestAcceptedEmail`, `teamJoinRequestRejectedEmail`, `teamInviteEmail`, `teamInviteAcceptedEmail`, `teamDisbandedAdminEmail`, `teamApprovedEmail`, `teamRejectedEmail`, `teamUpRequestEmail`, `teamUpRequestAcceptedEmail`, `teamUpRequestRejectedEmail`, `registrationConfirmationEmail`

#### Changed
- `hackathon.ts` Zod schema: added `requiresApproval: z.boolean().optional()` to `updateHackathonSchema`
- `docs/004-architecture.md`: updated Phase 3 data model from "Planned" stubs to full implemented schema; Enums section updated; status updated to Phase 3 Part 1 Complete

### Phase 2, Part 4: Public Hackathon Landing Page (April 17, 2026)

#### Added
- Public landing page route: `/hackathons/[slug]` under `(public)` route group with competitive dark theme
- Public layout: applies `.theme-competitive` class to all public-facing pages
- Hero section: cover image with `next/image` (priority) or gradient fallback, title (Space Grotesk), org name, status badge, registration dates, disabled "Register Now" CTA (wired in Phase 3)
- Share buttons: Copy Link (Clipboard API with "Copied!" feedback), X/Twitter, LinkedIn, WhatsApp — icons only on mobile, icons + labels on sm+
- About section: hackathon description with `whitespace-pre-line` and `max-w-3xl`
- Tracks section: single track inline vs multi-track responsive card grid (1→2→3 cols) with external resource links
- Timeline section: horizontal layout (lg+) with connector line, vertical layout (mobile/tablet), phase type icons (UserPlus, Upload, Search, Scale, Trophy), token-driven state colors (active/completed/upcoming)
- Prizes section: sorted by rank, top 3 with gold/silver/bronze accent backgrounds, prize images via signed URLs
- Rules section: renders Tiptap HTML via `dangerouslySetInnerHTML` with `prose prose-invert` typography styling
- FAQs section: client-side accordion with `grid-rows-[1fr]/grid-rows-[0fr]` CSS animation, parses H2 headings as questions, single-open mode
- Sticky section nav: Intersection Observer scroll spy with `rootMargin: '-20% 0px -70% 0px'`, sentinel pattern for sticky detection, glassmorphism (`backdrop-blur-md bg-background/80`) when stuck, horizontal scroll on mobile
- Footer: "Powered by HackForge" branding with homepage link
- Custom 404 page: SearchX icon, ambiguous messaging ("not found or no longer available"), "Back to HackForge" CTA
- SEO: `generateMetadata()` with Open Graph (title, description, cover image) and Twitter card tags
- Status gating: only `published`, `active`, `judging`, `completed` statuses render; `draft` and `archived` return `notFound()`
- 15 new CSS design tokens in `.theme-competitive`: prize accents (gold/silver/bronze), hero gradient fallback, timeline phase states (active/completed/upcoming/connector), section divider — all registered in `@theme inline` block

#### Changed
- `HackathonWithRelations` interface extended with `orgName: string`
- `getHackathonBySlug()` and `getHackathonById()` now fetch and return org name from organizations table

### Phase 2 Cleanup: ESLint + Build Fixes (April 17, 2026)

#### Fixed
- `wizard-shell.tsx`: moved state declarations (`setHackathonData`, `setPhasesData`, `setTracksData`, `setPrizesData`, `setVisitedSteps`) above callbacks that referenced them — fixed `react-hooks/immutability` errors; added `setCurrentStep` to `handleTemplateSelect` dependency array — fixed `react-hooks/exhaustive-deps` warning; replaced `useEffect` + synchronous `setState` with direct initial state for resume dialog — fixed `react-hooks/set-state-in-effect`; removed unused `useEffect` import
- `dashboard/page.tsx`: escaped apostrophe in "you'd" — fixed `react/no-unescaped-entities`
- `verify-email/page.tsx`: replaced synchronous `setState` in effect with conditional initial state for no-token case — fixed `react-hooks/set-state-in-effect`; extracted content into `VerifyEmailContent` component and wrapped in `<Suspense>` boundary — fixed Next.js build prerender error for `useSearchParams()`
- `invite/accept/page.tsx`: refactored to derive synchronous states (no-token, not-logged-in, unverified) outside the effect, using effect only for async API call — fixed `react-hooks/set-state-in-effect` and `react-hooks/immutability`; removed unused `useRouter` import — fixed `@typescript-eslint/no-unused-vars`; escaped apostrophe in "Don't" — fixed `react/no-unescaped-entities`; wrapped `InviteAcceptContent` in `<Suspense>` boundary — fixed Next.js build prerender error
- `login/page.tsx`: wrapped `<LoginForm />` in `<Suspense>` boundary — fixed potential Next.js build prerender error for `useSearchParams()`
- `reset-password/page.tsx`: wrapped `<ResetPasswordForm />` in `<Suspense>` boundary — fixed potential Next.js build prerender error for `useSearchParams()`

### Phase 2, Part 3: Hackathon List + Management (April 17, 2026)

#### Added
- Hackathon list page: filterable, searchable grid of all org hackathons with status badges, template labels, cover image gradients, and creation dates
- Client-side filters: search by title, status pill selector (All/Draft/Published/Active/Judging/Completed/Archived), date range pickers (Created after/before)
- Admin context menu per hackathon: Edit, View Landing Page, Publish, Archive, Delete Draft — all role-gated to `org_admin`
- Delete confirmation dialog (AlertDialog) for draft deletion with soft-delete
- Check-on-access lifecycle engine (`hackathon-lifecycle.ts`): automatically resolves hackathon and phase statuses based on current date whenever a hackathon is loaded (no cron job needed for V1)
- API route: `POST /api/hackathons/[hackathonId]/transition` — manual status transitions (draft→published, completed→archived only)
- API route: `POST /api/hackathons/[hackathonId]/delete` — soft-delete draft hackathons
- `getHackathonStats()` service method returning total/active/draft counts per org
- Org dashboard stat cards now show real hackathon counts (replacing Phase 1 placeholder zeros)
- Loading skeleton for hackathon list page
- Empty states: distinct messaging for "no hackathons yet" vs "no filter matches" with Create CTA

#### Changed
- `getHackathonById()`, `getHackathonBySlug()`, `getHackathonsByOrgId()` now run check-on-access status resolution before returning results
- Manual status transitions restricted to draft→published and completed→archived only; middle-state transitions (published→active, active→judging, judging→completed) are date-driven
- `transitionStatusSchema` (Zod) narrowed to accept only `'published'` and `'archived'` as target statuses
- Org dashboard page now fetches real data via `getHackathonStats()` instead of rendering hardcoded values

### Phase 2, Part 2: Hackathon Creation Wizard + Edit Mode (April 17, 2026)

#### Added
- 8-step hackathon creation wizard with sidebar navigation and data-driven step status
- Step 1: Template selection (4 templates) — creates draft hackathon, locked after creation
- Step 2: Basic info — title, description, cover image upload with 16:9 crop (react-cropper), auto-slug with collision handling
- Step 3: Tracks — add/edit/delete/reorder tracks with drag-and-drop (@hello-pangea/dnd)
- Step 4: Timeline — editable phase dates with per-phase and cross-phase chronological validation
- Step 5: Team rules — min/max team size, individual participation toggle, visibility dropdown
- Step 6: Prizes — add/edit/delete/reorder prizes with presets and image upload
- Step 7: Rules & FAQs — two Tiptap v3 rich text editors (bold, italic, headings, lists, links)
- Step 8: Review & Publish — read-only summary with edit links, client-side validation, publish flow
- Wizard sidebar: three-state data-driven indicators (complete/incomplete/not started), clickable up to highest reached step
- Resume draft flow: detects existing drafts on `/create`, shows dialog to resume or start fresh
- Edit hackathon route (`/hackathons/[hackathonId]/edit`) — pre-fills wizard with existing data
- Image crop modal with locked 16:9 aspect ratio, outputs 1280×720 WebP
- Tiptap editor component with 9-button toolbar and transaction-based active state syncing
- API routes: POST/PATCH/DELETE for hackathons, tracks, phases, prizes; POST publish; POST upload image
- `@tailwindcss/typography` plugin for prose styling in Tiptap editors

### Phase 2, Part 1: Hackathon Data Layer (April 16, 2026)

#### Added
- Database schema: hackathons, phases, tracks, prizes, hackathon_templates tables
- Postgres enums: hackathon_status, template_type, visibility, phase_type, phase_status
- StorageProvider interface with Supabase adapter (upload, getSignedUrl, delete, list)
- Storage constants: file type/size limits, path patterns for cover images and prize images
- Hackathon service: CRUD operations, slug generation, template cloning, lifecycle transitions, draft detection
- Hackathon validation schemas (Zod): create, update, track, phase, prize, publish, transition
- Template seed data: 4 default templates (Idea Sprint, Build & Ship, Innovation Pipeline, Open Challenge)
- Database migration for Phase 2 tables

### Phase 1, Part 3: Org Management + App Shell + Admin Panel (April 16, 2026)

#### Added
- Organization service layer: create org, slug uniqueness, membership management, invite flow with SHA-256 token hashing
- Org validation schemas: createOrg, inviteMember, changeMemberRole, removeMember (Zod)
- Org invite email template with role label, expiry text, and CTA button
- API routes: org CRUD (`/api/orgs`), member management (`/api/orgs/[orgId]/members/*`), invite acceptance (`/api/invite/accept`)
- Authorization guards: `requireOrgRole()` (org-level) and `requireSuperAdmin()` (platform-level)
- Admin service: `listOrganizations()` with member count, `listUsers()` for platform overview
- Admin API routes: `/api/admin/orgs`, `/api/admin/users` (super_admin only)
- Dashboard layout: `SessionProvider` + `SidebarProvider` + `VerificationBanner` wrapper
- App sidebar with org-scoped navigation (Dashboard, Hackathons, Members, Settings)
- Top bar with org switcher dropdown, user avatar menu, and mobile sidebar trigger
- Org-scoped layout: server-side org validation, membership check, data fetching for sidebar/topbar
- Dashboard page: org picker (multi-org), auto-redirect (single org), welcome screen (zero orgs)
- Create organization page with auto-slug generation from name
- Members page: table with role badges, invite dialog, change role dialog, remove member confirmation
- Org dashboard page with stat cards (placeholder values for Phase 2)
- Admin panel: tabbed view (Organizations + Users) with data tables, empty states
- Invite acceptance page: handles logged-in/logged-out/unverified states with appropriate flows
- Loading skeletons for dashboard, members, admin, and org picker pages
- Placeholder pages for hackathons (Phase 2) and settings (future)
- `slugify()` utility function
- shadcn/ui components: avatar, badge, dialog, dropdown-menu, select, separator, sheet, sidebar, skeleton, table, tabs, tooltip

### Phase 1, Part 2: Authentication System (April 16, 2026)

#### Added
- NextAuth.js v5 integration with Credentials provider and JWT session strategy
- Auth service: signup with bcrypt hashing, email verification, password reset
- Token service: SHA-256 hashed token generation for email verification and password reset
- Provider-agnostic email service: `EmailService` interface → `ResendEmailAdapter` → `getEmailService()` factory
- Email templates: verification email, password reset email (inline HTML with shared layout helpers)
- Auth validation schemas: signup, login, forgotPassword, resetPassword (Zod)
- Centralized auth constants: token expiry times, password requirements, `AUTH_EXPIRY_LABELS`
- Custom form components: `FormField<T>`, `FormPasswordField<T>`, `FormMessage` (wrapping react-hook-form + shadcn)
- Auth pages: login, signup, check-email, verify-email, forgot-password, reset-password
- Auth API routes: signup, verify-email, resend-verification, forgot-password, reset-password
- Verification banner component for unverified users across dashboard
- Auth layout with centered card design
- NextAuth middleware protecting `/dashboard/*` routes
- Custom JWT/session callbacks extending session with `id`, `platformRole`, `isEmailVerified`
- Second database migration for `platform_role` column on users table

### Phase 1, Part 1: Project Scaffolding + Database Schema (April 16, 2026)

#### Added
- Dual-tone design system: admin mode (light, professional) and competitive mode (dark, neon accents) via CSS custom properties in `globals.css`
- Typography system: Geist Sans (admin) + Space Grotesk (competitive headings) loaded via `next/font/google`
- Drizzle ORM setup with postgres.js driver, connected to Supabase Postgres
- Database schema: `users`, `organizations`, `org_memberships`, `org_invites`, `verification_tokens` tables
- Postgres enums: `platform_role` (user, super_admin), `org_role` (org_admin, member)
- Type inference exports for all schema tables (User, NewUser, Organization, etc.)
- Initial database migration applied
- Sonner toast provider integrated in root layout
- Form validation dependencies: react-hook-form, @hookform/resolvers, zod
- `.env.example` with all required environment variables documented
- Project folder structure with empty directories for future parts
- Phase 1 PRD and TRD Part 1 documentation

#### Changed
- Updated `page.tsx` from Next.js boilerplate to HackForge placeholder using design tokens
- Updated `layout.tsx` with HackForge metadata, font variables, and Toaster provider
- Updated architecture doc (004) folder structure to reflect actual codebase

### Documentation (Pre-Phase 1)
- Created Master PRD (v1.0) covering full product vision, 12 sections, competitive analysis, monetization strategy
- Created Technical Decision Record (TDR-001): architecture, tech stack, ORM, auth, deployment decisions
- Created V1 Development Plan: 6 phases, 20 dev-days, vertical slice approach
- Created Coding Conventions (CONV-003): SOLID principles, naming, TypeScript, Next.js, Drizzle, NextAuth patterns
- Created Architecture document (ARCH-004): system overview, folder structure, data model, env vars
- Created Development Workflow (WKFL-005): PRD/TRD process, quality gates, git workflow
- Created CLAUDE.md session bootstrap
- Created Project Context (CTX-000)
