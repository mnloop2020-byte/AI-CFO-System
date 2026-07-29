"use client";

import {
  CircleAlert,
  Download,
  FileClock,
  FileText,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  createStoredReportDownload,
  getStoredReports,
  type ReportType,
  type StoredReport,
} from "@/lib/reports";

type ReportHistoryProps = {
  refreshKey?: number;
  onReportsLoaded?: (count: number) => void;
};

const reportLabels: Record<
  ReportType,
  { en: string; ar: string }
> = {
  complete_cfo: {
    en: "Complete CFO Report",
    ar: "تقرير المدير المالي الشامل",
  },
  executive_brief: {
    en: "Executive Brief",
    ar: "الملخص التنفيذي",
  },
  sales_performance: {
    en: "Sales Performance",
    ar: "أداء المبيعات",
  },
  cash_flow_summary: {
    en: "Cash Flow Summary",
    ar: "ملخص التدفق النقدي",
  },
  tax_summary: {
    en: "Tax Summary",
    ar: "الملخص الضريبي",
  },
  risk_review: {
    en: "Risk Review",
    ar: "مراجعة المخاطر",
  },
};

function formatDate(value: string, isArabic: boolean) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    isArabic ? "ar-SA" : "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

export default function ReportHistory({
  refreshKey = 0,
  onReportsLoaded,
}: ReportHistoryProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const storedReports = await getStoredReports();
      setReports(storedReports);
      onReportsLoaded?.(storedReports.length);
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر تحميل سجل التقارير."
            : "Unable to load report history.",
      );
    } finally {
      setLoading(false);
    }
  }, [isArabic, onReportsLoaded]);

  useEffect(() => {
    void loadReports();
  }, [loadReports, refreshKey]);

  const handleDownload = async (report: StoredReport) => {
    setDownloadingId(report.id);
    setDownloadError(null);

    try {
      const download = await createStoredReportDownload(report.id);
      const anchor = document.createElement("a");
      anchor.href = download.url;
      anchor.download = download.file_name;
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (requestError) {
      setDownloadError(
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر تنزيل التقرير المحفوظ."
            : "Unable to download the stored report.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">
              {isArabic ? "سجل التقارير" : "Report history"}
            </h2>

            <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
              {isArabic ? "تخزين خاص" : "Private storage"}
            </span>
          </div>

          <p className="mt-1 text-sm text-text-secondary">
            {isArabic
              ? "التقارير المحفوظة وملفات PDF الخاصة بها في Supabase."
              : "Stored reports and their private PDF files in Supabase."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadReports()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-text-primary hover:bg-surface-soft disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : undefined} />
          {isArabic ? "تحديث" : "Refresh"}
        </button>
      </div>

      {loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-danger-soft px-5 py-4 text-sm text-danger">
          <div className="flex items-start gap-3">
            <CircleAlert size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">
                {isArabic
                  ? "تعذر تحميل سجل التقارير"
                  : "Unable to load report history"}
              </p>
              <p className="mt-1 text-xs">{loadError}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadReports()}
            className="rounded-lg border border-danger px-3 py-1.5 font-medium"
          >
            {isArabic ? "إعادة المحاولة" : "Try again"}
          </button>
        </div>
      ) : null}

      {downloadError ? (
        <div className="flex items-start gap-3 border-b border-red-100 bg-danger-soft px-5 py-3 text-sm text-danger">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <p>{downloadError}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <LoaderCircle size={30} className="animate-spin text-primary" />
          <p className="mt-3 text-sm text-text-secondary">
            {isArabic
              ? "جارٍ تحميل التقارير المحفوظة..."
              : "Loading stored reports..."}
          </p>
        </div>
      ) : null}

      {!loading && !loadError && reports.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <FileClock size={25} />
          </div>

          <h3 className="mt-4 font-semibold text-text-primary">
            {isArabic ? "لا توجد تقارير محفوظة" : "No stored reports"}
          </h3>

          <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
            {isArabic
              ? "أنشئ تقريرًا من القوالب أعلاه، ثم اختر حفظ في السجل لإضافة التقرير وملف PDF الخاص به هنا."
              : "Generate a report from the templates above, then choose Store in history to add the report and its PDF here."}
          </p>
        </div>
      ) : null}

      {!loading && reports.length > 0 ? (
        <div className="divide-y divide-border">
          {reports.map((report) => (
            <article
              key={report.id}
              className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <FileText size={20} />
                </span>

                <div className="min-w-0">
                  <p className="font-medium text-text-primary">
                    {reportLabels[report.report_type][isArabic ? "ar" : "en"]}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {formatDate(report.generated_at, isArabic)}
                  </p>
                  <p
                    dir="ltr"
                    className="mt-1 truncate text-xs text-text-secondary"
                  >
                    {report.file_name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleDownload(report)}
                disabled={downloadingId !== null}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-primary bg-primary-soft px-4 text-sm font-medium text-primary hover:bg-primary hover:text-white disabled:cursor-wait disabled:opacity-60"
              >
                {downloadingId === report.id ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                {isArabic ? "تنزيل PDF" : "Download PDF"}
              </button>
            </article>
          ))}
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center gap-3 border-t border-border bg-app-background px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
          <ShieldCheck size={17} />
        </span>

        <div>
          <p className="text-sm font-medium text-text-primary">
            {isArabic
              ? "روابط التنزيل مؤقتة"
              : "Downloads use temporary links"}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {isArabic
              ? "يبقى Bucket التقارير خاصًا، ويُصدر الباك إند رابطًا موقّعًا قصير المدة عند كل تنزيل."
              : "The reports bucket remains private, and the backend issues a short-lived signed URL for each download."}
          </p>
        </div>
      </footer>
    </section>
  );
}
