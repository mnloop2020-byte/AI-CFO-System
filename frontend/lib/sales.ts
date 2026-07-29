import { api } from "@/lib/api";
import type { MoneyString } from "@/lib/money";

export type Sale = {
  id: string;
  customer_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: MoneyString;
  total_amount: MoneyString;
  status: string;
  sale_date: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateSaleInput = {
  customer_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: MoneyString;
  status: string;
  sale_date?: string | null;
};

export type UpdateSaleInput = Partial<CreateSaleInput>;

export function getSales() {
  return api.get<Sale[]>("/sales");
}

export function createSale(data: CreateSaleInput) {
  return api.post<Sale>("/sales", data);
}

export function updateSale(
  saleId: string,
  data: UpdateSaleInput,
) {
  return api.patch<Sale>(`/sales/${saleId}`, data);
}

export function deleteSale(saleId: string) {
  return api.delete<void>(`/sales/${saleId}`);
}
