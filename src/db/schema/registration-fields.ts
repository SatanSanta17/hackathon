import { pgTable, uuid, text, boolean, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { hackathons } from './hackathons';

export const registrationFields = pgTable('registration_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  hackathonId: uuid('hackathon_id').notNull().references(() => hackathons.id),
  label: text('label').notNull(),
  fieldType: text('field_type').notNull(), // 'text' | 'textarea' | 'dropdown'
  options: jsonb('options').$type<string[]>(),
  required: boolean('required').notNull().default(false),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('registration_fields_hackathon_id_idx').on(table.hackathonId),
]);

export type RegistrationField = InferSelectModel<typeof registrationFields>;
export type NewRegistrationField = InferInsertModel<typeof registrationFields>;
