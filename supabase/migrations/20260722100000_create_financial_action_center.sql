begin;

select pg_advisory_xact_lock(hashtext('zemam-financial-action-center-v1'));

insert into private.migration_audit (
    migration_name,
    before_counts,
    after_counts,
    checks_passed,
    applied_at
)
values (
    '20260722100000_create_financial_action_center',
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
        'legacy_rag_chunks', private.relation_row_count(
            'public.rag_document_chunks_legacy_20260719'
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

do $$
begin
    if (select count(*) from public.companies) <> 1 then
        raise exception 'Financial Action Center requires exactly one company';
    end if;
end
$$;

insert into private.app_permissions (permission)
values
    ('actions.read'),
    ('actions.write'),
    ('actions.detect'),
    ('actions.assign'),
    ('actions.approve')
on conflict (permission) do nothing;

insert into private.role_permissions (role, permission)
values
    ('owner', 'actions.read'),
    ('owner', 'actions.write'),
    ('owner', 'actions.detect'),
    ('owner', 'actions.assign'),
    ('owner', 'actions.approve'),
    ('admin', 'actions.read'),
    ('admin', 'actions.write'),
    ('admin', 'actions.detect'),
    ('admin', 'actions.assign'),
    ('admin', 'actions.approve'),
    ('accountant', 'actions.read'),
    ('accountant', 'actions.write'),
    ('accountant', 'actions.detect'),
    ('viewer', 'actions.read')
on conflict (role, permission) do nothing;

create table if not exists public.financial_actions (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete restrict,
    action_type text not null check (
        action_type in ('overdue_invoice', 'low_inventory', 'expense_review')
    ),
    dedup_key text not null check (length(btrim(dedup_key)) > 0),
    title_en text not null check (length(btrim(title_en)) > 0),
    title_ar text not null check (length(btrim(title_ar)) > 0),
    description_en text not null check (length(btrim(description_en)) > 0),
    description_ar text not null check (length(btrim(description_ar)) > 0),
    severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
    financial_impact numeric(18, 2),
    currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
    source_type text not null check (source_type in ('invoice', 'inventory', 'expense')),
    source_id uuid not null,
    evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
    recommendation_en text not null check (length(btrim(recommendation_en)) > 0),
    recommendation_ar text not null check (length(btrim(recommendation_ar)) > 0),
    assigned_to uuid,
    due_date date,
    requires_approval boolean not null default true,
    proposed_action jsonb not null default '{}'::jsonb check (
        jsonb_typeof(proposed_action) = 'object'
    ),
    approved_payload_hash bytea,
    status text not null default 'new' check (
        status in (
            'new',
            'in_review',
            'waiting_for_approval',
            'approved',
            'rejected',
            'in_progress',
            'completed',
            'dismissed',
            'expired'
        )
    ),
    created_by uuid not null references auth.users(id) on delete restrict,
    approved_by uuid references auth.users(id) on delete restrict,
    approved_at timestamptz,
    approval_expires_at timestamptz,
    resolved_at timestamptz,
    last_execution_key text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, company_id),
    foreign key (company_id, assigned_to)
        references public.company_members(company_id, user_id)
        on delete restrict
);

create unique index if not exists financial_actions_open_dedup_index
    on public.financial_actions (company_id, dedup_key)
    where status not in ('completed', 'dismissed', 'rejected', 'expired');

create unique index if not exists financial_actions_execution_key_index
    on public.financial_actions (company_id, last_execution_key)
    where last_execution_key is not null;

create index if not exists financial_actions_company_status_index
    on public.financial_actions (company_id, status, created_at desc);

create index if not exists financial_actions_company_type_index
    on public.financial_actions (company_id, action_type, created_at desc);

create index if not exists financial_actions_assigned_index
    on public.financial_actions (company_id, assigned_to, status);

create table if not exists public.financial_action_events (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete restrict,
    action_id uuid not null,
    event_type text not null check (length(btrim(event_type)) > 0),
    from_status text,
    to_status text,
    actor_id uuid references auth.users(id) on delete restrict,
    note text check (note is null or length(note) <= 4000),
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz not null default now(),
    foreign key (action_id, company_id)
        references public.financial_actions(id, company_id)
        on delete restrict
);

create index if not exists financial_action_events_timeline_index
    on public.financial_action_events (company_id, action_id, created_at, id);

create or replace function private.validate_financial_action_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    caller_id uuid := (select auth.uid());
    payload_changed boolean := false;
begin
    if tg_op = 'INSERT' then
        if (select auth.role()) <> 'service_role' then
            if caller_id is null or not private.has_permission('actions.write') then
                raise exception 'actions.write permission is required';
            end if;
            new.created_by := caller_id;
            if new.status <> 'new' then
                raise exception 'New financial actions must start with status new';
            end if;
        end if;

        new.approved_by := null;
        new.approved_at := null;
        new.approval_expires_at := null;
        new.approved_payload_hash := null;
        new.resolved_at := null;
        return new;
    end if;

    if (select auth.role()) <> 'service_role' then
        if caller_id is null or not private.has_permission('actions.write') then
            raise exception 'actions.write permission is required';
        end if;

        if new.assigned_to is distinct from old.assigned_to
           and not private.has_permission('actions.assign') then
            raise exception 'actions.assign permission is required';
        end if;

        if new.status in ('approved', 'rejected')
           and new.status is distinct from old.status
           and not private.has_permission('actions.approve') then
            raise exception 'actions.approve permission is required';
        end if;
    end if;

    if new.company_id <> old.company_id
       or new.action_type <> old.action_type
       or new.dedup_key <> old.dedup_key
       or new.source_type <> old.source_type
       or new.source_id <> old.source_id
       or new.created_by <> old.created_by then
        raise exception 'Immutable financial action identity fields cannot change';
    end if;

    payload_changed := new.proposed_action is distinct from old.proposed_action;
    if payload_changed and old.approved_payload_hash is not null then
        new.status := 'waiting_for_approval';
        new.approved_by := null;
        new.approved_at := null;
        new.approval_expires_at := null;
        new.approved_payload_hash := null;
    end if;

    if new.status is distinct from old.status then
        if not (
            (old.status = 'new' and new.status in ('in_review', 'dismissed'))
            or (old.status = 'in_review' and new.status in (
                'waiting_for_approval', 'in_progress', 'completed', 'dismissed'
            ))
            or (old.status = 'waiting_for_approval' and new.status in (
                'approved', 'rejected', 'in_review', 'expired'
            ))
            or (old.status = 'approved' and new.status in ('in_progress', 'rejected'))
            or (old.status = 'rejected' and new.status in ('in_review', 'dismissed'))
            or (old.status = 'in_progress' and new.status in ('completed', 'in_review'))
            or (old.status in ('completed', 'dismissed', 'expired') and new.status = 'in_review')
        ) then
            raise exception 'Invalid financial action status transition: % -> %',
                old.status,
                new.status;
        end if;
    end if;

    if new.status = 'approved' and new.status is distinct from old.status then
        if not new.requires_approval then
            raise exception 'Actions without approval requirement cannot enter approved status';
        end if;
        new.approved_by := caller_id;
        new.approved_at := now();
        new.approval_expires_at := now() + interval '24 hours';
        new.approved_payload_hash := digest(
            convert_to(new.proposed_action::text, 'UTF8'),
            'sha256'
        );
    elsif new.status = 'waiting_for_approval' then
        new.approved_by := null;
        new.approved_at := null;
        new.approval_expires_at := null;
        new.approved_payload_hash := null;
    end if;

    if new.status in ('completed', 'dismissed', 'rejected', 'expired') then
        new.resolved_at := coalesce(new.resolved_at, now());
    elsif new.status is distinct from old.status then
        new.resolved_at := null;
    end if;

    return new;
end;
$$;

create or replace function private.audit_financial_action_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.financial_action_events (
        company_id,
        action_id,
        event_type,
        from_status,
        to_status,
        actor_id,
        metadata
    )
    values (
        new.company_id,
        new.id,
        case when tg_op = 'INSERT' then 'created' else 'updated' end,
        case when tg_op = 'UPDATE' then old.status else null end,
        new.status,
        (select auth.uid()),
        jsonb_build_object(
            'assigned_to', new.assigned_to,
            'due_date', new.due_date,
            'requires_approval', new.requires_approval,
            'proposed_action', new.proposed_action,
            'approved_payload_hash',
                case
                    when new.approved_payload_hash is null then null
                    else encode(new.approved_payload_hash, 'hex')
                end
        )
    );
    return new;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_trigger
        where tgname = 'financial_actions_assign_company'
          and tgrelid = 'public.financial_actions'::regclass
          and not tgisinternal
    ) then
        create trigger financial_actions_assign_company
        before insert or update on public.financial_actions
        for each row execute function private.assign_current_company_id();
    end if;

    if not exists (
        select 1 from pg_trigger
        where tgname = 'financial_actions_validate_change'
          and tgrelid = 'public.financial_actions'::regclass
          and not tgisinternal
    ) then
        create trigger financial_actions_validate_change
        before insert or update on public.financial_actions
        for each row execute function private.validate_financial_action_change();
    end if;

    if not exists (
        select 1 from pg_trigger
        where tgname = 'financial_actions_set_updated_at'
          and tgrelid = 'public.financial_actions'::regclass
          and not tgisinternal
    ) then
        create trigger financial_actions_set_updated_at
        before update on public.financial_actions
        for each row execute function private.set_updated_at();
    end if;

    if not exists (
        select 1 from pg_trigger
        where tgname = 'financial_actions_audit_change'
          and tgrelid = 'public.financial_actions'::regclass
          and not tgisinternal
    ) then
        create trigger financial_actions_audit_change
        after insert or update on public.financial_actions
        for each row execute function private.audit_financial_action_change();
    end if;
