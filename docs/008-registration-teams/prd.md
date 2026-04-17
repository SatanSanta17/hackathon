# PRD — Phase 3: Registration + Team Formation

**Document ID:** PRD-008  
**Date:** April 17, 2026  
**Author:** Burhanuddin C.  
**Status:** Draft — Awaiting Approval  
**References:** `docs/002-v1-development-phases.md`, `docs/004-architecture.md`, `docs/007-hackathon-creation/prd.md`

---

## Purpose

Phase 3 turns HackForge from a hackathon publishing platform into a live event. Participants can register, form or join teams, and manage their participation end-to-end. The platform supports four distinct participation paths — explicit registrants who create teams, solo registrants who are discoverable, unregistered browsers who get auto-registered on joining a team, and invited non-platform users who are onboarded through the invite flow. Admins have complete operational oversight: team approval, a full participant roster, and team formation monitoring.

Phase 3 also extends the creation wizard with a new Participation Settings step, giving admins control over registration fields and whether teams require approval.

---

## Key Decisions (Agreed Pre-PRD)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Simplified dynamic registration fields** | V1 supports admin-configurable custom fields (text, textarea, dropdown only, max 10) alongside fixed core fields auto-populated from the user profile. Full form builder deferred to V2. |
| 2 | **Teams are the unit of approval, not individuals** | When `requires_approval = true`, the admin reviews and approves teams, not individual registrations. A participant is considered officially approved when their team is approved. The approval queue is a team queue. |
| 3 | **Registrations are always auto-confirmed** | A registration records a participant's intent and grants access to team formation. No per-person admin gate. The `requires_approval` toggle governs teams only. |
| 4 | **Team re-approval on edit or member addition** | When `requires_approval = true`, any change that alters team composition or identity (edit profile, add a member) resets `admin_status` to `pending_review`. Member leaving does NOT trigger re-approval. |
| 5 | **Separate `org_invites` and `team_invites` tables** | Merging into a polymorphic table loses FK constraint integrity and type safety. Token logic is shared via `token-service.ts`. |
| 6 | **Auth modal on the landing page** | "Register Now" triggers a sign-in/sign-up dialog without navigating away from the landing page. On auth, the dialog transitions to the registration form in the same modal. |
| 7 | **Participation Settings inserted as wizard Step 6** | Sits between Team Rules (Step 5) and Prizes (Step 7), making the wizard 9 steps. Covers `requires_approval` toggle and custom registration fields. |
| 8 | **Two join mechanisms, one approval flow** | Browsing open teams and using a shared join link both create a join request that only the team lead can approve. Direct email invites skip the request — the invitee is added immediately. All member additions trigger team re-approval when `requires_approval = true`. |
| 9 | **Non-platform user invites land on the team page** | When an invited user signs up and verifies their email, they are already a team member. They land directly on the team page. |
| 10 | **Leadership auto-transfer and explicit transfer** | When the lead leaves, the member with the earliest `joined_at` automatically becomes lead. The lead can also explicitly transfer leadership without leaving. If the lead is the last member and leaves, the team is auto-dissolved. Neither action triggers team re-approval. |
| 11 | **Join link requires lead approval** | A shared join link creates a join request — not an auto-join. Only the team lead approves it. Any team member can copy and share the link. |
| 12 | **Four participation paths** | (a) Register → create team → add members. (b) Register → create team → stay solo and open (discoverable on /browse/teams). (c) Browse without registering → request to join → auto-registered on acceptance only (not on rejection). (d) Register → stay unteamed → discoverable on /browse/participants. All paths are valid. |
| 13 | **Browse teams is public; login required to request** | `/hackathons/[slug]/teams` is publicly accessible — anyone can see open teams without signing in. Sending a join request requires login. Unregistered users who get their request accepted are auto-registered at that moment. |
| 14 | **Auto-registration on acceptance only** | Sending a join request does NOT auto-register a user. Auto-registration happens only when a join request is accepted or a team invite is accepted. Rejected requestors remain unregistered. Direct email invites (existing users) trigger registration if not already registered. |
| 15 | **`is_discoverable` opt-in on registrations** | Registered participants who are not on a team appear on `/browse/participants` only if `is_discoverable = true` (default ON). Configurable at registration time as "Show me on the participants browse page." |
| 16 | **Team-up from /browse/participants** | A registered unteamed user can send a "Team Up" request to another registered unteamed user from `/browse/participants`. The requester provides a team name. On acceptance, the team is auto-created with the requester as lead and the acceptee as member. |
| 17 | **Profile completion nudge (optional)** | After registration (explicit or auto), if the user's profile is missing designation or department, a dismissible nudge prompts them to complete their details. Skippable — does not block any action. |
| 18 | **Registration persists through team changes** | If a user is removed from a team, their registration record is untouched — they remain registered and reappear on `/browse/participants`. If a team is disbanded (all members removed or lead dissolves), all former members retain their registrations and reappear on `/browse/participants`. |
| 19 | **Admin notified on team disbanding** | When a team is dissolved (soft-deleted), all org admins receive an email notification identifying the team name, hackathon, and reason (team disbanded / last member left). |
| 20 | **`dissolveTeam` is an explicit exported service function** | Not inlined. Called by `removeMember` (last member scenario) and directly by any future admin "disband team" action. Hard-deletes `team_members` then soft-deletes the team. Does not touch `registrations`. |

