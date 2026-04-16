import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

import { hackathons } from './hackathons';

export const tracks = pgTable('tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathonId: uuid('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  resourcesUrl: text('resources_url'),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('tracks_hackathon_id_idx').on(table.hackathonId),
]);

export type Track = InferSelectModel<typeof tracks>;
export type NewTrack = InferInsertModel<typeof tracks>;
