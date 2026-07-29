begin;

create unique index if not exists inventory_company_sku_unique
    on public.inventory (company_id, upper(sku))
    where sku is not null;

create unique index if not exists invoices_company_number_unique
    on public.invoices (company_id, lower(invoice_number));

create index if not exists customers_company_created_index
    on public.customers (company_id, created_at desc);

create index if not exists sales_company_date_index
    on public.sales (company_id, sale_date desc);

create index if not exists expenses_company_date_index
    on public.expenses (company_id, expense_date desc);

create index if not exists inventory_company_stock_index
    on public.inventory (company_id, quantity, reorder_level);

create index if not exists invoices_company_status_due_index
    on public.invoices (company_id, status, due_date);

create index if not exists conversations_company_updated_index
    on public.conversations (company_id, updated_at desc);

create index if not exists messages_company_conversation_index
    on public.messages (company_id, conversation_id, created_at, id);

commit;
