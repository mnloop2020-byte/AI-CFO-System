begin;

-- Single Company + Multiple Users authentication and authorization.
-- This migration is intentionally data-preserving:
--   * no DROP TABLE, TRUNCATE, or DELETE statement;
--   * existing rows are only backfilled when company_id is null;
--   * row counts are captured and compared before COMMIT;
--   * any unexpected company or count mismatch aborts the transaction.

select pg_advisory_xact_lock(hashtext('zemam-single-company-auth-v1'));

create extension if not exists pgcrypto;
create extension if not exists vector;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.migration_audit (
    migration_name text primary key,
    before_counts jsonb not null,
    after_counts jsonb,
    checks_passed boolean not null default false,
    applied_at timestamptz
);

create or replace function private.relation_row_count(qualified_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    relation regclass;
    row_count bigint;
begin
    relation := to_regclass(qualified_name);
    if relation is null then
        return 0;
    end if;

    execute format('select count(*) from %s', relation) into row_count;
    return row_count;
end;
$$;

insert into private.migration_audit (
    migration_name,
    before_counts,
    after_counts,
    checks_passed,
    applied_at
)
values (
    '20260720170000_create_single_company_auth',
    jsonb_build_object(
        'auth_users', private.relation_row_count('auth.users'),
        'customers', private.relation_row_count('public.customers'),
        'sales', private.relation_row_count('public.sales'),
        'expenses', private.relation_row_count('public.expenses'),
        'inventory', private.relation_row_count('public.inventory'),
        'invoices', private.relation_row_count('public.invoices'),
        'conversations', private.relation_row_count('public.conversations'),
        'messages', private.relation_row_count('public.messages'),
        'reports', private.relation_row_count('public.reports'),
        'documents', private.relation_row_count('public.documents'),
        'document_chunks', private.relation_row_count('public.document_chunks'),
        'legacy_rag_chunks', private.relation_row_count(
            'public.rag_document_chunks_legacy_20260719'
        ),
        'private_storage_objects', (
            select count(*)
            from storage.objects
            where bucket_id in ('documents', 'reports')
        )
    ),
    null,
    false,
    null
)
on conflict (migration_name) do update
set
    before_counts = excluded.before_counts,
    after_counts = null,
    checks_passed = false,
    applied_at = null;

-- The RAG schema must already exist. Abort instead of attempting a lossy or
-- ambiguous reconstruction of document data.
do $$
declare
    embedding_type text;
begin
    if to_regclass('public.documents') is null
       or to_regclass('public.document_chunks') is null then
        raise exception 'RAG documents/document_chunks tables are required before Auth migration';
    end if;

    select format_type(attribute.atttypid, attribute.atttypmod)
    into embedding_type
    from pg_attribute as attribute
    where attribute.attrelid = 'public.document_chunks'::regclass
      and attribute.attname = 'embedding'
      and not attribute.attisdropped;

    if embedding_type is distinct from 'vector(384)' then
        raise exception 'Expected document_chunks.embedding vector(384), found %', embedding_type;
    end if;

    if to_regclass('public.companies') is not null
       and private.relation_row_count('public.companies') > 1 then
        raise exception 'Single-company migration aborted: more than one company already exists';
    end if;
end
$$;

create table if not exists public.companies (
    id uuid primary key default gen_random_uuid(),
    singleton_key boolean not null default true check (singleton_key),
    name text not null check (length(btrim(name)) > 0),
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.companies
    add column if not exists singleton_key boolean not null default true;

do $$
begin
    if (select count(*) from public.companies) > 1 then
        raise exception 'Single-company migration aborted: more than one company already exists';
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'companies_singleton_key_check'
          and conrelid = 'public.companies'::regclass
    ) then
        alter table public.companies
            add constraint companies_singleton_key_check check (singleton_key);
    end if;
end
$$;

create unique index if not exists companies_singleton_key_unique
    on public.companies (singleton_key);

insert into public.companies (
    id,
    singleton_key,
    name
)
select
    '00000000-0000-0000-0000-000000000001'::uuid,
    true,
    'Development Company'
where not exists (select 1 from public.companies);

create table if not exists private.app_roles (
    role text primary key
);

create table if not exists private.app_permissions (
    permission text primary key
);

create table if not exists private.role_permissions (
    role text not null references private.app_roles(role) on delete restrict,
    permission text not null references private.app_permissions(permission) on delete restrict,
    primary key (role, permission)
);

insert into private.app_roles (role)
values
    ('owner'),
    ('admin'),
    ('accountant'),
    ('viewer')
on conflict (role) do nothing;

insert into private.app_permissions (permission)
values
    ('company.read'),
    ('company.update'),
    ('members.read'),
    ('members.invite'),
    ('members.manage'),
    ('financial.read'),
    ('financial.write'),
    ('documents.read'),
    ('documents.write'),
    ('reports.read'),
    ('reports.write'),
    ('chat.use')
on conflict (permission) do nothing;

insert into private.role_permissions (role, permission)
select 'owner', permission from private.app_permissions
on conflict (role, permission) do nothing;

insert into private.role_permissions (role, permission)
select 'admin', permission from private.app_permissions
on conflict (role, permission) do nothing;

insert into private.role_permissions (role, permission)
values
    ('accountant', 'company.read'),
    ('accountant', 'financial.read'),
    ('accountant', 'financial.write'),
    ('accountant', 'documents.read'),
    ('accountant', 'documents.write'),
    ('accountant', 'reports.read'),
    ('accountant', 'reports.write'),
    ('accountant', 'chat.use'),
    ('viewer', 'company.read'),
    ('viewer', 'financial.read'),
    ('viewer', 'documents.read'),
    ('viewer', 'reports.read'),
    ('viewer', 'chat.use')
on conflict (role, permission) do nothing;

create table if not exists public.company_members (
    company_id uuid not null references public.companies(id) on delete restrict,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null references private.app_roles(role) on delete restrict,
    is_default boolean not null default true check (is_default),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (company_id, user_id),
    unique (user_id)
);

-- Compatibility for a partially prepared schema. No member row is removed.
alter table public.company_members
    add column if not exists is_default boolean not null default true;

do $$
declare
    invalid_roles bigint;
begin
    select count(*)
    into invalid_roles
    from public.company_members
    where role not in ('owner', 'admin', 'accountant', 'viewer');

    if invalid_roles > 0 then
        raise exception 'Unsupported company member roles exist; migration will not rewrite them';
    end if;

    if exists (
        select user_id
        from public.company_members
        group by user_id
        having count(*) > 1
    ) then
        raise exception 'A user belongs to multiple companies; migration will not delete memberships';
    end if;

    if exists (
        select 1
        from public.company_members
        where not is_default
    ) then
        raise exception 'Non-default memberships exist; migration will not rewrite them';
    end if;

    alter table public.company_members
        drop constraint if exists company_members_role_check;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'company_members_role_fkey'
          and conrelid = 'public.company_members'::regclass
    ) then
        alter table public.company_members
            add constraint company_members_role_fkey
            foreign key (role)
            references private.app_roles(role)
            on delete restrict;
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'company_members_is_default_check'
          and conrelid = 'public.company_members'::regclass
    ) then
        alter table public.company_members
            add constraint company_members_is_default_check check (is_default);
    end if;
