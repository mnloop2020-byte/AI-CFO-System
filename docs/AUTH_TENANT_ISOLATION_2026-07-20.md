# Supabase Auth and tenant isolation

## Pre-migration snapshot

Captured from the current Supabase project before applying the tenant migration:

| Table | Rows |
| --- | ---: |
| customers | 2 |
| sales | 1 |
| expenses | 3 |
| inventory | 1 |
| invoices | 1 |
| conversations | 27 |
| messages | 134 |
| documents | 4 |
| document_chunks | 4 |
| rag_document_chunks_legacy_20260719 | 4 |
| auth.users | 0 |

Project Reference: `tjadermimgzncdvfjpra`.

## Migration

Apply `supabase/migrations/20260720120000_create_auth_and_tenant_isolation.sql`
manually in the SQL editor of the project above. The migration:

- never drops a table or deletes an existing row;
- creates `companies` and `company_members`;
- assigns all preserved development rows to company
  `00000000-0000-0000-0000-000000000001`;
- adds mandatory `company_id` columns, indexes, and tenant-safe composite
  foreign keys;
- derives the active company from `auth.uid()` inside a private schema;
- overwrites client-supplied `company_id` values for authenticated writes;
- enables database and private Storage RLS;
- lets the first real user claim the preserved development company and creates
  a separate company for each later sign-up.

After the migration succeeds, run
`supabase/verification/20260720_auth_tenant_isolation_checks.sql`. All
`null_company_ids` values and `rls_disabled_tables` must be empty/zero, both
Storage buckets must remain private, `embedding_dimension` must be `384`, and
the four legacy RAG rows must remain.

## Environment values

Copy the current project's **publishable key** from Supabase Dashboard →
Project Settings → API. Do not use or expose the service-role key in the
frontend.

Frontend (`frontend/.env.local`):

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SUPABASE_URL=https://tjadermimgzncdvfjpra.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<current project publishable key>
```

Backend (`backend-python/.env`):

```dotenv
SUPABASE_PUBLISHABLE_KEY=<current project publishable key>
```

The backend keeps `SUPABASE_SERVICE_ROLE_KEY` server-only for verified user
lookup and trusted background document processing. Normal CRUD uses the
user's verified access token so RLS is enforced.

## Required Auth configuration

In Supabase Auth URL Configuration:

- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/auth/callback`

Email confirmation may stay enabled. The register page handles both immediate
sessions and email-confirmation flows.

## Isolation test

1. Register temporary User A with Company A. The first user should receive the
   preserved development company and see the existing test records.
2. Register temporary User B with Company B in a private browser session. It
   must see zero Company A records.
3. Create one temporary customer and one temporary document as User B.
4. As User A, direct requests for both User B identifiers must return no row or
   `404`; User B must likewise be unable to read User A records or Storage
   objects.
5. Delete only the temporary User B data and account after testing. Never
   delete the four legacy RAG documents.
