"use client";

import {
  CircleAlert,
  Download,
  FileText,
  LoaderCircle,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { getAuthMe } from "@/lib/auth";
import {
  createAttachmentDownload,
  deleteAttachment,
  getAttachments,
  uploadAttachment,
  type AttachmentRecordType,
  type FinancialAttachment,
} from "@/lib/attachments";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export default function FinancialAttachments({
  recordType,
  recordId,
}: {
  recordType: AttachmentRecordType;
  recordId: string;
}) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [attachments, setAttachments] = useState<FinancialAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAttachments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [storedAttachments, identity] = await Promise.all([
        getAttachments(recordType, recordId),
        getAuthMe(),
      ]);
      setAttachments(storedAttachments);
      setCanWrite(identity.permissions.includes("financial.write"));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر تحميل المرفقات."
            : "Unable to load attachments.",
      );
    } finally {
      setLoading(false);
    }
  }, [isArabic, recordId, recordType]);

  useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) {
      setError(
        isArabic
          ? "اختر ملف PDF أو PNG أو JPG صالحًا بحجم لا يتجاوز 5 ميجابايت."
          : "Choose a valid PDF, PNG, or JPG file no larger than 5 MB.",
      );
      return;
    }
    setUploading(true);
    try {
      const attachment = await uploadAttachment(recordType, recordId, file);
      setAttachments((current) => [attachment, ...current]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر رفع المرفق."
            : "Unable to upload the attachment.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(attachment: FinancialAttachment) {
    setBusyId(attachment.id);
    setError(null);
    try {
      const download = await createAttachmentDownload(attachment.id);
      const anchor = document.createElement("a");
      anchor.href = download.url;
      anchor.download = download.file_name;
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Download failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(attachment: FinancialAttachment) {
    if (!window.confirm(isArabic ? `حذف المرفق ${attachment.original_file_name}؟` : `Delete attachment ${attachment.original_file_name}?`)) return;
    setBusyId(attachment.id);
    setError(null);
    try {
      await deleteAttachment(attachment.id);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip size={18} className="text-primary" />
          <p className="text-sm font-medium text-text-primary">
            {isArabic ? "المرفقات الخاصة" : "Private attachments"}
          </p>
        </div>
        {canWrite ? <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary-soft px-3 py-2 text-xs font-medium text-primary">
          {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
          {isArabic ? "رفع ملف" : "Upload file"}
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            disabled={uploading}
            onChange={(event) => {
              void handleUpload(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
            className="sr-only"
          />
        </label> : null}
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 text-sm text-danger">
          <CircleAlert size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <LoaderCircle size={16} className="animate-spin" />
          {isArabic ? "جارٍ تحميل المرفقات..." : "Loading attachments..."}
        </div>
      ) : null}

      {!loading && attachments.length === 0 ? (
        <p className="text-xs text-text-secondary">
          {isArabic ? "لا توجد مرفقات لهذا السجل." : "No attachments for this record."}
        </p>
      ) : null}

      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText size={17} className="shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{attachment.original_file_name}</p>
              <p className="text-xs text-text-secondary">{(attachment.size_bytes / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => void handleDownload(attachment)} disabled={busyId !== null} aria-label={isArabic ? "تنزيل المرفق" : "Download attachment"} className="flex size-8 items-center justify-center rounded-lg text-text-secondary hover:bg-primary-soft hover:text-primary disabled:opacity-50">
              {busyId === attachment.id ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
            </button>
            {canWrite ? <button type="button" onClick={() => void handleDelete(attachment)} disabled={busyId !== null} aria-label={isArabic ? "حذف المرفق" : "Delete attachment"} className="flex size-8 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-soft hover:text-danger disabled:opacity-50">
              <Trash2 size={15} />
            </button> : null}
          </div>
        </div>
      ))}

      <p className="text-xs leading-5 text-text-secondary">
        {isArabic
          ? "PDF وPNG وJPG فقط، بحد أقصى 5 ميجابايت. تُفحص هوية الملف الفعلية قبل الحفظ."
          : "PDF, PNG, and JPG only, up to 5 MB. The actual file signature is verified before storage."}
      </p>
    </section>
  );
}
