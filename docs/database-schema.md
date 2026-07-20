# Database migrations

The repository now keeps database changes in `supabase/migrations`.

## Reports and private PDF storage

Apply `supabase/migrations/20260719141000_create_reports.sql` from the
Supabase SQL Editor before enabling stored report history.

The migration creates:

- `public.reports`, which stores report metadata, generated Markdown, and the
  private path of each PDF file.
- A private Supabase Storage bucket named `reports` limited to PDF files up to
  10 MB.
- Row Level Security on `public.reports` with no browser-facing policies.

Until real authentication and tenant isolation exist, reports must be read and
written only through FastAPI with its server-side service-role credential. Do
not expose that credential to the frontend.

## RAG documents and private source storage

Apply `supabase/migrations/20260719193000_create_rag_documents.sql` before
enabling the Knowledge documents page.

The migration:

- Creates a private `documents` Storage bucket with a 10 MB limit and an
  allowlist for PDF, DOCX, TXT, Markdown, and CSV.
- Preserves the proof-of-concept chunk table and migrates its rows without
  deleting the original content.
- Creates `public.documents` for file metadata and processing states:
  `uploaded`, `processing`, `ready`, and `failed`.
- Creates `public.document_chunks` with `vector(384)` embeddings and cascade
  deletion from the parent document.
- Requires `company_id` on both tables and filters vector search by that ID.
- Creates `match_document_chunks` for tenant-scoped similarity search.
- Enables RLS and grants no browser-facing access or Storage policies.

This integration is development-only. `DEVELOPMENT_COMPANY_ID` is assigned by
the backend so the schema will not need to be rebuilt later, but it does not
replace verified Supabase Auth membership, tenant isolation, or RLS policies.
Never upload real company documents until those controls are complete.
