# HackForge — V1 Development Plan

**Document ID:** DEV-002  
**Date:** April 15, 2026  
**Author:** Burhanuddin C.  
**Timeline:** 20 dev-days (~3 weeks)  
**Approach:** Vertical Slices (full feature end-to-end per phase)  

---

## Overview

V1 of HackForge is a functional MVP that can host InMobi's next internal hackathon end-to-end. It ships with 4 pre-built hackathon templates (not a custom workflow engine), covering ~90% of enterprise hackathon formats.

**What V1 IS:** A complete hackathon lifecycle platform — create hackathon, register participants, form teams, collect submissions, judge with weighted scoring, declare winners.

**What V1 IS NOT:** A configurable workflow engine, a white-labeled SaaS product, or a platform with integrations. Those come in V2-V4.

---

## Tech Stack Summary

| Layer | Technology | Provider |
|-------|-----------|----------|
| Frontend | Next.js 14+ (App Router) | Vercel |
| Styling | Tailwind CSS + shadcn/ui | — |
| Auth | NextAuth.js v5 (Auth.js) | Self-managed |
| ORM | Drizzle ORM | — |
| Database | PostgreSQL | Supabase (swappable) |
| File Storage | Supabase Storage (behind interface) | Supabase (swappable) |
| Email | Resend + React Email | Resend |
| Deployment | Vercel | Vercel |

Full rationale: see [TDR-001: Technical Decisions](./001-technical-decisions.md)

---

## Phase 1: Foundation + Auth (Days 1-3)

**Goal:** Users can sign up, log in, and see an org dashboard.

### Day 1: Project Scaffolding
- [ ] Initialize Next.js 14 project with TypeScript, App Router
- [ ] Install and configure Tailwind CSS + shadcn/ui
- [ ] Set up Drizzle ORM with Supabase Postgres connection
- [ ] Define core database schema:
  - `organizations` — id, name, slug, logo_url, created_at
  - `users` — id, email, name, avatar_url, password_hash, email_verified, created_at
  - `org_memberships` — id, user_id, org_id, role (super_admin | org_admin | member), invited_at, joined_at
- [ ] Run initial migration
- [ ] Set up project structure:
  ```
  src/
  ├── app/              # Next.js App Router pages
  │   ├── (auth)/       # Login, signup, forgot password
  │   ├── (dashboard)/  # Protected app routes
  │   └── api/          # API routes
  ├── components/       # Shared UI components
  │   └── ui/           # shadcn/ui components
  ├── db/               # Drizzle schema, migrations, client
  ├── lib/              # Utilities, helpers, providers
  │   ├── auth/         # NextAuth config
  │   ├── storage/      # StorageProvider interface
  │   └── email/        # Email templates and sender
  └── types/            # Shared TypeScript types
  ```

### Day 2: Authentication
- [ ] Configure NextAuth.js v5 with Credentials provider
- [ ] Build sign-up page: email, name, password (with Zod validation)
- [ ] Build login page with error handling
- [ ] Build forgot password / reset password flow
- [ ] Implement JWT session strategy
- [ ] Create auth middleware for protected routes
- [ ] Email verification flow (send verification email via Resend)

### Day 3: Organization Setup + Shell
- [ ] Build org creation flow (name, slug, logo upload)
- [ ] Implement invite-by-email: generate invite link, send email, accept invite
- [ ] Build member management page (list members, assign roles)
- [ ] Build app shell: sidebar navigation, top bar with user menu
- [ ] Build org dashboard skeleton (placeholder cards for stats)
- [ ] Implement RBAC middleware (check role before allowing actions)

### Phase 1 Deliverable
> **Demo:** A user signs up → creates an organization → invites a colleague → colleague joins with correct role → both see the org dashboard.

---

## Phase 2: Hackathon Creation + Landing Page (Days 4-7)

**Goal:** Admin creates a hackathon from a template, and a public landing page is live.

