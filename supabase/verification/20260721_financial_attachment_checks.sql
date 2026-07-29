select jsonb_pretty(
    jsonb_build_object(
        'company_count', (select count(*) from public.companies),
        'attachment_count', (select count(*) from public.financial_attachments),
        'rls_enabled', (
            select relrowsecurity
            from pg_class
            where oid = 'public.financial_attachments'::regclass
        ),
        'attachment_policy_count', (
            select count(*)
            from pg_policies
            where schemaname = 'public'
              and tablename = 'financial_attachments'
        ),
        'storage_policy_count', (
            select count(*)
            from pg_policies
            where schemaname = 'storage'
              and tablename = 'objects'
              and policyname like 'single_company_financial_attachments_storage_%'
        ),
        'bucket_private', (
            select not public
            from storage.buckets
            where id = 'financial-attachments'
        ),
        'bucket_limit', (
            select file_size_limit
            from storage.buckets
            where id = 'financial-attachments'
        ),
        'business_counts', jsonb_build_object(
            'customers', (select count(*) from public.customers),
            'sales', (select count(*) from public.sales),
            'expenses', (select count(*) from public.expenses),
            'inventory', (select count(*) from public.inventory),
            'invoices', (select count(*) from public.invoices),
            'conversations', (select count(*) from public.conversations),
            'messages', (select count(*) from public.messages),
            'reports', (select count(*) from public.reports),
            'documents', (select count(*) from public.documents),
            'document_chunks', (select count(*) from public.document_chunks),
            'legacy_rag_chunks', (
                select count(*)
                from public.rag_document_chunks_legacy_20260719
            )
        )
    )
) as financial_attachment_verification;
