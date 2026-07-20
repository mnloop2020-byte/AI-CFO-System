"use client";

import { CircleAlert } from "lucide-react";

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
          title={
            isArabic
              ? "إعدادات الشركة"
              : "Company Settings"
          }
          description={
            isArabic
              ? "اضبط معلومات الشركة والعملة والضرائب والأرصدة الافتتاحية."
              : "Configure company information, currency, tax, and opening balances."
          }
        />

        <main className="p-5 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <section className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-warning-soft p-5 sm:flex-row sm:items-start">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-warning">
                <CircleAlert size={21} />
              </div>

              <div>
                <h2 className="font-semibold text-text-primary">
                  {isArabic
                    ? "الإعداد المالي غير مكتمل"
                    : "Financial configuration is incomplete"}
                </h2>

                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  {isArabic
                    ? "لم يتم إعداد العملة والاختصاص الضريبي والرصيد البنكي حاليًا. ستُحفظ هذه الإعدادات بعد ربط الواجهة الأمامية بالباك إند."
                    : "Currency, tax jurisdiction, and bank balance are not currently configured. These settings will be stored after the frontend is connected to the backend."}
                </p>
              </div>
            </section>

            <CompanySettingsForm />
          </div>
        </main>
      </div>
    </div>
  );
}
