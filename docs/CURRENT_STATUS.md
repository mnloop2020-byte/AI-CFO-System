# AI CFO System Current Status

Last updated: 2026-07-23

## Completed localization

- Shared language provider, English/Arabic switching, LTR/RTL, and local persistence.
- Header, Sidebar, Dashboard, Chat, and Customers.
- Sales page, table, and form; CRUD was tested.
- Expenses page, table, and form; temporary-record create/update/delete was tested.
- Inventory page, table, and form; TypeScript, route compilation, HTTP response, and live API calculations were verified.
- Invoices page, table, and form; TypeScript, route compilation, HTTP response, and live API values were verified.
- Reports page, templates, generation dialog, real report history, and protected PDF downloads are localized and connected.
- Settings page and company-settings form load and update the real company through the Bearer-protected FastAPI API, with Owner/Admin edits and Accountant/Viewer read-only access.
- Profile and Security displays the authenticated Supabase user, company, and database-backed role. The user can update their name, phone, HTTPS avatar URL, preferred language, and password through Supabase Auth. MFA and advanced session management remain explicitly deferred.
- Authentication UI now provides real login/logout, invitation-only registration, email confirmation callback handling, password recovery, and password update in English/Arabic with protected redirects.
- Shared modal accessibility labels and unique dialog title/description IDs were localized.
- Previously missed Chat and Customers page headers were localized.
- Production build completed successfully, generating all 19 routes.
- Live report text generation is connected through `POST /reports/generate` for six report types. The backend returns the actual generator identifier, generated Markdown, timestamp, and `stored: false`.
- The Reports UI now calls the live endpoint, renders returned Markdown, reports the backend-returned generator, and no longer displays fake stored-history rows.
- A live Arabic Sales Performance report was generated successfully from the preserved `Test Laptop Sale` record; invalid report types return HTTP 422.
- The production build completed successfully again after Reports integration.
- PDF generation is connected through `POST /reports/pdf`. It renders English and Arabic reports with embedded DejaVu Sans fonts, RTL shaping, page headers, footers, page numbers, and a human-review disclaimer.
- The Reports dialog can download the generated report as a PDF without calling the AI agent a second time.
- English, Arabic, mixed Arabic/English, and a six-page Arabic report were rendered and visually inspected without clipping or missing glyphs.
- The private `reports` bucket and RLS-enabled `public.reports` table are integrated with short-lived signed downloads and real history.
- Chat conversation history is connected end to end. The backend lists conversations, restores their messages, and supports deletion with proper `404` handling; the frontend lists saved conversations, opens them, starts a new conversation, refreshes the list after replies, and provides localized delete controls.
- The live browser restored a saved Arabic conversation successfully and then returned to an empty new-conversation state. The existing 26 saved conversations were preserved during verification.
- TypeScript, Python bytecode compilation, safe API error handling, and a fresh production build of all 19 routes passed after the Chat history integration.
- RAG Document Upload is implemented in code with a private `documents` bucket migration, strict PDF/DOCX/TXT/MD/CSV validation, a 10 MB limit, metadata in `documents`, embeddings in `document_chunks`, and `company_id` on both tables.
- Document processing exposes `uploaded`, `processing`, `ready`, and `failed`; the UI polls active processing states and supports cascade deletion of a document and its chunks.
- Document-intent chat questions route to a retrieval agent. Retrieved answers receive deterministic source metadata and a persisted Markdown source list containing the file name and chunk number.
- The bilingual `/documents` page includes a prominent Development-only warning and makes clear that configured `company_id` is not a substitute for Auth, RLS, or tenant isolation.
- Six automated RAG tests cover file validation, TXT/DOCX extraction, fake-PDF rejection, chunking, Arabic/English document routing, and duplicate-source prevention. Backend route registration, UI rendering, and a production build of all 20 routes also passed.
- The RAG migration was applied manually to the correct Supabase project. Four legacy records were preserved as four ready documents and four chunks. The private bucket, 10 MB limit, company filter, vector search function, and cascade deletion were verified.
- The safe `rag-source-test.txt` fixture completed `uploaded` → `processing` → `ready`. English and Arabic agent questions returned the correct values with `rag-source-test.txt`, chunk 1. The temporary document, chunk, and private object were then deleted, while all four legacy documents remained unchanged.

## Single-company authentication foundation

