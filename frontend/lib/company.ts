import { api } from "@/lib/api";


export type CompanySettings = {
  id: string;
  name: string;
  legal_name: string | null;
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
  opening_balance: string | number | null;
  balance_date: string | null;
  financial_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CompanySettingsUpdate = Omit<
  CompanySettings,
  "id" | "created_at" | "updated_at"
>;

export function getCompanySettings() {
  return api.get<CompanySettings>("/company/settings");
}

export function updateCompanySettings(settings: CompanySettingsUpdate) {
  return api.patch<CompanySettings>("/company/settings", settings);
}

