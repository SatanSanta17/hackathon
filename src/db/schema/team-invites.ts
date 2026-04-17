import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

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

export type TeamInvite = InferSelectModel<typeof teamInvites>;
export type NewTeamInvite = InferInsertModel<typeof teamInvites>;
