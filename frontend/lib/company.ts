import { api } from "@/lib/api";
import type { MoneyString } from "@/lib/money";

export type FinancialSettings = {
  invoice_high_priority_days: number;
  invoice_critical_days: number;
  high_amount_threshold: MoneyString;
  critical_amount_threshold: MoneyString;
  cash_reserve_threshold: MoneyString;
  large_expense_review_threshold: MoneyString;
};

export type CompanySettings = {
  id: string;
  name: string;
  legal_name: string | null;
  business_activity: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  city: string | null;
  currency: string | null;
  timezone: string;
  default_language: "en" | "ar";
  fiscal_year_start: number;
  tax_jurisdiction: string | null;
  tax_id: string | null;
  vat_registered: boolean | null;
  bank_name: string | null;
  opening_balance: MoneyString | null;
  balance_date: string | null;
  financial_settings: FinancialSettings;
  created_at: string;
  updated_at: string;
};

export type CompanySettingsEditable = Omit<
  CompanySettings,
  "id" | "created_at" | "updated_at"
>;

export type CompanySettingsUpdate = Partial<
  Omit<CompanySettingsEditable, "financial_settings">
> & {
  financial_settings?: Partial<FinancialSettings>;
};

export function getCompanySettings() {
  return api.get<CompanySettings>("/company/settings");
}

export function updateCompanySettings(settings: CompanySettingsUpdate) {
  return api.patch<CompanySettings>("/company/settings", settings);
}
