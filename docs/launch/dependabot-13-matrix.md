# Dependabot Alert #13 — Evaluation Matrix (template)

**Current status: UNKNOWN.** This session has no tool access to the GitHub repository's Security → Dependabot alerts tab, and none of the available GitHub API tools expose alert-by-number lookup. No assumption is made about what package or advisory "#13" refers to.

**Explicitly not assumed:** the one known moderate `pnpm audit` finding on `main` (`esbuild`, via `drizzle-kit@0.31.10` → the deprecated `@esbuild-kit/esm-loader`/`@esbuild-kit/core-utils` chain, documented in Issue #5) is **not** asserted to be identical to "Alert #13" — GitHub's Dependabot alert numbering and this repo's issue/PR numbering are independent sequences, and no advisory ID was available to confirm a match.

## How to identify Alert #13

1. Open `https://github.com/QONSUL-QDR/qonsul.de-website/security/dependabot/13` directly (a repo maintainer with Security tab access) — the number in the URL is exactly this alert.
2. Record: package name, current resolved version, vulnerable range, patched version, GHSA/CVE identifier, and whether Dependabot classifies it as direct or transitive.

## Matrix to complete once identified

| Field | Value |
|---|---|
| Package | *(fill in)* |
| Current version in lockfile | *(fill in)* |
| Vulnerable range | *(fill in)* |
| Patched version | *(fill in)* |
| Direct or transitive dependency | *(fill in)* |
| Runtime or dev-only | *(fill in — check whether the package appears under `dependencies` or `devDependencies`, and whether it's reachable from any code path that runs in the deployed Worker vs. only in local/CI tooling)* |
| Exploitable in production? | *(fill in — depends on whether the vulnerable code path is reachable from the deployed Worker at all, e.g. a build-tool-only vulnerability with no runtime code path is not exploitable in production even if "high" severity)* |
| Reachable code path confirmed? | *(fill in — trace whether the app actually calls into the vulnerable function/feature, not just "the package is present")* |
| Fix compatibility risk | *(fill in — does bumping to the patched version require a major-version jump with breaking changes, per the drizzle-kit 1.0-rc precedent already found in this project: a naive bump broke `pnpm db:generate` against the current `drizzle-orm` version)* |
| Decision: fix now vs. monitor | *(fill in, based on the above — a low-severity, dev-only, unreachable-in-production finding with a breaking-change fix is a reasonable "monitor" candidate; a runtime-reachable high-severity finding with a compatible patch is a "fix now" candidate)* |

## Precedent from this project (context, not a substitute for identifying #13)

The `drizzle-kit`/`@esbuild-kit` moderate finding already evaluated in Issue #5 followed exactly this matrix:
- Dev-only (`db:generate` tooling, not in the deployed Worker) → not exploitable in production.
- Fix available (`drizzle-kit@1.0.0-rc.4`) but requires a compatible `drizzle-orm` bump that itself breaks (`ERR_PACKAGE_PATH_NOT_EXPORTED` on `drizzle-orm/_relations`) — high compatibility risk for a dev-tool-only fix.
- Decision made: **monitor**, documented with reasoning in Issue #5, not silently ignored.

Apply the same rigor to Alert #13 once its identity is known — do not default to "monitor" without walking through each row.
