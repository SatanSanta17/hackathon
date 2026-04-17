# TRD — Phase 3: Registration + Team Formation

**Document ID:** TRD-008  
**Date:** April 17, 2026  
**Author:** Burhanuddin C.  
**Status:** Part 1 — In Progress  
**PRD Reference:** `docs/008-registration-teams/prd.md`  
**Architecture Reference:** `docs/004-architecture.md`  
**Conventions Reference:** `docs/003-coding-conventions.md`

---

## Part 1: Schema + Data Layer

**PRD Requirements Covered:** P1.R1 through P1.R17

---

### 1.1 Dependencies (New for Part 1)

No new npm packages are required for Part 1. All dependencies are already installed:
- **drizzle-orm** — schema definitions and queries
- **zod** — validation schemas
- **@supabase/supabase-js** — already installed in Phase 2 (StorageProvider)
- **token-service** — already exists in `lib/services/token-service.ts` (reused for team invite tokens)

---

### 1.2 Database Enums (P1.R1)

Add the following to the existing `src/db/schema/enums.ts`. Place Phase 3 enums below the existing Phase 2 enums.

```typescript
// --- existing Phase 1 + Phase 2 enums above ---

// Phase 3 enums
export const teamRoleEnum = pgEnum('team_role', ['lead', 'member']);

export const teamAdminStatusEnum = pgEnum('team_admin_status', [
  'pending_review',
  'approved',
  'rejected',
]);

export const joinRequestStatusEnum = pgEnum('join_request_status', [
  'pending',
  'accepted',
  'rejected',
]);
```

**Design decisions:**
- No `registration_status` enum — registrations have no approval state in V1. The `registrations` table records intent only; approval happens at the team level.
- `teamAdminStatusEnum` default in the DB is `'approved'`. The service layer sets it to `'pending_review'` at creation or mutation time when `hackathon.requires_approval = true`. This means the DB stays safe by default — a team is never accidentally locked from the DB side.
- `joinRequestStatusEnum` is reused for both `team_join_requests` and `team_up_requests` — same three-state lifecycle (pending, accepted, rejected) in both cases.

**Forward compatibility:** Phase 4 (submissions) will add `submission_status`. Phase 5 (judging) will add `eval_status`. Phase 6 will add `notification_type`. All go into this same file.

---

### 1.3 Hackathons Schema — Add `requires_approval` (P1.R9)

Modify the existing `src/db/schema/hackathons.ts` to add one column. Insert after `allowIndividual`:

```typescript
// Add this field to the hackathons table definition
requiresApproval: boolean('requires_approval').notNull().default(false),
```

The full updated `hackathons` table column list (only the new line shown in context):

```typescript
allowIndividual: boolean('allow_individual').notNull().default(true),
requiresApproval: boolean('requires_approval').notNull().default(false), // ← new
rulesHtml: text('rules_html'),
```

**Design decision:** Default is `false` — hackathons are open by default. This matches the PRD decision that team approval is opt-in. Existing hackathons created in Phase 2 will get `requires_approval = false` after migration, which is the correct backward-compatible value.

Also update `src/lib/validations/hackathon.ts` to include `requiresApproval` in the update schema so the wizard Step 6 can save it:

```typescript
// In the existing hackathonUpdateSchema (or equivalent), add:
requiresApproval: z.boolean().optional(),
```

Also expose `requiresApproval` in `hackathon-service.ts` `updateHackathon()` method — it is already a generic field update so no additional logic is required beyond ensuring the column is included in Drizzle's update call.

---

### 1.4 Database Schema — Registrations (P1.R2)

**New file: `src/db/schema/registrations.ts`**

```typescript
import { pgTable, uuid, text, boolean, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { hackathons } from './hackathons';
import { users } from './users';

export const registrations = pgTable('registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathonId: uuid('hackathon_id').notNull().references(() => hackathons.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  formData: jsonb('form_data').$type<Record<string, string>>(),
  isDiscoverable: boolean('is_discoverable').notNull().default(true),
  registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('registrations_hackathon_id_idx').on(table.hackathonId),
  index('registrations_user_id_idx').on(table.userId),
  unique('registrations_hackathon_user_unique').on(table.hackathonId, table.userId),
]);

export type Registration = typeof registrations.$inferSelect;
export type NewRegistration = typeof registrations.$inferInsert;
```

**Design decisions:**
- No `status` column — registrations are always valid on creation. The PRD decision is clear: the team, not the individual, is the approval unit.
- `isDiscoverable` defaults to `true` — opted in by default. Participants who do not want to appear on `/browse/participants` must explicitly uncheck the toggle at registration time. Auto-registered users (those added via join request or invite acceptance) also get `isDiscoverable = true` by default since they never fill a form.
- `formData` is typed as `Record<string, string>` — field IDs (from `registration_fields.id`) map to string values. Dropdown responses are stored as strings (the selected option label). Standard form fields (`designation`, `department`) are also stored here under those keys when captured. This keeps queries simple and avoids deeply nested JSON.
- `deleted_at` enables soft delete if a participant is ever removed from a hackathon by an admin (future V2 use). Queries always filter `WHERE deleted_at IS NULL`.
- The unique constraint on `(hackathon_id, user_id)` is enforced at both DB and service level. At service level, `createRegistration` checks for an existing record first and returns a 409 conflict rather than relying solely on DB exception handling.

**Forward compatibility:** Phase 4 (submissions) will check registration existence before allowing submission. The `getRegistrationByUserAndHackathon` service method covers this lookup.

---

### 1.5 Database Schema — Registration Fields (P1.R3)

**New file: `src/db/schema/registration-fields.ts`**

```typescript
import { pgTable, uuid, text, boolean, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { hackathons } from './hackathons';

export const registrationFields = pgTable('registration_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathonId: uuid('hackathon_id').notNull().references(() => hackathons.id),
  label: text('label').notNull(),
  fieldType: text('field_type').notNull(), // 'text' | 'textarea' | 'dropdown'
  options: jsonb('options').$type<string[]>(),
  required: boolean('required').notNull().default(false),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('registration_fields_hackathon_id_idx').on(table.hackathonId),
]);

export type RegistrationField = typeof registrationFields.$inferSelect;
export type NewRegistrationField = typeof registrationFields.$inferInsert;
```

**Design decisions:**
- `fieldType` is `text` rather than a Postgres enum. The valid values (`'text'`, `'textarea'`, `'dropdown'`) are enforced at the Zod layer. Keeping it as text makes adding new field types in V2 a non-breaking change (no enum migration).
- `options` is a typed `string[]` JSONB column. For non-dropdown fields, this is `null`. For dropdown fields, this is the list of selectable options (e.g., `["AI/ML", "Sustainability", "DevEx"]`).
- No `deleted_at` — registration fields are wiped and re-inserted on each wizard Step 6 save (`upsertRegistrationFields` deletes all existing fields for the hackathon then inserts the new set). This is simpler than diffing and more predictable for ordering.
- Max 10 fields is enforced at the Zod layer (`z.array(...).max(10)`), not the DB level.

**Forward compatibility:** Part 2 (registration form rendering) reads these fields to build the dynamic form. The `order` column drives display sequence.

---

### 1.6 Database Schema — Teams (P1.R4)

**New file: `src/db/schema/teams.ts`**

```typescript
import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { teamAdminStatusEnum } from './enums';
import { hackathons } from './hackathons';
import { tracks } from './tracks';
import { users } from './users';

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathonId: uuid('hackathon_id').notNull().references(() => hackathons.id),
  name: text('name').notNull(),
  description: text('description'),
  inviteCode: text('invite_code').notNull().unique(),
  isOpen: boolean('is_open').notNull().default(true),
  trackId: uuid('track_id').references(() => tracks.id),
  adminStatus: teamAdminStatusEnum('admin_status').notNull().default('approved'),
  reviewReason: text('review_reason'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('teams_hackathon_id_idx').on(table.hackathonId),
  index('teams_track_id_idx').on(table.trackId),
  index('teams_invite_code_idx').on(table.inviteCode),
  index('teams_admin_status_idx').on(table.adminStatus),
  index('teams_is_open_idx').on(table.isOpen),
]);

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
```