end
$$;

create unique index if not exists company_members_one_company_per_user
    on public.company_members (user_id);

create index if not exists company_members_company_role_index
    on public.company_members (company_id, role);

create table if not exists private.bootstrap_control (
    singleton_key boolean primary key default true check (singleton_key),
    owner_email text not null check (length(btrim(owner_email)) > 3),
    token_hash bytea not null,
    consumed_at timestamptz,
    consumed_by uuid references auth.users(id) on delete set null,
    configured_at timestamptz not null default now()
);

create table if not exists public.company_invitations (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete restrict,
    email text not null check (length(btrim(email)) > 3),
    role text not null references private.app_roles(role) on delete restrict,
    status text not null default 'pending' check (
        status in ('pending', 'accepted', 'revoked', 'expired')
    ),
    invited_by uuid not null references auth.users(id) on delete restrict,
    auth_user_id uuid references auth.users(id) on delete set null,
    expires_at timestamptz not null default (now() + interval '7 days'),
    accepted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists company_invitations_one_pending_email
    on public.company_invitations (lower(email))
    where status = 'pending';

create index if not exists company_invitations_company_created_index
    on public.company_invitations (company_id, created_at desc);

create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),
    company_id uuid,
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
        generator in ('report_writer', 'ceo', 'sales', 'cashflow', 'tax', 'fraud')
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
values
    (
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
    ),
    (
        'reports',
        'reports',
        false,
        10485760,
        array['application/pdf']
    )
