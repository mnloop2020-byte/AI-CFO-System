# Production Readiness

Last updated: 2026-07-29

## Pilot verdict

**Ready for a controlled development Pilot with synthetic/non-sensitive data. Not ready for public Production.**

## Completed

- [x] Single-company bootstrap and one-company database constraint
- [x] Invitation-only Supabase Auth, email verification, password reset, and protected redirects
- [x] Owner/Admin/Accountant/Viewer permissions tested
- [x] RLS on business/action/audit tables and private Storage policies
- [x] Live CRUD, Settings, bilingual PDF reports, private report history/downloads
- [x] Validated private RAG documents and invoice/expense attachments
- [x] Deterministic financial grounding and sourced document answers
- [x] Human-approved, deduplicated, idempotent Financial Action Center
- [x] No automatic email, payment, purchase, or external financial execution
- [x] Structured redacted logs, bounded LLM calls/prompts, health endpoints, CSP/security headers
- [x] Migration before/after row-count audits and preserved core test data
- [x] Backend, role/RLS/Storage, Action lifecycle, RAG/upload security, TypeScript, build, and responsive bilingual checks
- [x] Backup and isolated restore-rehearsal procedure documented
- [x] Environment-scoped exact CORS origins; deployed modes reject wildcard,
  non-HTTPS, path-bearing, or implicit origin configuration
- [x] Read-only Pilot HTTP readiness gate for liveness, configuration,
  request IDs, exact CORS, frontend availability, security headers, and HSTS
- [x] Real TOTP enrollment and `aal2` enforcement for Owner/Admin verified
  end to end against Supabase Local, including restrictive business/Storage RLS
- [x] Redis-backed distributed rate limiter implemented with atomic counters,
  TLS-only deployed configuration, fail-closed behavior, and a two-instance
  local Redis integration test
- [x] Protected low-cardinality Prometheus metrics and provider-neutral alert
  rules implemented locally
- [x] Non-root Backend/Frontend container definitions, exact deployed Frontend
  CSP origins, explicit trusted-proxy validation, and bounded Uvicorn runtime
  prepared locally

## Production blockers

- [ ] Apply the reviewed MFA migration to the target environment and verify
  Owner/Admin enrollment, recovery ownership, and `aal2` access before release
- [ ] Provision the managed TLS Redis service and verify distributed limits,
  availability alerts, capacity, and outage behavior in the target environment
- [ ] Configure the final HTTPS domain and exact `CORS_ALLOWED_ORIGINS`, then
  verify secure proxy headers and HSTS with the target-mode readiness gate
- [ ] Build, scan, pin, and exercise the release containers behind the selected
  target ingress with exact `FORWARDED_ALLOW_IPS`
- [x] Complete a local isolated database restore rehearsal with documented checksums
- [ ] Run an encrypted target backup and restore private Storage object bytes in an isolated target environment
- [ ] Connect centralized log/metric collection, validate alert delivery,
  retention, and incident ownership in the target environment
- [ ] Complete penetration testing and dependency/license review in the target deployment environment
- [ ] Confirm regional privacy, retention, accounting, tax, and data-processing requirements with qualified professionals
- [ ] Define production Supabase/OpenRouter budgets, quotas, rotation, outage behavior, and on-call contacts
- [ ] Replace development test accounts/data or formally approve their isolated retention

## External services or secrets still required

- Production Supabase project configuration and rotated production publishable/Service Role credentials
- Production OpenRouter key and usage budget
- Redis-compatible shared rate-limit service
- HTTPS domain, certificates, reverse proxy/hosting, and monitoring provider
- Optional email provider for approved reminder delivery; requires a separate reviewed implementation
- Optional payment/banking/purchasing providers are out of scope and must not be connected without a new approval/security review

## Deployment gate

Do not deploy automatically. A human release owner must confirm every blocker above, review migration hashes and snapshots, execute the backup rehearsal, approve environment/domain settings, and run the final test suite against the target environment.