---

## User Stories

### Participant Stories
1. **As a visitor on the landing page**, I want to click "Register Now" and sign in without leaving the page so that the registration process feels seamless.
2. **As a participant**, I want to fill in a short registration form pre-filled with my profile info so that I can register quickly.
3. **As a participant**, I want to be immediately confirmed after registering so that I can start forming a team.
4. **As a visitor (not logged in)**, I want to browse open teams without signing in so that I can explore what's happening before committing to register.
5. **As a participant**, I want to create a team with a name, description, and track so that my team has an identity on the platform.
6. **As a participant**, I want to browse open teams filtered by track and send a join request so that the team lead can decide whether to add me.
7. **As a registered participant without a team**, I want to appear on a discoverable participants page so that team leads can find and invite me.
8. **As a registered participant without a team**, I want to send a "Team Up" request to another solo participant so that we can form a team together.
9. **As a participant**, I want to choose whether I appear on the participants browse page so that I can control my discoverability.
10. **As a participant**, I want to share a join link so that teammates can quickly request to join my team.
11. **As a team lead**, I want to invite a colleague by email so that they're added directly without needing to browse.
12. **As a team lead**, I want to browse discoverable registered participants and send them a team-up invite so that I can build my team without needing to know emails.
13. **As a team lead**, I want to approve or reject join requests so that I control who joins.
14. **As a team lead**, I want to transfer team leadership to another member without leaving so that I can hand off responsibility gracefully.
15. **As a team member**, I want to view my team's profile so that I have a shared reference point. Note: only the lead can edit — any edit or member addition when `requires_approval = true` sends the team back for admin review.
16. **As a team member**, I want to leave a team if my plans change so that my slot is freed and I'm back on the participants page.
17. **As a participant**, I want to see a nudge to complete my profile details if they're missing, so that admins and team leads have useful info about me — but be able to skip it.
18. **As a participant**, I want to see my registered hackathons and team status in one dashboard so that I always know where I stand.

### Admin Stories
19. **As an org admin**, I want to configure custom registration fields in the wizard so that I can collect role-specific information from participants.
20. **As an org admin**, I want to enable team approval so that I can review teams before they're considered official.
21. **As an org admin**, I want to see all teams pending approval and process them efficiently.
22. **As an org admin**, I want to approve or reject teams and have the team receive an email notification.
23. **As an org admin**, I want a re-approval prompt when a team is edited or a member added so that I maintain oversight over changes.
24. **As an org admin**, I want to see all teams with their approval status, member counts, and track assignments.
25. **As an org admin**, I want to see all registered participants as a read-only roster, clearly separated from "participants on a team."
26. **As an org admin**, I want to export a participant list as CSV.
27. **As an org admin**, I want to be notified by email when a team is disbanded so that I know the team landscape has changed.

---

## Parts

Phase 3 is divided into 4 parts. Each part is a self-contained, shippable unit.

---

### Part 1: Schema + Data Layer

