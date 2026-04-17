import { pgTable, uuid, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

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

export type TeamMember = InferSelectModel<typeof teamMembers>;
export type NewTeamMember = InferInsertModel<typeof teamMembers>;
