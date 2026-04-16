import { pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core';

import { orgRoleEnum } from './enums';
import { users } from './users';
import { organizations } from './organizations';

export const orgMemberships = pgTable('org_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  role: orgRoleEnum('role').notNull(),
  invitedAt: timestamp('invited_at', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }),
}, (table) => [
  index('org_memberships_user_id_idx').on(table.userId),
  index('org_memberships_org_id_idx').on(table.orgId),
]);
