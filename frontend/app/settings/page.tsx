"use client";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";
import CompanySettingsForm from "@/components/settings/CompanySettingsForm";

export default function SettingsPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Header
          title={isArabic ? "إعدادات الشركة" : "Company Settings"}
          description={
            isArabic
              ? "إدارة معلومات الشركة وإعداداتها المالية الحقيقية."
              : "Manage real company information and financial configuration."
          }
        />
        <main className="p-5 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <CompanySettingsForm />
          </div>
        </main>
      </div>
    </div>
  );
}