**What:** Define all Phase 3 database tables and enums, build all service methods and Zod validation schemas, and run the migration. No UI is built in this part.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P1.R1 | Add the following Postgres enums to `db/schema/enums.ts`: `team_role` (lead, member), `team_admin_status` (pending_review, approved, rejected), `join_request_status` (pending, accepted, rejected). No `registration_status` enum — registrations carry no approval state. |
| P1.R2 | Define the `registrations` table: id (uuid PK), hackathon_id (FK → hackathons.id, NOT NULL, indexed), user_id (FK → users.id, NOT NULL, indexed), form_data (jsonb, nullable — responses to custom fields), is_discoverable (boolean, NOT NULL, default true — controls appearance on /browse/participants), registered_at (timestamptz, NOT NULL, default now()), updated_at (timestamptz, NOT NULL, default now()), deleted_at (timestamptz, nullable — soft delete). Unique constraint on (hackathon_id, user_id). No status column. |
| P1.R3 | Define the `registration_fields` table: id (uuid PK), hackathon_id (FK → hackathons.id, NOT NULL, indexed), label (text, NOT NULL), field_type (text, NOT NULL — 'text', 'textarea', 'dropdown'), options (jsonb, nullable — string[] for dropdown), required (boolean, NOT NULL, default false), order (integer, NOT NULL, default 0), created_at, updated_at. |
| P1.R4 | Define the `teams` table: id (uuid PK), hackathon_id (FK → hackathons.id, NOT NULL, indexed), name (text, NOT NULL), description (text, nullable), invite_code (text, UNIQUE, NOT NULL — 8-char alphanumeric, generated on creation), is_open (boolean, NOT NULL, default true), track_id (FK → tracks.id, nullable, indexed), admin_status (team_admin_status, NOT NULL, default 'approved' — service sets to 'pending_review' on creation when hackathon.requires_approval = true), review_reason (text, nullable — set whenever admin_status → pending_review; cleared on approval), created_by (FK → users.id, NOT NULL), created_at, updated_at, deleted_at (nullable — soft delete). |
| P1.R5 | Define the `team_members` table: id (uuid PK), team_id (FK → teams.id, NOT NULL, indexed), user_id (FK → users.id, NOT NULL, indexed), role (team_role, NOT NULL, default 'member'), joined_at (timestamptz, NOT NULL, default now()), created_at. Unique constraint on (team_id, user_id). No deleted_at — hard-deleted on leave/removal. |
| P1.R6 | Define the `team_join_requests` table: id (uuid PK), team_id (FK → teams.id, NOT NULL, indexed), user_id (FK → users.id, NOT NULL, indexed), status (join_request_status, NOT NULL, default 'pending'), message (text, nullable), entry_point (text, NOT NULL — 'browse', 'link', or 'participant_browse'), requested_at (timestamptz, NOT NULL, default now()), updated_at. No unique DB constraint — service enforces one pending request per (team_id, user_id). |
| P1.R7 | Define the `team_invites` table: id (uuid PK), team_id (FK → teams.id, NOT NULL, indexed), email (text, NOT NULL, indexed), token (text, NOT NULL, UNIQUE — SHA-256 hash), invited_by (FK → users.id, NOT NULL), expires_at (timestamptz, NOT NULL — 7 days from creation), accepted_at (timestamptz, nullable), created_at, updated_at. |
| P1.R8 | Define the `team_up_requests` table: id (uuid PK), hackathon_id (FK → hackathons.id, NOT NULL, indexed), from_user_id (FK → users.id, NOT NULL), to_user_id (FK → users.id, NOT NULL), proposed_team_name (text, NOT NULL), message (text, nullable), status (join_request_status enum — pending, accepted, rejected), requested_at (timestamptz, NOT NULL, default now()), updated_at. Unique constraint on (hackathon_id, from_user_id, to_user_id) where status = 'pending' enforced at service level. |
| P1.R9 | Add `requires_approval` boolean column (NOT NULL, default false) to the `hackathons` table via a new migration. Expose in `hackathon-service.ts` and Zod schemas. |
| P1.R10 | Generate and run the Drizzle migration for all new tables, enums, and the `hackathons.requires_approval` column. Add barrel exports in `db/schema/index.ts`. |
| P1.R11 | Create `lib/services/registration-service.ts` with: `createRegistration(hackathonId, userId, formData, isDiscoverable)` — inserts record; `autoRegister(hackathonId, userId)` — inserts with null form_data and is_discoverable = true, skips silently if record already exists (idempotent); `getRegistrationByUserAndHackathon(userId, hackathonId)`; `getRegistrationsByHackathon(hackathonId)` — with user + team info; `getDiscoverableParticipants(hackathonId)` — registered, unteamed, is_discoverable = true users; `getRegistrationFields(hackathonId)`; `upsertRegistrationFields(hackathonId, fields)`; `getRegistrationCount(hackathonId)`. |
| P1.R12 | Create `lib/services/team-service.ts` with: `createTeam(hackathonId, userId, data)`; `getTeamById(teamId)`; `getTeamsByHackathon(hackathonId, filters)`; `updateTeam(teamId, data)` — triggers re-approval if requires_approval; `dissolveTeam(teamId)` — exported standalone function: hard-deletes all `team_members` records, soft-deletes the team, sends `teamDisbandedAdminEmail` to all org admins; `addMember(teamId, userId, memberName)` — adds to team_members, calls `autoRegister` if not already registered, triggers re-approval if requires_approval; `removeMember(teamId, userId)` — removes member, triggers auto-transfer if lead, does NOT change admin_status; `transferLeadership(teamId, fromUserId, toUserId)` — atomic role swap, does NOT change admin_status; `createJoinRequest(teamId, userId, message, entryPoint)`; `getJoinRequests(teamId)`; `respondToJoinRequest(requestId, status, hackathonMaxSize)` — on accept: calls `addMember` (which calls `autoRegister`), auto-rejects remaining requests if team now full; `inviteMemberByEmail(teamId, invitedByUserId, email)` — if user exists: calls `addMember`; if not: creates `team_invites` record; `acceptTeamInvite(token)` — calls `addMember`; `approveTeam(teamId)`; `rejectTeam(teamId)`; `getPendingTeams(hackathonId)`; `getUserTeamForHackathon(userId, hackathonId)`; `getTeamByInviteCode(inviteCode)`. |
| P1.R13 | Create `lib/services/team-up-service.ts` with: `createTeamUpRequest(hackathonId, fromUserId, toUserId, proposedTeamName, message)` — validates both users are registered and unteamed; `respondToTeamUpRequest(requestId, status)` — on accept: calls `team-service.createTeam` with fromUserId as creator and proposed name, then calls `addMember` for toUserId; on reject: updates status, sends declined email; `getTeamUpRequestsForUser(userId, hackathonId)` — incoming pending requests. |
| P1.R14 | Auto-leadership-transfer in `team-service.ts`: when `removeMember` removes the lead, find remaining member with earliest `joined_at` and promote atomically in a transaction. If no members remain, call `dissolveTeam`. |
| P1.R15 | Create Zod schemas in `lib/validations/registration.ts`: `createRegistrationSchema` (includes `isDiscoverable` boolean, default true), `registrationFieldSchema`, `upsertRegistrationFieldsSchema`. |
| P1.R16 | Create Zod schemas in `lib/validations/team.ts`: `createTeamSchema`, `updateTeamSchema`, `joinRequestSchema`, `respondToJoinRequestSchema`, `inviteByEmailSchema`, `transferLeadSchema`, `respondToTeamSchema`; and in `lib/validations/team-up.ts`: `createTeamUpRequestSchema` (proposedTeamName required, message optional), `respondToTeamUpRequestSchema`. |
| P1.R17 | Add email templates to `lib/email/templates.ts`: `registrationConfirmedEmail`, `teamCreatedPendingReviewEmail`, `teamApprovedEmail`, `teamRejectedEmail`, `teamPendingReReviewEmail`, `teamInviteExistingUserEmail`, `teamInviteNewUserEmail`, `joinRequestAcceptedEmail`, `joinRequestRejectedEmail`, `teamDisbandedAdminEmail` (to admins: team name, hackathon, reason), `teamUpRequestEmail` (to recipient: [Name] wants to team up, proposed team name, accept/decline CTA), `teamUpAcceptedEmail` (to requester: team created, view team CTA), `teamUpDeclinedEmail` (to requester: request declined). |