**Design decisions:**
- `adminStatus` DB default is `'approved'`. The service sets it to `'pending_review'` when the hackathon has `requires_approval = true`. This means the column is safely neutral by default — no team is accidentally locked.
- `reviewReason` is a plain text field updated alongside every `adminStatus = 'pending_review'` transition. Values set by the service: `"New team"`, `"Team profile edited"`, `"Member added: [name/email]"`. Cleared (set to null) when admin approves.
- `inviteCode` is a globally unique 8-character alphanumeric string (A-Z, 0-9). The UNIQUE constraint enforces this at the DB level; the service handles collision retry.
- `trackId` is nullable — teams are not required to select a track. Teams without a track show as "No track" in the browse page.
- No `org_id` on teams — teams are scoped to a hackathon, and hackathons carry `org_id`. All multi-tenant scoping goes through the hackathon relationship.

**Forward compatibility:** Phase 4 (submissions) will check team membership and team admin_status before accepting a submission. The `adminStatus` column is the gate.

---

### 1.7 Database Schema — Team Members (P1.R5)

**New file: `src/db/schema/team-members.ts`**

```typescript
import { pgTable, uuid, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { teamRoleEnum } from './enums';
import { teams } from './teams';
import { users } from './users';

export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: teamRoleEnum('role').notNull().default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('team_members_team_id_idx').on(table.teamId),
  index('team_members_user_id_idx').on(table.userId),
  unique('team_members_team_user_unique').on(table.teamId, table.userId),
]);

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
```

**Design decisions:**
- No `deleted_at` — team membership is hard-deleted on leave or removal. There is no recovery scenario for a team member record; if a user re-joins they get a new record. Historical membership is not a V1 requirement.
- `joinedAt` and `createdAt` are separate columns. `joinedAt` records when the person was formally added to the team (used for auto-leadership-transfer ordering). `createdAt` is the standard audit column.
- The unique constraint on `(team_id, user_id)` enforces one membership per user per team at the DB level. The service also checks this before inserting to return a clean error.
- `role` defaults to `'member'`. The team creator is the only one inserted with `role = 'lead'` — set explicitly in `createTeam`.

**Forward compatibility:** Phase 4 (submissions) will verify team membership before allowing a user to access or submit for a team. Phase 5 (judging) may use this table to identify team members when displaying submission context to judges.

---

### 1.8 Database Schema — Team Join Requests (P1.R6)

**New file: `src/db/schema/team-join-requests.ts`**

```typescript
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { joinRequestStatusEnum } from './enums';
import { teams } from './teams';
import { users } from './users';

export const teamJoinRequests = pgTable('team_join_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  status: joinRequestStatusEnum('status').notNull().default('pending'),
  message: text('message'),
  entryPoint: text('entry_point').notNull(), // 'browse' | 'link' | 'participant_browse'
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('team_join_requests_team_id_idx').on(table.teamId),
  index('team_join_requests_user_id_idx').on(table.userId),
  index('team_join_requests_status_idx').on(table.status),
]);

export type TeamJoinRequest = typeof teamJoinRequests.$inferSelect;
export type NewTeamJoinRequest = typeof teamJoinRequests.$inferInsert;
```

**Design decisions:**
- No DB-level unique constraint on `(team_id, user_id)` — a user may have a historical `accepted` or `rejected` request and attempt to rejoin later (edge case, but valid). The service enforces the business rule: only one `pending` request per (team_id, user_id) at a time.
- `entryPoint` has three valid values: `'browse'` (from the public team browse page), `'link'` (via shared join link), `'participant_browse'` (when a lead invites from `/browse/participants`). This is `text` rather than a pgEnum — same reasoning as `fieldType` above; Zod validates.
- `message` is nullable. Most join requests will have no message; the UI makes it optional.
- No `deleted_at` — join requests are never soft-deleted. Rejected/accepted requests remain as history for the lead to review.

---

### 1.9 Database Schema — Team Invites (P1.R7)

**New file: `src/db/schema/team-invites.ts`**

```typescript
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { teams } from './teams';
import { users } from './users';

export const teamInvites = pgTable('team_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  invitedBy: uuid('invited_by').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('team_invites_team_id_idx').on(table.teamId),
  index('team_invites_email_idx').on(table.email),
  index('team_invites_token_idx').on(table.token),
]);

export type TeamInvite = typeof teamInvites.$inferSelect;
export type NewTeamInvite = typeof teamInvites.$inferInsert;
```

**Design decisions:**
- `token` stores the SHA-256 hash of the raw token (same pattern as `org_invites` and `verification_tokens`). The raw token is sent in the email link; the hash is stored. Never store raw tokens.
- `expiresAt` is set to 7 days from creation. Checked at acceptance time: if `expiresAt < now()`, return a 410 Gone with message "This invite has expired. Ask the team lead to re-invite you."
- `acceptedAt` is nullable. When a user accepts the invite, this is set to `now()`. Subsequent acceptance attempts with the same token return a 409 with "This invite has already been used."
- No `deleted_at` — team invites are not soft-deleted. Expired and accepted records are left as audit history.
- The pattern is intentionally identical to `org_invites` so the token generation flow (`token-service.ts`) is fully reused.

---

### 1.10 Database Schema — Team-Up Requests (P1.R8)

**New file: `src/db/schema/team-up-requests.ts`**

```typescript
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { joinRequestStatusEnum } from './enums';
import { hackathons } from './hackathons';
import { users } from './users';

export const teamUpRequests = pgTable('team_up_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathonId: uuid('hackathon_id').notNull().references(() => hackathons.id),
  fromUserId: uuid('from_user_id').notNull().references(() => users.id),
  toUserId: uuid('to_user_id').notNull().references(() => users.id),
  proposedTeamName: text('proposed_team_name').notNull(),
  message: text('message'),
  status: joinRequestStatusEnum('status').notNull().default('pending'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('team_up_requests_hackathon_id_idx').on(table.hackathonId),
  index('team_up_requests_from_user_id_idx').on(table.fromUserId),
  index('team_up_requests_to_user_id_idx').on(table.toUserId),
  index('team_up_requests_status_idx').on(table.status),
]);

export type TeamUpRequest = typeof teamUpRequests.$inferSelect;
export type NewTeamUpRequest = typeof teamUpRequests.$inferInsert;
```

**Design decisions:**
- Reuses `joinRequestStatusEnum` (pending, accepted, rejected) — same lifecycle states as team join requests.
- No DB-level unique constraint. The service enforces the business rule: only one `pending` request per `(hackathon_id, from_user_id, to_user_id)` at a time, checked before insert.
- `proposedTeamName` is NOT NULL — always required from the requester. This name is used to create the team on acceptance.
- `message` is nullable — optional context for the recipient.
- No `deleted_at` — completed requests (accepted or rejected) remain as history.
- The table is scoped to `hackathon_id` (not `team_id`) because no team exists yet at request time — it's the purpose of the request to create one.

**Forward compatibility:** Phase 6 (notifications) will add in-app notification support. The `team_up_requests` table is the source of truth for request history.

---

### 1.11 Barrel Exports (P1.R10)

Update `src/db/schema/index.ts` to export all new schema files. Add below existing exports:

```typescript
// Phase 3
export * from './registrations';
export * from './registration-fields';
export * from './teams';
export * from './team-members';
export * from './team-join-requests';
export * from './team-invites';
export * from './team-up-requests';
```

---

### 1.12 Migration (P1.R10)

After all schema files are written and `hackathons.ts` is updated, generate and apply the migration:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

The migration will produce SQL that:
1. Creates 3 new Postgres enums: `team_role`, `team_admin_status`, `join_request_status`
2. Adds `requires_approval boolean NOT NULL DEFAULT false` to the `hackathons` table
3. Creates 7 new tables in dependency order: `registrations`, `registration_fields`, `teams`, `team_members`, `team_join_requests`, `team_invites`, `team_up_requests`
4. Creates all indexes declared in the schema

