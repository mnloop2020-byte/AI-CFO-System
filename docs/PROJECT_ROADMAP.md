# AI CFO System Roadmap

Last updated: 2026-07-22

## Product direction

Build a bilingual AI CFO platform with live financial CRUD, reliable sourced analysis, private document retrieval, human-approved financial actions, and production-grade security. The deployed product is **Single Company + Multiple Users**. The `companies`, `company_members`, and `company_id` structure remains tenant-ready for a separately reviewed future multi-company release.

## Completed foundation

- FastAPI, Supabase PostgreSQL/pgvector, specialist agents, RAG, and live CRUD for customers, sales, expenses, inventory, and invoices.
- Live Dashboard KPIs, AI chat, persisted conversation history, bilingual English/Arabic UI, RTL/LTR, and responsive light design.
- Private RAG document upload with validation, processing states, embeddings, sourced answers, and safe cascade deletion.
- Live report generation and PDF rendering. Report persistence and private downloads remain Phase 2 work.

## Phase 1: Single-company authentication and authorization

- One `Development Company`; legacy records are assigned without deletion.
- Real Supabase Auth login/logout and email verification.
- Secure SSR-aware route protection and Bearer tokens verified by FastAPI.
- Database-backed `owner`, `admin`, `accountant`, and `viewer` permissions.
- One-time Owner Bootstrap, now consumed and closed.
- Invitation-only admission with exact-email binding, expiry, SHA-256-only token storage, and one-time consumption.
- Member and invitation management for Owner/Admin.
- Real password reset and protected Auth callbacks without open redirects.
- RLS for company data and private Storage role policies.
- Real identity and role in Header/Profile.
- Backend, TypeScript, production-build, role, invitation, RLS, and Storage checks.

Status: **complete**. MFA is intentionally deferred to the later security-hardening stage. Rate limiting, CAPTCHA, expanded audit logs, and advanced session controls also remain later hardening work.

## Phase 2: Complete prior functional integrations

Execute and test each item in this order:

1. **Complete:** Connect Settings to the real single company through FastAPI and RLS.
2. **Complete:** Persist generated PDF reports in the private `reports` bucket and `reports` table.
3. **Complete:** Display real report history and provide short-lived signed/protected downloads.
4. **Complete:** Store invoice and expense attachments in private Storage.
5. **Complete:** Refresh Dashboard and page KPIs immediately after CRUD without manual refresh.
6. **Complete:** Improve CEO Agent and financial-agent grounding so figures and conclusions come only from verified data, with deterministic fallback and clear sources.

Status: **complete**. Company Settings, persisted private PDF reports, private financial attachments, immediate KPI refresh, and deterministic agent grounding are implemented and tested.

## Phase 3: AI Financial Action Center

- Deterministic Python detection rules with AI used for explanation, never invented numbers.
- Traceable evidence, source type/id, financial impact, owner, due date, approval requirement, status, and audit history.
- Idempotency and deduplication; no automatic email, payment, purchase, or external financial action.
- First use cases: overdue-invoice collection drafts, low-stock review, and flagged/unusual expense review against RAG policy when available.
- Bilingual RTL/LTR UI for summaries, filters, details, evidence, assignment, approval/rejection, status changes, completion, and timelines.

Status: **core complete**. The database, deterministic engine, RLS/permissions, audit lifecycle, idempotency, and bilingual interface are implemented. The three use-case refinements and value measurement continue in the next stage.

## Phase 4: Action Center use cases

- Overdue-invoice reminder drafts, approval, non-sending follow-up recording, dispute/payment-plan pause, and paid-source closure.
- Low-inventory replenishment review with deterministic quantities/cost limits and no purchasing.
- Flagged-expense human review with optional cited RAG policy context and explicit non-fraud wording.

Status: **complete**. Detection remains idempotent, evidence refreshes safely, and all external financial execution is disabled.

## Phase 5: Value measurement

- Action counts, linked value, follow-up evidence, decision acceptance, delay metrics, and transparent time-saved estimation.
- Never attribute collections to AI without a verifiable event and payment timeline.

Status: **complete with conservative attribution**. All evidence-backed metrics are exposed. Collection attribution remains intentionally unavailable until payment timestamps and transaction references exist.

## Phase 6: Security and quality hardening

- Audit logs, rate limiting, CAPTCHA where appropriate, upload defenses, and RAG prompt-injection mitigation.
- Timeouts/retries for external services, structured logging, and safe error handling.
- Expanded backend/frontend tests, RLS/role tests, Arabic/English responsive checks, production build, Python compilation, and end-to-end scenarios.
- Real MFA and advanced session management.

Status: **Pilot-complete**. Audit events, route rate limits, upload/RAG safeguards, bounded external calls, structured redacted logs, health checks, LLM usage monitoring, CSP/security headers, and recovery documentation are implemented. Shared distributed rate limiting and real MFA remain Production blockers.

## Phase 7: Final verification

- Full backend, Auth/roles, RLS/Storage, action lifecycle, idempotency, upload, RAG security, financial-calculation, frontend, bilingual, responsive, and end-to-end checks.

Status: **complete for Pilot**. Automated backend/financial/RAG/upload/security tests, live Auth/role/RLS/Storage/Action checks, TypeScript, production build, and bilingual responsive browser checks passed.

## Phase 8: Delivery and deployment readiness

Deployment requires successful Auth, RLS, Storage policies, role tests, backup verification, PDF reports, RAG, Action Center, and final end-to-end tests.

Status: **documentation complete; deployment intentionally stopped**. The system is suitable for a controlled development Pilot with synthetic/non-sensitive data. Production remains blocked by MFA, distributed rate limiting, target-domain hardening, a real backup/restore rehearsal, centralized monitoring, and external compliance/security review.

## Project safeguards

- Never run `npm audit fix --force`.
- Never replace live FastAPI/Supabase integrations with static data.
- Never treat CORS as authentication.
- Never delete the core financial test records or four legacy RAG documents.
- Never allow a second company, expose a company switcher, or accept `company_id` from the frontend in the current product.
- Never expose the Supabase Service Role key or use it as a public-key fallback.
- Never send email, make a payment or purchase, or execute an external financial action without explicit human approval.
- Keep the current bilingual light visual design.
