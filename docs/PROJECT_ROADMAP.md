# AI CFO System Roadmap

Last updated: 2026-07-20

## Product direction

Build a bilingual, multi-tenant AI CFO platform with live financial CRUD, reliable AI analysis, report generation, document retrieval, strong authentication, and production-grade security.

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
- Generate PDFs and store report history. PDF generation is complete; the storage migration and history integration are next.
- Connect chat conversation history. Complete: list, restore, new conversation, localized delete controls, and backend deletion support are connected.
- Add RAG document upload. Complete for development use: private bucket, metadata/chunk model, validation, processing states, embeddings, company-scoped retrieval, sourced English/Arabic answers, and cascade deletion were verified without losing the four legacy documents.
- Store invoice and expense attachments in Supabase Storage.
- Refresh dashboard and page KPIs immediately after CRUD changes.
- Connect Settings to backend company data.

Status: in progress. Chat history and development-only RAG Document Upload are complete. Report persistence still awaits its remote migration. Authentication and tenant isolation are now the recommended priority before real document use.

## Phase 4: Authentication, authorization, and tenancy

- Implement real Supabase Auth.
- Add email verification and real MFA.
- Protect routes and sessions.
- Add tenant isolation and Supabase RLS.
- Add roles and permissions.
- Add rate limiting and CAPTCHA.
- Add audit logs and secure cookie/session controls.

Status: pending. Current authentication screens are design-only.

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
- Do not name a specific chat agent unless the backend returns that information.
- Keep the current light visual design.
