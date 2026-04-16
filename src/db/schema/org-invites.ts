import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';

import { orgRoleEnum } from './enums';
import { organizations } from './organizations';
import { users } from './users';

export const orgInvites = pgTable('org_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  email: text('email').notNull(),
  role: orgRoleEnum('role').notNull(),
  token: text('token').notNull().unique(),
  invitedBy: uuid('invited_by').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('org_invites_email_idx').on(table.email),
  index('org_invites_token_idx').on(table.token),
]);
