"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSearch,
  LoaderCircle,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import Modal from "@/components/ui/Modal";
import {
  assignFinancialAction,
  deferFinancialAction,
  detectFinancialActions,
  getActionMetrics,
  getFinancialAction,
  getFinancialActions,
  recordFinancialActionExecution,
  transitionFinancialAction,
  updateFinancialAction,
  type ActionMetrics,
  type ActionSeverity,
  type ActionStatus,
  type ActionType,
  type FinancialAction,
  type FinancialActionDetail,
} from "@/lib/actions";
import {
  getAuthMe,
  getCompanyMembers,
  type AuthMe,
  type CompanyMember,
} from "@/lib/auth";

const statusOptions: Array<ActionStatus | "all"> = [
  "all", "new", "in_review", "waiting_for_approval", "approved",
  "rejected", "in_progress", "completed", "dismissed", "expired",
];
const typeOptions: Array<ActionType | "all"> = [
  "all", "overdue_invoice", "low_inventory", "expense_review",
];

function statusTone(status: ActionStatus) {
  if (status === "completed" || status === "approved") return "bg-success-soft text-success";
  if (status === "rejected" || status === "expired") return "bg-danger-soft text-danger";
  if (status === "waiting_for_approval" || status === "in_progress") return "bg-warning-soft text-warning";
  return "bg-primary-soft text-primary";
}

function severityTone(severity: ActionSeverity) {
  if (severity === "critical" || severity === "high") return "bg-danger-soft text-danger";
  if (severity === "medium") return "bg-warning-soft text-warning";
  return "bg-primary-soft text-primary";
}

