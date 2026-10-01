# Restoration source matrix

This recovery is intentionally limited to the previously verified staging website baseline. It does not add or claim a 30-day report or lead flow.

| Source | Adopted files and responsibilities |
| --- | --- |
| `website-staging-reconciliation` at `cef82619f109424df2f18028272b6619fad121fc` | `app/quality-diagnostic-lab.tsx`; Diagnostic, AI-hypothesis, AI-status, and consultation-correction routes; Diagnostic/Cockpit/AI contracts and clients; analysis blind-spot support; server response support; focused contract tests. |
| `phase-11b-public-ai-cause-assistance` at `1099e8b6039bc1a237a8c5f7be1570eb6c25c645` | `app/analytics-consent.tsx` and the matching fixed-position consent/status CSS in `app/globals.css`; no portal or footer slot. |
| PR #33 / `staging/phase-13-e2e-reconciliation` at `fce749afe1adf8b09cca37e96e0b20ccabfe687b` | No files adopted. Its staging runtime is pinned to an older commit/tree and its deploy workflow is restricted to the PR #33 branch, so it is neither compatible with nor required for this local application recovery PR. |

`app/quality-site.tsx` is the integration point: it renders `QualityDiagnosticLab` and removes only the analytics footer slot. The historical `app/ishikawa-lab.tsx` and `/api/reports` implementation remain untouched and are not connected to the visible Quality Diagnostic flow.
