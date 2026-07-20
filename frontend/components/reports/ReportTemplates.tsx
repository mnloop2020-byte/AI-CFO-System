"use client";

import { type FormEvent, useState } from "react";
import {
  ChartNoAxesCombined,
  CircleAlert,
  Crown,
  Download,
  FileText,
  LoaderCircle,
  ReceiptText,
  Save,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useLanguage } from "@/components/providers/LanguageProvider";
import Modal from "@/components/ui/Modal";
import {
  createReportPdf,
  generateReport,
  storeReport,
  type GeneratedReport,
  type ReportGenerator,
  type ReportType,
} from "@/lib/reports";

const reportTemplates = [
  {
    reportType: "complete_cfo" as const,
    title: {
      en: "Complete CFO Report",
      ar: "تقرير المدير المالي الشامل",
    },
    description: {
      en: "Consolidated sales, inventory, accounting, cash flow, tax, and risk analysis.",
      ar: "تحليل موحّد للمبيعات والمخزون والمحاسبة والتدفق النقدي والضرائب والمخاطر.",
    },
    coverage: {
      en: ["Sales", "Inventory", "Accounting", "Cash flow", "Tax", "Risk"],
      ar: ["المبيعات", "المخزون", "المحاسبة", "التدفق النقدي", "الضرائب", "المخاطر"],
    },
    icon: FileText,
    iconStyle: "bg-primary-soft text-primary",
    recommended: true,
  },
  {
    reportType: "executive_brief" as const,
    title: {
      en: "Executive Brief",
      ar: "الملخص التنفيذي",
    },
    description: {
      en: "Financial priorities, verified risks, and cautious recommended next actions.",
      ar: "الأولويات المالية والمخاطر المتحقق منها والخطوات التالية المقترحة بحذر.",
    },
    coverage: {
      en: ["Financial priorities", "Verified risks", "Recommended actions"],
      ar: ["الأولويات المالية", "المخاطر المتحقق منها", "الإجراءات المقترحة"],
    },
    icon: Crown,
    iconStyle: "bg-warning-soft text-warning",
    recommended: false,
  },
  {
    reportType: "sales_performance" as const,
    title: {
      en: "Sales Performance",
      ar: "أداء المبيعات",
    },
    description: {
      en: "Completed revenue, units sold, sales statuses, and supported product findings.",
      ar: "الإيرادات المكتملة والوحدات المباعة وحالات المبيعات واستنتاجات المنتجات المدعومة.",
    },
    coverage: {
      en: ["Completed revenue", "Units sold", "Sale statuses", "Product findings"],
      ar: ["الإيرادات المكتملة", "الوحدات المباعة", "حالات المبيعات", "استنتاجات المنتجات"],
    },
    icon: ChartNoAxesCombined,
    iconStyle: "bg-success-soft text-success",
    recommended: false,
  },
  {
    reportType: "cash_flow_summary" as const,
    title: {
      en: "Cash Flow Summary",
      ar: "ملخص التدفق النقدي",
    },
    description: {
      en: "Tracked inflows, recorded outflows, net movement, and outstanding receivables.",
      ar: "التدفقات الداخلة والخارجة المسجلة وصافي الحركة والذمم المدينة.",
    },
    coverage: {
      en: ["Tracked inflows", "Recorded outflows", "Net movement", "Receivables"],
      ar: ["التدفقات الداخلة", "التدفقات الخارجة", "صافي الحركة", "الذمم المدينة"],
    },
    icon: Wallet,
    iconStyle: "bg-primary-soft text-primary",
    recommended: false,
  },
  {
    reportType: "tax_summary" as const,
    title: {
      en: "Tax Summary",
      ar: "الملخص الضريبي",
    },
    description: {
      en: "Invoiced VAT grouped by invoice status with data-availability limitations.",
      ar: "ضريبة القيمة المضافة المفوترة حسب حالة الفاتورة، مع قيود توفر البيانات.",
    },
    coverage: {
      en: ["Invoiced VAT", "Invoice statuses", "Tax data limitations"],
      ar: ["ضريبة القيمة المضافة", "حالات الفواتير", "قيود البيانات الضريبية"],
    },
    icon: ReceiptText,
    iconStyle: "bg-warning-soft text-warning",
    recommended: false,
  },
  {
    reportType: "risk_review" as const,
    title: {
      en: "Risk Review",
      ar: "مراجعة المخاطر",
    },
    description: {
      en: "Flagged expenses and duplicate candidates requiring neutral human review.",
      ar: "المصروفات المعلّمة واحتمالات التكرار التي تتطلب مراجعة بشرية محايدة.",
    },
    coverage: {
      en: ["Flagged expenses", "Duplicate candidates", "Human review notes"],
      ar: ["المصروفات المعلّمة", "احتمالات التكرار", "ملاحظات المراجعة البشرية"],
    },
    icon: ShieldCheck,
    iconStyle: "bg-danger-soft text-danger",
    recommended: false,
  },
];

