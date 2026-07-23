import { api } from "@/lib/api";

export type Invoice = {
  id: string;
  customer_id: string | null;
  invoice_number: string;
  total_amount: number;
  vat_amount: number;
  status: string;
  due_date: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateInvoiceInput = {
  customer_id?: string | null;
  invoice_number: string;
  total_amount: number;
  vat_amount: number;
  status: string;
  due_date?: string | null;
};
// the information which is used for sending the invoice to the customer, but not stored in the database

export type UpdateInvoiceInput =
  Partial<CreateInvoiceInput>;

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
