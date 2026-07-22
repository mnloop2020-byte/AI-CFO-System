# AI CFO System Current Status

Last updated: 2026-07-21

## Completed localization

- Shared language provider, English/Arabic switching, LTR/RTL, and local persistence.
- Header, Sidebar, Dashboard, Chat, and Customers.
- Sales page, table, and form; CRUD was tested.
- Expenses page, table, and form; temporary-record create/update/delete was tested.
- Inventory page, table, and form; TypeScript, route compilation, HTTP response, and live API calculations were verified.
- Invoices page, table, and form; TypeScript, route compilation, HTTP response, and live API values were verified.
- Reports page, templates, generation dialog, real report history, and protected PDF downloads are localized and connected.
- Settings page and company-settings form; TypeScript and the running route were verified. The UI remains a clearly labelled design preview until backend company settings are implemented.
- Profile and Security now displays the authenticated Supabase user, company, and database-backed role. The user's display name can be updated in Auth metadata. MFA and advanced session management remain explicitly deferred.
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

Phase 1 — Single Company Authentication — is complete. Phase 2 is in progress, with Company Settings completed. The system has one company, multiple invited users, centralized roles, SSR-aware route protection, bearer-token verification, RLS, private Storage policies, and tested authorization boundaries.

The remaining Phase 2 order is:

1. Refresh Dashboard KPIs immediately after CRUD operations.
2. Harden CEO Agent claims and source attribution.
3. Begin AI Financial Action Center only after the preceding Phase 2 work is stable.

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

## Verification note

The in-app browser completed the Expenses CRUD test and the Chat history restore/new-conversation test. Inventory and Invoices were verified through TypeScript, Next.js route compilation, HTTP 200 responses, and direct read-only API checks. Visual CRUD verification for those two sections remains desirable in the user's local browser.
