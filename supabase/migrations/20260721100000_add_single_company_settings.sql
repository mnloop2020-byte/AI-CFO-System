begin;

select pg_advisory_xact_lock(hashtext('zemam-single-company-settings-v1'));

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
    '20260721100000_add_single_company_settings',
    jsonb_build_object(
        'companies', private.relation_row_count('public.companies'),
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

alter table public.companies
    add column if not exists legal_name text,
    add column if not exists email text,
    add column if not exists phone text,
    add column if not exists address text,
    add column if not exists country text,
    add column if not exists city text,
    add column if not exists currency text,
    add column if not exists timezone text not null default 'UTC',
    add column if not exists default_language text not null default 'en',
    add column if not exists fiscal_year_start smallint not null default 1,
    add column if not exists tax_jurisdiction text,
    add column if not exists tax_id text,
    add column if not exists vat_registered boolean,
    add column if not exists bank_name text,
    add column if not exists opening_balance numeric(18, 2),
    add column if not exists balance_date date,
    add column if not exists financial_settings jsonb not null default '{}'::jsonb;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'companies_currency_format_check'
          and conrelid = 'public.companies'::regclass
    ) then
        alter table public.companies
            add constraint companies_currency_format_check
            check (currency is null or currency ~ '^[A-Z]{3}$');
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'companies_default_language_check'
          and conrelid = 'public.companies'::regclass
    ) then
        alter table public.companies
            add constraint companies_default_language_check
            check (default_language in ('en', 'ar'));
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'companies_fiscal_year_start_check'
          and conrelid = 'public.companies'::regclass
    ) then
        alter table public.companies
            add constraint companies_fiscal_year_start_check
            check (fiscal_year_start between 1 and 12);
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'companies_opening_balance_finite_check'
          and conrelid = 'public.companies'::regclass
    ) then
        alter table public.companies
            add constraint companies_opening_balance_finite_check
            check (
                opening_balance is null
                or opening_balance between -9999999999999999.99 and 9999999999999999.99
            );
    end if;
end
$$;

update private.migration_audit
set after_counts = jsonb_build_object(
    'companies', private.relation_row_count('public.companies'),
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
where migration_name = '20260721100000_add_single_company_settings';

do $$
declare
    audit_row private.migration_audit%rowtype;
begin
    select *
    into strict audit_row
    from private.migration_audit
    where migration_name = '20260721100000_add_single_company_settings'
    for update;

    if audit_row.before_counts <> audit_row.after_counts then
        raise exception 'Company settings migration changed protected row counts: before %, after %',
            audit_row.before_counts,
            audit_row.after_counts;
    end if;

    if (select count(*) from public.companies) <> 1 then
        raise exception 'Exactly one company must remain after settings migration';
    end if;

    update private.migration_audit
    set checks_passed = true, applied_at = now()
    where migration_name = '20260721100000_add_single_company_settings';
end
$$;

comment on column public.companies.opening_balance is
    'User-configured opening balance; never inferred from sales, expenses, or bank data.';
comment on column public.companies.financial_settings is
    'Validated tenant-ready financial configuration that does not contain secrets.';

commit;
