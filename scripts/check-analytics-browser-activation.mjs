import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  analyticsConsentGranted,
  parseAnalyticsConsent,
} from '../lib/analytics-consent.ts';
import { conversionForAnalyticsHook } from '../lib/analytics-hooks.ts';
import { ANALYTICS_SESSION_STORAGE_KEY } from '../lib/analytics-session.ts';

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

const [client, consent, ishikawa, contact, reports, crm] = await Promise.all([
  readFile(new URL('../app/analytics-client.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/analytics-consent.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/ishikawa-lab.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/contact/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/reports/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/crm.ts', import.meta.url), 'utf8'),
]);

assert.match(client, /qonsul:analytics-consent/);
assert.match(client, /analyticsConsentGranted\(window\.localStorage\.getItem/);
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

console.log('PASS consent-gated browser analytics, diagnostic funnel IDs, strict technical linkage and credential-free transport');
