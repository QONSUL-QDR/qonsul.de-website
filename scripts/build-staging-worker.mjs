import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  STAGING_ANALYTICS_ENDPOINT,
  STAGING_SOURCE,
  assertStagingBuildInputs,
  stagingBuildId,
} from '../lib/staging-runtime.mjs';

const d1DatabaseId = process.env.STAGING_D1_DATABASE_ID;
const d1DatabaseName = process.env.STAGING_D1_DATABASE_NAME;
assertStagingBuildInputs({
  commit: STAGING_SOURCE.commit,
  tree: STAGING_SOURCE.tree,
  d1DatabaseId,
  d1DatabaseName,
  analyticsEndpoint: STAGING_ANALYTICS_ENDPOINT,
});

const deployId = process.env.STAGING_DEPLOY_ID || `staging-${randomUUID()}`;
if (!/^staging-[a-zA-Z0-9-]{8,128}$/.test(deployId)) {
  throw new Error('STAGING_DEPLOY_ID must be a non-secret staging identifier.');
}

const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/pnpm/bin/pnpm.cjs', import.meta.url)), 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    CF_D1_DATABASE_ID: d1DatabaseId,
    CF_D1_DATABASE_NAME: d1DatabaseName,
    DEPLOYMENT_ENVIRONMENT: 'staging',
    NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT: STAGING_ANALYTICS_ENDPOINT,
    PRODUCTION_ARTIFACT_BUILD: 'false',
    SOURCE_BUILD_ID: stagingBuildId(STAGING_SOURCE.commit, STAGING_SOURCE.tree),
    SOURCE_COMMIT_SHA: STAGING_SOURCE.commit,
    SOURCE_DEPLOY_ID: deployId,
    SOURCE_TREE_SHA: STAGING_SOURCE.tree,
    STAGING_WORKER_BUILD: 'true',
  },
});
if (result.status !== 0) process.exit(result.status || 1);
console.log(JSON.stringify({ commit: STAGING_SOURCE.commit, tree: STAGING_SOURCE.tree, deployId }));