**Acceptance Criteria:**

- [ ] 3 new enums: `team_role`, `team_admin_status`, `join_request_status`
- [ ] 7 new tables: `registrations`, `registration_fields`, `teams`, `team_members`, `team_join_requests`, `team_invites`, `team_up_requests`
- [ ] `registrations.is_discoverable` exists, defaults to true, no status column
- [ ] `teams.admin_status` defaults to 'approved'; service sets 'pending_review' when requires_approval = true
- [ ] `teams.review_reason` set on every pending_review transition, cleared on approval
- [ ] `hackathons.requires_approval` column exists after migration
- [ ] Migration applies cleanly
- [ ] `registration-service.ts`: `autoRegister` is idempotent (safe to call even if already registered)
- [ ] `team-service.ts`: `dissolveTeam` is an exported function; hard-deletes team_members, soft-deletes team, sends admin email
- [ ] `addMember` calls `autoRegister` so unregistered users are registered on joining
- [ ] `removeMember` and `transferLeadership` do NOT change admin_status
- [ ] Auto-leadership-transfer wrapped in a DB transaction
- [ ] `team-up-service.ts` implemented and typed
- [ ] All Zod schemas validate correctly
- [ ] All 13 email templates defined
- [ ] `npx tsc --noEmit` passes

---

### Part 2: Registration Flow

**What:** Build the participant registration experience — auth modal on the landing page, the registration form with discoverability toggle, the profile completion nudge, the wizard step for Participation Settings, and the "My Hackathons" participant dashboard view.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P2.R1 | **Wizard: new Step 6 — Participation Settings.** Insert between Step 5 (Team Rules) and former Step 6 (Prizes), making the wizard 9 steps. Content: (a) **Team approval toggle** — "Require team approval" (boolean, default OFF). When ON: "Teams will be reviewed before they are official. Any edits or new members require re-approval." (b) **Custom registration fields** — Add Field button, each field has label, type (Text / Long Answer / Dropdown), options (for Dropdown), required toggle. Reorderable. Max 10. Saved to `registration_fields` on step save. |
| P2.R2 | **"Register Now" CTA — state-aware button on the landing page.** States: (a) Not logged in → "Register Now" → auth modal. (b) Logged in, not registered → "Register Now" → registration form. (c) Registered, no team → "Find a Team" → browse page. (d) Registered, has team, pending_review → "Team Under Review" — amber, non-clickable. (e) Registered, has team, approved → "My Team" → team page. (f) Registered, has team, rejected → "Team Rejected" — muted, tooltip "Your team was not approved. Contact the organiser." (g) Registration closed → "Registration Closed" — non-clickable. |
| P2.R3 | **Auth modal.** Clicking "Register Now" when unauthenticated opens a Dialog with Sign In and Sign Up tabs. Uses existing auth form logic — no page redirect. On successful auth, transitions to the registration form without closing the dialog. |
| P2.R4 | **Registration form.** Fields: (a) Fixed — Full Name (pre-filled, read-only), Email (pre-filled, read-only). (b) Standard — Designation (text, optional), Department (text, optional). (c) Custom — rendered from `registration_fields` in configured order, respecting required flag and type. (d) **Discoverability toggle** — "Show me on the participants browse page" (boolean, default ON, labelled clearly). On submit: create `registrations` record with `is_discoverable` value, send `registrationConfirmedEmail`. |
| P2.R5 | **Post-registration confirmation.** Dialog shows confirmation: "You're registered!" CTAs: "Find a Team" and "Create a Team". Close button. No pending states. |
| P2.R6 | **Profile completion nudge.** After any registration (explicit or auto), check if the user's `designation` and `department` are null. If either is missing, show a dismissible banner/card on the participant dashboard and team page: "Complete your hackathon profile — it helps team leads find the right fit." Links to a profile completion form with Designation and Department fields. Dismissing the nudge hides it for that session. Skipping does not restrict any action. |
| P2.R7 | **Registration gating.** Registration form is available when hackathon status is `published` or `active` AND the registration phase `end_date` has not passed. If closed, CTA shows "Registration Closed." |
| P2.R8 | **Participant "My Hackathons" view.** Page at `/dashboard/[orgSlug]/my-hackathons`. Shows all hackathons the user is registered for. Each entry: hackathon cover/title, team status (No Team / team name + member count / Under Review / Rejected), current active phase, deadline countdown. Clicking a hackathon card links to its landing page; team badge links to the team page. |
| P2.R9 | **Add "My Hackathons" to sidebar navigation.** In `app-sidebar.tsx`, add a "My Hackathons" link for all authenticated org members pointing to `/dashboard/[orgSlug]/my-hackathons`. |
| P2.R10 | **Admin participant roster (read-only).** Page at `/dashboard/[orgSlug]/hackathons/[hackathonId]/participants`. Shows two clearly labelled counts at the top: **"X Registered"** (total registration records) and **"Y Participating"** (users on at least one team). Table columns: name, email, registration date, team name (if any), track (if any), discoverable badge. Filterable by track, has-team / no-team. Searchable by name or email. "Export CSV" button: Name, Email, Department, Designation, Registration Date, Team Name, Track, Discoverable, plus one column per custom field. |
| P2.R11 | **API routes for registration.** `POST /api/hackathons/[hackathonId]/register` (auth + verified email + no duplicate + hackathon open); `GET /api/hackathons/[hackathonId]/registration` (own status); `POST /api/hackathons/[hackathonId]/registration-fields` (admin: upsert); `GET /api/hackathons/[hackathonId]/registration-fields` (public); `GET /api/hackathons/[hackathonId]/registrations` (admin: full roster); `GET /api/hackathons/[hackathonId]/registrations/export` (admin: CSV); `GET /api/user/hackathons` (participant: my registered hackathons). |

