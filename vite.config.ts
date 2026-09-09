import { execSync } from 'node:child_process';
import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

// Deployment-drift identifier: bakes the exact commit a build was produced
// from into the compiled output at build time (esbuild `define`, below), so
// it survives whatever deploys the resulting bundle afterwards (wrangler,
// an OpenAI Sites-managed pipeline, etc.) without depending on that pipeline
// remembering to set an env var. `GET /api/status` then exposes it — a
// non-secret value, never a source of truth for authorization — so that
// given only the Worker URL, the running commit can be confirmed rather
// than assumed. A few hosted CI checkouts provide the commit via env instead
// of a usable `.git`; those are tried first, then a local `git rev-parse`,
// and finally 'unknown' rather than ever failing the build.
function resolveBuildCommitSha(): string {
  const fromEnv =
    process.env.SOURCE_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv;
  try {
    return execSync('git rev-parse HEAD', { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}
const buildCommitSha = resolveBuildCommitSha();

const { d1, r2 } = hostingConfig;

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

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    define: { __QONSUL_BUILD_COMMIT_SHA__: JSON.stringify(buildCommitSha) },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  };
});