### Day 4: Hackathon Schema + Templates
- [ ] Define database schema:
  - `hackathons` — id, org_id, title, description, cover_image_url, status (draft | published | active | judging | completed | archived), template_type, visibility (public | org_only | invite_only), team_min_size, team_max_size, allow_individual, created_by, created_at
  - `phases` — id, hackathon_id, name, type (registration | submission | screening | judging | results), order, start_date, end_date, config (JSONB), status
  - `tracks` — id, hackathon_id, name, description, resources_url
  - `prizes` — id, hackathon_id, name, description, rank, image_url
- [ ] Implement 4 hackathon templates as seed configurations:
  - **Idea Sprint:** Registration → Idea Submission → Screening → Winners
  - **Build & Ship:** Registration → Team Formation → Building → Submission → Judging → Winners
  - **Innovation Pipeline:** Registration → Idea Submission → Screening → Prototype → Demo Day → Final Judging → Winners
  - **Open Challenge:** Registration → Submission → Community Voting → Expert Judging → Winners

### Day 5-6: Hackathon Creation Wizard
- [ ] Build multi-step creation wizard:
  - Step 1: Choose template
  - Step 2: Basic info (title, description, cover image)
  - Step 3: Configure tracks/themes (add problem statements, descriptions, resources)
  - Step 4: Set timeline (dates per phase, registration deadline)
  - Step 5: Team rules (min/max size, individual toggle, visibility)
  - Step 6: Define prizes
  - Step 7: Rules, FAQs (rich text editor — use Tiptap or similar)
  - Step 8: Review all settings → Save as Draft or Publish
- [ ] Hackathon settings panel (edit after creation)
- [ ] Draft/Publish/Archive lifecycle management
- [ ] Hackathon list view on org dashboard (active, upcoming, past)

### Day 7: Public Hackathon Landing Page
- [ ] Build public hackathon page (accessible without login):
  - Hero section with cover image, title, dates
  - Overview / About section
  - Tracks / Themes with descriptions
  - Timeline (visual phase timeline)
  - Prizes section
  - Rules and FAQs (collapsible)
  - Register CTA button
- [ ] SEO meta tags and Open Graph for sharing
- [ ] Responsive design pass on the landing page

### Phase 2 Deliverable
> **Demo:** Admin creates a "Build & Ship" hackathon → fills in InMobi-specific details → publishes → a beautiful landing page is live at `/hackathons/[slug]` with a Register button.

---

## Phase 3: Registration + Team Formation (Days 8-10)

**Goal:** Participants can register for a hackathon and form teams.

### Day 8: Registration Flow
- [ ] Define database schema:
  - `registrations` — id, hackathon_id, user_id, status (pending | approved | rejected), form_data (JSONB), registered_at
  - `registration_fields` — id, hackathon_id, label, type (text | textarea | dropdown | multi_select | file), options (JSONB), required, order
- [ ] Build registration form (render dynamic fields from `registration_fields`)
- [ ] Registration confirmation email
- [ ] Admin registration approval workflow (if approval mode enabled)
- [ ] Participant "My Hackathons" dashboard view

### Day 9: Team Formation
- [ ] Define database schema:
  - `teams` — id, hackathon_id, name, description, invite_code, track_id, created_by, created_at
  - `team_members` — id, team_id, user_id, role (lead | member), joined_at
- [ ] Build "Create Team" flow: name, description, select track, get invite code
- [ ] Build "Join Team" flow: enter invite code or browse open teams
- [ ] Team discovery page: list open teams with skill tags, member count, track
- [ ] Team management: lead can add/remove members, edit team info
- [ ] Enforce team size limits (min/max from hackathon config)

### Day 10: Participant Dashboard + Admin Views
- [ ] Participant dashboard: my team, current phase, upcoming deadlines
- [ ] Team workspace view: team profile, member list, shared context
- [ ] Admin view: participant list (filterable, searchable), team list, registration stats
- [ ] Bulk actions for admin: approve/reject registrations, export participant CSV