on conflict (id) do update
set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Resolve the one company once. Existing non-null company_id values must
-- already equal it; otherwise abort rather than merge tenant data.
do $$
declare
    table_name text;
    sole_company_id uuid;
    mismatched_rows bigint;
    company_constraint_name text;
    unique_constraint_name text;
begin
    select id into strict sole_company_id from public.companies;

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
            raise exception 'Required table public.% is missing', table_name;
        end if;

        execute format(
            'alter table public.%I add column if not exists company_id uuid',
            table_name
        );

        execute format(
            'select count(*) from public.%I where company_id is not null and company_id <> $1',
            table_name
        ) into mismatched_rows using sole_company_id;

        if mismatched_rows > 0 then
            raise exception 'Table public.% contains % rows assigned to another company',
                table_name,
                mismatched_rows;
        end if;

        execute format(
            'update public.%I set company_id = $1 where company_id is null',
            table_name
        ) using sole_company_id;

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

-- Composite foreign keys prevent cross-company parent/child references and
-- preserve every existing single-column foreign key.
do $$
begin
    if not exists (
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
        alter table public.sales validate constraint sales_customer_company_fkey;
    end if;

    if not exists (
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
        alter table public.invoices validate constraint invoices_customer_company_fkey;
    end if;

    if not exists (
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
        alter table public.messages validate constraint messages_conversation_company_fkey;
    end if;

    if not exists (
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
    limit 1;
$$;

create or replace function private.current_company_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select member.role
    from public.company_members as member
    where member.user_id = (select auth.uid())
    limit 1;
$$;

create or replace function private.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.company_members as member
        join private.role_permissions as role_permission
          on role_permission.role = member.role
        where member.user_id = (select auth.uid())
          and role_permission.permission = required_permission
    );
$$;

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

    -- Supabase Auth database hooks run without an end-user JWT. They may
    -- update an existing invitation, but they may never move it to another
    -- company or invent a company for a new row.
    if (select auth.uid()) is null then
        if tg_op = 'UPDATE'
           and new.company_id = old.company_id then
            return new;
        end if;

        raise exception 'A trusted internal operation may only preserve an existing company_id';
    end if;

    resolved_company_id := private.current_company_id();
    if resolved_company_id is null then
        raise exception 'Authenticated user has no company membership';
    end if;

    new.company_id := resolved_company_id;
    return new;
end;
$$;

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

create or replace function private.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor_role text;
    owner_count bigint;
begin
    actor_role := private.current_company_role();

    if (select auth.role()) = 'authenticated' then
        if actor_role = 'admin' and old.role = 'owner' then
            raise exception 'Admin cannot modify or remove an owner';
        end if;

        if actor_role <> 'owner'
           and tg_op = 'UPDATE'
           and new.role = 'owner' then
            raise exception 'Only an owner can assign the owner role';
        end if;
    end if;

    if old.role = 'owner'
       and tg_op = 'DELETE' then
        select count(*)
        into owner_count
        from public.company_members
        where role = 'owner';

        if owner_count <= 1 then
            raise exception 'The last owner cannot be removed or demoted';
        end if;
    end if;

    if old.role = 'owner'
       and tg_op = 'UPDATE'
       and new.role <> 'owner' then
        select count(*)
        into owner_count
        from public.company_members
        where role = 'owner';

        if owner_count <= 1 then
            raise exception 'The last owner cannot be removed or demoted';
        end if;
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;
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

drop trigger if exists company_invitations_set_updated_at on public.company_invitations;
create trigger company_invitations_set_updated_at
before update on public.company_invitations
for each row execute function private.set_updated_at();

drop trigger if exists company_members_protect_last_owner on public.company_members;
create trigger company_members_protect_last_owner
before update or delete on public.company_members
for each row execute function private.protect_last_owner();

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
        'document_chunks',
        'company_invitations'
    ]
    loop
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

-- Bootstrap configuration is service-role only. The raw token is never
-- stored. Reconfiguration is allowed only before an owner exists.
create or replace function public.configure_owner_bootstrap(
    configured_email text,
    bootstrap_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if (select auth.role()) <> 'service_role' then
        raise exception 'Service role required';
    end if;

    perform pg_advisory_xact_lock(hashtext('zemam-owner-bootstrap'));

    if exists (
        select 1 from public.company_members where role = 'owner'
    ) then
        raise exception 'Owner bootstrap is already closed';
    end if;

    if length(btrim(coalesce(configured_email, ''))) < 4
       or length(coalesce(bootstrap_token, '')) < 24 then
        raise exception 'A valid owner email and a token of at least 24 characters are required';
    end if;

    insert into private.bootstrap_control (
        singleton_key,
        owner_email,
        token_hash,
        consumed_at,
        consumed_by,
        configured_at
    )
    values (
        true,
        lower(btrim(configured_email)),
        extensions.digest(bootstrap_token, 'sha256'),
        null,
        null,
        now()
    )
    on conflict (singleton_key) do update
    set
        owner_email = excluded.owner_email,
        token_hash = excluded.token_hash,
        consumed_at = null,
        consumed_by = null,
        configured_at = now()
    where private.bootstrap_control.consumed_at is null;
end;
$$;

create or replace function public.claim_owner_bootstrap(bootstrap_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    bootstrap_row private.bootstrap_control%rowtype;
    authenticated_user auth.users%rowtype;
    sole_company_id uuid;
begin
    perform pg_advisory_xact_lock(hashtext('zemam-owner-bootstrap'));

    select *
    into authenticated_user
    from auth.users
    where id = (select auth.uid());

    if authenticated_user.id is null then
        raise exception 'Authentication required';
    end if;

    if authenticated_user.email_confirmed_at is null then
        raise exception 'Email confirmation is required';
    end if;

    select *
    into bootstrap_row
    from private.bootstrap_control
    where singleton_key
    for update;

    if bootstrap_row.singleton_key is null
       or bootstrap_row.consumed_at is not null then
        raise exception 'Owner bootstrap is closed or not configured';
    end if;

    if lower(authenticated_user.email) <> bootstrap_row.owner_email
       or extensions.digest(coalesce(bootstrap_token, ''), 'sha256') <> bootstrap_row.token_hash then
        raise exception 'Invalid owner bootstrap credentials';
    end if;

    if exists (
        select 1 from public.company_members where role = 'owner'
    ) then
        raise exception 'Owner bootstrap is already closed';
    end if;

    select id into strict sole_company_id from public.companies;

    insert into public.company_members (
        company_id,
        user_id,
        role,
        is_default
    )
    values (
        sole_company_id,
        authenticated_user.id,
        'owner',
        true
    );

    update public.companies
    set created_by = coalesce(created_by, authenticated_user.id)
    where id = sole_company_id;

    update private.bootstrap_control
    set
        consumed_at = now(),
        consumed_by = authenticated_user.id
    where singleton_key;
end;
$$;

-- Public sign-up is allowed only for the configured bootstrap email before an
-- owner exists. Afterwards, only auth.users rows created by an approved,
-- unexpired invitation are accepted.
create or replace function private.enforce_single_company_auth_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    owner_exists boolean;
    configured_email text;
begin
    perform pg_advisory_xact_lock(hashtext('zemam-auth-user-admission'));

    select exists (
        select 1 from public.company_members where role = 'owner'
    ) into owner_exists;

    if not owner_exists then
        select owner_email
        into configured_email
        from private.bootstrap_control
        where singleton_key
          and consumed_at is null;

        if configured_email is null
           or lower(coalesce(new.email, '')) <> configured_email
           or new.invited_at is not null then
            raise exception 'Owner bootstrap registration is not authorized';
        end if;

        return new;
    end if;

    if new.invited_at is null
       or not exists (
           select 1
           from public.company_invitations as invitation
           where lower(invitation.email) = lower(coalesce(new.email, ''))
             and invitation.status = 'pending'
             and invitation.expires_at > now()
       ) then
        raise exception 'Public registration is closed; a valid invitation is required';
    end if;

    return new;
end;
$$;

create or replace function private.attach_invited_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    invitation_row public.company_invitations%rowtype;
begin
    if new.invited_at is null then
        return new;
    end if;

    select *
    into invitation_row
    from public.company_invitations as invitation
    where lower(invitation.email) = lower(coalesce(new.email, ''))
      and invitation.status = 'pending'
      and invitation.expires_at > now()
    order by invitation.created_at
    limit 1
    for update;

    if invitation_row.id is null then
        raise exception 'No approved invitation exists for this user';
    end if;

    insert into public.company_members (
        company_id,
        user_id,
        role,
        is_default
    )
    values (
        invitation_row.company_id,
        new.id,
        invitation_row.role,
        true
    );

    update public.company_invitations
    set
        status = 'accepted',
        auth_user_id = new.id,
        accepted_at = now(),
        updated_at = now()
    where id = invitation_row.id;

    return new;
end;
$$;

drop trigger if exists enforce_single_company_auth_signup on auth.users;
create trigger enforce_single_company_auth_signup
before insert on auth.users
for each row execute function private.enforce_single_company_auth_signup();

drop trigger if exists attach_invited_user on auth.users;
create trigger attach_invited_user
after insert on auth.users
for each row execute function private.attach_invited_user();

create or replace function public.user_has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select private.has_permission(required_permission);
$$;

create or replace function public.get_my_auth_context()
returns table (
    user_id uuid,
    company_id uuid,
    company_name text,
    role text,
    permissions text[]
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        member.user_id,
        member.company_id,
        company.name,
        member.role,
        coalesce(array_agg(role_permission.permission order by role_permission.permission), array[]::text[])
    from public.company_members as member
    join public.companies as company on company.id = member.company_id
    left join private.role_permissions as role_permission
      on role_permission.role = member.role
    where member.user_id = (select auth.uid())
    group by member.user_id, member.company_id, company.name, member.role;
$$;

-- RLS: company metadata and membership administration.
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.company_invitations enable row level security;

revoke all on table public.companies from anon, authenticated;
revoke all on table public.company_members from anon, authenticated;
revoke all on table public.company_invitations from anon, authenticated;

grant select, update on table public.companies to authenticated;
-- Membership creation is performed only by the one-time bootstrap function or
-- the verified invitation hook. Authenticated clients cannot insert membership
-- rows directly, even when the caller is an admin.
grant select, update, delete on table public.company_members to authenticated;
grant select, insert, update on table public.company_invitations to authenticated;
grant all on table public.companies to service_role;
grant all on table public.company_members to service_role;
grant all on table public.company_invitations to service_role;

drop policy if exists single_company_select on public.companies;
create policy single_company_select
on public.companies
for select
to authenticated
using (
    id = (select private.current_company_id())
    and (select private.has_permission('company.read'))
);

drop policy if exists single_company_update on public.companies;
create policy single_company_update
on public.companies
for update
to authenticated
using (
    id = (select private.current_company_id())
    and (select private.has_permission('company.update'))
)
with check (
    id = (select private.current_company_id())
    and singleton_key
    and (select private.has_permission('company.update'))
);

drop policy if exists company_members_select on public.company_members;
create policy company_members_select
on public.company_members
for select
to authenticated
using (
    company_id = (select private.current_company_id())
    and (
        user_id = (select auth.uid())
        or (select private.has_permission('members.read'))
    )
);

drop policy if exists company_members_insert on public.company_members;

drop policy if exists company_members_update on public.company_members;
create policy company_members_update
on public.company_members
for update
to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('members.manage'))
)
with check (
    company_id = (select private.current_company_id())
    and is_default
    and (select private.has_permission('members.manage'))
);

drop policy if exists company_members_delete on public.company_members;
create policy company_members_delete
on public.company_members
for delete
to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('members.manage'))
);

drop policy if exists company_invitations_select on public.company_invitations;
create policy company_invitations_select
on public.company_invitations
for select
to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('members.read'))
);

