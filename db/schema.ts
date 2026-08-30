import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(), tokenHash:text('token_hash').notNull().unique(),
  analysis:text('analysis').notNull(), name:text('name').notNull(), email:text('email').notNull(), company:text('company').notNull(),
  consentVersion:text('consent_version').notNull(), consentAt:integer('consent_at').notNull(), crmConsent:integer('crm_consent').notNull().default(0),
  crmStatus:text('crm_status').notNull().default('not_requested'), crmContactId:text('crm_contact_id'), crmNoteId:text('crm_note_id'),
  createdAt:integer('created_at').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[index('idx_reports_expires_at').on(t.expiresAt)]);
export const rateLimits=sqliteTable('rate_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()},t=>[index('idx_rate_limits_expires_at').on(t.expiresAt)]);
export const trends=sqliteTable('trends',{key:text('key').primaryKey(),category:text('category').notNull(),quarter:text('quarter').notNull(),count:integer('count').notNull().default(0)});