- The current product architecture is now **Single Company + Multiple Users**, while `companies`, `company_members`, and all `company_id` columns are retained for a future multi-company version.
- A clean safety checkpoint was created on branch `checkpoint/pre-single-company-auth-20260720` at commit `3bf4497` before authentication migration work began. Local environment files and detected secrets were excluded.
- The unapplied multi-company migration was moved unchanged to `supabase/archive/20260720120000_create_auth_and_tenant_isolation.sql`; its SHA-256 remains `3C573B923BC494E5662DF258CE2C02406D9AE0120ECF0C11F6A72639FF664EC9`, so it is no longer in the automatic migration path.
- The replacement `supabase/migrations/20260720170000_create_single_company_auth.sql` was applied once to project `tjadermimgzncdvfjpra` with corrected SHA-256 `87EFCC62CF07F15D4EB349EAC509BDEA349BEEDED46FEF9B72FCFCD1C23A7E66`. The first approved version failed inside its transaction on an unqualified pgvector operator and rolled back fully before the corrected migration was approved.
- Migration audit checks passed. Before/after counts match: Customers 2, Sales 1, Expenses 3, Inventory 1, Invoices 1, Conversations 27, Messages 134, Documents 4, Document Chunks 4, and Legacy RAG Chunks 4.
- Exactly one `Development Company` exists. All legacy rows have its trusted `company_id`; no null or mismatched company IDs remain. RLS is enabled on all 13 target tables, and all eight document/report Storage policies are present. Both Storage buckets are private.
- The sole-company unique index/check are valid, authenticated users cannot insert companies or memberships directly, and the centralized `owner`, `admin`, `accountant`, and `viewer` permission sets exist.
- Owner Bootstrap completed once with one confirmed Auth user and one Owner membership. The bootstrap record is consumed and closed; no unexpected user, membership, Owner, or company was created.
- Correct publishable keys are configured in ignored backend/frontend environment files. The backend Service Role fallback was removed.
- `GET /auth/me` returns the real user email, single company, role, and centralized permissions. Live tests passed for Owner role/company resolution, unauthenticated and invalid-token 401 responses, isolated missing-membership 403 handling, and Owner reads of all preserved Customers, Sales, Expenses, Inventory, and Invoices.
- Secure one-time invitations were added by `20260720223000_add_secure_single_company_invitations.sql` with approved SHA-256 `24D0CA5D640E52D98250B8262DD5B8DEC70288CB58FFFBABC2EC5956DDF208DA`. It was applied once to `tjadermimgzncdvfjpra`; its unique SHA-256 token hashes, Auth admission triggers, policies, and unchanged business counts were verified.
- Owner and Admin can create invitations for `admin`, `accountant`, and `viewer`. Raw tokens are returned once in a URL fragment, are never stored, must match the invited email, expire, and are claimed only once. Public company registration remains closed.
- FastAPI now reads role permissions from the database `get_my_auth_context` function and enforces them on financial, chat, document, report, member, and invitation routes. The frontend never sends or selects `company_id`.
- The bilingual Members & Invitations page supports listing members/invitations, creating and revoking invitations, updating roles, and removing members. PostgreSQL protects every Owner from Admin modification and prevents removal or demotion of the last Owner.
- Live authorization checks passed for Owner, Admin, Accountant, and Viewer; Viewer writes and Accountant member management were denied, Accountant financial/Storage writes were allowed, a second company was rejected, and wrong-email/expired/used invitations were rejected.
- Private Storage role tests passed. The temporary object created by the check was removed; no existing object or business record was deleted.
- Development dependencies are isolated in `requirements-dev.txt`. Pytest reports 12 passed tests, Python compilation passes, TypeScript passes, and the Next.js 15.5.19 production build generated all 23 routes successfully.
- MFA remains a documented later security stage so it does not delay the completed authentication and authorization foundation.

## Current live test records to preserve

- Sales: `Test Laptop Sale`, quantity 2, revenue 200.
- Expenses: Office 50 and Consulting 500 flagged.
- Inventory: `Test Low Stock Product`, SKU `LOW-001`, quantity 3, reorder level 5, cost 10, selling price 15.
- Invoice: the current database record is `INV-TEST-003`, total 1000, VAT 150, status unpaid.

## Current checkpoint

Phase 1 — Single Company Authentication —, Phase 2 functional integrations, and the core Phase 3 Financial Action Center are complete. The system has one company, multiple invited users, centralized roles, SSR-aware route protection, bearer-token verification, RLS, private Storage policies, and tested authorization boundaries.

