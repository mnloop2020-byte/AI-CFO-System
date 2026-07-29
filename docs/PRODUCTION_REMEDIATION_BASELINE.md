# AI CFO System — Production Remediation Baseline

Date: 2026-07-28

Scope: Phase 0 only — baseline verification before remediation.

This document records the repository and verification state before any
Production-readiness fixes. No application code, migration, remote data,
environment value, AI provider, or business rule was changed during this
phase.

## 1. Repository baseline

- Repository: `C:\Users\hamza\zemam-core-agent`
- Branch: `checkpoint/pre-single-company-auth-20260720`
- Current commit: `b0f7d36314d7c96b9de4beb26a472095c5926d5d`
- Required MVP baseline commit: `b0f7d36314d7c96b9de4beb26a472095c5926d5d`
- Difference from required baseline: none.
- Initial Git status: clean.
- Staged changes: none.
- Untracked changes: none.
- Repository-level `AGENTS.md`: not present.
- CI/CD configuration: not present.
- Container configuration: not present.
- Lock files: `frontend/package-lock.json` is present.
- Python lock or fully pinned requirements: not present.

Environment files found by name:

- `backend-python/.env` — ignored.
- `backend-python/.env.example` — tracked.
- `frontend/.env.local` — ignored.
- `frontend/.env.example` — tracked.

No environment values or secrets are recorded in this report. The direct
database connection configuration currently available in the ignored backend
environment did not connect to the linked project and appears stale. The
Supabase CLI link itself was verified successfully. Any future direct database
operation must use a newly verified connection for the exact target
environment.

Tracked artifact review found no committed PDF, screenshot, private key, or
runtime log. `desktop.ini` is tracked even though it is listed in
`.gitignore`; this is low-risk repository hygiene debt.

## 2. Source documents reviewed

- `docs/MVP_ACCEPTANCE_REPORT.md`
- `docs/CURRENT_STATUS.md`
- `docs/PROJECT_ROADMAP.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/SECURITY_OPERATIONS.md`
- Frontend and backend manifests and environment examples.
- Current Supabase migration sequence.
- Current health, security middleware, AI client, financial schemas, stores,
  deterministic tools, frontend API types, forms, and KPI calculations.

The current code and executed checks take precedence over claims in these
documents.

## 3. Baseline commands and results

### Backend

| Command | Result |
| --- | --- |
| `.\.venv\Scripts\python.exe -m pytest -q` | Passed: 117 tests in 17.93 seconds |
| `.\.venv\Scripts\python.exe -m compileall -q app tests` | Passed |
| `.\.venv\Scripts\python.exe -m pip check` | Passed: no broken requirements |
| `pip show pip-audit ruff mypy` | Not installed/configured |

No skipped, xfailed, or failed test was reported by the current suite.

### Frontend

| Command | Result |
| --- | --- |
| `npm test` | Passed: 32 tests |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed with Next.js 15.5.19; 22 application routes generated |
| `npm audit --omit=dev --json` | Failed: 3 HIGH Production vulnerabilities |

Frontend test groups:

- Chat contract: 8 passed.
- Company settings: 4 passed.
- Profile validation: 4 passed.
- Auth/access: 7 passed.
- CRM contract: 4 passed.
- Invoice delivery contract: 4 passed.
- Language provider: 1 passed.

The project has no explicit lint script or ESLint configuration. The Next.js
build completed its built-in type/build validation, but this is not a
substitute for a configured linter.

### Dependency audit

Installed relevant versions:

- `next@15.5.19` — direct Production dependency.
- Next-bundled `postcss@8.4.31` — transitive.
- `sharp@0.34.5` — transitive.
- Root `postcss@8.5.15`.

`npm audit --omit=dev` reports:

- `next`: HIGH; affected by published DoS, SSRF, cache, disclosure, and image
  optimization advisories. A compatible fix is reported as available.
- `postcss`: HIGH through the Next.js dependency path.
- `sharp`: HIGH through the Next.js dependency path.

Python dependency vulnerability status is not verified because `pip-audit`
is not installed and `requirements.txt` is unpinned. `pip check` only proves
that the current environment has no broken dependency relationships.

### Supabase migrations

`npx --yes supabase migration list --linked` passed. Thirteen local migration
versions match thirteen remote versions:

- `20260719141000`
- `20260719193000`
- `20260720170000`
- `20260720223000`
- `20260721100000`
- `20260721123000`
- `20260722100000`
- `20260722103000`
- `20260722113000`
- `20260722140000`
- `20260722180000`
- `20260722190000`
- `20260723120000`

