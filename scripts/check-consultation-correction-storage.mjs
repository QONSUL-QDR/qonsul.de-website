import assert from 'node:assert/strict';
import {
  CONSULTATION_CORRECTION_STORAGE_KEY,
  readConsultationCorrectionLink,
  storeConsultationCorrectionLink,
} from '../lib/consultation-correction-storage.ts';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};

values.set(CONSULTATION_CORRECTION_STORAGE_KEY, JSON.stringify({ path: '/anfrage-verwalten/alt', expiresAt: 999 }));
assert.equal(readConsultationCorrectionLink(1000), null);
assert.equal(values.has(CONSULTATION_CORRECTION_STORAGE_KEY), false, 'expired links must be removed as soon as they are read');

values.set(CONSULTATION_CORRECTION_STORAGE_KEY, '{invalid');
assert.equal(readConsultationCorrectionLink(1000), null);
assert.equal(values.has(CONSULTATION_CORRECTION_STORAGE_KEY), false, 'malformed links must be removed');

values.set(CONSULTATION_CORRECTION_STORAGE_KEY, JSON.stringify({ path: '/anfrage-verwalten/aktiv', expiresAt: 1001 }));
assert.deepEqual(readConsultationCorrectionLink(1000), { path: '/anfrage-verwalten/aktiv', expiresAt: 1001 });

const stored = storeConsultationCorrectionLink('/anfrage-verwalten/neu', 2000);
assert.equal(stored.expiresAt, 2000 + 7 * 24 * 60 * 60 * 1000);
assert.deepEqual(JSON.parse(values.get(CONSULTATION_CORRECTION_STORAGE_KEY)), stored);

console.log('Consultation correction storage checks passed.');