end
$$;

alter table public.financial_actions enable row level security;
alter table public.financial_action_events enable row level security;

revoke all on table public.financial_actions from anon, authenticated;
revoke all on table public.financial_action_events from anon, authenticated;
grant select, insert, update on table public.financial_actions to authenticated;
grant select on table public.financial_action_events to authenticated;
grant all on table public.financial_actions to service_role;
grant all on table public.financial_action_events to service_role;

create policy financial_actions_select
on public.financial_actions
for select to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('actions.read'))
);

create policy financial_actions_insert
on public.financial_actions
for insert to authenticated
with check (
    company_id = (select private.current_company_id())
    and created_by = (select auth.uid())
    and (select private.has_permission('actions.write'))
);

create policy financial_actions_update
on public.financial_actions
for update to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('actions.write'))
)
with check (
    company_id = (select private.current_company_id())
    and (select private.has_permission('actions.write'))
);

create policy financial_action_events_select
on public.financial_action_events
for select to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('actions.read'))
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
        'legacy_rag_chunks', private.relation_row_count(
            'public.rag_document_chunks_legacy_20260719'
        )
    ),
    checks_passed = (
        before_counts = jsonb_build_object(
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
            )
        )
    ),
    applied_at = now()
where migration_name = '20260722100000_create_financial_action_center';

do $$
begin
    if not (
        select checks_passed
        from private.migration_audit
        where migration_name = '20260722100000_create_financial_action_center'
    ) then
        raise exception 'Protected row counts changed during Financial Action Center migration';
    end if;
end
$$;

commit;
