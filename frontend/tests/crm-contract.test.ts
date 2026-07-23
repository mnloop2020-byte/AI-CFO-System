import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


const modules = ["customers", "sales", "expenses", "inventory", "invoices"];

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("all five CRM clients use the authenticated shared API client", () => {
  for (const module of modules) {
    const contents = source(`lib/${module}.ts`);
    assert.match(contents, /import \{ api \} from "@\/lib\/api"/);
    assert.doesNotMatch(contents, /company_id/);
  }

  assert.match(source("lib/api.ts"), /Authorization.*Bearer/);
});

test("all five CRUD tables derive write controls from auth permissions", () => {
  const tables = [
    "CustomersTable",
    "SalesTable",
    "ExpensesTable",
    "InventoryTable",
    "InvoicesTable",
  ];

  for (const table of tables) {
    const contents = source(`components/crm/${table}.tsx`);
    assert.match(contents, /usePermission\("financial\.write"\)/);
    assert.match(contents, /disabled=\{!canWrite/);
  }
});

test("financial forms retain client-side numeric validation", () => {
  assert.match(source("components/crm/SaleForm.tsx"), /quantity < 1/);
  assert.match(source("components/crm/SaleForm.tsx"), /unitPrice < 0/);
  assert.match(source("components/crm/ExpenseForm.tsx"), /amount <= 0/);
  assert.match(source("components/crm/InventoryForm.tsx"), /quantity < 0/);
  assert.match(source("components/crm/InvoiceForm.tsx"), /totalAmount < 0/);
  assert.match(source("components/crm/InvoiceForm.tsx"), /vatAmount > totalAmount/);
});

test("invoice input never sends legacy file URLs", () => {
  const invoiceClient = source("lib/invoices.ts");
  const invoiceForm = source("components/crm/InvoiceForm.tsx");

  assert.doesNotMatch(
    invoiceClient.split("export type CreateInvoiceInput")[1].split("};")[0],
    /file_url/,
  );
  assert.doesNotMatch(invoiceForm, /file_url: initialInvoice/);
});
