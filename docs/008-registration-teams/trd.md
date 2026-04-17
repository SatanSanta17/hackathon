# TRD — Phase 3: Registration + Team Formation

**Document ID:** TRD-008  
**Date:** April 17, 2026  
**Author:** Burhanuddin C.  
**Status:** Part 2 Written — Awaiting Implementation  
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

*Parts 3–4 will be written after Parts 1–2 are implemented and verified.*

---

## Part 2: Registration Flow

**PRD Requirements Covered:** P2.R1 through P2.R11

---

### 2.1 Dependencies (New for Part 2)

No new npm packages. Add two missing shadcn/ui components before implementing:

```bash
npx shadcn@latest add switch textarea
```

- **switch** — `requires_approval` toggle in wizard; `isDiscoverable` toggle in registration form
- **textarea** — textarea field type in the registration form renderer

All other dependencies (react-hook-form, zod, @hello-pangea/dnd, next-auth) are already installed.

---

### 2.2 New Service Methods

Add two methods to the existing `src/lib/services/registration-service.ts`.

**`getRegistrationsByUser`** — used by the "My Hackathons" page:

```typescript
import { desc } from 'drizzle-orm';
import { hackathons } from '@/db/schema/hackathons';
import { teamMembers } from '@/db/schema/team-members';
import { teams } from '@/db/schema/teams';

export interface UserHackathonSummary {
  registrationId: string;
  hackathonId: string;
  registeredAt: Date;
  formData: Record<string, string> | null;
  hackathon: {
    title: string;
    slug: string;
    status: string;
    coverImageKey: string | null;
    requiresApproval: boolean;
  };
  team: {
    id: string;
    name: string;
    adminStatus: string;
    memberCount: number;
  } | null;
}

export async function getRegistrationsByUser(
  userId: string,
): Promise<UserHackathonSummary[]> {
  const rows = await db
    .select({
      registrationId: registrations.id,
      hackathonId: registrations.hackathonId,
      registeredAt: registrations.registeredAt,
      formData: registrations.formData,
      hackathonTitle: hackathons.title,
      hackathonSlug: hackathons.slug,
      hackathonStatus: hackathons.status,
      hackathonCoverImageKey: hackathons.coverImageKey,
      hackathonRequiresApproval: hackathons.requiresApproval,
    })
    .from(registrations)
    .innerJoin(hackathons, eq(registrations.hackathonId, hackathons.id))
    .where(
      and(
        eq(registrations.userId, userId),
        isNull(registrations.deletedAt),
        isNull(hackathons.deletedAt),
      ),
    )
    .orderBy(desc(registrations.registeredAt));

  return Promise.all(
    rows.map(async (row) => {
      const team = await getUserTeamForHackathon(userId, row.hackathonId);
      let teamWithCount: UserHackathonSummary['team'] = null;

      if (team) {
        const [{ memberCount }] = await db
          .select({ memberCount: count() })
          .from(teamMembers)
          .where(eq(teamMembers.teamId, team.id));
        teamWithCount = {
          id: team.id,
          name: team.name,
          adminStatus: team.adminStatus,
          memberCount,
        };
      }

      return {
        registrationId: row.registrationId,
        hackathonId: row.hackathonId,
        registeredAt: row.registeredAt,
        formData: row.formData as Record<string, string> | null,
        hackathon: {
          title: row.hackathonTitle,
          slug: row.hackathonSlug,
          status: row.hackathonStatus,
          coverImageKey: row.hackathonCoverImageKey,
          requiresApproval: row.hackathonRequiresApproval,
        },
        team: teamWithCount,
      };
    }),
  );
}
```

**`updateRegistration`** — used by the profile completion form (PATCH /registration):

```typescript
export async function updateRegistration(
  registrationId: string,
  data: { formData?: Record<string, string> | null; isDiscoverable?: boolean },
): Promise<Registration> {
  const [updated] = await db
    .update(registrations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(registrations.id, registrationId))
    .returning();

  if (!updated) throw new Error('REGISTRATION_NOT_FOUND');
  return updated;
}
```

**Design decisions:**
- `getRegistrationsByUser` has an N+1 for team lookups per registration. Acceptable in V1 — a user is registered to at most a handful of hackathons at any given time.
- `getUserTeamForHackathon` is imported from `team-service.ts`. This creates a cross-service call; it is intentional (no circular dep — registration-service imports team-service, never the reverse).

---

### 2.3 API Routes (P2.R11)

Seven new route files. All follow the existing pattern: `requireVerifiedUser()` for participant endpoints, fetch hackathon to get `orgId` then `requireOrgRole()` for admin endpoints.