**Acceptance Criteria:**

- [ ] Wizard Step 6 exists between Team Rules and Prizes; wizard is now 9 steps
- [ ] `requires_approval` toggle saves correctly; informational note appears when ON
- [ ] Up to 10 custom fields configurable with text, textarea, dropdown types
- [ ] CTA button shows correct state for all 7 scenarios (P2.R2)
- [ ] Auth dialog opens on "Register Now" for unauthenticated users; transitions to form on login
- [ ] Registration form shows discoverability toggle (default ON)
- [ ] Submitting form creates `registrations` record with correct `is_discoverable` value and sends confirmation email
- [ ] Profile completion nudge appears when designation or department is missing; dismissible; skippable
- [ ] "My Hackathons" page shows registrations with correct team states
- [ ] "My Hackathons" link visible to all authenticated members in sidebar
- [ ] Admin participants page shows "X Registered / Y Participating" as distinct counts
- [ ] Discoverable badge visible on participant roster
- [ ] Search, track filter, has-team filter, and CSV export work
- [ ] Registration blocked after registration phase end_date passes
- [ ] All API routes enforce auth, verified email, and role requirements

---

### Part 3: Team Formation

**What:** Build the full team formation experience — creating teams, browsing open teams (public), the discoverable participants page, team-up requests, join requests, direct email invites, team profile page, and all auto-registration and notification mechanics.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P3.R1 | **Create team flow.** Accessible from the post-registration dialog and the team browse page. Requires an active registration record. Dialog: Team Name (required), Description (optional), Track (dropdown from hackathon tracks, optional), Open to Join (toggle, default ON). On submit: creates team, adds creator as lead, sets `admin_status = 'pending_review'` if requires_approval else 'approved'. Navigates to the new team profile page. A user can only be on one team per hackathon. |
| P3.R2 | **Team profile page.** Route: `/hackathons/[slug]/teams/[teamId]`. Under `(public)` layout with competitive dark theme. Requires authentication. Sections: (a) Team header — name, track badge, open/closed badge, member count vs max size, admin_status badge (amber "Under Review" / green "Approved" / red "Rejected" — only visible when hackathon has requires_approval = true). (b) Description. (c) Members list — avatar, name, role badge, join date. (d) Join link — copyable URL `/hackathons/[slug]/teams/join?code=[invite_code]`, visible to all current team members. (e) Actions bar — contextual by viewer role (P3.R3). |
| P3.R3 | **Team profile — role-based actions.** (a) Lead: Edit Team (triggers re-approval if requires_approval), Transfer Leadership, Invite by Email, Browse Participants (links to /browse/participants), Join Requests section (when pending requests exist). (b) Member: Leave Team button with confirmation. (c) Registered participant not on a team: "Request to Join" if open and not full; "Team Full" badge if at capacity; no option if closed. (d) Non-registered / unauthenticated: prompt to register or sign in. |
| P3.R4 | **Admin re-approval on team edit.** When lead saves edits (name, description, track, is_open) and requires_approval = true: set admin_status = 'pending_review', set review_reason = "Team profile edited", send `teamPendingReReviewEmail` to all org admins, show toast to lead "Your changes have been submitted for review". |
| P3.R5 | **Team browse page — public.** Route: `/hackathons/[slug]/teams`. Publicly accessible — no login required to view. Lists open, non-full teams. Each card: name, track badge, member count vs max size, description snippet, "Request to Join" button (clicking requires login). Track filter (pill selector). "Create Team" button visible to registered-unteamed logged-in users. Empty state: "No open teams yet." Full and closed teams are not shown. |
| P3.R6 | **Participants browse page.** Route: `/hackathons/[slug]/participants`. Requires login. Shows registered, unteamed, discoverable (is_discoverable = true) participants. Each card: avatar, name, designation, department, track preference (from form_data if captured). Actions: (a) If viewer is registered and unteamed → "Team Up" button. (b) If viewer is a team lead → "Invite to Team" button (direct invite, no team-up flow). Track filter. Search by name. Empty state: "No participants available to team up with right now." |
| P3.R7 | **Team-up request flow.** From `/browse/participants`, a registered unteamed user clicks "Team Up" on another participant. Dialog: Proposed Team Name (required, pre-filled with "[Your Name]'s Team", editable), optional message. On submit: creates a `team_up_requests` record, sends `teamUpRequestEmail` to the recipient. Recipient sees a pending "Team Up" request in their notification area (Part 6) and via email. Recipient can Accept or Decline. On acceptance: `createTeam` with requester as lead, `addMember` for recipient → both redirected to team page. On decline: `teamUpDeclinedEmail` sent to requester. |
| P3.R8 | **Invite to team from /browse/participants (lead only).** When a team lead clicks "Invite to Team" on a participant, the participant is directly added to the team (same as direct email invite flow for existing users). Calls `addMember`, sends `teamInviteExistingUserEmail`, triggers re-approval if requires_approval. |
| P3.R9 | **Join request flow.** Clicking "Request to Join" on a team card or sending a request via join link requires login. If user is not registered: they see a prompt "Register first to join a team" with a "Register Now" CTA (this is the only action that requires prior registration before requesting — unregistered users who want to request must register first, OR they are auto-registered on acceptance of a request sent without registration). If user is registered: join request form (optional message). On submission: `createJoinRequest` with entry_point = 'browse' or 'link'. |
| P3.R10 | **Join request approval by lead.** Lead sees "Join Requests" section (when pending requests exist): avatar, name, optional message, entry point label, Approve / Reject buttons. On approve: `addMember` (which calls `autoRegister` if not registered), send `joinRequestAcceptedEmail`, trigger re-approval if requires_approval. On reject: update status to 'rejected', send `joinRequestRejectedEmail` — no auto-registration on rejection. If team reaches max size on approval, auto-reject all remaining pending requests with email notifications. |
| P3.R11 | **Join link flow.** `/hackathons/[slug]/teams/join?code=[invite_code]` looks up team by invite_code. If authenticated: show "Request to Join [Team Name]" dialog → `createJoinRequest` with entry_point = 'link'. If not authenticated: trigger auth modal then continue. If team is full: "This team is full." |
| P3.R12 | **Direct email invite by lead.** Lead enters an email in "Invite by Email" dialog. If user exists on platform: `addMember` (calls `autoRegister` if needed), send `teamInviteExistingUserEmail`, trigger re-approval if requires_approval. If user not on platform: create `team_invites` record (token, 7-day expiry), send `teamInviteNewUserEmail` with `/team-invites/accept?token=[token]` link. |
| P3.R13 | **Non-platform invite acceptance page.** Route: `/team-invites/accept`. If authenticated: auto-accept token, `addMember` (calls `autoRegister`), redirect to team page. If not authenticated: show invite details, "Create Account" and "Sign In" buttons. Token preserved in URL through signup → after verification → accept → team page. |
| P3.R14 | **Leave team.** Non-lead: confirmation → `removeMember` → admin_status unchanged → registration held → redirect to landing page. Lead: auto-transfer runs (next member by joined_at, admin_status unchanged) → if no members remain, `dissolveTeam` is called → redirect with toast. After leaving, user reappears on /browse/participants if is_discoverable = true. |
| P3.R15 | **Team disbanding.** When `dissolveTeam` is called: hard-delete all `team_members`, soft-delete the team record, send `teamDisbandedAdminEmail` to all org admins with team name, hackathon, and reason. All former members retain their registrations and reappear on /browse/participants if is_discoverable = true. |
| P3.R16 | **Leadership transfer.** Lead opens "Transfer Leadership" dialog, selects a member. Confirm: selected member → lead, current lead → member. No one leaves. admin_status unchanged. Success toast. |
| P3.R17 | **Team size enforcement.** Team capacity checked at approval time (join request approval, team-up acceptance, direct invite). If team is full at that moment, the action is blocked. Join request and team-up forms also show "X spots remaining" to inform requesters. |
| P3.R18 | **One team per participant per hackathon.** Enforced at service layer. Attempting to create or join a second team returns "You are already on a team for this hackathon." |
| P3.R19 | **API routes for teams.** `POST /api/hackathons/[hackathonId]/teams`; `GET /api/hackathons/[hackathonId]/teams` (public browse — open, non-full); `GET /api/hackathons/[hackathonId]/teams/[teamId]`; `PATCH /api/hackathons/[hackathonId]/teams/[teamId]` (lead); `POST /api/hackathons/[hackathonId]/teams/[teamId]/join-request`; `GET /api/hackathons/[hackathonId]/teams/[teamId]/join-requests` (lead); `PATCH /api/hackathons/[hackathonId]/teams/[teamId]/join-requests/[requestId]` (lead); `POST /api/hackathons/[hackathonId]/teams/[teamId]/invite` (lead); `POST /api/hackathons/[hackathonId]/teams/[teamId]/leave`; `POST /api/hackathons/[hackathonId]/teams/[teamId]/transfer-lead` (lead); `GET /api/teams/by-invite-code/[inviteCode]`; `POST /api/team-invites/accept`. |
| P3.R20 | **API routes for participants browse and team-up.** `GET /api/hackathons/[hackathonId]/participants` (auth required: discoverable, unteamed registrants); `POST /api/hackathons/[hackathonId]/team-up` (create team-up request); `GET /api/hackathons/[hackathonId]/team-up-requests` (incoming requests for current user); `PATCH /api/hackathons/[hackathonId]/team-up-requests/[requestId]` (accept or decline). |

