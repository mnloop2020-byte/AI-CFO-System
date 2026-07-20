import { api } from "@/lib/api";

export type InventoryItem = {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  reorder_level: number;
  cost_price: number;
  selling_price: number;
  last_sold: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateInventoryItemInput = {
  product_name: string;
  sku: string;
  quantity: number;
  reorder_level: number;
  cost_price: number;
  selling_price: number;
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