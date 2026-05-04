import { pgTable, pgEnum, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const campaignStatusEnum = pgEnum('campaign_status', ['draft', 'published', 'archived']);
export const platformEnum = pgEnum('platform', ['instagram', 'facebook', 'linkedin', 'stories', 'email', 'print', 'x']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'agent']);

export const campaigns = pgTable('campaigns', {
  id:           uuid('id').defaultRandom().primaryKey(),
  title:        text('title').notNull(),
  sourceMonth:  text('source_month').notNull(),
  strategyCore: text('strategy_core'),
  pdfFilename:  text('pdf_filename').notNull(),
  pdfData:      text('pdf_data').notNull(),       // base64-encoded PDF
  status:       campaignStatusEnum('status').default('draft').notNull(),
  processedAt:  timestamp('processed_at'),
  publishedAt:  timestamp('published_at'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});

export const contentItems = pgTable('content_items', {
  id:             uuid('id').defaultRandom().primaryKey(),
  campaignId:     uuid('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }).notNull(),
  platform:       platformEnum('platform').notNull(),
  contentType:    text('content_type').notNull(),
  variationNumber: integer('variation_number').default(1).notNull(),
  copyText:       text('copy_text').notNull(),
  agentId:        uuid('agent_id'),               // null for brokerage content; populated in V2
  createdAt:      timestamp('created_at').defaultNow().notNull(),
});

export const canvaTemplates = pgTable('canva_templates', {
  id:        uuid('id').defaultRandom().primaryKey(),
  platform:  platformEnum('platform').unique().notNull(),
  name:      text('name').notNull(),
  url:       text('url').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id:           uuid('id').defaultRandom().primaryKey(),
  email:        text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role:         userRoleEnum('role').default('agent').notNull(),
  name:         text('name').notNull(),
  phone:        text('phone'),
  agentUrl:     text('agent_url'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id:        text('id').primaryKey(),
  userId:    uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