type SelectedReport = (typeof reportTemplates)[number];

type ReportTemplatesProps = {
  onReportStored?: () => void;
};

function getGeneratorLabel(
  generator: ReportGenerator,
  isArabic: boolean,
) {
  const labels: Record<ReportGenerator, { en: string; ar: string }> = {
    report_writer: {
      en: "Report Writer Agent",
      ar: "وكيل كتابة التقارير",
    },
    ceo: {
      en: "CEO Agent",
      ar: "وكيل المدير التنفيذي",
    },
    sales: {
      en: "Sales Agent",
      ar: "وكيل المبيعات",
    },
    cashflow: {
      en: "Cash Flow Agent",
      ar: "وكيل التدفق النقدي",
    },
    tax: {
      en: "Tax Agent",
      ar: "وكيل الضرائب",
    },
    fraud: {
      en: "Fraud Review Agent",
      ar: "وكيل مراجعة الاحتيال",
    },
  };

  return labels[generator][isArabic ? "ar" : "en"];
}

function formatGeneratedAt(
  value: string,
  isArabic: boolean,
) {
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

export default function ReportTemplates({
  onReportStored,
}: ReportTemplatesProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const locale = isArabic ? "ar" : "en";

  const [selectedReport, setSelectedReport] =
    useState<SelectedReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] =
    useState<GeneratedReport | null>(null);
  const [generationError, setGenerationError] =
    useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  const openReport = (report: SelectedReport) => {
    setSelectedReport(report);
    setGeneratedReport(null);
    setGenerationError(null);
    setPdfError(null);
    setStorageError(null);
  };

  const closeReport = () => {
    if (isGenerating || isDownloadingPdf || isSavingReport) return;

    setSelectedReport(null);
    setGeneratedReport(null);
    setGenerationError(null);
    setPdfError(null);
    setStorageError(null);
  };

  const handleStoreReport = async () => {
    if (!generatedReport || generatedReport.stored) return;

    setIsSavingReport(true);
    setStorageError(null);

    try {
      await storeReport({
        report_type: generatedReport.report_type,
        generator: generatedReport.generator,
        language: generatedReport.language,
        content: generatedReport.content,
        generated_at: generatedReport.generated_at,
      });

      setGeneratedReport((currentReport) =>
        currentReport
          ? { ...currentReport, stored: true }
          : currentReport,
      );
      onReportStored?.();
    } catch (requestError) {
      setStorageError(
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر حفظ التقرير."
            : "Unable to store the report.",
      );
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!generatedReport) return;

    setIsDownloadingPdf(true);
    setPdfError(null);

    try {
      const pdfBlob = await createReportPdf({
        report_type: generatedReport.report_type,
        language: generatedReport.language,
        content: generatedReport.content,
        generated_at: generatedReport.generated_at,
      });
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const anchor = document.createElement("a");
      const timestamp = generatedReport.generated_at
        .replace(/[:.]/g, "-")
        .replace("T", "-")
        .replace("Z", "");

      anchor.href = downloadUrl;
      anchor.download = `ai-cfo-${generatedReport.report_type}-${timestamp}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (requestError) {
      setPdfError(
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر إنشاء ملف PDF."
            : "Unable to create the PDF file.",
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleGenerate = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!selectedReport) return;

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const response = await generateReport({
        report_type: selectedReport.reportType as ReportType,
        language,
        data_range: "all",
      });

      setGeneratedReport(response);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر إنشاء التقرير."
            : "Unable to generate the report.";

      setGenerationError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <section>
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-text-primary">
            {isArabic ? "قوالب التقارير" : "Report templates"}
          </h2>

          <p className="mt-1 text-sm text-text-secondary">
            {isArabic
              ? "اختر تحليلًا ماليًا لإنشائه من بيانات الشركة الحقيقية عبر وكيل متخصص."
              : "Choose a financial analysis to generate from live company data through a specialized agent."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {reportTemplates.map((report) => {
            const Icon = report.icon;

            return (
              <article
                key={report.reportType}
                className="flex min-h-64 flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`flex size-11 items-center justify-center rounded-xl ${report.iconStyle}`}
                  >
                    <Icon size={21} strokeWidth={1.8} />
                  </span>

                  {report.recommended ? (
                    <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
                      {isArabic ? "موصى به" : "Recommended"}
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-5 text-base font-semibold text-text-primary">
                  {report.title[locale]}
                </h3>

                <p className="mt-2 flex-1 text-sm leading-6 text-text-secondary">
                  {report.description[locale]}
                </p>

                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-text-secondary">
                      {isArabic ? "مصدر البيانات" : "Data source"}
                    </span>

                    <span className="text-xs font-medium text-success">
                      {isArabic ? "الباك إند المباشر" : "Live backend"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openReport(report)}
                    className="w-full rounded-xl border border-primary bg-primary-soft px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
                  >
                    {isArabic ? "إنشاء التقرير" : "Generate report"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-4 text-xs leading-5 text-text-secondary">
          {isArabic
            ? "إنشاء النص وملف PDF والحفظ في سجل Supabase الخاص متصلة بالباك إند الحقيقي."
            : "Text generation, PDF creation, and private Supabase report history are connected to the live backend."}
        </p>
      </section>

      <Modal
        open={selectedReport !== null}
        title={
          selectedReport?.title[locale] ??
          (isArabic ? "إنشاء التقرير" : "Generate report")
        }
        description={
          isArabic
            ? "سيستخدم الباك إند البيانات المتحقق منها المتاحة للوكيل المختص."
            : "The backend will use verified data available to the selected specialist agent."
        }
        onClose={closeReport}
      >
        {selectedReport && !generatedReport ? (
          <form onSubmit={handleGenerate} className="space-y-6">
            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-primary-soft p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary">
                <Sparkles size={20} />
              </div>

              <div>
                <p className="text-sm font-medium text-text-primary">
                  {isArabic ? "إنشاء مباشر من الوكيل" : "Live agent generation"}
                </p>

                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  {isArabic
                    ? "قد يستغرق إنشاء التقرير عدة ثوانٍ حسب استجابة نموذج الذكاء الاصطناعي."
                    : "Generating the report may take several seconds depending on the AI model response."}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-text-primary">
                {isArabic ? "التحليلات المشمولة" : "Included analysis"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {selectedReport.coverage[locale].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-border bg-surface-soft px-3 py-1.5 text-xs text-text-secondary"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-text-primary">
                  {isArabic ? "نطاق البيانات" : "Data range"}
                </span>

                <select
                  value="all"
                  disabled
                  className="h-11 w-full cursor-not-allowed rounded-xl border border-border bg-surface-soft px-3.5 text-sm text-text-secondary"
                >
                  <option value="all">
                    {isArabic ? "كل البيانات المتاحة" : "All available data"}
                  </option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-text-primary">
                  {isArabic ? "صيغة الإخراج" : "Output format"}
                </span>

                <select
                  value="text"
                  disabled
                  className="h-11 w-full cursor-not-allowed rounded-xl border border-border bg-surface-soft px-3.5 text-sm text-text-secondary"
                >
                  <option value="text">
                    {isArabic ? "تقرير نصي مع تنزيل PDF" : "Text report with PDF download"}
                  </option>
                </select>
              </label>
            </div>

            {generationError ? (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger"
              >
                <CircleAlert size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">
                    {isArabic ? "تعذر إنشاء التقرير" : "Report generation failed"}
                  </p>
                  <p className="mt-1 text-xs">{generationError}</p>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-amber-100 bg-warning-soft px-4 py-3 text-sm leading-6 text-text-secondary">
              {isArabic
                ? "يجب مراجعة التقرير قبل اتخاذ قرارات مالية أو ضريبية أو متعلقة بالاحتيال."
                : "The report must be reviewed before making financial, tax, or fraud-related decisions."}
            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeReport}
                disabled={isGenerating}
                className="h-11 rounded-xl border border-border px-5 text-sm font-medium text-text-primary hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isArabic ? "إلغاء" : "Cancel"}
              </button>

              <button
                type="submit"
                disabled={isGenerating}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"
              >
                {isGenerating ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    {isArabic ? "جارٍ إنشاء التقرير..." : "Generating report..."}
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    {isArabic ? "إنشاء الآن" : "Generate now"}
                  </>
                )}
              </button>
            </footer>
          </form>
        ) : null}

        {selectedReport && generatedReport ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-100 bg-success-soft px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {isArabic ? "تم إنشاء التقرير" : "Report generated"}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {formatGeneratedAt(generatedReport.generated_at, isArabic)}
                </p>
              </div>

              <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-success">
                {getGeneratorLabel(generatedReport.generator, isArabic)}
              </span>
            </div>

            <div
              dir={isArabic ? "rtl" : "ltr"}
              className="max-h-[52vh] overflow-y-auto rounded-xl border border-border bg-surface-soft p-5 text-sm leading-7 text-text-primary [&_h1]:mb-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-3 [&_strong]:font-semibold [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-surface [&_th]:p-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-5"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {generatedReport.content}
              </ReactMarkdown>
            </div>

            <div className="rounded-xl border border-blue-100 bg-primary-soft px-4 py-3 text-sm leading-6 text-text-secondary">
              {generatedReport.stored
                ? isArabic
                  ? "تم حفظ التقرير وملف PDF بأمان في Supabase، وأضيف إلى سجل التقارير."
                  : "The report and its PDF are stored securely in Supabase and now appear in report history."
                : isArabic
                  ? "يمكنك تنزيل PDF مباشرة أو حفظ التقرير وملفه في سجل Supabase الخاص."
                  : "You can download the PDF directly or store the report and its file in the private Supabase history."}
            </div>

            {pdfError ? (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger"
              >
                <CircleAlert size={18} className="mt-0.5 shrink-0" />
                <p>{pdfError}</p>
              </div>
            ) : null}

            {storageError ? (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger"
              >
                <CircleAlert size={18} className="mt-0.5 shrink-0" />
                <p>{storageError}</p>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeReport}
                disabled={isDownloadingPdf || isSavingReport}
                className="h-11 rounded-xl border border-border px-5 text-sm font-medium text-text-primary hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isArabic ? "إغلاق التقرير" : "Close report"}
              </button>

              <button
                type="button"
                onClick={() => void handleStoreReport()}
                disabled={
                  isSavingReport ||
                  isDownloadingPdf ||
                  generatedReport.stored
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-primary-soft px-5 text-sm font-semibold text-primary hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingReport ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}

                {generatedReport.stored
                  ? isArabic
                    ? "تم الحفظ"
                    : "Stored"
                  : isSavingReport
                    ? isArabic
                      ? "جارٍ الحفظ..."
                      : "Storing..."
                    : isArabic
                      ? "حفظ في السجل"
                      : "Store in history"}
              </button>

              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={isDownloadingPdf || isSavingReport}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"
              >
                {isDownloadingPdf ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}

                {isDownloadingPdf
                  ? isArabic
                    ? "جارٍ تجهيز PDF..."
                    : "Preparing PDF..."
                  : isArabic
                    ? "تنزيل PDF"
                    : "Download PDF"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
