# Database Bootstrap and Migration Guide

## Status

This document records the Phase 3 database bootstrap audit and isolated
implementation completed on 2026-07-28.

The migration set is now **reproducibly buildable from an empty Supabase Local
database**. Two complete builds produced the same normalized schema
fingerprint:

`bece83319e07ba4fc81a604f7b33f774547a46f44c63a7fe4ddbb43dac2c7b3b`

The linked project is the existing AI CFO System project. It was inspected only
through the read-only PostgREST OpenAPI description after verifying that the
project reference matched the expected reference. No table data, environment
value, token, or secret was printed or changed.

## Safety boundary and isolated environment

The isolated environment was:

- Docker Desktop server `29.6.2`;
- project-local Supabase CLI `2.110.0`;
- Supabase Local project ID `zemam-core-agent`;
- local API `127.0.0.1:54321`;
- local PostgreSQL `127.0.0.1:54322`, PostgreSQL major version 17.

`supabase/config.toml` contains local loopback URLs and ports only. It contains
no hosted-project reference, `supabase.co` URL, remote database URL, or remote
credential. Seed execution is disabled because the project intentionally has no
seed file. Storage Vector buckets are disabled because the application uses
PostgreSQL pgvector, not the separate Storage Vector feature.

Every CLI database command used `--local` where the command supports a target:

- `supabase migration list --local`
- `supabase db reset --local`
- `supabase db lint --local --level warning`

Full rebuilds also used `supabase stop --no-backup` and `supabase start` against
the local project ID. No command used `--linked`, `db push`, migration repair,
or a remote database URL.

No hosted database row, Storage object, migration-history row, environment
file, token, or secret was changed or printed. No existing migration was
edited.

## Evidence inspected

The audit compared:

- all SQL files under `supabase/migrations`, in filename order;
- all SQL verification files under `supabase/verification`;
- backend Pydantic schemas, stores, routes, authentication context, RAG,
  reporting, attachment, notification, and Action Center services;
- frontend API contracts and TypeScript types;
- backend and frontend tests;
- the linked database's read-only PostgREST OpenAPI schema.

The earlier hosted-project comparison used read-only PostgREST OpenAPI. The
isolated implementation additionally verified PostgreSQL catalogs directly,
including constraints, indexes, triggers, extensions, RLS flags, policies,
private buckets, relationships, and monetary precision.

## Existing migration order

| Order | Migration | Main responsibility |
|---:|---|---|
| 1 | `20260719100000_create_core_financial_and_chat_schema.sql` | seven foundational financial/chat tables, checks, base indexes, timestamps |
| 2 | `20260719141000_create_reports.sql` | `reports`, private `reports` bucket |
| 3 | `20260719193000_create_rag_documents.sql` | pgvector, `documents`, `document_chunks`, private `documents` bucket, RAG search |
| 4 | `20260720170000_create_single_company_auth.sql` | single company, membership, roles, permissions, tenant columns, RLS, Auth bootstrap |
| 5 | `20260720223000_add_secure_single_company_invitations.sql` | hashed, expiring, single-use invitations |
| 6 | `20260721100000_add_single_company_settings.sql` | company settings and `numeric(18,2)` opening balance |
| 7 | `20260721123000_add_financial_attachments.sql` | attachment metadata, private Storage, RLS |
| 8 | `20260722100000_create_financial_action_center.sql` | financial actions, events, permissions, lifecycle |
| 9 | `20260722103000_harden_financial_action_lifecycle.sql` | action transition and approval hardening |
| 10 | `20260722113000_fix_financial_action_approval_hash.sql` | deterministic approved-payload hashing |
| 11 | `20260722140000_add_security_audit_events.sql` | security audit events and audit triggers |
| 12 | `20260722180000_reconcile_reports_index_and_comment.sql` | historical report index/comment reconciliation |
| 13 | `20260722190000_add_company_business_activity_and_financial_settings.sql` | business activity and validated alert settings |
| 14 | `20260723120000_add_invoice_delivery_notifications.sql` | invoice delivery events and notifications |
| 15 | `20260728120000_add_core_company_indexes.sql` | company-scoped unique and query indexes for core tables |

