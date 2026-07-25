import { api } from "@/lib/api";


export type InvoiceNotificationType =
  | "invoice_generated"
  | "invoice_emailed"
  | "invoice_email_failed"
  | "invoice_overdue"
  | "invoice_paid";

export type InvoiceNotification = {
  id: string;
  invoice_id: string;
  event_type: InvoiceNotificationType;
  data: {
    invoice_number?: unknown;
  };
  created_at: string;
};

export function getNotifications() {
  return api.get<InvoiceNotification[]>("/notifications");
}
