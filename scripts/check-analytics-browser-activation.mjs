import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  analyticsConsentGranted,
  parseAnalyticsConsent,
} from '../lib/analytics-consent.ts';
import { conversionForAnalyticsHook } from '../lib/analytics-hooks.ts';
import {
  ANALYTICS_SESSION_INACTIVITY_MS,
  ANALYTICS_SESSION_MAX_AGE_MS,
  ANALYTICS_SESSION_STORAGE_KEY,
  parseAnalyticsSession,
  resolveAnalyticsSession,
} from '../lib/analytics-session.ts';

assert.equal(ANALYTICS_CONSENT_STORAGE_KEY, 'qonsul.analytics.consent.v1');
assert.equal(parseAnalyticsConsent(null), 'unknown');
assert.equal(parseAnalyticsConsent('invalid'), 'unknown');
assert.equal(parseAnalyticsConsent('granted'), 'granted');
assert.equal(parseAnalyticsConsent('denied'), 'denied');
assert.equal(analyticsConsentGranted('granted'), true);
assert.equal(analyticsConsentGranted('denied'), false);
assert.equal(conversionForAnalyticsHook('contact_form_accepted'), 'website_goal');
assert.equal(conversionForAnalyticsHook('ishikawa_accepted'), 'website_goal');
assert.equal(conversionForAnalyticsHook('contact_form_submitted'), null);
assert.equal(ANALYTICS_SESSION_STORAGE_KEY, 'qonsul.analytics.session.v1');

const now = 1_800_000_000_000;
const existingId = '11111111-1111-4111-8111-111111111111';
const replacementId = '22222222-2222-4222-8222-222222222222';
const session = (createdAt, touchedAt) => JSON.stringify({ id: existingId, createdAt, touchedAt });
const createReplacement = () => replacementId;

assert.deepEqual(
  resolveAnalyticsSession(session(now - ANALYTICS_SESSION_MAX_AGE_MS + 1, now - ANALYTICS_SESSION_INACTIVITY_MS + 1), now, createReplacement),
  { id: existingId, createdAt: now - ANALYTICS_SESSION_MAX_AGE_MS + 1, touchedAt: now },
);
assert.deepEqual(
  resolveAnalyticsSession(session(now - 1, now - ANALYTICS_SESSION_INACTIVITY_MS), now, createReplacement),
  { id: replacementId, createdAt: now, touchedAt: now },
);
assert.deepEqual(
  resolveAnalyticsSession(session(now - ANALYTICS_SESSION_MAX_AGE_MS, now - 1), now, createReplacement),
  { id: replacementId, createdAt: now, touchedAt: now },
);
assert.equal(resolveAnalyticsSession(session(now - ANALYTICS_SESSION_MAX_AGE_MS, now - 1), now, createReplacement).id, replacementId);
assert.deepEqual(
  parseAnalyticsSession(JSON.stringify({ id: existingId, createdAt: now, touchedAt: now, email: 'not-persisted@example.test' })),
  { id: existingId, createdAt: now, touchedAt: now },
);

const [client, consent, ishikawa, contact, reports, crm, privacy] = await Promise.all([
  readFile(new URL('../app/analytics-client.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/analytics-consent.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/ishikawa-lab.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/contact/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/reports/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/crm.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/datenschutz/page.tsx', import.meta.url), 'utf8'),
]);

assert.match(client, /qonsul:analytics-consent/);
assert.match(client, /analyticsConsentGranted\(window\.localStorage\.getItem/);
assert.match(client, /resolveAnalyticsSession\(sessionStorage\.getItem\(sessionKey\), Date\.now\(\), id\)/);
assert.match(client, /sessionStorage\.removeItem\(sessionKey\)/);
assert.match(client, /qonsul:analytics-hook/);
assert.match(client, /conversion_type: conversion/);
assert.match(client, /credentials: 'omit'/);
assert.doesNotMatch(client, /navigator\.sendBeacon/);
assert.match(client, /diagnostic_started/);
assert.match(client, /diagnostic_step_completed/);
assert.match(client, /diagnostic_completed/);
assert.match(client, /diagnostic_flow_id/);
assert.doesNotMatch(client, /problem_statement|cause_text|contact_message/);
assert.match(consent, /localStorage\.setItem\(ANALYTICS_CONSENT_STORAGE_KEY, next\)/);
assert.match(consent, /notifyAnalyticsConsent\(granted\)/);
assert.match(ishikawa, /emitAnalyticsHook\('diagnostic_started'/);
assert.match(ishikawa, /analyticsSessionId:currentAnalyticsSessionId\(\)/);
assert.match(ishikawa, /diagnosticFlowId:diagnosticFlowId\.current/);
assert.match(contact, /const optionalUuid=/);
assert.match(reports, /const optionalUuid=/);
assert.match(crm, /analytics_session_id:lead\.analyticsSessionId\|\|null/);
assert.match(crm, /diagnostic_flow_id:lead\.diagnosticFlowId\|\|null/);
assert.match(privacy, /30 Minuten Inaktivität/);
assert.match(privacy, /24 Stunden nach ihrer Erstellung/);
assert.match(privacy, /kein Browser-Fingerprinting/);
assert.match(privacy, /90 Tage als Rohdaten/);
assert.match(privacy, /24 Monate/);
assert.match(privacy, /Resend/);
assert.match(privacy, /Microsoft-365/);
assert.match(privacy, /6, 8 oder 10 Jahren/);

console.log('PASS consent-gated browser analytics, diagnostic funnel IDs, strict technical linkage and credential-free transport');
