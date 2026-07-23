"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleAlert,
  Image as ImageIcon,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MonitorSmartphone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { getAuthMe, type AuthMe } from "@/lib/auth";
import {
  normalizeAvatarUrl,
  normalizeProfileName,
  validateNewPassword,
  type PasswordValidationCode,
} from "@/lib/profile-validation";
import { createClient } from "@/lib/supabase/client";

const inputClasses =
  "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-text-secondary";

type Feedback = {
  tone: "success" | "error";
  message: string;
} | null;

const passwordMessages: Record<
  PasswordValidationCode,
  { en: string; ar: string }
> = {
  too_short: {
    en: "Use at least 12 characters.",
    ar: "استخدم 12 حرفًا على الأقل.",
  },
  missing_uppercase: {
    en: "Add at least one uppercase letter.",
    ar: "أضف حرفًا إنجليزيًا كبيرًا واحدًا على الأقل.",
  },
  missing_lowercase: {
    en: "Add at least one lowercase letter.",
    ar: "أضف حرفًا إنجليزيًا صغيرًا واحدًا على الأقل.",
  },
  missing_number: {
    en: "Add at least one number.",
    ar: "أضف رقمًا واحدًا على الأقل.",
  },
  missing_symbol: {
    en: "Add at least one special character.",
    ar: "أضف رمزًا خاصًا واحدًا على الأقل.",
  },
};