drop policy if exists company_invitations_insert on public.company_invitations;
create policy company_invitations_insert
on public.company_invitations
for insert
to authenticated
with check (
    company_id = (select private.current_company_id())
    and invited_by = (select auth.uid())
    and role <> 'owner'
    and (select private.has_permission('members.invite'))
);

drop policy if exists company_invitations_update on public.company_invitations;
create policy company_invitations_update
on public.company_invitations
for update
to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('members.invite'))
)
with check (
    company_id = (select private.current_company_id())
    and role <> 'owner'
    and (select private.has_permission('members.invite'))
);

-- RLS: financial tables. Viewer receives SELECT only through permissions;
-- owner/admin/accountant receive writes through financial.write.
do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'customers', 'sales', 'expenses', 'inventory', 'invoices'
    ]
    loop
        execute format('alter table public.%I enable row level security', table_name);
        execute format('revoke all on table public.%I from anon, authenticated', table_name);
        execute format(
            'grant select, insert, update, delete on table public.%I to authenticated',
            table_name
        );
        execute format('grant all on table public.%I to service_role', table_name);

        execute format('drop policy if exists single_company_select on public.%I', table_name);
        execute format(
            'create policy single_company_select on public.%I for select to authenticated using (company_id = (select private.current_company_id()) and (select private.has_permission(''financial.read'')))',
            table_name
        );
        execute format('drop policy if exists single_company_insert on public.%I', table_name);
        execute format(
            'create policy single_company_insert on public.%I for insert to authenticated with check (company_id = (select private.current_company_id()) and (select private.has_permission(''financial.write'')))',
            table_name
        );
        execute format('drop policy if exists single_company_update on public.%I', table_name);
        execute format(
            'create policy single_company_update on public.%I for update to authenticated using (company_id = (select private.current_company_id()) and (select private.has_permission(''financial.write''))) with check (company_id = (select private.current_company_id()) and (select private.has_permission(''financial.write'')))',
            table_name
        );
        execute format('drop policy if exists single_company_delete on public.%I', table_name);
        execute format(
            'create policy single_company_delete on public.%I for delete to authenticated using (company_id = (select private.current_company_id()) and (select private.has_permission(''financial.write'')))',
            table_name
        );
    end loop;
