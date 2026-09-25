import { spawnSync } from 'node:child_process';
import { STAGING_WORKER_NAME } from '../lib/staging-runtime.mjs';

const build = spawnSync('node', ['scripts/build-staging-worker.mjs'], {
  stdio: 'inherit',
  env: process.env,
});
if (build.status !== 0) process.exit(build.status || 1);

const verify = spawnSync('node', ['scripts/check-staging-worker-build.mjs'], {
  stdio: 'inherit',
  env: process.env,
});
if (verify.status !== 0) process.exit(verify.status || 1);

const deploy = spawnSync('pnpm', ['exec', 'wrangler', 'deploy', '--config', 'dist/server/wrangler.json', '--name', STAGING_WORKER_NAME], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});
if (deploy.status !== 0) process.exit(deploy.status || 1);
