# PRD — Phase 3.5: Core Hardening

**Document ID:** PRD-009  
**Date:** April 18, 2026  
**Author:** Burhanuddin C.  
**Status:** Approved  
**References:** `docs/002-v1-development-phases.md`, `docs/004-architecture.md`, `docs/008-registration-teams/prd.md`

---

## Purpose

Phases 1–3 deliver a functionally complete foundation: auth, org management, hackathon creation, and the full participation flow. Phase 3.5 makes that foundation production-worthy for a worldwide SaaS product — not just a single controlled internal deployment.

Six gaps block external use:

1. Auth endpoints are unprotected against brute force.
2. JWT carries mutable claims (org role, email verification state) that go stale — users see incorrect banners and role changes require re-login to take effect.
3. The platform has no front door: a stranger visiting hackforge.io sees nothing.
4. Users cannot edit their own name, password, or avatar after signup.
5. All list views load full tables into the client — unscalable past a few hundred records.
6. Two UI themes share globals.css with no formal token system — divergence is guaranteed without structure.

Phase 3.5 closes all six before Phase 4 (Submissions) builds on top of them.

---

## Key Decisions (Agreed Pre-PRD)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Rate limiting via Upstash Redis + `@upstash/ratelimit`** | Sliding window, no Redis server to manage. Free tier covers V1 scale (10K requests/day). Applied in Next.js middleware for credential login; in route handlers for custom auth routes. |
| 2 | **JWT carries only stable identity** | JWT stripped to: `userId`, `email`, `name`, `platformRole`. Mutable claims (`orgId`, `orgRole`, `emailVerified`) are removed. These were the source of stale-banner and stale-role bugs. |
| 3 | **`requireOrgRole()` becomes a DB lookup** | Given `orgId` (from URL param) and `userId` (from JWT), the guard queries `org_memberships` live. Role changes and membership removals take effect on the next API request — no re-login needed. |
| 4 | **`emailVerified` refreshed via NextAuth `update()` — not re-login** | After the verify-email API route commits the update, the page calls NextAuth's `update({ emailVerified: true })` client-side. The session callback writes it back into the token. No logout required. |
| 5 | **`/account` lives in `(dashboard)` layout at `/dashboard/account`** | Sits inside the authenticated shell (SessionProvider, top bar) but outside any `[orgSlug]` context. Accessible to all authenticated users regardless of org membership. |
| 6 | **Org-less post-login redirect goes to `My Hackathons` not org-creation wall** | If a user has no org memberships, `/dashboard` shows their registered hackathons + a prompt to create or join an org. The org-creation wall is removed. The sidebar for org-less users shows: My Hackathons, Account Settings. |
| 7 | **Platform landing page replaces the temporary `app/page.tsx`** | Root `/` becomes a real marketing + discovery page. Lists all public hackathons across all orgs with status filtering. Has a top nav with Sign In / Get Started for logged-out users; user avatar for logged-in. |
| 8 | **Pagination uses offset-based LIMIT/OFFSET with URL search params** | Consistent pattern across all list views. Search/filter state lives in URL params (shareable, bookmarkable). Cursor-based pagination deferred to V2. Shared `<PaginationControls>` component extracted once. |
| 9 | **Design token system formalized in `globals.css` — no external library** | CSS custom properties organized into explicit layers: color, typography, spacing, radius, shadow — for both `admin` and `competitive` themes. Components reference tokens; no hardcoded hex values. |
| 10 | **Org settings CRUD is scoped: name + logo only; slug is read-only** | Slug changes break existing URLs and invite links. The danger zone (delete org) is deferred — requires a full cascade audit before it's safe. |

---

## User Stories

### Security
1. **As a platform operator**, I want auth endpoints to reject repeated failed attempts so that accounts cannot be brute-forced or credential-stuffed.
2. **As an org admin**, I want a removed member to lose access on their next API request, not at their next login.
3. **As an org admin who promotes a member**, I want their elevated role to take effect immediately without requiring them to log out and back in.

### Session & Email Verification
4. **As a user who just verified my email**, I want the verification banner to disappear immediately without logging out and back in.
5. **As any user**, I want my session to reflect my current org membership and role at all times.

