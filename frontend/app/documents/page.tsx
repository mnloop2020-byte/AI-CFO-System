"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileClock,
  FileText,
  LoaderCircle,
  RefreshCw,
  SearchCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  deleteDocument,
  getDocuments,
  uploadDocument,
  type DocumentStatus,
  type RagDocument,
} from "@/lib/documents";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ["pdf", "docx", "txt", "md", "csv"];

function getStatusClasses(status: DocumentStatus) {
  switch (status) {
    case "ready":
      return "bg-success-soft text-success";
    case "failed":
      return "bg-danger-soft text-danger";
    case "processing":
      return "bg-primary-soft text-primary";
    default:
      return "bg-warning-soft text-warning";
  }
}

function formatFileSize(bytes: number, locale: string) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

export default function DocumentsPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const locale = isArabic ? "ar-SA" : "en-US";

  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadDocuments = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await getDocuments();
      setDocuments(response);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر تحميل المستندات."
            : "Unable to load documents.",
      );
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const hasActiveProcessing = documents.some(
    (document) => document.status === "uploaded" || document.status === "processing",
  );

  useEffect(() => {
    if (!hasActiveProcessing) return;
    const timer = window.setInterval(() => {
      void loadDocuments(true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [hasActiveProcessing, loadDocuments]);

  const readyCount = useMemo(
    () => documents.filter((document) => document.status === "ready").length,
    [documents],
  );
  const processingCount = useMemo(
    () => documents.filter((document) => document.status === "uploaded" || document.status === "processing").length,
    [documents],
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setSuccess(null);
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError(isArabic ? "اختر مستندًا أولًا." : "Choose a document first.");
      return;
    }
    const extension = selectedFile.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setError(isArabic ? "النوع غير مدعوم. استخدم PDF أو DOCX أو TXT أو MD أو CSV." : "Unsupported type. Use PDF, DOCX, TXT, MD, or CSV.");
      return;
    }
    if (selectedFile.size === 0 || selectedFile.size > MAX_FILE_SIZE) {
      setError(isArabic ? "يجب ألا يكون الملف فارغًا أو أكبر من 10 MB." : "The file must not be empty or larger than 10 MB.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await uploadDocument(selectedFile);
      setDocuments((current) => [response.document, ...current]);
      setSelectedFile(null);
      const input = document.getElementById("rag-document-file") as HTMLInputElement | null;
      if (input) input.value = "";
      setSuccess(isArabic ? "تم رفع المستند وبدأت معالجته بأمان." : "The document was uploaded and processing has started.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : isArabic ? "تعذر رفع المستند." : "Unable to upload the document.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(documentItem: RagDocument) {
    const confirmed = window.confirm(
      isArabic
        ? `هل تريد حذف ${documentItem.file_name} وجميع المقاطع التابعة له؟`
        : `Delete ${documentItem.file_name} and all of its chunks?`,
    );
    if (!confirmed) return;
    setDeletingId(documentItem.id);
    setError(null);
    setSuccess(null);
    try {
      await deleteDocument(documentItem.id);
      setDocuments((current) => current.filter((item) => item.id !== documentItem.id));
      setSuccess(isArabic ? "تم حذف المستند وجميع المقاطع التابعة له." : "The document and all related chunks were deleted.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : isArabic ? "تعذر حذف المستند." : "Unable to delete the document.");
    } finally {
      setDeletingId(null);
    }
  }

  function statusLabel(status: DocumentStatus) {
    if (!isArabic) return status.charAt(0).toUpperCase() + status.slice(1);
    return {
      uploaded: "تم الرفع",
      processing: "قيد المعالجة",
      ready: "جاهز",
      failed: "فشلت المعالجة",
    }[status];
  }

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Header
          title={isArabic ? "مستندات المعرفة" : "Knowledge documents"}
          description={isArabic ? "ارفع المستندات الخاصة ليستخدمها AI CFO في الإجابات الموثقة." : "Upload private documents for sourced AI CFO answers."}
        />

        <main className="space-y-6 p-5 lg:p-8">
          <section className="rounded-2xl border border-amber-200 bg-warning-soft p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 shrink-0 text-warning" size={21} />
              <div>
                <h2 className="font-semibold text-text-primary">{isArabic ? "مستندات خاصة ومعزولة" : "Private, tenant-isolated documents"}</h2>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  {isArabic
                    ? "الـBucket خاص، وتُشتق شركة المستخدم من الجلسة الموثقة. تمنع سياسات RLS الوصول إلى مستندات أي شركة أخرى."
                    : "The bucket is private and the user’s company is derived from the verified session. RLS policies prevent access to another company’s documents."}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: FileText, label: isArabic ? "إجمالي المستندات" : "Total documents", value: documents.length },
              { icon: SearchCheck, label: isArabic ? "جاهزة للبحث" : "Ready for search", value: readyCount },
              { icon: FileClock, label: isArabic ? "قيد المعالجة" : "Processing", value: processingCount },
            ].map((metric) => {
              const MetricIcon = metric.icon;
              return (
                <div key={metric.label} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                  <MetricIcon className="text-primary" size={20} />
                  <p className="mt-4 text-2xl font-semibold text-text-primary">{new Intl.NumberFormat(locale).format(metric.value)}</p>
                  <p className="mt-1 text-sm text-text-secondary">{metric.label}</p>
                </div>
              );
            })}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><UploadCloud size={21} /></span>
              <div>
                <h2 className="font-semibold text-text-primary">{isArabic ? "رفع مستند خاص" : "Upload a private document"}</h2>
                <p className="text-sm text-text-secondary">PDF, DOCX, TXT, MD, CSV · 10 MB</p>
              </div>
            </div>
            <form onSubmit={handleUpload} className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                id="rag-document-file"
                type="file"
                accept=".pdf,.docx,.txt,.md,.csv"
                onChange={handleFileChange}
                disabled={uploading}
                className="min-w-0 flex-1 rounded-xl border border-dashed border-border bg-surface-soft px-4 py-3 text-sm text-text-secondary file:me-4 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:font-medium file:text-primary"
              />
              <button type="submit" disabled={uploading || !selectedFile} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
                {uploading ? <LoaderCircle className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                {uploading ? (isArabic ? "جارٍ الرفع..." : "Uploading...") : (isArabic ? "رفع ومعالجة" : "Upload and process")}
              </button>
            </form>
          </section>

          {success ? <div role="status" className="flex items-center gap-3 rounded-xl border border-green-100 bg-success-soft px-4 py-3 text-sm text-success"><CheckCircle2 size={18} />{success}</div> : null}
          {error ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><span>{error}</span></div> : null}

          <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <header className="flex items-center justify-between gap-4 border-b border-border p-5">
              <div>
                <h2 className="font-semibold text-text-primary">{isArabic ? "المستندات المرفوعة" : "Uploaded documents"}</h2>
                <p className="mt-1 text-sm text-text-secondary">{isArabic ? "تتحدث حالات المعالجة تلقائيًا." : "Processing statuses refresh automatically."}</p>
              </div>
              <button type="button" onClick={() => void loadDocuments()} aria-label={isArabic ? "تحديث المستندات" : "Refresh documents"} className="flex size-10 items-center justify-center rounded-xl border border-border text-text-secondary hover:bg-surface-soft hover:text-primary"><RefreshCw className={loading ? "animate-spin" : undefined} size={18} /></button>
            </header>

            {loading ? (
              <div className="py-14 text-center"><LoaderCircle className="mx-auto animate-spin text-primary" size={28} /><p className="mt-3 text-sm text-text-secondary">{isArabic ? "جارٍ تحميل المستندات..." : "Loading documents..."}</p></div>
            ) : documents.length === 0 ? (
              <div className="py-14 text-center"><FileText className="mx-auto text-text-secondary" size={30} /><p className="mt-3 font-medium text-text-primary">{isArabic ? "لا توجد مستندات بعد" : "No documents yet"}</p></div>
            ) : (
              <div className="divide-y divide-border">
                {documents.map((documentItem) => (
                  <article key={documentItem.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><FileText size={19} /></span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text-primary">{documentItem.file_name}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {formatFileSize(documentItem.size_bytes, locale)} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(documentItem.created_at))} · {new Intl.NumberFormat(locale).format(documentItem.chunk_count)} {isArabic ? "مقطع" : "chunks"}
                        </p>
                        {documentItem.error_message ? <p className="mt-2 text-xs text-danger">{documentItem.error_message}</p> : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${getStatusClasses(documentItem.status)}`}>{statusLabel(documentItem.status)}</span>
                      <button type="button" onClick={() => void handleDelete(documentItem)} disabled={deletingId !== null} aria-label={isArabic ? `حذف ${documentItem.file_name}` : `Delete ${documentItem.file_name}`} className="flex size-9 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-soft hover:text-danger disabled:opacity-40">
                        {deletingId === documentItem.id ? <LoaderCircle className="animate-spin" size={17} /> : <Trash2 size={17} />}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