#### `src/app/api/hackathons/[hackathonId]/register/route.ts`

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/auth/require-verified';
import { getHackathonById } from '@/lib/services/hackathon-service';
import { createRegistration, getRegistrationFields } from '@/lib/services/registration-service';
import { createRegistrationSchema } from '@/lib/validations/registration';
import { getEmailService } from '@/lib/email';
import { registrationConfirmedEmail } from '@/lib/email/templates';
import { db } from '@/db';
import { users } from '@/db/schema/users';
import { eq } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ hackathonId: string }> },
) {
  const { hackathonId } = await params;
  const user = await requireVerifiedUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const hackathon = await getHackathonById(hackathonId);
  if (!hackathon) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const { hackathon: h, phases } = hackathon;

  if (h.status !== 'published' && h.status !== 'active') {
    return NextResponse.json({ message: 'Registration is not open' }, { status: 403 });
  }

  const regPhase = phases.find((p) => p.type === 'registration');
  if (regPhase?.status === 'completed') {
    return NextResponse.json({ message: 'Registration has closed' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation error', errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const registration = await createRegistration(
      hackathonId,
      user.id,
      parsed.data.formData ?? null,
      parsed.data.isDiscoverable,
    );

    try {
      const [userData] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      await getEmailService().send({
        to: userData.email,
        ...registrationConfirmedEmail({
          name: userData.name,
          hackathonTitle: h.title,
          hackathonSlug: h.slug,
          appUrl: process.env.NEXT_PUBLIC_APP_URL!,
        }),
      });
    } catch { /* email failure must not fail the registration */ }

    return NextResponse.json({ registration }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_REGISTERED') {
      return NextResponse.json({ message: 'Already registered' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}
```

#### `src/app/api/hackathons/[hackathonId]/registration/route.ts`

GET returns own registration; PATCH updates formData/isDiscoverable (profile completion):

```typescript
export async function GET(req, { params }) {
  // requireVerifiedUser → getRegistrationByUserAndHackathon(user.id, hackathonId)
  // 404 if not found, 200 with registration if found
}

export async function PATCH(req, { params }) {
  // requireVerifiedUser → getRegistrationByUserAndHackathon to confirm ownership
  // Body: { formData?, isDiscoverable? }
  // updateRegistration(registration.id, parsedBody)
  // 200 with updated registration
}
```

**Validation schema for PATCH** — add to `src/lib/validations/registration.ts`:
```typescript
export const updateRegistrationSchema = z.object({
  formData: z.record(z.string(), z.string()).optional().nullable(),
  isDiscoverable: z.boolean().optional(),
});
export type UpdateRegistrationInput = z.infer<typeof updateRegistrationSchema>;
```

#### `src/app/api/hackathons/[hackathonId]/registration-fields/route.ts`

```typescript
// GET: public — no auth
export async function GET(req, { params }) {
  const { hackathonId } = await params;
  const fields = await getRegistrationFields(hackathonId);
  return NextResponse.json({ fields });
}

// POST: org_admin only — upsert
export async function POST(req, { params }) {
  const { hackathonId } = await params;
  const user = await requireVerifiedUser();
  if (!user) return 401;
  // fetch hackathon to get orgId, then requireOrgRole(orgId, user.id, 'org_admin')
  const body = await req.json();
  const parsed = upsertRegistrationFieldsSchema.safeParse(body);
  if (!parsed.success) return 400;
  await upsertRegistrationFields(hackathonId, parsed.data.fields);
  return NextResponse.json({ ok: true });
}
```

#### `src/app/api/hackathons/[hackathonId]/registrations/route.ts`

Admin-only roster:

```typescript
// GET: org_admin — full registration list with user + team data
export async function GET(req, { params }) {
  // requireOrgRole check
  const registrations = await getRegistrationsByHackathon(hackathonId);
  return NextResponse.json({ registrations });
}
```

#### `src/app/api/hackathons/[hackathonId]/registrations/export/route.ts`

CSV export:

```typescript
export async function GET(req, { params }) {
  const { hackathonId } = await params;
  // requireOrgRole check

  const [rows, fields] = await Promise.all([
    getRegistrationsByHackathon(hackathonId),
    getRegistrationFields(hackathonId),
  ]);

  const customFieldLabels = fields.map((f) => `"${f.label}"`);
  const header = [
    'Name', 'Email', 'Department', 'Designation',
    'Registration Date', 'Team Name', 'Track', 'Discoverable',
    ...customFieldLabels,
  ].join(',');

  const dataRows = rows.map((r) => {
    const base = [
      `"${r.user.name}"`,
      `"${r.user.email}"`,
      `"${r.formData?.department ?? ''}"`,
      `"${r.formData?.designation ?? ''}"`,
      `"${r.registeredAt.toISOString()}"`,
      `"${r.team?.name ?? ''}"`,
      `"${r.team?.trackName ?? ''}"`,
      r.isDiscoverable ? 'Yes' : 'No',
    ];
    const customValues = fields.map((f) => `"${(r.formData?.[f.id] ?? '').replace(/"/g, '""')}"`);
    return [...base, ...customValues].join(',');
  });

  const csv = [header, ...dataRows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="registrations-${hackathonId}.csv"`,
    },
  });
}
```

**Design decisions:**
- CSV built in-memory (simple string concat). No streaming library needed at V1 participant counts (hundreds, not hundreds of thousands).
- Custom field values keyed by `field.id` (UUID). Quote characters in values are escaped by doubling (`""`), which is standard CSV escaping.
- `Content-Disposition: attachment` triggers a browser download automatically when linked from the page with a plain `<a href="..." download>` tag. No client-side fetch needed.

#### `src/app/api/user/hackathons/route.ts`

```typescript
// GET: requireVerifiedUser → getRegistrationsByUser(user.id) → 200
```

---

### 2.4 Wizard Step 6: Participation Settings (P2.R1)

Inserting this step between Step 5 (Team Rules) and the current Step 6 (Prizes) shifts all later steps +1. The wizard grows from 8 to 9 steps.

#### Changes to `wizard-shell.tsx`

Read the file before modifying. The changes are surgical — only the specifically noted lines change.

**1. `STEPS` constant** — insert `{ number: 6, name: 'Participation' }` and renumber 6→7, 7→8, 8→9:

```typescript
const STEPS = [
  { number: 1, name: 'Template' },
  { number: 2, name: 'Basic Info' },
  { number: 3, name: 'Tracks' },
  { number: 4, name: 'Timeline' },
  { number: 5, name: 'Team Rules' },
  { number: 6, name: 'Participation' },    // NEW
  { number: 7, name: 'Prizes' },           // was 6
  { number: 8, name: 'Rules & FAQs' },     // was 7
  { number: 9, name: 'Review & Publish' }, // was 8
] as const;
```

**2. New state** — add after `prizesData`:

```typescript
const [registrationFieldsData, setRegistrationFieldsData] = useState<RegistrationFieldInput[]>(
  hackathon?.registrationFields ?? [],
);
```

`RegistrationFieldInput` is imported from `@/lib/validations/registration`.

**3. Edit mode init changes:**
- `useState(isEditMode ? 9 : 1)` for `highestStepReached` (was 8)
- `for (let i = 1; i <= 9; i++) initial.add(i)` in `visitedSteps` init (was 8)

**4. `getFurthestStep`** — update all return values:

```typescript
function getFurthestStep(data: HackathonWithRelations): number {
  const { hackathon: h, phases, tracks, prizes } = data;
  if (h.rulesHtml || h.faqsHtml) return 9;    // was 8
  if (prizes.length > 0) return 8;              // was 7
  if (h.requiresApproval) return 7;             // new: participation step visited if requires_approval was set
  if (h.teamMinSize !== 1 || h.teamMaxSize !== 5) return 6; // was return 6 (same number, now means Participation step)
  // ...rest unchanged
}
```

**5. `handleNext`** — `if (currentStep < 9)` (was `< 8`)

**6. Navigation footer** — `currentStep !== 9` (was `!== 8`)

**7. Steps with own Save & Continue button** — the array `[2, 4, 5, 7, 8]` that suppresses the generic "Next" button becomes `[2, 4, 5, 6, 8, 9]`:
- Step 6 (Participation) — new, gets its own Save & Continue
- Step 8 (Rules & FAQs, was 7) — unchanged logic
- Step 9 (Review, was 8) — no Next button needed

**8. `getStepStatus` switch** — add case 6, renumber 6→7, 7→8, 8→9. Case 6 is optional (visited = complete):
```typescript
case 6:
  if (!hackathonId) return 'not_started';
  return visitedSteps.has(6) ? 'complete' : 'not_started';
case 7: // Prizes (was case 6)
  ...
```

**9. `renderStepContent` switch** — add case 6, renumber 7/8/9:

```typescript
case 6:
  return hackathonId ? (
    <StepParticipation
      hackathonId={hackathonId}
      orgId={orgId}
      initialRequiresApproval={hackathonData.requiresApproval ?? false}
      initialFields={registrationFieldsData}
      onSave={(data) => {
        setHackathonData((prev) => ({ ...prev, requiresApproval: data.requiresApproval }));
        setRegistrationFieldsData(data.fields);
      }}
      onNext={handleNext}
    />
  ) : null;
case 7: // StepPrizes (was case 6)
  ...
case 8: // StepRulesFaqs (was case 7)
  ...
case 9: // StepReview (was case 8)
  ...
```

StepReview currently receives `prizesData` and others — its `onNavigateToStep` prop already uses step numbers; update review's "Edit" links to point to the new step numbers (prizes is now step 7, etc.).

#### New file: `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/step-participation.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { RegistrationFieldInput } from '@/lib/validations/registration';

interface StepParticipationProps {
  hackathonId: string;
  orgId: string;
  initialRequiresApproval: boolean;
  initialFields: RegistrationFieldInput[];
  onSave: (data: { requiresApproval: boolean; fields: RegistrationFieldInput[] }) => void;
  onNext: () => void;
}
```

Internal state:
- `requiresApproval: boolean` — controlled by Switch
- `fields: RegistrationFieldInput[]` — the field list, mutated by add/reorder/delete/edit
- `isSaving: boolean`

"Add Field" button: appends `{ label: '', fieldType: 'text', options: null, required: false, order: fields.length }` to the array. Button disabled when `fields.length >= 10`.

Each field row:
- Drag handle: `<GripVertical />` icon (DnD provided)
- Label: `<Input>` bound to `field.label`
- Type: `<Select>` with options Text / Long Answer / Dropdown
- Options (only when type = dropdown): `<Input placeholder="Option 1, Option 2, Option 3" />` — value is a comma-separated string; parsed into `string[]` on save
- Required: `<Switch>` bound to `field.required`
- Delete: `<Trash2>` button

Save & Continue handler:
1. Validate — no empty labels (show inline error, do not proceed)
2. Parse dropdown options: split by comma, trim whitespace, filter empty strings
3. Re-index `order` values (0, 1, 2…)
4. `PATCH /api/hackathons/[hackathonId]` with `{ requiresApproval }`
5. `POST /api/hackathons/[hackathonId]/registration-fields` with `{ fields }`
6. On success: call `onSave({ requiresApproval, fields })` and `onNext()`
7. On error: toast error, leave user on step

**Design decisions:**
- Dropdown options stored as comma-separated text in the UI for simplicity. Parsed to `string[]` on save. This avoids needing a tag-input component for V1.
- Each field edit is purely local state until "Save & Continue" — no auto-save, no debounced saves. This is consistent with the approach in `step-tracks.tsx` (changes to tracks are saved immediately, but participation settings have more complexity). Actually looking at the tracks step — tracks ARE auto-saved on each add/edit/delete via API. For participation settings, the bulk "wipe and re-insert" nature of `upsertRegistrationFields` makes auto-save on every keystroke impractical. Batch-save on "Save & Continue" is the correct pattern here.

#### Update `HackathonWithRelations` in `hackathon-service.ts`

Add optional `registrationFields?: RegistrationField[]` to the interface. Do not add it to `getHackathonsByOrgId` (not needed for the list view). Only add it when loading for the wizard:

```typescript
// In getHackathonById, after building the base return object:
import { getRegistrationFields } from '@/lib/services/registration-service';

// Add to the returned object:
registrationFields: await getRegistrationFields(hackathon.id),
```

This adds one extra query to `getHackathonById`. Since this function is already doing multiple joins, one more query is acceptable. `getHackathonsByOrgId` is NOT changed — avoid loading fields for the list view.

Type update in hackathon-service.ts:
```typescript
export interface HackathonWithRelations {
  hackathon: Hackathon;
  phases: Phase[];
  tracks: Track[];
  prizes: Prize[];
  orgName: string;
  registrationFields?: RegistrationField[];  // NEW — optional, only loaded in getHackathonById
}
```

---

### 2.5 Landing Page: State-Aware CTA (P2.R2, P2.R7)

#### CTA state type

Define in a new file `src/app/(public)/hackathons/[slug]/_components/registration-cta.tsx`:

```typescript
export type CtaState =
  | { type: 'unauthenticated' }
  | { type: 'register'; hackathonId: string }
  | { type: 'registration_closed' }
  | { type: 'find_team'; teamsUrl: string }
  | { type: 'under_review'; teamId: string }
  | { type: 'my_team'; teamId: string; teamUrl: string }
  | { type: 'team_rejected' }
  | { type: 'completed' };
```

#### Changes to `src/app/(public)/hackathons/[slug]/page.tsx`

Add server-side CTA state computation after hackathon is fetched. The registration fields are also fetched here (to pass into the modal):

```typescript
import { auth } from '@/lib/auth/auth';
import {
  getRegistrationByUserAndHackathon,
  getRegistrationFields,
} from '@/lib/services/registration-service';
import { getUserTeamForHackathon } from '@/lib/services/team-service';
import type { CtaState } from './_components/registration-cta';

// After fetching hackathon data:
const session = await auth();
const registrationFields = await getRegistrationFields(hackathonData.hackathon.id);

function isRegOpen(hackathon: HackathonWithRelations): boolean {
  const { hackathon: h, phases } = hackathon;
  if (h.status !== 'published' && h.status !== 'active') return false;
  const regPhase = phases.find((p) => p.type === 'registration');
  return !regPhase || regPhase.status !== 'completed';
}

let ctaState: CtaState;

if (hackathonData.hackathon.status === 'completed') {
  ctaState = { type: 'completed' };
} else if (!session?.user) {
  ctaState = isRegOpen(hackathonData)
    ? { type: 'unauthenticated' }
    : { type: 'registration_closed' };
} else {
  const registration = await getRegistrationByUserAndHackathon(
    session.user.id,
    hackathonData.hackathon.id,
  );

  if (!registration) {
    ctaState = isRegOpen(hackathonData)
      ? { type: 'register', hackathonId: hackathonData.hackathon.id }
      : { type: 'registration_closed' };
  } else {
    const team = await getUserTeamForHackathon(session.user.id, hackathonData.hackathon.id);
    if (!team) {
      ctaState = {
        type: 'find_team',
        teamsUrl: `/hackathons/${hackathonData.hackathon.slug}/teams`,
      };
    } else if (team.adminStatus === 'pending_review') {
      ctaState = { type: 'under_review', teamId: team.id };
    } else if (team.adminStatus === 'approved') {
      ctaState = {
        type: 'my_team',
        teamId: team.id,
        teamUrl: `/hackathons/${hackathonData.hackathon.slug}/teams/${team.id}`,
      };
    } else {
      ctaState = { type: 'team_rejected' };
    }
  }
}
```

Pass `ctaState`, `hackathonSlug`, `hackathonTitle`, `hackathonOrgName`, and `registrationFields` to `LandingHero`.

#### Changes to `landing-hero.tsx`

Add props: `ctaState: CtaState`, `hackathonSlug: string`, `registrationFields: RegistrationField[]`.

Replace the static `<Button>` block with:

```tsx
<RegistrationCta
  ctaState={ctaState}
  hackathonSlug={hackathonSlug}
  hackathonTitle={title}
  registrationFields={registrationFields}
/>
```

`landing-hero.tsx` itself remains a server component (no `'use client'`). The client behavior is entirely inside `RegistrationCta`.

#### New file: `src/app/(public)/hackathons/[slug]/_components/registration-cta.tsx`

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { AuthRegistrationModal } from './auth-registration-modal';
import type { RegistrationField } from '@/db/schema';

// CtaState type defined here (as above)

interface RegistrationCtaProps {
  ctaState: CtaState;
  hackathonSlug: string;
  hackathonTitle: string;
  registrationFields: RegistrationField[];
}

export function RegistrationCta({
  ctaState,
  hackathonSlug,
  hackathonTitle,
  registrationFields,
}: RegistrationCtaProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialMode, setModalInitialMode] = useState<'auth' | 'register'>('auth');

  function openAuth() {
    setModalInitialMode('auth');
    setModalOpen(true);
  }

  function openRegister() {
    setModalInitialMode('register');
    setModalOpen(true);
  }

  return (
    <>
      {ctaState.type === 'unauthenticated' && (
        <Button size="lg" onClick={openAuth} className="font-heading text-base font-semibold">
          Register Now
        </Button>
      )}

      {ctaState.type === 'register' && (
        <Button size="lg" onClick={openRegister} className="font-heading text-base font-semibold">
          Register Now
        </Button>
      )}

      {ctaState.type === 'registration_closed' && (
        <Button size="lg" disabled className="font-heading text-base font-semibold">
          Registration Closed
        </Button>
      )}

      {ctaState.type === 'find_team' && (
        <Button size="lg" asChild className="font-heading text-base font-semibold">
          <Link href={ctaState.teamsUrl}>Find a Team</Link>
        </Button>
      )}

      {ctaState.type === 'under_review' && (
        <Button
          size="lg"
          disabled
          className="font-heading text-base font-semibold border border-amber-500/40 bg-amber-500/15 text-amber-600 hover:bg-amber-500/15 cursor-default"
        >
          Team Under Review
        </Button>
      )}

      {ctaState.type === 'my_team' && (
        <Button size="lg" asChild className="font-heading text-base font-semibold">
          <Link href={ctaState.teamUrl}>My Team</Link>
        </Button>
      )}

      {ctaState.type === 'team_rejected' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="lg"
              disabled
              className="font-heading text-base font-semibold cursor-default opacity-50"
            >
              Team Rejected
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Your team was not approved. Contact the organiser.
          </TooltipContent>
        </Tooltip>
      )}

      {(ctaState.type === 'unauthenticated' ||
        ctaState.type === 'register') && (
        <AuthRegistrationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          hackathonId={ctaState.type === 'register' ? ctaState.hackathonId : ''}
          hackathonSlug={hackathonSlug}
          hackathonTitle={hackathonTitle}
          registrationFields={registrationFields}
          initialMode={modalInitialMode}
        />
      )}
    </>
  );
}
```

**Design decisions:**
- `hackathonId` is only needed for the `'register'` state. For `'unauthenticated'`, the modal starts in auth mode; after sign-in the page refreshes and the CTA re-renders server-side with the updated state. If the user is now authenticated and unregistered, the CTA will be `'register'` and clicking it opens the modal directly in register mode.
- The amber "Under Review" button uses inline className overrides rather than a new Button variant. This avoids adding a one-off variant to the shared UI component for a single use case.
- `<Tooltip>` wraps a disabled button for "team_rejected" — standard HTML `disabled` buttons do not fire mouse events, but wrapping in `TooltipTrigger asChild` with a `<span>` wrapper handles this. If the shadcn Tooltip doesn't show on disabled buttons, wrap with `<span tabIndex={0}>`.

---

### 2.6 Auth Modal (P2.R3)

#### Modify `src/app/(auth)/login/_components/login-form.tsx`

Add optional `onSuccess?: () => void` prop. When provided, call it instead of `router.push()`:

```typescript
interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps = {}) {
  // ...in onSubmit, after successful signIn:
  if (onSuccess) {
    router.refresh(); // refresh session for server components
    onSuccess();
  } else {
    router.push(callbackUrl);
    router.refresh();
  }
}
```

The prop is optional with a default of `{}`, so all existing usages (login page) are unaffected.

#### Modify `src/app/(auth)/signup/_components/signup-form.tsx`

Same pattern — add `onSuccess?: () => void`. Call it after the account is successfully created and verification email sent (not after email verification). The modal transitions to a "check your email" state.

#### New file: `src/app/(public)/hackathons/[slug]/_components/auth-registration-modal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LoginForm } from '@/app/(auth)/login/_components/login-form';
import { SignupForm } from '@/app/(auth)/signup/_components/signup-form';
import { RegistrationForm } from './registration-form';
import type { RegistrationField } from '@/db/schema';

type ModalMode = 'auth' | 'auth_signup_sent' | 'register' | 'success';

interface AuthRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hackathonId: string;
  hackathonSlug: string;
  hackathonTitle: string;
  registrationFields: RegistrationField[];
  initialMode: 'auth' | 'register';
}

export function AuthRegistrationModal({
  open,
  onOpenChange,
  hackathonId,
  hackathonSlug,
  hackathonTitle,
  registrationFields,
  initialMode,
}: AuthRegistrationModalProps) {
  const [mode, setMode] = useState<ModalMode>(initialMode);

  // Reset to initial mode when modal opens
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setMode(initialMode);
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {mode === 'auth' && (
          <>
            <DialogHeader>
              <DialogTitle>Join {hackathonTitle}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="login">
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">Create Account</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="pt-4">
                <LoginForm onSuccess={() => setMode('register')} />
              </TabsContent>
              <TabsContent value="signup" className="pt-4">
                <SignupForm onSuccess={() => setMode('auth_signup_sent')} />
              </TabsContent>
            </Tabs>
          </>
        )}

        {mode === 'auth_signup_sent' && (
          <>
            <DialogHeader>
              <DialogTitle>Check your inbox</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              We've sent you a verification email. Click the link to verify your account, then
              return here and click "Register Now" to complete your registration.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </>
        )}

        {mode === 'register' && (
          <>
            <DialogHeader>
              <DialogTitle>Register for {hackathonTitle}</DialogTitle>
            </DialogHeader>
            <RegistrationForm
              hackathonId={hackathonId}
              fields={registrationFields}
              onSuccess={() => setMode('success')}
            />
          </>
        )}

        {mode === 'success' && (
          <div className="space-y-4 py-2 text-center">
            <CheckCircle2 className="mx-auto size-12 text-green-500" />
            <h3 className="font-heading text-xl font-semibold">You're registered!</h3>
            <p className="text-sm text-muted-foreground">You can now find or create a team.</p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" asChild onClick={() => onOpenChange(false)}>
                <Link href={`/hackathons/${hackathonSlug}/teams`}>Find a Team</Link>
              </Button>
              <Button asChild onClick={() => onOpenChange(false)}>
                <Link href={`/hackathons/${hackathonSlug}/teams/new`}>Create a Team</Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Design decisions:**
- Sign-up in modal → email verification required → two-session flow. On return, the user is logged in and verified; clicking "Register Now" on the landing page now shows the `'register'` CTA state, opening the modal directly in register mode. This is the correct V1 UX — it avoids building a full post-verification redirect chain through the modal.
- `mode` resets to `initialMode` each time the modal opens (`handleOpenChange`). This prevents the success state from persisting when the user closes and reopens the modal.
- "Create a Team" links to `/hackathons/[slug]/teams/new`, which is built in Part 3. The link is safe to include in Part 2 even before Part 3 exists — it's only reachable after successful registration.

---

### 2.7 Registration Form (P2.R4)

#### New file: `src/app/(public)/hackathons/[slug]/_components/registration-form.tsx`

```typescript
'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FormMessage } from '@/components/ui/form';
import type { RegistrationField } from '@/db/schema';

interface RegistrationFormProps {
  hackathonId: string;
  fields: RegistrationField[];
  onSuccess: () => void;
}

export function RegistrationForm({ hackathonId, fields, onSuccess }: RegistrationFormProps) {
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Build Zod schema dynamically from custom fields
  const schema = useMemo(() => {
    const customShape: Record<string, z.ZodTypeAny> = {};
    for (const field of fields) {
      customShape[field.id] = field.required
        ? z.string().min(1, `${field.label} is required`)
        : z.string().optional().default('');
    }
    return z.object({
      designation: z.string().optional().default(''),
      department: z.string().optional().default(''),
      isDiscoverable: z.boolean().default(true),
      ...customShape,
    });
  }, [fields]);

  type FormValues = z.infer<typeof schema>;

  const { control, handleSubmit, register, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { designation: '', department: '', isDiscoverable: true },
  });

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    setServerError(null);

    // Merge designation, department, and custom fields into formData
    const { isDiscoverable, designation, department, ...customValues } = data;
    const formData: Record<string, string> = {};
    if (designation) formData.designation = designation;
    if (department) formData.department = department;
    for (const field of fields) {
      const val = customValues[field.id as keyof typeof customValues];
      if (val) formData[field.id] = val as string;
    }

    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData, isDiscoverable }),
      });

      if (!res.ok) {
        const body = await res.json();
        setServerError(body.message ?? 'Registration failed. Please try again.');
        return;
      }

      onSuccess();
    } catch {
      setServerError('Network error. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && <FormMessage type="error" message={serverError} />}

      {/* Fixed read-only fields */}
      <div className="space-y-1">
        <Label>Full Name</Label>
        <Input value={session?.user?.name ?? ''} readOnly className="opacity-60" />
      </div>
      <div className="space-y-1">
        <Label>Email</Label>
        <Input value={session?.user?.email ?? ''} readOnly className="opacity-60" />
      </div>

      {/* Standard optional fields */}
      <div className="space-y-1">
        <Label htmlFor="designation">Designation</Label>
        <Input id="designation" placeholder="e.g. Software Engineer" {...register('designation')} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="department">Department</Label>
        <Input id="department" placeholder="e.g. Engineering" {...register('department')} />
      </div>

      {/* Custom fields — rendered in order */}
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={field.id}>
            {field.label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>

          {field.fieldType === 'text' && (
            <Input id={field.id} {...register(field.id as keyof FormValues)} />
          )}
          {field.fieldType === 'textarea' && (
            <Textarea id={field.id} {...register(field.id as keyof FormValues)} rows={3} />
          )}
          {field.fieldType === 'dropdown' && (
            <Controller
              control={control}
              name={field.id as keyof FormValues}
              render={({ field: f }) => (
                <Select onValueChange={f.onChange} defaultValue={f.value as string}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options ?? []).map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}

          {errors[field.id as keyof FormValues] && (
            <FormMessage
              type="error"
              message={(errors[field.id as keyof FormValues] as { message?: string })?.message ?? 'Required'}
            />
          )}
        </div>
      ))}

      {/* Discoverability toggle */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Show me on the participants browse page</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Other participants can find and team up with you.
          </p>
        </div>
        <Controller
          control={control}
          name="isDiscoverable"
          render={({ field: f }) => (
            <Switch checked={f.value as boolean} onCheckedChange={f.onChange} />
          )}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Registering...' : 'Register'}
      </Button>
    </form>
  );
}
```

**Design decisions:**
- Zod schema is built dynamically inside `useMemo` from the `fields` prop. This is safe because `fields` is passed from the server and is stable for the lifetime of the component.
- Custom field values are merged into `formData` keyed by `field.id` (UUID). This allows unambiguous retrieval: `formData[field.id]`. The field label is the display name; the ID is the storage key.
- `designation` and `department` are stored in `formData` under string keys `'designation'` and `'department'`, not field IDs. They are standard fields with stable keys. Custom fields use UUIDs as keys.
- The form does not submit on Enter by default (standard HTML form behaviour — only when focus is on a submit button). This prevents accidental submission when filling in text fields.

---

### 2.8 Profile Completion Nudge (P2.R6)

#### New file: `src/app/(public)/hackathons/[slug]/_components/profile-nudge-banner.tsx`

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

interface ProfileNudgeBannerProps {
  hackathonSlug: string;
  formData: Record<string, string> | null;
}

export function ProfileNudgeBanner({ hackathonSlug, formData }: ProfileNudgeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const isMissingProfile = !formData?.designation || !formData?.department;
  if (!isMissingProfile || dismissed) return null;

  return (
    <div className="flex items-start justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-amber-600">
          Complete your hackathon profile
        </p>
        <p className="text-xs text-muted-foreground">
          Adding your designation and department helps team leads find the right fit.{' '}
          <Link
            href={`/hackathons/${hackathonSlug}/register`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Update profile →
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-4 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
```

"Update profile" links back to `/hackathons/[slug]/register` — for Part 2, this can re-open the registration modal or be a dedicated profile update page. The exact destination is refined in Part 3. For Part 2, the link is present but the page is a placeholder.

The nudge is rendered in the My Hackathons card and (Part 3) on the team profile page. It checks session-level dismissal only — no API call needed.

---

### 2.9 "My Hackathons" Page (P2.R8)

#### New file: `src/app/(dashboard)/dashboard/[orgSlug]/my-hackathons/page.tsx`

```typescript
import { auth } from '@/lib/auth/auth';
import { getRegistrationsByUser } from '@/lib/services/registration-service';
import { getStorageProvider } from '@/lib/storage';
import { MyHackathonCard } from './_components/my-hackathon-card';

export default async function MyHackathonsPage() {
  const session = await auth();
  // session is guaranteed non-null by middleware
  const summaries = await getRegistrationsByUser(session!.user.id);
  const storage = getStorageProvider();

  const withUrls = await Promise.all(
    summaries.map(async (s) => ({
      ...s,
      coverImageUrl: s.hackathon.coverImageKey
        ? await storage.getSignedUrl(s.hackathon.coverImageKey)
        : null,
    })),
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">My Hackathons</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hackathons you're registered for.
        </p>
      </div>

      {withUrls.length === 0 ? (
        <p className="text-muted-foreground">
          You haven't registered for any hackathons yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withUrls.map((s) => (
            <MyHackathonCard key={s.registrationId} summary={{ ...s, coverImageUrl: s.coverImageUrl ?? null }} />
          ))}
        </div>
      )}
    </div>
  );
}
```

#### New file: `src/app/(dashboard)/dashboard/[orgSlug]/my-hackathons/_components/my-hackathon-card.tsx`

Client component (needs `Date.now()` for status labels and potential future countdown).

Props: `{ summary: UserHackathonSummary & { coverImageUrl: string | null } }`

Card content:
- Cover image (16:9, `next/image`) or gradient fallback (same CSS tokens as public landing)
- Hackathon title (font-heading) + status badge
- Team status section:
  - `team === null` → muted "No Team" badge + "Find a Team" + "Create a Team" links
  - `team.adminStatus === 'approved'` → team name with member count, link to team page
  - `team.adminStatus === 'pending_review'` → amber "Under Review" badge + explanatory text
  - `team.adminStatus === 'rejected'` → red "Not Approved" badge + "Contact the organiser"
- Profile nudge: if `summary.formData?.designation` or `summary.formData?.department` missing → amber dot + "Complete profile" link

#### New file: `src/app/(dashboard)/dashboard/[orgSlug]/my-hackathons/loading.tsx`

Skeleton grid matching the card layout (same approach as `hackathons/loading.tsx`).

---

### 2.10 Sidebar: "My Hackathons" Link (P2.R9)

Modify `src/app/(dashboard)/_components/app-sidebar.tsx`.

Add a "My Hackathons" nav item in the org-scoped navigation between "Dashboard" and "Hackathons":

```typescript
{
  title: 'My Hackathons',
  href: `/dashboard/${orgSlug}/my-hackathons`,
  icon: CalendarCheck2,
}
```

Import `CalendarCheck2` from `lucide-react`. This link is visible to all authenticated org members (not admin-only).

---

### 2.11 Admin Participant Roster (P2.R10)

Route: `/dashboard/[orgSlug]/hackathons/[hackathonId]/participants`

Admin-only. The sub-nav link from the hackathon management context is built in Part 4 (P4.R3). The page itself is built here.

#### New file: `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/[hackathonId]/participants/page.tsx`

```typescript
import { auth } from '@/lib/auth/auth';
import { requireOrgRole } from '@/lib/auth/require-org-role';
import { getHackathonById } from '@/lib/services/hackathon-service';
import {
  getRegistrationsByHackathon,
  getRegistrationFields,
} from '@/lib/services/registration-service';
import { ParticipantsTable } from './_components/participants-table';

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; hackathonId: string }>;
}) {
  const { orgSlug, hackathonId } = await params;
  const session = await auth();
  // requireOrgRole check
  const hackathon = await getHackathonById(hackathonId);
  if (!hackathon) notFound();

  const [registrations, fields] = await Promise.all([
    getRegistrationsByHackathon(hackathonId),
    getRegistrationFields(hackathonId),
  ]);

  const registeredCount = registrations.length;
  const participatingCount = registrations.filter((r) => r.team !== null).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Participants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hackathon.hackathon.title}
          </p>
        </div>
        <a
          href={`/api/hackathons/${hackathonId}/registrations/export`}
          download
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          Export CSV
        </a>
      </div>

      {/* Distinct registration vs participation counts — PRD Key Decision #2 */}
      <div className="flex gap-4">
        <div className="rounded-lg border px-4 py-3">
          <p className="text-2xl font-semibold">{registeredCount}</p>
          <p className="text-sm text-muted-foreground">Registered</p>
        </div>
        <div className="rounded-lg border px-4 py-3">
          <p className="text-2xl font-semibold">{participatingCount}</p>
          <p className="text-sm text-muted-foreground">Participating</p>
        </div>
      </div>

      <ParticipantsTable
        registrations={registrations}
        fields={fields}
        orgSlug={orgSlug}
        hackathonId={hackathonId}
      />
    </div>
  );
}
```

#### New file: `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/[hackathonId]/participants/_components/participants-table.tsx`

Client component with local filter/search state.

```typescript
'use client';

interface ParticipantsTableProps {
  registrations: RegistrationWithUser[];
  fields: RegistrationField[];
  orgSlug: string;
  hackathonId: string;
}
```

Filters (all client-side — no API calls):
- Search input: filters on `r.user.name` and `r.user.email` (case-insensitive)
- "Has Team" / "No Team" / "All" pill selector
- Track pill selector — unique track names extracted from registrations

Table columns: Name, Email, Registered (date), Team (linked team name or "—"), Track (or "—"), Discoverable (green/muted badge), plus one column per `field` in `fields` (show `r.formData?.[field.id] ?? '—'`).

Empty state: "No participants yet."

#### New file: `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/[hackathonId]/participants/loading.tsx`

Table skeleton.

**Design decisions:**
- "Export CSV" uses a plain `<a href="..." download>` — no client-side fetch or blob needed. The `/registrations/export` route returns `Content-Disposition: attachment` which triggers the browser download directly.
- The two counts ("Registered" and "Participating") are explicitly rendered as separate stat chips, never combined. This implements PRD Key Decision #2.
- All filtering is client-side. At V1 participant counts (hundreds), this is fine. Avoid a round-trip API call for filter changes — it would make the UX feel slow.

---

### 2.12 Files Changed Summary

| File | Action | Reason |
|------|--------|--------|
| `src/components/ui/switch.tsx` | Created (shadcn) | Boolean toggles (requires_approval, isDiscoverable) |
| `src/components/ui/textarea.tsx` | Created (shadcn) | Textarea field type in registration form |
| `src/lib/services/registration-service.ts` | Modified | Add `getRegistrationsByUser`, `updateRegistration` |
| `src/lib/services/hackathon-service.ts` | Modified | Add optional `registrationFields` to `HackathonWithRelations`; load in `getHackathonById` |
| `src/lib/validations/registration.ts` | Modified | Add `updateRegistrationSchema` |
| `src/app/api/hackathons/[hackathonId]/register/route.ts` | Created | POST create registration |
| `src/app/api/hackathons/[hackathonId]/registration/route.ts` | Created | GET own status, PATCH update |
| `src/app/api/hackathons/[hackathonId]/registration-fields/route.ts` | Created | GET (public), POST upsert (admin) |
| `src/app/api/hackathons/[hackathonId]/registrations/route.ts` | Created | GET roster (admin) |
| `src/app/api/hackathons/[hackathonId]/registrations/export/route.ts` | Created | GET CSV (admin) |
| `src/app/api/user/hackathons/route.ts` | Created | GET user's hackathon list |
| `src/app/(auth)/login/_components/login-form.tsx` | Modified | Add optional `onSuccess?` prop |
| `src/app/(auth)/signup/_components/signup-form.tsx` | Modified | Add optional `onSuccess?` prop |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/wizard-shell.tsx` | Modified | Insert Step 6, renumber 7–9, update all step logic |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/create/_components/step-participation.tsx` | Created | Step 6: requires_approval toggle + custom fields |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/[hackathonId]/edit/page.tsx` | Modified | Load and pass `registrationFields` to wizard in edit mode |
| `src/app/(public)/hackathons/[slug]/page.tsx` | Modified | Server-side CTA state + registrationFields fetch |
| `src/app/(public)/hackathons/[slug]/_components/landing-hero.tsx` | Modified | Add `ctaState` + `registrationFields` props, render `RegistrationCta` |
| `src/app/(public)/hackathons/[slug]/_components/registration-cta.tsx` | Created | State-aware CTA button + modal host |
| `src/app/(public)/hackathons/[slug]/_components/auth-registration-modal.tsx` | Created | Dialog: auth → register → success |
| `src/app/(public)/hackathons/[slug]/_components/registration-form.tsx` | Created | Dynamic registration form |
| `src/app/(public)/hackathons/[slug]/_components/profile-nudge-banner.tsx` | Created | Dismissible profile nudge |
| `src/app/(dashboard)/_components/app-sidebar.tsx` | Modified | Add "My Hackathons" nav link |
| `src/app/(dashboard)/dashboard/[orgSlug]/my-hackathons/page.tsx` | Created | My Hackathons page |
| `src/app/(dashboard)/dashboard/[orgSlug]/my-hackathons/loading.tsx` | Created | Skeleton |
| `src/app/(dashboard)/dashboard/[orgSlug]/my-hackathons/_components/my-hackathon-card.tsx` | Created | Hackathon card with team state |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/[hackathonId]/participants/page.tsx` | Created | Admin participant roster |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/[hackathonId]/participants/loading.tsx` | Created | Skeleton |
| `src/app/(dashboard)/dashboard/[orgSlug]/hackathons/[hackathonId]/participants/_components/participants-table.tsx` | Created | Filterable participant table |

---

### 2.13 Implementation Increments

**Increment 1: API Routes + Service Methods**

Backend-first. No UI. All data layer additions before any components.

1. Add `getRegistrationsByUser` and `updateRegistration` to `registration-service.ts`
2. Add `updateRegistrationSchema` to `validations/registration.ts`
3. Add optional `registrationFields` to `HackathonWithRelations` in `hackathon-service.ts`; load in `getHackathonById`
4. Create all 6 API route files: `register`, `registration`, `registration-fields`, `registrations`, `registrations/export`, `user/hackathons`
5. `npx tsc --noEmit`

**Verify:** All routes compile. Test `POST /register` returns 201 on valid input, 409 on duplicate, 403 on closed registration. Test `GET /registration-fields` returns empty array for hackathon with no fields. `tsc` passes cleanly.

---

**Increment 2: Wizard Step 6 — Participation Settings**

1. `npx shadcn@latest add switch textarea`
2. Create `step-participation.tsx`
3. Modify `wizard-shell.tsx` — follow section 2.4 changes precisely: STEPS, state, `getFurthestStep`, `handleNext`, footer condition, no-next-button list, `getStepStatus`, `renderStepContent`, `visitedSteps` init
4. Modify `edit/page.tsx` to load registration fields and pass to wizard
5. `npx next build`

**Verify:** Create wizard flows through 9 steps. Step 6 (Participation) sits between Team Rules and Prizes. Enabling requires_approval toggle and adding fields → saves to DB → edit mode re-loads them. Review step is now Step 9.

---

**Increment 3: Registration Flow (CTA + Modal + Form)**

1. Modify `login-form.tsx` — add `onSuccess?` prop
2. Modify `signup-form.tsx` — add `onSuccess?` prop
3. Create `registration-cta.tsx`
4. Create `auth-registration-modal.tsx`
5. Create `registration-form.tsx`
6. Create `profile-nudge-banner.tsx`
7. Modify `landing-hero.tsx` — add props, render `RegistrationCta`
8. Modify `landing page.tsx` — add CTA state computation
9. `npx tsc --noEmit`

**Verify:** On a `published` hackathon:
- Unauthenticated → "Register Now" → auth modal → sign in → registration form → submit → success state
- Logged-in unregistered → "Register Now" → registration form directly
- Logged-in registered no team → "Find a Team" button
- Existing `login/page.tsx` still works (no regression from `onSuccess?` prop)
- Custom fields configured in wizard Step 6 appear in the registration form

---

**Increment 4: My Hackathons + Sidebar + Admin Roster**

1. Modify `app-sidebar.tsx` — add "My Hackathons" link with `CalendarCheck2` icon
2. Create `my-hackathons/page.tsx` + `loading.tsx` + `my-hackathon-card.tsx`
3. Create `participants/page.tsx` + `loading.tsx` + `participants-table.tsx`
4. `npx tsc --noEmit`

**Verify:**
- "My Hackathons" appears in the dashboard sidebar for all authenticated users
- `/dashboard/[orgSlug]/my-hackathons` shows registrations with correct team states (approved, under review, rejected, no team)
- `/dashboard/[orgSlug]/hackathons/[hackathonId]/participants` loads the roster with "Registered" and "Participating" as distinct counts
- Search and filters work client-side without page reload
- "Export CSV" downloads a valid CSV file

---

*Part 2 complete when all 4 increments pass and `npx next build` has zero errors.*

---

## Part 3: Team Formation

**PRD Requirements Covered:** P3.R1 through P3.R20

---

### 3.1 Dependencies (New for Part 3)

Add one shadcn/ui component:

```bash
npx shadcn@latest add alert
```

- **alert** — used in team profile to surface admin status messages (under review / rejected)

No new npm packages required. All service functions were built in Part 1.

---

### 3.2 New Service Methods

Add three methods to `src/lib/services/team-service.ts`.

---

**`getTeamWithMembers`** — single-query team fetch for the profile page:

```typescript
export interface TeamMemberDetail {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string; // 'lead' | 'member'
  joinedAt: Date;
}

export interface TeamWithMembers {
  id: string;
  hackathonId: string;
  name: string;
  description: string | null;
  inviteCode: string;
  isOpen: boolean;
  trackId: string | null;
  trackName: string | null;
  adminStatus: string;
  reviewReason: string | null;
  createdBy: string;
  memberCount: number;
  members: TeamMemberDetail[];
}

export async function getTeamWithMembers(teamId: string): Promise<TeamWithMembers | null> {
  const [row] = await db
    .select({ team: teams, trackName: tracks.name })
    .from(teams)
    .leftJoin(tracks, eq(tracks.id, teams.trackId))
    .where(and(eq(teams.id, teamId), isNull(teams.deletedAt)))
    .limit(1);

  if (!row) return null;

  const members = await db
    .select({
      userId: teamMembers.userId,
      name: users.name,
      avatarUrl: users.avatarUrl,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(teamMembers.joinedAt));

  return {
    id: row.team.id,
    hackathonId: row.team.hackathonId,
    name: row.team.name,
    description: row.team.description,
    inviteCode: row.team.inviteCode,
    isOpen: row.team.isOpen,
    trackId: row.team.trackId,
    trackName: row.trackName ?? null,
    adminStatus: row.team.adminStatus,
    reviewReason: row.team.reviewReason,
    createdBy: row.team.createdBy,
    memberCount: members.length,
    members,
  };
}
```

---

**`getJoinRequestsForTeam`** — pending requests with user details for the lead view:

```typescript
export interface JoinRequestWithUser {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  message: string | null;
  entryPoint: string;
  requestedAt: Date;
}

export async function getJoinRequestsForTeam(teamId: string): Promise<JoinRequestWithUser[]> {
  return db
    .select({
      id: teamJoinRequests.id,
      userId: teamJoinRequests.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
      message: teamJoinRequests.message,
      entryPoint: teamJoinRequests.entryPoint,
      requestedAt: teamJoinRequests.requestedAt,
    })
    .from(teamJoinRequests)
    .innerJoin(users, eq(users.id, teamJoinRequests.userId))
    .where(
      and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.status, 'pending'),
      ),
    )
    .orderBy(asc(teamJoinRequests.requestedAt));
}
```

---

**`getTeamInviteByToken`** — read-only lookup for the invite acceptance page (does not consume the token):

```typescript
export async function getTeamInviteByToken(token: string): Promise<{
  id: string;
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  teamName: string;
  hackathonTitle: string;
  hackathonSlug: string;
} | null> {
  const [row] = await db
    .select({
      id: teamInvites.id,
      email: teamInvites.email,
      expiresAt: teamInvites.expiresAt,
      acceptedAt: teamInvites.acceptedAt,
      teamName: teams.name,
      hackathonTitle: hackathons.title,
      hackathonSlug: hackathons.slug,
    })
    .from(teamInvites)
    .innerJoin(teams, eq(teams.id, teamInvites.teamId))
    .innerJoin(hackathons, eq(hackathons.id, teams.hackathonId))
    .where(eq(teamInvites.token, token))
    .limit(1);

  return row ?? null;
}
```

---

### 3.3 API Routes

16 new routes. Pattern: participant routes use `requireVerifiedUser`. Lead-only routes additionally verify the viewer's `team_members.role = 'lead'`. Public routes (team browse, invite-code lookup) need no auth.

---

#### `POST /api/hackathons/[hackathonId]/teams`

Create a new team.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` |
| **Body** | `createTeamSchema`: `{ name, description?, trackId?, isOpen? }` |
| **Success** | `201 { team: { id, name, hackathonId, adminStatus, inviteCode } }` |
| **Errors** | 400 validation · 403 not registered or already on a team · 404 hackathon not found |

Implementation:
- Call `getRegistrationByUserAndHackathon` — if null → 403 "You must register before creating a team."
- Call `getUserTeamForHackathon` — if found → 403 "You are already on a team for this hackathon."
- Parse body with `createTeamSchema`.
- Call `createTeam(hackathonId, user.id, data)` — service sets `adminStatus` per `requiresApproval`.
- Return 201.

---

#### `GET /api/hackathons/[hackathonId]/teams`

List open, non-full, approved teams for public browse.

| | |
|---|---|
| **Auth** | None |
| **Query** | `?trackId=[id]` optional |
| **Success** | `200 { teams: TeamBrowseItem[] }` |

Implementation:
- Call `getTeamsByHackathon(hackathonId, { isOpen: true, adminStatus: 'approved' })`.
- If `trackId` query param present, pass in filters.
- Fetch hackathon `teamMaxSize`; filter out full teams (`memberCount >= teamMaxSize`).
- Return teams array (each item already includes `memberCount` and `maxSize` from service).

---

#### `GET /api/hackathons/[hackathonId]/teams/[teamId]`

Fetch team details for the profile page.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` |
| **Success** | `200 { team: TeamWithMembers, hackathon: { title, slug, requiresApproval, teamMaxSize } }` |
| **Errors** | 401 not authed · 404 not found or soft-deleted |

Implementation:
- Call `getTeamWithMembers(teamId)` — null → 404.
- Fetch hackathon for context fields.
- Strip `inviteCode` from response if `user.id` not in `team.members`.

---

#### `PATCH /api/hackathons/[hackathonId]/teams/[teamId]`

Update team profile. Lead only.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` + viewer is lead |
| **Body** | `updateTeamSchema`: `{ name?, description?, trackId?, isOpen? }` |
| **Success** | `200 { team }` |
| **Errors** | 400 validation · 403 not lead · 404 not found |

Implementation:
- Fetch team members, verify `user.id` has `role = 'lead'` → else 403.
- Call `updateTeam(teamId, data)` — service handles re-approval if `requiresApproval`.

---

#### `POST /api/hackathons/[hackathonId]/teams/[teamId]/join-request`

Send a join request.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` |
| **Body** | `joinRequestSchema`: `{ message?, entryPoint: 'browse' \| 'link' \| 'participant_browse' }` |
| **Success** | `201 { request: { id, status } }` |
| **Errors** | 400 team closed or full · 403 already on a team · 409 pending request already exists |

Implementation:
- Fetch team; check `isOpen` → 400 if closed. Check `memberCount` vs hackathon `teamMaxSize` → 400 if full.
- Check for existing pending request from `user.id` on this team → 409.
- Call `createJoinRequest(teamId, user.id, message ?? null, entryPoint)`.

---

#### `GET /api/hackathons/[hackathonId]/teams/[teamId]/join-requests`

List pending join requests. Lead only.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` + viewer is lead |
| **Success** | `200 { requests: JoinRequestWithUser[] }` |

Implementation:
- Verify lead role.
- Call `getJoinRequestsForTeam(teamId)`.

---

#### `PATCH /api/hackathons/[hackathonId]/teams/[teamId]/join-requests/[requestId]`

Approve or reject a join request. Lead only.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` + viewer is lead |
| **Body** | `respondToJoinRequestSchema`: `{ status: 'accepted' \| 'rejected' }` |
| **Success** | `200 { request }` |
| **Errors** | 400 team full on accept · 403 not lead · 404 request not found or not pending |

Implementation:
- Verify lead role.
- Fetch hackathon `teamMaxSize`.
- Call `respondToJoinRequest(requestId, status, teamMaxSize)` — service runs `addMember`, `autoRegister`, re-approval trigger, auto-reject of remaining requests if now full.

---

#### `POST /api/hackathons/[hackathonId]/teams/[teamId]/invite`

Invite a user by email. Lead only.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` + viewer is lead |
| **Body** | `inviteByEmailSchema`: `{ email }` |
| **Success** | `200 { message: 'Invite sent' }` |
| **Errors** | 400 team full · 403 not lead |

Implementation:
- Verify lead role. Check team size.
- Call `inviteMemberByEmail(teamId, user.id, email)` — service handles existing vs new user paths.

---

#### `POST /api/hackathons/[hackathonId]/teams/[teamId]/leave`

Leave a team.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` |
| **Body** | `{}` (empty) |
| **Success** | `200 { message: 'Left team' }` |
| **Errors** | 403 not a member · 404 team not found |

Implementation:
- Verify `user.id` is in `team_members` for this team → else 403.
- Call `removeMember(teamId, user.id)` — service handles auto-transfer and dissolve-if-last.

---

#### `POST /api/hackathons/[hackathonId]/teams/[teamId]/transfer-lead`

Transfer leadership to another member. Lead only.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` + viewer is lead |
| **Body** | `transferLeadSchema`: `{ toUserId }` |
| **Success** | `200 { message: 'Leadership transferred' }` |
| **Errors** | 400 `toUserId` not a member · 403 not lead |

Implementation:
- Verify lead role. Verify `toUserId` is a member of the team.
- Call `transferLeadership(teamId, user.id, toUserId)`.

---

#### `GET /api/teams/by-invite-code/[inviteCode]`

Look up a team by its invite code. Public — used by the join link page to show team info before auth.

| | |
|---|---|
| **Auth** | None |
| **Success** | `200 { team: { id, name, hackathonId, hackathonSlug, hackathonTitle, isOpen, memberCount, teamMaxSize } }` |
| **Errors** | 404 not found or soft-deleted |

Implementation:
- Call `getTeamByInviteCode(inviteCode)` → null → 404.
- Fetch hackathon `{ id, slug, title, teamMaxSize }`.
- Return merged object. Do NOT include `inviteCode` in the response.

---

#### `POST /api/team-invites/accept`

Accept a team invite by token.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` |
| **Body** | `{ token: string }` |
| **Success** | `200 { teamId, hackathonSlug }` |
| **Errors** | 400 already accepted · 403 already on a team in this hackathon · 404 token not found · 410 expired |

Implementation:
- Call `acceptTeamInvite(token)` — service handles expiry check, already-accepted, `addMember`, `autoRegister`.
- On success, fetch hackathon slug from the returned team for client-side redirect.
- Map named service errors to HTTP codes: `TOKEN_NOT_FOUND` → 404, `TOKEN_EXPIRED` → 410, `ALREADY_ACCEPTED` → 400, `ALREADY_IN_TEAM` → 403.

---

#### `GET /api/hackathons/[hackathonId]/participants`

List discoverable, unteamed, registered participants.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` |
| **Query** | `?search=[name]` optional, case-insensitive |
| **Success** | `200 { participants: DiscoverableParticipant[] }` |

Implementation:
- Call `getDiscoverableParticipants(hackathonId)`.
- If `search` param provided, filter in JS: `p.user.name.toLowerCase().includes(search.toLowerCase())`.
- Exclude the requesting user from results (`p.userId !== user.id`).

---

#### `POST /api/hackathons/[hackathonId]/team-up`

Create a team-up request.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` |
| **Body** | `createTeamUpRequestSchema`: `{ toUserId, proposedTeamName, message? }` |
| **Success** | `201 { request }` |
| **Errors** | 400 recipient not registered/unteamed/discoverable · 403 requester not registered or on a team · 409 pending request already exists |

Implementation:
- Call `createTeamUpRequest(hackathonId, user.id, toUserId, proposedTeamName, message)`.
- Map named service errors to HTTP status codes.

---

#### `GET /api/hackathons/[hackathonId]/team-up-requests`

Get incoming pending team-up requests for the current user.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` |
| **Success** | `200 { requests: TeamUpRequestWithUser[] }` |

Implementation:
- Call `getTeamUpRequestsForUser(user.id, hackathonId)` — returns pending incoming requests with `fromUser` details.

---

#### `PATCH /api/hackathons/[hackathonId]/team-up-requests/[requestId]`

Accept or decline a team-up request. Recipient only.

| | |
|---|---|
| **Auth** | `requireVerifiedUser` + viewer is `toUserId` |
| **Body** | `respondToTeamUpRequestSchema`: `{ status: 'accepted' \| 'rejected' }` |
| **Success** | `200 { request }` |
| **Errors** | 400 either user now on a team (re-validation at accept time) · 403 not the recipient · 404 not found or not pending |

Implementation:
- Fetch request; verify `request.toUserId === user.id` → else 403.
- Call `respondToTeamUpRequest(requestId, status)` — on accept: creates team with requester as lead, adds recipient as member.
- On accept success, return team ID in response for client-side redirect.

---

### 3.4 Team Browse Page + Create Team Flow

#### New file: `src/app/(public)/hackathons/[slug]/teams/page.tsx`

Server component. Publicly accessible.

```typescript
export default async function TeamBrowsePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getHackathonBySlug(slug);
  if (!data || !['published', 'active'].includes(data.hackathon.status)) notFound();

  const { hackathon, tracks } = data;
  const session = await auth();

  let registration = null;
  let userTeam = null;
  if (session?.user?.id) {
    registration = await getRegistrationByUserAndHackathon(session.user.id, hackathon.id);
    if (registration) userTeam = await getUserTeamForHackathon(session.user.id, hackathon.id);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">{hackathon.title}</p>
        </div>
        {registration && !userTeam && (
          <CreateTeamButton hackathonId={hackathon.id} hackathonSlug={slug} tracks={tracks} />
        )}
      </div>
      <TeamBrowseClient
        hackathonId={hackathon.id}
        hackathonSlug={slug}
        tracks={tracks}
        isAuthenticated={!!session?.user?.id}
        isRegistered={!!registration}
        hasTeam={!!userTeam}
      />
    </div>
  );
}
```

`CreateTeamButton` is a client component that holds modal open state and renders `<CreateTeamModal>`.

---

#### New file: `src/app/(public)/hackathons/[slug]/teams/_components/team-browse-client.tsx`

Client component.

```typescript
interface TeamBrowseClientProps {
  hackathonId: string;
  hackathonSlug: string;
  tracks: { id: string; name: string }[];
  isAuthenticated: boolean;
  isRegistered: boolean;
  hasTeam: boolean;
}
```

Behavior:
- On mount: fetch `GET /api/hackathons/[hackathonId]/teams` → render `TeamBrowseCard` grid.
- Track pill selector: refetch with `?trackId=[id]`. "All Tracks" clears filter.
- Loading: card skeleton grid (3 columns).
- Empty state: "No open teams yet."

---

#### New file: `src/app/(public)/hackathons/[slug]/teams/_components/team-browse-card.tsx`

Client component.

```typescript
interface TeamBrowseCardProps {
  team: TeamBrowseItem;
  hackathonSlug: string;
  hackathonId: string;
  isAuthenticated: boolean;
  isRegistered: boolean;
  hasTeam: boolean;
}
```

Card layout:
- Team name (link to `/hackathons/[slug]/teams/[teamId]`), description snippet (2-line truncate)
- Track badge + Open badge
- Member count: "X / Y members"
- CTA button (one of):
  - Not authenticated → "Sign in to Join" → `/login?callbackUrl=/hackathons/[slug]/teams`
  - Authenticated + not registered → "Register to Join" → `/hackathons/[slug]`
  - Registered + no team + team open + not full → "Request to Join" → opens `JoinRequestDialog`
  - Registered + has team → "Already on a Team" (disabled)
  - Full (`memberCount >= maxSize`) → "Team Full" (disabled)
  - Closed (`isOpen = false`) → "Team Closed" (disabled)

---

#### New file: `src/app/(public)/hackathons/[slug]/teams/_components/create-team-modal.tsx`

Client component. Dialog for creating a team.

```typescript
interface CreateTeamModalProps {
  hackathonId: string;
  hackathonSlug: string;
  tracks: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

Form (via `createTeamSchema`):
- Team Name — required text input
- Description — optional textarea
- Track — Select with "No track" default + hackathon tracks
- Open to new members — Switch, default ON

On submit: `POST /api/hackathons/[hackathonId]/teams` → on success: `router.push('/hackathons/[slug]/teams/[newTeamId]')`.

---

#### New file: `src/app/(public)/hackathons/[slug]/teams/_components/join-request-dialog.tsx`

Client component. Submits a join request.

```typescript
interface JoinRequestDialogProps {
  teamId: string;
  teamName: string;
  hackathonId: string;
  entryPoint: 'browse' | 'link';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
```

Form: optional message textarea.

On submit: `POST /api/hackathons/[hackathonId]/teams/[teamId]/join-request`.

Success: "Request sent! The team lead will review your request." toast + close. Parent hides the CTA.

---

### 3.5 Team Profile Page

#### New file: `src/app/(public)/hackathons/[slug]/teams/[teamId]/page.tsx`

Server component. Requires authentication — redirect to login if session missing.

```typescript
export default async function TeamProfilePage({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>;
}) {
  const { slug, teamId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/hackathons/${slug}/teams/${teamId}`);
  }

  const userId = session.user.id;
  const [teamData, hackathonData] = await Promise.all([
    getTeamWithMembers(teamId),
    getHackathonBySlug(slug),
  ]);

  if (!teamData || !hackathonData) notFound();
  const { hackathon } = hackathonData;

  const viewerMember = teamData.members.find((m) => m.userId === userId);
  const viewerRole = viewerMember?.role ?? null; // 'lead' | 'member' | null

  const [registration, userTeam] = await Promise.all([
    getRegistrationByUserAndHackathon(userId, hackathon.id),
    getUserTeamForHackathon(userId, hackathon.id),
  ]);

  const isOnDifferentTeam = !viewerMember && userTeam !== null;

  let joinRequests: JoinRequestWithUser[] = [];
  if (viewerRole === 'lead') {
    joinRequests = await getJoinRequestsForTeam(teamId);
  }

  return (
    <TeamProfileClient
      team={teamData}
      hackathon={{
        id: hackathon.id,
        slug,
        title: hackathon.title,
        requiresApproval: hackathon.requiresApproval,
        teamMaxSize: hackathon.teamMaxSize,
      }}
      viewerUserId={userId}
      viewerRole={viewerRole}
      isRegistered={!!registration}
      isOnDifferentTeam={isOnDifferentTeam}
      initialJoinRequests={joinRequests}
    />
  );
}
```

---

#### New file: `src/app/(public)/hackathons/[slug]/teams/[teamId]/_components/team-profile-client.tsx`

Client component. Contains all interactive sections.

```typescript
interface TeamProfileClientProps {
  team: TeamWithMembers;
  hackathon: { id: string; slug: string; title: string; requiresApproval: boolean; teamMaxSize: number };
  viewerUserId: string;
  viewerRole: 'lead' | 'member' | null;
  isRegistered: boolean;
  isOnDifferentTeam: boolean;
  initialJoinRequests: JoinRequestWithUser[];
}
```

Rendered sections (in order):

**Header:**
- Team name (font-heading, 3xl), link back to `/hackathons/[slug]/teams`
- Track badge, Open/Closed badge, "X/Y members" badge
- Admin status badge — only when `hackathon.requiresApproval`: amber "Under Review" / green "Approved" / red "Not Approved"

**Status alert** (when `hackathon.requiresApproval`):
- `pending_review` → amber Alert: "Your team is under review. You'll be notified once approved."
- `rejected` → destructive Alert: "Your team was not approved. Contact the organiser."

**Description:** `team.description` text (if set).

**Members list:**
Each row: initials avatar, name, role badge ("Lead" / "Member"), joined date.
Lead row: "Transfer Lead" button (lead only) → opens `TransferLeadDialog`.

**Actions bar:**
- Lead: "Edit Team" → `EditTeamDialog` | "Invite by Email" → `InviteByEmailDialog` | "Browse Participants" link
- Member: "Leave Team" → confirm dialog → `POST .../leave` → `router.push('/hackathons/[slug]')`
- Non-member + registered + not on a team + team open + not full: "Request to Join" → `JoinRequestDialog` with `entryPoint='browse'`
- Non-member + registered + on a different team: "Already on a Team" (disabled)
- Non-member + not registered: "Register to Join" → `/hackathons/[slug]`
- Non-member + team full: "Team Full" (disabled)
- Non-member + team closed: "Team Closed" (disabled)

**Join link** (team members only — `viewerRole !== null`):
- Copyable input: `[NEXT_PUBLIC_APP_URL]/hackathons/[slug]/teams/join?code=[inviteCode]`
- Copy button with clipboard feedback

**Join Requests** (lead only):
- Section rendered when `viewerRole === 'lead'`
- Uses `initialJoinRequests`; refreshed after approve/reject via local state update
- Each row: avatar, name, optional message, entry point label ("Browsed" / "Via Link" / "Via Participants"), Approve + Reject buttons
- Approve: `PATCH .../join-requests/[requestId]` `{ status: 'accepted' }` → remove from list, trigger member list refresh
- Reject: `PATCH .../join-requests/[requestId]` `{ status: 'rejected' }` → remove from list

**Incoming Team-Up Requests** (`viewerRole === null && isRegistered && !isOnDifferentTeam`):
- Fetched on mount from `GET /api/hackathons/[hackathonId]/team-up-requests`
- Each row: requester name, proposed team name, message, Accept + Decline
- Accept: `PATCH .../team-up-requests/[requestId]` `{ status: 'accepted' }` → redirect to new team page
- Decline: `PATCH .../team-up-requests/[requestId]` `{ status: 'rejected' }` → remove from list

---

#### New file: `src/app/(public)/hackathons/[slug]/teams/[teamId]/_components/edit-team-dialog.tsx`

Client component. Lead only.

Form: Name, Description (textarea), Track (Select), Open to Join (Switch).

On submit: `PATCH /api/hackathons/[hackathonId]/teams/[teamId]` → `router.refresh()` + close.

If `hackathon.requiresApproval` and save succeeds, show toast: "Your changes have been submitted for review."

---

#### New file: `src/app/(public)/hackathons/[slug]/teams/[teamId]/_components/invite-by-email-dialog.tsx`

Client component. Lead only.

Form: email input.

On submit: `POST /api/hackathons/[hackathonId]/teams/[teamId]/invite` → "Invite sent!" toast + close.

---

#### New file: `src/app/(public)/hackathons/[slug]/teams/[teamId]/_components/transfer-lead-dialog.tsx`

Client component. Lead only.

Form: Select from members list (excluding current lead).

On confirm: `POST /api/hackathons/[hackathonId]/teams/[teamId]/transfer-lead` `{ toUserId }` → `router.refresh()` + close.

---

### 3.6 Join Link Page

#### New file: `src/app/(public)/hackathons/[slug]/teams/join/page.tsx`

Server component. Handles `/hackathons/[slug]/teams/join?code=[inviteCode]`.

```typescript
export default async function JoinLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { slug } = await params;
  const { code } = await searchParams;
  if (!code) notFound();

  const teamData = await getTeamByInviteCode(code);
  if (!teamData) notFound();

  const hackathonData = await getHackathonBySlug(slug);
  if (!hackathonData) notFound();

  const session = await auth();

  return (
    <JoinLinkClient
      code={code}
      team={{ id: teamData.id, name: teamData.name, hackathonId: teamData.hackathonId,
              memberCount: teamData.memberCount, maxSize: hackathonData.hackathon.teamMaxSize,
              isOpen: teamData.isOpen }}
      hackathonSlug={slug}
      hackathonTitle={hackathonData.hackathon.title}
      isAuthenticated={!!session?.user?.id}
    />
  );
}
```

---

#### New file: `src/app/(public)/hackathons/[slug]/teams/join/_components/join-link-client.tsx`

Client component.

```typescript
interface JoinLinkClientProps {
  code: string;
  team: { id: string; name: string; hackathonId: string; memberCount: number; maxSize: number; isOpen: boolean };
  hackathonSlug: string;
  hackathonTitle: string;
  isAuthenticated: boolean;
}
```

Layout: centered card with team name + hackathon context.

States:
- `!team.isOpen` → "This team is no longer accepting members." No CTA.
- `team.memberCount >= team.maxSize` → "This team is full." No CTA.
- `isAuthenticated` → "Request to Join" button → `POST /api/hackathons/[hackathonId]/teams/[teamId]/join-request` with `{ entryPoint: 'link' }` → success: "Request sent! The team lead will review your request."
- Not authenticated → "Sign in to request to join" + login button (`/login?callbackUrl=/hackathons/[slug]/teams/join?code=[code]`)

---

### 3.7 Participants Browse Page

#### New file: `src/app/(public)/hackathons/[slug]/participants/page.tsx`

Server component. Requires authentication.

```typescript
export default async function ParticipantsBrowsePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/hackathons/${slug}/participants`);
  }

  const data = await getHackathonBySlug(slug);
  if (!data) notFound();
  const { hackathon } = data;

  const userId = session.user.id;
  const [registration, userTeam] = await Promise.all([
    getRegistrationByUserAndHackathon(userId, hackathon.id),
    getUserTeamForHackathon(userId, hackathon.id),
  ]);

  // Determine viewer's role within their team (for "Invite to Team" CTA)
  let viewerRole: 'lead' | 'member' | null = null;
  if (userTeam) {
    const members = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, userTeam.id), eq(teamMembers.userId, userId)))
      .limit(1);
    viewerRole = (members[0]?.role as 'lead' | 'member') ?? null;
  }

  return (
    <ParticipantsBrowseClient
      hackathonId={hackathon.id}
      hackathonSlug={slug}
      hackathonTitle={hackathon.title}
      viewerUserId={userId}
      isRegistered={!!registration}
      hasTeam={!!userTeam}
      viewerRole={viewerRole}
      viewerTeamId={userTeam?.id ?? null}
    />
  );
}
```

