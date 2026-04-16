import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import { pgTable, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

import { phaseTypeEnum, phaseStatusEnum } from './enums';
import { hackathons } from './hackathons';

export const phases = pgTable('phases', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathonId: uuid('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: phaseTypeEnum('type').notNull(),
  order: integer('order').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  config: jsonb('config'),
  status: phaseStatusEnum('status').notNull().default('upcoming'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('phases_hackathon_id_idx').on(table.hackathonId),
]);

export type Phase = InferSelectModel<typeof phases>;
export type NewPhase = InferInsertModel<typeof phases>;
