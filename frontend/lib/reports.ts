import { api } from "@/lib/api";


export type ReportType =
  | "complete_cfo"
  | "executive_brief"
  | "sales_performance"
  | "cash_flow_summary"
  | "tax_summary"
  | "risk_review";

export type ReportLanguage = "en" | "ar";

export type ReportGenerator =
  | "report_writer"
  | "ceo"
  | "sales"
  | "cashflow"
  | "tax"
  | "fraud";

export type GenerateReportInput = {
  report_type: ReportType;
  language: ReportLanguage;
  data_range: "all";
};

export type GeneratedReport = {
  report_type: ReportType;
  generator: ReportGenerator;
  language: ReportLanguage;
  content: string;
  generated_at: string;
  stored: boolean;
};

export type CreateReportPdfInput = {
  report_type: ReportType;
  language: ReportLanguage;
  content: string;
  generated_at: string;
};

export type StoreReportInput = CreateReportPdfInput & {
  generator: ReportGenerator;
};

export type StoredReport = {
  id: string;
  report_type: ReportType;
  generator: ReportGenerator;
  language: ReportLanguage;
  generated_at: string;
  file_name: string;
  created_at: string;
};

export type ReportDownload = {
  url: string;
  file_name: string;
  expires_at: string;
};

export function generateReport(
  input: GenerateReportInput,
) {
  return api.post<GeneratedReport>(
    "/reports/generate",
    input,
  );
}

export function createReportPdf(
  input: CreateReportPdfInput,
) {
  return api.postBlob("/reports/pdf", input);
}

export function storeReport(
  input: StoreReportInput,
) {
  return api.post<StoredReport>("/reports/store", input);
}

export function getStoredReports() {
  return api.get<StoredReport[]>("/reports");
}

export function createStoredReportDownload(
  reportId: string,
) {
  return api.post<ReportDownload>(
    `/reports/${reportId}/download`,
  );
}
