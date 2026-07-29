-- Read-only verification after applying
-- 20260720170000_create_single_company_auth.sql.
-- This file does not mutate application data or authentication state.

select jsonb_pretty(
    jsonb_build_object(
        'database_user', current_user,
        'migration_audit', (
            select jsonb_build_object(
                'before_counts', before_counts,
                'after_counts', after_counts,
                'checks_passed', checks_passed,
                'applied_at', applied_at
            )
            from private.migration_audit
            where migration_name = '20260720170000_create_single_company_auth'
        ),
        'auth_users', (select count(*) from auth.users),
        'companies', (
            select jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'name', name,
                    'singleton_key', singleton_key
                ) order by created_at
            )
            from public.companies
        ),
        'company_members', (select count(*) from public.company_members),
        'roles', (
            select jsonb_agg(role order by role)
            from private.app_roles
        ),
        'role_permissions', (
            select jsonb_object_agg(role, permissions order by role)
            from (
                select
                    role,
                    jsonb_agg(permission order by permission) as permissions
                from private.role_permissions
                group by role
            ) as permission_sets
        ),
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
        'users_with_multiple_memberships', (
            select count(*)
            from (
                select user_id
                from public.company_members
                group by user_id
                having count(*) > 1
            ) as duplicate_memberships
        ),
        'rls_disabled_tables', coalesce((
            select jsonb_agg(class.relname order by class.relname)
            from pg_class as class
            join pg_namespace as namespace on namespace.oid = class.relnamespace
            where namespace.nspname = 'public'
              and class.relname = any(array[
                  'companies', 'company_members', 'company_invitations',
                  'customers', 'sales', 'expenses', 'inventory', 'invoices',
                  'conversations', 'messages', 'reports', 'documents',
                  'document_chunks'
              ])
              and not class.relrowsecurity
        ), '[]'::jsonb),
        'public_policy_count', (
            select count(*)
            from pg_policies
            where schemaname = 'public'
              and policyname like 'single_company_%'
        ),
        'storage_policy_count', (
            select count(*)
            from pg_policies
            where schemaname = 'storage'
              and tablename = 'objects'
              and policyname in (
                  'single_company_documents_select',
                  'single_company_documents_insert',
                  'single_company_documents_update',
                  'single_company_documents_delete',
                  'single_company_reports_select',
                  'single_company_reports_insert',
                  'single_company_reports_update',
                  'single_company_reports_delete'
              )
        ),
        'private_buckets', (
            select jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'public', public,
                    'file_size_limit', file_size_limit,
                    'allowed_mime_types', allowed_mime_types
                ) order by id
            )
            from storage.buckets
            where id in ('documents', 'reports')
        ),
        'composite_company_foreign_keys', (
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
        'embedding_type', (
            select format_type(attribute.atttypid, attribute.atttypmod)
            from pg_attribute as attribute
            where attribute.attrelid = 'public.document_chunks'::regclass
              and attribute.attname = 'embedding'
              and not attribute.attisdropped
        ),
        'bootstrap', (
            select jsonb_build_object(
                'configured', true,
                'consumed', consumed_at is not null,
                'consumed_at', consumed_at,
                'consumed_by', consumed_by
            )
            from private.bootstrap_control
            where singleton_key
        )
    )
) as single_company_auth_verification;
