# AI CFO System Roadmap

Last updated: 2026-07-20

## Product direction

Build a bilingual AI CFO platform with live financial CRUD, reliable AI analysis, report generation, document retrieval, strong authentication, and production-grade security. The current product is **Single Company + Multiple Users**; tenant-ready `company_id` relationships remain in the schema so a reviewed multi-company version can be introduced later without rebuilding the data model.

## Phase 1: Core platform

- FastAPI and Supabase PostgreSQL integration.
- CRUD for customers, sales, expenses, inventory, and invoices.
- Dashboard KPIs from live backend data.
- AI chat, conversation memory, base RAG, orchestrator, and specialist agents.
- Next.js application shell and responsive light design.

Status: substantially complete.

## Phase 2: Arabic localization and UI quality

- Translate all pages, tables, forms, messages, filters, dialogs, and accessibility labels.
- Preserve English API values while presenting localized labels.
- Verify LTR and RTL layouts.
- Test responsive behavior in Arabic and English.
- Run a production build after localization is complete.

Status: substantially complete. A final manual responsive pass is still desirable.

## Phase 3: Functional integrations

- Connect Reports to real agents and live financial data.
- Generate PDFs and store report history. PDF generation and the remote table/private bucket are complete; metadata/file persistence and signed history downloads remain.
- Connect chat conversation history. Complete: list, restore, new conversation, localized delete controls, and backend deletion support are connected.
- Add RAG document upload. Complete for development use: private bucket, metadata/chunk model, validation, processing states, embeddings, company-scoped retrieval, sourced English/Arabic answers, and cascade deletion were verified without losing the four legacy documents.
- Store invoice and expense attachments in Supabase Storage.
- Refresh dashboard and page KPIs immediately after CRUD changes.
- Connect Settings to backend company data.

Status: in progress. Chat history, development-only RAG Document Upload, and the report-persistence schema/private bucket are complete. Report metadata/file integration remains.

## Phase 4: Single-company authentication and authorization

- Implement real Supabase Auth.
- Add email verification and password reset; keep real MFA as a documented follow-up if it delays the secure foundation.
- Protect routes and SSR sessions, send Bearer tokens to FastAPI, and return correct 401/403 responses.
- Resolve the sole company only from verified membership; reject or ignore client-supplied `company_id`.
- Add centralized `owner`, `admin`, `accountant`, and `viewer` roles and permissions.
- Add one-time, server-configured Owner bootstrap and invitation-only admission for subsequent users.
- Add RLS and private Storage policies scoped to the authenticated membership.
- Add rate limiting and CAPTCHA.
- Add audit logs and secure cookie/session controls.

Status: in progress. Safety checkpoint `3bf4497` exists on `checkpoint/pre-single-company-auth-20260720`. The old multi-company migration is archived. The final Single Company migration is applied and audited; one confirmed Owner exists, Bootstrap is closed, RLS/private Storage are active, Service Role fallback is removed, and `/auth/me` plus basic 401/403/Owner access tests pass. Remaining work is frontend SSR/session completion, invitations, centralized FastAPI permission enforcement, and live Admin/Accountant/Viewer tests.

## Phase 5: AI reliability, final testing, and deployment

- Improve CEO Agent grounding and prevent unsupported conclusions.
- Add backend, frontend, security, tenancy, and regression tests.
- Complete production readiness checks.
- Deploy the application and monitor it.

Status: pending.

## Project safeguards

- Do not run `npm audit fix --force`.
- Do not replace live FastAPI/Supabase integrations with static data.
- Do not treat CORS as authentication.
- Do not delete the core test records.
- Do not claim file uploads, authentication, MFA, or report actions work before their real integrations exist.
- Do not allow more than one company, expose a company switcher, or accept `company_id` from the frontend in the current product.
- Do not expose the Supabase Service Role key or use it as a fallback for the public/publishable key.
- Do not name a specific chat agent unless the backend returns that information.
- Keep the current light visual design.