end
$$;

-- RLS: chat history. All four roles may use chat, but only inside the sole
-- company. Composite FK prevents messages from crossing conversations.
do $$
declare
    table_name text;
begin
    foreach table_name in array array['conversations', 'messages']
    loop
        execute format('alter table public.%I enable row level security', table_name);
        execute format('revoke all on table public.%I from anon, authenticated', table_name);
        execute format(
            'grant select, insert, update, delete on table public.%I to authenticated',
            table_name
        );
        execute format('grant all on table public.%I to service_role', table_name);

        execute format('drop policy if exists single_company_chat_all on public.%I', table_name);
        execute format(
            'create policy single_company_chat_all on public.%I for all to authenticated using (company_id = (select private.current_company_id()) and (select private.has_permission(''chat.use''))) with check (company_id = (select private.current_company_id()) and (select private.has_permission(''chat.use'')))',
            table_name
        );
    end loop;
end
$$;

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.reports enable row level security;

revoke all on table public.documents from anon, authenticated;
revoke all on table public.document_chunks from anon, authenticated;
revoke all on table public.reports from anon, authenticated;
grant select, insert, update, delete on table public.documents to authenticated;
grant select on table public.document_chunks to authenticated;
grant select, insert, update, delete on table public.reports to authenticated;
grant all on table public.documents to service_role;
grant all on table public.document_chunks to service_role;
grant all on table public.reports to service_role;

