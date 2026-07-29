import assert from "node:assert/strict";
import test from "node:test";

import {
  createContentSecurityPolicy,
  createRuntimeSecurityConfig,
  normalizeDeploymentEnvironment,
  normalizePublicOrigin,
} from "../next.config.mjs";

test("deployment environment accepts only supported values", () => {
  assert.equal(normalizeDeploymentEnvironment(" PRODUCTION "), "production");
  assert.throws(
    () => normalizeDeploymentEnvironment("staging"),
    /DEPLOYMENT_ENV/,
  );
});

test("pilot and production require exact HTTPS origins", () => {
  assert.throws(
    () =>
      normalizePublicOrigin(
        "http://api.example.test",
        "NEXT_PUBLIC_API_URL",
        "production",
      ),
    /HTTPS/,
  );
  assert.throws(
    () =>
      normalizePublicOrigin(
        "https://api.example.test/path",
        "NEXT_PUBLIC_API_URL",
        "production",
      ),
    /exact HTTP\(S\) origin/,
  );
});

test("runtime CSP uses exact configured origins without wildcard or localhost", () => {
  const runtimeConfig = createRuntimeSecurityConfig({
    DEPLOYMENT_ENV: "production",
    NEXT_PUBLIC_API_URL: "https://api.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  });
  const policy = createContentSecurityPolicy(runtimeConfig, "production");

  assert.match(policy, /https:\/\/api\.example\.test/);
  assert.match(policy, /https:\/\/project\.supabase\.co/);
  assert.match(policy, /wss:\/\/project\.supabase\.co/);
  assert.doesNotMatch(policy, /\*/);
  assert.doesNotMatch(policy, /localhost|127\.0\.0\.1/);
  assert.doesNotMatch(policy, /unsafe-eval/);
});

test("development runtime uses local defaults explicitly", () => {
  const runtimeConfig = createRuntimeSecurityConfig({
    DEPLOYMENT_ENV: "development",
  });

  assert.equal(runtimeConfig.apiOrigin, "http://127.0.0.1:8000");
  assert.equal(runtimeConfig.supabaseOrigin, "http://127.0.0.1:54321");
  assert.equal(runtimeConfig.supabaseRealtimeOrigin, "ws://127.0.0.1:54321");
});

test("Vercel deployments fail closed without an explicit deployment mode", () => {
  assert.throws(
    () =>
      createRuntimeSecurityConfig({
        VERCEL: "1",
        NEXT_PUBLIC_API_URL: "https://api.example.test",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      }),
    /DEPLOYMENT_ENV is required/,
  );
});