### Platform Landing Page
6. **As a potential customer visiting hackforge.io**, I want to immediately understand what HackForge is and see live hackathons so I can evaluate the product.
7. **As a logged-out visitor**, I want to browse all public hackathons without signing in so I can find one to join.
8. **As a logged-out visitor**, I want a clear "Sign In" and "Get Started" CTA so I can access my account or create one.
9. **As a logged-in user without an org**, I want to see my registered hackathons on a useful landing page instead of a forced org-creation screen.

### User Profile + Account Settings
10. **As a user who made a typo in my name at signup**, I want to correct it myself without contacting support.
11. **As a user**, I want to change my password with just my current password and a new one.
12. **As a user**, I want to upload a profile photo so my avatar shows my face instead of initials.
13. **As a user who belongs to multiple orgs**, I want to see all my org memberships in one place so I can orient myself.

### Pagination
14. **As a participant browsing teams in a 500-person hackathon**, I want the team list to load quickly and let me page through results.
15. **As an admin searching the participant roster**, I want search and filters to run on the server so I'm not waiting for 1,000 records to load.
16. **As any user on a list page**, I want my search term and active filter to be preserved in the URL so I can share or bookmark the filtered view.

### Design Tokens
17. **As a developer extending the UI**, I want a clear token system so I know which CSS variable to use instead of guessing or hardcoding a hex value.

### Org Settings
18. **As an org admin who made a typo in the org name**, I want to fix it without contacting support.
19. **As an org admin**, I want to update the org logo after creation.

---

## Parts

Phase 3.5 is divided into 7 parts. Each part is a self-contained, shippable unit.

---

### Part 1: Security — Rate Limiting on Auth Endpoints

**What:** Add sliding-window rate limiting to all custom auth API routes and the NextAuth credentials login handler.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P1.R1 | Install `@upstash/ratelimit` and `@upstash/redis`. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env.example`. |
| P1.R2 | Create `src/lib/rate-limit.ts` that exports a `rateLimit(identifier: string, limiter: Ratelimit): Promise<{ success: boolean; retryAfter?: number }>` helper. The helper calls `limiter.limit(identifier)` and returns a typed result. Limiter instances are created once at module scope (not per-request). |
| P1.R3 | Define the following limiter instances in `src/lib/rate-limit.ts`: `signupLimiter` — sliding window, 5 requests per 15 minutes; `forgotPasswordLimiter` — sliding window, 3 requests per 15 minutes; `resendVerificationLimiter` — sliding window, 3 requests per 15 minutes; `resetPasswordLimiter` — sliding window, 5 requests per 15 minutes; `loginLimiter` — sliding window, 10 requests per 15 minutes. |
| P1.R4 | Apply rate limiting in `POST /api/auth/signup`: use client IP (from `x-forwarded-for` header, fallback to `127.0.0.1`) as the identifier with `signupLimiter`. Return `429` with `{ message: 'Too many requests. Please try again later.' }` and a `Retry-After` header (seconds until window resets) if the limit is exceeded. Rate limit check runs before Zod validation. |
| P1.R5 | Apply `forgotPasswordLimiter` to `POST /api/auth/forgot-password` using the same IP-based identifier and response pattern as P1.R4. |
| P1.R6 | Apply `resendVerificationLimiter` to `POST /api/auth/resend-verification` using the same pattern. |
| P1.R7 | Apply `resetPasswordLimiter` to `POST /api/auth/reset-password` using the request body's `email` field (not IP) as identifier — prevents targeted resets on known email addresses. |
| P1.R8 | Apply `loginLimiter` to the NextAuth credentials `authorize` function in `src/lib/auth/auth.ts`. The identifier is the submitted email (lowercased). On limit exceeded, throw a `CredentialsSignin` error with message `'Too many login attempts. Try again later.'` so NextAuth surfaces it as a standard credential error. |
| P1.R9 | Add the two Upstash env vars to `docs/004-architecture.md` environment variables table. |

**Acceptance Criteria:**

- [ ] `@upstash/ratelimit` and `@upstash/redis` installed
- [ ] `src/lib/rate-limit.ts` exports `rateLimit()` helper and all 5 limiter instances
- [ ] Limiter instances created at module scope (not per-request)
- [ ] `POST /api/auth/signup` returns `429` with `Retry-After` header after 5 attempts within 15 minutes from the same IP
- [ ] `POST /api/auth/forgot-password` returns `429` after 3 attempts per IP per 15 minutes
- [ ] `POST /api/auth/resend-verification` returns `429` after 3 attempts per IP per 15 minutes
- [ ] `POST /api/auth/reset-password` rate-limited by email, not IP
- [ ] Credentials login returns auth error after 10 failed attempts per email per 15 minutes
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` documented in `.env.example` and architecture doc
- [ ] `npx tsc --noEmit` passes