**Design note:** the direct `db` query for viewer's role is intentional — `getUserTeamForHackathon` returns team-level data but not the member's role. Inlining one extra query here is simpler than adding a new service method for V1.

---

#### New file: `src/app/(public)/hackathons/[slug]/participants/_components/participants-browse-client.tsx`

Client component.

```typescript
interface ParticipantsBrowseClientProps {
  hackathonId: string;
  hackathonSlug: string;
  hackathonTitle: string;
  viewerUserId: string;
  isRegistered: boolean;
  hasTeam: boolean;
  viewerRole: 'lead' | 'member' | null;
  viewerTeamId: string | null;
}
```

Behavior:
- On mount: `GET /api/hackathons/[hackathonId]/participants` → render participant cards.
- Search input: client-side filter on `participant.user.name`.
- Participants filtered to exclude `viewerUserId` (server already does this, but double-check client-side).
- Empty state: "No participants available to team up with right now."
- Loading: card skeleton grid.

---

#### New file: `src/app/(public)/hackathons/[slug]/participants/_components/participant-card.tsx`

Client component.

```typescript
interface ParticipantCardProps {
  participant: DiscoverableParticipant;
  hackathonId: string;
  hackathonSlug: string;
  viewerIsRegisteredUnteamed: boolean;  // isRegistered && !hasTeam
  viewerIsLead: boolean;               // viewerRole === 'lead'
  viewerTeamId: string | null;
}
```

