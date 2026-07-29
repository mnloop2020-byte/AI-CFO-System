-- Supabase Auth and tenant-isolation foundation.
--
-- Safety properties:
--   * No table or business row is dropped.
--   * Existing rows are assigned to the fixed development company.
--   * Authenticated requests derive their company from auth.uid().
--   * Client-supplied company_id values are overwritten by a trigger.
--   * service_role remains available only for trusted background work.

create extension if not exists pgcrypto;
create extension if not exists vector;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.companies (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(btrim(name)) > 0),
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
    company_id uuid not null references public.companies(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null default 'member' check (
        role in ('owner', 'admin', 'member', 'viewer')
    ),
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (company_id, user_id)
);

create unique index if not exists company_members_one_default_per_user
    on public.company_members (user_id)
    where is_default;

create index if not exists company_members_user_index
    on public.company_members (user_id, is_default desc, created_at);

insert into public.companies (id, name)
values (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Development Company'
)
on conflict (id) do nothing;

-- The reports migration may not have been applied in older development
-- projects. Create the same table and private bucket here when absent so the
-- tenant migration has complete coverage in either migration order.
create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),
    report_type text not null check (
        report_type in (
            'complete_cfo',
            'executive_brief',
            'sales_performance',
            'cash_flow_summary',
            'tax_summary',
            'risk_review'
        )
    ),
    generator text not null check (
        generator in (
            'report_writer',
            'ceo',
            'sales',
            'cashflow',
            'tax',
            'fraud'
        )
    ),
    language text not null check (language in ('en', 'ar')),
    content text not null,
    generated_at timestamptz not null,
    storage_path text not null unique,
    file_name text not null,
    created_at timestamptz not null default now()
);

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'reports',
    'reports',
    false,
    10485760,
    array['application/pdf']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function private.set_updated_at();

drop trigger if exists company_members_set_updated_at on public.company_members;
create trigger company_members_set_updated_at
before update on public.company_members
for each row execute function private.set_updated_at();

-- Backfill every existing business record into the legacy development
-- company before making company_id mandatory. Tables that have not been
-- deployed yet (for example reports) are skipped safely.
do $$
declare
    table_name text;
    company_constraint_name text;
    unique_constraint_name text;
    development_company_id constant uuid :=
        '00000000-0000-0000-0000-000000000001'::uuid;
begin
    foreach table_name in array array[
        'customers',
        'sales',
        'expenses',
        'inventory',
        'invoices',
        'conversations',
        'messages',
        'reports',
        'documents',
        'document_chunks'
    ]
    loop
        if to_regclass(format('public.%I', table_name)) is null then
            continue;
        end if;

        execute format(
            'alter table public.%I add column if not exists company_id uuid',
            table_name
        );

        execute format(
            'update public.%I set company_id = $1 where company_id is null',
            table_name
        ) using development_company_id;

        execute format(
            'alter table public.%I alter column company_id set not null',
            table_name
        );

        company_constraint_name := table_name || '_company_id_fkey';
        if not exists (
            select 1
            from pg_constraint
            where conname = company_constraint_name
              and conrelid = format('public.%I', table_name)::regclass
        ) then
            execute format(
                'alter table public.%I add constraint %I foreign key (company_id) references public.companies(id) on delete restrict not valid',
                table_name,
                company_constraint_name
            );
            execute format(
                'alter table public.%I validate constraint %I',
                table_name,
                company_constraint_name
            );
        end if;

        unique_constraint_name := table_name || '_id_company_id_key';
        if not exists (
            select 1
            from pg_constraint
            where conname = unique_constraint_name
              and conrelid = format('public.%I', table_name)::regclass
        ) then
            execute format(
                'alter table public.%I add constraint %I unique (id, company_id)',
                table_name,
                unique_constraint_name
            );
        end if;

        execute format(
            'create index if not exists %I on public.%I (company_id)',
            table_name || '_company_id_index',
            table_name
        );
    end loop;
end
$$;

