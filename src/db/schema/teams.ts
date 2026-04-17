import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

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

export type Team = InferSelectModel<typeof teams>;
export type NewTeam = InferInsertModel<typeof teams>;