Historical migrations contain `DROP ... IF EXISTS` statements for replacing
policies and triggers. They do not drop tables or delete application data. They
are already-applied history and must not be edited. No new destructive
statement was introduced by this audit.

## Principal bootstrap defect

No migration creates the following foundational tables:

- `public.customers`
- `public.sales`
- `public.expenses`
- `public.inventory`
- `public.invoices`
- `public.conversations`
- `public.messages`

The linked database has all seven tables, which proves that they were created
outside the current migration history.

This causes two deterministic empty-database failures:

1. `20260719193000_create_rag_documents.sql` executes
   `ALTER TABLE public.messages ADD COLUMN ... sources`, but `messages` does not
   exist.
2. `20260720170000_create_single_company_auth.sql` explicitly aborts when any
   foundational financial/chat table is missing.

The new foundational migration fixes both failures without changing historical
migrations. `messages` is now created before the RAG migration, and all tables
required by the Auth migration exist before it starts.

## Schema Gap Matrix

Legend:

- **Actual** means observed in the linked database through read-only OpenAPI.
- **Migrated** means created by the current ordered migration set.
- **Partial** means the object is created, but complete database equivalence
  cannot yet be proved.

| Required element | Actual | Migrated | Gap or evidence |
|---|---|---|---|
| `pgcrypto` | Indirectly evidenced by UUID/digest-dependent deployed objects | Yes | Created by reports/RAG/Auth migrations. |
| `vector` / `vector(384)` | Yes | Yes | `document_chunks.embedding` is `vector(384)` in migration and deployed schema. |
| `customers` | Yes | Yes | Created by the new foundational migration and tenant-hardened by Auth. |
| `sales` | Yes | Yes | Uses `numeric(18,2)` and a deterministic total check. |
| `expenses` | Yes | Yes | Uses positive `numeric(18,2)` amounts. |
| `inventory` | Yes | Yes | Uses fixed-scale prices and a company-scoped SKU index. |
| `invoices` | Yes | Yes | Uses fixed-scale total/VAT and a company-scoped invoice-number index. |
| `conversations` | Yes | Yes | Created before Auth and protected by tenant RLS. |
| `messages` | Yes | Yes | Created before RAG; RAG then adds structured `sources`. |
| `companies` | Yes | Yes | Auth migration creates one singleton company and prevents a second row. |
| `company_members` | Yes | Yes | Auth migration creates one membership per Auth user. |
| User profile data | Yes, in Supabase Auth metadata | N/A | Current product stores `full_name`, avatar, and profile metadata in `auth.users.user_metadata`; no public `profiles` table is required by code. |
| `company_invitations` | Yes | Yes | Auth/invitation migrations create hashed, expiring, single-use invitations. |
| `reports` | Yes | Yes | Created by the first migration and tenant-hardened later. |
| `documents` | Yes | Yes | Created by RAG migration, tenant-hardened later. |
| `document_chunks` | Yes | Yes | Created with composite document relationship and `vector(384)`. |
| Legacy RAG chunk preservation | No legacy rows in empty Local build | Yes | Conditional preservation path executes safely when a legacy table exists. |
| `financial_attachments` | Yes | Yes | Metadata, record/company FKs, MIME/size/hash checks and private bucket are migrated. |
| `financial_actions` | Yes | Yes | Migrated with `numeric(18,2)` impact, deduplication, approval state, and source fields. |
| `financial_action_events` | Yes | Yes | Migrated with composite action/company FK and audit timeline index. |
| `security_audit_events` | Yes | Yes | Migrated; actual trigger coverage needs SQL verification. |
| `invoice_delivery_events` | Yes | Yes | Migrated with company-scoped idempotency. |
| `notifications` | Yes | Yes | Migrated with company-scoped deduplication. |
| Private `reports` bucket | Verified locally | Yes | Private, PDF-only, 10 MiB. |
| Private `documents` bucket | Verified locally | Yes | Private, allowlisted document types, 10 MiB. |
| Private `financial-attachments` bucket | Verified locally | Yes | Private, PDF/PNG/JPEG, 5 MiB. |
| Single-company RLS | Verified locally | Yes | All 19 required public tables have RLS enabled. |
| Storage RLS | Verified locally | Yes | Viewer write denied; accountant company-folder upload/delete succeeded. |
| Central RBAC | RPCs are visible | Yes | `private.app_roles`, permissions, role-permission matrix, `private.has_permission`. |
| Last-owner protection | Verified locally | Yes | Owner demotion and admin modification of owner were rejected. |
| Core-table check constraints | Verified locally | Yes | Length, range, status, VAT, and deterministic sale-total checks are migrated. |
| Core-table indexes | Verified locally | Yes | Base and company-scoped indexes are migrated and catalog-checked. |
| Core-table update timestamps | Verified locally | Yes | `public.set_core_updated_at` triggers cover mutable core tables. |

