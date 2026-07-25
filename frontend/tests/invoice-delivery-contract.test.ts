import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("invoice download and email use authenticated backend endpoints", () => {
  const client = source("lib/invoices.ts");
  assert.match(client, /\/pdf\/download/);
  assert.match(client, /\/email/);
  assert.match(source("lib/api.ts"), /Authorization.*Bearer/);
  assert.doesNotMatch(client, /company_id|storage_path|recipient/);
});

test("invoice table exposes permission-gated download and email actions", () => {
  const table = source("components/crm/InvoicesTable.tsx");
  assert.match(table, /usePermission\("financial\.read"\)/);
  assert.match(table, /usePermission\("financial\.write"\)/);
  assert.match(table, /downloadingInvoiceId/);
  assert.match(table, /emailingInvoiceId/);
  assert.match(table, /window\.confirm/);
  assert.match(table, /URL\.createObjectURL/);
  assert.doesNotMatch(table, /href=\{invoice\.file_url\}/);
});

test("notifications are loaded from the protected API with complete states", () => {
  const menu = source("components/layout/NotificationsMenu.tsx");
  const client = source("lib/notifications.ts");
  assert.match(client, /api\.get.*\/notifications/s);
  assert.match(menu, /Loading notifications/);
  assert.match(menu, /No invoice notifications yet/);
  assert.match(menu, /Notifications could not be loaded/);
  assert.doesNotMatch(menu, /current test data|500\.00|1,000\.00/);
});

test("frontend invoice delivery code contains no privileged secret", () => {
  const combined = [
    source("lib/invoices.ts"),
    source("lib/notifications.ts"),
    source("components/crm/InvoicesTable.tsx"),
    source("components/layout/NotificationsMenu.tsx"),
  ].join("\n");
  assert.doesNotMatch(combined, /service_role|SUPABASE_SERVICE_ROLE|SMTP_PASSWORD/);
});
