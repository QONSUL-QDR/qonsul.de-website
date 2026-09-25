import { SHA_PATTERN, TREE_PATTERN } from './production-artifact.mjs';

export const STAGING_SOURCE = Object.freeze({
  commit: 'af93ddeae19330d8aa091096133e265217bc208a',
  tree: 'd946b8c8cd7e5ef33963fb8e81bd021d8141c66f',
});

export const STAGING_WORKER_NAME = 'qonsul-website-staging-reconciliation';
export const STAGING_PUBLIC_URL = 'https://qonsul-website-staging-reconciliation.qonsul.workers.dev';
export const STAGING_ANALYTICS_ENDPOINT = 'https://cockpit-staging.qonsul.de/api/v1/analytics/events';

// These are deliberately the complete non-secret Worker vars for staging.
// Legal/contact values and every external-delivery credential stay absent.
export const STAGING_PUBLIC_RUNTIME_V1 = Object.freeze({
  DEPLOYMENT_ENVIRONMENT: 'staging',
  NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT: STAGING_ANALYTICS_ENDPOINT,
  PRODUCTION_READY: 'false',
  PUBLIC_SITE_URL: STAGING_PUBLIC_URL,
});

export const PRODUCTION_CANDIDATE_PUBLIC_RUNTIME_KEYS = Object.freeze([
  'PUBLIC_CONTACT_EMAIL',
  'LEGAL_ENTITY_NAME',
  'LEGAL_ADDRESS',
  'LEGAL_REPRESENTATIVE',
  'LEGAL_PHONE',
  'LEGAL_REGISTER',
  'LEGAL_VAT_ID',
  'LEGAL_EDITORIAL_RESPONSIBLE',
  'LEGAL_DISPUTE_RESOLUTION',
]);

export function assertStagingBuildInputs({ commit, tree, d1DatabaseId, d1DatabaseName, analyticsEndpoint }) {
  if (commit !== STAGING_SOURCE.commit || !SHA_PATTERN.test(commit || '')) {
    throw new Error('Staging builds must use the approved reconciliation source commit.');
  }
  if (tree !== STAGING_SOURCE.tree || !TREE_PATTERN.test(tree || '')) {
    throw new Error('Staging builds must use the approved reconciliation source tree.');
  }
  if (!/^[0-9a-f-]{36}$/.test(d1DatabaseId || '') || d1DatabaseId === 'eb2a5897-3116-43f9-88c2-79434ceddc43') {
    throw new Error('Staging requires its own non-production D1 database ID.');
  }
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(d1DatabaseName || '') || d1DatabaseName === 'qonsul-website-d1') {
    throw new Error('Staging requires its own non-production D1 database name.');
  }
  if (analyticsEndpoint !== STAGING_ANALYTICS_ENDPOINT) {
    throw new Error('Staging builds must use the approved Cockpit staging analytics endpoint.');
  }
}

export function stagingBuildId(commit, tree) {
  if (!SHA_PATTERN.test(commit || '') || !TREE_PATTERN.test(tree || '')) {
    throw new Error('Staging build ID requires full commit and tree identities.');
  }
  return `${commit}:${tree}`;
}