The next implementation order is:

1. Complete the three Action Center use-case refinements and value attribution.
2. Apply security/reliability hardening and run the final delivery suite.

## Phase 2 progress

- **2.1 Company Settings is complete.** Migration `20260721100000_add_single_company_settings.sql` added validated company profile, locale, tax, currency, timezone, and explicit opening-balance fields without changing protected row counts.
- `GET /company/settings` is available to all four roles through `company.read`; `PATCH /company/settings` is limited to Owner/Admin through `company.update`.
- The backend always derives the company from the verified request context. The Settings payload rejects extra fields, including any frontend-provided `company_id`.
- The bilingual Settings page now loads and saves the real company record, supports RTL/LTR, shows read-only mode to Accountant/Viewer, and no longer contains Design-only data or messages.
- Live access checks passed: Owner read/update `200`, Viewer read `200`, Viewer update `403`, and unauthenticated read `401`. Protected business row counts remain unchanged.
- **2.2 PDF report persistence is complete.** A live Sales Performance report was generated from the preserved backend data, rendered as a valid PDF, stored as metadata in `public.reports`, and uploaded beneath the trusted company folder in the private `reports` bucket.
- Real report history returned the stored row, a five-minute signed download URL returned the original PDF, and the downloaded bytes passed the `%PDF-` signature check. Viewer read/download succeeded, Viewer generation was denied with `403`, and unauthenticated history was denied with `401`.
- Automated English and multi-page Arabic PDF tests pass. The UI no longer claims that report storage is disconnected.
- **2.3 Invoice and expense attachments is complete.** Migration `20260721123000_add_financial_attachments.sql` created a company-scoped RLS table and a private 5 MB `financial-attachments` bucket for PDF, PNG, and JPEG files.
- FastAPI verifies file size, declared MIME, extension, and actual PDF/image signature before upload. Storage paths contain the trusted company, record type, record ID, and an opaque attachment ID; the frontend never supplies `company_id`.
- The invoice and expense forms now upload new files after the financial record is saved. Existing records expose bilingual list, upload, signed download, and explicit attachment-only deletion controls.
- Live tests passed for invoice PDF and expense PNG upload/list/download/delete, fake-PDF rejection `400`, Viewer upload denial `403`, Viewer read access `200`, and preservation of Invoice `1` and Expenses `3`. Only the two temporary attachment objects created by the test were removed.
- **2.4 Immediate KPI refresh is complete.** A lightweight typed browser event invalidates only the affected financial resource after successful create, update, or delete operations.
- Sales, Expenses, Inventory, and Invoices pages reload their live KPI cards immediately after their table mutates. The Dashboard subscribes to all four financial resources and refreshes its summary on the next visit without requiring a manual browser reload.
- CRUD tables retain their existing optimistic row updates and error handling; the event carries only resource and operation names, never record contents or `company_id`. TypeScript and the Next.js production build passed after integration.
- **2.5 Deterministic agent grounding is complete.** Sales, accounting, cash-flow, inventory, tax, fraud, CEO, and report calculations remain Python functions over RLS-scoped records; the LLM is limited to explanation and wording.
- Verified payloads now include trusted company currency/tax context, explicit availability flags, source tables, source record IDs, and calculation descriptions. Financial replies receive a deterministic source footer.
- A post-generation guard rejects numeric claims absent from the verified payload, unconfigured currency symbols, and unavailable bank-balance, final-net-profit, or net-VAT claims. Rejected narratives are replaced by a deterministic data-only fallback rather than shown to the user.
- The user's existing `accounting_agent.py` edit remains untouched; Accounting output is guarded centrally by the Orchestrator. All 32 backend tests and Python compilation pass, including new unsupported-claim and deterministic-calculation tests.

## Phase 3 progress