### Phase 3 Deliverable
> **Demo:** A participant registers for InMobi's hackathon → creates a team "AI Crusaders" → shares invite code → 3 colleagues join → admin sees 15 teams registered → approves all.

---

## Phase 3.5: Core Hardening (Days 11-18, ~7.5 days)

**Goal:** Make the existing three flows production-worthy for any organization worldwide. Close security, correctness, and UX gaps before building Phase 4 on top of them.

**PRD:** `docs/009-core-hardening/prd.md` (PRD-009, Approved)

### Part 1: Security — Rate Limiting (~1 day)
- [ ] Install `@upstash/ratelimit` + `@upstash/redis`
- [ ] Create `src/lib/rate-limit.ts` with 5 sliding-window limiters
- [ ] Apply rate limiting to `POST /api/auth/signup` (5 req / IP / 15 min)
- [ ] Apply rate limiting to `POST /api/auth/forgot-password` (3 req / IP / 15 min)
- [ ] Apply rate limiting to `POST /api/auth/resend-verification` (3 req / IP / 15 min)
- [ ] Apply rate limiting to `POST /api/auth/reset-password` (5 req / email / 15 min)
- [ ] Apply rate limiting to NextAuth credentials login (10 req / email / 15 min)
- [ ] All rate-limited routes return `429` with `Retry-After` header

### Part 2: Session Architecture — JWT Cleanup + Email Verified Fix (~1 day)
- [ ] Strip `orgId`, `orgRole` from JWT token and session type
- [ ] `requireOrgRole()` becomes a live DB lookup on `org_memberships`
- [ ] All API routes pass `orgId` from URL param, not from session
- [ ] Audit and update all client components reading `session.user.orgId` or `session.user.role`
- [ ] Fix email verification banner: call NextAuth `update({ emailVerified: true })` after verification — banner clears without re-login
- [ ] `jwt` callback handles `trigger === 'update'` to refresh `emailVerified`
- [ ] `requireSuperAdmin()` verified still working after token shape change

### Part 3: Platform Landing Page + Org-less Flow (~1.5 days)
- [ ] Replace temporary `src/app/page.tsx` with real platform homepage
- [ ] Create `src/components/platform-nav.tsx` (logged-out: Sign In + Get Started; logged-in: avatar dropdown)
- [ ] Hero section + hackathon discovery grid (all public hackathons across all orgs)
- [ ] Status filter pills: All, Open for Registration, Active, Upcoming
- [ ] Add `getPublicHackathons(filter?)` to `hackathon-service.ts`
- [ ] Fix org-less post-login: `/dashboard` shows "Your Hackathons" + org creation prompt — no forced redirect
- [ ] Org-less sidebar: show only "My Hackathons" and "Account Settings"
- [ ] `generateMetadata` for root page SEO

### Part 4: User Profile + Account Settings (~1 day)
- [ ] Implement `src/app/(dashboard)/dashboard/account/` page
- [ ] Add "Account Settings" link to top bar user dropdown
- [ ] Personal Info section: edit display name, save via `PATCH /api/user/profile`, refresh session token
- [ ] Avatar upload + removal (StorageProvider, `avatars/[userId]/`)
- [ ] Security section: change password (`POST /api/user/change-password`, bcrypt verify + hash)
- [ ] Your Organizations section: read-only list of orgs with role and dashboard link

### Part 5: Pagination Architecture (~1.5 days)
- [ ] Create `src/components/pagination-controls.tsx` shared component
- [ ] Add `paginate<T>()` DB helper in `src/lib/db-utils.ts`
- [ ] Establish URL search params pattern (page, q, filters in URL)
- [ ] Paginate: participant browse (pageSize 24, server-side name search)
- [ ] Paginate: team browse (pageSize 20, server-side name + track filter)
- [ ] Paginate: admin participant roster (pageSize 25, server-side search + filters)
- [ ] Paginate: admin team list (pageSize 25, server-side filters; Pending Review section unpaginated)
- [ ] Paginate: org member list (pageSize 25)
- [ ] Paginate: hackathon list (pageSize 12)
- [ ] Remove all `useMemo`-based client-side search from refactored components

