import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  analyticsConsentGranted,
  parseAnalyticsConsent,
} from '../lib/analytics-consent.ts';
import { conversionForAnalyticsHook } from '../lib/analytics-hooks.ts';

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

const [client, consent] = await Promise.all([
  readFile(new URL('../app/analytics-client.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/analytics-consent.tsx', import.meta.url), 'utf8'),
]);

assert.match(client, /qonsul:analytics-consent/);
assert.match(client, /analyticsConsentGranted\(window\.localStorage\.getItem/);
assert.match(client, /sessionStorage\.removeItem\(sessionKey\)/);
assert.match(client, /qonsul:analytics-hook/);
assert.match(client, /conversion_type: conversion/);
assert.match(client, /credentials: 'omit'/);
assert.doesNotMatch(client, /navigator\.sendBeacon/);
assert.match(consent, /localStorage\.setItem\(ANALYTICS_CONSENT_STORAGE_KEY, next\)/);
assert.match(consent, /notifyAnalyticsConsent\(granted\)/);

console.log('PASS explicit analytics consent, persistence, withdrawal and accepted-intake conversion activation');
