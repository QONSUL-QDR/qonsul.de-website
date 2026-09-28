# Dependabot Alert #13 — Resolved Classification

**Status: RESOLVED / NON-BLOCKING FOR INITIAL LAUNCH (maintenance follow-up).** Classification provided by the project owner from a prior Codex production-readiness run; the advisory identity and dependency chain below were independently cross-checked against this session's own earlier findings and the actual `pnpm-lock.yaml` on this branch — both match exactly.

## Classification

| Field | Value |
|---|---|
| Advisory | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) |
| Severity | Medium (GitHub Dependabot: moderate) |
| Affected package | `esbuild@0.18.20`, transitive via `drizzle-kit` |
| Exact chain (confirmed this session in `pnpm-lock.yaml`) | `drizzle-kit@0.31.10` → `@esbuild-kit/core-utils@3.3.2` → `esbuild@0.18.20` |
| Direct or transitive | Transitive (three levels deep) |
| Runtime or dev-only | Dev-only — `drizzle-kit` is only invoked via `pnpm db:generate`; not present in the deployed Cloudflare Worker's runtime bundle |
| Production Worker runtime path | **None identified** — matches this session's own earlier finding (same advisory, same chain, surfaced independently via `pnpm audit` while evaluating dependency updates for Issue #5) |
| Fix compatibility risk | High if pursued now — `drizzle-kit@1.0.0-rc.4` removes the vulnerable `@esbuild-kit/*` chain entirely, but breaks `pnpm db:generate` against the current `drizzle-orm@0.45.2` (`ERR_PACKAGE_PATH_NOT_EXPORTED` on `drizzle-orm/_relations`), confirmed by direct testing earlier in this project's history (Issue #5) |
| Decision | **Monitor, not fix now** — non-blocking for initial launch, tracked as a maintenance follow-up (upgrade `drizzle-kit`+`drizzle-orm` together as a dedicated, separately-tested change once `drizzle-kit` 1.0 is stable) |

## Why this is genuinely non-blocking, not just deferred

- No code path in the deployed production Worker imports or executes `drizzle-kit` — it is a local/CI-only developer tool (`db:generate` script), never bundled into `dist/server`.
- The advisory itself (esbuild's dev-server request-forgery class of issue) requires an attacker to reach a *running esbuild dev server* — something that only exists transiently on a developer's machine or in CI while `drizzle-kit generate` runs, never in production.
- This reasoning was independently derived in this session before the project-level classification was provided (see Issue #5), and now matches it exactly — not merely accepted on assertion.

## Correction to this document's prior state

An earlier version of this document marked Alert #13 as `UNKNOWN`, since this session had no tool access to GitHub's Security → Dependabot alerts tab by number, and a direct fetch of `.../security/dependabot/13` returned an unauthenticated 404. That remains true — this session still cannot independently look up an alert *by number* — but the project owner has now supplied the classification from a source with that access (a prior Codex run), and it is accepted here because it is independently verifiable (and was independently verified) against this repository's own lockfile and this session's own prior audit output, not accepted on assertion alone.
