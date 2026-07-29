import type { FinancialSettings } from "@/lib/company";
import {
  compareMoney,
  isNonNegativeMoney,
} from "./money.ts";

export type FinancialSettingsValidationCode =
  | "invalid_days"
  | "invalid_amount"
  | "invalid_day_order"
  | "invalid_amount_order";

export function validateFinancialSettings(
  settings: FinancialSettings,
): FinancialSettingsValidationCode | null {
  const dayValues = [
    settings.invoice_high_priority_days,
    settings.invoice_critical_days,
  ];
  if (
    dayValues.some(
      (value) => !Number.isInteger(value) || value <= 0,
    )
  ) {
    return "invalid_days";
  }

  const amountValues = [
    settings.high_amount_threshold,
    settings.critical_amount_threshold,
    settings.cash_reserve_threshold,
    settings.large_expense_review_threshold,
  ];
  if (
    amountValues.some(
      (value) => !isNonNegativeMoney(value),
    )
  ) {
    return "invalid_amount";
  }

  if (
    settings.invoice_critical_days <=
    settings.invoice_high_priority_days
  ) {
    return "invalid_day_order";
  }
  if (
    compareMoney(
      settings.critical_amount_threshold,
      settings.high_amount_threshold,
    ) <= 0
  ) {
    return "invalid_amount_order";
  }
  return null;
}
