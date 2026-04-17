import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

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

export type TeamJoinRequest = InferSelectModel<typeof teamJoinRequests>;
export type NewTeamJoinRequest = InferInsertModel<typeof teamJoinRequests>;
