"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle } from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { validateNewPassword } from "@/lib/profile-validation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    let passwordError: string | null = null;
    try {
      validateNewPassword(password);
    } catch {
      passwordError = isArabic
        ? "استخدم 12 حرفًا على الأقل مع حرف كبير وصغير ورقم ورمز خاص."
        : "Use at least 12 characters with uppercase, lowercase, number, and symbol.";
    }

    if (passwordError || password !== confirmation) {
      setErrorMessage(
        passwordError ??
          (isArabic
            ? "كلمتا المرور غير متطابقتين."
            : "The passwords do not match."),
      );
      setSubmitting(false);
      return;
    }

    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage(
        isArabic
          ? "تعذر تحديث كلمة المرور. قد يكون رابط الاستعادة منتهيًا أو غير صالح."
          : "Unable to update the password. The recovery link may be expired or invalid.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background p-5">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 shadow-xl sm:p-9">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <KeyRound size={26} />
        </div>
        <h1 className="mt-5 text-center text-2xl font-semibold text-text-primary">
          {isArabic ? "اختر كلمة مرور جديدة" : "Choose a new password"}
        </h1>
        <p className="mt-2 text-center text-sm leading-6 text-text-secondary">
          {isArabic
            ? "يجب فتح هذه الصفحة من رابط الاستعادة المحدود الوقت."
            : "This page must be opened from the time-limited recovery link."}
        </p>

        {errorMessage ? (
          <div role="alert" className="mt-5 rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger">
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "كلمة المرور الجديدة" : "New password"}
            </span>
            <input
              type="password"
              name="password"
              minLength={12}
              required
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-border px-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "تأكيد كلمة المرور" : "Confirm password"}
            </span>
            <input
              type="password"
              name="confirmation"
              minLength={12}
              required
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-border px-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? <LoaderCircle size={18} className="animate-spin" /> : null}
            {isArabic ? "حفظ كلمة المرور" : "Save password"}
          </button>
        </form>
      </section>
    </main>
  );
}