---

### Part 2: Session Architecture — JWT Cleanup + Email Verified Fix

**What:** Strip mutable claims from the JWT. Make `requireOrgRole()` a live DB lookup. Fix the email verification banner so it clears immediately after verification without re-login.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P2.R1 | **Remove `orgId`, `orgRole` from the JWT token and session.** Update `src/lib/auth/auth.ts` JWT callback: token carries only `userId`, `email`, `name`, `platformRole`, `emailVerified`. Remove all org-scoped fields from both the JWT callback and session callback. Update `src/lib/auth/types.ts` to reflect the stripped shape. |
| P2.R2 | **Update `requireOrgRole()` in `src/lib/auth/require-org-role.ts`** to accept `orgId: string` and `requiredRole: OrgRole` as parameters (in addition to the request session). It queries `org_memberships` where `userId = session.user.userId` AND `orgId = orgId` AND `deleted_at IS NULL`. Returns the membership row if found and role is sufficient; throws `ERR.FORBIDDEN` otherwise. This guard no longer reads any org claim from the JWT. |
| P2.R3 | **Update all API routes that currently call `requireOrgRole()`** to pass `orgId` from the URL parameter (e.g., `params.orgId` or `params.hackathonId` resolved to its org). No route should derive org context from the session token. |
| P2.R4 | **Update all service layer calls** that received `orgId` from the session to receive it from the API route (which now sourced it from the URL). Service signatures are unchanged — they already accept `orgId` as a parameter; the change is at the call site in the route handler. |
| P2.R5 | **Fix the email verification banner.** After `POST /api/auth/verify-email` successfully marks `email_verified = true` in the database, the route response includes `{ success: true }`. The `verify-email` page reads this response and calls NextAuth's `update({ emailVerified: true })` client-side. The `jwt` callback in `auth.ts` must handle the `trigger === 'update'` case: when `token.trigger === 'update'` and `session.emailVerified === true`, set `token.emailVerified = true`. The `VerificationBanner` component reads `session.user.emailVerified` — this now clears without re-login. |
| P2.R6 | **Session type update.** `src/lib/auth/types.ts` must export a `VerifiedUser` type (and augment `next-auth` module declarations) that reflects the new JWT shape: `{ userId, email, name, platformRole, emailVerified }`. Remove any `orgId`, `orgRole`, `role` fields from the augmented Session and JWT types. |
| P2.R7 | **Audit all client components that read org context from the session.** Any component using `session.user.orgId` or `session.user.role` (org role) must be updated to derive org context from the URL or props instead. Org role display in UI (e.g., role badge in member table) must come from API response data, not the JWT. |
| P2.R8 | **`requireSuperAdmin()`** in `src/lib/auth/require-super-admin.ts` is unaffected — `platformRole` stays in the JWT. Verify it still works after the token shape change. |

**Acceptance Criteria:**

- [ ] JWT token no longer contains `orgId`, `orgRole`, or any org-scoped claims
- [ ] `session.user` type no longer exposes `orgId` or `orgRole`
- [ ] `requireOrgRole(session, orgId, requiredRole)` performs a DB lookup on `org_memberships`; does not read JWT claims
- [ ] All API routes pass `orgId` from URL parameters, not from session
- [ ] Promoting a member to org_admin takes effect on their next API request without re-login
- [ ] Removing a member from an org locks them out on their next API request without re-login
- [ ] Verifying email causes the verification banner to disappear immediately without logout/login
- [ ] `requireSuperAdmin()` continues to work correctly
- [ ] No client component reads `session.user.orgId` or `session.user.role` (org role)
- [ ] `npx tsc --noEmit` passes with zero errors

---

### Part 3: Platform Landing Page + Org-less Participant Flow

