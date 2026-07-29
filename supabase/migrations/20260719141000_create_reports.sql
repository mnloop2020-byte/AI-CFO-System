create extension if not exists pgcrypto;

create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),
    report_type text not null check (
        report_type in (
            'complete_cfo',
            'executive_brief',
            'sales_performance',
            'cash_flow_summary',
            'tax_summary',
            'risk_review'
        )
    ),
    generator text not null check (
        generator in (
            'report_writer',
            'ceo',
            'sales',
            'cashflow',
            'tax',
            'fraud'
        )
    ),
    language text not null check (language in ('en', 'ar')),
    content text not null,
    generated_at timestamptz not null,
    storage_path text not null unique,
    file_name text not null,
    created_at timestamptz not null default now()
);

create index if not exists reports_generated_at_index
    on public.reports (generated_at desc);

comment on table public.reports is
    'AI CFO reports and the private Storage paths of their PDF files.';

alter table public.reports enable row level security;

revoke all on table public.reports from anon, authenticated;
grant all on table public.reports to service_role;

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'reports',
    'reports',
    false,
    10485760,
    array['application/pdf']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- No anon or authenticated policies are created intentionally. Until real
-- authentication and tenant isolation are implemented, report access must go
-- through the FastAPI backend using its server-only service-role credential.