Card layout:
- Initials avatar, name, designation + department (from `formData`, if set), registered date.
- Actions (one of):
  - `viewerIsRegisteredUnteamed` → "Team Up" button → opens `TeamUpDialog`
  - `viewerIsLead` → "Invite to Team" button → `POST /api/hackathons/[hackathonId]/teams/[viewerTeamId]/invite` with `{ email: participant.user.email }` → "Invited!" success state
  - Otherwise: no action button (view only)

---

#### New file: `src/app/(public)/hackathons/[slug]/participants/_components/team-up-dialog.tsx`

Client component.

```typescript
interface TeamUpDialogProps {
  toUserId: string;
  toUserName: string;
  hackathonId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
```

Form:
- Proposed Team Name (required, default "My Team")
- Optional message (textarea)

On submit: `POST /api/hackathons/[hackathonId]/team-up` with `{ toUserId, proposedTeamName, message }`.

Success: "{toUserName} has been sent a Team Up request!" toast + close. Parent marks card as "Requested".

---

### 3.8 Team Invite Acceptance Page

#### New file: `src/app/(public)/team-invites/accept/page.tsx`

Server component. Works with or without authentication.

```typescript
export default async function TeamInviteAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) notFound();

  const invite = await getTeamInviteByToken(token);
  if (!invite) return <InvalidInvitePage reason="not_found" />;
  if (invite.expiresAt < new Date()) return <InvalidInvitePage reason="expired" />;
  if (invite.acceptedAt) return <InvalidInvitePage reason="already_accepted" />;

  const session = await auth();

  return (
    <TeamInviteAcceptClient
      token={token}
      teamName={invite.teamName}
      hackathonTitle={invite.hackathonTitle}
      hackathonSlug={invite.hackathonSlug}
      isAuthenticated={!!session?.user?.id}
    />
  );
}
```