## Required foundational schema

The new-database baseline must encode the API's current contracts without using
floating-point money.

### Customers

- UUID primary key with `gen_random_uuid()`.
- `name text not null`, trimmed length 1-200.
- nullable `email`, `phone`, `company_name`, and `notes`.
- `company_name` length at most 200; `notes` at most 4000.
- `created_at` and `updated_at` as non-null `timestamptz`.

### Sales

- UUID primary key.
- nullable customer UUID.
- `product_name text not null`, length 1-200.
- `quantity integer not null`, 1 through 1,000,000.
- `unit_price numeric(18,2) not null`, non-negative.
- `total_amount numeric(18,2) not null`, server-calculated and database-checked
  where compatibility allows.
- status limited to `completed`, `pending`, `refunded`, `cancelled`.
- nullable `sale_date timestamptz` and standard timestamps.

### Expenses

- UUID primary key.
- category text length 1-100.
- `amount numeric(18,2) not null`, strictly positive.
- nullable description (maximum 4000) and vendor (maximum 200).
- nullable `expense_date timestamptz`.
- non-null `is_flagged boolean` default false.
- standard timestamps.

### Inventory

- UUID primary key.
- product name length 1-200.
- nullable normalized SKU, maximum 100.
- quantity and reorder level integers from 0 through 1,000,000,000.
- `cost_price` and `selling_price` as non-negative `numeric(18,2)`.
- nullable `last_sold timestamptz` and standard timestamps.

### Invoices

- UUID primary key and nullable customer UUID.
- invoice number length 1-100.
- `total_amount numeric(18,2)` and `vat_amount numeric(18,2)`, non-negative,
  with VAT not exceeding total.
- status limited to `paid`, `unpaid`, `overdue`, `cancelled`.
- nullable due date and legacy file URL field for compatibility.
- standard timestamps.

### Conversations and messages

- Conversation UUID, nullable title, and standard timestamps.
- Message UUID, conversation UUID with cascade deletion, role limited to
  `user` or `assistant`, non-empty content, `sources jsonb` defaulting to an
  empty array, and `created_at`.

The foundational migration should initially create these seven tables before
the reports/RAG migrations. The existing Auth migration will then add and
backfill `company_id`, add tenant foreign keys, attach trusted company-ID
triggers, and create RLS. This transitional ordering keeps already-applied
tenant migrations immutable.

## Single Company + Multiple Users proof

The existing design implements the approved architecture in three layers:

### Database

- `companies.singleton_key` has a true-only check and a unique index, preventing
  a second company.
- `company_members` has a unique `user_id`, allowing one current membership per
  user.
- `private.current_company_id()` derives the company from `auth.uid()`.
- `private.assign_current_company_id()` overwrites an authenticated caller's
  supplied company ID with the membership-derived ID.
- tenant tables use company foreign keys and cross-company composite foreign
  keys.
- the last owner cannot be deleted or demoted.
- private Storage paths require their first folder to equal the membership
  company ID.

### Backend

- Bearer authentication calls `get_my_auth_context`.
- `RequestContext.company_id` comes from the authenticated membership.
- stores read that request context rather than accepting a frontend company ID.
- Pydantic input schemas use `extra="forbid"` and do not define `company_id`.
- route permissions are checked centrally.

### Frontend

- CRM contract tests confirm that the five API clients do not send
  `company_id`.
- identity and permissions come from `/auth/me`.
- UI permission checks are convenience controls; backend and RLS remain the
  authority.
- there is no Company Switcher.

Current central permissions are:

- `owner`: all base permissions.
- `admin`: all base permissions, while database/backend rules prevent it from
  changing an owner.
