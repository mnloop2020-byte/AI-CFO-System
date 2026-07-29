select
    (select count(*) from public.companies) as companies,
    private.relation_row_count('public.customers') as customers,
    private.relation_row_count('public.sales') as sales,
    private.relation_row_count('public.expenses') as expenses,
    private.relation_row_count('public.inventory') as inventory,
    private.relation_row_count('public.invoices') as invoices,
    private.relation_row_count('public.conversations') as conversations,
    private.relation_row_count('public.messages') as messages,
    private.relation_row_count('public.reports') as reports,
    private.relation_row_count('public.documents') as documents,
    private.relation_row_count('public.document_chunks') as document_chunks,
    private.relation_row_count('public.rag_document_chunks_legacy_20260719') as legacy_chunks,
    private.relation_row_count('public.financial_actions') as financial_actions,
    private.relation_row_count('public.financial_action_events') as financial_action_events;

select migration_name, before_counts, after_counts, checks_passed, applied_at
from private.migration_audit
where migration_name = '20260722100000_create_financial_action_center';

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('financial_actions', 'financial_action_events')
order by tablename;

select policyname, tablename, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('financial_actions', 'financial_action_events')
order by tablename, policyname;

select role_permission.role, role_permission.permission
from private.role_permissions as role_permission
where role_permission.permission like 'actions.%'
order by role_permission.role, role_permission.permission;

select jsonb_build_object(
    'counts', jsonb_build_object(
        'companies', (select count(*) from public.companies),
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
        'legacy_chunks', (
            select count(*) from public.rag_document_chunks_legacy_20260719
        ),
        'financial_actions', (select count(*) from public.financial_actions),
        'financial_action_events', (
            select count(*) from public.financial_action_events
        )
    ),
    'audit', (
        select to_jsonb(audit)
        from private.migration_audit as audit
        where migration_name = '20260722100000_create_financial_action_center'
    ),
    'rls', (
        select jsonb_object_agg(tablename, rowsecurity)
        from pg_tables
        where schemaname = 'public'
          and tablename in ('financial_actions', 'financial_action_events')
    ),
    'policy_count', (
        select count(*)
        from pg_policies
        where schemaname = 'public'
          and tablename in ('financial_actions', 'financial_action_events')
    )
) as verification;
