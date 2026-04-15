# PRD — Phase 1: Foundation + Auth

**Document ID:** PRD-006  
**Date:** April 16, 2026  
**Author:** Burhanuddin C.  
**Status:** Draft — Awaiting Approval  
**References:** `docs/002-v1-development-phases.md`, `docs/004-architecture.md`

---

## Purpose

Phase 1 establishes the foundation of HackForge — the project scaffolding, database schema, authentication system, organization management, and the application shell. Every subsequent phase builds on this foundation. The goal is to have a working platform where users can create accounts, form organizations, invite team members, and see a functional dashboard — all with a professional, enterprise-grade feel from day one.

---

## User Stories

1. **As a new user**, I want to sign up with my email and password so that I have an account on the platform.
2. **As a registered user**, I want to verify my email so that I can unlock all platform actions (unverified users can log in and browse, but cannot perform any actions like creating orgs, accepting invites, or registering for hackathons).
3. **As a registered user**, I want to log in with my credentials so that I can access the platform.
4. **As an unverified user**, I want to see a persistent banner prompting me to verify my email, with the option to resend the verification email.
5. **As a registered user**, I want to reset my password if I forget it so that I can regain access independently.
6. **As a verified, logged-in user**, I want to create an organization so that I can set up and manage hackathons under it.
7. **As an org admin**, I want to invite colleagues by email so that they can join my organization as admins or members.
8. **As an invited user**, I want to accept an org invite (whether I'm new to the platform or already registered) so that I join the organization with the correct role.
9. **As an org admin**, I want to view and manage org members (list, change roles, remove from org) so that I control who has access.
10. **As an org admin or member**, I want to see an org dashboard with navigation so that I have a home base for managing hackathons.
11. **As a super admin**, I want to access a platform-level admin panel so that I can view all organizations and users on the platform.

---

## Parts

Phase 1 is divided into 3 parts. Each part is a self-contained, shippable unit.

---

### Part 1: Project Scaffolding + Database Schema

**What:** Initialize the project, set up the tech stack, define the core database schema, and run the initial migration.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P1.R1 | Initialize a Next.js 16+ project with TypeScript, App Router, and Tailwind CSS v4 |
| P1.R2 | Install and configure Tailwind CSS v4 and shadcn (Radix, Nova preset) with a **dual-tone design system**: (a) **Admin/organizer-facing pages** (dashboard, member management, hackathon setup, judging) — professional, clean, light background, high contrast, functional. These are work tools and should feel efficient and readable. (b) **Participant-facing pages** (hackathon landing page, registration, leaderboard, results) — competitive gaming aesthetic: dark backgrounds, bold/neon accent colors, dynamic visual energy. These pages should make people excited to compete. **Typography:** Admin pages use a clean sans-serif font (Geist Sans) for all text. Participant-facing pages use a bold, geometric display font (Space Grotesk) for headings to convey competition and energy, while body text remains in the standard sans-serif for readability. The font swap is driven by CSS variables so components don't need mode-specific code. Define shared design tokens (colors, typography, spacing) in `globals.css` to support both modes. |
| P1.R3 | Set up Drizzle ORM with PostgreSQL connection (Supabase-hosted) |
| P1.R4 | Define the `users` table: id (uuid), email (unique), name, password_hash, avatar_url (nullable), email_verified (default false), platform_role (enum: `user`, `super_admin`, default `user`), created_at, updated_at, deleted_at (nullable) |
| P1.R5 | Define the `organizations` table: id (uuid), name, slug (unique), logo_url (nullable), created_at, updated_at, deleted_at (nullable) |
| P1.R6 | Define the `org_memberships` table: id (uuid), user_id (FK), org_id (FK), role (enum: `org_admin`, `member`), invited_at (nullable), joined_at (nullable) |
| P1.R7 | Define the `org_invites` table: id (uuid), org_id (FK), email, role (enum: `org_admin`, `member`), token (unique), invited_by (FK → users.id), expires_at, accepted_at (nullable), created_at |
| P1.R8 | Define all enums as Postgres enums in a dedicated enums file: `platform_role`, `org_role` |
| P1.R9 | Generate and run the initial Drizzle migration |
| P1.R10 | Set up the project folder structure as defined in the architecture doc |
| P1.R11 | Create a `.env.example` file documenting all required environment variables (DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, NEXT_PUBLIC_APP_URL, RESEND_API_KEY, FROM_EMAIL) |
| P1.R12 | Provide guided setup instructions for connecting Supabase Postgres and Resend |

**Acceptance Criteria:**

- [ ] Next.js project runs locally with `npm run dev`
- [ ] Tailwind CSS v4 and shadcn are functional (a test component renders correctly)
- [ ] Both design modes work: admin (light, Geist Sans headings) and competitive (dark, neon accents, Space Grotesk headings)
- [ ] Drizzle connects to Supabase Postgres successfully
- [ ] All 5 tables (`users`, `organizations`, `org_memberships`, `org_invites`, `verification_tokens`) and 2 enums exist in the database after migration
- [ ] Folder structure matches the architecture doc
- [ ] `.env.example` exists with all required variables documented

---

### Part 2: Authentication

**What:** Implement the full authentication system — sign-up, login, email verification, forgot/reset password — using NextAuth.js v5 with the Credentials provider and JWT strategy.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P2.R1 | Configure NextAuth.js v5 with Credentials provider and JWT session strategy |
| P2.R2 | Build a sign-up page with email, name, and password fields. Validate with Zod (email format, name non-empty, password min 8 chars with complexity rules). Hash password with bcrypt (cost factor 12). Create user record. |
| P2.R3 | On sign-up, send a verification email via Resend with a secure token. Build a verification page that marks the user's email as verified when they click the link. |
| P2.R4 | **Email verification policy (Option B — login allowed, actions restricted):** Unverified users CAN log in and browse the platform (view dashboard, navigate the shell). Unverified users CANNOT perform any actions: create orgs, accept org invites, invite members, or any future write actions (hackathon registration, submissions, etc.). All restricted actions check `email_verified === true` and return a clear error directing the user to verify. |
| P2.R5 | Display a persistent, non-dismissible banner on all pages for unverified users: "Please verify your email to unlock all features" with a "Resend verification email" button. The banner disappears once the email is verified. |
| P2.R6 | Build a login page with email and password fields. Show clear error messages for invalid credentials. Unverified users are allowed to log in (they see the restricted-action banner, not a login block). |
| P2.R7 | Build a forgot-password page that accepts an email, sends a reset link via Resend with a time-limited token (1 hour expiry). |
| P2.R8 | Build a reset-password page that accepts the token and a new password. Validate the token, update the password hash, and invalidate the token. |
| P2.R9 | JWT session contains: userId, email, name, platformRole, emailVerified. No sensitive data in the token. |
| P2.R10 | Create auth middleware that protects all `/dashboard` routes — unauthenticated users are redirected to `/login`. Authenticated but unverified users are allowed in but see the verification banner and cannot perform actions. |
| P2.R11 | All auth pages have a professional, polished design consistent with enterprise SaaS products. |
| P2.R12 | Store password reset tokens and email verification tokens securely (hashed in DB with expiry). |

**Acceptance Criteria:**

- [ ] A new user can sign up with email/name/password
- [ ] Sign-up sends a verification email; clicking the link verifies the account
- [ ] A verified user can log in and receives a valid JWT session
- [ ] An unverified user CAN log in and see the dashboard (not blocked at login)
- [ ] An unverified user sees a persistent, non-dismissible verification banner on all pages
- [ ] An unverified user CANNOT perform any actions (create org, accept invite, etc.) — attempts show a clear "verify your email" error
- [ ] The "Resend verification email" button on the banner works and sends a new email
- [ ] The verification banner disappears immediately after email is verified
- [ ] Invalid credentials show appropriate error messages
- [ ] Forgot password sends a reset email; the reset link works within 1 hour
- [ ] Reset password updates the password; old password no longer works
- [ ] Expired/invalid reset tokens are rejected with a clear message
- [ ] Unauthenticated access to `/dashboard` redirects to `/login`
- [ ] All form inputs are validated client-side (Zod) and server-side

---

### Part 3: Organization Management + App Shell + Admin Panel

**What:** Build the org creation flow, invite system, member management, the application shell (sidebar + top bar), org dashboard skeleton, RBAC middleware, and a basic super admin panel.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P3.R1 | Build an org creation flow accessible after login: user provides org name and slug. Slug is auto-generated from name but editable. Validate slug uniqueness. Creator is automatically assigned `org_admin` role. **Requires verified email** — unverified users see the verification banner and cannot access this flow. |
| P3.R2 | After org creation (or if user belongs to an org), redirect to the org dashboard. If user has no org and no pending invites, show a "Create Organization" prompt (disabled with verification message for unverified users). |
| P3.R3 | Build invite-by-email flow: org_admin enters an email and selects a role (`org_admin` or `member`). System generates a unique token, creates an `org_invites` record, and sends an invitation email via Resend with an accept link. **Requires verified email.** |
| P3.R4 | Invite acceptance: if the invitee is an existing verified user, they log in and are auto-joined to the org. If the invitee is new, they sign up, verify their email, and are then auto-joined. If the invitee is existing but unverified, they must verify before the invite is accepted. The invite token is marked as accepted only after successful join. |
| P3.R5 | Build a member management page: list all org members (name, email, role, joined date), allow org_admin to change member roles and remove members from the org. Edge cases: cannot demote the last org_admin, cannot remove the last org_admin, removal is a soft action (user retains their platform account, only the org_membership is deleted). |
| P3.R6 | Build the app shell: sidebar navigation (collapsible) with links to dashboard, hackathons (placeholder), members, settings (placeholder). Top bar with org name/switcher and user menu (name, email, logout). |
| P3.R7 | Build the org dashboard skeleton: placeholder stat cards (total hackathons, active participants, upcoming deadlines — all showing zero/placeholder for now). |
| P3.R8 | Implement RBAC middleware: org-level checks for `org_admin` vs `member` permissions. `org_admin` can invite, manage members, and manage org settings. `member` can view dashboard and be assigned roles in hackathons. |
| P3.R9 | If a user is a member of multiple orgs, provide an org switcher in the top bar to navigate between them. |
| P3.R10 | Build a basic super admin panel at `/admin`: list all organizations (name, slug, member count, created date), list all platform users (name, email, platform_role, created date). Gated behind `super_admin` platform_role check. |
| P3.R11 | All pages are responsive (desktop-first, mobile-usable) with loading states and empty states. |

**Acceptance Criteria:**

- [ ] A logged-in, verified user can create an organization with name and slug
- [ ] An unverified user cannot create an organization (sees verification prompt)
- [ ] Creator is automatically `org_admin` of the new org
- [ ] User with no org sees "Create Organization" prompt (disabled if unverified)
- [ ] Org admin can invite a colleague by email with a selected role
- [ ] Invitation email is sent with a valid accept link
- [ ] New user can sign up via invite link → verifies email → auto-joins the org
- [ ] Existing verified user can log in via invite link and auto-join the org
- [ ] Existing unverified user must verify email before invite is accepted
- [ ] Member management page lists all members with correct roles
- [ ] Org admin can change a member's role
- [ ] Org admin can remove a member from the org (member retains platform account)
- [ ] Cannot demote or remove the last remaining org_admin
- [ ] App shell renders with sidebar, top bar, and user menu
- [ ] Org switcher appears when user belongs to multiple orgs
- [ ] Dashboard shows placeholder stat cards
- [ ] Non-org_admin users cannot access invite or member management actions
- [ ] Super admin can access `/admin` and see all orgs and users
- [ ] Non-super-admin users cannot access `/admin`
- [ ] All pages have loading states and empty states

---

## Backlog (Deferred from Phase 1)

These items were discussed and explicitly deferred:

| Item | Reason | Target |
|------|--------|--------|
| Logo/avatar upload | Requires StorageProvider interface (Phase 4) | Phase 4 |
| `org_only` hackathon visibility | Needs proper org membership verification for participants | V2 |
| `invite_only` hackathon visibility | Needs hackathon-scoped invite system | V2 |
| Email domain auto-join for orgs | Nice-to-have; explicit invite is sufficient for V1 | V2 |
| Bulk invite (CSV upload) | Useful for InMobi but not critical for V1 | V2 |
| Master PRD document | Full product scope doc; not blocking Phase 1 | Before Phase 2 |

---

## Phase 1 Deliverable

> A user signs up → receives verification email → can log in immediately but sees a verification banner and cannot perform actions → verifies email → banner disappears, full access unlocked → creates an organization → invites a colleague by email → colleague signs up via invite link → verifies their email → auto-joins the org as the assigned role → both see the org dashboard with sidebar navigation. Super admin can view all orgs and users at `/admin`.

---

## Visibility Model (For Awareness — Not Built in Phase 1)

- **V1:** `public` only — any platform user with the hackathon link can view and register.
- **Later:** `org_only` (org membership required) and `invite_only` (hackathon-scoped invite) to be built with proper access control.

---

## Role Model (For Awareness — Fully Defined Here, Partially Built in Phase 1)

| Level | Where It Lives | Values | Built In |
|-------|---------------|--------|----------|
| Platform | `users.platform_role` | `user`, `super_admin` | Phase 1 |
| Organization | `org_memberships.role` | `org_admin`, `member` | Phase 1 |
| Hackathon — Judge | `judge_assignments` table | Assignment, not a role | Phase 5 |
| Hackathon — Participant | `registrations` table | Registration, not a role | Phase 3 |

**Platform roles:**
- `user` — default. Can create orgs, join orgs, register for public hackathons, participate.
- `super_admin` — everything a user can do, plus access `/admin` panel (view all orgs, view all users).

**Org roles:**
- `org_admin` — full control within the org: create/manage hackathons, invite members, manage roles, configure judging, view all data.
- `member` — part of the organizing team: can view org dashboard, can be assigned as judge, can assist with hackathon operations as delegated by org_admin.

---

*This PRD covers Phase 1 only. Technical implementation details will be specified in the TRD (`docs/006-foundation-auth/trd.md`) after this PRD is approved.*