This proves migration-history alignment for the linked project. It does not
prove that the repository can bootstrap a blank database.

## 4. Confirmed remediation gaps

### 4.1 Financial precision

Core monetary schemas still use Python `float`:

- Sales: `unit_price`, `total_amount`.
- Expenses: `amount`.
- Inventory: `cost_price`, `selling_price`.
- Invoices: `total_amount`, `vat_amount`.
- Company financial thresholds.

Stores convert database numeric values to `float`, deterministic tools sum
and round floats, PDF invoice data uses floats, and frontend financial types,
forms, KPIs, and aggregations use JavaScript `number`/`Number(...)`.

The Action Center already uses `Decimal` for several financial-impact fields,
and company opening balance uses `Decimal`; therefore the project currently
has mixed money representations.

Database migrations explicitly define `numeric(18,2)` for opening balance and
Action financial impact, but the repository does not contain the original
creation SQL for several CRM money columns. Their actual definitions must be
captured from a verified isolated/current schema before a conversion migration
is designed.

### 4.2 Dependency vulnerabilities

Three HIGH Production dependency findings are confirmed. No dependency was
changed during Phase 0. Phase 2 must update the smallest compatible dependency
set, preserve `package-lock.json`, and repeat tests, build, audit, and smoke
checks.

### 4.3 AI provider availability and coupling

The current client is created at import time and is configured with
OpenRouter-specific environment names. A missing key raises during import.
The known live provider condition is HTTP 402, and no new provider has been
selected.

The deterministic application features can operate independently in design,
but the current startup/provider construction does not yet provide a clean
provider-neutral degraded mode. Provider replacement is intentionally Phase 9
and requires owner selection plus credentials.

### 4.4 Blank-database reproducibility

Current migrations do not create these required base tables:

- `customers`
- `sales`
- `expenses`
- `inventory`
- `invoices`
- `conversations`
- `messages`

Later migrations alter or reference those tables. A fresh clone therefore
cannot reliably create the complete schema from the committed migration
sequence alone.

No production migration or remote schema change is authorized here. A
complete baseline migration strategy must be tested twice against an isolated
blank Supabase/PostgreSQL environment before any deployment decision.

### 4.5 Backup and restore

Backup and restore procedures are documented, but no actual isolated restore
drill with row-count/checksum and private Storage verification is recorded.
This remains unverified.

### 4.6 Readiness and observability

`/health/live` correctly represents process liveness. `/health/ready` only
checks whether three configuration values are present; it does not test
database connectivity or distinguish an unavailable optional AI provider.
It can therefore report ready while a dependency is unusable.

Request IDs and structured request logging exist. Missing Production controls
include:

- External error-tracking connection and verification.
- Metrics collection and alerting.
- Central log collection/retention.
- Dependency-specific health semantics.
- Documented operational ownership and tested incident workflow.

### 4.7 Rate limiting and environment strategy

Rate limits exist for Auth, Chat, Reports, RAG, Attachments, and Actions, but
the limiter is process-local and keyed by client IP. It is unsuitable for a
multi-instance Production deployment.

There is no Redis/shared limiter, CI/CD workflow, isolated Staging
configuration, Production hosting definition, or automated deployment gate.

Frontend CSP and backend CORS are currently local-development oriented and
require environment-specific exact allowlists for Staging/Production.

## 5. Money-flow map for Phase 1 planning

Current money flow:

```text
HTML number input
→ JavaScript number in React state
→ TypeScript API payload using number
→ Pydantic float validation
→ Python store/service float calculations
→ PostgreSQL numeric or legacy numeric column
→ Supabase JSON number
→ Python float conversion
→ deterministic tools/PDF/agents using float
→ API JSON number
→ JavaScript Number(...) aggregation and Intl.NumberFormat
```

The Phase 1 target must preserve exact decimal strings at transport
boundaries, use `Decimal` internally, define currency minor-unit and rounding
rules centrally, keep PostgreSQL numeric columns, and make the server the
source of truth for derived totals.

## 6. Expected files and areas by remediation phase

This is a planning list, not authorization to edit every file.

### Phase 1 — money and rounding

- `backend-python/app/schemas/{sales,expenses,inventory,invoices,company,action}_schema.py`
- `backend-python/app/services/{sales,expenses,inventory,invoices}_store.py`
- `backend-python/app/services/action_engine.py`
- `backend-python/app/services/action_metrics.py`
- `backend-python/app/services/invoice_pdf_service.py`
- `backend-python/app/services/invoice_delivery_service.py`
- `backend-python/app/tools/{sales,accounting,cashflow,inventory,tax,fraud}_tools.py`
- `backend-python/app/ai/financial_grounding.py`
- Financial backend tests and PDF tests.
- `frontend/lib/{sales,expenses,inventory,invoices,company,actions}.ts`
- Financial forms, tables, dashboard/KPI pages, and frontend tests.
- A new reviewed migration only if verified database column definitions
  require changes.
