"use client";

import ChatWindow from "@/components/chat/ChatWindow";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function ChatPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Header
          title={
            isArabic
              ? "محادثة المدير المالي الذكي"
              : "AI CFO Chat"
          }
          description={
            isArabic
              ? "اطرح أسئلتك واحصل على تحليل مالي من وكلاء الذكاء الاصطناعي المتخصصين."
              : "Ask questions and receive financial analysis from your specialized AI agents."
          }
        />

        <main className="p-5 lg:p-8">
          <ChatWindow />
        </main>
      </div>
    </div>
  );
}