**What:** Replace the temporary root page with a real platform homepage. Fix the post-login experience for users with no org membership.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P3.R1 | **Platform top nav component.** Create `src/components/platform-nav.tsx` (shared, not route-specific). Logged-out: HackForge wordmark (left), "Sign In" (ghost button) + "Get Started" (primary button, links to `/signup`) (right). Logged-in: wordmark (left), user avatar + name dropdown (right) — dropdown contains: "My Dashboard" (→ `/dashboard`), "Account Settings" (→ `/dashboard/account`), "Sign Out". The platform nav is used on the root landing page only; the dashboard uses the existing sidebar + top bar. |
| P3.R2 | **Root platform landing page.** Replace `src/app/page.tsx` with a full page. Sections: (a) **Hero** — HackForge tagline, one-line value prop, "Browse Hackathons" anchor CTA + "Get Started" CTA. (b) **Hackathon discovery grid** — lists all public hackathons across all orgs where `status IN ('published', 'active')` and `visibility = 'public'` and `deleted_at IS NULL`. Cards: cover image (signed URL or gradient fallback), title, org name, status badge (Open for Registration / Active), registration phase end date. (c) **Filter bar** — pill filters: All, Open for Registration, Active, Upcoming (published but registration not yet open). (d) **Empty state** — "No hackathons are live right now. Check back soon." (e) **Footer** — "Built with HackForge" + links: Sign In, Get Started. |
| P3.R3 | **Platform landing page — server rendering.** The page is a React Server Component. Hackathon data is fetched server-side via a new `hackathon-service.ts` function `getPublicHackathons(filter?: HackathonStatusFilter)`. Signed cover image URLs are generated server-side. `generateMetadata` exports SEO title and description for the root page. |
| P3.R4 | **New service function: `getPublicHackathons`.** In `hackathon-service.ts`, add `getPublicHackathons(statusFilter?: 'open' | 'active' | 'upcoming'): Promise<PublicHackathon[]>`. Queries hackathons joined with organizations (for org name) where `visibility = 'public'` and `deleted_at IS NULL` and status is in scope. Returns cover image signed URL. |
| P3.R5 | **Org-less post-login redirect.** The `/dashboard` page currently detects no org membership and sends the user to org creation. Change this: if a user has no org memberships, render the `/dashboard` page with two sections: (a) "Your Hackathons" — their `registrations` joined with hackathon data (same as My Hackathons view, can be empty with CTA to browse). (b) "Get Started" — "Create an Organization" (→ `/dashboard/create-org`) and a note that org membership can also come via an invite link. No forced redirect. |
| P3.R6 | **Org-less sidebar state.** When a user has no org memberships, the sidebar shows: "My Hackathons" link + "Account Settings" link. No org-specific nav items. Org switcher in the top bar shows "No Organization" state with a "Create Org" prompt. This is already partially supported by the org switcher; complete it. |
| P3.R7 | **Admin `getPublicHackathons` query** must join `organizations` to expose `orgName` and `orgSlug` for display on the platform homepage cards. |

**Acceptance Criteria:**

- [ ] `src/app/page.tsx` is a full platform landing page — not a placeholder
- [ ] Platform nav renders correctly for logged-out and logged-in users
- [ ] Discovery grid shows all public, non-deleted hackathons with `published` or `active` status
- [ ] Filter pills filter the grid without a page reload (client component for filter state, server fetch on mount)
- [ ] Cover images display; gradient fallback shown when no cover image
- [ ] Page is server-rendered; `generateMetadata` exports correct title + description
- [ ] A user with no org memberships lands on a useful `/dashboard` page after login — not a forced org-creation screen
- [ ] Org-less sidebar shows only "My Hackathons" and "Account Settings"
- [ ] `getPublicHackathons()` returns org name for display on cards
- [ ] `npx tsc --noEmit` passes

---

### Part 4: User Profile + Account Settings