### Part 6: Design Token System (~1 day)
- [ ] Define admin theme color tokens in `globals.css` (brand, neutral, semantic, surface, text aliases)
- [ ] Define competitive theme color tokens overrides under `.theme-competitive`
- [ ] Define typography scale (8 font sizes, 4 line heights, 4 font weights) as CSS custom properties
- [ ] Define radius + shadow tokens
- [ ] Extend `tailwind.config.ts` to reference token values
- [ ] Audit all components: replace hardcoded hex values and arbitrary sizes with tokens
- [ ] Document token system in `docs/003-coding-conventions.md`

### Part 7: Org Settings CRUD (~0.5 days)
- [ ] Implement `src/app/(dashboard)/dashboard/[orgSlug]/settings/page.tsx` (replace placeholder)
- [ ] Org name edit + logo upload/removal (gated to `org_admin`)
- [ ] Slug shown as read-only with explanatory tooltip
- [ ] Danger Zone section: delete button disabled with tooltip in V1
- [ ] `PATCH /api/orgs/[orgId]` route + `updateOrg()` service function

### Phase 3.5 Deliverable
> **Demo:** A visitor lands on hackforge.io and sees a real platform homepage with live hackathons. They sign up — repeated failed logins are rate-limited. After verifying their email, the banner clears immediately. An org admin promotes a member; the member's elevated permissions apply on their next action. A user corrects a name typo from Account Settings. An admin browsing a 1,000-person roster sees 25 results per page with server-side search.

---

## Phase 4: Submissions + File Uploads (Days 19-22)

**Goal:** Teams submit their work (ideas, prototypes, demos) through structured forms.

### Day 19: Storage Provider Interface + Upload System
- [ ] Define the `StorageProvider` interface:
  ```typescript
  interface StorageProvider {
    upload(file: File, path: string): Promise<{ url: string; key: string }>;
    getSignedUrl(key: string, expiresIn?: number): Promise<string>;
    delete(key: string): Promise<void>;
    list(prefix: string): Promise<StorageObject[]>;
  }
  ```
- [ ] Implement `SupabaseStorageProvider` (first provider)
- [ ] Build file upload component with drag-and-drop, progress bar, type/size validation
- [ ] File type restrictions: PDF, PPTX, ZIP, PNG, JPG, MP4 (configurable per hackathon)
- [ ] Max file size: 50MB per file (configurable)

### Day 20: Submission Schema + Form
- [ ] Define database schema:
  - `submissions` — id, team_id, phase_id, hackathon_id, status (draft | submitted | late | withdrawn), submitted_at, updated_at
  - `submission_fields` — id, submission_id, field_name, field_type, value (text), file_url, file_key
- [ ] Build submission form per phase:
  - V1 fixed fields: Title, Description (rich text), Demo URL, GitHub URL, Video URL, File Uploads (multiple)
  - Each field is optional/required based on hackathon config
- [ ] Draft save functionality (auto-save every 30 seconds)
- [ ] Final submit with confirmation dialog

### Day 21: Submission Lifecycle
- [ ] Deadline enforcement: submissions locked after phase end_date
- [ ] Late submission handling (configurable: reject | flag | accept)
- [ ] Submission edit: allowed until deadline (track edit history with timestamps)
- [ ] Submission preview: read-only view of what judges will see
- [ ] Withdrawal option: team can withdraw submission before deadline

### Day 22: Admin Submission Management
- [ ] Admin submission overview: all submissions, filter by track/team/status
- [ ] Submission detail view for admin: full content + metadata
- [ ] Bulk export: submissions list as CSV
- [ ] Submission statistics on admin dashboard (total, by track, by status)
- [ ] Edge cases: team with no submission, duplicate submissions, orphaned files cleanup

### Phase 4 Deliverable
> **Demo:** Team "AI Crusaders" submits their prototype → uploads a PDF pitch deck + demo video link + GitHub repo → saves draft → edits description → final submit before deadline → admin sees all 15 submissions with files.

