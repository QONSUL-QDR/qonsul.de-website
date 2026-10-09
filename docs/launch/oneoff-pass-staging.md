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
| `STAGING_D1_DATABASE_ID` | Existing Staging D1 binding ID |
| `STAGING_D1_DATABASE_NAME` | Existing D1 name ending in `-staging` |

It must contain the GitHub Environment secret
`STAGING_CLOUDFLARE_API_TOKEN`, scoped in Cloudflare to this existing Worker.
The Worker itself must already contain `QONSUL_COCKPIT_INTAKE_SECRET` as a
secret binding. The preflight checks only its name and type. Neither the build
job nor the uploaded artifact receives its value.

The preflight reads only the fixed Staging Worker settings and status. It
requires the current Staging commit and tree to be the known predecessor,
compares the existing intake URL and D1 binding, and checks the secret name.
The build adds the exact Staging URL to the generated Worker configuration.
Wrangler uses `--keep-vars` to retain other existing runtime variables and
preserves existing secrets. No migration is run.

The manifest contains source commit/tree, content digest, workflow run ID,
control commit, fixed target, and a run-derived deploy ID. After deployment,
the workflow checks HTTP 200 and the historical `/api/status`
`candidateIdentity.commit` and `candidateIdentity.buildId` values. It also
requires `ai` and `diagnosticReady` to be true. A rerun of the same workflow
run fails, and a new dispatch after a successful roll-forward fails the
predecessor check.

After this workflow file has been merged into the repository default branch,
the one controlled dispatch is:

```sh
gh workflow run deploy-oneoff-pass-staging.yml --repo QONSUL-QDR/qonsul.de-website --ref main
```

The dispatch does not perform a synthetic Diagnostic. Prepare that single
Staging E2E procedure only after the deployment and status checks pass.
