"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clipboard, LoaderCircle, ShieldAlert, UserPlus, Users } from "lucide-react";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  createCompanyInvitation,
  getAuthMe,
  getCompanyInvitations,
  getCompanyMembers,
  removeCompanyMember,
  revokeCompanyInvitation,
  updateCompanyMemberRole,
  type AuthMe,
  type CompanyInvitation,
  type CompanyMember,
  type CompanyRole,
  type InvitableRole,
} from "@/lib/auth";

const roleOptions: CompanyRole[] = ["owner", "admin", "accountant", "viewer"];
const invitationRoleOptions: InvitableRole[] = ["admin", "accountant", "viewer"];

export default function MembersPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [me, setMe] = useState<AuthMe | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [newInvitationUrl, setNewInvitationUrl] = useState<string | null>(null);

  const roleLabel = (role: CompanyRole) => {
    if (!isArabic) return role;
    return { owner: "المالك", admin: "المدير", accountant: "المحاسب", viewer: "المشاهد" }[role];
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const identity = await getAuthMe();
      const [memberRows, invitationRows] = await Promise.all([
        getCompanyMembers(),
        getCompanyInvitations(),
      ]);
      setMe(identity);
      setMembers(memberRows);
      setInvitations(invitationRows);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load members.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setNewInvitationUrl(null);
    const form = new FormData(event.currentTarget);
    try {
      const invitation = await createCompanyInvitation({
        email: String(form.get("email") ?? ""),
        role: String(form.get("role") ?? "viewer") as InvitableRole,
        expires_in_hours: Number(form.get("expires") ?? 72),
      });
      setInvitations((current) => [invitation, ...current]);
      setNewInvitationUrl(`${window.location.origin}${invitation.acceptance_path}`);
      setSuccessMessage(
        isArabic
          ? "تم إنشاء رابط الدعوة. انسخه الآن؛ لن يُعرض Token الخام مرة أخرى."
          : "Invitation created. Copy it now; the raw token will not be shown again.",
      );
      event.currentTarget.reset();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create invitation.");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (member: CompanyMember, role: CompanyRole) => {
    setErrorMessage(null);
    try {
      const updated = await updateCompanyMemberRole(member.user_id, role);
      setMembers((current) => current.map((item) => item.user_id === updated.user_id ? updated : item));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update role.");
    }
  };

  const handleRemove = async (member: CompanyMember) => {
    if (!window.confirm(isArabic ? `إزالة ${member.email} من الشركة؟` : `Remove ${member.email} from the company?`)) return;
    setErrorMessage(null);
    try {
      await removeCompanyMember(member.user_id);
      setMembers((current) => current.filter((item) => item.user_id !== member.user_id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to remove member.");
    }
  };

  const handleRevoke = async (invitation: CompanyInvitation) => {
    setErrorMessage(null);
    try {
      const updated = await revokeCompanyInvitation(invitation.id);
      setInvitations((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to revoke invitation.");
    }
  };

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Header
          title={isArabic ? "الأعضاء والدعوات" : "Members and invitations"}
          description={isArabic ? "إدارة مستخدمي الشركة الواحدة وأدوارهم." : "Manage users and roles for this single-company deployment."}
        />
        <main className="space-y-6 p-5 lg:p-8">
          {errorMessage ? (
            <div role="alert" className="flex gap-3 rounded-2xl border border-red-100 bg-danger-soft px-5 py-4 text-danger">
              <ShieldAlert size={20} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : null}
          {successMessage ? (
            <div role="status" className="flex gap-3 rounded-2xl border border-green-100 bg-success-soft px-5 py-4 text-success">
              <CheckCircle2 size={20} className="shrink-0" />
              <span>{successMessage}</span>
            </div>
          ) : null}

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <UserPlus className="text-primary" size={22} />
              <div>
                <h2 className="font-semibold text-text-primary">{isArabic ? "دعوة مستخدم" : "Invite a user"}</h2>
                <p className="text-sm text-text-secondary">{isArabic ? "الدعوات للمدير أو المحاسب أو المشاهد فقط." : "Invitations may assign admin, accountant, or viewer."}</p>
              </div>
            </div>
            <form onSubmit={handleInvite} className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_150px_auto]">
              <input type="email" name="email" required placeholder="name@company.com" className="h-11 rounded-xl border border-border px-4 outline-none focus:border-primary" />
              <select name="role" defaultValue="viewer" className="h-11 rounded-xl border border-border px-3">
                {invitationRoleOptions.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
              </select>
              <select name="expires" defaultValue="72" className="h-11 rounded-xl border border-border px-3">
                <option value="24">{isArabic ? "24 ساعة" : "24 hours"}</option>
                <option value="72">{isArabic ? "3 أيام" : "3 days"}</option>
                <option value="168">{isArabic ? "7 أيام" : "7 days"}</option>
              </select>
              <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? <LoaderCircle size={18} className="animate-spin" /> : <UserPlus size={18} />}
                {isArabic ? "إنشاء الدعوة" : "Create invitation"}
              </button>
            </form>
            {newInvitationUrl ? (
              <div className="mt-4 flex flex-col gap-2 rounded-xl bg-primary-soft p-3 sm:flex-row">
                <input readOnly dir="ltr" value={newInvitationUrl} className="h-10 min-w-0 flex-1 rounded-lg border border-blue-100 bg-surface px-3 text-xs" />
                <button type="button" onClick={() => void navigator.clipboard.writeText(newInvitationUrl)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-100 bg-surface px-4 text-sm font-medium text-primary">
                  <Clipboard size={16} /> {isArabic ? "نسخ" : "Copy"}
                </button>
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="flex items-center gap-3 border-b border-border p-5">
              <Users className="text-primary" size={22} />
              <h2 className="font-semibold text-text-primary">{isArabic ? "أعضاء الشركة" : "Company members"}</h2>
            </div>
            {loading ? <div className="p-10 text-center text-text-secondary">{isArabic ? "جارٍ التحميل..." : "Loading..."}</div> : (
              <div className="overflow-x-auto">
                <table className={`w-full min-w-[720px] ${isArabic ? "text-right" : "text-left"}`}>
                  <thead className="bg-surface-soft text-xs uppercase text-text-secondary"><tr><th className="px-5 py-3">{isArabic ? "المستخدم" : "User"}</th><th className="px-5 py-3">{isArabic ? "الدور" : "Role"}</th><th className="px-5 py-3">{isArabic ? "تاريخ الانضمام" : "Joined"}</th><th className="px-5 py-3">{isArabic ? "إجراء" : "Action"}</th></tr></thead>
                  <tbody>{members.map((member) => (
                    <tr key={member.user_id} className="border-t border-border">
                      <td className="px-5 py-4"><p className="font-medium text-text-primary" dir="ltr">{member.email}</p>{member.user_id === me?.user_id ? <span className="text-xs text-primary">{isArabic ? "أنت" : "You"}</span> : null}</td>
                      <td className="px-5 py-4"><select value={member.role} onChange={(event) => void handleRoleChange(member, event.target.value as CompanyRole)} className="h-9 rounded-lg border border-border px-2">{roleOptions.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></td>
                      <td className="px-5 py-4 text-sm text-text-secondary">{new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-US", { dateStyle: "medium" }).format(new Date(member.created_at))}</td>
                      <td className="px-5 py-4"><button type="button" disabled={member.user_id === me?.user_id} onClick={() => void handleRemove(member)} className="rounded-lg border border-red-100 px-3 py-2 text-sm text-danger disabled:opacity-40">{isArabic ? "إزالة" : "Remove"}</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border p-5"><h2 className="font-semibold text-text-primary">{isArabic ? "سجل الدعوات" : "Invitation history"}</h2></div>
            <div className="divide-y divide-border">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div><p dir="ltr" className="font-medium text-text-primary">{invitation.email}</p><p className="mt-1 text-sm text-text-secondary">{roleLabel(invitation.role)} · {invitation.status}</p></div>
                  {invitation.status === "pending" ? <button type="button" onClick={() => void handleRevoke(invitation)} className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary">{isArabic ? "إلغاء الدعوة" : "Revoke"}</button> : null}
                </div>
              ))}
              {!loading && invitations.length === 0 ? <p className="p-5 text-sm text-text-secondary">{isArabic ? "لا توجد دعوات بعد." : "No invitations yet."}</p> : null}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
