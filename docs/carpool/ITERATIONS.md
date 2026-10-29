# Carpool iteration log

Upstream baseline: `v0.2.19`, `dece26153621959ccd7635814f4b2d08304e681a`.
Each version below is a substantive, separately committed increment. No production service or paid model was called during development.

## Version 01 — Administrator usage workspace

- Blue/white responsive workspace, administrator-only menu and actual route guard.
- Real daily usage aggregates, model cost share, selectable cost/token/request ranking (explicit Top 200 limit), date validation and CSV export.
- Actual member charges are distinguished from upstream procurement costs; no invented shared budgets or sample runtime metrics.
- Cancel and stale-response protection; separate empty, loading and partial-error states; spreadsheet formula-injection defense.
- Simple Mode cannot enter this billing-dependent workspace.
- Upstream release/publishing and CLA automation are preserved outside GitHub’s active workflows directory. Security checks run on code changes, not an unsolicited weekly schedule; CI remains read-only.
- Validation: 28 analytics/helper tests and 5 actual route-guard tests passed; existing feature-access tests also passed. First integrated frontend baseline: 381 files / 3,076 tests passed, full ESLint passed, production build (including i18n and `vue-tsc -b`) passed. Each later increment is rechecked separately.
- Browser rendering remains blocked by the execution environment: Chromium IPC socket permission failure; normal escalation failed in runner initialization. The separate supported cloud-browser tab cannot reach this executor's localhost. This is not presented as successful visual QA.

## Version 02 — Members, subscriptions and safe balance adjustments

- Added the Members & subscriptions workspace: paginated search, status filtering, current subscriptions/expiry, direct subscription assignment and existing quota/plan configuration links.
- Subscription and balance are not mutually exclusive; the API key's selected group determines billing. No new payment processor or fictitious monthly balance quota.
- Balance additions require an audit note and a stable, administrator-scoped idempotency key. Uncertain outcomes must be reconciled before retrying the same operation; close/reopen/navigation cannot silently create a second charge.
- Validation: 23 member/API/idempotency tests passed; zh/en key completeness passed (26 tests together); all changed module files and the integrated workspace passed ESLint. Existing shared `updateBalance` callers remain compatible through an optional fifth argument.
