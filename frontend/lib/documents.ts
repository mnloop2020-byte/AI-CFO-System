import { api } from "@/lib/api";

export type DocumentStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "failed";

export type RagDocument = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type UploadDocumentResponse = {
  message: string;
  document: RagDocument;
};

export type DeleteDocumentResponse = {
  deleted: boolean;
  document_id: string;
};

export function getDocuments() {
  return api.get<RagDocument[]>("/rag/documents");
}

export function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<UploadDocumentResponse>(
    "/rag/documents/upload",
    formData,
  );
}

export function deleteDocument(documentId: string) {
  return api.delete<DeleteDocumentResponse>(
    `/rag/documents/${documentId}`,
  );
}
