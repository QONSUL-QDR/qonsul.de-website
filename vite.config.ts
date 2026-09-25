import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';
import { assertProductionAnalyticsEndpoint } from './lib/production-artifact.mjs';
import { PRODUCTION_PUBLIC_RUNTIME_V1 } from './lib/production-public-runtime.mjs';
import { STAGING_ANALYTICS_ENDPOINT, STAGING_PUBLIC_RUNTIME_V1 } from './lib/staging-runtime.mjs';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;
const isProductionArtifactBuild = process.env.PRODUCTION_ARTIFACT_BUILD === 'true';
const isStagingWorkerBuild = process.env.STAGING_WORKER_BUILD === 'true';
const sourceCommit = process.env.SOURCE_COMMIT_SHA || '';
const sourceTree = process.env.SOURCE_TREE_SHA || '';
const sourceBuildId = process.env.SOURCE_BUILD_ID || '';
const sourceDeployId = process.env.SOURCE_DEPLOY_ID || '';
const deploymentEnvironment = process.env.DEPLOYMENT_ENVIRONMENT || '';
const analyticsEndpoint = process.env.NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT || process.env.PRODUCTION_ANALYTICS_ENDPOINT || '';

// The existing Sites project is a preview-hosting control plane. Artifact builds
// must not infer a telemetry destination from it: without a verifiable endpoint
// contract, the Sites plugin is deliberately excluded.
if (isProductionArtifactBuild) {
  assertProductionAnalyticsEndpoint(process.env.PRODUCTION_ANALYTICS_ENDPOINT);
}
if (isProductionArtifactBuild && isStagingWorkerBuild) {
  throw new Error('A build cannot be both a production artifact and a staging Worker.');
}
if (isStagingWorkerBuild && analyticsEndpoint !== STAGING_ANALYTICS_ENDPOINT) {
  throw new Error('Staging Worker analytics must use Cockpit staging.');
}

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

// Optional overrides for a standalone Cloudflare deploy (own account/D1),
// independent of the OpenAI Sites-managed project referenced in
// .openai/hosting.json. Unset by default, so local dev and the existing
// Sites pipeline are unaffected; a standalone build/deploy step sets
// CF_D1_DATABASE_ID (from `wrangler d1 create`) to point the build at a
// real database instead of the local-only placeholder id.
const standaloneD1DatabaseId = process.env.CF_D1_DATABASE_ID;
const standaloneD1DatabaseName =
  process.env.CF_D1_DATABASE_NAME || 'qonsul-website-d1';

const localBindingConfig = {
  main: 'vinext/server/app-router-entry',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: standaloneD1DatabaseId
            ? standaloneD1DatabaseName
            : 'site-creator-d1',
          database_id: standaloneD1DatabaseId || SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

const workerBindingConfig = isProductionArtifactBuild
  ? { ...localBindingConfig, vars: PRODUCTION_PUBLIC_RUNTIME_V1 }
  : isStagingWorkerBuild
    ? { ...localBindingConfig, vars: STAGING_PUBLIC_RUNTIME_V1 }
    : localBindingConfig;

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    define: {
      __QONSUL_SOURCE_COMMIT_SHA__: JSON.stringify(sourceCommit),
      __QONSUL_SOURCE_TREE_SHA__: JSON.stringify(sourceTree),
      __QONSUL_SOURCE_BUILD_ID__: JSON.stringify(sourceBuildId),
      __QONSUL_SOURCE_DEPLOY_ID__: JSON.stringify(sourceDeployId),
      __QONSUL_DEPLOYMENT_ENVIRONMENT__: JSON.stringify(deploymentEnvironment),
      'process.env.NEXT_PUBLIC_QONSUL_ANALYTICS_ENDPOINT': JSON.stringify(analyticsEndpoint),
    },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      ...(isProductionArtifactBuild ? [] : [sites()]),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: workerBindingConfig,
      }),
    ],
  };
});