**Verify after migration:**
```bash
# Check all new tables exist
psql $DATABASE_URL -c "\dt" | grep -E "registrations|teams|team_"

# Check requires_approval column
psql $DATABASE_URL -c "\d hackathons" | grep requires_approval

# Check is_discoverable column
psql $DATABASE_URL -c "\d registrations" | grep is_discoverable

# Check new enums
psql $DATABASE_URL -c "\dT+" | grep -E "team_role|team_admin_status|join_request_status"
```

---

### 1.13 Registration Service (P1.R11)

**New file: `src/lib/services/registration-service.ts`**

```typescript
import { db } from '@/db';
import { registrations, registrationFields, teamMembers, teams } from '@/db/schema';
import { users } from '@/db/schema/users';
import { tracks } from '@/db/schema/tracks';
import { eq, and, isNull, count } from 'drizzle-orm';
import type { Registration, RegistrationField } from '@/db/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegistrationWithUser {
  id: string;
  hackathonId: string;
  userId: string;
  formData: Record<string, string> | null;
  isDiscoverable: boolean;
  registeredAt: Date;
  user: {
    name: string;
    email: string;
  };
  team: {
    id: string;
    name: string;
    trackName: string | null;
  } | null;
}

export interface DiscoverableParticipant {
  id: string;
  userId: string;
  formData: Record<string, string> | null;
  registeredAt: Date;
  user: {
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

// ─── Create / Auto-Register ───────────────────────────────────────────────────

export async function createRegistration(
  hackathonId: string,
  userId: string,
  formData: Record<string, string> | null,
  isDiscoverable: boolean = true,
): Promise<Registration> {
  const existing = await getRegistrationByUserAndHackathon(userId, hackathonId);
  if (existing) {
    throw new Error('ALREADY_REGISTERED');
  }

  const [registration] = await db
    .insert(registrations)
    .values({ hackathonId, userId, formData, isDiscoverable })
    .returning();

  return registration;
}

export async function autoRegister(
  hackathonId: string,
  userId: string,
): Promise<void> {
  const existing = await getRegistrationByUserAndHackathon(userId, hackathonId);
  if (existing) return; // idempotent — already registered, nothing to do

  await db.insert(registrations).values({
    hackathonId,
    userId,
    formData: null,
    isDiscoverable: true,
  });
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getRegistrationByUserAndHackathon(
  userId: string,
  hackathonId: string,
): Promise<Registration | null> {
  const [registration] = await db
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.userId, userId),
        eq(registrations.hackathonId, hackathonId),
        isNull(registrations.deletedAt),
      ),
    )
    .limit(1);

  return registration ?? null;
}

export async function getRegistrationsByHackathon(
  hackathonId: string,
): Promise<RegistrationWithUser[]> {
  const rows = await db
    .select({
      id: registrations.id,
      hackathonId: registrations.hackathonId,
      userId: registrations.userId,
      formData: registrations.formData,
      isDiscoverable: registrations.isDiscoverable,
      registeredAt: registrations.registeredAt,
      userName: users.name,
      userEmail: users.email,
      teamId: teams.id,
      teamName: teams.name,
      trackName: tracks.name,
    })
    .from(registrations)
    .innerJoin(users, eq(registrations.userId, users.id))
    .leftJoin(
      teamMembers,
      and(eq(teamMembers.userId, registrations.userId)),
    )
    .leftJoin(
      teams,
      and(
        eq(teams.id, teamMembers.teamId),
        eq(teams.hackathonId, hackathonId),
        isNull(teams.deletedAt),
      ),
    )
    .leftJoin(tracks, eq(tracks.id, teams.trackId))
    .where(
      and(
        eq(registrations.hackathonId, hackathonId),
        isNull(registrations.deletedAt),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    hackathonId: row.hackathonId,
    userId: row.userId,
    formData: row.formData,
    isDiscoverable: row.isDiscoverable,
    registeredAt: row.registeredAt,
    user: { name: row.userName, email: row.userEmail },
    team: row.teamId
      ? { id: row.teamId, name: row.teamName!, trackName: row.trackName ?? null }
      : null,
  }));
}

export async function getDiscoverableParticipants(
  hackathonId: string,
): Promise<DiscoverableParticipant[]> {
  // Registered, is_discoverable=true participants who are not on any team
  const rows = await db
    .select({
      id: registrations.id,
      userId: registrations.userId,
      formData: registrations.formData,
      registeredAt: registrations.registeredAt,
      userName: users.name,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
    })
    .from(registrations)
    .innerJoin(users, eq(registrations.userId, users.id))
    .where(
      and(
        eq(registrations.hackathonId, hackathonId),
        eq(registrations.isDiscoverable, true),
        isNull(registrations.deletedAt),
      ),
    );

  // Filter out users who are on a team for this hackathon
  const withTeamCheck = await Promise.all(
    rows.map(async (row) => {
      const [membership] = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .where(
          and(
            eq(teamMembers.userId, row.userId),
            eq(teams.hackathonId, hackathonId),
            isNull(teams.deletedAt),
          ),
        )
        .limit(1);

      return membership ? null : row;
    }),
  );

  return withTeamCheck
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      formData: row.formData,
      registeredAt: row.registeredAt,
      user: {
        name: row.userName,
        email: row.userEmail,
        avatarUrl: row.userAvatarUrl,
      },
    }));
}

export async function getRegistrationFields(
  hackathonId: string,
): Promise<RegistrationField[]> {
  return db
    .select()
    .from(registrationFields)
    .where(eq(registrationFields.hackathonId, hackathonId))
    .orderBy(registrationFields.order);
}

export async function upsertRegistrationFields(
  hackathonId: string,
  fields: Array<{
    label: string;
    fieldType: string;
    options: string[] | null;
    required: boolean;
    order: number;
  }>,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(registrationFields)
      .where(eq(registrationFields.hackathonId, hackathonId));

    if (fields.length > 0) {
      await tx.insert(registrationFields).values(
        fields.map((f) => ({ ...f, hackathonId })),
      );
    }
  });
}

export async function getRegistrationCount(hackathonId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(registrations)
    .where(
      and(
        eq(registrations.hackathonId, hackathonId),
        isNull(registrations.deletedAt),
      ),
    );

  return result?.count ?? 0;
}
```

**Design decisions:**
- `createRegistration` checks for duplicate before insert and throws a typed error string (`'ALREADY_REGISTERED'`) — the API route catches this and returns 409. Typed error strings are used over custom Error subclasses to keep service functions simple.
- `autoRegister` is idempotent — safe to call even if the user is already registered. It inserts with `formData: null` and `isDiscoverable: true`. This is intentionally minimal since auto-registered users bypassed the form. They can update discoverability later (V2 feature).
- `getDiscoverableParticipants` fetches candidates then filters in application code rather than a single SQL anti-join. The N+1 query is acceptable for V1 (hackathon participant counts in the hundreds, not millions). A single query with `NOT EXISTS` subquery or `LEFT JOIN + IS NULL` can replace this in V2 if performance becomes an issue.
- `getRegistrationsByHackathon` performs a single query with LEFT JOINs to include team and track info. The team JOIN is scoped to the hackathon to avoid cross-hackathon data leaks.
- `formData` stores designation and department under those keys when captured as standard form fields — the UI in Part 3 extracts `row.formData?.designation` and `row.formData?.department` for display.
- `upsertRegistrationFields` runs inside a transaction: delete all existing fields for the hackathon, then insert the new set. This is simpler than diffing and preserves the `order` values exactly as configured.

---

### 1.14 Team Service (P1.R12, P1.R14)

**New file: `src/lib/services/team-service.ts`**

This is the most complex service in Phase 3. It is split into logical groups below.