**What:** Self-service account management page accessible to all authenticated users.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P4.R1 | **Route: `/dashboard/account`.** Server component page in `src/app/(dashboard)/dashboard/account/`. Co-located `_components/` directory for the sub-sections. Accessible from the user avatar dropdown in the top bar (add "Account Settings" link to the dropdown). Rendered inside the existing `(dashboard)` layout — user is authenticated; no `[orgSlug]` required. |
| P4.R2 | **Personal Info section.** Displays: current avatar (signed URL or initials fallback), current display name, email (read-only — email change is deferred). "Edit" button opens an inline form: Name field (text, required, min 2 chars, Zod-validated). Save button: `PATCH /api/user/profile` → updates `users.name` → triggers NextAuth `update({ name: newName })` to refresh the session token → success toast. Cancel restores original value. |
| P4.R3 | **Avatar upload section.** "Change Photo" button triggers the existing image upload flow (signed URL via `POST /api/upload/image`). Uploaded image stored in Supabase Storage under `avatars/[userId]/[filename]`. On success: `PATCH /api/user/profile` with `avatarUrl`. Avatar displayed at 96×96, circular. If no avatar, show initials avatar (same as existing pattern). "Remove Photo" button (only shown when avatar exists): clears `users.avatar_url`, deletes the storage object. |
| P4.R4 | **Security section — change password.** Three fields: Current Password, New Password (min 8 chars), Confirm New Password. All required. Submitted to `POST /api/user/change-password`. Server: fetch user by `userId`, verify current password with bcrypt, hash new password, update `users.password_hash`. Returns 400 if current password is wrong (generic message: "Current password is incorrect"). Returns 200 on success → toast "Password updated." Form clears on success. |
| P4.R5 | **Your Organizations section (read-only).** List of all orgs the user belongs to. Each entry: org logo (or initials), org name, user's role in that org (Member / Admin), "Go to Dashboard" link → `/dashboard/[orgSlug]`. If user has no org memberships: "You're not part of any organization yet." with a "Create one" link → `/dashboard/create-org`. This section is navigational only — no editable controls. |
| P4.R6 | **API routes.** `PATCH /api/user/profile` (auth required): accepts `{ name?, avatarUrl?, removeAvatar?: boolean }`. Updates `users.name` and/or `users.avatar_url`. On `removeAvatar: true`, deletes the storage object via `StorageProvider` and sets `avatar_url = null`. `POST /api/user/change-password` (auth required): accepts `{ currentPassword, newPassword }`. Validates with Zod. Returns `400` on wrong current password, `200` on success. |
| P4.R7 | **Zod schemas.** Add `updateProfileSchema` and `changePasswordSchema` to `src/lib/validations/auth.ts`. |
| P4.R8 | **"Account Settings" entry in the top bar dropdown.** In `top-bar.tsx`, add "Account Settings" → `/dashboard/account` to the user dropdown menu, above "Sign Out". Visible to all authenticated users. |

**Acceptance Criteria:**

- [ ] `/dashboard/account` page renders for all authenticated users regardless of org membership
- [ ] "Account Settings" link in top bar dropdown navigates to the page
- [ ] Name edit: saves via `PATCH /api/user/profile`, refreshes session token, success toast appears
- [ ] Avatar upload works using the existing signed URL flow; stored under `avatars/[userId]/`
- [ ] Avatar removal deletes storage object and clears `avatar_url`
- [ ] Change password: rejects wrong current password with generic message; succeeds with correct one; form clears
- [ ] Organizations section lists all orgs with role and dashboard link
- [ ] Users with no orgs see the empty state with "Create one" link
- [ ] Email field is read-only (not editable)
- [ ] `PATCH /api/user/profile` and `POST /api/user/change-password` both require auth and validate with Zod
- [ ] `npx tsc --noEmit` passes

---

### Part 5: Pagination Architecture