-- Add composite foreign keys so a child row can never reference a parent
-- owned by a different company. Existing single-column keys are retained.
do $$
begin
    if to_regclass('public.sales') is not null
       and to_regclass('public.customers') is not null
       and not exists (
           select 1 from pg_constraint
           where conname = 'sales_customer_company_fkey'
             and conrelid = 'public.sales'::regclass
       ) then
        alter table public.sales
            add constraint sales_customer_company_fkey
            foreign key (customer_id, company_id)
            references public.customers(id, company_id)
            on delete restrict
            not valid;
        alter table public.sales
            validate constraint sales_customer_company_fkey;
    end if;

    if to_regclass('public.invoices') is not null
       and to_regclass('public.customers') is not null
       and not exists (
           select 1 from pg_constraint
           where conname = 'invoices_customer_company_fkey'
             and conrelid = 'public.invoices'::regclass
       ) then
        alter table public.invoices
            add constraint invoices_customer_company_fkey
            foreign key (customer_id, company_id)
            references public.customers(id, company_id)
            on delete restrict
            not valid;
        alter table public.invoices
            validate constraint invoices_customer_company_fkey;
    end if;

    if to_regclass('public.messages') is not null
       and to_regclass('public.conversations') is not null
       and not exists (
           select 1 from pg_constraint
           where conname = 'messages_conversation_company_fkey'
             and conrelid = 'public.messages'::regclass
       ) then
        alter table public.messages
            add constraint messages_conversation_company_fkey
            foreign key (conversation_id, company_id)
            references public.conversations(id, company_id)
            on delete cascade
            not valid;
        alter table public.messages
            validate constraint messages_conversation_company_fkey;
    end if;

    if to_regclass('public.document_chunks') is not null
       and to_regclass('public.documents') is not null
       and not exists (
           select 1 from pg_constraint
           where conname = 'document_chunks_document_company_fkey'
             and conrelid = 'public.document_chunks'::regclass
       ) then
        alter table public.document_chunks
            add constraint document_chunks_document_company_fkey
            foreign key (document_id, company_id)
            references public.documents(id, company_id)
            on delete cascade
            not valid;
        alter table public.document_chunks
            validate constraint document_chunks_document_company_fkey;
    end if;
end
$$;

create or replace function private.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select member.company_id
    from public.company_members as member
    where member.user_id = (select auth.uid())
    order by member.is_default desc, member.created_at, member.company_id
    limit 1;
$$;

create or replace function private.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.company_members as member
        where member.company_id = target_company_id
          and member.user_id = (select auth.uid())
    );
$$;

create or replace function private.has_company_role(
    target_company_id uuid,
    allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.company_members as member
        where member.company_id = target_company_id
          and member.user_id = (select auth.uid())
          and member.role = any(allowed_roles)
    );
$$;

-- Authenticated inserts and updates always use the company resolved from the
-- signed JWT. Any company_id sent by a browser is ignored. Trusted service
-- role jobs must provide an explicit company_id.
create or replace function private.assign_current_company_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    resolved_company_id uuid;
begin
    if (select auth.role()) = 'service_role' then
        if new.company_id is null then
            raise exception 'Trusted service operation requires company_id';
        end if;
        return new;
    end if;

    resolved_company_id := private.current_company_id();
    if resolved_company_id is null then
        raise exception 'Authenticated user has no company membership';
    end if;

    new.company_id := resolved_company_id;
    return new;
end;
$$;

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'customers',
        'sales',
        'expenses',
        'inventory',
        'invoices',
        'conversations',
        'messages',
        'reports',
        'documents',
        'document_chunks'
    ]
    loop
        if to_regclass(format('public.%I', table_name)) is null then
            continue;
        end if;

        execute format(
            'drop trigger if exists assign_current_company_id on public.%I',
            table_name
        );
        execute format(
            'create trigger assign_current_company_id before insert or update on public.%I for each row execute function private.assign_current_company_id()',
            table_name
        );
    end loop;
end
$$;

-- The first registered user claims the preserved development company and its
-- existing records. Later sign-ups receive a new isolated company. An
-- advisory transaction lock prevents simultaneous sign-ups from both
-- claiming the legacy company.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    development_company_id constant uuid :=
        '00000000-0000-0000-0000-000000000001'::uuid;
    target_company_id uuid;
    requested_company_name text;
begin
    perform pg_advisory_xact_lock(hashtext('zemam-first-company-onboarding'));

    requested_company_name := nullif(
        btrim(coalesce(new.raw_user_meta_data ->> 'company_name', '')),
        ''
    );

    if not exists (
        select 1
        from public.company_members
        where company_id = development_company_id
    ) then
        target_company_id := development_company_id;
        update public.companies
        set
            name = coalesce(requested_company_name, name),
            created_by = coalesce(created_by, new.id),
            updated_at = now()
        where id = target_company_id;
    else
        insert into public.companies (name, created_by)
        values (
            coalesce(requested_company_name, 'My Company'),
            new.id
        )
        returning id into target_company_id;
    end if;

    insert into public.company_members (
        company_id,
        user_id,
        role,
        is_default
    )
    values (
        target_company_id,
        new.id,
        'owner',
        true
    );

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

alter table public.companies enable row level security;
alter table public.company_members enable row level security;

drop policy if exists companies_select_member on public.companies;
create policy companies_select_member
on public.companies
for select
to authenticated
using ((select private.is_company_member(id)));

drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin
on public.companies
for update
to authenticated
using ((select private.has_company_role(id, array['owner', 'admin'])))
with check ((select private.has_company_role(id, array['owner', 'admin'])));

drop policy if exists company_members_select_member on public.company_members;
create policy company_members_select_member
on public.company_members
for select
to authenticated
using ((select private.is_company_member(company_id)));

drop policy if exists company_members_insert_admin on public.company_members;
create policy company_members_insert_admin
on public.company_members
for insert
to authenticated
with check ((select private.has_company_role(
    company_id,
    array['owner', 'admin']
)));