```typescript
import { db } from '@/db';
import { teams, teamMembers, teamJoinRequests, teamInvites } from '@/db/schema';
import { orgMemberships } from '@/db/schema/org-memberships';
import { users } from '@/db/schema/users';
import { hackathons } from '@/db/schema/hackathons';
import { eq, and, isNull, ne, asc, count } from 'drizzle-orm';
import { generateToken, hashToken } from '@/lib/services/token-service';
import { autoRegister } from '@/lib/services/registration-service';
import { getEmailService } from '@/lib/email/email-service';
import { teamDisbandedAdminEmail } from '@/lib/email/templates';
import type { Team, TeamMember, TeamJoinRequest, TeamInvite } from '@/db/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamWithMembers extends Team {
  members: Array<TeamMember & { user: { name: string; email: string; avatarUrl: string | null } }>;
  pendingRequestCount: number;
}

export interface TeamBrowseItem {
  id: string;
  name: string;
  description: string | null;
  trackId: string | null;
  trackName: string | null;
  isOpen: boolean;
  adminStatus: string;
  memberCount: number;
  maxSize: number;
}

export interface JoinRequestWithUser extends TeamJoinRequest {
  user: { name: string; email: string; avatarUrl: string | null };
}

// ─── Invite Code Generation ───────────────────────────────────────────────────

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

async function generateUniqueInviteCode(): Promise<string> {
  for (let attempts = 0; attempts < 5; attempts++) {
    const code = Array.from(
      { length: 8 },
      () => INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)],
    ).join('');

    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.inviteCode, code))
      .limit(1);

    if (!existing) return code;
  }
  throw new Error('INVITE_CODE_GENERATION_FAILED');
}

// ─── Dissolve Team (P1.R20 — explicit exported function) ─────────────────────

export async function dissolveTeam(
  teamId: string,
  reason: string = 'Team disbanded',
): Promise<void> {
  const [team] = await db
    .select({ hackathonId: teams.hackathonId, name: teams.name })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!team) return; // already dissolved

  await db.transaction(async (tx) => {
    // Hard-delete all remaining team members
    await tx.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
    // Soft-delete the team record
    await tx
      .update(teams)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(teams.id, teamId));
  });

  // Notify org admins — fire-and-forget, outside transaction
  try {
    const [hackathon] = await db
      .select({ title: hackathons.title, orgId: hackathons.orgId })
      .from(hackathons)
      .where(eq(hackathons.id, team.hackathonId))
      .limit(1);

    if (hackathon) {
      const admins = await db
        .select({ email: users.email, name: users.name })
        .from(orgMemberships)
        .innerJoin(users, eq(users.id, orgMemberships.userId))
        .where(
          and(
            eq(orgMemberships.orgId, hackathon.orgId),
            eq(orgMemberships.role, 'org_admin'),
            isNull(orgMemberships.deletedAt),
          ),
        );

      const emailService = getEmailService();
      for (const admin of admins) {
        await emailService.send({
          to: admin.email,
          ...teamDisbandedAdminEmail({
            adminName: admin.name,
            teamName: team.name,
            hackathonTitle: hackathon.title,
            reason,
          }),
        });
      }
    }
  } catch {
    // Email failure must not roll back dissolution — dissolution is already committed
  }
}

// ─── Create Team ──────────────────────────────────────────────────────────────

export async function createTeam(
  hackathonId: string,
  userId: string,
  data: {
    name: string;
    description?: string;
    trackId?: string;
    isOpen: boolean;
  },
): Promise<Team> {
  const [hackathon] = await db
    .select({ requiresApproval: hackathons.requiresApproval })
    .from(hackathons)
    .where(eq(hackathons.id, hackathonId))
    .limit(1);

  if (!hackathon) throw new Error('HACKATHON_NOT_FOUND');

  const existingTeam = await getUserTeamForHackathon(userId, hackathonId);
  if (existingTeam) throw new Error('ALREADY_IN_TEAM');

  const inviteCode = await generateUniqueInviteCode();
  const adminStatus = hackathon.requiresApproval ? 'pending_review' : 'approved';
  const reviewReason = hackathon.requiresApproval ? 'New team' : null;

  const [team] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(teams)
      .values({
        hackathonId,
        name: data.name,
        description: data.description ?? null,
        inviteCode,
        isOpen: data.isOpen,
        trackId: data.trackId ?? null,
        adminStatus,
        reviewReason,
        createdBy: userId,
      })
      .returning();

    await tx.insert(teamMembers).values({
      teamId: created.id,
      userId,
      role: 'lead',
    });

    return [created];
  });

  return team;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getTeamById(teamId: string): Promise<TeamWithMembers | null> {
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!team) return null;

  const members = await db
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      createdAt: teamMembers.createdAt,
      userName: users.name,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(teamMembers.joinedAt));

  const [{ pendingCount }] = await db
    .select({ pendingCount: count() })
    .from(teamJoinRequests)
    .where(
      and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.status, 'pending'),
      ),
    );

  return {
    ...team,
    members: members.map((m) => ({
      id: m.id,
      teamId: m.teamId,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      createdAt: m.createdAt,
      user: { name: m.userName, email: m.userEmail, avatarUrl: m.userAvatarUrl },
    })),
    pendingRequestCount: pendingCount,
  };
}

export async function getTeamByInviteCode(inviteCode: string): Promise<Team | null> {
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.inviteCode, inviteCode), isNull(teams.deletedAt)))
    .limit(1);

  return team ?? null;
}

export async function getTeamsByHackathon(
  hackathonId: string,
  filters: {
    isAdmin?: boolean;
    trackId?: string;
    isOpen?: boolean;
    adminStatus?: string;
    maxSize?: number;
  } = {},
): Promise<TeamBrowseItem[]> {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      trackId: teams.trackId,
      isOpen: teams.isOpen,
      adminStatus: teams.adminStatus,
      memberCount: count(teamMembers.id),
    })
    .from(teams)
    .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .where(and(eq(teams.hackathonId, hackathonId), isNull(teams.deletedAt)))
    .groupBy(teams.id)
    .orderBy(asc(teams.createdAt));

  const filtered = rows.filter((row) => {
    if (!filters.isAdmin) {
      if (!row.isOpen) return false;
      if (filters.maxSize !== undefined && row.memberCount >= filters.maxSize) return false;
    }
    if (filters.trackId && row.trackId !== filters.trackId) return false;
    if (filters.isOpen !== undefined && row.isOpen !== filters.isOpen) return false;
    if (filters.adminStatus && row.adminStatus !== filters.adminStatus) return false;
    return true;
  });

  return filtered.map((row) => ({
    ...row,
    trackName: null, // enriched by caller if needed
    maxSize: filters.maxSize ?? 0,
  }));
}

export async function getUserTeamForHackathon(
  userId: string,
  hackathonId: string,
): Promise<Team | null> {
  const [row] = await db
    .select({ team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teams.hackathonId, hackathonId),
        isNull(teams.deletedAt),
      ),
    )
    .limit(1);

  return row?.team ?? null;
}

export async function getPendingTeams(hackathonId: string): Promise<TeamWithMembers[]> {
  const pendingTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(
      and(
        eq(teams.hackathonId, hackathonId),
        eq(teams.adminStatus, 'pending_review'),
        isNull(teams.deletedAt),
      ),
    );

  return Promise.all(pendingTeams.map((t) => getTeamById(t.id) as Promise<TeamWithMembers>));
}

// ─── Update Team ──────────────────────────────────────────────────────────────

export async function updateTeam(
  teamId: string,
  data: Partial<{ name: string; description: string; trackId: string; isOpen: boolean }>,
): Promise<Team> {
  const [team] = await db
    .select({ hackathonId: teams.hackathonId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) throw new Error('TEAM_NOT_FOUND');

  const [hackathon] = await db
    .select({ requiresApproval: hackathons.requiresApproval })
    .from(hackathons)
    .where(eq(hackathons.id, team.hackathonId))
    .limit(1);

  const requiresApproval = hackathon?.requiresApproval ?? false;

  const [updated] = await db
    .update(teams)
    .set({
      ...data,
      ...(requiresApproval
        ? { adminStatus: 'pending_review', reviewReason: 'Team profile edited' }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId))
    .returning();

  return updated;
}

// ─── Membership ───────────────────────────────────────────────────────────────

export async function addMember(
  teamId: string,
  userId: string,
  memberName: string,
): Promise<void> {
  const [team] = await db
    .select({ hackathonId: teams.hackathonId })
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!team) throw new Error('TEAM_NOT_FOUND');

  const [hackathon] = await db
    .select({ requiresApproval: hackathons.requiresApproval })
    .from(hackathons)
    .where(eq(hackathons.id, team.hackathonId))
    .limit(1);

  const requiresApproval = hackathon?.requiresApproval ?? false;

  // Auto-register the user if not already registered — called before the transaction
  // to keep the transaction scope tight
  await autoRegister(team.hackathonId, userId);

  await db.transaction(async (tx) => {
    await tx.insert(teamMembers).values({ teamId, userId, role: 'member' });

    if (requiresApproval) {
      await tx
        .update(teams)
        .set({
          adminStatus: 'pending_review',
          reviewReason: `Member added: ${memberName}`,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, teamId));
    }
  });
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  const [member] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  if (!member) throw new Error('MEMBER_NOT_FOUND');

  let isLastMember = false;

  await db.transaction(async (tx) => {
    await tx
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

    if (member.role === 'lead') {
      const [next] = await tx
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId))
        .orderBy(asc(teamMembers.joinedAt))
        .limit(1);

      if (next) {
        await tx
          .update(teamMembers)
          .set({ role: 'lead' })
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, next.userId)));
      } else {
        isLastMember = true;
      }
    }
    // admin_status is intentionally NOT changed on member removal
  });

  if (isLastMember) {
    await dissolveTeam(teamId, 'Last member left the team');
  }
}

export async function transferLeadership(
  teamId: string,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(teamMembers)
      .set({ role: 'member' })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, fromUserId)));

    await tx
      .update(teamMembers)
      .set({ role: 'lead' })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, toUserId)));
  });
  // admin_status intentionally NOT changed
}

// ─── Join Requests ────────────────────────────────────────────────────────────

export async function createJoinRequest(
  teamId: string,
  userId: string,
  message: string | null,
  entryPoint: 'browse' | 'link' | 'participant_browse',
): Promise<TeamJoinRequest> {
  const [existing] = await db
    .select({ id: teamJoinRequests.id })
    .from(teamJoinRequests)
    .where(
      and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.userId, userId),
        eq(teamJoinRequests.status, 'pending'),
      ),
    )
    .limit(1);

  if (existing) throw new Error('JOIN_REQUEST_ALREADY_PENDING');

  const [request] = await db
    .insert(teamJoinRequests)
    .values({ teamId, userId, message, entryPoint })
    .returning();

  return request;
}

export async function getJoinRequests(teamId: string): Promise<JoinRequestWithUser[]> {
  const rows = await db
    .select({
      id: teamJoinRequests.id,
      teamId: teamJoinRequests.teamId,
      userId: teamJoinRequests.userId,
      status: teamJoinRequests.status,
      message: teamJoinRequests.message,
      entryPoint: teamJoinRequests.entryPoint,
      requestedAt: teamJoinRequests.requestedAt,
      updatedAt: teamJoinRequests.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
    })
    .from(teamJoinRequests)
    .innerJoin(users, eq(teamJoinRequests.userId, users.id))
    .where(
      and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.status, 'pending'),
      ),
    )
    .orderBy(asc(teamJoinRequests.requestedAt));

  return rows.map((row) => ({
    id: row.id,
    teamId: row.teamId,
    userId: row.userId,
    status: row.status,
    message: row.message,
    entryPoint: row.entryPoint,
    requestedAt: row.requestedAt,
    updatedAt: row.updatedAt,
    user: { name: row.userName, email: row.userEmail, avatarUrl: row.userAvatarUrl },
  }));
}

export async function respondToJoinRequest(
  requestId: string,
  status: 'accepted' | 'rejected',
  hackathonMaxSize: number,
): Promise<void> {
  const [request] = await db
    .select()
    .from(teamJoinRequests)
    .where(eq(teamJoinRequests.id, requestId))
    .limit(1);

  if (!request) throw new Error('REQUEST_NOT_FOUND');
  if (request.status !== 'pending') throw new Error('REQUEST_ALREADY_RESOLVED');

  if (status === 'accepted') {
    const [{ memberCount }] = await db
      .select({ memberCount: count() })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, request.teamId));

    if (memberCount >= hackathonMaxSize) throw new Error('TEAM_FULL');

    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    // addMember calls autoRegister internally
    await addMember(request.teamId, request.userId, user?.name ?? request.userId);

    await db
      .update(teamJoinRequests)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(teamJoinRequests.id, requestId));

    // Auto-reject remaining pending requests if team is now full
    const [{ newCount }] = await db
      .select({ newCount: count() })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, request.teamId));

    if (newCount >= hackathonMaxSize) {
      await db
        .update(teamJoinRequests)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(
          and(
            eq(teamJoinRequests.teamId, request.teamId),
            eq(teamJoinRequests.status, 'pending'),
            ne(teamJoinRequests.id, requestId),
          ),
        );
    }
  } else {
    await db
      .update(teamJoinRequests)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(teamJoinRequests.id, requestId));
  }
}

// ─── Email Invites ────────────────────────────────────────────────────────────

export async function inviteMemberByEmail(
  teamId: string,
  invitedByUserId: string,
  email: string,
): Promise<{ type: 'direct' | 'invite'; userId?: string }> {
  const [existingUser] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    // addMember calls autoRegister internally
    await addMember(teamId, existingUser.id, existingUser.name);
    return { type: 'direct', userId: existingUser.id };
  }

  const rawToken = generateToken();
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(teamInvites).values({
    teamId,
    email,
    token: hashedToken,
    invitedBy: invitedByUserId,
    expiresAt,
  });

  return { type: 'invite' };
}

export async function acceptTeamInvite(
  rawToken: string,
): Promise<{ teamId: string; userId: string }> {
  const hashedToken = hashToken(rawToken);

  const [invite] = await db
    .select()
    .from(teamInvites)
    .where(eq(teamInvites.token, hashedToken))
    .limit(1);

  if (!invite) throw new Error('INVITE_NOT_FOUND');
  if (invite.acceptedAt) throw new Error('INVITE_ALREADY_USED');
  if (invite.expiresAt < new Date()) throw new Error('INVITE_EXPIRED');

  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, invite.email))
    .limit(1);

  if (!user) throw new Error('USER_NOT_FOUND');

  // addMember calls autoRegister internally
  await addMember(invite.teamId, user.id, user.name);

  await db
    .update(teamInvites)
    .set({ acceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(teamInvites.id, invite.id));

  return { teamId: invite.teamId, userId: user.id };
}

// ─── Admin Approval ───────────────────────────────────────────────────────────

export async function approveTeam(teamId: string): Promise<void> {
  await db
    .update(teams)
    .set({ adminStatus: 'approved', reviewReason: null, updatedAt: new Date() })
    .where(eq(teams.id, teamId));
}

export async function rejectTeam(teamId: string): Promise<void> {
  await db
    .update(teams)
    .set({ adminStatus: 'rejected', updatedAt: new Date() })
    .where(eq(teams.id, teamId));
}
```