---

## Phase 5: Judging + Scoring + Leaderboard (Days 23-25)

**Goal:** Judges evaluate submissions, scores are aggregated, winners are declared.

### Day 23: Judging Configuration + Assignment
- [ ] Define database schema:
  - `evaluation_criteria` — id, hackathon_id, phase_id, name, description, weight (percentage), max_score, order
  - `judge_assignments` — id, hackathon_id, judge_user_id, track_id (nullable — null means all tracks), assigned_by, assigned_at
  - `evaluations` — id, submission_id, judge_user_id, criteria_scores (JSONB: [{criterion_id, score, comment}]), total_score, feedback, status (pending | in_progress | completed), evaluated_at
- [ ] Build judging criteria setup UI (add/edit/reorder criteria, set weights — must sum to 100%)
- [ ] Build judge assignment UI: select users → assign to tracks or specific submissions
- [ ] Send judging assignment notification emails

### Day 24: Judge Dashboard + Scoring Interface
- [ ] Build judge dashboard: queue of assigned submissions (pending, in-progress, completed)
- [ ] Submission review view for judges:
  - Team info (hidden if blind judging enabled)
  - Full submission content (description, links, files — inline PDF/video preview where possible)
  - Scoring panel: each criterion with slider/number input (1-10 scale, configurable)
  - Per-criterion comment (optional)
  - Overall feedback text box
  - Submit evaluation button
- [ ] Blind judging mode: hide team name, member names, and any identifying info
- [ ] Auto-save judge scores as they fill in (prevent lost work)
- [ ] Progress indicator: "You've evaluated 4 of 12 submissions"

### Day 25: Score Aggregation + Leaderboard + Winners
- [ ] Score aggregation engine:
  - Per submission: weighted average across all judge scores per criterion
  - Flag submissions with high standard deviation across judges (indicates inconsistency)
  - Calculate final ranking per track and overall
- [ ] Build leaderboard page:
  - Table: rank, team name, track, overall score, per-criterion breakdown
  - Configurable visibility: public, participants-only, or admin-only
  - Toggle: show during judging or only after completion
- [ ] Winner declaration flow:
  - Admin reviews final rankings
  - Select winners (1st, 2nd, 3rd + special categories)
  - Publish results → triggers notification to all participants
- [ ] Results page: winner announcements with team details and scores
- [ ] Judging progress dashboard for admin: which judges completed, average scores, time per evaluation

### Phase 5 Deliverable
> **Demo:** Admin configures 4 criteria (Innovation 30%, Feasibility 25%, Impact 25%, Presentation 20%) → assigns 5 judges → judges log in, see their queue, score all submissions → leaderboard shows "AI Crusaders" in 1st place → admin declares winners → all participants get results email.

---

## Phase 6: Notifications + Polish + Testing (Days 26-28)

**Goal:** Production-ready platform with email notifications, data exports, and polished UX.

### Day 26: Email System + Notifications
- [ ] Build React Email templates:
  - Welcome / Email verification
  - Organization invite
  - Hackathon registration confirmation
  - Team invite
  - Phase transition reminder (e.g., "Submission deadline in 24 hours")
  - Judging assignment
  - Results announcement
- [ ] In-app notification center:
  - Bell icon with unread count in top nav
  - Notification dropdown: list of notifications with read/unread state
  - Click notification → navigate to relevant page
- [ ] Admin broadcast: send announcement to all hackathon participants
- [ ] Deadline reminder system: automated email 24h before each phase deadline (Vercel Cron)

### Day 27: Data Export + Admin Polish
- [ ] CSV export functions:
  - Participant list (name, email, team, track, registration date)
  - Team list (name, members, track, submission status)
  - Scores (team, track, per-criterion scores, per-judge scores, weighted total, rank)
  - All submissions metadata
- [ ] Admin dashboard final polish:
  - Registration stats card (total, by day, by track)
  - Submission stats card (total, submitted vs draft, by track)
  - Judging progress card (% complete, by judge)
