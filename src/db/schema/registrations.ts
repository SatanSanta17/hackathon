import { pgTable, uuid, boolean, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { hackathons } from './hackathons';
import { users } from './users';

export const registrations = pgTable('registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathonId: uuid('hackathon_id').notNull().references(() => hackathons.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  formData: jsonb('form_data').$type<Record<string, string>>(),
  isDiscoverable: boolean('is_discoverable').notNull().default(true),
  registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('registrations_hackathon_id_idx').on(table.hackathonId),
  index('registrations_user_id_idx').on(table.userId),
  unique('registrations_hackathon_user_unique').on(table.hackathonId, table.userId),
]);

export type Registration = InferSelectModel<typeof registrations>;
export type NewRegistration = InferInsertModel<typeof registrations>;