**Design decisions:**
- `dissolveTeam` is a top-level exported function — not inlined in `removeMember`. It can be called from `removeMember` (last member scenario) and by any future admin "disband team" action without code duplication.
- `dissolveTeam` uses its own transaction for the deletion + soft-delete pair, then sends emails outside the transaction. Email failure cannot roll back the dissolution — the data mutation is the source of truth.
- `removeMember` sets an `isLastMember` flag inside the transaction and calls `dissolveTeam` after the transaction commits. This avoids nested Drizzle transactions while keeping the member removal atomic.
- `addMember` calls `autoRegister` before its own transaction. If `autoRegister` fails (extremely unlikely — it only fails on DB error), the member is not added. If `autoRegister` succeeds but the `teamMembers` insert fails, the registration record is left as an orphan — acceptable for V1 (the user is registered, just not on the team; they can re-attempt the join).
- `generateUniqueInviteCode` retries up to 5 times before failing. With 36^8 ≈ 2.8 trillion combinations and typical hackathon team counts in the hundreds, collisions are effectively impossible in V1.
- `respondToJoinRequest` re-checks team size at approval time, not just at request time. This prevents race conditions where two requests are accepted simultaneously.
- `inviteMemberByEmail` returns a discriminated result `{ type: 'direct' | 'invite' }` so the caller (API route) knows which email template to send.
- `removeMember` and `transferLeadership` explicitly do NOT mutate `adminStatus`. This is a deliberate business rule from the PRD.