- [ ] Hackathon lifecycle status management (draft → published → active → judging → completed)
- [ ] Error states and empty states for all views
- [ ] Loading skeletons for data-fetching pages

### Day 28: Testing + Bug Fixes + Deployment
- [ ] End-to-end manual testing of complete hackathon lifecycle:
  1. Create org → invite members
  2. Create hackathon (Innovation Pipeline template)
  3. Publish → share registration link
  4. Register 3-5 test participants → form 2 teams
  5. Submit ideas/prototypes for both teams
  6. Assign judges → complete judging for all submissions
  7. View leaderboard → declare winners
  8. Verify all emails sent correctly
  9. Export all CSVs and verify data
- [ ] Fix critical bugs found during testing
- [ ] Responsive design audit (tablet + mobile)
- [ ] Performance check: page load times, API response times
- [ ] Security checklist:
  - [ ] No SQL injection vectors
  - [ ] CSRF protection on all mutations
  - [ ] Rate limiting on auth endpoints
  - [ ] File upload validation (type + size)
  - [ ] No sensitive data in client-side JS
- [ ] Deploy to Vercel production
- [ ] Set up custom domain (if purchased)
- [ ] Smoke test on production

### Phase 6 Deliverable
> **Demo:** Full end-to-end hackathon lifecycle working on production. Ready for InMobi's next hackathon.

---

## V1 Effort Summary

| Phase | Days | Features | Deliverable |
|-------|------|----------|-------------|
| Phase 1: Foundation + Auth | 3 | Auth, org management, RBAC, app shell | Users sign up and see org dashboard |
| Phase 2: Hackathon Creation | 4 | Templates, creation wizard, landing page | Admin creates hackathon, public page is live |
| Phase 3: Registration + Teams | ~4 | Registration, team formation, discovery | Participants register and form teams |
| **Phase 3.5: Core Hardening** | **~7.5** | **Security, session fix, platform landing, account settings, pagination, design tokens, org settings** | **Production-worthy base for worldwide SaaS** |
| Phase 4: Submissions | 4 | File uploads, submission forms, drafts | Teams submit work with files |
| Phase 5: Judging | 3 | Scoring, leaderboard, winner declaration | Judges score, winners declared |
| Phase 6: Polish + Ship | 3 | Emails, exports, testing, deployment | Production-ready platform |
| **Total** | **~28.5** | **Complete hackathon lifecycle + hardened base** | **Ready for worldwide launch** |

---

## What's Explicitly NOT in V1

These features are intentionally deferred to keep V1 shippable in 3 weeks:

- SSO / SAML / OAuth social login / MFA
- Custom workflow builder (drag-and-drop phases)
- Slack / Teams / Jira / GitHub integrations
- Advanced analytics with charts and graphs
- AI features (team matching, plagiarism detection, idea clustering)
- Community voting
- Multi-round judging / calibration mode
- Custom branding / white-label / custom domains
- Public API / webhooks / developer documentation
- Mobile app or PWA
- Multi-org billing and plan management
- Configurable submission form builder (V1 uses fixed fields)

---

## Identified Gaps & Design Debt

*Captured 2026-04-17. Updated 2026-04-18 — gaps resolved in Phase 3.5 are marked.*

---

### G1 — User Flow: No Org Required ✅ Resolved in Phase 3.5 (Part 3)

**Problem:** Currently every authenticated user must create an org to do anything useful. There is no general user experience for someone who is just a hackathon participant (no admin role, no org they own).

**Resolution:** Phase 3.5 Part 3 removes the forced org-creation redirect. Org-less users land on a useful `/dashboard` showing their registered hackathons. The sidebar for org-less users shows My Hackathons + Account Settings only.

---

### G2 — Public Platform Landing Page ✅ Resolved in Phase 3.5 (Part 3)

**Problem:** There is no root `/` experience for HackForge as a platform. Opening the site as a logged-out user shows nothing useful.

