create extension if not exists pgcrypto;
create extension if not exists vector;

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'documents',
    'documents',
    false,
    10485760,
    array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/csv'
    ]
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Preserve the original proof-of-concept table before introducing the
-- document metadata/chunk split. No legacy content is dropped.
do $$
begin
    if to_regclass('public.documents') is not null
       and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'documents'
             and column_name = 'content'
       )
       and not exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'documents'
             and column_name = 'file_name'
       ) then
        alter table public.documents
            rename to rag_document_chunks_legacy_20260719;
    end if;
end
$$;

create table if not exists public.documents (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null,
    file_name text not null,
    mime_type text not null,
    size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
    storage_path text not null unique,
    sha256 text not null,
    status text not null default 'uploaded' check (
        status in ('uploaded', 'processing', 'ready', 'failed')
    ),
    chunk_count integer not null default 0 check (chunk_count >= 0),
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.documents(id) on delete cascade,
    company_id uuid not null,
    chunk_index integer not null check (chunk_index >= 0),
    content text not null check (length(btrim(content)) > 0),
    embedding vector(384) not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (document_id, chunk_index)
);

create index if not exists documents_company_created_index
    on public.documents (company_id, created_at desc);

create index if not exists documents_company_status_index
    on public.documents (company_id, status);

create index if not exists document_chunks_document_index
    on public.document_chunks (document_id, chunk_index);

create index if not exists document_chunks_company_index
    on public.document_chunks (company_id);

create index if not exists document_chunks_embedding_hnsw_index
    on public.document_chunks
    using hnsw (embedding vector_cosine_ops);

create or replace function public.set_document_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_document_updated_at();

create or replace function public.match_document_chunks(
    query_embedding vector(384),
    filter_company_id uuid,
    match_count integer default 5
)
returns table (
    chunk_id uuid,
    document_id uuid,
    file_name text,
    chunk_index integer,
    content text,
    metadata jsonb,
    similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
    select
        chunks.id as chunk_id,
        chunks.document_id,
        documents.file_name,
        chunks.chunk_index,
        chunks.content,
        chunks.metadata,
        1 - (chunks.embedding <=> query_embedding) as similarity
    from public.document_chunks as chunks
    join public.documents as documents
      on documents.id = chunks.document_id
    where chunks.company_id = filter_company_id
      and documents.company_id = filter_company_id
      and documents.status = 'ready'
    order by chunks.embedding <=> query_embedding
    limit greatest(1, least(match_count, 20));
$$;

-- Preserve legacy proof-of-concept chunks as ready development documents.
do $$
declare
    legacy_row record;
    migrated_document_id uuid;
    development_company_id constant uuid :=
        '00000000-0000-0000-0000-000000000001'::uuid;
begin
    if to_regclass('public.rag_document_chunks_legacy_20260719') is not null then
        for legacy_row in
            select id, content, embedding, metadata, created_at
            from public.rag_document_chunks_legacy_20260719
        loop
            insert into public.documents (
                company_id,
                file_name,
                mime_type,
                size_bytes,
                storage_path,
                sha256,
                status,
                chunk_count,
                created_at,
                updated_at
            )
            values (
                development_company_id,
                coalesce(nullif(legacy_row.metadata->>'source', ''), 'Legacy manual context') || '.txt',
                'text/plain',
                greatest(1, octet_length(legacy_row.content)),
                'legacy/' || legacy_row.id::text || '.txt',
                encode(digest(legacy_row.content, 'sha256'), 'hex'),
                'ready',
                1,
                coalesce(legacy_row.created_at, now()),
                coalesce(legacy_row.created_at, now())
            )
            on conflict (storage_path) do update
                set updated_at = excluded.updated_at
            returning id into migrated_document_id;

            insert into public.document_chunks (
                document_id,
                company_id,
                chunk_index,
                content,
                embedding,
                metadata,
                created_at
            )
            values (
                migrated_document_id,
                development_company_id,
                0,
                legacy_row.content,
                legacy_row.embedding,
                coalesce(legacy_row.metadata, '{}'::jsonb),
                coalesce(legacy_row.created_at, now())
            )
            on conflict (document_id, chunk_index) do nothing;
        end loop;
    end if;
end
$$;

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

revoke all on table public.documents from anon, authenticated;
revoke all on table public.document_chunks from anon, authenticated;
grant all on table public.documents to service_role;
grant all on table public.document_chunks to service_role;
grant execute on function public.match_document_chunks(vector, uuid, integer)
    to service_role;

alter table public.messages
    add column if not exists sources jsonb not null default '[]'::jsonb;

comment on table public.documents is
    'Development-only private RAG document metadata. company_id is required from the first version.';
comment on table public.document_chunks is
    'Tenant-scoped RAG chunks and 384-dimensional multilingual embeddings.';

-- Intentionally no anon/authenticated Storage policies are created. The
-- private bucket is accessed only by FastAPI with its server-side service role
-- until Supabase Auth, verified tenant membership, and RLS policies exist.