- `docs/MONEY_AND_ROUNDING_POLICY.md`

`accounting_agent.py` should remain unchanged unless Phase 1 evidence proves
that a direct precision change is required there.

### Phase 2 — dependencies

- `frontend/package.json`
- `frontend/package-lock.json`
- Potentially Python requirements plus a reviewed pinning/lock strategy.
- Frontend tests/build and dependency reports.
- `docs/DEPENDENCY_SECURITY_REPORT.md`

### Phase 3 — database bootstrap

- New forward-only baseline/bootstrap migration files or a reviewed schema
  baseline strategy.
- `supabase/verification/` checks.
- Database integration/RLS tests.
- `docs/DATABASE_BOOTSTRAP_AND_MIGRATION_GUIDE.md`

Existing applied migrations must not be rewritten or deleted.

### Phases 4–8 — operations, security, CI, and verification

- Backup/restore scripts or commands targeting isolated environments only.
- Health/config/logging/error-tracking modules.
- Shared rate-limiter abstraction and configuration.
- Environment examples and deployment configuration.
- CI workflow files.
- E2E and performance test configuration.
- The runbooks and reports required by the remediation specification.

### Phase 9 — AI provider

- Provider-neutral adapter, configuration, mock provider, normalized errors,
  usage/cost controls, and agent safety tests.
- `backend-python/app/ai/llm.py` and direct consumers after adapter analysis.
- `docs/AI_PROVIDER_ARCHITECTURE.md`
- `docs/AI_AGENT_SAFETY_TEST_REPORT.md`

No provider or model is selected by Phase 0.

## 7. Tests not executed in Phase 0

| Test | Reason |
| --- | --- |
| Existing live E2E scripts | They write to the linked remote development project; no isolated test environment was supplied for this phase |
| Blank-database bootstrap | No isolated blank Supabase/PostgreSQL environment is configured |
| Backup/restore drill | Requires an isolated target, verified backup credentials, and controlled destructive test operations |
| Live AI smoke test | Current provider is known to return 402; provider replacement is explicitly deferred |
| Live SMTP delivery | No approved provider/configuration and real email is prohibited |
| Load/performance tests | No isolated dataset/environment or performance framework is currently configured |
| Python vulnerability scan | `pip-audit` is not installed |
| Python lint/type checks | Ruff and Mypy are not installed/configured |
| Frontend lint | No lint script/configuration exists |
| Penetration/DAST testing | No approved isolated target or toolchain is configured |

## 8. Required execution order

1. Financial precision and money/rounding policy.
2. Frontend and Python dependency security.
3. Reproducible blank-database bootstrap.
4. Isolated backup/restore rehearsal.
5. Readiness, observability, and failure semantics.
6. Shared rate limiting and operational security.
7. Isolated environments and CI/CD.
8. E2E and performance baseline.
9. Owner-selected AI provider adapter and live safety verification.
10. Documentation/commercial readiness.
11. Clean final acceptance suite and readiness reassessment.

No later phase should compensate for a failed earlier gate.

## 9. Decisions, environments, or secrets required later

The following are genuine blocking inputs and should not be guessed:

1. An isolated Supabase project or local stack for blank-schema, RLS, E2E,
   and restore tests.
2. A verified backup source/target and retention/RPO/RTO decision.
3. Selection and credentials for a shared Redis-compatible rate-limit store.
4. Selection and credentials for error tracking, metrics, and alerting.
5. Staging and Production hosting/domain strategy.
6. Owner selection of the new AI provider/model, budget, and credentials.
7. SMTP provider only if real invoice email is brought into scope.
8. Currency support policy: fixed two-decimal scope for the Pilot or
   currency-specific minor units.
9. Regional privacy, accounting, tax, retention, and legal decisions.

## 10. Phase 0 gate

Phase 0 verification is complete when this file is the only repository
change and its contents match the executed evidence.

Current gate outcome:

- Existing MVP regression tests: passed.
- Compilation/type checks/build: passed.
- HIGH dependency vulnerabilities: confirmed.
- Financial float usage: confirmed.
- Blank-database migration gap: confirmed.
- Restore rehearsal: not verified.
- Production observability/staging/shared rate limiting: not implemented.
- Live AI: not verified and known externally blocked.

No remediation phase has started. Explicit owner approval is required before
Phase 1.
