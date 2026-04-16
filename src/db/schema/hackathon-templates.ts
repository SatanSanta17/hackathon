import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

import { templateTypeEnum } from './enums';

export const hackathonTemplates = pgTable('hackathon_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  templateType: templateTypeEnum('template_type').notNull().unique(),
  defaultPhases: jsonb('default_phases').notNull(),
  icon: text('icon'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type HackathonTemplate = InferSelectModel<typeof hackathonTemplates>;
export type NewHackathonTemplate = InferInsertModel<typeof hackathonTemplates>;
