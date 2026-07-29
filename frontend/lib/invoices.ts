import { api } from "@/lib/api";
import type { MoneyString } from "@/lib/money";

export type Invoice = {
  id: string;
  customer_id: string | null;
  invoice_number: string;
  total_amount: MoneyString;
  vat_amount: MoneyString;
  status: string;
  due_date: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateInvoiceInput = {
  customer_id?: string | null;
  invoice_number: string;
  total_amount: MoneyString;
  vat_amount: MoneyString;
  status: string;
  due_date?: string | null;
};
// the information which is used for sending the invoice to the customer, but not stored in the database

export type UpdateInvoiceInput =
  Partial<CreateInvoiceInput>;

export type InvoicePdfDownload = {
  url: string;
  file_name: string;
  expires_at: string;
  generated: boolean;
};

export type InvoiceEmailResult = {
  status: "sent";
  message: string;
};

export function getInvoices() {
  return api.get<Invoice[]>("/invoices");
}

export function createInvoice(
  data: CreateInvoiceInput,
) {
  return api.post<Invoice>("/invoices", data);
}

export function updateInvoice(
  invoiceId: string,
  data: UpdateInvoiceInput,
) {
  return api.patch<Invoice>(
    `/invoices/${invoiceId}`,
    data,
  );
}

export function deleteInvoice(invoiceId: string) {
  return api.delete<void>(
    `/invoices/${invoiceId}`,
  );
}

export function createInvoicePdfDownload(
  invoiceId: string,
  language: "en" | "ar",
) {
  return api.post<InvoicePdfDownload>(
    `/invoices/${invoiceId}/pdf/download`,
    { language },
  );
}

export function sendInvoiceEmail(
  invoiceId: string,
  language: "en" | "ar",
) {
  return api.post<InvoiceEmailResult>(
    `/invoices/${invoiceId}/email`,
    { language },
  );
}