- **The Financial Action Center core is complete.** Migrations `20260722100000_create_financial_action_center.sql` and `20260722103000_harden_financial_action_lifecycle.sql` created RLS-protected actions/events, centralized role permissions, status validation, audit events, approval expiry, deduplication, and execution idempotency without changing protected business counts.
- The approval test exposed an unqualified pgcrypto call under an empty `search_path`. Corrective migration `20260722113000_fix_financial_action_approval_hash.sql` changed only that call to `extensions.digest`; its audit confirms identical before/after counts.
- The deterministic engine detects overdue unpaid invoices, low inventory, and flagged expenses from RLS-scoped records. It records evidence, source IDs, calculated impact, bilingual recommendations, and safe drafts with external execution disabled.
- The bilingual `/actions` interface provides KPI summaries, search/filtering, evidence/source links, assignment, draft editing, approval/rejection, deferral, completion, and an event timeline with responsive RTL/LTR layout.
- Live authorization tests passed: Viewer is read-only; Accountant can detect/update but cannot assign or approve; Admin can assign and approve. Fake `company_id` is rejected, unauthenticated access returns `401`, repeated detection creates no duplicate, execution retries replay idempotently, and no email, payment, or purchase is executed.
- Current development data contains three traceable actions derived from the preserved invoice, low-stock item, and flagged expense. All 36 backend tests and Python compilation pass; TypeScript and the Next.js production build compile successfully.

## Phase 4 progress

- **The first three Action Center use cases are complete.** Overdue invoices include deterministic lateness/amount priority, a bilingual editable reminder draft, approval expiry, and a recorded follow-up that never sends email without an integration.
- Active invoice follow-up can be paused back to human review when a dispute or payment plan is recorded. The reason is preserved in the audit timeline, and paid source invoices close through deterministic detection rather than an LLM claim.
- Low-stock actions calculate only the quantity/cost available from inventory data and remain purchase-review drafts; no purchase order or external purchase can be created.
- Flagged expenses explicitly state that the signal does not prove fraud. RAG policy retrieval is isolated as untrusted evidence for human comparison, and when a relevant policy exists the action records the document name, chunk number, excerpt, and similarity without treating document text as executable instructions.
- Re-running detection refreshes traceable evidence only when it changed while the open-action unique key prevents duplicates. The live development check found policy context and verified its cited file/chunk metadata.
- The full backend suite now reports 37 passing tests, including policy-source traceability; TypeScript passes.

## Phase 5 progress

- **Action Center value measurement is complete with conservative attribution.** The API/UI report open and completed actions, total/open linked financial value, invoice follow-ups, average overdue days when available, approvals, rejections, recommendation acceptance, dismissed alerts, and an explicit time-saved estimate.
- The time estimate is documented as five approximate minutes for signal identification/evidence assembly per detected action and is never presented as measured labor time.
- `proven_collected_amount` deliberately remains unavailable until invoices contain both a verifiable `paid_at` timestamp and a payment transaction reference. The system therefore does not attribute the current invoice value or any collection to AI.
- The live metrics check passed with the current evidence state (no provable followed-up invoice or average delay at that moment), and the API returned the explicit non-attribution explanation. The backend suite reports 38 passing tests; TypeScript and the production build compile successfully.

## Phase 6 progress

- **Security and reliability hardening is complete for Pilot scope.** FastAPI now applies bounded per-process rate limits to Auth, Chat, Reports, RAG/attachment uploads, and Action writes/detection, returning `429` with `Retry-After`.
- Request logs are structured JSON and redact UUIDs, emails, and Bearer tokens. They exclude query strings, bodies, financial values, prompts, replies, and document contents.
- OpenRouter calls have 45-second timeouts, at most two retries, and centralized token-usage/status logging without prompt content. Chat messages, history count/characters, and RAG context have explicit configurable bounds.
- RAG context is wrapped as untrusted document evidence with explicit prompt-injection isolation. Agent capability boundaries are documented, and action payload validation rejects attempts to enable external execution.
- The frontend sends CSP, anti-framing, MIME-sniffing, referrer, and browser-permission headers. Existing local-only redirect validation remains in place; React/Markdown rendering does not enable raw HTML. Bearer-protected FastAPI writes are not cookie-authenticated CSRF targets.
- Migration `20260722140000_add_security_audit_events.sql` (SHA-256 `6D0C05958010E6CB25F88279299C5DA678C71D923D1C8821B581EDF7C90C1BE0`) was applied once. RLS, one Owner/Admin read policy, and seven safe metadata-only triggers were verified with unchanged protected counts.
- A live action update created one audit event containing no protected field names. Owner/Admin audit reads returned `200`, Viewer returned `403`, and no financial content, token hash, Storage path, RAG evidence, or proposed-action payload was stored in the general audit row.
- Liveness/readiness endpoints pass. Backup and isolated restore-rehearsal procedures are documented in `docs/SECURITY_OPERATIONS.md`; no destructive restore was run. The backend suite reports 44 passing tests, Python compilation passes, TypeScript passes, and a new production build ID was generated.
- Production limitation: the current limiter is process-local and must be replaced with a shared Redis-backed limiter before multi-instance public deployment. MFA remains deferred and required before Production readiness.