---

### 1.15 Team-Up Service (P1.R13)

**New file: `src/lib/services/team-up-service.ts`**

```typescript
import { db } from '@/db';
import { teamUpRequests } from '@/db/schema';
import { users } from '@/db/schema/users';
import { eq, and } from 'drizzle-orm';
import {
  getRegistrationByUserAndHackathon,
} from '@/lib/services/registration-service';
import {
  getUserTeamForHackathon,
  createTeam,
  addMember,
} from '@/lib/services/team-service';
import type { TeamUpRequest } from '@/db/schema';

export async function createTeamUpRequest(
  hackathonId: string,
  fromUserId: string,
  toUserId: string,
  proposedTeamName: string,
  message: string | null,
): Promise<TeamUpRequest> {
  // Both users must be registered
  const fromReg = await getRegistrationByUserAndHackathon(fromUserId, hackathonId);
  if (!fromReg) throw new Error('FROM_USER_NOT_REGISTERED');

  const toReg = await getRegistrationByUserAndHackathon(toUserId, hackathonId);
  if (!toReg) throw new Error('TO_USER_NOT_REGISTERED');

  // Both users must be unteamed
  const fromTeam = await getUserTeamForHackathon(fromUserId, hackathonId);
  if (fromTeam) throw new Error('FROM_USER_ALREADY_IN_TEAM');

  const toTeam = await getUserTeamForHackathon(toUserId, hackathonId);
  if (toTeam) throw new Error('TO_USER_ALREADY_IN_TEAM');

  // Only one pending request allowed between these two users for this hackathon
  const [existing] = await db
    .select({ id: teamUpRequests.id })
    .from(teamUpRequests)
    .where(
      and(
        eq(teamUpRequests.hackathonId, hackathonId),
        eq(teamUpRequests.fromUserId, fromUserId),
        eq(teamUpRequests.toUserId, toUserId),
        eq(teamUpRequests.status, 'pending'),
      ),
    )
    .limit(1);

  if (existing) throw new Error('TEAM_UP_REQUEST_ALREADY_PENDING');

  const [request] = await db
    .insert(teamUpRequests)
    .values({ hackathonId, fromUserId, toUserId, proposedTeamName, message })
    .returning();

  return request;
}

export async function respondToTeamUpRequest(
  requestId: string,
  status: 'accepted' | 'rejected',
): Promise<{ teamId?: string }> {
  const [request] = await db
    .select()
    .from(teamUpRequests)
    .where(eq(teamUpRequests.id, requestId))
    .limit(1);

  if (!request) throw new Error('REQUEST_NOT_FOUND');
  if (request.status !== 'pending') throw new Error('REQUEST_ALREADY_RESOLVED');

  if (status === 'accepted') {
    // Verify both users are still unteamed at acceptance time
    const fromTeam = await getUserTeamForHackathon(request.fromUserId, request.hackathonId);
    if (fromTeam) throw new Error('FROM_USER_ALREADY_IN_TEAM');

    const toTeam = await getUserTeamForHackathon(request.toUserId, request.hackathonId);
    if (toTeam) throw new Error('TO_USER_ALREADY_IN_TEAM');

    // Create team with requester as lead (createTeam also inserts the lead into team_members)
    const team = await createTeam(request.hackathonId, request.fromUserId, {
      name: request.proposedTeamName,
      isOpen: true,
    });

    // Fetch acceptee name for addMember call
    const [toUser] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, request.toUserId))
      .limit(1);

    // addMember calls autoRegister — acceptee is already registered so this is a no-op
    await addMember(team.id, request.toUserId, toUser?.name ?? request.toUserId);

    await db
      .update(teamUpRequests)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(teamUpRequests.id, requestId));

    return { teamId: team.id };
  } else {
    await db
      .update(teamUpRequests)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(teamUpRequests.id, requestId));

    return {};
  }
}

export async function getTeamUpRequestsForUser(
  userId: string,
  hackathonId: string,
): Promise<Array<TeamUpRequest & { fromUser: { name: string; email: string; avatarUrl: string | null } }>> {
  const rows = await db
    .select({
      id: teamUpRequests.id,
      hackathonId: teamUpRequests.hackathonId,
      fromUserId: teamUpRequests.fromUserId,
      toUserId: teamUpRequests.toUserId,
      proposedTeamName: teamUpRequests.proposedTeamName,
      message: teamUpRequests.message,
      status: teamUpRequests.status,
      requestedAt: teamUpRequests.requestedAt,
      updatedAt: teamUpRequests.updatedAt,
      fromUserName: users.name,
      fromUserEmail: users.email,
      fromUserAvatarUrl: users.avatarUrl,
    })
    .from(teamUpRequests)
    .innerJoin(users, eq(teamUpRequests.fromUserId, users.id))
    .where(
      and(
        eq(teamUpRequests.toUserId, userId),
        eq(teamUpRequests.hackathonId, hackathonId),
        eq(teamUpRequests.status, 'pending'),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    hackathonId: row.hackathonId,
    fromUserId: row.fromUserId,
    toUserId: row.toUserId,
    proposedTeamName: row.proposedTeamName,
    message: row.message,
    status: row.status,
    requestedAt: row.requestedAt,
    updatedAt: row.updatedAt,
    fromUser: {
      name: row.fromUserName,
      email: row.fromUserEmail,
      avatarUrl: row.fromUserAvatarUrl,
    },
  }));
}
```

**Design decisions:**
- `createTeamUpRequest` validates at creation time that both users are registered and unteamed. This is optimistic — by the time the recipient responds, one of them might have joined a team. `respondToTeamUpRequest` re-validates both users at acceptance time.
- `respondToTeamUpRequest` on acceptance: creates the team first (which inserts the requester as lead), then calls `addMember` for the acceptee. `addMember` calls `autoRegister` for the acceptee — since they're already registered, this is idempotent (no-op). The two-step sequence (createTeam then addMember) is intentional: `createTeam` already validates `ALREADY_IN_TEAM` for the creator, providing a clean second guard.
- `getTeamUpRequestsForUser` returns only `pending` requests for the `toUserId`. The recipient's inbox view — completed requests are not shown.
- No explicit circular request check (A requests B, then B requests A). The service enforces one pending request per direction per hackathon. Both directions can coexist in pending state; the first acceptance wins.

---

### 1.16 Zod Validation Schemas (P1.R15, P1.R16)

**New file: `src/lib/validations/registration.ts`**

```typescript
import { z } from 'zod';

export const registrationFieldSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, 'Label is required').max(100),
  fieldType: z.enum(['text', 'textarea', 'dropdown']),
  options: z.array(z.string().min(1)).optional().nullable(),
  required: z.boolean().default(false),
  order: z.number().int().min(0),
});

export const upsertRegistrationFieldsSchema = z.object({
  fields: z.array(registrationFieldSchema).max(10, 'Maximum 10 custom fields allowed'),
});

export const createRegistrationSchema = z.object({
  formData: z.record(z.string(), z.string()).optional().nullable(),
  isDiscoverable: z.boolean().default(true),
});

export type RegistrationFieldInput = z.infer<typeof registrationFieldSchema>;
export type UpsertRegistrationFieldsInput = z.infer<typeof upsertRegistrationFieldsSchema>;
export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;
```

**New file: `src/lib/validations/team.ts`**

