import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  allowedMemberRoles,
  canChangeMemberRole,
  canRemoveMember,
  hasAuthPermission,
} from "../lib/auth/access.ts";
import { getSafeNextPath } from "../lib/auth/redirect.ts";
import type { AuthMe, CompanyMember } from "../lib/auth.ts";

const baseIdentity: AuthMe = {
  user_id: "actor",
  email: "actor@example.com",
  company_id: "company",
  company_name: "Development Company",
  role: "admin",
  permissions: ["members.read", "members.invite", "members.manage"],
  authenticator_assurance_level: "aal2",
  mfa_required: false,
};

function member(
  userId: string,
  role: CompanyMember["role"],
): CompanyMember {
  return {
    user_id: userId,
    email: `${userId}@example.com`,
    role,
    created_at: "2026-07-23T00:00:00Z",
    updated_at: "2026-07-23T00:00:00Z",
  };
}

test("safe next accepts local paths and rejects external redirects", () => {
  assert.equal(getSafeNextPath("/members?tab=pending"), "/members?tab=pending");
  assert.equal(getSafeNextPath("https://example.com"), "/dashboard");
  assert.equal(getSafeNextPath("//example.com"), "/dashboard");
  assert.equal(getSafeNextPath("/\\example.com"), "/dashboard");
  assert.equal(getSafeNextPath("/members\u0000"), "/dashboard");
});

test("permissions are read from auth/me rather than inferred from role", () => {
  assert.equal(hasAuthPermission(baseIdentity, "members.invite"), true);
  assert.equal(
    hasAuthPermission({ ...baseIdentity, permissions: [] }, "members.invite"),
    false,
  );
});

test("admin cannot manage an owner or assign owner", () => {
  const owner = member("owner", "owner");
  const viewer = member("viewer", "viewer");

  assert.equal(canChangeMemberRole(baseIdentity, owner), false);
  assert.deepEqual(allowedMemberRoles(baseIdentity, viewer), [
    "admin",
    "accountant",
    "viewer",
  ]);
  assert.equal(canRemoveMember(baseIdentity, owner), false);
});

test("owner can manage another member but not itself", () => {
  const identity = {
    ...baseIdentity,
    role: "owner" as const,
  };

  assert.equal(canChangeMemberRole(identity, member("viewer", "viewer")), true);
  assert.equal(canRemoveMember(identity, member("viewer", "viewer")), true);
  assert.equal(canChangeMemberRole(identity, member("actor", "owner")), false);
  assert.equal(canRemoveMember(identity, member("actor", "owner")), false);
});

test("viewer has no member management controls", () => {
  const viewerIdentity = {
    ...baseIdentity,
    role: "viewer" as const,
    permissions: ["financial.read"],
  };
  const target = member("other", "viewer");

  assert.equal(canChangeMemberRole(viewerIdentity, target), false);
  assert.equal(canRemoveMember(viewerIdentity, target), false);
});

test("restricted navigation and report actions are permission-driven", () => {
  const sidebar = readFileSync(
    new URL("../components/layout/Sidebar.tsx", import.meta.url),
    "utf8",
  );
  const reportTemplates = readFileSync(
    new URL("../components/reports/ReportTemplates.tsx", import.meta.url),
    "utf8",
  );

  assert.match(sidebar, /usePermission\("members\.read"\)/);
  assert.match(sidebar, /canViewMembers\s*\?/);
  assert.match(reportTemplates, /usePermission\("reports\.write"\)/);
  assert.match(reportTemplates, /\{canWriteReports \? \(/);
});

test("Action Center renders structured evidence without raw JSON", () => {
  const actionCenter = readFileSync(
    new URL(
      "../components/actions/FinancialActionCenter.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(actionCenter, /function StructuredDetails/);
  assert.match(actionCenter, /hasEditableDraft/);
  assert.doesNotMatch(
    actionCenter,
    /JSON\.stringify\(selected\.(evidence|proposed_action)/,
  );
});

test("auth routes and bearer-token integration remain wired", () => {
  const middleware = readFileSync(
    new URL("../middleware.ts", import.meta.url),
    "utf8",
  );
  const callback = readFileSync(
    new URL("../app/auth/callback/route.ts", import.meta.url),
    "utf8",
  );
  const forgotPassword = readFileSync(
    new URL("../app/login/forgot-password/page.tsx", import.meta.url),
    "utf8",
  );
  const resetPassword = readFileSync(
    new URL("../app/login/reset-password/page.tsx", import.meta.url),
    "utf8",
  );
  const login = readFileSync(
    new URL("../app/login/page.tsx", import.meta.url),
    "utf8",
  );
  const apiClient = readFileSync(
    new URL("../lib/api.ts", import.meta.url),
    "utf8",
  );
  const authClient = readFileSync(
    new URL("../lib/auth.ts", import.meta.url),
    "utf8",
  );

  for (const route of ["/dashboard/:path*", "/members/:path*", "/profile/:path*"]) {
    assert.match(middleware, new RegExp(route.replaceAll("*", "\\*")));
  }
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(forgotPassword, /resetPasswordForEmail/);
  assert.match(resetPassword, /auth\.updateUser/);
  assert.match(apiClient, /Authorization.*Bearer/);
  assert.match(authClient, /authMeRequest/);
  assert.match(authClient, /AUTH_ME_CACHE_MS/);
  assert.match(authClient, /mfa_required/);
  assert.match(login, /clearAuthMeCache/);
  assert.match(apiClient, /redirectToMfaIfRequired\(response\.status, message\)/);
  const mfaPage = readFileSync(
    new URL("../app/login/mfa/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(mfaPage, /mfa\.enroll/);
  assert.match(mfaPage, /challengeAndVerify/);
  assert.doesNotMatch(mfaPage, /design-only|Preview verification/);
});

test("frontend source never references the service-role secret", () => {
  const frontendRoot = fileURLToPath(new URL("..", import.meta.url));
  const sourceRoots = ["app", "components", "lib"];
  const sourceFiles: string[] = [];

  function collect(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        collect(path);
      } else if ([".ts", ".tsx"].includes(extname(entry.name))) {
        sourceFiles.push(path);
      }
    }
  }

  for (const sourceRoot of sourceRoots) {
    collect(join(frontendRoot, sourceRoot));
  }

  for (const sourceFile of sourceFiles) {
    const contents = readFileSync(sourceFile, "utf8");
    assert.doesNotMatch(contents, /SUPABASE_SERVICE_ROLE_KEY|service_role/i);
  }
});