`InvalidInvitePage` is an inline server component rendering appropriate messaging per reason code.

---

#### New file: `src/app/(public)/team-invites/accept/_components/team-invite-accept-client.tsx`

Client component.

```typescript
interface TeamInviteAcceptClientProps {
  token: string;
  teamName: string;
  hackathonTitle: string;
  hackathonSlug: string;
  isAuthenticated: boolean;
}
```

If `isAuthenticated`:
- Show "You've been invited to join [teamName] for [hackathonTitle]"
- "Accept Invite" button → `POST /api/team-invites/accept` `{ token }` → on success: `router.push('/hackathons/[hackathonSlug]/teams/[teamId]')`

If not authenticated:
- Same header copy
- "Sign In" → `/login?callbackUrl=/team-invites/accept?token=[token]`
- "Create Account" → `/signup?callbackUrl=/team-invites/accept?token=[token]`
- Explanatory note: "After verifying your email, return to this link to accept the invite."

---

### 3.9 Files Changed Summary

| File | Action | Reason |
|------|--------|--------|
| `src/lib/services/team-service.ts` | Modified | Add `getTeamWithMembers`, `getJoinRequestsForTeam`, `getTeamInviteByToken` |
| `src/app/api/hackathons/[hackathonId]/teams/route.ts` | Created | POST create team / GET browse (public) |
| `src/app/api/hackathons/[hackathonId]/teams/[teamId]/route.ts` | Created | GET team details (auth) / PATCH update (lead) |
| `src/app/api/hackathons/[hackathonId]/teams/[teamId]/join-request/route.ts` | Created | POST send join request |
| `src/app/api/hackathons/[hackathonId]/teams/[teamId]/join-requests/route.ts` | Created | GET pending requests (lead) |
| `src/app/api/hackathons/[hackathonId]/teams/[teamId]/join-requests/[requestId]/route.ts` | Created | PATCH approve/reject (lead) |
| `src/app/api/hackathons/[hackathonId]/teams/[teamId]/invite/route.ts` | Created | POST invite by email (lead) |
| `src/app/api/hackathons/[hackathonId]/teams/[teamId]/leave/route.ts` | Created | POST leave team |
| `src/app/api/hackathons/[hackathonId]/teams/[teamId]/transfer-lead/route.ts` | Created | POST transfer leadership (lead) |
| `src/app/api/teams/by-invite-code/[inviteCode]/route.ts` | Created | GET team by invite code (public) |
| `src/app/api/team-invites/accept/route.ts` | Created | POST accept invite token |
| `src/app/api/hackathons/[hackathonId]/participants/route.ts` | Created | GET discoverable participants (auth) |
| `src/app/api/hackathons/[hackathonId]/team-up/route.ts` | Created | POST create team-up request |
| `src/app/api/hackathons/[hackathonId]/team-up-requests/route.ts` | Created | GET incoming team-up requests |
| `src/app/api/hackathons/[hackathonId]/team-up-requests/[requestId]/route.ts` | Created | PATCH accept/reject team-up |
| `src/app/(public)/hackathons/[slug]/teams/page.tsx` | Created | Public team browse page |
| `src/app/(public)/hackathons/[slug]/teams/loading.tsx` | Created | Card skeleton |
| `src/app/(public)/hackathons/[slug]/teams/_components/team-browse-client.tsx` | Created | Fetches teams + track filter (client) |
| `src/app/(public)/hackathons/[slug]/teams/_components/team-browse-card.tsx` | Created | Team card with role-aware join CTA |
| `src/app/(public)/hackathons/[slug]/teams/_components/create-team-modal.tsx` | Created | Create team dialog |
| `src/app/(public)/hackathons/[slug]/teams/_components/join-request-dialog.tsx` | Created | Join request form dialog |
| `src/app/(public)/hackathons/[slug]/teams/[teamId]/page.tsx` | Created | Team profile page (auth required) |
| `src/app/(public)/hackathons/[slug]/teams/[teamId]/loading.tsx` | Created | Profile skeleton |
| `src/app/(public)/hackathons/[slug]/teams/[teamId]/_components/team-profile-client.tsx` | Created | All profile sections + role-based actions |
| `src/app/(public)/hackathons/[slug]/teams/[teamId]/_components/edit-team-dialog.tsx` | Created | Edit team form (lead) |
| `src/app/(public)/hackathons/[slug]/teams/[teamId]/_components/invite-by-email-dialog.tsx` | Created | Email invite dialog (lead) |
| `src/app/(public)/hackathons/[slug]/teams/[teamId]/_components/transfer-lead-dialog.tsx` | Created | Leadership transfer dialog (lead) |
| `src/app/(public)/hackathons/[slug]/teams/join/page.tsx` | Created | Join via invite link page |
| `src/app/(public)/hackathons/[slug]/teams/join/_components/join-link-client.tsx` | Created | Join link client component |
| `src/app/(public)/hackathons/[slug]/participants/page.tsx` | Created | Discoverable participants browse (auth) |
| `src/app/(public)/hackathons/[slug]/participants/loading.tsx` | Created | Skeleton |
| `src/app/(public)/hackathons/[slug]/participants/_components/participants-browse-client.tsx` | Created | Fetch + search participants (client) |
| `src/app/(public)/hackathons/[slug]/participants/_components/participant-card.tsx` | Created | Participant card with team-up/invite CTA |
| `src/app/(public)/hackathons/[slug]/participants/_components/team-up-dialog.tsx` | Created | Team-up request dialog |
| `src/app/(public)/team-invites/accept/page.tsx` | Created | Team invite acceptance page |
| `src/app/(public)/team-invites/accept/_components/team-invite-accept-client.tsx` | Created | Accept invite client component |

