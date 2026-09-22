# Sealed Production Deployment Workflow

`Deploy sealed production artifact` is a separate, manual workflow. It is not triggered by a tag, CI success, the artifact workflow, or a merge. It must only be dispatched from `main` and accepts exactly five mandatory inputs:

| Input | Required value |
| --- | --- |
| `artifact_name` | `production-candidate-<tag>-<commit>` |
| `release_tag` | protected `website-production-candidate-YYYY-MM-DD` tag |
| `expected_commit` | complete peeled Candidate commit SHA |
| `expected_tree` | complete Candidate tree SHA |
| `artifact_digest` | exact `sha256:<hex>` GitHub Artifact digest |

## Pre-deployment trust boundary

Before the deployment job can enter `production-deployment` or access a Cloudflare credential, the workflow:

1. checks the manual inputs and exact artifact-name binding;
2. fetches and revalidates the protected annotated Candidate tag, its commit/tree, tag-object, Ruleset, and successful CI workflow identity;
3. finds exactly one unexpired GitHub Artifact with the supplied name and GitHub digest;
4. downloads only that Artifact, accepts exactly its archive and `release-manifest.json`, and verifies the archive SHA-256, byte size, every file SHA-256 and size, and the tar allowlist without extracting arbitrary paths;
5. compares manifest and embedded metadata provenance, Candidate CI identity, build ID, binding fingerprints, and the sealed Worker configuration; and
6. rejects every Worker other than `qonsul-de`, every `DB` binding other than the Owner-approved Production D1 identity, non-`https://qonsul.de` site metadata, routes, custom-domain declarations, and migration configuration.

The workflow never runs a D1 migration, changes a database, changes DNS, routes, or custom domains, or receives Cloudflare credentials in its validation job. The existing artifact workflow continues to receive no Cloudflare credential.

## Required owner configuration before any future dispatch

Create GitHub Environment `production-deployment` manually. Configure it before dispatching:

- Add at least one Required Reviewer; do not enable bypass.
- Set Deployment branches to **Selected branches** with exactly `main`.
- Add only the production Cloudflare deployment credential as secret `CLOUDFLARE_API_TOKEN`. Do not put that secret in repository settings, `production-artifact`, or any other Environment.
- Add non-secret Environment variables `PRODUCTION_D1_BACKUP_EVIDENCE_URL` and `PRODUCTION_ROLLBACK_EVIDENCE_URL`. Each must be an HTTPS URL to immutable, reviewable evidence. Set the D1 backup evidence only after a verified recoverable Production backup exists; set rollback evidence to the approved prior Worker-version/runbook record.

At runtime the deployment job calls the GitHub Environment APIs and fails closed unless those reviewers and the exact `main` branch policy are present. It also fails closed when either evidence URL or the Cloudflare credential is missing.

## Approved manual cutover

1. Confirm the Candidate artifact run completed successfully and copy its Artifact name and GitHub digest from the immutable summary.
2. Confirm the Candidate tag, commit, tree, and CI run against the tag annotation.
3. Produce and independently verify a recoverable Production D1 backup. Record immutable evidence and the tested rollback target; update only the two evidence variables in `production-deployment`.
4. Dispatch the deployment workflow from `main` with the five exact values. Do not dispatch from a branch or use an artifact from another Worker.
5. Review the Environment request. The workflow deploys only the verified Worker bundle through pinned Wrangler `4.127.1` after the review.
6. It then performs public HTTPS-only smoke tests for `https://qonsul.de`, `/api/status` Candidate identity, and the noindex/nofollow robots plus canonical strategy. A missing canonical is allowed only while the response explicitly remains noindex/nofollow; a present canonical must be exactly `https://qonsul.de/`.
7. If smoke fails, do not make DNS, route, D1, or secret changes. Follow the reviewed rollback evidence manually to deploy the prior approved Worker version, then preserve the run logs for incident review.

The workflow does not perform automatic rollback because changing a live Worker is an Owner decision.