export default function FinancialActionCenter() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [me, setMe] = useState<AuthMe | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [actions, setActions] = useState<FinancialAction[]>([]);
  const [metrics, setMetrics] = useState<ActionMetrics | null>(null);
  const [selected, setSelected] = useState<FinancialActionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActionStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ActionType | "all">("all");
  const [draftMessage, setDraftMessage] = useState("");
  const [draftRecipient, setDraftRecipient] = useState("");

  const hasPermission = useCallback(
    (permission: string) => me?.permissions.includes(permission) ?? false,
    [me],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [identity, actionRows, actionMetrics] = await Promise.all([
        getAuthMe(), getFinancialActions(), getActionMetrics(),
      ]);
      setMe(identity);
      setActions(actionRows);
      setMetrics(actionMetrics);
      setMembers(
        identity.permissions.includes("actions.assign")
          ? await getCompanyMembers()
          : [],
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load actions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredActions = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return actions.filter((action) => {
      const matchesStatus = statusFilter === "all" || action.status === statusFilter;
      const matchesType = typeFilter === "all" || action.action_type === typeFilter;
      const haystack = `${action.title_en} ${action.title_ar} ${action.description_en} ${action.description_ar}`.toLocaleLowerCase();
      return matchesStatus && matchesType && (!needle || haystack.includes(needle));
    });
  }, [actions, search, statusFilter, typeFilter]);

  const statusLabel = (value: ActionStatus | "all") => {
    const en: Record<string, string> = {
      all: "All statuses", new: "New", in_review: "In review",
      waiting_for_approval: "Waiting for approval", approved: "Approved",
      rejected: "Rejected", in_progress: "In progress", completed: "Completed",
      dismissed: "Dismissed", expired: "Expired",
    };
    const ar: Record<string, string> = {
      all: "كل الحالات", new: "جديد", in_review: "قيد المراجعة",
      waiting_for_approval: "بانتظار الموافقة", approved: "موافق عليه",
      rejected: "مرفوض", in_progress: "قيد التنفيذ", completed: "مكتمل",
      dismissed: "مغلق دون إجراء", expired: "منتهي",
    };
    return (isArabic ? ar : en)[value];
  };

  const typeLabel = (value: ActionType | "all") => {
    const en: Record<string, string> = {
      all: "All action types", overdue_invoice: "Overdue invoices",
      low_inventory: "Low inventory", expense_review: "Expense review",
    };
    const ar: Record<string, string> = {
      all: "كل أنواع الإجراءات", overdue_invoice: "الفواتير المتأخرة",
      low_inventory: "المخزون المنخفض", expense_review: "مراجعة المصروفات",
    };
    return (isArabic ? ar : en)[value];
  };

  const severityLabel = (value: ActionSeverity) => {
    const ar = { low: "منخفض", medium: "متوسط", high: "مرتفع", critical: "حرج" };
    return isArabic ? ar[value] : value;
  };

  const openDetails = async (actionId: string) => {
    setWorking(true);
    setErrorMessage(null);
    try {
      const detail = await getFinancialAction(actionId);
      setSelected(detail);
      setDraftMessage(String(detail.proposed_action[isArabic ? "message_ar" : "message_en"] ?? ""));
      setDraftRecipient(String(detail.proposed_action.recipient ?? ""));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load action.");
    } finally {
      setWorking(false);
    }
  };

  const refreshAfterMutation = async (actionId?: string) => {
    const [rows, actionMetrics] = await Promise.all([getFinancialActions(), getActionMetrics()]);
    setActions(rows);
    setMetrics(actionMetrics);
    if (actionId) setSelected(await getFinancialAction(actionId));
  };

  const runDetection = async () => {
    setWorking(true);
    setErrorMessage(null);
    setNotice(null);
    try {
      const result = await detectFinancialActions();
      await refreshAfterMutation();
      setNotice(
        isArabic
          ? `تم إنشاء ${result.created}، وتجنب ${result.existing} إجراء مكرر، وإغلاق ${result.resolved} إجراء محلول.`
          : `Created ${result.created}, reused ${result.existing} existing, and resolved ${result.resolved} action(s).`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Detection failed.");
    } finally {
      setWorking(false);
    }
  };

  const mutate = async (operation: () => Promise<unknown>, message: string) => {
    if (!selected) return;
    setWorking(true);
    setErrorMessage(null);
    try {
      await operation();
      await refreshAfterMutation(selected.id);
      setNotice(message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Action update failed.");
    } finally {
      setWorking(false);
    }
  };

  const saveDraft = () => {
    if (!selected) return;
    const messageKey = isArabic ? "message_ar" : "message_en";
    void mutate(
      () => updateFinancialAction(selected.id, {
        proposed_action: {
          ...selected.proposed_action,
          [messageKey]: draftMessage,
          recipient: draftRecipient || null,
          external_execution_allowed: false,
        },
      }),
      isArabic
        ? "تم حفظ المسودة، وأي تعديل بعد الموافقة يتطلب موافقة جديدة."
        : "Draft saved. Changes after approval require fresh approval.",
    );
  };

  const sourceHref = selected
    ? selected.source_type === "invoice"
      ? `/crm/invoices?highlight=${selected.source_id}`
      : selected.source_type === "inventory"
        ? `/crm/inventory?highlight=${selected.source_id}`
        : `/crm/expenses?highlight=${selected.source_id}`
    : "#";

  const metricCards = [
    { label: isArabic ? "الإجراءات المفتوحة" : "Open actions", value: metrics?.open_actions ?? 0 },
    { label: isArabic ? "الإجراءات المكتملة" : "Completed", value: metrics?.completed_actions ?? 0 },
    { label: isArabic ? "الموافقات" : "Approvals", value: metrics?.approvals ?? 0 },
    { label: isArabic ? "التنبيهات المغلقة" : "Dismissed", value: metrics?.dismissed_actions ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {errorMessage ? <div role="alert" className="rounded-2xl border border-red-100 bg-danger-soft px-5 py-4 text-sm text-danger">{errorMessage}</div> : null}
      {notice ? <div role="status" className="rounded-2xl border border-green-100 bg-success-soft px-5 py-4 text-sm text-success">{notice}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => <div key={metric.label} className="rounded-2xl border border-border bg-surface p-5 shadow-sm"><p className="text-sm text-text-secondary">{metric.label}</p><p className="mt-2 text-3xl font-semibold text-text-primary">{metric.value}</p></div>)}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-lg font-semibold text-text-primary">{isArabic ? "الإجراءات المالية القابلة للمتابعة" : "Traceable financial actions"}</h2><p className="mt-1 text-sm text-text-secondary">{isArabic ? "الأدلة والحسابات حتمية، والتنفيذ الخارجي معطّل دون تكامل وموافقة." : "Evidence and calculations are deterministic; external execution remains disabled."}</p></div>
          {hasPermission("actions.detect") ? <button type="button" onClick={() => void runDetection()} disabled={working} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-60">{working ? <LoaderCircle size={18} className="animate-spin" /> : <RefreshCw size={18} />}{isArabic ? "تشغيل الاكتشاف" : "Run detection"}</button> : null}
        </div>

        <div className="grid gap-3 border-b border-border p-4 md:grid-cols-[1fr_220px_220px]">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface-soft px-3"><Search size={17} className="text-text-secondary" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isArabic ? "البحث في الإجراءات..." : "Search actions..."} className="w-full bg-transparent text-sm outline-none" /></label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ActionStatus | "all")} className="h-11 rounded-xl border border-border px-3 text-sm">{statusOptions.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as ActionType | "all")} className="h-11 rounded-xl border border-border px-3 text-sm">{typeOptions.map((value) => <option key={value} value={value}>{typeLabel(value)}</option>)}</select>
        </div>

        {loading ? <div className="flex items-center justify-center gap-3 p-12 text-text-secondary"><LoaderCircle className="animate-spin" />{isArabic ? "جارٍ التحميل..." : "Loading actions..."}</div> : <div className="divide-y divide-border">
          {filteredActions.map((action) => {
            const Icon = action.action_type === "overdue_invoice" ? Clock3 : action.action_type === "low_inventory" ? PackageSearch : FileSearch;
            return <button key={action.id} type="button" onClick={() => void openDetails(action.id)} className="flex w-full flex-col gap-4 p-5 text-start transition hover:bg-surface-soft sm:flex-row sm:items-center"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon size={20} /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-text-primary">{isArabic ? action.title_ar : action.title_en}</span><span className="mt-1 line-clamp-2 block text-sm text-text-secondary">{isArabic ? action.description_ar : action.description_en}</span></span><span className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${severityTone(action.severity)}`}>{severityLabel(action.severity)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(action.status)}`}>{statusLabel(action.status)}</span></span></button>;
          })}
          {filteredActions.length === 0 ? <div className="p-12 text-center"><ShieldCheck className="mx-auto text-success" size={30} /><p className="mt-3 font-medium text-text-primary">{isArabic ? "لا توجد إجراءات مطابقة" : "No matching actions"}</p><p className="mt-1 text-sm text-text-secondary">{isArabic ? "شغّل الاكتشاف أو غيّر عوامل التصفية." : "Run detection or change the filters."}</p></div> : null}
        </div>}
      </section>

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected ? (isArabic ? selected.title_ar : selected.title_en) : ""} description={selected ? typeLabel(selected.action_type) : undefined}>
        {selected ? <div className="space-y-6">
          <div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${severityTone(selected.severity)}`}>{severityLabel(selected.severity)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(selected.status)}`}>{statusLabel(selected.status)}</span>{selected.requires_approval ? <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs text-warning">{isArabic ? "يتطلب موافقة" : "Approval required"}</span> : null}</div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-border p-4"><p className="text-xs text-text-secondary">{isArabic ? "الأثر المالي المرتبط" : "Linked financial impact"}</p><p className="mt-1 font-semibold text-text-primary">{selected.financial_impact ?? (isArabic ? "غير متاح" : "Unavailable")} {selected.currency ?? ""}</p></div><div className="rounded-xl border border-border p-4"><p className="text-xs text-text-secondary">{isArabic ? "تاريخ الاستحقاق" : "Due date"}</p><p className="mt-1 font-semibold text-text-primary">{selected.due_date ?? (isArabic ? "غير محدد" : "Not set")}</p></div></div>
          <section><h3 className="font-semibold text-text-primary">{isArabic ? "الأدلة والمصدر" : "Evidence and source"}</h3><pre dir="ltr" className="mt-3 max-h-64 overflow-auto rounded-xl bg-surface-soft p-4 text-xs text-text-secondary">{JSON.stringify(selected.evidence, null, 2)}</pre><Link href={sourceHref} className="mt-3 inline-flex text-sm font-medium text-primary">{isArabic ? "فتح السجل الأصلي" : "Open source record"}</Link></section>
          <section><h3 className="font-semibold text-text-primary">{isArabic ? "التوصية" : "Recommendation"}</h3><p className="mt-2 text-sm leading-6 text-text-secondary">{isArabic ? selected.recommendation_ar : selected.recommendation_en}</p></section>
          {hasPermission("actions.assign") ? <label className="block space-y-2"><span className="text-sm font-medium text-text-primary">{isArabic ? "المسؤول" : "Assignee"}</span><select value={selected.assigned_to ?? ""} onChange={(event) => void mutate(() => assignFinancialAction(selected.id, event.target.value || null), isArabic ? "تم تحديث المسؤول." : "Assignee updated.")} className="h-11 w-full rounded-xl border border-border px-3"><option value="">{isArabic ? "غير معيّن" : "Unassigned"}</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.email} — {member.role}</option>)}</select></label> : null}
          {hasPermission("actions.write") && Object.keys(selected.proposed_action).length > 0 ? <section className="space-y-3 rounded-xl border border-blue-100 bg-primary-soft p-4"><h3 className="font-semibold text-text-primary">{isArabic ? "مسودة الإجراء" : "Action draft"}</h3>{"recipient" in selected.proposed_action ? <input dir="ltr" value={draftRecipient} onChange={(event) => setDraftRecipient(event.target.value)} placeholder={isArabic ? "بريد المستلم" : "Recipient email"} className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm" /> : null}{draftMessage || "message_en" in selected.proposed_action || "message_ar" in selected.proposed_action ? <textarea value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} rows={5} className="w-full rounded-xl border border-border bg-surface p-3 text-sm" /> : <pre dir="ltr" className="overflow-auto text-xs">{JSON.stringify(selected.proposed_action, null, 2)}</pre>}<p className="text-xs text-text-secondary">{isArabic ? "لا يوجد تنفيذ خارجي تلقائي. تعديل المسودة بعد الموافقة يعيدها للموافقة." : "No external execution occurs. Editing an approved draft requires fresh approval."}</p><button type="button" onClick={saveDraft} disabled={working} className="rounded-xl border border-blue-100 bg-surface px-4 py-2 text-sm font-medium text-primary">{isArabic ? "حفظ المسودة" : "Save draft"}</button></section> : null}
          {hasPermission("actions.write") ? <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {selected.status === "new" ? <button type="button" onClick={() => void mutate(() => transitionFinancialAction(selected.id, "in_review"), isArabic ? "بدأت المراجعة." : "Review started.")} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">{isArabic ? "بدء المراجعة" : "Start review"}</button> : null}
            {selected.status === "in_review" && selected.requires_approval ? <button type="button" onClick={() => void mutate(() => transitionFinancialAction(selected.id, "waiting_for_approval"), isArabic ? "أُرسلت للموافقة." : "Submitted for approval.")} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">{isArabic ? "طلب الموافقة" : "Request approval"}</button> : null}
            {selected.status === "in_review" && !selected.requires_approval ? <button type="button" onClick={() => void mutate(() => transitionFinancialAction(selected.id, "in_progress"), isArabic ? "بدأ التنفيذ الداخلي." : "Internal work started.")} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">{isArabic ? "بدء المتابعة" : "Start work"}</button> : null}
            {selected.status === "waiting_for_approval" && hasPermission("actions.approve") ? <><button type="button" onClick={() => void mutate(() => transitionFinancialAction(selected.id, "approved"), isArabic ? "تمت الموافقة على المسودة فقط." : "Draft approved; nothing was sent.")} className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2 text-sm font-semibold text-white"><CheckCircle2 size={16} />{isArabic ? "موافقة" : "Approve"}</button><button type="button" onClick={() => void mutate(() => transitionFinancialAction(selected.id, "rejected"), isArabic ? "تم رفض المسودة." : "Draft rejected.")} className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white"><XCircle size={16} />{isArabic ? "رفض" : "Reject"}</button></> : null}
            {selected.status === "approved" ? <button type="button" onClick={() => void mutate(() => recordFinancialActionExecution(selected.id, `approved:${selected.id}:${selected.approved_at}`), isArabic ? "تم تسجيل بدء المتابعة؛ لا يوجد إرسال خارجي." : "Follow-up recorded; no external action was sent.")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"><UserRoundCheck size={16} />{isArabic ? "بدء المتابعة" : "Start follow-up"}</button> : null}
            {selected.status === "in_progress" ? <button type="button" onClick={() => void mutate(() => transitionFinancialAction(selected.id, "completed"), isArabic ? "اكتمل الإجراء." : "Action completed.")} className="rounded-xl bg-success px-4 py-2 text-sm font-semibold text-white">{isArabic ? "إكمال" : "Complete"}</button> : null}
            {selected.status === "in_progress" && selected.action_type === "overdue_invoice" ? <><button type="button" onClick={() => void mutate(() => transitionFinancialAction(selected.id, "in_review", null, "Collection follow-up paused because a dispute was recorded."), isArabic ? "تم إيقاف المتابعة وتسجيل وجود نزاع." : "Follow-up paused and dispute recorded.")} className="rounded-xl border border-border px-4 py-2 text-sm text-text-secondary">{isArabic ? "تسجيل نزاع" : "Record dispute"}</button><button type="button" onClick={() => void mutate(() => transitionFinancialAction(selected.id, "in_review", null, "Collection follow-up paused because a payment plan was recorded."), isArabic ? "تم إيقاف المتابعة وتسجيل اتفاق دفع." : "Follow-up paused and payment plan recorded.")} className="rounded-xl border border-border px-4 py-2 text-sm text-text-secondary">{isArabic ? "تسجيل اتفاق دفع" : "Record payment plan"}</button></> : null}
            {["new", "in_review", "waiting_for_approval", "rejected", "in_progress"].includes(selected.status) ? <button type="button" onClick={() => void mutate(() => deferFinancialAction(selected.id), isArabic ? "تم التأجيل 7 أيام." : "Deferred for 7 days.")} className="rounded-xl border border-border px-4 py-2 text-sm text-text-secondary">{isArabic ? "تأجيل 7 أيام" : "Defer 7 days"}</button> : null}
            {["new", "in_review", "rejected"].includes(selected.status) ? <button type="button" onClick={() => void mutate(() => transitionFinancialAction(selected.id, "dismissed"), isArabic ? "أُغلق التنبيه دون إجراء." : "Action dismissed.")} className="rounded-xl border border-border px-4 py-2 text-sm text-text-secondary">{isArabic ? "إغلاق دون إجراء" : "Dismiss"}</button> : null}
          </div> : null}
          <section><h3 className="font-semibold text-text-primary">{isArabic ? "السجل الزمني" : "Timeline"}</h3><div className="mt-3 space-y-3">{selected.events.map((event) => <div key={event.id} className="flex gap-3 rounded-xl border border-border p-3"><AlertTriangle size={17} className="mt-0.5 shrink-0 text-primary" /><div><p className="text-sm font-medium text-text-primary">{event.from_status ? `${statusLabel(event.from_status as ActionStatus)} → ${statusLabel(event.to_status as ActionStatus)}` : statusLabel(event.to_status as ActionStatus)}</p><p className="mt-1 text-xs text-text-secondary">{new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</p></div></div>)}</div></section>
        </div> : null}
      </Modal>
    </div>
  );
}
