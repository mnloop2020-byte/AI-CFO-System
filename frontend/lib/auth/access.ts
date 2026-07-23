import type {
  AuthMe,
  CompanyMember,
  CompanyRole,
} from "@/lib/auth";

export function hasAuthPermission(
  identity: AuthMe | null,
  permission: string,
) {
  return identity?.permissions.includes(permission) ?? false;
}

export function canChangeMemberRole(
  identity: AuthMe | null,
  member: CompanyMember,
) {
  if (
    !identity ||
    !hasAuthPermission(identity, "members.manage") ||
    identity.user_id === member.user_id
  ) {
    return false;
  }

  return !(identity.role === "admin" && member.role === "owner");
}

export function allowedMemberRoles(
  identity: AuthMe | null,
  member: CompanyMember,
): CompanyRole[] {
  if (!canChangeMemberRole(identity, member)) {
    return [member.role];
  }

  return identity?.role === "owner"
    ? ["owner", "admin", "accountant", "viewer"]
    : ["admin", "accountant", "viewer"];
}

export function canRemoveMember(
  identity: AuthMe | null,
  member: CompanyMember,
) {
  if (!canChangeMemberRole(identity, member)) {
    return false;
  }

  return member.role !== "owner" || identity?.role === "owner";
}
