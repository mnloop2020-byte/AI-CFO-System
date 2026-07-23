begin;

select pg_advisory_xact_lock(
    hashtext('zemam-company-business-activity-financial-settings-v1')
);

do $$
begin
    if (select count(*) from public.companies) <> 1 then
        raise exception 'Company settings migration requires exactly one company';
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
    '20260722190000_add_company_business_activity_and_financial_settings',
    jsonb_build_object(
        'companies', private.relation_row_count('public.companies'),
        'company_members', private.relation_row_count('public.company_members'),
        'company_invitations', private.relation_row_count('public.company_invitations'),
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
        'financial_attachments', private.relation_row_count(
            'public.financial_attachments'
        ),
        'financial_actions', private.relation_row_count('public.financial_actions'),
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
set
    before_counts = excluded.before_counts,
    after_counts = null,
    checks_passed = false,
    applied_at = null;

alter table public.companies
    add column if not exists business_activity text;

create or replace function private.valid_company_financial_settings(
    settings jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
    setting_key text;
    invoice_high_priority_days numeric;
    invoice_critical_days numeric;
    high_amount_threshold numeric;
    critical_amount_threshold numeric;
    amount_value numeric;
begin
    if settings is null or jsonb_typeof(settings) <> 'object' then
        return false;
    end if;

    for setting_key in select jsonb_object_keys(settings)
    loop
        if setting_key not in (
            'invoice_high_priority_days',
            'invoice_critical_days',
            'high_amount_threshold',
            'critical_amount_threshold',
            'cash_reserve_threshold',
            'large_expense_review_threshold'
        ) then
            return false;
        end if;
    end loop;

    if settings ? 'invoice_high_priority_days' then
        if jsonb_typeof(settings -> 'invoice_high_priority_days') <> 'number' then
            return false;
        end if;
        invoice_high_priority_days := (
            settings ->> 'invoice_high_priority_days'
        )::numeric;
        if invoice_high_priority_days <= 0
           or invoice_high_priority_days <> trunc(invoice_high_priority_days) then
            return false;
        end if;
    else
        invoice_high_priority_days := 30;
    end if;

    if settings ? 'invoice_critical_days' then
        if jsonb_typeof(settings -> 'invoice_critical_days') <> 'number' then
            return false;
        end if;
        invoice_critical_days := (settings ->> 'invoice_critical_days')::numeric;
        if invoice_critical_days <= 0
           or invoice_critical_days <> trunc(invoice_critical_days) then
            return false;
        end if;
    else
        invoice_critical_days := 60;
    end if;

    foreach setting_key in array array[
        'high_amount_threshold',
        'critical_amount_threshold',
        'cash_reserve_threshold',
        'large_expense_review_threshold'
    ]
    loop
        if settings ? setting_key then
            if jsonb_typeof(settings -> setting_key) <> 'number' then
                return false;
            end if;
            amount_value := (settings ->> setting_key)::numeric;
            if amount_value < 0 then
                return false;
            end if;
        end if;
    end loop;

    high_amount_threshold := coalesce(
        (settings ->> 'high_amount_threshold')::numeric,
        10000
    );
    critical_amount_threshold := coalesce(
        (settings ->> 'critical_amount_threshold')::numeric,
        50000
    );

    return invoice_critical_days > invoice_high_priority_days
       and critical_amount_threshold > high_amount_threshold;
exception
    when invalid_text_representation or numeric_value_out_of_range then
        return false;
end
$$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'companies_business_activity_length_check'
          and conrelid = 'public.companies'::regclass
    ) then
        alter table public.companies
            add constraint companies_business_activity_length_check
            check (
                business_activity is null
                or (
                    length(btrim(business_activity)) between 1 and 500
                )
            );
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'companies_financial_settings_valid_check'
          and conrelid = 'public.companies'::regclass
    ) then
        alter table public.companies
            add constraint companies_financial_settings_valid_check
            check (
                private.valid_company_financial_settings(financial_settings)
            ) not valid;

        alter table public.companies
            validate constraint companies_financial_settings_valid_check;
    end if;
end
$$;

update private.migration_audit
set after_counts = jsonb_build_object(
    'companies', private.relation_row_count('public.companies'),
    'company_members', private.relation_row_count('public.company_members'),
    'company_invitations', private.relation_row_count('public.company_invitations'),
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
    'financial_attachments', private.relation_row_count(
        'public.financial_attachments'
    ),
    'financial_actions', private.relation_row_count('public.financial_actions'),
    'financial_action_events', private.relation_row_count(
        'public.financial_action_events'
    ),
    'security_audit_events', private.relation_row_count(
        'public.security_audit_events'
    )
)
where migration_name =
    '20260722190000_add_company_business_activity_and_financial_settings';

do $$
declare
    audit_row private.migration_audit%rowtype;
begin
    select *
    into strict audit_row
    from private.migration_audit
    where migration_name =
        '20260722190000_add_company_business_activity_and_financial_settings'
    for update;

    if audit_row.before_counts <> audit_row.after_counts then
        raise exception 'Company profile migration changed protected row counts';
    end if;

    if (select count(*) from public.companies) <> 1 then
        raise exception 'Exactly one company must remain after migration';
    end if;

    update private.migration_audit
    set checks_passed = true, applied_at = now()
    where migration_name =
        '20260722190000_add_company_business_activity_and_financial_settings';
end
$$;

comment on column public.companies.business_activity is
    'Optional non-sensitive business activity used for company context.';
comment on function private.valid_company_financial_settings(jsonb) is
    'Validates known single-company financial alert settings; an empty object uses application defaults.';

commit;