- `accountant`: company read, financial read/write, document read/write, report
  read/write, chat, and non-approval Action Center work.
- `viewer`: company/financial/document/report read, chat, and Action Center
  read only.

Action approval and assignment are limited to owner/admin. Security-audit reads
are limited to owner/admin.

## Money and rounding

The database baseline and all later hardening must follow
`docs/MONEY_AND_ROUNDING_POLICY.md`:

- PostgreSQL `numeric(18,2)` for standard monetary columns.
- exactly two decimal places for the Pilot.
- Python `Decimal` and `ROUND_HALF_UP`.
- string JSON serialization for precision-sensitive monetary values.
- no PostgreSQL `real` or `double precision` for money.
- no JavaScript `number` coercion in financial API contracts.
- the server recalculates totals and must not trust a submitted total.

Existing migrated monetary columns already using `numeric(18,2)` include
company opening balance and Action Center financial impact. The foundational
core migration must use the same type for sales, expenses, inventory, and
invoices.

## Implemented migrations and verification

### 1. Foundational migration

`supabase/migrations/20260719100000_create_core_financial_and_chat_schema.sql`

SHA-256:
`EF64E0D88E296BA050796710948F7AAF41D5AEEA23F3943FE7CE1421C8FFF01F`

It sorts before the previous first migration and:

- run in a transaction;
- creates `pgcrypto` if required;
- creates only the seven missing core financial/chat tables;
- uses UUID keys, `numeric(18,2)`, timestamps, conservative checks, and
  single-table relationships;
- contains no seed data, company row, or user row;
- contains no `DROP`, `TRUNCATE`, `DELETE`, or data rewrite;
- allows the existing Auth migration to add tenant columns and cross-company
  relationships later.

Because this timestamp predates already-applied migrations, it must **never**
be pushed to the existing linked project automatically. After isolated
verification, adopting it for the existing project requires a separate,
explicit migration-history reconciliation decision based on read-only schema
equivalence. `--include-all` was not used during this phase.

### 2. Company-scoped core indexes

`supabase/migrations/20260728120000_add_core_company_indexes.sql`

SHA-256:
`6AC0BBF3F1DFC1C31A094129E9653C03EF3708BFBE9A588D1C7F5E4C63E8C00B`

This transaction runs after Auth has added `company_id`. It creates:

- case-insensitive per-company invoice-number uniqueness;
- case-insensitive per-company SKU uniqueness;
- company/date indexes for customers, sales, expenses, conversations, and
  messages;
- a company/status/due-date invoice index;
- a company/quantity/reorder-level inventory index.

It contains no data write or destructive statement. If an existing database
contains duplicate invoice numbers or SKUs within the company, future
application would abort rather than rewrite data.

### 3. Bootstrap verification SQL

`supabase/verification/20260728_database_bootstrap_checks.sql` asserts:

- every required extension, schema, table, column, type, default, check,
  foreign key, unique constraint, and index;
- exactly one company after Auth bootstrap migration;
- a second company insert fails;
- every tenant table has RLS enabled and expected policies;
- every tenant table has a trusted company-ID assignment trigger;
- last-owner deletion/demotion fails;
- viewer writes fail;
- accountant financial writes succeed but member management fails;
- users without membership receive no tenant data;
- a forged `company_id` cannot move or create data in another tenant;
- report/document/attachment buckets are private;
- viewer Storage writes fail and authorized reads remain company-folder scoped;
- document embeddings are exactly `vector(384)`;
- all monetary columns are `numeric(18,2)`.

### 4. Backend integration and CRUD smoke suite

`backend-python/tests/local_database_bootstrap_check.py` has a hard guard that
rejects every API/database host except localhost. Against Supabase Local it:

- creates confirmed test users for owner, admin, accountant, viewer, and a user
  without membership;
- bootstraps the owner once;
- invites and attaches the other roles;
- runs create/read/update/delete smoke tests for customers, sales, expenses,
  inventory, and invoices;
- verifies server-calculated totals and decimal serialization;
- verifies financial, VAT, uniqueness, and deterministic-total constraints;
- verifies Action Center viewer read/write permissions;
- verifies RLS, company derivation, private Storage roles, and owner protection;
- removes disposable data by destroying the isolated stack.