**Resolution:** Phase 3.5 Part 3 replaces the temporary root page with a real platform homepage — hero, hackathon discovery grid, status filters, platform nav.

---

### G3 — User Profile / Account Settings ✅ Resolved in Phase 3.5 (Part 4)

**Problem:** Once signed up, a user cannot edit their own name, email, password, or avatar. The forgot-password flow covers credential recovery but there is no self-service account page.

**Resolution:** Phase 3.5 Part 4 delivers `/dashboard/account` — name edit, password change, avatar upload. Email change deferred (requires re-verification loop).

---

### G4 — Org Settings CRUD ✅ Resolved in Phase 3.5 (Part 7)

**Problem:** The `/dashboard/[orgSlug]/settings` page is a placeholder. Org admins cannot edit org name, slug, or logo after creation.

**Resolution:** Phase 3.5 Part 7 implements org name and logo editing. Slug is read-only. Org deletion deferred to V1.5 (requires cascade audit).

---

### G5 — Registration Form Templates

**Problem:** The wizard Step 6 (Participation) lets admins build a custom registration form from scratch. There are no pre-built templates to start from (e.g., "Standard Employee Form" with designation, department, skills, team preference).

**What's needed:**
- A small library of 2–3 starter templates selectable in Step 6 before customising
- Templates are just pre-populated field sets, not a new data model
- Hackathon templates (Idea Sprint, Build & Ship, etc.) could pre-select an appropriate registration template

**Impact:** Low for V1 (admins can build manually), but significantly improves time-to-publish for new hackathons.

---

### G6 — Browse Pages: Teams + Participants (Part 3 of TRD-008)

**Problem:** Part 2 of TRD-008 built the admin participant roster. The *public* browse pages — `/hackathons/[slug]/teams` (open teams seeking members) and `/hackathons/[slug]/participants` (discoverable participants seeking teams) — are in Part 3, which has not been written yet.

**What's needed:**
- Public team browse: list open teams, filter by track, join request CTA
- Public participant browse (for team leads): list discoverable participants, "Team Up" CTA
- Join request workflow: request → lead approves/rejects → notifications
- These are the core team formation UX flows; the data model is already built

**Impact:** High — team formation is not usable without these pages. Part 3 TRD must be written next.

---

### G7 — Track Selection Clarification (Not a Gap)

Track selection is intentionally on the *team*, not the registration. A solo registrant doesn't know their track until they form a team around a problem statement. Track is set at team creation time (`teams.track_id`). This is correct. No action needed.

---

*These gaps should be triaged before writing the V2 roadmap. G3, G4 (user + org settings) are strong candidates for a small dedicated phase between V1 and V2. G1 (user flow) and G2 (platform landing) are prerequisites for any external customer. G5 (form templates) is a quality-of-life addition. G6 (browse pages) is already scheduled in TRD-008 Part 3.*

---

## Risk Mitigations for V1

| Risk | Mitigation |
|------|-----------|
| Day estimate too optimistic | Phase 4 (Submissions) has 1 day buffer. Form builder simplified to fixed fields. If behind, cut: blind judging, rich text editor (use textarea), file preview. |
| Supabase free tier limits hit | 500MB DB + 1GB storage is plenty for 1 hackathon with 150 users. Monitor usage. |
| Vercel function timeout (10s) | Keep API routes lean. File uploads go direct to Supabase Storage (client-side), not through API route. CSV exports for < 1000 rows are fast. |
| Email deliverability issues | Set up custom sending domain from Day 1. Test with real email addresses early (Day 3). |
| Solo dev burnout | Plan for 8-hour days, not 14-hour days. If falling behind, cut polish (Day 19-20) and ship slightly rough. |

---

## Daily Standup Template

Use this for personal accountability:

```
Date: ____
Yesterday: What I completed
Today: What I'm building
Blockers: Anything stopping me
Mood: 🟢 On track | 🟡 Slight delay | 🔴 Behind
```

---

*This document is the execution contract for V1. Any scope additions must go through an explicit trade-off discussion: what gets cut to make room?*
