import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

import { hackathons } from './hackathons';

export const prizes = pgTable('prizes', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathonId: uuid('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  rank: integer('rank').notNull(),
  imageKey: text('image_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('prizes_hackathon_id_idx').on(table.hackathonId),
]);

export type Prize = InferSelectModel<typeof prizes>;
export type NewPrize = InferInsertModel<typeof prizes>;
