import { api } from "@/lib/api";

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateCustomerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  notes?: string | null;
};

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export function getCustomers() {
  return api.get<Customer[]>("/customers");
}

export function createCustomer(data: CreateCustomerInput) {
  return api.post<Customer>("/customers", data);
}

export function updateCustomer(
  customerId: string,
  data: UpdateCustomerInput,
) {
  return api.patch<Customer>(
    `/customers/${customerId}`,
    data,
  );
}

export function deleteCustomer(customerId: string) {
  return api.delete<void>(`/customers/${customerId}`);
}