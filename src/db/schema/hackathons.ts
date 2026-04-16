import { type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';

import { hackathonStatusEnum, templateTypeEnum, visibilityEnum } from './enums';
import { organizations } from './organizations';
import { users } from './users';

export const hackathons = pgTable('hackathons', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  coverImageKey: text('cover_image_key'),
  status: hackathonStatusEnum('status').notNull().default('draft'),
  templateType: templateTypeEnum('template_type').notNull(),
  visibility: visibilityEnum('visibility').notNull().default('public'),
  teamMinSize: integer('team_min_size').notNull().default(1),
  teamMaxSize: integer('team_max_size').notNull().default(5),
  allowIndividual: boolean('allow_individual').notNull().default(true),
  rulesHtml: text('rules_html'),
  faqsHtml: text('faqs_html'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('hackathons_org_id_idx').on(table.orgId),
  index('hackathons_slug_idx').on(table.slug),
  index('hackathons_status_idx').on(table.status),
  index('hackathons_created_by_idx').on(table.createdBy),
]);

export type Hackathon = InferSelectModel<typeof hackathons>;
export type NewHackathon = InferInsertModel<typeof hackathons>;
