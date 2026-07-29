begin;

select pg_advisory_xact_lock(hashtext('zemam-security-audit-events-v1'));

insert into private.migration_audit (
    migration_name,
    before_counts,
    after_counts,
    checks_passed,
    applied_at
)
values (
    '20260722140000_add_security_audit_events',
    jsonb_build_object(
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
        'legacy_rag_chunks', private.relation_row_count('public.rag_document_chunks_legacy_20260719'),
        'financial_actions', private.relation_row_count('public.financial_actions'),
        'financial_action_events', private.relation_row_count('public.financial_action_events')
    ),
    null,
    false,
    null
)
on conflict (migration_name) do update
set before_counts = excluded.before_counts,
    after_counts = null,
    checks_passed = false,
    applied_at = null;

insert into private.app_permissions (permission)
values ('audit.read')
on conflict (permission) do nothing;

insert into private.role_permissions (role, permission)
values
    ('owner', 'audit.read'),
    ('admin', 'audit.read')
on conflict (role, permission) do nothing;

create table if not exists public.security_audit_events (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete restrict,
    actor_id uuid references auth.users(id) on delete set null,
    entity_type text not null check (length(entity_type) between 1 and 120),
    entity_id text,
    operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
    changed_fields text[] not null default '{}',
    created_at timestamptz not null default now()
);

create index if not exists security_audit_events_company_time_index
    on public.security_audit_events (company_id, created_at desc);

create index if not exists security_audit_events_entity_index
    on public.security_audit_events (company_id, entity_type, entity_id, created_at desc);

create or replace function private.capture_security_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
    old_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
    row_company_id uuid;
    row_id text;
    fields text[];
begin
    row_company_id := coalesce(
        nullif(new_row ->> 'company_id', '')::uuid,
        nullif(old_row ->> 'company_id', '')::uuid,
        case
            when tg_table_name = 'companies' then
                coalesce(
                    nullif(new_row ->> 'id', '')::uuid,
                    nullif(old_row ->> 'id', '')::uuid
                )
            else null
        end
    );
    row_id := coalesce(new_row ->> 'id', old_row ->> 'id');

    if row_company_id is null then
        raise exception 'Audited records must have a company identifier';
    end if;

    if tg_op = 'UPDATE' then
        select coalesce(array_agg(keys.key order by keys.key), '{}')
        into fields
        from (
            select coalesce(new_value.key, old_value.key) as key
            from jsonb_each(new_row) as new_value
            full join jsonb_each(old_row) as old_value using (key)
            where new_value.value is distinct from old_value.value
        ) as keys
        where keys.key not in ('token_hash', 'storage_path', 'metadata', 'evidence', 'proposed_action');
    else
        select coalesce(array_agg(key order by key), '{}')
        into fields
        from jsonb_object_keys(coalesce(new_row, old_row)) as key
        where key not in ('token_hash', 'storage_path', 'metadata', 'evidence', 'proposed_action');
    end if;

    insert into public.security_audit_events (
        company_id,
        actor_id,
        entity_type,
        entity_id,
        operation,
        changed_fields
    )
    values (
        row_company_id,
        (select auth.uid()),
        tg_table_name,
        row_id,
        tg_op,
        fields
    );
    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

do $$
declare
    table_name text;
    trigger_name text;
begin
    foreach table_name in array array[
        'companies',
        'company_members',
        'company_invitations',
        'reports',
        'financial_attachments',
        'documents',
        'financial_actions'
    ]
    loop
        trigger_name := 'security_audit_' || table_name;
        if to_regclass('public.' || table_name) is not null
           and not exists (
               select 1
               from pg_trigger
               where tgname = trigger_name
                 and tgrelid = to_regclass('public.' || table_name)
                 and not tgisinternal
           ) then
            execute format(
                'create trigger %I after insert or update or delete on public.%I '
                'for each row execute function private.capture_security_audit_event()',
                trigger_name,
                table_name
            );
        end if;
    end loop;
end
$$;

alter table public.security_audit_events enable row level security;
revoke all on table public.security_audit_events from anon, authenticated;
grant select on table public.security_audit_events to authenticated;
grant all on table public.security_audit_events to service_role;

create policy security_audit_events_select
on public.security_audit_events
for select to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('audit.read'))
);

update private.migration_audit
set after_counts = jsonb_build_object(
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
        'legacy_rag_chunks', private.relation_row_count('public.rag_document_chunks_legacy_20260719'),
        'financial_actions', private.relation_row_count('public.financial_actions'),
        'financial_action_events', private.relation_row_count('public.financial_action_events')
    ),
    checks_passed = before_counts = jsonb_build_object(
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
        'legacy_rag_chunks', private.relation_row_count('public.rag_document_chunks_legacy_20260719'),
        'financial_actions', private.relation_row_count('public.financial_actions'),
        'financial_action_events', private.relation_row_count('public.financial_action_events')
    ),
    applied_at = now()
where migration_name = '20260722140000_add_security_audit_events';

do $$
begin
    if not (
        select checks_passed
        from private.migration_audit
        where migration_name = '20260722140000_add_security_audit_events'
    ) then
        raise exception 'Protected row counts changed during security audit migration';
    end if;
end
$$;

commit;
