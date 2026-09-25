import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  STAGING_D1_DATABASE_ID: '11111111-1111-4111-8111-111111111111',
  STAGING_D1_DATABASE_NAME: 'qonsul-website-d1-staging-reconciliation',
  STAGING_DEPLOY_ID: 'staging-test-build-20260925',
};
for (const command of [
  ['node', ['scripts/build-staging-worker.mjs']],
  ['node', ['scripts/check-staging-worker-build.mjs']],
]) {
  const result = spawnSync(command[0], command[1], { stdio: 'inherit', env });
  if (result.status !== 0) process.exit(result.status || 1);
}
