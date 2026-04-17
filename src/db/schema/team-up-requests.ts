import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

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

export type TeamUpRequest = InferSelectModel<typeof teamUpRequests>;
export type NewTeamUpRequest = InferInsertModel<typeof teamUpRequests>;
