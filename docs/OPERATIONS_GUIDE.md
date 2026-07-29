# AI CFO System Operations Guide

Last updated: 2026-07-29

## Product model

The current release is **Single Company + Multiple Users**. One deployed instance serves one company. The schema retains `companies`, `company_members`, and `company_id` so a future multi-company release can be designed separately. The browser never sends or selects a company identifier.

## Required environment configuration

Copy the example files locally and set values in ignored environment files. Never commit them or paste their contents into logs or tickets.

Backend names:

- `APP_ENV`: `development`, `test`, `pilot`, or `production`
- `CORS_ALLOWED_ORIGINS`: comma-separated exact frontend origins; required
  with HTTPS-only values in `pilot` and `production`
- `RATE_LIMIT_BACKEND`: use `memory` only for development/test and `redis` for
  Pilot/Production
- `RATE_LIMIT_REDIS_URL`: managed Redis connection URL; deployed environments
  require TLS using `rediss://`
- `METRICS_BEARER_TOKEN`: dedicated random monitoring token of at least 32
  characters; required for Pilot/Production and never exposed to the frontend
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for explicitly trusted background/admin operations only
- `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, and `LLM_MODEL`
- `BOOTSTRAP_OWNER_EMAIL` and the one-time Bootstrap secret only during initial ownership setup
- Optional documented limits: LLM timeout/retries, Chat history/message bounds, and RAG context/file limits

Frontend names:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_API_URL`

Only publishable values may use the `NEXT_PUBLIC_` prefix. Never expose the Service Role key.

## Local startup

Backend:

```powershell
cd C:\Users\hamza\zemam-core-agent\backend-python
& ".\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd C:\Users\hamza\zemam-core-agent\frontend
npm run dev
```

Open `http://localhost:3000`. Health endpoints are `GET /health/live` and `GET /health/ready`.

The protected Prometheus endpoint is `GET /internal/metrics`. See
`docs/MONITORING_AND_ALERTING.md`; never reuse a user access token or expose the
monitoring token in a browser bundle.

## Company and Owner setup

1. Apply only the reviewed migration sequence to the linked project.
2. Confirm exactly one company exists and protected row counts match the migration audit.
3. Configure the allowed Owner email and one-time Bootstrap secret in the backend environment.
4. Create and confirm the matching Supabase Auth user.
5. Run the Bootstrap endpoint once, verify the Owner membership, then confirm Bootstrap is consumed and closed.
6. Remove the temporary Bootstrap secret from the active environment when operationally practical.

Public self-registration remains closed after Bootstrap.

## Roles

| Role | Financial data | Reports/documents | Actions | Members/invitations | Company settings |
|---|---|---|---|---|---|
| Owner | Read/write | Read/write | Detect, assign, approve, manage | Full, with last-Owner protection | Read/write |
| Admin | Read/write | Read/write | Detect, assign, approve, manage | Manage, cannot change/remove an Owner | Read/write |
| Accountant | Read/write | Read/write | Detect and work; cannot assign/approve | No access | Read only |
| Viewer | Read only | Read only | Read only | No access | Read only |

New users join only through a time-limited, exact-email, one-time invitation from Owner/Admin.

## Privileged-role MFA

- Owner and Admin must complete TOTP verification before accessing company data.
- Password sign-in begins at `aal1`; the application redirects privileged users to `/login/mfa`, where a TOTP factor is enrolled and verified through Supabase Auth.
- A factor is not treated as enabled until the first TOTP code is verified successfully. Verification promotes the session to `aal2` and revokes the prior `aal1` session.
- FastAPI rejects Owner/Admin business requests at `aal1`. Restrictive RLS applies the same rule directly to all current public RLS tables and private Storage objects.
- `/auth/me` and Supabase Auth remain available at `aal1`, providing the safe setup path that prevents a privileged account from being locked out before enrollment.
- The current release does not provide recovery codes or a self-service factor reset. Before target deployment, designate a human recovery owner and verify the Supabase administrative recovery procedure.

## Reports and attachments

- Generated report content comes from live RLS-scoped data and is rendered into a real bilingual PDF.
- Report metadata is stored in `reports`; PDF files are private in the `reports` bucket and downloaded through short-lived signed URLs.
- Invoice/expense attachments accept validated PDF/PNG/JPEG files up to 5 MB. MIME, extension, and actual file signature must agree.
- Deleting an attachment removes that file only; it never deletes the invoice or expense.

## RAG documents

- Documents are private and company-scoped, with `uploaded`, `processing`, `ready`, and `failed` states.
- Answers cite the document filename and chunk number. Document content is treated as untrusted evidence and cannot alter system instructions or tool permissions.
- Do not upload real company documents until the deployment's RLS, backups, domain, monitoring, MFA, and distributed rate limiting are approved.

## Financial Action Center

- Detection is deterministic for overdue invoices, low inventory, and flagged expenses.
- Actions carry evidence, source IDs, linked value, assignee, due date, approval state, and audit timeline.
- Repeated detection is deduplicated. Execution retries are idempotent.
- Approval authorizes only the exact stored draft for 24 hours. Editing an approved draft invalidates approval.
- Email reminders remain `pending_integration`; purchases, payments, and external financial actions are never executed by this release.

## Verification commands

```powershell
cd C:\Users\hamza\zemam-core-agent\backend-python
& ".\.venv\Scripts\python.exe" -m pytest -q
& ".\.venv\Scripts\python.exe" -m compileall -q app tests

cd C:\Users\hamza\zemam-core-agent\frontend
npx tsc --noEmit
npm run build
```

Run the explicit live role/Storage and Action Center checks only against the confirmed development project. They never print credentials and remove only temporary Storage objects created by the check.

Run the read-only local HTTP readiness gate:

```powershell
cd C:\Users\hamza\zemam-core-agent\backend-python
& ".\.venv\Scripts\python.exe" scripts\pilot_readiness_check.py
```

For a target Pilot, pass the exact HTTPS origins. Target mode rejects loopback
or HTTP endpoints and requires HSTS:

```powershell
& ".\.venv\Scripts\python.exe" scripts\pilot_readiness_check.py `
  --mode target `
  --api-url "https://api.example.com" `
  --frontend-url "https://app.example.com"
```

The gate performs public, read-only HTTP checks only. It does not authenticate,
read business records, write database rows, or print secrets or response bodies.

## Production runtime

The reviewed container and reverse-proxy contract is documented in
`docs/PRODUCTION_RUNTIME.md`. Deployed Backend instances must set an explicit
`FORWARDED_ALLOW_IPS` allowlist and run one Uvicorn worker per container.
Deployed Frontend images must be built with exact HTTPS API and Supabase origins;
these values generate the CSP allowlist and are embedded at build time.

The repository does not contain target secrets, ingress credentials, or an
automatic Production deployment. TLS/HSTS, image scanning and digest pinning,
resource limits, and external secret injection remain responsibilities of the
selected hosting platform and human release owner.

## Known limitations

- Single Company only; there is no company switcher.
- TOTP MFA is implemented and verified locally. Applying its reviewed migration
  and rehearsing privileged-account recovery in the target environment remain
  Production blockers.
- Redis-backed rate limiting is implemented for multi-instance deployment.
  Production still requires a managed TLS Redis service with monitored
  availability and capacity. If Redis is unavailable, protected requests fail
  closed with `503` and a short `Retry-After`.
- Email, payment, banking, and purchasing integrations are not configured.
- Collection cannot be attributed to AI until a verifiable payment timestamp and transaction reference exist.
- AI output requires human review and is not a complete legal, tax, audit, or accounting substitute.
