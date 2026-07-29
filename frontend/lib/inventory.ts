import { api } from "@/lib/api";
import type { MoneyString } from "@/lib/money";

export type InventoryItem = {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  reorder_level: number;
  cost_price: MoneyString;
  selling_price: MoneyString;
  last_sold: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateInventoryItemInput = {
  product_name: string;
  sku: string;
  quantity: number;
  reorder_level: number;
  cost_price: MoneyString;
  selling_price: MoneyString;
};

export type UpdateInventoryItemInput =
  Partial<CreateInventoryItemInput>;

export function getInventoryItems() {
  return api.get<InventoryItem[]>("/inventory");
}

export function createInventoryItem(
  data: CreateInventoryItemInput,
) {
  return api.post<InventoryItem>("/inventory", data);
}

export function updateInventoryItem(
  itemId: string,
  data: UpdateInventoryItemInput,
) {
  return api.patch<InventoryItem>(
    `/inventory/${itemId}`,
    data,
  );
}

export function deleteInventoryItem(itemId: string) {
  return api.delete<void>(`/inventory/${itemId}`);
}
