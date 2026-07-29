import { api } from "@/lib/api";
import type { MoneyString } from "@/lib/money";

export type Expense = {
  id: string;
  category: string;
  amount: MoneyString;
  description: string | null;
  vendor: string | null;
  expense_date: string | null;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateExpenseInput = {
  category: string;
  amount: MoneyString;
  description?: string | null;
  vendor?: string | null;
  expense_date?: string | null;
  is_flagged: boolean;
};

export type UpdateExpenseInput =
  Partial<CreateExpenseInput>;

export function getExpenses() {
  return api.get<Expense[]>("/expenses");
}

export function createExpense(
  data: CreateExpenseInput,
) {
  return api.post<Expense>("/expenses", data);
}

export function updateExpense(
  expenseId: string,
  data: UpdateExpenseInput,
) {
  return api.patch<Expense>(
    `/expenses/${expenseId}`,
    data,
  );
}

export function deleteExpense(expenseId: string) {
  return api.delete<void>(`/expenses/${expenseId}`);
}
