"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AppLanguage = "en" | "ar";
export type AppDirection = "ltr" | "rtl";

type LanguageContextValue = {
  language: AppLanguage;
  direction: AppDirection;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
};

const LANGUAGE_STORAGE_KEY = "ai-cfo-language";

const translations: Record<
  AppLanguage,
  Record<string, string>
> = {
  en: {
    english: "English",
    arabic: "العربية",
    administrator: "Administrator",

    overview: "Overview",
    dashboard: "Dashboard",
    aiCfoChat: "AI CFO Chat",

    management: "Management",
    customers: "Customers",
    sales: "Sales",
    expenses: "Expenses",
    inventory: "Inventory",
    invoices: "Invoices",

    insights: "Insights",
    reports: "Reports",

    system: "System",
    settings: "Settings",
    profileSecurity: "Profile & Security",

    financialWorkspace: "Financial workspace",
    financialWorkspaceDescription:
      "Your financial data and AI insights in one place.",

    searchFinancialData: "Search financial data...",
    openNotifications: "Open notifications",
    openAccountMenu: "Open account menu",

    chatTitle: "AI CFO Assistant",
    chatConnected: "Connected to live backend",
    chatAnalyzing: "Analyzing financial data",
    chatLiveData: "Live financial data",
    chatNewConversation: "New conversation",
    chatAssistant: "Assistant",
    chatLiveAgentResponse: "Live agent response",
    chatGenerating:
      "The AI CFO is analyzing your financial data...",
    chatErrorTitle:
      "Unable to receive an AI CFO response",
    chatRetry: "Retry",
    chatPlaceholder:
      "Ask your AI CFO about sales, expenses, cash flow...",
    chatSend: "Send message",
    chatFooter:
      "Press Enter to send. Use Shift + Enter for a new line. AI responses should be reviewed before making financial decisions.",

    promptCashFlow: "Analyze cash flow",
    promptInvoices: "Show unpaid invoices",
    promptInventory: "Review low inventory",
    promptReport: "Generate CFO report",

    welcomeMessage:
      "Hello! I am your **AI CFO Assistant**.\n\nAsk me about sales, expenses, invoices, inventory, cash flow, or financial reports.",
  },

  ar: {
    english: "English",
    arabic: "العربية",
    administrator: "مدير النظام",

    overview: "نظرة عامة",
    dashboard: "لوحة التحكم",
    aiCfoChat: "محادثة المدير المالي الذكي",

    management: "الإدارة",
    customers: "العملاء",
    sales: "المبيعات",
    expenses: "المصروفات",
    inventory: "المخزون",
    invoices: "الفواتير",

    insights: "التحليلات",
    reports: "التقارير",

    system: "النظام",
    settings: "الإعدادات",
    profileSecurity: "الملف الشخصي والأمان",

    financialWorkspace: "مساحة العمل المالية",
    financialWorkspaceDescription:
      "بياناتك المالية وتحليلات الذكاء الاصطناعي في مكان واحد.",

    searchFinancialData: "البحث في البيانات المالية...",
    openNotifications: "فتح الإشعارات",
    openAccountMenu: "فتح قائمة الحساب",

    chatTitle: "مساعد المدير المالي الذكي",
    chatConnected: "متصل بالباك إند المباشر",
    chatAnalyzing: "جارٍ تحليل البيانات المالية",
    chatLiveData: "بيانات مالية مباشرة",
    chatNewConversation: "محادثة جديدة",
    chatAssistant: "المساعد",
    chatLiveAgentResponse: "إجابة مباشرة من الوكيل",
    chatGenerating:
      "يقوم المدير المالي الذكي بتحليل بياناتك المالية...",
    chatErrorTitle:
      "تعذر الحصول على إجابة من المدير المالي الذكي",
    chatRetry: "إعادة المحاولة",
    chatPlaceholder:
      "اسأل المدير المالي الذكي عن المبيعات والمصروفات والتدفق النقدي...",
    chatSend: "إرسال الرسالة",
    chatFooter:
      "اضغط Enter للإرسال، واستخدم Shift + Enter لبدء سطر جديد. يجب مراجعة إجابات الذكاء الاصطناعي قبل اتخاذ القرارات المالية.",

    promptCashFlow: "حلل التدفق النقدي",
    promptInvoices: "اعرض الفواتير غير المدفوعة",
    promptInventory: "راجع المخزون المنخفض",
    promptReport: "أنشئ تقرير المدير المالي",

    welcomeMessage:
      "مرحبًا! أنا **مساعد المدير المالي الذكي**.\n\nيمكنك سؤالي عن المبيعات والمصروفات والفواتير والمخزون والتدفق النقدي والتقارير المالية.",
  },
};

const LanguageContext =
  createContext<LanguageContextValue | null>(null);

type LanguageProviderProps = {
  children: ReactNode;
};

export default function LanguageProvider({
  children,
}: LanguageProviderProps) {
  const [language, setLanguageState] =
    useState<AppLanguage>("en");

  const direction: AppDirection =
    language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(
      LANGUAGE_STORAGE_KEY,
    );

    if (
      savedLanguage === "ar" ||
      savedLanguage === "en"
    ) {
      setLanguageState(savedLanguage);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;

    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      language,
    );
  }, [language, direction]);

  function setLanguage(newLanguage: AppLanguage) {
    setLanguageState(newLanguage);
  }

  function toggleLanguage() {
    setLanguageState((currentLanguage) =>
      currentLanguage === "en" ? "ar" : "en",
    );
  }

  function t(key: string) {
    return (
      translations[language][key] ??
      translations.en[key] ??
      key
    );
  }

  const contextValue = useMemo<LanguageContextValue>(
    () => ({
      language,
      direction,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, direction],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider.",
    );
  }

  return context;
}