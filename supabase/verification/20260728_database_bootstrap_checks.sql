begin;

do $$
declare
    missing_tables text[];
    invalid_money_columns text[];
    missing_indexes text[];
    rls_disabled_tables text[];
begin
    select array_agg(required_table order by required_table)
    into missing_tables
    from unnest(array[
        'companies',
        'company_members',
        'company_invitations',
        'customers',
        'sales',
        'expenses',
        'inventory',
        'invoices',
        'reports',
        'documents',
        'document_chunks',
        'conversations',
        'messages',
        'financial_attachments',
        'financial_actions',
        'financial_action_events',
        'security_audit_events',
        'invoice_delivery_events',
        'notifications'
    ]) as required_table
    where to_regclass('public.' || required_table) is null;

    if missing_tables is not null then
        raise exception 'Missing public tables: %', missing_tables;
    end if;

    if not exists (
        select 1
        from pg_extension
        where extname = 'vector'
    ) then
        raise exception 'pgvector extension is missing';
    end if;

    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'document_chunks'
          and column_name = 'embedding'
          and udt_name = 'vector'
    ) then
        raise exception 'document_chunks.embedding is not a vector';
    end if;

    if (
        select atttypmod
        from pg_attribute
        where attrelid = 'public.document_chunks'::regclass
          and attname = 'embedding'
          and not attisdropped
    ) <> 384 then
        raise exception 'document_chunks.embedding is not vector(384)';
    end if;

    with expected(table_name, column_name) as (
        values
            ('companies', 'opening_balance'),
            ('sales', 'unit_price'),
            ('sales', 'total_amount'),
            ('expenses', 'amount'),
            ('inventory', 'cost_price'),
            ('inventory', 'selling_price'),
            ('invoices', 'total_amount'),
            ('invoices', 'vat_amount'),
            ('financial_actions', 'financial_impact')
    )
    select array_agg(expected.table_name || '.' || expected.column_name)
    into invalid_money_columns
    from expected
    left join information_schema.columns as column_info
      on column_info.table_schema = 'public'
     and column_info.table_name = expected.table_name
     and column_info.column_name = expected.column_name
    where column_info.data_type <> 'numeric'
       or column_info.numeric_precision <> 18
       or column_info.numeric_scale <> 2;

    if invalid_money_columns is not null then
        raise exception 'Invalid money columns: %', invalid_money_columns;
    end if;

    select array_agg(required_index order by required_index)
    into missing_indexes
    from unnest(array[
        'customers_company_created_index',
        'sales_company_date_index',
        'expenses_company_date_index',
        'inventory_company_sku_unique',
        'inventory_company_stock_index',
        'invoices_company_number_unique',
        'invoices_company_status_due_index',
        'conversations_company_updated_index',
        'messages_company_conversation_index',
        'reports_generated_at_index',
        'document_chunks_embedding_hnsw_index',
        'financial_actions_open_dedup_index',
        'financial_action_events_timeline_index',
        'security_audit_events_company_time_index',
        'invoice_delivery_events_invoice_time_index',
        'notifications_company_time_index'
    ]) as required_index
    where to_regclass('public.' || required_index) is null;

    if missing_indexes is not null then
        raise exception 'Missing indexes: %', missing_indexes;
    end if;

    select array_agg(class.relname order by class.relname)
    into rls_disabled_tables
    from pg_class as class
    join pg_namespace as namespace
      on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = any(array[
          'companies',
          'company_members',
          'company_invitations',
          'customers',
          'sales',
          'expenses',
          'inventory',
          'invoices',
          'reports',
          'documents',
          'document_chunks',
          'conversations',
          'messages',
          'financial_attachments',
          'financial_actions',
          'financial_action_events',
          'security_audit_events',
          'invoice_delivery_events',
          'notifications'
      ])
      and not class.relrowsecurity;

    if rls_disabled_tables is not null then
        raise exception 'RLS disabled on tables: %', rls_disabled_tables;
    end if;

    if (select count(*) from public.companies) <> 1 then
        raise exception 'Exactly one company is required after bootstrap';
    end if;

    if (
        select count(*)
        from storage.buckets
        where id in ('reports', 'documents', 'financial-attachments')
          and not public
    ) <> 3 then
        raise exception 'Required private Storage buckets are missing or public';
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.sales'::regclass
          and conname = 'sales_total_calculation_check'
    ) then
        raise exception 'Deterministic sales total constraint is missing';
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.invoices'::regclass
          and conname = 'invoices_vat_amount_check'
    ) then
        raise exception 'Invoice VAT constraint is missing';
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.messages'::regclass
          and conname = 'messages_conversation_company_fkey'
    ) then
        raise exception 'Cross-company message relationship is missing';
    end if;

    if not exists (
        select 1
        from pg_trigger
        where tgrelid = 'public.company_members'::regclass
          and tgname = 'company_members_protect_last_owner'
          and not tgisinternal
    ) then
        raise exception 'Last-owner protection trigger is missing';
    end if;
end
$$;

select jsonb_build_object(
    'public_tables', (
        select count(*)
        from pg_class as class
        join pg_namespace as namespace
          on namespace.oid = class.relnamespace
        where namespace.nspname = 'public'
          and class.relkind = 'r'
    ),
    'public_rls_tables', (
        select count(*)
        from pg_class as class
        join pg_namespace as namespace
          on namespace.oid = class.relnamespace
        where namespace.nspname = 'public'
          and class.relkind = 'r'
          and class.relrowsecurity
    ),
    'public_policies', (
        select count(*)
        from pg_policies
        where schemaname = 'public'
    ),
    'storage_policies', (
        select count(*)
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
    ),
    'private_buckets', (
        select count(*)
        from storage.buckets
        where not public
    )
) as bootstrap_catalog_summary;

rollback;
