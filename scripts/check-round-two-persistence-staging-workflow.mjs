import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/deploy-round-two-persistence-staging.yml', import.meta.url), 'utf8');

assert.match(workflow, /workflow_dispatch:/);
assert.doesNotMatch(workflow, /^\s*(push|pull_request):/m);
assert.match(workflow, /refs\/heads\/staging\/round-two-persistence-workaround/);
assert.match(workflow, /environment:\s*website-staging-deployment/);
assert.match(workflow, /STAGING_WORKER_NAME:\s*qonsul-website-staging-reconciliation/);
assert.match(workflow, /--keep-vars/);
assert.match(workflow, /SOURCE_COMMIT_SHA/);
assert.match(workflow, /SOURCE_BUILD_ID/);
assert.match(workflow, /candidateIdentity/);
assert.doesNotMatch(workflow, /wrangler\s+d1|d1\s+migrations|routes:\s*|custom_domains:\s*|production-deployment/i);

console.log('PASS Round-2 persistence workaround deploy is manual, branch-bound, and limited to the fixed Staging Worker');