**What:** Replace all full-table client fetches with server-side search and offset-based pagination. Establish the shared pagination pattern that Phase 4+ will inherit.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P5.R1 | **Shared `<PaginationControls>` component.** Create `src/components/pagination-controls.tsx`. Props: `totalCount: number`, `page: number`, `pageSize: number`, `onPageChange: (page: number) => void`. Renders: "Showing X–Y of Z results" label, Previous / Next buttons (disabled at boundaries), current page indicator. Page size is fixed per context (not user-configurable in V1). Uses URL search params for navigation — clicking Next updates `?page=N` in the URL via `useRouter().replace()`. |
| P5.R2 | **Shared pagination service helper.** Add `paginate<T>(query: SQL, page: number, pageSize: number): Promise<{ rows: T[]; totalCount: number }>` in a new `src/lib/db-utils.ts`. Executes the query with `LIMIT pageSize OFFSET (page - 1) * pageSize` and a separate `COUNT(*)` query. Used by all paginated service functions. |
| P5.R3 | **URL search params pattern.** All list pages read `page` (default 1), `q` (search query), and any filter params from `searchParams` (Next.js server component prop). These are passed to the service. Client-side filter/search components update the URL via `useRouter().replace()` with `startTransition` for non-blocking navigation. The URL is the single source of truth for list state — bookmarkable and shareable. |
| P5.R4 | **Paginate: Participant browse (`/hackathons/[slug]/participants`).** Refactor `participants-browse-client.tsx`: remove full client fetch + useMemo search. Server component reads `searchParams`, calls `getDiscoverableParticipants(hackathonId, { q, page, pageSize: 24 })`. Service adds `WHERE name ILIKE '%q%' OR email ILIKE '%q%'` when `q` is set. Returns `{ rows, totalCount }`. `PaginationControls` renders below the grid. |
| P5.R5 | **Paginate: Team browse (`/hackathons/[slug]/teams`).** Refactor `team-browse-client.tsx`: server component fetches with `getTeamsByHackathon(hackathonId, { trackId, q, page, pageSize: 20 })`. Service applies track filter and name search server-side. `PaginationControls` renders below the grid. Track filter pill selection updates `?trackId=` in the URL. |
| P5.R6 | **Paginate: Admin participant roster (`[hackathonId]/participants`).** Refactor `participants-table.tsx`: server component fetches with `getRegistrationsByHackathon(hackathonId, { q, trackId, hasTeam, page, pageSize: 25 })`. All filters and search are server-side. `PaginationControls` renders below the table. CSV export remains full-table (no pagination — admin exports all). |
| P5.R7 | **Paginate: Admin team list (`[hackathonId]/teams`).** Refactor `admin-teams-client.tsx`: server component fetches with `getAllTeams(hackathonId, { trackId, isOpen, adminStatus, q, page, pageSize: 25 })`. Filters server-side. `PaginationControls` renders below the table. The "Pending Review" section at the top is not paginated — it shows all pending teams (expected to be small). |
| P5.R8 | **Paginate: Org member list (`/members`).** Refactor `member-table.tsx`: server component fetches with `getOrgMembers(orgId, { q, page, pageSize: 25 })`. Search by name or email. `PaginationControls` renders below the table. |
| P5.R9 | **Paginate: Hackathon list (`/hackathons`).** Refactor `hackathon-list.tsx`: server component fetches with `getHackathonsByOrgId(orgId, { q, status, page, pageSize: 12 })`. Filter by status. `PaginationControls` renders below the grid. |
| P5.R10 | **Service function signatures.** All paginated service functions accept `{ q?: string, page?: number, pageSize?: number, ...filters }` and return `{ rows: T[], totalCount: number }`. Page defaults to 1; pageSize to the context default. Existing callers that don't pass pagination params receive page 1 with the default page size. |
| P5.R11 | **Remove client-side search workarounds.** Delete all `useMemo`-based search filtering in existing browse components after server-side search is in place. No dead client-side filter code remains. |

**Acceptance Criteria:**

- [ ] `<PaginationControls>` component renders correctly with disabled states at boundaries
- [ ] Clicking Next/Previous updates `?page=N` in the URL without full page reload
- [ ] All 6 list views (participant browse, team browse, admin participant roster, admin team list, member list, hackathon list) use server-side pagination
- [ ] Search and filters are URL params — shareable and bookmarkable
- [ ] `useMemo`-based client-side search removed from all refactored components
- [ ] Admin CSV export remains full-table (not paginated)
- [ ] Pending Review section in admin team list is not paginated
- [ ] `paginate()` DB helper used consistently across all paginated service functions
- [ ] `npx tsc --noEmit` passes

---

### Part 6: Design Token System

