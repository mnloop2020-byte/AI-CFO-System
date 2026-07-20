import type { Metadata } from "next";
import {
  Inter,
  Noto_Sans_Arabic,
} from "next/font/google";
import type { ReactNode } from "react";

import LanguageProvider from "@/components/providers/LanguageProvider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zemam AI CFO",
  description:
    "AI-powered financial management workspace for companies.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
    >
      <body
        className={`${inter.variable} ${notoSansArabic.variable}`}
      >
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}