"use client";

import CustomersTable from "@/components/crm/CustomersTable";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function CustomersPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Header
          title={isArabic ? "العملاء" : "Customers"}
          description={
            isArabic
              ? "أدر سجلات العملاء وبيانات التواصل ونشاط الشراء."
              : "Manage customer records, contact details, and purchase activity."
          }
        />

        <main className="p-5 lg:p-8">
          <CustomersTable />
        </main>
      </div>
    </div>
  );
}
