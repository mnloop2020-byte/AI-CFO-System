# MVP End-to-End Acceptance Report

Date: 2026-07-29

Scope: controlled Single Company + Multiple Users Pilot

Supabase project: `tjadermimgzncdvfjpra`

## Acceptance verdict

The current build is suitable for a controlled development Pilot with
synthetic or non-sensitive data. It is not Production-ready.

The business records, Auth/RLS boundaries, private file workflows, PDF
generation, RAG indexing/retrieval, Financial Action lifecycle, and live AI
provider acceptance passed. Arabic and English financial-summary prompts used
current financial records, while explicit document prompts used uploaded
documents with deduplicated citations. Internal agent JSON was not exposed.

## Route and state coverage

| Area | Routes exercised | Result |
| --- | --- | --- |
| Auth | `/login`, `/auth/me`, password/profile checks | Passed |
| Roles | Owner, Admin, Accountant, Viewer, invitation and Storage boundaries | Passed |
| CRM | Customers, Sales, Expenses, Inventory, Invoices | Passed; temporary rows removed |
| Dashboard | Live source endpoints and invalidation contracts | Passed through API/tests; browser API calls were blocked by the in-app browser's localhost-port policy |
| Chat | Arabic/English contract, Markdown, no internal JSON | Automated contract and four live provider/source-mode checks passed |
| Reports | Arabic/English PDF, private Storage, history, signed download | Passed |
| RAG | Safe text upload, `ready`, chunks, pgvector retrieval, private deletion | Passed |
| Actions | Three rules, deduplication, approval, rejection, replay, audit | Passed |
| Notifications | Invoice lifecycle notification scan and protected menu contract | Passed |
| Settings/Profile | Real company/user data, validation, permission boundaries | Passed and restored |

## Safe acceptance scenario

`tests/live_mvp_acceptance_check.py` creates linked records carrying the
`E2E-MVP-` prefix, validates their deterministic totals and downstream
workflows, and deletes only the exact IDs and private objects it created.
The permanent Customers, Sales, Expenses, Inventory, Invoices, Reports,
Documents, Chunks, Attachments, Actions, Conversations, and Messages counts
return to their pre-run values. Immutable action/security audit history is
retained by design.

Final automated totals: Backend `pytest` 138 passed, Frontend 43 tests passed,
TypeScript passed, and the Next.js 15.5.21 production build generated all 22
application routes.

## UI/UX findings

- English/LTR and Arabic/RTL render correctly after hydration.
- The stored language is now loaded before the default language can be
  persisted, preventing a full reload from overwriting Arabic with English.
- The login layout now constrains Grid/Flex minimum widths and wraps the
  password header safely on narrow screens.
- Protected pages expose loading/error/empty states and accessible names for
  primary controls.
- Desktop visual inspection passed for the Action Center and main shell.
- A real `390x844` headless-browser capture was used to identify and correct
  the login overflow. TypeScript and the production build validate the full
  responsive Tailwind paths.

## External and Production blockers

1. Define and monitor the Production OpenRouter budget, quota, key rotation,
   and provider-outage behavior.
2. Configure and approve an SMTP provider before any real invoice email.
3. Implement MFA and distributed rate limiting before Production.
4. Complete target-domain, centralized monitoring, backup/restore rehearsal,
   compliance, and penetration testing before public deployment.

No live email, payment, purchase, push, migration, or Production deployment
was performed during this acceptance phase.
