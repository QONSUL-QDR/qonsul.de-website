import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(), tokenHash:text('token_hash').notNull().unique(),
  analysis:text('analysis').notNull(), name:text('name').notNull(), email:text('email').notNull(), company:text('company').notNull(),
  analyticsSessionId:text('analytics_session_id'), diagnosticFlowId:text('diagnostic_flow_id'),
  consentVersion:text('consent_version').notNull(), consentAt:integer('consent_at').notNull(), crmConsent:integer('crm_consent').notNull().default(0),
  crmStatus:text('crm_status').notNull().default('not_requested'), crmContactId:text('crm_contact_id'), crmNoteId:text('crm_note_id'),
  createdAt:integer('created_at').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[index('idx_reports_expires_at').on(t.expiresAt),index('idx_reports_analytics_session_id').on(t.analyticsSessionId),index('idx_reports_diagnostic_flow_id').on(t.diagnosticFlowId)]);
export const rateLimits=sqliteTable('rate_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()},t=>[index('idx_rate_limits_expires_at').on(t.expiresAt)]);
export const trends=sqliteTable('trends',{key:text('key').primaryKey(),category:text('category').notNull(),quarter:text('quarter').notNull(),count:integer('count').notNull().default(0)});
export const contactRequests=sqliteTable('contact_requests',{
  id:text('id').primaryKey(),clientTokenHash:text('client_token_hash').notNull().unique(),
  name:text('name').notNull(),email:text('email').notNull(),phone:text('phone'),company:text('company'),message:text('message').notNull(),
  analyticsSessionId:text('analytics_session_id'),diagnosticFlowId:text('diagnostic_flow_id'),
  privacyVersion:text('privacy_version').notNull(),createdAt:integer('created_at').notNull(),expiresAt:integer('expires_at').notNull(),
  crmStatus:text('crm_status').notNull().default('pending'),crmContactId:text('crm_contact_id'),crmNoteId:text('crm_note_id'),
  emailStatus:text('email_status').notNull().default('pending'),emailProviderId:text('email_provider_id'),
},t=>[index('idx_contact_requests_expires_at').on(t.expiresAt),index('idx_contact_requests_analytics_session_id').on(t.analyticsSessionId),index('idx_contact_requests_diagnostic_flow_id').on(t.diagnosticFlowId)]);