drop policy if exists single_company_documents_select on public.documents;
create policy single_company_documents_select
on public.documents
for select to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('documents.read'))
);

drop policy if exists single_company_documents_write on public.documents;
create policy single_company_documents_write
on public.documents
for all to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('documents.write'))
)
with check (
    company_id = (select private.current_company_id())
    and (select private.has_permission('documents.write'))
);

drop policy if exists single_company_chunks_select on public.document_chunks;
create policy single_company_chunks_select
on public.document_chunks
for select to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('documents.read'))
);

drop policy if exists single_company_reports_select on public.reports;
create policy single_company_reports_select
on public.reports
for select to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('reports.read'))
);

drop policy if exists single_company_reports_write on public.reports;
create policy single_company_reports_write
on public.reports
for all to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('reports.write'))
)
with check (
    company_id = (select private.current_company_id())
    and (select private.has_permission('reports.write'))
);

-- Authenticated vector search resolves the company from auth.uid(). The old
-- three-argument maintenance RPC remains service-role only.
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
        chunk.id,
        chunk.document_id,
        document.file_name,
        chunk.chunk_index,
        chunk.content,
        chunk.metadata,
        1 - (chunk.embedding OPERATOR(public.<=>) query_embedding)
    from public.document_chunks as chunk
    join public.documents as document
      on document.id = chunk.document_id
     and document.company_id = chunk.company_id
    where chunk.company_id = private.current_company_id()
      and document.status = 'ready'
      and private.has_permission('documents.read')
    order by chunk.embedding OPERATOR(public.<=>) query_embedding
    limit greatest(1, least(match_count, 20));
