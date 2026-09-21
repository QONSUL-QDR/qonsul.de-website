# Production Artifact Workflow

## Purpose

`Build production candidate artifact` creates a sealed, reviewable build artifact. It never deploys, changes Cloudflare, runs a D1 migration, or receives application runtime secrets.

The workflow file must live on the default branch (`main`) so GitHub can offer `workflow_dispatch`. The source it builds is nevertheless only the entered protected tag, never the default branch. The workflow uses two independent checkouts:

1. `control`: default-branch scripts that validate provenance before candidate code runs.
2. `candidate`: the protected annotated release tag, checked out only after successful validation.

## Required inputs

| Input | Required value |
| --- | --- |
| `release_tag` | `website-production-candidate-*` |
| `expected_commit` | full peeled commit SHA |
| `expected_tree` | full tree SHA for that commit |
| `ci_run_id` | successful GitHub CI run for that commit |

Before candidate checkout, the control scripts require an annotated tag, matching tag message, matching remote commit/tree, and an active non-bypassable Ruleset that blocks deletion, non-fast-forward updates, and updates for the tag pattern. The referenced run must be successful for the peeled commit **and** have the GitHub workflow ID and path of `.github/workflows/ci.yml`. The manifest preserves the CI run ID, workflow ID, and workflow path.

The validation checkout records its exact control commit. The build job checks out that immutable SHA rather than `main`, rechecks it immediately, and rechecks it again before sealing.

## Environment

The build job uses the protected GitHub Environment `production-artifact`. It requires only non-secret variables:

- `PRODUCTION_WORKER_NAME`
- `PRODUCTION_D1_DATABASE_ID`
- `PRODUCTION_D1_DATABASE_NAME`
- `PUBLIC_SITE_URL` (exactly `https://qonsul.de`)

No Cloudflare API token, Cockpit secret, Resend key, OpenAI key, webhook secret, or application runtime secret may be available to this workflow. Runtime secrets remain exclusively in the later Production Worker configuration.

The workflow fail-closes on every binding deviation. The approved Production Worker is `qonsul-de`; its approved `DB` binding is `qonsul-website-d1` with the Owner-confirmed database UUID. The former generic rejection of that name was removed because the Owner verified it as the live binding. Staging databases, placeholders, and every Worker, D1 ID, D1 name, or public URL deviation are rejected. It derives `build_id` as `${commit}:${tree}` before the build, and supplies that ID together with `SOURCE_COMMIT_SHA` as non-secret build constants. `/api/status` exposes only this candidate commit and build ID when present.

The existing Sites plugin uses a preview-hosting project configuration without a verifiable analytics endpoint. For `PRODUCTION_ARTIFACT_BUILD=true` it is therefore disabled. The build accepts only `https://cockpit.qonsul.de/api/v1/analytics/events` as its explicit analytics endpoint configuration; a staging, preview, Workers, blank, or any other endpoint aborts the build before plugin setup. The artifact build does not send analytics events.

## Artifact and verification

Only `dist/` and `release-metadata.json` enter `website-production-candidate.tar.gz`. Symlinks, non-regular files, traversal paths, and absolute paths are rejected before archiving. The sibling `release-manifest.json` records the archive SHA-256, protected tag object, commit, tree, CI workflow provenance, control commit, build ID, tool versions, SHA-256 fingerprints of non-secret bindings, and a SHA-256 plus byte size for every archived file.

The GitHub Artifact contains exactly the archive and manifest. A future, separately authorized deployment workflow must download it, verify the GitHub Artifact digest plus the manifest archive hash, re-resolve the protected tag, and compare commit, tree, build ID, and binding fingerprints before it may obtain a Cloudflare deployment credential.

## Explicit deployment gate

This workflow does not deploy. A later deployment workflow needs a separate PR, independent Owner approval, a protected Production Environment, a production-only Cloudflare API token, read-only identity preflight, and an explicit deployment authorization. No deployment is an implied consequence of producing an artifact.
