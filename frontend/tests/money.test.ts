import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  addMoney,
  compareMoney,
  formatMoney,
  multiplyMoneyByInteger,
  normalizeMoney,
  parseMoneyToMinorUnits,
  percentageOfMoney,
  subtractMoney,
} from "../lib/money.ts";

function source(path: string) {
  return readFileSync(
    new URL(`../${path}`, import.meta.url),
    "utf8",
  );
}

test("adds 0.1 and 0.2 exactly", () => {
  assert.equal(
    addMoney(["0.1", "0.2"]),
    "0.30",
  );
});

test("rounds half up to two decimal places", () => {
  assert.equal(normalizeMoney("1.004"), "1.00");
  assert.equal(normalizeMoney("1.005"), "1.01");
  assert.equal(
    normalizeMoney("-1.005"),
    "-1.01",
  );
});

test("handles small and large values as minor units", () => {
  assert.equal(
    parseMoneyToMinorUnits("0.001"),
    0n,
  );
  assert.equal(
    normalizeMoney("999999999.999"),
    "1000000000.00",
  );
});

test("multiplies money only by an integer", () => {
  assert.equal(
    multiplyMoneyByInteger("0.335", 3),
    "1.02",
  );
  assert.throws(() =>
    multiplyMoneyByInteger("1.00", 1.5),
  );
});

test("compares and subtracts exact values", () => {
  assert.equal(
    compareMoney("10.00", "9.999"),
    0,
  );
  assert.equal(
    subtractMoney("100.00", "15.01"),
    "84.99",
  );
});

test("calculates VAT percentages with half-up rounding", () => {
  assert.equal(
    percentageOfMoney("1.00", "3.00"),
    "33.33",
  );
  assert.equal(
    percentageOfMoney("0.01", "8.00"),
    "0.13",
  );
  assert.equal(
    percentageOfMoney("0.00", "0.00"),
    "0.00",
  );
});

test("formats English and Arabic without changing value", () => {
  assert.equal(
    formatMoney("1234.50", "en-US"),
    "1,234.50",
  );
  assert.match(
    formatMoney("1234.50", "ar-SA"),
    /١.*٢.*٣.*٤.*٥.*٠/,
  );
});

test("rejects invalid and non-decimal input", () => {
  for (const value of [
    "",
    "NaN",
    "Infinity",
    "1e3",
    "1,000.00",
  ]) {
    assert.throws(() =>
      normalizeMoney(value),
    );
  }
});

test("money API contracts and KPIs do not coerce amounts to Number", () => {
  for (const module of [
    "sales",
    "expenses",
    "inventory",
    "invoices",
    "company",
  ]) {
    assert.match(
      source(`lib/${module}.ts`),
      /MoneyString/,
    );
  }

  const financialUi = [
    "app/dashboard/page.tsx",
    "app/crm/sales/page.tsx",
    "app/crm/expenses/page.tsx",
    "app/crm/inventory/page.tsx",
    "app/crm/invoices/page.tsx",
  ]
    .map(source)
    .join("\n");

  assert.doesNotMatch(
    financialUi,
    /Number\s*\(\s*[^)]*(?:amount|price|vat|balance)/i,
  );
  assert.match(financialUi, /addMoney/);
  assert.match(financialUi, /formatMoney/);
});
