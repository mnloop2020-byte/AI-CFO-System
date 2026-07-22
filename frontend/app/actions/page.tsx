"use client";

import FinancialActionCenter from "@/components/actions/FinancialActionCenter";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function ActionsPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Header
          title={isArabic ? "مركز الإجراءات المالية" : "Financial Action Center"}
          description={isArabic ? "حوّل المؤشرات المالية الموثقة إلى أعمال قابلة للتتبع وبموافقة بشرية." : "Turn verified financial signals into traceable, human-approved work."}
        />
        <main className="p-5 lg:p-8">
          <FinancialActionCenter />
        </main>
      </div>
    </div>
  );
}