```typescript
import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
  description: z.string().max(500).optional(),
  trackId: z.string().uuid().optional(),
  isOpen: z.boolean().default(true),
});

export const updateTeamSchema = createTeamSchema.partial();

export const joinRequestSchema = z.object({
  message: z.string().max(300).optional(),
  entryPoint: z.enum(['browse', 'link', 'participant_browse']),
});

export const respondToJoinRequestSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});

export const inviteByEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const transferLeadSchema = z.object({
  toUserId: z.string().uuid(),
});

export const respondToTeamSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type JoinRequestInput = z.infer<typeof joinRequestSchema>;
export type RespondToJoinRequestInput = z.infer<typeof respondToJoinRequestSchema>;
export type InviteByEmailInput = z.infer<typeof inviteByEmailSchema>;
export type TransferLeadInput = z.infer<typeof transferLeadSchema>;
export type RespondToTeamInput = z.infer<typeof respondToTeamSchema>;
```

**New file: `src/lib/validations/team-up.ts`**

```typescript
import { z } from 'zod';

export const createTeamUpRequestSchema = z.object({
  toUserId: z.string().uuid(),
  proposedTeamName: z.string().min(1, 'Team name is required').max(100),
  message: z.string().max(300).optional(),
});

export const respondToTeamUpRequestSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});

export type CreateTeamUpRequestInput = z.infer<typeof createTeamUpRequestSchema>;
export type RespondToTeamUpRequestInput = z.infer<typeof respondToTeamUpRequestSchema>;
```

---

### 1.17 Email Templates (P1.R17)

Add the following 13 template functions to the existing `src/lib/email/templates.ts`. Each follows the existing pattern of returning `{ subject: string; html: string }`.

```typescript
// ─── Registration ─────────────────────────────────────────────────────────────

export function registrationConfirmedEmail(params: {
  name: string;
  hackathonTitle: string;
  hackathonSlug: string;
  appUrl: string;
}): { subject: string; html: string } {
  const landingUrl = `${params.appUrl}/hackathons/${params.hackathonSlug}`;
  return {
    subject: `You're registered for ${params.hackathonTitle}!`,
    html: emailLayout(`
      <h2>You're in, ${params.name}!</h2>
      <p>Your registration for <strong>${params.hackathonTitle}</strong> is confirmed.</p>
      <p>Next step: find or create your team.</p>
      ${ctaButton('Browse Teams', landingUrl)}
    `),
  };
}

// ─── Team Admin Status ────────────────────────────────────────────────────────

export function teamCreatedPendingReviewEmail(params: {
  leadName: string;
  teamName: string;
  hackathonTitle: string;
  teamUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Your team "${params.teamName}" is under review`,
    html: emailLayout(`
      <h2>Almost there, ${params.leadName}!</h2>
      <p>Your team <strong>${params.teamName}</strong> for <strong>${params.hackathonTitle}</strong> has been submitted for organiser review.</p>
      <p>You'll receive an email once your team is approved.</p>
      ${ctaButton('View Team', params.teamUrl)}
    `),
  };
}

export function teamApprovedEmail(params: {
  memberName: string;
  teamName: string;
  hackathonTitle: string;
  teamUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Your team "${params.teamName}" has been approved`,
    html: emailLayout(`
      <h2>You're officially in, ${params.memberName}!</h2>
      <p>Your team <strong>${params.teamName}</strong> has been approved for <strong>${params.hackathonTitle}</strong>.</p>
      ${ctaButton('View Team', params.teamUrl)}
    `),
  };
}

export function teamRejectedEmail(params: {
  leadName: string;
  teamName: string;
  hackathonTitle: string;
  organizerEmail: string;
}): { subject: string; html: string } {
  return {
    subject: `Update on your team "${params.teamName}"`,
    html: emailLayout(`
      <h2>Hi ${params.leadName},</h2>
      <p>Unfortunately, your team <strong>${params.teamName}</strong> was not approved for <strong>${params.hackathonTitle}</strong>.</p>
      <p>Please contact the organiser at <a href="mailto:${params.organizerEmail}">${params.organizerEmail}</a> for more information.</p>
    `),
  };
}

export function teamPendingReReviewEmail(params: {
  teamName: string;
  hackathonTitle: string;
  reviewReason: string;
  teamAdminUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `[Action Required] Team "${params.teamName}" needs re-approval`,
    html: emailLayout(`
      <h2>A team requires your review</h2>
      <p>The team <strong>${params.teamName}</strong> in <strong>${params.hackathonTitle}</strong> has been updated and requires re-approval.</p>
      <p><strong>Reason:</strong> ${params.reviewReason}</p>
      ${ctaButton('Review Team', params.teamAdminUrl)}
    `),
  };
}

export function teamDisbandedAdminEmail(params: {
  adminName: string;
  teamName: string;
  hackathonTitle: string;
  reason: string;
}): { subject: string; html: string } {
  return {
    subject: `[FYI] Team "${params.teamName}" has been disbanded`,
    html: emailLayout(`
      <h2>Hi ${params.adminName},</h2>
      <p>The team <strong>${params.teamName}</strong> in <strong>${params.hackathonTitle}</strong> has been disbanded.</p>
      <p><strong>Reason:</strong> ${params.reason}</p>
      <p>All former members retain their registrations and will reappear on the participants browse page.</p>
    `),
  };
}

// ─── Team Invites ─────────────────────────────────────────────────────────────

export function teamInviteExistingUserEmail(params: {
  name: string;
  teamName: string;
  hackathonTitle: string;
  teamUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `You've been added to team "${params.teamName}"`,
    html: emailLayout(`
      <h2>Welcome to the team, ${params.name}!</h2>
      <p>You've been added to <strong>${params.teamName}</strong> for <strong>${params.hackathonTitle}</strong>.</p>
      <p>You can leave the team from your team page if you'd like.</p>
      ${ctaButton('View Team', params.teamUrl)}
    `),
  };
}

export function teamInviteNewUserEmail(params: {
  email: string;
  teamName: string;
  hackathonTitle: string;
  acceptUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `You've been invited to join "${params.teamName}"`,
    html: emailLayout(`
      <h2>You're invited!</h2>
      <p>You've been invited to join <strong>${params.teamName}</strong> for <strong>${params.hackathonTitle}</strong>.</p>
      <p>Create your account to accept the invitation and start participating.</p>
      ${ctaButton('Accept Invitation', params.acceptUrl)}
      <p style="color:#888;font-size:12px;">This invitation expires in 7 days.</p>
    `),
  };
}

// ─── Join Requests ────────────────────────────────────────────────────────────

export function joinRequestAcceptedEmail(params: {
  name: string;
  teamName: string;
  hackathonTitle: string;
  teamUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Your request to join "${params.teamName}" was accepted`,
    html: emailLayout(`
      <h2>You're on the team, ${params.name}!</h2>
      <p>Your request to join <strong>${params.teamName}</strong> for <strong>${params.hackathonTitle}</strong> has been accepted.</p>
      ${ctaButton('View Team', params.teamUrl)}
    `),
  };
}

export function joinRequestRejectedEmail(params: {
  name: string;
  teamName: string;
  hackathonTitle: string;
  browseUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Update on your request to join "${params.teamName}"`,
    html: emailLayout(`
      <h2>Hi ${params.name},</h2>
      <p>Your request to join <strong>${params.teamName}</strong> was not accepted.</p>
      <p>There are other great teams looking for members — keep exploring!</p>
      ${ctaButton('Browse Teams', params.browseUrl)}
    `),
  };
}

// ─── Team-Up ──────────────────────────────────────────────────────────────────

export function teamUpRequestEmail(params: {
  recipientName: string;
  requesterName: string;
  proposedTeamName: string;
  hackathonTitle: string;
  message: string | null;
  respondUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `${params.requesterName} wants to team up with you`,
    html: emailLayout(`
      <h2>You've got a team-up request, ${params.recipientName}!</h2>
      <p><strong>${params.requesterName}</strong> wants to form a team with you for <strong>${params.hackathonTitle}</strong>.</p>
      <p><strong>Proposed team name:</strong> ${params.proposedTeamName}</p>
      ${params.message ? `<p><strong>Message:</strong> ${params.message}</p>` : ''}
      <p>Log in to accept or decline the request.</p>
      ${ctaButton('Respond to Request', params.respondUrl)}
    `),
  };
}

