# AI CFO System Current Status

Last updated: 2026-07-20

## Completed localization

- Shared language provider, English/Arabic switching, LTR/RTL, and local persistence.
- Header, Sidebar, Dashboard, Chat, and Customers.
- Sales page, table, and form; CRUD was tested.
- Expenses page, table, and form; temporary-record create/update/delete was tested.
- Inventory page, table, and form; TypeScript, route compilation, HTTP response, and live API calculations were verified.
- Invoices page, table, and form; TypeScript, route compilation, HTTP response, and live API values were verified.
- Reports page, templates, preview dialog, and report-history placeholder are localized. Live agent execution and PDF download are connected; report persistence remains pending.
- Settings page and company-settings form; TypeScript and the running route were verified. The UI remains a clearly labelled design preview until backend company settings are implemented.
- Profile and Security page; language selection is connected to the existing language provider, while profile saving, MFA, and session management remain clearly labelled as unconnected previews. TypeScript and the running route were verified.
- Authentication UI: Login, Register, MFA, and Forgot Password now support English/Arabic, LTR/RTL, localized accessibility labels, and explicit design-preview messaging. Existing validation rules were preserved; TypeScript and all four running routes were verified.
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
- The private `reports` bucket and RLS-enabled `public.reports` table now exist remotely. Report-history application integration remains pending.
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
- `GET /auth/me` is implemented. Live tests passed for Owner role/company resolution, unauthenticated and invalid-token 401 responses, isolated missing-membership 403 handling, and Owner reads of all preserved Customers, Sales, Expenses, Inventory, and Invoices.
- Python compilation and the Next.js 15 production build passed after the Auth foundation changes. The existing virtual environment does not include `pytest`, so the pytest suite was not run in this checkpoint.

## Current live test records to preserve

- Sales: `Test Laptop Sale`, quantity 2, revenue 200.
- Expenses: Office 50 and Consulting 500 flagged.
- Inventory: `Test Low Stock Product`, SKU `LOW-001`, quantity 3, reorder level 5, cost 10, selling price 15.
- Invoice: the current database record is `INV-TEST-003`, total 1000, VAT 150, status unpaid.

## Current checkpoint

Active application localization and the production build are complete. Chat conversation history is also complete and visually verified in the local application.

Report persistence database and private-bucket prerequisites now exist. Storing generated PDF metadata/files and presenting signed history downloads are the next report tasks.

RAG Document Upload and the Single Company authentication foundation are complete. Next:

1. Finish frontend SSR route protection, real Header/Profile identity, logout, verification/reset flows, and invitation management.
2. Enforce centralized permissions in FastAPI and run live Admin/Accountant/Viewer authorization tests.
3. Store report PDFs/history and invoice/expense attachments in private Storage.
4. Refresh dashboard KPIs immediately after CRUD operations.
5. Connect Settings to the one company record.
6. Add rate limiting, audit logs, MFA, and additional session protection.

## Verification note

The in-app browser completed the Expenses CRUD test and the Chat history restore/new-conversation test. Inventory and Invoices were verified through TypeScript, Next.js route compilation, HTTP 200 responses, and direct read-only API checks. Visual CRUD verification for those two sections remains desirable in the user's local browser.
