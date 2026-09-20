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

Before candidate checkout, the control scripts require an annotated tag, matching tag message, matching remote commit/tree, a successful CI run, and an active non-bypassable Ruleset that blocks deletion, non-fast-forward updates, and updates for the tag pattern.

## Environment

The build job uses the protected GitHub Environment `production-artifact`. It requires only non-secret variables:

- `PRODUCTION_WORKER_NAME`
- `PRODUCTION_D1_DATABASE_ID`
- `PRODUCTION_D1_DATABASE_NAME`
- `PUBLIC_SITE_URL` (exactly `https://qonsul.de`)

No Cloudflare API token, Cockpit secret, Resend key, OpenAI key, webhook secret, or application runtime secret may be available to this workflow. Runtime secrets remain exclusively in the later Production Worker configuration.

The workflow rejects blank values, placeholder IDs, obvious staging/preview Worker names, the known local/staging D1 name, and any non-canonical public URL. It builds with `SOURCE_COMMIT_SHA` set to the validated candidate commit so `/api/status` carries the candidate identity rather than the default-branch workflow SHA.

## Artifact and verification

Only `dist/` and `release-metadata.json` enter `website-production-candidate.tar.gz`. The sibling `release-manifest.json` records the archive SHA-256, protected tag object, commit, tree, CI run, control commit, build ID, tool versions, and SHA-256 fingerprints of non-secret bindings.

The GitHub Artifact contains exactly the archive and manifest. A future, separately authorized deployment workflow must download it, verify the GitHub Artifact digest plus the manifest archive hash, re-resolve the protected tag, and compare commit, tree, build ID, and binding fingerprints before it may obtain a Cloudflare deployment credential.

## Explicit deployment gate

This workflow does not deploy. A later deployment workflow needs a separate PR, independent Owner approval, a protected Production Environment, a production-only Cloudflare API token, read-only identity preflight, and an explicit deployment authorization. No deployment is an implied consequence of producing an artifact.
