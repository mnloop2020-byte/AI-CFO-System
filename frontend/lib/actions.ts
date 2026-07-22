import { api } from "@/lib/api";

export type ActionType = "overdue_invoice" | "low_inventory" | "expense_review";
export type ActionSeverity = "low" | "medium" | "high" | "critical";
export type ActionStatus =
  | "new"
  | "in_review"
  | "waiting_for_approval"
  | "approved"
  | "rejected"
  | "in_progress"
  | "completed"
  | "dismissed"
  | "expired";

export type FinancialAction = {
  id: string;
  action_type: ActionType;
  dedup_key: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  severity: ActionSeverity;
  financial_impact: string | null;
  currency: string | null;
  source_type: "invoice" | "inventory" | "expense";
  source_id: string;
  evidence: Record<string, unknown>;
  recommendation_en: string;
  recommendation_ar: string;
  assigned_to: string | null;
  due_date: string | null;
  requires_approval: boolean;
  proposed_action: Record<string, unknown>;
  status: ActionStatus;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_expires_at: string | null;
  resolved_at: string | null;
  last_execution_key: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialActionEvent = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type FinancialActionDetail = FinancialAction & {
  events: FinancialActionEvent[];
};

export type ActionMetrics = {
  open_actions: number;
  completed_actions: number;
  linked_financial_value: string;
  overdue_invoice_actions: number;
  low_inventory_actions: number;
  expense_review_actions: number;
  approvals: number;
  rejections: number;
  accepted_recommendation_rate: number | null;
  estimated_minutes_saved: number;
  estimation_method: string;
  dismissed_actions: number;
};

export type DetectionResult = {
  created: number;
  existing: number;
  resolved: number;
  action_ids: string[];
};

export function getFinancialActions() {
  return api.get<FinancialAction[]>("/actions");
}

export function getFinancialAction(actionId: string) {
  return api.get<FinancialActionDetail>(`/actions/${actionId}`);
}

export function getActionMetrics() {
  return api.get<ActionMetrics>("/actions/metrics");
}

export function detectFinancialActions() {
  return api.post<DetectionResult>("/actions/detect");
}

export function updateFinancialAction(
  actionId: string,
  updates: {
    title_en?: string;
    title_ar?: string;
    description_en?: string;
    description_ar?: string;
    recommendation_en?: string;
    recommendation_ar?: string;
    proposed_action?: Record<string, unknown>;
    due_date?: string | null;
  },
) {
  return api.patch<FinancialAction>(`/actions/${actionId}`, updates);
}

export function assignFinancialAction(actionId: string, assignedTo: string | null) {
  return api.post<FinancialAction>(`/actions/${actionId}/assign`, {
    assigned_to: assignedTo,
  });
}

export function transitionFinancialAction(
  actionId: string,
  status: ActionStatus,
  dueDate?: string | null,
  note?: string | null,
) {
  return api.post<FinancialAction>(`/actions/${actionId}/transition`, {
    status,
    due_date: dueDate,
    note,
  });
}

export function deferFinancialAction(actionId: string, days = 7) {
  return api.post<FinancialAction>(`/actions/${actionId}/defer?days=${days}`);
}

export function recordFinancialActionExecution(
  actionId: string,
  idempotencyKey: string,
) {
  return api.post<{
    action: FinancialAction;
    replayed: boolean;
    external_executed: false;
    outcome: "pending_integration" | "human_review_required";
  }>(`/actions/${actionId}/execute`, {
    idempotency_key: idempotencyKey,
  });
}
