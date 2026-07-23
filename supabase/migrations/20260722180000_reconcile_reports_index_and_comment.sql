begin;

create index if not exists reports_generated_at_index
    on public.reports (generated_at desc);

comment on table public.reports is
    'AI CFO reports and the private Storage paths of their PDF files.';

commit;