**Acceptance Criteria:**

- [ ] Create team requires active registration; admin_status set correctly per requires_approval
- [ ] One team per participant enforced at service layer
- [ ] Team browse page at `/hackathons/[slug]/teams` is publicly accessible without login
- [ ] "Request to Join" button visible without login; clicking it prompts login
- [ ] Team profile page renders all sections; admin_status badge only shown when requires_approval = true
- [ ] Join link copyable by all team members
- [ ] `/hackathons/[slug]/participants` shows registered, unteamed, discoverable users; requires login
- [ ] Track filter and name search work on participants page
- [ ] "Team Up" button visible to registered unteamed users; "Invite to Team" visible to team leads
- [ ] Team-up dialog collects proposed team name and optional message
- [ ] On team-up acceptance: team created with requester as lead, acceptee as member
- [ ] On team-up decline: decliner sends `teamUpDeclinedEmail` to requester
- [ ] Lead approving join request: `addMember` called, `autoRegister` called if not registered, re-review triggered if requires_approval
- [ ] Rejected join request: no auto-registration
- [ ] Full-team-on-approval: remaining pending requests auto-rejected with emails
- [ ] Direct email invite (existing user): `addMember` + `autoRegister` if needed + re-review if requires_approval
- [ ] Non-platform user invite: email sent with signup link; `addMember` + `autoRegister` on acceptance
- [ ] `/team-invites/accept` handles authenticated and unauthenticated cases
- [ ] Member leaving: registration held, admin_status unchanged, reappears on /browse/participants
- [ ] `dissolveTeam`: hard-deletes team_members, soft-deletes team, sends admin notification email
- [ ] All former members retain registration after disbanding; reappear on /browse/participants
- [ ] Leadership transfer: roles swap, admin_status unchanged
- [ ] Team size enforcement at approval time
- [ ] All API routes enforce correct auth, role, and registration requirements