Existing `live_*.py` scripts are not safe to run against the linked project for
this phase because several create and clean up records or Storage objects.

## Required two-build reproducibility procedure

### Build 1

1. Started a clean Supabase Local stack.
2. Apply every migration in filename order.
3. Run catalog/schema verification.
4. Run RLS, RBAC, last-owner, forged-company, and Storage policy tests.
5. Run backend integration and CRUD smoke tests.
6. Export only schema fingerprints and test results, never secrets or data.
7. Destroyed the isolated database.

### Build 2

1. Recreated the same empty Supabase Local stack with no backup.
2. Apply the same migration files, unmodified and in the same order.
3. Repeat the complete verification suite.
4. Compare normalized schema fingerprints from both builds.
5. The fingerprint matched Build 1 exactly.

No rollback test is required unless a migration has an explicitly designed,
non-destructive rollback.

## Actual test results

Both database builds produced:

- 19 required public tables;
- 19 public tables with RLS enabled;
- 47 public RLS policies;
- 11 `storage.objects` policies;
- 3 required private buckets;
- pgvector with `vector(384)`;
- all nine verified monetary columns as `numeric(18,2)`;
- identical schema fingerprint
  `bece83319e07ba4fc81a604f7b33f774547a46f44c63a7fe4ddbb43dac2c7b3b`.

Behavioral integration results passed on the two required clean builds. The
final script, including the added constraint-rejection cases, also passed on an
additional clean validation rebuild:

- owner bootstrap: passed;
- owner, admin, accountant, and viewer `/auth/me`: passed;
- unauthenticated request: `401`;
- user without membership: `403`;
- viewer financial write: rejected;
- accountant financial CRUD: passed;
- accountant member management: rejected;
- admin modification of owner: rejected;
- last-owner demotion: rejected;
- second-company creation: rejected;
- frontend/API `company_id` smuggling: rejected;
- direct authenticated `company_id` spoof: overwritten from membership;
- incorrect deterministic sale total: rejected;
- negative expense: rejected;
- VAT above invoice total: rejected;
- duplicate per-company SKU and invoice number: rejected;
- viewer Storage write: rejected;
- accountant company-folder Storage upload/delete: passed;
- Action Center viewer read and write restriction: passed;
- deterministic `0.10 × 3 = 0.30` backend sale total: passed.

Schema lint:

- `supabase db lint --local --level warning`: no schema errors.

Application regression tests:

- Backend: `138 passed`.
- Python compilation: passed.
- Frontend tests: `41 passed`.
- TypeScript `--noEmit`: passed.
- Next.js production build: passed, 24 pages generated.

## Current risk register

1. **Historical baseline adoption:** adding an earlier migration requires a
   deliberate history-reconciliation strategy for the existing project.
2. **Hosted catalog equivalence:** the new baseline and indexes were fully
   verified locally, but the hosted project's private catalog has not been
   compared through a direct read-only SQL connection.
3. **Existing duplicate risk:** the new company-scoped unique indexes would
   intentionally abort on a hosted database containing duplicate invoice
   numbers or SKUs. A read-only duplicate check is mandatory before any future
   hosted application.
4. **Historical object replacement:** immutable migrations contain safe
   `DROP POLICY/TRIGGER IF EXISTS` replacement statements. They are not table or
   data drops, but the files cannot be changed without breaking migration
   history.
5. **Local infrastructure:** `db reset --local` can briefly leave Kong with a
   stale Storage route while containers restart. The reproducibility test used
   full `stop --no-backup` plus `start`, which completed successfully.
6. **Next.js workspace warning:** the project-local Supabase CLI introduces a
   root lockfile in addition to the frontend lockfile. The build succeeds, but
   Next.js reports that it inferred the repository root.
7. **Pilot currency limitation:** all money is intentionally fixed to two
   decimal places; currency-specific scale is post-Pilot.

## Hosted-project boundary

This phase validates clean-database reproducibility only. It does not authorize
or perform hosted migration application.

Before any future hosted action:

1. compare the hosted catalog read-only with both new migrations;
2. check duplicate per-company SKUs and invoice numbers;
3. decide explicitly how to reconcile the earlier baseline timestamp in hosted
   migration history;
4. take a protected row-count snapshot;
5. obtain a separate approval for the exact files and hashes.