**What:** Formalize the CSS custom property token system for both themes. Establish the typography scale. Eliminate hardcoded values from existing components.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P6.R1 | **Color tokens — admin theme.** In `globals.css` under `:root` (or `.theme-admin` — whichever the admin routes use), define: brand palette (`--color-brand-50` through `--color-brand-900`), neutral palette (`--color-neutral-50` through `--color-neutral-950`), semantic aliases (`--color-success`, `--color-warning`, `--color-error`, `--color-info` — each with `-foreground` variant for text on colored backgrounds), surface tokens (`--color-background`, `--color-surface`, `--color-surface-raised`, `--color-border`, `--color-border-subtle`), text tokens (`--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-disabled`). |
| P6.R2 | **Color tokens — competitive theme.** Under `.theme-competitive`, define the same semantic aliases mapped to the dark theme palette already in use. Competitive theme tokens override the admin tokens where values differ. Components reference semantic aliases only — never hardcoded hex values. |
| P6.R3 | **Typography scale.** Define in `globals.css` under `@layer base`: `--font-size-xs` (12px), `--font-size-sm` (14px), `--font-size-base` (16px), `--font-size-lg` (18px), `--font-size-xl` (20px), `--font-size-2xl` (24px), `--font-size-3xl` (30px), `--font-size-4xl` (36px). Line heights: `--line-height-tight` (1.25), `--line-height-snug` (1.375), `--line-height-normal` (1.5), `--line-height-relaxed` (1.625). Font weights: `--font-weight-normal` (400), `--font-weight-medium` (500), `--font-weight-semibold` (600), `--font-weight-bold` (700). Apply base body styles in `@layer base`: `body { font-size: var(--font-size-base); line-height: var(--line-height-normal); color: var(--color-text-primary); }`. |
| P6.R4 | **Spacing, radius, and shadow tokens.** Define: border radius — `--radius-sm` (4px), `--radius-md` (6px), `--radius-lg` (8px), `--radius-xl` (12px), `--radius-full` (9999px). Shadows — `--shadow-sm`, `--shadow-md`, `--shadow-lg` mapped to Tailwind's shadow scale values. These complement (not replace) Tailwind utility classes — they're used in custom component styles that can't use Tailwind classes directly. |
| P6.R5 | **Tailwind config alignment.** Extend `tailwind.config.ts` to reference CSS custom properties where appropriate (e.g., `colors.brand`, `colors.surface`, `borderRadius.sm/md/lg/xl`) so Tailwind utility classes like `bg-brand-600`, `text-text-primary`, `rounded-lg` resolve to token values. This makes the token system accessible from both CSS custom properties and Tailwind classes. |
| P6.R6 | **Component audit.** Search all component files for: hardcoded hex colors (e.g., `text-[#...]`, `bg-[#...]`), arbitrary font sizes (`text-[13px]`), arbitrary padding/margin (`p-[18px]`). Replace with token-based Tailwind classes or CSS custom properties. Record every replacement — if a value doesn't map cleanly to the token scale, add the token rather than keep the arbitrary value. |
| P6.R7 | **Document the token system.** Add a "Design Token Reference" section to `docs/003-coding-conventions.md` listing: the color token names and their purpose, the typography scale, when to use CSS custom properties vs Tailwind utility classes. This is the reference future developers use when adding UI. |

**Acceptance Criteria:**

- [ ] Admin theme color tokens defined under `:root` (or `.theme-admin`)
- [ ] Competitive theme tokens defined under `.theme-competitive`, overriding where values differ
- [ ] Semantic color aliases exist for: brand, neutral, success, warning, error, info — each with a `-foreground` variant
- [ ] Surface and text tokens defined and applied to `body` via `@layer base`
- [ ] Typography scale (8 font sizes, 4 line heights, 4 font weights) defined as CSS custom properties
- [ ] `tailwind.config.ts` references token values for colors and border radius
- [ ] Zero hardcoded hex values remain in component files after the audit
- [ ] Zero arbitrary font size or spacing values remain after the audit
- [ ] Token system documented in `docs/003-coding-conventions.md`
- [ ] Both themes render correctly after refactor — no visual regressions

---

### Part 7: Org Settings CRUD

