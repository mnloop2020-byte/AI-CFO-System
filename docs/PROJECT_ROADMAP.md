# AI CFO System Roadmap

Last updated: 2026-07-21

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
5. Refresh Dashboard and page KPIs immediately after CRUD without manual refresh.
6. Improve CEO Agent grounding so figures and conclusions come only from verified data, with clear sources where appropriate.

Status: **in progress**. Company Settings, reports, and private financial attachments are complete; immediate KPI refresh is next.

## Phase 3: AI Financial Action Center

- Deterministic Python detection rules with AI used for explanation, never invented numbers.
- Traceable evidence, source type/id, financial impact, owner, due date, approval requirement, status, and audit history.
- Idempotency and deduplication; no automatic email, payment, purchase, or external financial action.
- First use cases: overdue-invoice collection drafts, low-stock review, and flagged/unusual expense review against RAG policy when available.
- Bilingual RTL/LTR UI for summaries, filters, details, evidence, assignment, approval/rejection, status changes, completion, and timelines.

Status: pending until Phase 2 is stable.

## Phase 4: Security and quality hardening

- Audit logs, rate limiting, CAPTCHA where appropriate, upload defenses, and RAG prompt-injection mitigation.
- Timeouts/retries for external services, structured logging, and safe error handling.
- Expanded backend/frontend tests, RLS/role tests, Arabic/English responsive checks, production build, Python compilation, and end-to-end scenarios.
- Real MFA and advanced session management.

Status: pending.

## Phase 5: Deployment

Deployment requires successful Auth, RLS, Storage policies, role tests, backup verification, PDF reports, RAG, Action Center, and final end-to-end tests.

Status: pending.

## Project safeguards

- Never run `npm audit fix --force`.
- Never replace live FastAPI/Supabase integrations with static data.
- Never treat CORS as authentication.
- Never delete the core financial test records or four legacy RAG documents.
- Never allow a second company, expose a company switcher, or accept `company_id` from the frontend in the current product.
- Never expose the Supabase Service Role key or use it as a public-key fallback.
- Never send email, make a payment or purchase, or execute an external financial action without explicit human approval.
- Keep the current bilingual light visual design.