export default function ProfilePage() {
  const { language, setLanguage } = useLanguage();
  const isArabic = language === "ar";
  const [identity, setIdentity] = useState<AuthMe | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setProfileFeedback(null);
      try {
        const supabase = createClient();
        const [authIdentity, userResponse] = await Promise.all([
          getAuthMe(),
          supabase.auth.getUser(),
        ]);
        if (userResponse.error) {
          throw userResponse.error;
        }
        if (!active) return;

        const metadata = userResponse.data.user?.user_metadata ?? {};
        const metadataName = metadata.full_name;
        const metadataPhone = metadata.phone;
        const metadataAvatar = metadata.avatar_url;
        setIdentity(authIdentity);
        setFullName(
          typeof metadataName === "string" && metadataName.trim()
            ? metadataName.trim()
            : authIdentity.email.split("@")[0],
        );
        setPhone(typeof metadataPhone === "string" ? metadataPhone : "");
        setAvatarUrl(
          typeof metadataAvatar === "string" ? metadataAvatar : "",
        );
      } catch (error) {
        if (!active) return;
        setProfileFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : isArabic
                ? "تعذر تحميل الملف الشخصي."
                : "Unable to load the profile.",
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [isArabic]);

  const roleLabel = identity
    ? isArabic
      ? {
          owner: "المالك",
          admin: "المدير",
          accountant: "المحاسب",
          viewer: "المشاهد",
        }[identity.role]
      : identity.role
    : isArabic
      ? "جارٍ التحميل"
      : "Loading";

  const displayedAvatarUrl = useMemo(() => {
    try {
      return normalizeAvatarUrl(avatarUrl);
    } catch {
      return null;
    }
  }, [avatarUrl]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileFeedback(null);

    let normalizedName: string;
    let normalizedAvatar: string | null;
    try {
      normalizedName = normalizeProfileName(fullName);
      normalizedAvatar = normalizeAvatarUrl(avatarUrl);
    } catch {
      setProfileFeedback({
        tone: "error",
        message: isArabic
          ? "تحقق من الاسم ورابط الصورة. يجب أن تكون الصورة عبر HTTPS."
          : "Check the name and avatar URL. The avatar must use HTTPS.",
      });
      return;
    }

    setProfileSaving(true);
    const { data, error } = await createClient().auth.updateUser({
      data: {
        full_name: normalizedName,
        avatar_url: normalizedAvatar,
        phone: phone.trim() || null,
        preferred_language: language,
      },
    });
    setProfileSaving(false);

    if (error || !data.user) {
      setProfileFeedback({
        tone: "error",
        message:
          error?.message ??
          (isArabic
            ? "تعذر حفظ الملف الشخصي."
            : "Unable to save the profile."),
      });
      return;
    }

    setFullName(normalizedName);
    setAvatarUrl(normalizedAvatar ?? "");
    window.dispatchEvent(
      new CustomEvent("profile-updated", {
        detail: {
          fullName: normalizedName,
          avatarUrl: normalizedAvatar,
        },
      }),
    );
    setProfileFeedback({
      tone: "success",
      message: isArabic
        ? "تم حفظ الاسم والصورة ومعلومات الملف في Supabase Auth."
        : "Name, avatar, and profile details were saved to Supabase Auth.",
    });
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordFeedback(null);

    const validationCode = validateNewPassword(newPassword);
    if (validationCode) {
      setPasswordFeedback({
        tone: "error",
        message: passwordMessages[validationCode][language],
      });
      return;
    }
    if (newPassword !== passwordConfirmation) {
      setPasswordFeedback({
        tone: "error",
        message: isArabic
          ? "كلمتا المرور غير متطابقتين."
          : "The passwords do not match.",
      });
      return;
    }

    setPasswordSaving(true);
    const { error } = await createClient().auth.updateUser({
      password: newPassword,
    });
    setPasswordSaving(false);

    if (error) {
      setPasswordFeedback({
        tone: "error",
        message: error.message,
      });
      return;
    }

    setNewPassword("");
    setPasswordConfirmation("");
    setPasswordFeedback({
      tone: "success",
      message: isArabic
        ? "تم تغيير كلمة المرور بنجاح."
        : "Password changed successfully.",
    });
  }

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Header
          title={isArabic ? "الملف الشخصي والأمان" : "Profile & Security"}
          description={
            isArabic
              ? "أدر معلوماتك الشخصية ومستوى الوصول وأمان الحساب."
              : "Manage your personal information, access level, and account security."
          }
        />

        <main className="p-5 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-xl font-semibold text-primary">
                  {displayedAvatarUrl ? (
                    // User metadata is restricted to an HTTPS URL before rendering.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayedAvatarUrl}
                      alt={isArabic ? "صورة الملف الشخصي" : "Profile avatar"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (fullName || identity?.email || "U")
                      .slice(0, 1)
                      .toUpperCase()
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold text-text-primary">
                      {fullName || (isArabic ? "المستخدم" : "User")}
                    </h1>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                      <BadgeCheck size={14} />
                      {isArabic ? "نشط" : "Active"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">{roleLabel}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
                    <Mail size={14} />
                    {identity?.email ??
                      (isArabic ? "جارٍ التحميل..." : "Loading...")}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-primary-soft px-4 py-3 text-sm text-text-secondary">
                {identity?.company_name ??
                  (isArabic ? "شركة التطوير" : "Development Company")}
              </div>
            </section>

            {profileFeedback ? (
              <FeedbackBanner feedback={profileFeedback} />
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <div className="space-y-6">
                <form
                  onSubmit={handleProfileSubmit}
                  className="rounded-2xl border border-border bg-surface shadow-sm"
                >
                  <header className="flex items-start gap-3 border-b border-border p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <UserRound size={21} />
                    </div>
                    <div>
                      <h2 className="font-semibold text-text-primary">
                        {isArabic
                          ? "المعلومات الشخصية"
                          : "Personal information"}
                      </h2>
                      <p className="mt-1 text-sm text-text-secondary">
                        {isArabic
                          ? "المعلومات المحفوظة في حساب المستخدم الحقيقي."
                          : "Information stored in the real authenticated user account."}
                      </p>
                    </div>
                  </header>

                  <div className="grid gap-5 p-5 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-text-primary">
                        {isArabic ? "الاسم الكامل" : "Full name"}
                      </span>
                      <input
                        type="text"
                        name="fullName"
                        required
                        maxLength={120}
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        disabled={loading || profileSaving}
                        className={inputClasses}
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-text-primary">
                        {isArabic ? "المسمى الوظيفي" : "Job title"}
                      </span>
                      <input
                        type="text"
                        name="jobTitle"
                        value={roleLabel}
                        readOnly
                        className={inputClasses}
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-text-primary">
                        {isArabic ? "البريد الإلكتروني" : "Email address"}
                      </span>
                      <input
                        type="email"
                        name="email"
                        dir="ltr"
                        value={identity?.email ?? ""}
                        readOnly
                        className={inputClasses}
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-text-primary">
                        {isArabic ? "رقم الهاتف" : "Phone number"}
                      </span>
                      <input
                        type="tel"
                        name="phone"
                        dir="ltr"
                        maxLength={40}
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        disabled={loading || profileSaving}
                        placeholder="+90 555 000 0000"
                        className={inputClasses}
                      />
                    </label>

                    <label className="space-y-2 sm:col-span-2">
                      <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                        <ImageIcon size={16} />
                        {isArabic ? "رابط الصورة" : "Avatar URL"}
                      </span>
                      <input
                        type="url"
                        name="avatarUrl"
                        dir="ltr"
                        value={avatarUrl}
                        onChange={(event) => setAvatarUrl(event.target.value)}
                        disabled={loading || profileSaving}
                        placeholder="https://example.com/avatar.png"
                        className={inputClasses}
                      />
                      <span className="block text-xs text-text-secondary">
                        {isArabic
                          ? "اختياري. يُقبل رابط HTTPS فقط."
                          : "Optional. Only HTTPS image URLs are accepted."}
                      </span>
                    </label>

                    <label className="space-y-2 sm:col-span-2">
                      <span className="text-sm font-medium text-text-primary">
                        {isArabic ? "اللغة المفضلة" : "Preferred language"}
                      </span>
                      <select
                        name="language"
                        value={language}
                        onChange={(event) =>
                          setLanguage(event.target.value === "ar" ? "ar" : "en")
                        }
                        disabled={loading || profileSaving}
                        className={inputClasses}
                      >
                        <option value="en">English</option>
                        <option value="ar">العربية</option>
                      </select>
                    </label>
                  </div>

                  <footer className="flex justify-end border-t border-border p-5">
                    <button
                      type="submit"
                      disabled={loading || profileSaving}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                    >
                      {profileSaving ? (
                        <LoaderCircle size={18} className="animate-spin" />
                      ) : (
                        <Save size={18} />
                      )}
                      {profileSaving
                        ? isArabic
                          ? "جارٍ الحفظ..."
                          : "Saving..."
                        : isArabic
                          ? "حفظ الملف الشخصي"
                          : "Save profile"}
                    </button>
                  </footer>
                </form>

                <form
                  onSubmit={handlePasswordSubmit}
                  className="rounded-2xl border border-border bg-surface shadow-sm"
                >
                  <header className="flex items-start gap-3 border-b border-border p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
                      <LockKeyhole size={21} />
                    </div>
                    <div>
                      <h2 className="font-semibold text-text-primary">
                        {isArabic ? "تغيير كلمة المرور" : "Change password"}
                      </h2>
                      <p className="mt-1 text-sm text-text-secondary">
                        {isArabic
                          ? "يتم التغيير مباشرة عبر Supabase Auth."
                          : "The password is changed directly through Supabase Auth."}
                      </p>
                    </div>
                  </header>

                  <div className="grid gap-5 p-5 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-text-primary">
                        {isArabic ? "كلمة المرور الجديدة" : "New password"}
                      </span>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        autoComplete="new-password"
                        disabled={passwordSaving}
                        className={inputClasses}
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-text-primary">
                        {isArabic ? "تأكيد كلمة المرور" : "Confirm password"}
                      </span>
                      <input
                        type="password"
                        value={passwordConfirmation}
                        onChange={(event) =>
                          setPasswordConfirmation(event.target.value)
                        }
                        autoComplete="new-password"
                        disabled={passwordSaving}
                        className={inputClasses}
                      />
                    </label>
                    <p className="text-xs leading-5 text-text-secondary sm:col-span-2">
                      {isArabic
                        ? "12 حرفًا على الأقل، مع حرف كبير وصغير ورقم ورمز خاص."
                        : "Use at least 12 characters with uppercase, lowercase, a number, and a symbol."}
                    </p>
                    {passwordFeedback ? (
                      <div className="sm:col-span-2">
                        <FeedbackBanner feedback={passwordFeedback} />
                      </div>
                    ) : null}
                  </div>

                  <footer className="flex justify-end border-t border-border p-5">
                    <button
                      type="submit"
                      disabled={
                        passwordSaving ||
                        !newPassword ||
                        !passwordConfirmation
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {passwordSaving ? (
                        <LoaderCircle size={18} className="animate-spin" />
                      ) : (
                        <KeyRound size={18} />
                      )}
                      {passwordSaving
                        ? isArabic
                          ? "جارٍ التغيير..."
                          : "Changing..."
                        : isArabic
                          ? "تغيير كلمة المرور"
                          : "Change password"}
                    </button>
                  </footer>
                </form>
              </div>

              <div className="space-y-6">
                <section className="rounded-2xl border border-border bg-surface shadow-sm">
                  <header className="flex items-start gap-3 border-b border-border p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
                      <ShieldCheck size={21} />
                    </div>
                    <div>
                      <h2 className="font-semibold text-text-primary">
                        {isArabic ? "أمان الحساب" : "Account security"}
                      </h2>
                      <p className="mt-1 text-sm text-text-secondary">
                        {isArabic
                          ? "حماية المصادقة والجلسات."
                          : "Authentication protection and sessions."}
                      </p>
                    </div>
                  </header>

                  <div className="divide-y divide-border">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                          <KeyRound
                            size={19}
                            className="mt-0.5 shrink-0 text-warning"
                          />
                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              {isArabic
                                ? "المصادقة متعددة العوامل"
                                : "Multi-factor authentication"}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-text-secondary">
                              {isArabic
                                ? "موثقة كمرحلة لاحقة ولم تُفعّل بعد."
                                : "Documented for a later phase and not enabled yet."}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
                          {isArabic ? "مؤجلة" : "Deferred"}
                        </span>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex gap-3">
                        <MonitorSmartphone
                          size={19}
                          className="mt-0.5 shrink-0 text-primary"
                        />
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {isArabic ? "الجلسة الحالية" : "Current session"}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-text-secondary">
                            {isArabic
                              ? "طلبات FastAPI ترسل Access Token وتتحقق منه على الخادم."
                              : "FastAPI requests send an access token that is verified by the server."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-amber-100 bg-warning-soft p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      size={20}
                      className="mt-0.5 shrink-0 text-warning"
                    />
                    <div>
                      <h2 className="font-semibold text-text-primary">
                        {isArabic
                          ? "حساب ذو صلاحيات حساسة"
                          : "Sensitive account"}
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-text-secondary">
                        {isArabic
                          ? "لا تشارك كلمة المرور. المصادقة متعددة العوامل ما زالت مؤجلة."
                          : "Do not share the password. Multi-factor authentication remains deferred."}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Building2
                      size={20}
                      className="mt-0.5 shrink-0 text-primary"
                    />
                    <div>
                      <h2 className="font-semibold text-text-primary">
                        {isArabic ? "صلاحية الشركة" : "Company access"}
                      </h2>
                      <p className="mt-1 text-sm text-text-secondary">
                        {isArabic ? "الدور الحالي" : "Current role"}
                      </p>
                      <p className="mt-1 font-medium text-text-primary">
                        {roleLabel}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function FeedbackBanner({ feedback }: { feedback: NonNullable<Feedback> }) {
  const Icon = feedback.tone === "success" ? CheckCircle2 : CircleAlert;
  return (
    <div
      role={feedback.tone === "success" ? "status" : "alert"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        feedback.tone === "success"
          ? "border-green-100 bg-success-soft text-success"
          : "border-red-100 bg-danger-soft text-danger"
      }`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p>{feedback.message}</p>
    </div>
  );
}
