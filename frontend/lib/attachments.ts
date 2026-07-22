import { api } from "@/lib/api";


export type AttachmentRecordType = "invoice" | "expense";

export type FinancialAttachment = {
  id: string;
  record_type: AttachmentRecordType;
  record_id: string;
  original_file_name: string;
  mime_type: "application/pdf" | "image/png" | "image/jpeg";
  size_bytes: number;
  sha256: string;
  uploaded_by: string;
  created_at: string;
};

export type AttachmentDownload = {
  url: string;
  file_name: string;
  expires_at: string;
};

export function getAttachments(recordType: AttachmentRecordType, recordId: string) {
  return api.get<FinancialAttachment[]>(
    `/attachments/records/${recordType}/${recordId}`,
  );
}

export function uploadAttachment(
  recordType: AttachmentRecordType,
  recordId: string,
  file: File,
) {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<FinancialAttachment>(
    `/attachments/records/${recordType}/${recordId}`,
    formData,
  );
}

export function createAttachmentDownload(attachmentId: string) {
  return api.post<AttachmentDownload>(`/attachments/${attachmentId}/download`);
}

export function deleteAttachment(attachmentId: string) {
  return api.delete<void>(`/attachments/${attachmentId}`);
}
