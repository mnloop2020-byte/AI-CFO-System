"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { clearAuthMeCache, getAuthMe } from "@/lib/auth";
import { getSafeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

type MfaMode = "loading" | "enroll" | "verify";

export default function MfaVerificationPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const isArabic = language === "ar";
  const languageRef = useRef(language);
  languageRef.current = language;
  const [mode, setMode] = useState<MfaMode>("loading");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function prepareMfa() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const identity = await getAuthMe();
      const nextPath = getSafeNextPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      if (!identity.mfa_required) {
        router.replace(nextPath);
        return;
      }

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance.currentLevel === "aal2") {
        clearAuthMeCache();
        router.replace(nextPath);
        return;
      }

      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const verifiedFactor = factors.totp.find(
        (factor) => factor.status === "verified",
      );
      if (verifiedFactor) {
        if (active) {
          setFactorId(verifiedFactor.id);
          setMode("verify");
        }
        return;
      }

      for (const staleFactor of factors.totp) {
        await supabase.auth.mfa.unenroll({ factorId: staleFactor.id });
      }
      const { data: enrollment, error: enrollmentError } =
        await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Zemam AI CFO",
        });
      if (enrollmentError) throw enrollmentError;
      if (active) {
        setFactorId(enrollment.id);
        setQrCode(enrollment.totp.qr_code);
        setSecret(enrollment.totp.secret);
        setMode("enroll");
      }
    }

    void prepareMfa().catch(() => {
      if (active) {
        setErrorMessage(
          languageRef.current === "ar"
            ? "تعذر تجهيز المصادقة متعددة العوامل. أعد تسجيل الدخول وحاول مرة أخرى."
            : "Unable to prepare multi-factor authentication. Sign in again and retry.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6 || !factorId) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      if (error) throw error;
      clearAuthMeCache();
      const identity = await getAuthMe();
      if (identity.mfa_required) {
        throw new Error("The session was not promoted to AAL2.");
      }
      const nextPath = getSafeNextPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      router.replace(nextPath);
      router.refresh();
    } catch {
      setErrorMessage(
        isArabic
          ? "رمز التحقق غير صحيح أو انتهت صلاحيته. أدخل الرمز الحالي وحاول مجددًا."
          : "The verification code is invalid or expired. Enter the current code and retry.",
      );
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background p-4 sm:p-6">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-surface shadow-xl">
        <header className="border-b border-border bg-primary-soft px-6 py-7 text-center sm:px-10">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={toggleLanguage}
              className="rounded-xl border border-blue-100 bg-surface px-3 py-2 text-xs font-semibold text-primary"
            >
              {isArabic ? "English" : "العربية"}
            </button>
          </div>
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-white">
            <ShieldCheck size={27} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-text-primary">
            {mode === "enroll"
              ? isArabic
                ? "إعداد المصادقة متعددة العوامل"
                : "Set up multi-factor authentication"
              : isArabic
                ? "تحقق من هويتك"
                : "Verify your identity"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {isArabic
              ? "يجب على المالك والمدير استخدام رمز TOTP قبل الوصول إلى بيانات الشركة."
              : "Owners and admins must verify a TOTP code before accessing company data."}
          </p>
        </header>

        <div className="space-y-5 px-6 py-7 sm:px-10">
          {mode === "loading" && !errorMessage ? (
            <div className="flex items-center justify-center gap-3 py-10 text-text-secondary">
              <LoaderCircle className="animate-spin" size={20} />
              {isArabic ? "جارٍ تجهيز التحقق..." : "Preparing verification..."}
            </div>
          ) : null}

          {mode === "enroll" ? (
            <div className="space-y-4 rounded-2xl border border-blue-100 bg-primary-soft p-4 text-center">
              {qrCode ? (
                // Supabase returns a self-contained data URI for the TOTP QR.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCode}
                  alt={isArabic ? "رمز QR لإعداد TOTP" : "TOTP setup QR code"}
                  className="mx-auto size-48 rounded-xl bg-white p-2"
                />
              ) : null}
              <p className="text-sm text-text-secondary">
                {isArabic
                  ? "امسح الرمز بتطبيق المصادقة، أو أدخل المفتاح يدويًا:"
                  : "Scan with your authenticator app, or enter this key manually:"}
              </p>
              <code
                dir="ltr"
                className="block break-all rounded-lg bg-surface px-3 py-2 text-sm text-text-primary"
              >
                {secret}
              </code>
            </div>
          ) : mode === "verify" ? (
            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-primary-soft p-4">
              <Smartphone className="shrink-0 text-primary" size={20} />
              <p className="text-sm leading-6 text-text-secondary">
                {isArabic
                  ? "افتح تطبيق المصادقة وأدخل الرمز الحالي المكوّن من ستة أرقام."
                  : "Open your authenticator app and enter the current six-digit code."}
              </p>
            </div>
          ) : null}

          {errorMessage ? (
            <div role="alert" className="rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger">
              {errorMessage}
            </div>
          ) : null}

          {mode !== "loading" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                dir="ltr"
                type="text"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                aria-label={isArabic ? "رمز التحقق" : "Verification code"}
                placeholder="000000"
                className="h-14 w-full rounded-xl border border-border bg-surface text-center text-2xl font-semibold tracking-[0.4em] text-text-primary outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft"
              />
              <button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? <LoaderCircle className="animate-spin" size={18} /> : null}
                {isArabic ? "تحقق وادخل" : "Verify and continue"}
              </button>
            </form>
          ) : null}

          <button
            type="button"
            onClick={() =>
              void createClient()
                .auth.signOut()
                .then(() => {
                  clearAuthMeCache();
                  router.replace("/login");
                })
            }
            className="w-full text-center text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            {isArabic ? "إلغاء وتسجيل الخروج" : "Cancel and sign out"}
          </button>
        </div>
      </section>
    </main>
  );
}
