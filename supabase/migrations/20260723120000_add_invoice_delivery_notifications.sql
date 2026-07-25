begin;

select pg_advisory_xact_lock(hashtext('zemam-invoice-delivery-notifications-v1'));

do $$
begin
    if (select count(*) from public.companies) <> 1 then
        raise exception 'Invoice delivery migration requires exactly one company';
    end if;
end
$$;

insert into private.migration_audit (
    migration_name,
    before_counts,
    after_counts,
    checks_passed,
    applied_at
)
values (
    '20260723120000_add_invoice_delivery_notifications',
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
        'financial_attachments', private.relation_row_count(
            'public.financial_attachments'
        ),
        'financial_actions', private.relation_row_count(
            'public.financial_actions'
        ),
        'financial_action_events', private.relation_row_count(
            'public.financial_action_events'
        ),
        'security_audit_events', private.relation_row_count(
            'public.security_audit_events'
        )
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

create table if not exists public.invoice_delivery_events (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete restrict,
    invoice_id uuid not null,
    actor_id uuid not null default auth.uid()
        references auth.users(id) on delete restrict,
    event_type text not null check (
        event_type in (
            'pdf_generated',
            'pdf_downloaded',
            'email_requested',
            'email_sent',
            'email_failed',
            'overdue_notification_created',
            'paid_notification_created'
        )
    ),
    idempotency_key text not null check (
        length(idempotency_key) between 16 and 200
    ),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint invoice_delivery_events_invoice_company_fk
        foreign key (invoice_id, company_id)
        references public.invoices(id, company_id)
        on delete cascade,
    constraint invoice_delivery_events_company_key_unique
        unique (company_id, idempotency_key)
);

create index if not exists invoice_delivery_events_invoice_time_index
    on public.invoice_delivery_events (company_id, invoice_id, created_at desc);

create trigger assign_current_company_id
before insert or update on public.invoice_delivery_events
for each row execute function private.assign_current_company_id();

alter table public.invoice_delivery_events enable row level security;
revoke all on table public.invoice_delivery_events from anon, authenticated;
grant select, insert on table public.invoice_delivery_events to authenticated;
grant all on table public.invoice_delivery_events to service_role;

create policy invoice_delivery_events_select
on public.invoice_delivery_events
for select to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('financial.read'))
);

create policy invoice_delivery_events_insert
on public.invoice_delivery_events
for insert to authenticated
with check (
    company_id = (select private.current_company_id())
    and actor_id = (select auth.uid())
    and (
        (
            event_type = 'pdf_downloaded'
            and (select private.has_permission('financial.read'))
        )
        or (
            event_type <> 'pdf_downloaded'
            and (select private.has_permission('financial.write'))
        )
    )
);

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete restrict,
    invoice_id uuid not null,
    event_type text not null check (
        event_type in (
            'invoice_generated',
            'invoice_emailed',
            'invoice_email_failed',
            'invoice_overdue',
            'invoice_paid'
        )
    ),
    dedupe_key text not null check (
        length(dedupe_key) between 16 and 200
    ),
    data jsonb not null default '{}'::jsonb,
    created_by uuid not null default auth.uid()
        references auth.users(id) on delete restrict,
    created_at timestamptz not null default now(),
    constraint notifications_invoice_company_fk
        foreign key (invoice_id, company_id)
        references public.invoices(id, company_id)
        on delete cascade,
    constraint notifications_company_key_unique
        unique (company_id, dedupe_key)
);

create index if not exists notifications_company_time_index
    on public.notifications (company_id, created_at desc);

create trigger assign_current_company_id
before insert or update on public.notifications
for each row execute function private.assign_current_company_id();

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
grant select, insert on table public.notifications to authenticated;
grant all on table public.notifications to service_role;

create policy notifications_select
on public.notifications
for select to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('financial.read'))
);

create policy notifications_insert
on public.notifications
for insert to authenticated
with check (
    company_id = (select private.current_company_id())
    and created_by = (select auth.uid())
    and (select private.has_permission('financial.write'))
);

do $$
declare
    table_name text;
    trigger_name text;
begin
    foreach table_name in array array[
        'invoice_delivery_events',
        'notifications'
    ]
    loop
        trigger_name := 'security_audit_' || table_name;
        if not exists (
            select 1
            from pg_trigger
            where tgname = trigger_name
              and tgrelid = to_regclass('public.' || table_name)
              and not tgisinternal
        ) then
            execute format(
                'create trigger %I after insert on public.%I '
                'for each row execute function private.capture_security_audit_event()',
                trigger_name,
                table_name
            );
        end if;
    end loop;
end
$$;

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
        'financial_attachments', private.relation_row_count(
            'public.financial_attachments'
        ),
        'financial_actions', private.relation_row_count(
            'public.financial_actions'
        ),
        'financial_action_events', private.relation_row_count(
            'public.financial_action_events'
        ),
        'security_audit_events', private.relation_row_count(
            'public.security_audit_events'
        )
    ),
    applied_at = now()
where migration_name = '20260723120000_add_invoice_delivery_notifications';

do $$
declare
    audit_row private.migration_audit%rowtype;
begin
    select *
    into strict audit_row
    from private.migration_audit
    where migration_name = '20260723120000_add_invoice_delivery_notifications'
    for update;

    if audit_row.before_counts <> audit_row.after_counts then
        raise exception 'Protected row counts changed during invoice delivery migration';
    end if;

    if exists (select 1 from public.invoice_delivery_events)
       or exists (select 1 from public.notifications) then
        raise exception 'New invoice delivery tables must be empty at creation';
    end if;

    update private.migration_audit
    set checks_passed = true
    where migration_name = '20260723120000_add_invoice_delivery_notifications';
end
$$;

comment on table public.invoice_delivery_events is
    'Immutable company-scoped audit events for invoice PDF and email delivery operations.';
comment on table public.notifications is
    'Immutable company-scoped in-app invoice notifications with deterministic deduplication.';

commit;
