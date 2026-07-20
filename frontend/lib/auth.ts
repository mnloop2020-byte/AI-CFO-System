import { api } from "@/lib/api";

export type CompanyRole = "owner" | "admin" | "accountant" | "viewer";
export type InvitableRole = Exclude<CompanyRole, "owner">;

export type AuthMe = {
  user_id: string;
  email: string;
  company_id: string;
  company_name: string;
  role: CompanyRole;
  permissions: string[];
};

export type CompanyMember = {
  user_id: string;
  email: string;
  role: CompanyRole;
  created_at: string;
  updated_at: string;
};

export type CompanyInvitation = {
  id: string;
  email: string;
  role: InvitableRole;
  status: "pending" | "claimed" | "accepted" | "revoked" | "expired";
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type CreatedCompanyInvitation = CompanyInvitation & {
  acceptance_path: string;
};

export function getAuthMe() {
  return api.get<AuthMe>("/auth/me");
}

export function getCompanyMembers() {
  return api.get<CompanyMember[]>("/auth/members");
}

export function updateCompanyMemberRole(userId: string, role: CompanyRole) {
  return api.patch<CompanyMember>(`/auth/members/${userId}`, { role });
}

export function removeCompanyMember(userId: string) {
  return api.delete<void>(`/auth/members/${userId}`);
}

export function getCompanyInvitations() {
  return api.get<CompanyInvitation[]>("/auth/invitations");
}

export function createCompanyInvitation(input: {
  email: string;
  role: InvitableRole;
  expires_in_hours: number;
}) {
  return api.post<CreatedCompanyInvitation>("/auth/invitations", input);
}

export function revokeCompanyInvitation(invitationId: string) {
  return api.post<CompanyInvitation>(
    `/auth/invitations/${invitationId}/revoke`,
  );
}
