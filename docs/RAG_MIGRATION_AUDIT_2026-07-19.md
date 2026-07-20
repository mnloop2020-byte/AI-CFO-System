# RAG Migration Pre-Application Audit

Audit date: 2026-07-19

## Target project

- Current `SUPABASE_URL` host: `tjadermimgzncdvfjpra.supabase.co`
- Project Reference derived from the current URL: `tjadermimgzncdvfjpra`
- The configured opaque service-role credential successfully read the legacy
  `documents` table through this URL.
- Old `DATABASE_URL` and `DIRECT_URL` values were not used or modified.

## Recorded state before migration

- Legacy `documents` rows: **4**
- Legacy columns: `id`, `content`, `embedding`, `metadata`, `created_at`
- Existing Storage buckets returned by the current project: **0**

This count is the pre-application preservation checkpoint. No document IDs,
contents, or embeddings were copied into this audit file.

## Migration reviewed

`supabase/migrations/20260719193000_create_rag_documents.sql`

Automated safety checks passed:

- No `DROP TABLE` statement.
- No `TRUNCATE` statement.
- No `DELETE FROM` statement.
- Legacy table is renamed, not dropped.
- All legacy rows are copied into the new metadata/chunk structure.
- Embeddings use `vector(384)`.
- `document_chunks.document_id` references `documents.id` with
  `ON DELETE CASCADE`.
- `company_id uuid not null` exists on documents and chunks.
- Vector retrieval filters both documents and chunks by `company_id`.
- The `documents` bucket is private and limited to 10 MB.
- RLS is enabled with no anon/authenticated table or Storage policies.

## Required post-application verification

- `public.documents` exists and contains the four migrated legacy records.
- `public.document_chunks` exists and contains their four migrated chunks.
- `public.match_document_chunks` exists with the company filter.
- The HNSW embedding index and company/document indexes exist.
- The private `documents` bucket exists.
- The new metadata rows have status `ready` and the development company ID.

Do not continue to live upload testing unless the SQL Editor or connection
string belongs to Project Reference `tjadermimgzncdvfjpra`.

## Post-application verification — 2026-07-20

The migration was applied manually in the correct Supabase SQL Editor and
returned `Success. No rows returned.`

Verified through the live service-role connection:

- `public.documents`: 4 migrated legacy documents, all `ready`.
- `public.document_chunks`: 4 chunks, one for each legacy document.
- All document and chunk rows use the development `company_id`.
- All four migrated document IDs were recorded before the temporary test.
- Private `documents` bucket exists, is not public, and has a 10 MB limit.
- `match_document_chunks` executed successfully with the company filter.
- The migration completed after creating its company, document, and HNSW
  indexes; the embedding search function was exercised successfully.

## End-to-end test — 2026-07-20

Only `backend-python/tests/fixtures/rag-source-test.txt` was uploaded.

- Processing transitioned from `uploaded` to `processing` to `ready`.
- One chunk was created.
- English retrieval returned the correct 27,450 threshold and 45-day cycle.
- Arabic retrieval returned the same values.
- Both responses returned `rag-source-test.txt`, chunk 1, as an inline and
  structured source.
- Similarity scores were approximately 0.818 for English and 0.778 for Arabic.
- The temporary document, its one chunk, and its private Storage object were
  deleted.
- The same four migrated document IDs remained `ready` afterward.
- The preserved legacy table still contains its original four rows.
- The private bucket remained private.

No real company document was uploaded during this test.
