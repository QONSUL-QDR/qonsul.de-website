# One-off PASS website reconciliation on Staging

This control is manual and has no inputs. It fetches only the historical source
commit `70464ab0210b43c2e6d71bf980d08a3a01121e33` and verifies its tree
`9cb9e824a5e3c4082d595194dd59d4f083753bff` before installation or build.
The packaged Worker is fixed to
`qonsul-website-staging-reconciliation` at
`https://qonsul-website-staging-reconciliation.qonsul.workers.dev`.

The GitHub Environment `website-staging-deployment` must contain these
non-secret variables:

| Name | Required condition |
| --- | --- |
| `QONSUL_COCKPIT_INTAKE_URL` | Exactly `https://cockpit-staging.qonsul.de` |
| `STAGING_CLOUDFLARE_ACCOUNT_ID` | Account containing the existing Staging Worker |
| `STAGING_D1_DATABASE_ID` | Exactly `fb630d44-5d0d-46ae-9f63-bced28916e8e` |
| `STAGING_D1_DATABASE_NAME` | Exactly `qonsul-website-d1-staging-reconciliation` |

It must contain the GitHub Environment secret
`STAGING_CLOUDFLARE_API_TOKEN`, scoped in Cloudflare to this existing Worker.
The Worker itself must already contain `QONSUL_COCKPIT_INTAKE_SECRET` as a
secret binding. The preflight checks only its name and type. Neither the build
job nor the uploaded artifact receives its value.

The preflight reads only the fixed Staging Worker settings and status. It
requires the current Staging commit and tree to be the known predecessor,
compares the Worker name, workers.dev URL, intake URL, D1 binding, routes,
custom domains, schedules, compatibility settings and observability, and
checks the secret name without reading its value. The only configuration
differences allowed through the preflight are `assets` and `d1_databases`.
The build adds the exact Staging URL to the generated Worker configuration.
After that allowlist passes, Wrangler deploys once without `--strict` and uses
`--keep-vars` to retain existing runtime variables and secrets. It does not use
`--force`, change routes or triggers, write secrets or variables, or run a
migration.

The manifest contains source commit/tree, content digest, workflow run ID,
control commit, fixed target, and a run-derived deploy ID. After deployment,
the workflow checks the same remote bindings again, then requires HTTP 200
from `/api/status` plus the historical `candidateIdentity.commit`
and `candidateIdentity.buildId` values. It also requires `ai` and
`diagnosticReady` to be true. A rerun of the same workflow
run fails, and a new dispatch after a successful roll-forward fails the
predecessor check.

After this workflow file has been merged into the repository default branch,
the one controlled dispatch is:

```sh
gh workflow run deploy-oneoff-pass-staging.yml --repo QONSUL-QDR/qonsul.de-website --ref main
```

The dispatch does not perform a synthetic Diagnostic. Prepare that single
Staging E2E procedure only after the deployment and status checks pass.
