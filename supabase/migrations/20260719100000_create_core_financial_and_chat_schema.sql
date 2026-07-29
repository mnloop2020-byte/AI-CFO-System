begin;

create extension if not exists pgcrypto;

create table public.customers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text,
    phone text,
    company_name text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint customers_name_check check (
        length(btrim(name)) between 1 and 200
    ),
    constraint customers_email_length_check check (
        email is null or length(email) <= 254
    ),
    constraint customers_phone_length_check check (
        phone is null or length(phone) <= 31
    ),
    constraint customers_company_name_length_check check (
        company_name is null or length(company_name) <= 200
    ),
    constraint customers_notes_length_check check (
        notes is null or length(notes) <= 4000
    )
);

create table public.sales (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid references public.customers(id) on delete restrict,
    product_name text not null,
    quantity integer not null,
    unit_price numeric(18, 2) not null,
    total_amount numeric(18, 2) not null,
    status text not null default 'completed',
    sale_date timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint sales_product_name_check check (
        length(btrim(product_name)) between 1 and 200
    ),
    constraint sales_quantity_check check (
        quantity between 1 and 1000000
    ),
    constraint sales_unit_price_check check (
        unit_price between 0 and 9999999999999999.99
    ),
    constraint sales_total_amount_check check (
        total_amount between 0 and 9999999999999999.99
    ),
    constraint sales_total_calculation_check check (
        total_amount = round(unit_price * quantity, 2)
    ),
    constraint sales_status_check check (
        status in ('completed', 'pending', 'refunded', 'cancelled')
    )
);

create table public.expenses (
    id uuid primary key default gen_random_uuid(),
    category text not null,
    amount numeric(18, 2) not null,
    description text,
    vendor text,
    expense_date timestamptz,
    is_flagged boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint expenses_category_check check (
        length(btrim(category)) between 1 and 100
    ),
    constraint expenses_amount_check check (
        amount > 0 and amount <= 9999999999999999.99
    ),
    constraint expenses_description_length_check check (
        description is null or length(description) <= 4000
    ),
    constraint expenses_vendor_length_check check (
        vendor is null or length(vendor) <= 200
    )
);

create table public.inventory (
    id uuid primary key default gen_random_uuid(),
    product_name text not null,
    sku text,
    quantity integer not null default 0,
    reorder_level integer not null default 5,
    cost_price numeric(18, 2) not null default 0,
    selling_price numeric(18, 2) not null default 0,
    last_sold timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint inventory_product_name_check check (
        length(btrim(product_name)) between 1 and 200
    ),
    constraint inventory_sku_length_check check (
        sku is null or length(sku) between 1 and 100
    ),
    constraint inventory_quantity_check check (
        quantity between 0 and 1000000000
    ),
    constraint inventory_reorder_level_check check (
        reorder_level between 0 and 1000000000
    ),
    constraint inventory_cost_price_check check (
        cost_price between 0 and 9999999999999999.99
    ),
    constraint inventory_selling_price_check check (
        selling_price between 0 and 9999999999999999.99
    )
);

create table public.invoices (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid references public.customers(id) on delete restrict,
    invoice_number text not null,
    total_amount numeric(18, 2) not null,
    vat_amount numeric(18, 2) not null default 0,
    status text not null default 'unpaid',
    due_date timestamptz,
    file_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint invoices_number_check check (
        length(btrim(invoice_number)) between 1 and 100
    ),
    constraint invoices_total_amount_check check (
        total_amount between 0 and 9999999999999999.99
    ),
    constraint invoices_vat_amount_check check (
        vat_amount between 0 and total_amount
    ),
    constraint invoices_status_check check (
        status in ('paid', 'unpaid', 'overdue', 'cancelled')
    ),
    constraint invoices_file_url_length_check check (
        file_url is null or length(file_url) <= 2048
    )
);

create table public.conversations (
    id uuid primary key default gen_random_uuid(),
    title text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint conversations_title_length_check check (
        title is null or length(title) between 1 and 120
    )
);

create table public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null
        references public.conversations(id) on delete cascade,
    role text not null,
    content text not null,
    created_at timestamptz not null default now(),
    constraint messages_role_check check (
        role in ('user', 'assistant')
    ),
    constraint messages_content_check check (
        length(btrim(content)) > 0
    )
);

create index customers_created_at_index
    on public.customers (created_at desc);

create index sales_customer_index
    on public.sales (customer_id)
    where customer_id is not null;

create index sales_date_index
    on public.sales (sale_date desc);

create index expenses_date_index
    on public.expenses (expense_date desc);

create index inventory_created_at_index
    on public.inventory (created_at desc);

create index invoices_customer_index
    on public.invoices (customer_id)
    where customer_id is not null;

create index invoices_created_at_index
    on public.invoices (created_at desc);

create index invoices_status_due_date_index
    on public.invoices (status, due_date);

create index conversations_updated_at_index
    on public.conversations (updated_at desc);

create index messages_conversation_created_index
    on public.messages (conversation_id, created_at, id);

create or replace function public.set_core_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

revoke all on function public.set_core_updated_at() from public, anon, authenticated;

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_core_updated_at();

create trigger sales_set_updated_at
before update on public.sales
for each row execute function public.set_core_updated_at();

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_core_updated_at();

create trigger inventory_set_updated_at
before update on public.inventory
for each row execute function public.set_core_updated_at();

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_core_updated_at();

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_core_updated_at();

comment on table public.customers is
    'Single-company customer records; company_id and RLS are added by the Auth migration.';
comment on table public.sales is
    'Sales with deterministic numeric(18,2) totals calculated by the backend.';
comment on table public.expenses is
    'Company expenses using fixed two-decimal monetary values.';
comment on table public.inventory is
    'Inventory quantities and fixed two-decimal cost and selling prices.';
comment on table public.invoices is
    'Invoices with fixed two-decimal totals and VAT amounts.';
comment on table public.conversations is
    'Authenticated AI CFO chat conversations.';
comment on table public.messages is
    'Messages created before the RAG migration adds structured sources.';

commit;
