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

test("all five CRUD tables hide write controls without financial.write", () => {
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
    assert.match(contents, /\{canWrite \? \(/);
  }

  const invoices = source("components/crm/InvoicesTable.tsx");
  assert.match(invoices, /handleDownloadInvoice/);
  assert.match(invoices, /\{canWrite \? \(\s*<>/);
});

test("financial forms validate money without JavaScript number coercion", () => {
  assert.match(source("components/crm/SaleForm.tsx"), /quantity < 1/);
  assert.match(source("components/crm/SaleForm.tsx"), /isNonNegativeMoney\(unitPrice\)/);
  assert.match(source("components/crm/ExpenseForm.tsx"), /isPositiveMoney\(amount\)/);
  assert.match(source("components/crm/InventoryForm.tsx"), /quantity < 0/);
  assert.match(source("components/crm/InvoiceForm.tsx"), /isNonNegativeMoney\(totalAmount\)/);
  assert.match(source("components/crm/InvoiceForm.tsx"), /compareMoney\(vatAmount, totalAmount\)/);

  for (const form of [
    "SaleForm",
    "ExpenseForm",
    "InventoryForm",
    "InvoiceForm",
  ]) {
    assert.doesNotMatch(
      source(`components/crm/${form}.tsx`),
      /Number\(event\.target\.value\)[\s\S]{0,80}(amount|price)/i,
    );
  }
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
