# HackForge — Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased]

### Convention Audit & Cleanup (April 18, 2026)

#### Code Quality
- Replaced all raw DB enum string literals with typed constants across the codebase — `HACKATHON_STATUS`, `PHASE_STATUS`, `PHASE_TYPE`, `TEAM_ADMIN_STATUS`, `TEAM_MEMBER_ROLE`, `JOIN_REQUEST_STATUS`, `ORG_ROLE` constants now used in every comparison (22 files updated)
- Fixed `window.location.href` in `participants-browse-client.tsx` — team-up accept redirect now uses `router.push()` per Next.js convention
- Fixed service file import order in `auth-service.ts`, `team-up-service.ts`, `hackathon-service.ts` — sibling services now grouped after `@/lib/*` utilities with proper blank-line separation; `import type` moved to end

---

### Phase 3.5 — Core Hardening, Part 2: Email Verification Banner Fix (April 18, 2026)

#### Correctness
- `SessionProvider` now passes `refetchOnWindowFocus` to `NextAuthSessionProvider` — when a user verifies their email in a second tab and returns to the dashboard, the next window focus triggers a session refetch; the JWT callback's DB check returns `isEmailVerified: true` and the banner disappears automatically
- `verify-email` success state now uses `window.location.href = '/dashboard'` (full browser navigation) instead of Next.js `<Link>` — guarantees middleware runs on redirect, JWT callback fires, and the updated session cookie is written before the dashboard loads
- Removed unused `next/link` import from `verify-email/page.tsx`

---

### Phase 3.5 — Core Hardening, Part 1: Rate Limiting (April 18, 2026)

#### Security
- New `src/lib/rate-limit.ts` — Upstash Redis sliding-window rate limiters for all auth endpoints: signup (5/15 min), forgot-password (3/15 min), resend-verification (3/15 min), reset-password (5/15 min), login (10/15 min per email)
- Rate limiting applied to all five auth routes before business logic; fail-open on Redis errors (Redis unavailability never blocks auth)
- `getClientIp` extracts client IP from `x-forwarded-for` header for correct IP resolution behind Vercel's load balancer
- Login rate-limited by email address (not IP) to prevent targeted brute-force; returns `null` deliberately (no named error) to avoid leaking account existence
- All rate-limited responses include `Retry-After` header