---

### Part 4: Admin Team Approval + Dashboard Views

**What:** Build the admin team approval queue, the full admin team management view, and complete the participant dashboard with phase awareness and org-level stats.

**Requirements:**

| ID | Requirement |
|----|-------------|
| P4.R1 | **Admin team list.** Page at `/dashboard/[orgSlug]/hackathons/[hackathonId]/teams`. Table: Team Name, Track, Open/Closed badge, Member Count (e.g., "4/5"), Lead Name, Admin Status badge (only when requires_approval = true), Created Date. Filterable by track, open/closed, admin_status. Searchable by team name. Clicking a team row shows detail panel: members list and join request history. |
| P4.R2 | **Team approval queue.** When requires_approval = true, a "Pending Review" section at the top of the admin teams page shows teams with admin_status = 'pending_review'. Each row: Team Name, Lead, Member Count, review_reason. Approve and Reject buttons per team. Approving: admin_status = 'approved', clear review_reason, send `teamApprovedEmail` to all members. Rejecting: admin_status = 'rejected', send `teamRejectedEmail` to lead. |
| P4.R3 | **Admin hackathon sub-navigation.** Add "Participants" and "Teams" links accessible from the hackathon management context. Both gated to org_admin. |
| P4.R4 | **Participant dashboard — enhanced "My Hackathons".** Extend P2.R8 with richer team state: approved team → team name, member count, track, "View Team" link; pending team → "Under Review" badge + "Your team is being reviewed"; rejected team → "Not Approved" badge + "Contact the organiser"; no team → "Find a Team" and "Create a Team" CTAs. |
| P4.R5 | **Phase-aware deadline countdown.** On each "My Hackathons" card, compute countdown to the next active phase deadline. Registration phase → "Registration closes in X days." Submission phase → "Submission deadline in X days." No active phase or completed → "Hackathon completed." |
| P4.R6 | **Org dashboard stat updates.** Add two stat cards to `/dashboard/[orgSlug]`: "Registered" (total registration count across active hackathons in the org) and "Participating" (users on a team across active hackathons). These are explicitly distinct — never combined into one "participants" count. |
| P4.R7 | **Landing page — team browse and participant browse entry points.** When hackathon is `active`: add "Browse Teams" and "Browse Participants" links in the sticky nav or below the hero. "Browse Teams" → `/hackathons/[slug]/teams` (public). "Browse Participants" → `/hackathons/[slug]/participants` (login required). Both hidden for `published`, `judging`, and `completed` statuses. |
| P4.R8 | **End-of-phase audit.** Run the full end-of-part audit across all Phase 3 files. Update `docs/004-architecture.md` (all new routes, services, tables, components). Update `CHANGELOG.md` with entries for all 4 parts. Run `npx tsc --noEmit` and resolve all type errors. |

