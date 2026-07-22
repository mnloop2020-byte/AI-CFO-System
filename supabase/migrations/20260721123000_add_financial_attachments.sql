begin;

select pg_advisory_xact_lock(hashtext('zemam-financial-attachments-v1'));

do $$
begin
    if (select count(*) from public.companies) <> 1 then
        raise exception 'Financial attachments migration requires exactly one company';
    end if;
end
$$;

create table if not exists public.financial_attachments (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete restrict,
    invoice_id uuid,
    expense_id uuid,
    original_file_name text not null check (
        length(btrim(original_file_name)) between 1 and 255
    ),
    storage_path text not null unique,
    mime_type text not null check (
        mime_type in ('application/pdf', 'image/png', 'image/jpeg')
    ),
    size_bytes integer not null check (size_bytes between 1 and 5242880),
    sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
    uploaded_by uuid not null default auth.uid()
        references auth.users(id) on delete restrict,
    created_at timestamptz not null default now(),
    constraint financial_attachments_one_record_check check (
        num_nonnulls(invoice_id, expense_id) = 1
    ),
    constraint financial_attachments_invoice_company_fk
        foreign key (invoice_id, company_id)
        references public.invoices(id, company_id)
        on delete cascade,
    constraint financial_attachments_expense_company_fk
        foreign key (expense_id, company_id)
        references public.expenses(id, company_id)
        on delete cascade
);

create index if not exists financial_attachments_invoice_index
    on public.financial_attachments (company_id, invoice_id, created_at desc)
    where invoice_id is not null;

create index if not exists financial_attachments_expense_index
    on public.financial_attachments (company_id, expense_id, created_at desc)
    where expense_id is not null;

drop trigger if exists assign_current_company_id on public.financial_attachments;
create trigger assign_current_company_id
before insert or update on public.financial_attachments
for each row execute function private.assign_current_company_id();

alter table public.financial_attachments enable row level security;
revoke all on table public.financial_attachments from anon, authenticated;
grant select, insert, delete on table public.financial_attachments to authenticated;
grant all on table public.financial_attachments to service_role;

drop policy if exists single_company_financial_attachments_select
    on public.financial_attachments;
create policy single_company_financial_attachments_select
on public.financial_attachments
for select to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('financial.read'))
);

drop policy if exists single_company_financial_attachments_insert
    on public.financial_attachments;
create policy single_company_financial_attachments_insert
on public.financial_attachments
for insert to authenticated
with check (
    company_id = (select private.current_company_id())
    and uploaded_by = (select auth.uid())
    and (select private.has_permission('financial.write'))
);

drop policy if exists single_company_financial_attachments_delete
    on public.financial_attachments;
create policy single_company_financial_attachments_delete
on public.financial_attachments
for delete to authenticated
using (
    company_id = (select private.current_company_id())
    and (select private.has_permission('financial.write'))
);

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'financial-attachments',
    'financial-attachments',
    false,
    5242880,
    array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists single_company_financial_attachments_storage_select
    on storage.objects;
create policy single_company_financial_attachments_storage_select
on storage.objects
for select to authenticated
using (
    bucket_id = 'financial-attachments'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('financial.read'))
);

drop policy if exists single_company_financial_attachments_storage_insert
    on storage.objects;
create policy single_company_financial_attachments_storage_insert
on storage.objects
for insert to authenticated
with check (
    bucket_id = 'financial-attachments'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('financial.write'))
);

drop policy if exists single_company_financial_attachments_storage_delete
    on storage.objects;
create policy single_company_financial_attachments_storage_delete
on storage.objects
for delete to authenticated
using (
    bucket_id = 'financial-attachments'
    and (storage.foldername(name))[1] = (select private.current_company_id())::text
    and (select private.has_permission('financial.write'))
);

insert into private.migration_audit (
    migration_name,
    before_counts,
    after_counts,
    checks_passed,
    applied_at
)
values (
    '20260721123000_add_financial_attachments',
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

update private.migration_audit
set after_counts = before_counts
where migration_name = '20260721123000_add_financial_attachments';

do $$
declare
    audit_row private.migration_audit%rowtype;
begin
    select * into strict audit_row
    from private.migration_audit
    where migration_name = '20260721123000_add_financial_attachments'
    for update;

    if audit_row.before_counts <> audit_row.after_counts then
        raise exception 'Financial attachment migration changed protected row counts';
    end if;

    if (select count(*) from public.companies) <> 1 then
        raise exception 'Exactly one company must remain after attachment migration';
    end if;

    if exists (select 1 from public.financial_attachments) then
        raise exception 'New financial_attachments table must be empty at creation';
    end if;

    update private.migration_audit
    set checks_passed = true, applied_at = now()
    where migration_name = '20260721123000_add_financial_attachments';
end
$$;

comment on table public.financial_attachments is
    'Private PDF/image attachments for one invoice or expense, scoped by company and protected by RLS.';

commit;