**What:** Implement the `/settings` page for org admins to update org name and logo. The page is already in the sidebar; it is currently a placeholder.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P7.R1 | **Org settings page.** Implement `src/app/(dashboard)/dashboard/[orgSlug]/settings/page.tsx` (currently placeholder). Page is gated to `org_admin` — members see a 403 state. Sections: (a) General Settings, (b) Danger Zone (read-only in V1, explains what's coming). |
| P7.R2 | **General Settings section.** Fields: Org Name (text, required, min 2 chars), Org Logo (image upload). Org Slug: displayed as read-only with a tooltip "Slug cannot be changed after creation — it's part of all your hackathon URLs." Save button: `PATCH /api/orgs/[orgId]` → updates name and/or logo. Success toast. |
| P7.R3 | **Logo upload.** Uses the existing signed URL upload flow (`POST /api/upload/image`). Stored under `org-logos/[orgId]/[filename]`. Displayed as a 64×64 rounded square. "Remove Logo" button clears `organizations.logo_url` and deletes the storage object. |
| P7.R4 | **API route: `PATCH /api/orgs/[orgId]`** (org_admin required). Accepts `{ name?, logoUrl?, removeLogo?: boolean }`. Validates with `updateOrgSchema` (Zod). Updates `organizations.name` and/or `organizations.logo_url`. On `removeLogo: true`, deletes storage object and sets `logo_url = null`. Returns updated org. |
| P7.R5 | **Danger Zone section (V1 — informational only).** A muted card: "Delete Organization — Permanently delete this organization and all its hackathons. This action cannot be undone." Button is disabled with tooltip "Contact support to delete your organization." No delete functionality in V1. |
| P7.R6 | **Add `updateOrgSchema`** to `src/lib/validations/org.ts`. |
| P7.R7 | **Update `org-service.ts`** with `updateOrg(orgId, data: { name?, logoUrl?, removeLogo? })` that applies the changes. |

**Acceptance Criteria:**

- [ ] `/dashboard/[orgSlug]/settings` renders a real page (not placeholder)
- [ ] Page gated to `org_admin` — members see a 403 state
- [ ] Org name editable and saves correctly
- [ ] Logo upload works via signed URL; stored under `org-logos/[orgId]/`
- [ ] Logo removal deletes storage object and clears `logo_url`
- [ ] Slug is read-only with explanatory tooltip
- [ ] Danger Zone section is present but delete button is disabled with tooltip
- [ ] `PATCH /api/orgs/[orgId]` validates with Zod, requires org_admin
- [ ] `npx tsc --noEmit` passes

---

## Backlog (Deferred from Phase 3.5)

| Item | Reason | Target |
|------|--------|--------|
| Email change with re-verification | Requires session invalidation + re-verification loop — a separate flow worth doing carefully | V1.5 |
| Org deletion | Requires full cascade audit across hackathons, registrations, teams, submissions | V1.5 |
| Cursor-based pagination | Offset pagination is correct at V1 scale; cursor adds complexity without benefit yet | V2 |
| SSO / SAML login | Enterprise procurement requirement — high value but significant scope | V1.5 |
| Billing / subscription management | No Stripe integration in V1; all orgs are effectively on "free" | V2 |
| API versioning (`/api/v1/`) | Zero-cost naming decision deferred — add before any public API or webhook launch | V2 |
| Real-time leaderboard / phase transitions | SSE or WebSocket adds runtime complexity; polling is sufficient for V1 | V2 |
| White-labeling / custom domains | Token system in Part 6 lays the foundation; full white-label is V2 | V2 |
| In-app notification bell | Scoped to Phase 6 — email covers all Phase 3.5 events | Phase 6 |

---

## Phase 3.5 Deliverable

> A potential customer types hackforge.io and lands on a real platform homepage showing all live public hackathons. They sign up, get rate-limited if they attempt to brute-force the login, and land on a useful dashboard even before joining an org. After verifying their email, the verification banner disappears immediately — no re-login needed. An org admin promotes a member, and that member's elevated permissions take effect on their next action. A user who made a typo in their name at signup can fix it themselves from Account Settings. An admin browsing a 1,000-person participant roster sees 25 results per page with server-side search — not a 3-second wait for the browser to load the full table.

---

## Effort Summary

| Part | Focus | Est. Days |
|------|-------|-----------|
| 1 | Rate limiting on auth endpoints | 1 |
| 2 | JWT cleanup + email verified fix | 1 |
| 3 | Platform landing page + org-less flow | 1.5 |
| 4 | User profile + account settings | 1 |
| 5 | Pagination architecture | 1.5 |
| 6 | Design token system | 1 |
| 7 | Org settings CRUD | 0.5 |
| **Total** | | **~7.5 days** |

---

*This PRD covers Phase 3.5 only. Technical implementation details are specified in the TRD (`docs/009-core-hardening/trd.md`) after this PRD is approved.*