**Acceptance Criteria:**

- [ ] Admin team list shows all teams with correct data; all filters and search work
- [ ] Pending Review section only appears when requires_approval = true
- [ ] Each pending row shows review_reason
- [ ] Approving sends approval email to all members, clears review_reason
- [ ] Rejecting sends rejection email to lead
- [ ] "Participants" and "Teams" sub-navigation accessible from hackathon management; gated to org_admin
- [ ] "My Hackathons" shows all four team states correctly
- [ ] Deadline countdown reflects the correct active phase
- [ ] Org dashboard shows "Registered" and "Participating" as explicitly separate stat cards
- [ ] "Browse Teams" and "Browse Participants" links appear on landing page only in `active` status
- [ ] `docs/004-architecture.md` fully updated
- [ ] `CHANGELOG.md` has entries for all 4 parts
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Backlog (Deferred from Phase 3)

| Item | Reason | Target |
|------|--------|--------|
| Multi-select and file upload registration field types | Low incremental value over text/textarea/dropdown for V1 | V2 |
| `org_only` and `invite_only` visibility enforcement | Requires additional membership checks; V1 uses public only | V2 |
| Waiting list for full hackathons | Not a priority for InMobi's first run | V2 |
| Team skill tags on /browse/participants | Useful for matching; profile data suffices for V1 | V2 |
| AI-powered team matching | Explicitly excluded from V1 | V3 |
| Individual participant blocking by admin | Teams are the unit of approval; per-person blocking is V2 | V2 |
| In-app team-up request notifications (bell icon) | In-app notification center is Phase 6; email covers Phase 3 | Phase 6 |
| Team chat or shared workspace | Out of V1 scope | V3 |
| Re-open registration after closing | Admin workaround: adjust phase dates | V2 |
| Persistent nudge dismissal across sessions | Session-level dismissal sufficient for V1 | V2 |
| Admin "disband team" action | Dissolution is auto-triggered (last member leaves) in V1; explicit admin action is V2 | V2 |

---

## Phase 3 Deliverable

> A visitor lands on the InMobi Innovation Week 2026 landing page and browses open teams without logging in. They see "AI Crusaders" is looking for members. They click "Register Now", sign in, complete the registration form (marking themselves as discoverable), and are immediately confirmed. They send a join request to "AI Crusaders". The team lead approves — the user is now a team member. A separate participant registers, doesn't find a team they like, and stays on `/browse/participants`. Another participant finds them there and sends a "Team Up" request with a proposed team name "Data Rebels". They accept — the team is auto-created. If `requires_approval = true`, both teams go back to admin review. The admin sees two pending teams in the queue, reviews them, approves both, and all members receive an approval email. The admin dashboard shows "18 Registered / 14 Participating" as distinct counts.

---

## Role & Permission Summary (Phase 3)

| Action | org_admin | Registered + Unteamed | Registered + Team Lead | Registered + Team Member | Unregistered (logged in) | Unauthenticated |
|--------|-----------|----------------------|----------------------|--------------------------|--------------------------|-----------------|
| Browse /teams page | Yes | Yes | Yes | Yes | Yes | Yes |
| Send join request | Yes | Yes | Yes (if no team) | No | Yes (auto-reg on accept) | No (must log in) |
| Browse /participants page | Yes | Yes | Yes | Yes | No | No |
| Send team-up request | No | Yes | No | No | No | No |
| Invite from /participants | No | No | Yes | No | No | No |
| Create team | Yes (if registered) | Yes | N/A | N/A | No | No |
| Approve / reject join requests | No | No | Yes | No | No | No |
| Invite by email | No | No | Yes | No | No | No |
| Copy join link | No | No | Yes | Yes | No | No |
| Edit team profile | No | No | Yes | No | No | No |
| Transfer leadership | No | No | Yes | No | No | No |
| Leave team | No | No | Yes (auto-transfer) | Yes | No | No |
| View team profile | Yes | Yes | Yes | Yes | Yes (login req) | No |
| Approve / reject teams | Yes | No | No | No | No | No |
| View admin team list | Yes | No | No | No | No | No |
| View participant roster (admin) | Yes | No | No | No | No | No |
| Export participants CSV | Yes | No | No | No | No | No |

---

*This PRD covers Phase 3 only. Technical implementation details are specified in the TRD (`docs/008-registration-teams/trd.md`) after this PRD is approved.*