drop policy if exists company_members_update_admin on public.company_members;
create policy company_members_update_admin
on public.company_members
for update
to authenticated
using ((select private.has_company_role(
    company_id,
    array['owner', 'admin']
)))
with check ((select private.has_company_role(
    company_id,
    array['owner', 'admin']
)));

drop policy if exists company_members_delete_admin on public.company_members;
create policy company_members_delete_admin
on public.company_members
for delete
to authenticated
using ((select private.has_company_role(
    company_id,
    array['owner', 'admin']
)));

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'customers',
        'sales',
        'expenses',
        'inventory',
        'invoices',
        'conversations',
        'messages',
        'reports',
        'documents',
        'document_chunks'
    ]
    loop
        if to_regclass(format('public.%I', table_name)) is null then
            continue;
        end if;

        execute format('alter table public.%I enable row level security', table_name);
        execute format('revoke all on table public.%I from anon, authenticated', table_name);

        execute format('drop policy if exists tenant_select on public.%I', table_name);
        execute format(
            'create policy tenant_select on public.%I for select to authenticated using (company_id = (select private.current_company_id()))',
            table_name
        );

        execute format('drop policy if exists tenant_insert on public.%I', table_name);
        execute format(
            'create policy tenant_insert on public.%I for insert to authenticated with check (company_id = (select private.current_company_id()))',
            table_name
        );

        execute format('drop policy if exists tenant_update on public.%I', table_name);
        execute format(
            'create policy tenant_update on public.%I for update to authenticated using (company_id = (select private.current_company_id())) with check (company_id = (select private.current_company_id()))',
            table_name
        );

        execute format('drop policy if exists tenant_delete on public.%I', table_name);
        execute format(
            'create policy tenant_delete on public.%I for delete to authenticated using (company_id = (select private.current_company_id()))',
            table_name
        );

        if table_name = 'document_chunks' then
            execute format('grant select on table public.%I to authenticated', table_name);
        else
            execute format(
                'grant select, insert, update, delete on table public.%I to authenticated',
                table_name
            );
        end if;

        execute format('grant all on table public.%I to service_role', table_name);
    end loop;
end
$$;

revoke all on table public.companies from anon, authenticated;
revoke all on table public.company_members from anon, authenticated;
grant select, update on table public.companies to authenticated;
grant select, insert, update, delete on table public.company_members to authenticated;
grant all on table public.companies to service_role;
grant all on table public.company_members to service_role;

grant usage on schema private to authenticated, service_role;
revoke all on all functions in schema private from public, anon;
grant execute on function private.current_company_id() to authenticated, service_role;
grant execute on function private.is_company_member(uuid) to authenticated, service_role;
grant execute on function private.has_company_role(uuid, text[]) to authenticated, service_role;

-- Secure authenticated RAG search. The company filter is resolved inside the
-- database instead of being accepted as an RPC parameter from the client.
create or replace function public.match_document_chunks(
    query_embedding vector(384),
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
set search_path = ''
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
     and documents.company_id = chunks.company_id
    where chunks.company_id = private.current_company_id()
      and documents.status = 'ready'
    order by chunks.embedding <=> query_embedding
    limit greatest(1, least(match_count, 20));
$$;

revoke all on function public.match_document_chunks(vector, integer)
    from public, anon;
grant execute on function public.match_document_chunks(vector, integer)
    to authenticated, service_role;

-- Keep the earlier three-argument development RPC server-only. It is useful
-- for trusted maintenance but is never exposed to authenticated clients.
revoke all on function public.match_document_chunks(vector, uuid, integer)
    from public, anon, authenticated;
grant execute on function public.match_document_chunks(vector, uuid, integer)
    to service_role;

-- Private Storage buckets: the first path segment must equal the company
-- resolved from the signed user session. service_role continues to bypass RLS
-- for trusted PDF generation and document processing jobs.
drop policy if exists tenant_documents_select on storage.objects;
create policy tenant_documents_select
on storage.objects
for select
to authenticated
using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

drop policy if exists tenant_documents_insert on storage.objects;
create policy tenant_documents_insert
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

drop policy if exists tenant_documents_update on storage.objects;
create policy tenant_documents_update
on storage.objects
for update
to authenticated
using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
)
with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

drop policy if exists tenant_documents_delete on storage.objects;
create policy tenant_documents_delete
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

drop policy if exists tenant_reports_select on storage.objects;
create policy tenant_reports_select
on storage.objects
for select
to authenticated
using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

drop policy if exists tenant_reports_insert on storage.objects;
create policy tenant_reports_insert
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

drop policy if exists tenant_reports_update on storage.objects;
create policy tenant_reports_update
on storage.objects
for update
to authenticated
using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
)
with check (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

drop policy if exists tenant_reports_delete on storage.objects;
create policy tenant_reports_delete
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
);

comment on table public.companies is
    'Tenant companies. Existing development records belong to the fixed legacy company.';
comment on table public.company_members is
    'Secure mapping from Supabase Auth users to tenant companies and roles.';