---

### 3.10 Implementation Increments

**Increment 1: API Routes + Service Additions**

1. Add `getTeamWithMembers`, `getJoinRequestsForTeam`, `getTeamInviteByToken` to `team-service.ts`
2. Create all 15 API route files
3. `npx tsc --noEmit`

**Verify:** `POST /teams` returns 201 on valid input, 403 without registration, 403 if already on a team. `GET /teams` returns 200 without auth. `GET /participants` returns 401 without auth. `tsc` passes cleanly.

---

**Increment 2: Team Browse + Create Team**

1. Create `/hackathons/[slug]/teams/page.tsx` + `loading.tsx`
2. Create `team-browse-client.tsx`, `team-browse-card.tsx`
3. Create `create-team-modal.tsx`, `join-request-dialog.tsx`
4. `npx tsc --noEmit`

**Verify:** Team browse page loads without login. Track filter changes the card grid without page reload. Unauthed user sees "Sign in to Join". Registered+unteamed user can open create team modal, submit, and is redirected to the new team page.

---

**Increment 3: Team Profile + Join Link**

1. Create `/hackathons/[slug]/teams/[teamId]/page.tsx` + `loading.tsx`
2. Create `team-profile-client.tsx`
3. Create `edit-team-dialog.tsx`, `invite-by-email-dialog.tsx`, `transfer-lead-dialog.tsx`
4. Create `/hackathons/[slug]/teams/join/page.tsx` + `join-link-client.tsx`
5. `npx tsc --noEmit`

**Verify:** Team profile redirects unauthenticated users to login. Lead sees Edit, Invite, Transfer Lead, and Join Requests sections. Member sees Leave button only. Non-member (registered, unteamed) sees "Request to Join" if team is open. Join link page shows team info; authenticated user can submit a join request; unauthenticated sees login CTA.

---

**Increment 4: Participants Browse + Team-Up + Invite Accept**

1. Create `/hackathons/[slug]/participants/page.tsx` + `loading.tsx`
2. Create `participants-browse-client.tsx`, `participant-card.tsx`, `team-up-dialog.tsx`
3. Create `/team-invites/accept/page.tsx` + `team-invite-accept-client.tsx`
4. `npx next build`

**Verify:** Participants browse redirects unauthed users to login. Registered unteamed users see "Team Up" button; team leads see "Invite to Team". Team-up dialog submits and shows success toast. Invite accept page: authenticated user sees Accept button and is redirected to team page on success; unauthenticated user sees login/signup options with `callbackUrl` preserving the token.

---

*Part 3 complete when all 4 increments pass and `npx next build` has zero errors.*

---

*Part 4 will be written after Part 3 is implemented and verified.*
