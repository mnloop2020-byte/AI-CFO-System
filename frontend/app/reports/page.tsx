"use client";

import { useCallback, useState } from "react";

import {
  Bot,
  FileDown,
  FileText,
  FolderArchive,
} from "lucide-react";

import DashboardWidget from "@/components/dashboard/DashboardWidget";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";
import ReportHistory from "@/components/reports/ReportHistory";
import ReportTemplates from "@/components/reports/ReportTemplates";

function formatNumber(
  value: number,
  locale: string,
) {
  return new Intl.NumberFormat(locale).format(
    value,
  );
}

export default function ReportsPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const numberLocale = isArabic
    ? "ar-SA"
    : "en-US";
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [storedReportCount, setStoredReportCount] = useState(0);
  const handleReportsLoaded = useCallback((count: number) => {
    setStoredReportCount(count);
  }, []);

  const reportMetrics = [
    {
      title: isArabic
        ? "الوكلاء المتصلون"
        : "Connected Agents",
      value: formatNumber(6, numberLocale),
      description: isArabic
        ? "إنشاء تقارير مباشر من الباك إند"
        : "Live report generation from the backend",
      icon: Bot,
      tone: "green" as const,
    },
    {
      title: isArabic
        ? "قوالب التقارير"
        : "Report Templates",
      value: formatNumber(6, numberLocale),
      description: isArabic
        ? "قوالب مالية وتنفيذية"
        : "Financial and executive templates",
      icon: FileText,
      tone: "blue" as const,
    },
    {
      title: isArabic
        ? "التقارير المؤرشفة"
        : "Archived Reports",
      value: formatNumber(storedReportCount, numberLocale),
      description: isArabic
        ? "تقارير محفوظة في Supabase"
        : "Reports stored in Supabase",
      icon: FolderArchive,
      tone: "amber" as const,
    },
    {
      title: isArabic
        ? "تنزيل PDF"
        : "PDF Download",
      value: formatNumber(6, numberLocale),
      description: isArabic
        ? "متاح لجميع قوالب التقارير"
        : "Available for every report template",
      icon: FileDown,
      tone: "green" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Header
          title={
            isArabic ? "التقارير" : "Reports"
          }
          description={
            isArabic
              ? "أنشئ التحليلات المالية من وكلاء الذكاء الاصطناعي وراجعها."
              : "Generate and review financial analysis from your AI agents."
          }
        />

        <main className="space-y-8 p-5 lg:p-8">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {reportMetrics.map((metric) => (
              <DashboardWidget
                key={metric.title}
                {...metric}
              />
            ))}
          </section>

          <ReportTemplates
            onReportStored={() =>
              setHistoryRefreshKey((current) => current + 1)
            }
          />

          <ReportHistory
            refreshKey={historyRefreshKey}
            onReportsLoaded={handleReportsLoaded}
          />
        </main>
      </div>
    </div>
  );
}