$$;

revoke all on function public.match_document_chunks(vector, integer)
    from public, anon;
grant execute on function public.match_document_chunks(vector, integer)
    to authenticated, service_role;

revoke all on function public.match_document_chunks(vector, uuid, integer)
    from public, anon, authenticated;
grant execute on function public.match_document_chunks(vector, uuid, integer)
    to service_role;

-- Private Storage policies use both the authenticated company folder and the
-- same centralized permission matrix as database RLS.
drop policy if exists single_company_documents_select on storage.objects;
create policy single_company_documents_select
on storage.objects
for select to authenticated
using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('documents.read'))
);

drop policy if exists single_company_documents_insert on storage.objects;
create policy single_company_documents_insert
on storage.objects
for insert to authenticated
with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('documents.write'))
);

drop policy if exists single_company_documents_update on storage.objects;
create policy single_company_documents_update
on storage.objects
for update to authenticated
using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('documents.write'))
)
with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('documents.write'))
);

drop policy if exists single_company_documents_delete on storage.objects;
create policy single_company_documents_delete
on storage.objects
for delete to authenticated
using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('documents.write'))
);

drop policy if exists single_company_reports_select on storage.objects;
create policy single_company_reports_select
on storage.objects
for select to authenticated
using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('reports.read'))
);

drop policy if exists single_company_reports_insert on storage.objects;
create policy single_company_reports_insert
on storage.objects
for insert to authenticated
with check (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('reports.write'))
);

