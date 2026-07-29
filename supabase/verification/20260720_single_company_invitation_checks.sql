-- Read-only verification after applying
-- 20260720223000_add_secure_single_company_invitations.sql.

select jsonb_pretty(
    jsonb_build_object(
        'invitation_rows', (
            select count(*)
            from public.company_invitations
        ),
        'invitation_columns', (
            select jsonb_agg(column_name order by ordinal_position)
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'company_invitations'
        ),
        'token_hash_unique', exists (
            select 1
            from pg_indexes
            where schemaname = 'public'
              and tablename = 'company_invitations'
              and indexname = 'company_invitations_token_hash_unique'
        ),
        'auth_triggers', (
            select jsonb_agg(trigger.tgname order by trigger.tgname)
            from pg_trigger as trigger
            where trigger.tgrelid = 'auth.users'::regclass
              and not trigger.tgisinternal
              and trigger.tgname in (
                  'enforce_single_company_auth_signup',
                  'attach_invited_user'
              )
        ),
        'invitation_policies', (
            select jsonb_agg(policyname order by policyname)
            from pg_policies
            where schemaname = 'public'
              and tablename = 'company_invitations'
        ),
        'company_count', (select count(*) from public.companies),
        'membership_count', (select count(*) from public.company_members),
        'membership_role_counts', (
            select jsonb_object_agg(role, member_count order by role)
            from (
                select role, count(*) as member_count
                from public.company_members
                group by role
            ) as role_counts
        ),
        'owner_count', (
            select count(*)
            from public.company_members
            where role = 'owner'
        ),
        'invitation_status_counts', (
            select jsonb_object_agg(status, invitation_count order by status)
            from (
                select status, count(*) as invitation_count
                from public.company_invitations
                group by status
            ) as status_counts
        ),
        'invitation_hash_keys_in_auth_metadata', (
            select count(*)
            from auth.users
            where raw_user_meta_data ? 'invitation_token_hash'
        ),
        'active_invitation_hash_values_in_auth_metadata', (
            select count(*)
            from auth.users
            where nullif(raw_user_meta_data ->> 'invitation_token_hash', '') is not null
        ),
        'phase1_temporary_storage_objects', (
            select count(*)
            from storage.objects
            where bucket_id = 'documents'
              and name like '%/phase1-security/%'
        ),
        'business_row_counts', jsonb_build_object(
            'customers', (select count(*) from public.customers),
            'sales', (select count(*) from public.sales),
            'expenses', (select count(*) from public.expenses),
            'inventory', (select count(*) from public.inventory),
            'invoices', (select count(*) from public.invoices),
            'conversations', (select count(*) from public.conversations),
            'messages', (select count(*) from public.messages),
            'documents', (select count(*) from public.documents),
            'document_chunks', (select count(*) from public.document_chunks),
            'legacy_rag_chunks', (
                select count(*)
                from public.rag_document_chunks_legacy_20260719
            )
        )
    )
) as single_company_invitation_verification;
