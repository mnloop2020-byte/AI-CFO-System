-- Read-only verification after applying
-- 20260720120000_create_auth_and_tenant_isolation.sql.

select jsonb_pretty(
    jsonb_build_object(
        'database_user', current_user,
        'auth_users', (select count(*) from auth.users),
        'companies', (select count(*) from public.companies),
        'company_members', (select count(*) from public.company_members),
        'legacy_rag_rows', (
            select count(*)
            from public.rag_document_chunks_legacy_20260719
        ),
        'business_row_counts', jsonb_build_object(
            'customers', (select count(*) from public.customers),
            'sales', (select count(*) from public.sales),
            'expenses', (select count(*) from public.expenses),
            'inventory', (select count(*) from public.inventory),
            'invoices', (select count(*) from public.invoices),
            'conversations', (select count(*) from public.conversations),
            'messages', (select count(*) from public.messages),
            'reports', (select count(*) from public.reports),
            'documents', (select count(*) from public.documents),
            'document_chunks', (select count(*) from public.document_chunks)
        ),
        'null_company_ids', jsonb_build_object(
            'customers', (select count(*) from public.customers where company_id is null),
            'sales', (select count(*) from public.sales where company_id is null),
            'expenses', (select count(*) from public.expenses where company_id is null),
            'inventory', (select count(*) from public.inventory where company_id is null),
            'invoices', (select count(*) from public.invoices where company_id is null),
            'conversations', (select count(*) from public.conversations where company_id is null),
            'messages', (select count(*) from public.messages where company_id is null),
            'reports', (select count(*) from public.reports where company_id is null),
            'documents', (select count(*) from public.documents where company_id is null),
            'document_chunks', (select count(*) from public.document_chunks where company_id is null)
        ),
        'rls_disabled_tables', coalesce((
            select jsonb_agg(class.relname order by class.relname)
            from pg_class as class
            join pg_namespace as namespace on namespace.oid = class.relnamespace
            where namespace.nspname = 'public'
              and class.relname = any(array[
                  'companies', 'company_members', 'customers', 'sales',
                  'expenses', 'inventory', 'invoices', 'conversations',
                  'messages', 'reports', 'documents', 'document_chunks'
              ])
              and not class.relrowsecurity
        ), '[]'::jsonb),
        'tenant_policy_count', (
            select count(*)
            from pg_policies
            where schemaname = 'public'
              and policyname like 'tenant_%'
        ),
        'storage_policy_count', (
            select count(*)
            from pg_policies
            where schemaname = 'storage'
              and tablename = 'objects'
              and policyname in (
                  'tenant_documents_select',
                  'tenant_documents_insert',
                  'tenant_documents_update',
                  'tenant_documents_delete',
                  'tenant_reports_select',
                  'tenant_reports_insert',
                  'tenant_reports_update',
                  'tenant_reports_delete'
              )
        ),
        'private_buckets', (
            select jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'public', public,
                    'file_size_limit', file_size_limit
                ) order by id
            )
            from storage.buckets
            where id in ('documents', 'reports')
        ),
        'composite_tenant_foreign_keys', (
            select jsonb_agg(constraint_name order by constraint_name)
            from information_schema.table_constraints
            where table_schema = 'public'
              and constraint_type = 'FOREIGN KEY'
              and constraint_name in (
                  'sales_customer_company_fkey',
                  'invoices_customer_company_fkey',
                  'messages_conversation_company_fkey',
                  'document_chunks_document_company_fkey'
              )
        ),
        'embedding_dimension', (
            select atttypmod
            from pg_attribute
            where attrelid = 'public.document_chunks'::regclass
              and attname = 'embedding'
              and not attisdropped
        )
    )
) as tenant_isolation_verification;
