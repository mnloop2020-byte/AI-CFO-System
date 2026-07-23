import assert from "node:assert/strict";
import test from "node:test";

import { validateFinancialSettings } from "../lib/company-settings-validation.ts";


const validSettings = {
  invoice_high_priority_days: 30,
  invoice_critical_days: 60,
  high_amount_threshold: 10_000,
  critical_amount_threshold: 50_000,
  cash_reserve_threshold: 75_000,
  large_expense_review_threshold: 15_000,
};

test("accepts the documented financial alert defaults", () => {
  assert.equal(validateFinancialSettings(validSettings), null);
});

test("rejects non-positive or fractional invoice days", () => {
  assert.equal(
    validateFinancialSettings({
      ...validSettings,
      invoice_high_priority_days: 1.5,
    }),
    "invalid_days",
  );
  assert.equal(
    validateFinancialSettings({
      ...validSettings,
      invoice_critical_days: 0,
    }),
    "invalid_days",
  );
});

test("rejects non-finite and negative monetary thresholds", () => {
  assert.equal(
    validateFinancialSettings({
      ...validSettings,
      cash_reserve_threshold: Number.NaN,
    }),
    "invalid_amount",
  );
  assert.equal(
    validateFinancialSettings({
      ...validSettings,
      large_expense_review_threshold: -1,
    }),
    "invalid_amount",
  );
});

test("enforces critical thresholds above high thresholds", () => {
  assert.equal(
    validateFinancialSettings({
      ...validSettings,
      invoice_critical_days: 30,
    }),
    "invalid_day_order",
  );
  assert.equal(
    validateFinancialSettings({
      ...validSettings,
      critical_amount_threshold: 10_000,
    }),
    "invalid_amount_order",
  );
});