## Phase 7 verification

- **The final Pilot verification suite passes.** The latest integration run reports Backend `pytest`: 91 passed; Python compilation: passed; Frontend unit tests: 16 passed; TypeScript `tsc --noEmit`: passed; and the Next.js production build generated all 22 application routes successfully.
- Live Phase 1 checks passed again for Owner, Admin, Accountant, Viewer, last-Owner protection, invitation email/expiry/one-time rules, and private Storage roles.
- Live Action Center checks passed for unauthenticated `401`, fake `company_id` rejection, Viewer read-only, Accountant detection/write boundary, Admin assignment/approval, audit events, deduplication, idempotent non-execution, RAG policy citation, and conservative value metrics.
- Browser verification passed in English and Arabic. The document language/direction switched between `en/ltr` and `ar/rtl`; a 390×844 viewport had no horizontal overflow; the protected Action URL redirected to login without a session.
- Live response headers include CSP, `DENY` framing, `nosniff`, and strict-origin referrer policy. The authenticated Action UI was verified through API role/lifecycle tests and production compilation; the browser session intentionally did not expose or type credentials.

## Settings, Profile, Auth, and Action integration verification

- Live Settings tests passed for reading and temporarily updating the name, business activity, currency, VAT status, and fiscal-year start, followed by restoring the original company values.
- Invalid currency, fiscal month, financial-threshold ordering, and frontend-supplied `company_id` payloads returned `422`. Viewer could read Settings and received `403` on update.
- `/auth/me` returned the authenticated user, sole company, database membership role, and centralized permissions. Missing and invalid Bearer tokens returned `401`.
- Supabase Auth profile metadata accepted a temporary name and HTTPS avatar, and a real password change/sign-in/restore cycle passed without printing credentials or tokens.
- The bilingual Profile UI now rejects unsafe avatar schemes and weak passwords before submission, and immediately refreshes Header identity/avatar state after a successful profile save.
- The live Action Center returned exactly three current actions, repeated detection created no duplicate, Viewer remained read-only, Accountant could detect but not assign/approve, fake `company_id` was rejected, and action/security audit events remained available.
- Because the only approval-required live action was already `in_progress`, approval, rejection, and execution replay were verified through isolated route tests without forcing or rewriting the live action state.

## Auth, members, and role-management verification

- Member-management APIs now reject self role changes and self removal before mutation. Admin cannot modify/remove an Owner or assign the Owner role; PostgreSQL continues to protect the last Owner independently.
- The Members interface derives every control from `/auth/me` permissions. Accountant/Viewer receive a restricted state, while role, remove, invite, and revoke controls are shown or disabled within Owner/Admin boundaries.
- Login failures use a generic non-enumerating message. Confirmation callbacks and recovery errors are safe, local `next` paths remain enforced, and password reset uses the same 12-character complexity policy as Profile.
- The live Auth check passed for Owner, Admin, Accountant, Viewer, invitation email/expiry/one-time rules, temporary role change and restoration, protected Storage, and unchanged business counts.
- The current verification totals are Backend `pytest`: 96 passed; Frontend unit tests: 23 passed; Python compilation, TypeScript, and the Next.js production build: passed.

## Phase 8 delivery

- Operations, environment, company/Owner bootstrap, invitation, role, report, attachment, RAG, Action Center, verification, and limitation guidance is consolidated in `docs/OPERATIONS_GUIDE.md`.
- `docs/PRODUCTION_READINESS.md` records a controlled development-Pilot verdict, completed controls, explicit Production blockers, required external services/secrets, and the human deployment gate.
- No Production deployment, email, payment, purchase, data deletion, or destructive restore was performed.
- The user's local `backend-python/app/agents/accounting_agent.py` modification remains present and was not staged or changed by this work.

## Verification note

The in-app browser completed the Expenses CRUD test and the Chat history restore/new-conversation test. Inventory and Invoices were verified through TypeScript, Next.js route compilation, HTTP 200 responses, and direct read-only API checks. Visual CRUD verification for those two sections remains desirable in the user's local browser.