#### Infrastructure
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` added to `.env.example`

---

### Phase 3, Post-Audit Hardening (April 18, 2026)

#### Security
- `acceptTeamInvite` now requires `authenticatedUserId`; throws `ERR.INVITE_EMAIL_MISMATCH` (→ 403) if the logged-in account's email does not match the invite recipient — prevents one user from accepting an invite intended for another
- `INVITE_ALREADY_USED` mapped to 409 (was 400) — conflict, not bad input

#### Correctness
- `addMember` performs a capacity count inside the write transaction before inserting, making the team-full check the definitive guard under concurrency (reduces TOCTOU window vs. pre-transaction check)
- `as any` casts removed from `zodResolver` in `CreateTeamModal` and `EditTeamDialog`; `z.boolean().default(true)` changed to `z.boolean()` (form `defaultValues` already supplies the default); components now import `CreateTeamInput`/`UpdateTeamInput` from `@/lib/validations/team` instead of redefining them locally
- Raw `adminStatus` string literals in `TeamProfileClient` status alert replaced with `TEAM_ADMIN_STATUS` constants
- `entryPoint="browse"` replaced with `JOIN_ENTRY_POINT.BROWSE` in `TeamBrowseCard` and `TeamProfileClient`
- `entryPointLabel()` refactored from an if-chain to a `ENTRY_POINT_LABELS` record map

#### Observability
- All 11 email `catch {}` blocks across `team-service.ts` and `team-up-service.ts` now log `console.error` with service/function context — silent email failures are forbidden
- Early returns inside try blocks in `approveTeam`, `rejectTeam`, and `dissolveTeam` now `console.warn` before returning
- Entry `console.log` added to all read-only service functions (`getTeamById`, `getTeamByInviteCode`, `getUserTeamForHackathon`, `getPendingTeams`, `getTeamWithMembers`, `getJoinRequests`, `getJoinRequestsForTeam`, `getAllTeamsForHackathon`, `getTeamInviteByToken`)

#### Constants & DRY
- New `src/lib/constants/error-codes.ts` — `ERR` object with all error code strings; `INVITE_EMAIL_MISMATCH` added
- New `src/lib/constants/enums.ts` — typed const mirrors of DB enum values (`HACKATHON_STATUS`, `TEAM_ADMIN_STATUS`, `JOIN_REQUEST_STATUS`, `TEAM_MEMBER_ROLE`, `JOIN_ENTRY_POINT`, etc.)
- Module-level `APP_URL` constant in both `team-service.ts` and `team-up-service.ts` with startup `console.warn` if unset; all inline `process.env.NEXT_PUBLIC_APP_URL ?? ''` usages replaced
- `INVITE_CODE_LENGTH = 8` and `INVITE_CODE_RETRY_ATTEMPTS = 5` extracted as named constants in `team-service.ts`
- Redundant `toUser` DB fetch removed from `respondToTeamUpRequest` accepted-email block (was re-fetching a result already available in outer scope)

#### UI
- Team browse cards: "Already on a Team" disabled button hidden for other teams; own team card shows "View Team" outline button (redirects to team profile)
- Track selection is mandatory during team creation (pre-selects first track, "No track" option removed); optional during editing
- Edit team dialog pre-populates the existing track via `defaultValues` and `useEffect` reset

---

### Phase 3, Part 4: Registration + Team Formation — Admin Approval + Dashboard Views (April 18, 2026)

#### Added
- Service method `getAllTeamsForHackathon(hackathonId, filters?)` on `team-service.ts` — returns `AdminTeamRow[]` with `memberCount` and `leadName` via two-step query (teams+tracks JOIN, then all member rows for those teamIds correlated in JS); supports optional `trackId`/`isOpen`/`adminStatus` filters
- Service method `getOrgParticipantStats(orgId)` on `registration-service.ts` — returns `{ registered, participating }` as two parallel `countDistinct` queries scoped to active/published hackathons for the org
- API route `GET /api/hackathons/[hackathonId]/teams/all` — org-admin only; all teams regardless of status; supports `?trackId`, `?isOpen`, `?adminStatus` filters; returns `requiresApproval` flag alongside team list
- API route `POST /api/hackathons/[hackathonId]/teams/[teamId]/approve` — org-admin only; guards `adminStatus === 'pending_review'`; calls `approveTeam` (clears `reviewReason`, sets `adminStatus = 'approved'`)
- API route `POST /api/hackathons/[hackathonId]/teams/[teamId]/reject` — org-admin only; no status precondition; calls `rejectTeam`
- Admin teams page (`/dashboard/[orgSlug]/hackathons/[hackathonId]/teams`) — server component; gated to `org_admin` via `checkUserOrgRole`; fetches all teams with `getAllTeamsForHackathon`
- `AdminTeamsClient` — Pending Review section (amber card, only when `requiresApproval && pendingTeams.length > 0`); each pending row shows team name, lead, member count, `reviewReason`; Approve/Reject buttons with optimistic state updates and toast feedback; full teams table with search by name, track filter, open/closed filter, status filter (status filter and column only shown when `requiresApproval`); `AdminStatusBadge` helper with amber/green/destructive variants
- Admin teams loading skeleton (`/dashboard/[orgSlug]/hackathons/[hackathonId]/teams/loading.tsx`)
- Sub-navigation between Participants and Teams pages — "Participants | Teams" link row added to both admin pages
- Org dashboard stat cards — "Registered" (`Users` icon) and "Participating" (`UserCheck` icon) added to `/dashboard/[orgSlug]`, fetched in parallel with existing hackathon stats
- My Hackathons phase countdown — server page fetches all phases for registered hackathons in a single `inArray` query; computes first `status === 'active'` phase with non-null `endDate`; passes ISO string deadline to card
- `MyHackathonCard` countdown display — shows "Hackathon completed." when `hackathon.status === 'completed'`; shows "[Phase name] closes today/tomorrow/in N days." when an active phase is found; hidden otherwise
- Landing page browse entry points — "Browse Teams" and "Browse Participants" link row rendered below the main CTA in `RegistrationCta` only when `hackathonStatus === 'active'`; `hackathonStatus` prop threaded from `LandingHero` → `RegistrationCta`

---

### Phase 3, Part 3: Registration + Team Formation — Team Formation UI (April 17, 2026)

#### Added
- API route `GET /api/hackathons/[hackathonId]/teams` — list open, non-full, approved teams for public browse; supports `?trackId=` filter
- API route `POST /api/hackathons/[hackathonId]/teams` — create team (auth); validates registration + unteamed status; service sets `adminStatus` based on `requiresApproval`
- API route `GET /api/hackathons/[hackathonId]/teams/[teamId]` — team details (auth); strips `inviteCode` from response if viewer is not a member
- API route `PATCH /api/hackathons/[hackathonId]/teams/[teamId]` — update team profile (lead only); service re-queues for review when `requiresApproval`
- API route `POST /api/hackathons/[hackathonId]/teams/[teamId]/join-request` — send join request; validates `isOpen` and team size before inserting
- API route `GET /api/hackathons/[hackathonId]/teams/[teamId]/join-requests` — list pending requests (lead only)
- API route `PATCH /api/hackathons/[hackathonId]/teams/[teamId]/join-requests/[requestId]` — approve/reject (lead only); fetches `teamMaxSize` from hackathon and passes to `respondToJoinRequest`
- API route `POST /api/hackathons/[hackathonId]/teams/[teamId]/invite` — invite by email (lead only); checks team size
- API route `POST /api/hackathons/[hackathonId]/teams/[teamId]/leave` — leave team; service handles auto-transfer + dissolve-if-last
- API route `POST /api/hackathons/[hackathonId]/teams/[teamId]/transfer-lead` — transfer leadership (lead only)
- API route `GET /api/teams/by-invite-code/[inviteCode]` — public lookup; returns team + hackathon context, never exposes `inviteCode`
- API route `POST /api/team-invites/accept` — accept email invite by raw token (auth); maps named service errors to HTTP codes
- API route `GET /api/hackathons/[hackathonId]/participants` — discoverable unteamed participants (auth); excludes requesting user; supports `?search=` filter
- API route `POST /api/hackathons/[hackathonId]/team-up` — create team-up request between two registered unteamed users
- API route `GET /api/hackathons/[hackathonId]/team-up-requests` — incoming pending team-up requests for current user
- API route `PATCH /api/hackathons/[hackathonId]/team-up-requests/[requestId]` — accept/reject (recipient only); on accept: creates team + adds both users
- Team browse page (`/hackathons/[slug]/teams`) — server component; `CreateTeamButton` shown only when registered+unteamed; public access
- `TeamBrowseClient` — client fetch with track pill filter (refetches `?trackId=` on change); skeleton loading; empty state
- `TeamBrowseCard` — context-aware CTA: "Sign in to Join" / "Register to Join" / "Request to Join" (opens dialog) / "Already on a Team" / "Team Full" / "Team Closed" (disabled)
- `CreateTeamModal` — dialog with name/description/track Select/open Switch; on success redirects to new team profile
- `JoinRequestDialog` — optional message textarea; used from both browse card and profile page with `entryPoint` prop
- Team profile page (`/hackathons/[slug]/teams/[teamId]`) — server component; redirects unauthenticated users to login with `callbackUrl`
- `TeamProfileClient` — all sections: header badges (track, open/closed, member count, admin status), status alert (amber/red for `requires_approval`), description, members list with initials avatars + joined date, role-aware actions bar, copyable invite link (members only), join requests queue (lead), incoming team-up requests (non-member unteamed)
- `EditTeamDialog` — name/description/track/open form (lead); shows "submitted for review" toast when `requiresApproval`
- `InviteByEmailDialog` — email input (lead); calls `POST .../invite`
- `TransferLeadDialog` — Select from non-lead members (lead); calls `POST .../transfer-lead` + `router.refresh()`
- Join link page (`/hackathons/[slug]/teams/join?code=`) — server component; fetches team by invite code + separate member count query; passes to `JoinLinkClient`
- `JoinLinkClient` — closed/full/requested/auth states; unauthenticated user sees login + signup CTAs with `callbackUrl` round-trip
- Participants browse page (`/hackathons/[slug]/participants`) — server component; auth-gated; inline `db` query for viewer's team role (no new service method)
- `ParticipantsBrowseClient` — client fetch + `useMemo` search filter; excludes `viewerUserId` client-side; skeleton loading
- `ParticipantCard` — initials avatar, designation + department from `formData`, registered date; "Team Up" CTA (unteamed registered viewer) or "Invite to Team" (lead viewer) with per-card requested/invited state
- `TeamUpDialog` — proposed team name (default "My Team") + optional message; calls `POST /team-up`
- Team invite acceptance page (`/team-invites/accept?token=`) — server component; `InvalidInvitePage` inline component for not_found/expired/already_accepted states
- `TeamInviteAcceptClient` — "Accept Invite" button (auth) or Sign In + Create Account with `callbackUrl` (unauth)
- Three new service methods on `team-service.ts`: `getTeamWithMembers` (returns `TeamProfileData` with track join), `getJoinRequestsForTeam` (pending requests with user details), `getTeamInviteByToken` (hashes raw token before DB lookup)
- `alert.tsx` shadcn component added (used for team admin status alerts)
- Loading skeletons: `teams/loading.tsx`, `teams/[teamId]/loading.tsx`, `participants/loading.tsx`

#### Fixed
- `getTeamInviteByToken` hashes the raw URL token with `crypto.createHash('sha256')` before querying — DB stores hashed tokens and `hashToken` is not exported from `token-service.ts`
- `create-team-modal.tsx` TypeScript: `resolver: zodResolver(createTeamSchema) as any` — same `Resolver` inference issue as `registration-form.tsx` (Zod `.default()` produces required type at runtime but optional in inferred type)
- `edit-team-dialog.tsx` TypeScript: same resolver cast pattern applied to `updateTeamSchema`

### Phase 3, Part 2: Registration + Team Formation — API Routes + UI + Admin Roster (April 17, 2026)

#### Added
- API route `POST /api/hackathons/[hackathonId]/register` — creates registration; returns 201 (created), 409 (already registered), 403 (registration closed/not open); fire-and-forget confirmation email
- API route `GET/PATCH /api/hackathons/[hackathonId]/registration` — GET returns own registration or 404; PATCH updates designation/department/isDiscoverable via `updateRegistrationSchema`
- API route `GET/POST /api/hackathons/[hackathonId]/registration-fields` — GET is public (no auth); POST upserts custom fields (admin-only, requires org ownership)
- API route `GET /api/hackathons/[hackathonId]/registrations` — full roster with user + team info (admin-only)
- API route `GET /api/hackathons/[hackathonId]/registrations/export` — CSV download with standard columns + one column per custom field; `Content-Disposition: attachment` triggers browser download directly
- API route `GET /api/user/hackathons` — returns current user's registrations with hackathon + team summary
- Wizard Step 6 "Participation Settings" (`step-participation.tsx`): requires-approval toggle + drag-and-drop custom registration field builder (up to 10 fields; text, textarea, dropdown types; required toggle per field)
- `RegistrationCta` component — 8-variant `CtaState` discriminated union drives the CTA button on the landing page: `unauthenticated | register | registration_closed | find_team | under_review | my_team | team_rejected | completed`
- `AuthRegistrationModal` — 4-mode dialog: `auth` (login/signup tabs) → `auth_signup_sent` (check inbox) → `register` (form) → `success` (find/create team CTAs)
- `RegistrationForm` — dynamic form with read-only name/email, optional designation/department, custom fields rendered by type, discoverability Switch toggle; Zod schema built in `useMemo` from field config
- `ProfileNudgeBanner` — dismissible amber banner on landing page when designation/department missing from registration
- My Hackathons page (`/dashboard/[orgSlug]/my-hackathons`) — server-fetches registrations with signed cover image URLs; card grid with loading skeleton
- `MyHackathonCard` — shows cover image/gradient, status badge, team state (no team + links / approved + member count / under review / rejected), inline profile nudge
- Admin Participants page (`/dashboard/[orgSlug]/hackathons/[hackathonId]/participants`) — registered vs participating stat chips, CSV export link, `ParticipantsTable`
- `ParticipantsTable` — client-side search (name/email), "Has Team / No Team / All" pill filter, track pill filter; table columns: name, email, registered date, team link, track, discoverable badge, + one column per custom field
- `CalendarCheck2` "My Hackathons" nav link in `AppSidebar` between Dashboard and Hackathons

#### Changed
- `wizard-shell.tsx`: expanded from 8 to 9 steps; Step 6 "Participation" inserted between Team Rules and Prizes; Steps 6→7, 7→8, 8→9 renumbered throughout; `getFurthestStep`, `handleNext`, footer condition, no-next-button list, `visitedSteps` init, and `renderStepContent` all updated
- `hackathon-service.ts`: `isSlugAvailable` no longer filters by `deletedAt` (must match DB UNIQUE constraint which covers all rows); `softDeleteHackathon` now mangles slug to `{slug}-deleted-{first-8-chars-of-id}` so the original slug is reusable after deletion
- `hackathon-service.ts`: `HackathonWithRelations` extended with optional `registrationFields`; `getHackathonById` loads registration fields via Drizzle relation
- `registration-service.ts`: added `getRegistrationsByUser` (returns `UserHackathonSummary[]` with inline team lookup to avoid circular import) and `updateRegistration`
- `validations/registration.ts`: added `updateRegistrationSchema` (designation, department, isDiscoverable optional fields)
- `login-form.tsx`: added optional `onSuccess?` callback — when provided, calls `router.refresh()` then `onSuccess()` instead of redirecting; standalone login page unaffected
- `signup-form.tsx`: added optional `onSuccess?` callback — when provided, calls `onSuccess()` on 201 instead of redirecting to `/check-email`; standalone signup page unaffected
- `landing-hero.tsx`: replaced static disabled `<Button>` with `<RegistrationCta>` component; added `ctaState`, `hackathonSlug`, `registrationFields` props
- `hackathons/[slug]/page.tsx`: added server-side CTA state computation using `auth()`, `getRegistrationByUserAndHackathon`, `getUserTeamForHackathon`, and `isRegOpen()` helper; fetches `registrationFields` and passes all to `LandingHero`

#### Fixed
- Slug uniqueness bug: `isSlugAvailable` previously filtered soft-deleted rows with `isNull(deletedAt)`, allowing slug conflicts with the DB UNIQUE constraint — removed the filter to match DB behaviour
- `registration-form.tsx` TypeScript: replaced `z.infer<typeof schema>` (dynamically-built schema) with explicit `FormValues` type + `resolver: zodResolver(schema) as any` to resolve `Resolver` type mismatch

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