export function teamUpAcceptedEmail(params: {
  requesterName: string;
  accepteeName: string;
  teamName: string;
  hackathonTitle: string;
  teamUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `${params.accepteeName} accepted your team-up request`,
    html: emailLayout(`
      <h2>Your team is ready, ${params.requesterName}!</h2>
      <p><strong>${params.accepteeName}</strong> has accepted your team-up request for <strong>${params.hackathonTitle}</strong>.</p>
      <p>Your team <strong>${params.teamName}</strong> has been created with you as the lead.</p>
      ${ctaButton('View Team', params.teamUrl)}
    `),
  };
}

export function teamUpDeclinedEmail(params: {
  requesterName: string;
  declineeName: string;
  proposedTeamName: string;
  hackathonTitle: string;
  browseUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Update on your team-up request`,
    html: emailLayout(`
      <h2>Hi ${params.requesterName},</h2>
      <p><strong>${params.declineeName}</strong> was unable to join your proposed team <strong>${params.proposedTeamName}</strong> for <strong>${params.hackathonTitle}</strong> at this time.</p>
      <p>There are other participants looking for teammates — keep browsing!</p>
      ${ctaButton('Browse Participants', params.browseUrl)}
    `),
  };
}
```

**Design decisions:**
- All 13 templates reuse the existing `emailLayout()` and `ctaButton()` helper functions already defined in `templates.ts` from Phase 1.
- `teamPendingReReviewEmail` uses `[Action Required]` in the subject — this is for admin inboxes and needs to stand out.
- `teamDisbandedAdminEmail` uses `[FYI]` prefix — informational, no action required.
- `joinRequestRejectedEmail` includes a "Browse Teams" CTA rather than leaving the user with a dead end.
- `teamUpDeclinedEmail` links to `/browse/participants` so the requester can find other teammates immediately.
- Email sending from API route handlers is the caller's responsibility — the templates return `{ subject, html }`, not sent emails. Callers import `getEmailService()` and call `emailService.send({ to, ...template(...) })`.

---

### 1.18 Files Changed Summary

| File | Action | Reason |
|------|--------|--------|
| `src/db/schema/enums.ts` | Modified | Add `teamRoleEnum`, `teamAdminStatusEnum`, `joinRequestStatusEnum` |
| `src/db/schema/hackathons.ts` | Modified | Add `requiresApproval` column |
| `src/db/schema/registrations.ts` | Created | `registrations` table + types (with `isDiscoverable`) |
| `src/db/schema/registration-fields.ts` | Created | `registration_fields` table + types |
| `src/db/schema/teams.ts` | Created | `teams` table + types |
| `src/db/schema/team-members.ts` | Created | `team_members` table + types |
| `src/db/schema/team-join-requests.ts` | Created | `team_join_requests` table + types |
| `src/db/schema/team-invites.ts` | Created | `team_invites` table + types |
| `src/db/schema/team-up-requests.ts` | Created | `team_up_requests` table + types |
| `src/db/schema/index.ts` | Modified | Barrel exports for all 7 new schema files |
| `src/db/migrations/` | Generated | New migration file from `drizzle-kit generate` |
| `src/lib/services/registration-service.ts` | Created | `createRegistration` (with `isDiscoverable`), `autoRegister`, `getDiscoverableParticipants`, and 5 other methods |
| `src/lib/services/team-service.ts` | Created | `dissolveTeam` (exported standalone), `addMember` (calls `autoRegister`), and all other team methods |
| `src/lib/services/team-up-service.ts` | Created | `createTeamUpRequest`, `respondToTeamUpRequest`, `getTeamUpRequestsForUser` |
| `src/lib/validations/registration.ts` | Created | Zod schemas for registration (includes `isDiscoverable`) |
| `src/lib/validations/team.ts` | Created | Zod schemas for teams (entryPoint includes `'participant_browse'`) |
| `src/lib/validations/team-up.ts` | Created | Zod schemas for team-up requests |
| `src/lib/validations/hackathon.ts` | Modified | Add `requiresApproval` to update schema |
| `src/lib/email/templates.ts` | Modified | Add 13 new email template functions |

---

### 1.19 Implementation Increments

Part 1 is implemented in 4 increments. Each increment is independently verifiable before moving to the next.

---

**Increment 1: Schema Files + Migration**

Build all schema changes first — this is the foundation everything else depends on.

1. Add 3 new enums to `src/db/schema/enums.ts`
2. Add `requiresApproval` column to `src/db/schema/hackathons.ts`
3. Add `requiresApproval` to `src/lib/validations/hackathon.ts`
4. Create `src/db/schema/registrations.ts` (with `isDiscoverable`)
5. Create `src/db/schema/registration-fields.ts`
6. Create `src/db/schema/teams.ts`
7. Create `src/db/schema/team-members.ts`
8. Create `src/db/schema/team-join-requests.ts`
9. Create `src/db/schema/team-invites.ts`
10. Create `src/db/schema/team-up-requests.ts`
11. Update `src/db/schema/index.ts` barrel exports (7 new files)
12. Run `npx drizzle-kit generate` → review generated SQL
13. Run `npx drizzle-kit migrate` → verify all tables and enums exist in the DB
14. Run `npx tsc --noEmit` — schema files must type-check cleanly

**Verify:** All 7 new tables visible in DB. `hackathons.requires_approval` column exists. `registrations.is_discoverable` column exists with default `true`. `npx tsc --noEmit` passes.

---

**Increment 2: Registration Service + Validation**

1. Create `src/lib/validations/registration.ts` with all 3 schemas (including `isDiscoverable` in `createRegistrationSchema`)
2. Create `src/lib/services/registration-service.ts` with all 8 methods: `createRegistration`, `autoRegister`, `getRegistrationByUserAndHackathon`, `getRegistrationsByHackathon`, `getDiscoverableParticipants`, `getRegistrationFields`, `upsertRegistrationFields`, `getRegistrationCount`
3. Run `npx tsc --noEmit`

**Verify:** TypeScript compiles cleanly. Confirm `autoRegister` is idempotent (calling it twice for the same user/hackathon pair inserts only one record). Confirm `getDiscoverableParticipants` filters out users who have a team.

---

**Increment 3: Team Service + Team-Up Service + Validation**

1. Create `src/lib/validations/team.ts` with all 7 schemas (entryPoint includes `'participant_browse'`)
2. Create `src/lib/validations/team-up.ts` with 2 schemas
3. Create `src/lib/services/team-service.ts` with all methods:
   - Confirm `dissolveTeam` is a top-level exported function (not inlined)
   - Confirm `addMember` calls `autoRegister` before its transaction
   - Confirm `removeMember` calls `dissolveTeam` when `isLastMember = true`
   - Confirm `removeMember` and `transferLeadership` do NOT touch `adminStatus`
4. Create `src/lib/services/team-up-service.ts` with all 3 methods
5. Run `npx tsc --noEmit`

**Verify:** TypeScript compiles cleanly. Review transaction blocks in `createTeam`, `removeMember`, and `transferLeadership`. Confirm `dissolveTeam` sends admin emails after the transaction commits, not inside it. Confirm `respondToTeamUpRequest` re-validates both users are unteamed at acceptance time.

---

**Increment 4: Email Templates**

1. Add all 13 new email template functions to `src/lib/email/templates.ts`
2. Run `npx tsc --noEmit`

**Verify:** TypeScript compiles cleanly. Manually review that `emailLayout()` and `ctaButton()` helper calls match the existing signature in `templates.ts`. Confirm all 13 functions are named exports.

---

*Part 1 complete when all 4 increments pass and `npx tsc --noEmit` has zero errors.*

---

*Parts 2–4 will be written after Part 1 is implemented and verified.*