drop policy if exists single_company_reports_update on storage.objects;
create policy single_company_reports_update
on storage.objects
for update to authenticated
using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('reports.write'))
)
with check (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('reports.write'))
);

drop policy if exists single_company_reports_delete on storage.objects;
create policy single_company_reports_delete
on storage.objects
for delete to authenticated
using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('reports.write'))
);

grant usage on schema private to authenticated, service_role;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant execute on function private.current_company_id() to authenticated, service_role;
grant execute on function private.current_company_role() to authenticated, service_role;
grant execute on function private.has_permission(text) to authenticated, service_role;

revoke all on function public.configure_owner_bootstrap(text, text)
    from public, anon, authenticated;
grant execute on function public.configure_owner_bootstrap(text, text)
    to service_role;

revoke all on function public.claim_owner_bootstrap(text)
    from public, anon;
grant execute on function public.claim_owner_bootstrap(text)
    to authenticated;

revoke all on function public.user_has_permission(text)
    from public, anon;
grant execute on function public.user_has_permission(text)
    to authenticated, service_role;

revoke all on function public.get_my_auth_context()
    from public, anon;
grant execute on function public.get_my_auth_context()
    to authenticated, service_role;

-- Final count and integrity verification. Any mismatch raises an exception and
-- rolls back every statement in this transaction.
update private.migration_audit
set after_counts = jsonb_build_object(
    'auth_users', private.relation_row_count('auth.users'),
    'customers', private.relation_row_count('public.customers'),
    'sales', private.relation_row_count('public.sales'),
    'expenses', private.relation_row_count('public.expenses'),
    'inventory', private.relation_row_count('public.inventory'),
    'invoices', private.relation_row_count('public.invoices'),
    'conversations', private.relation_row_count('public.conversations'),
    'messages', private.relation_row_count('public.messages'),
    'reports', private.relation_row_count('public.reports'),
    'documents', private.relation_row_count('public.documents'),
    'document_chunks', private.relation_row_count('public.document_chunks'),
    'legacy_rag_chunks', private.relation_row_count(
        'public.rag_document_chunks_legacy_20260719'
    ),
    'private_storage_objects', (
        select count(*)
        from storage.objects
        where bucket_id in ('documents', 'reports')
    )
)
where migration_name = '20260720170000_create_single_company_auth';

do $$
declare
    audit_row private.migration_audit%rowtype;
    table_name text;
    null_company_rows bigint;
begin
    select *
    into strict audit_row
    from private.migration_audit
    where migration_name = '20260720170000_create_single_company_auth'
    for update;

    foreach table_name in array array[
        'auth_users',
        'customers',
        'sales',
        'expenses',
        'inventory',
        'invoices',
        'conversations',
        'messages',
        'reports',
        'documents',
        'document_chunks',
        'legacy_rag_chunks',
        'private_storage_objects'
    ]
    loop
        if audit_row.before_counts ->> table_name
           is distinct from audit_row.after_counts ->> table_name then
            raise exception 'Row-count verification failed for %: before %, after %',
                table_name,
                audit_row.before_counts ->> table_name,
                audit_row.after_counts ->> table_name;
        end if;
    end loop;

    if (select count(*) from public.companies) <> 1 then
        raise exception 'Exactly one company must exist after migration';
    end if;

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
        execute format(
            'select count(*) from public.%I where company_id is null',
            table_name
        ) into null_company_rows;

        if null_company_rows <> 0 then
            raise exception 'Null company_id values remain in public.%', table_name;
        end if;
    end loop;

    update private.migration_audit
    set
        checks_passed = true,
        applied_at = now()
    where migration_name = '20260720170000_create_single_company_auth';
end
$$;

comment on table public.companies is
    'Single deployed company. singleton_key prevents a second company while preserving tenant-ready company_id columns.';
comment on table public.company_members is
    'One current company membership per authenticated user with centrally defined roles.';
comment on table public.company_invitations is
    'Owner/admin-approved invitations for the single company. Invitation email sending remains a human-triggered backend action.';

commit;
