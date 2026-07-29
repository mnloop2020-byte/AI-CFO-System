import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const deployedEnvironments = new Set(["pilot", "production"]);

export function normalizeDeploymentEnvironment(value) {
  const environment = (value ?? "development").trim().toLowerCase();

  if (!["development", "test", ...deployedEnvironments].includes(environment)) {
    throw new Error(
      "DEPLOYMENT_ENV must be development, test, pilot, or production.",
    );
  }

  return environment;
}

export function normalizePublicOrigin(value, name, environment, fallback) {
  const candidate = (value || fallback || "").trim().replace(/\/+$/, "");

  if (!candidate) {
    throw new Error(`${name} is required for ${environment}.`);
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) origin.`);
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `${name} must be an exact HTTP(S) origin without credentials, path, query, or fragment.`,
    );
  }

  if (deployedEnvironments.has(environment) && parsed.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS for pilot and production.`);
  }

  return parsed.origin;
}

export function createRuntimeSecurityConfig(environmentVariables = process.env) {
  if (
    environmentVariables.VERCEL === "1" &&
    !environmentVariables.DEPLOYMENT_ENV
  ) {
    throw new Error("DEPLOYMENT_ENV is required for Vercel deployments.");
  }
  const environment = normalizeDeploymentEnvironment(
    environmentVariables.DEPLOYMENT_ENV,
  );
  const apiOrigin = normalizePublicOrigin(
    environmentVariables.NEXT_PUBLIC_API_URL,
    "NEXT_PUBLIC_API_URL",
    environment,
    deployedEnvironments.has(environment) ? undefined : "http://127.0.0.1:8000",
  );
  const supabaseOrigin = normalizePublicOrigin(
    environmentVariables.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL",
    environment,
    deployedEnvironments.has(environment) ? undefined : "http://127.0.0.1:54321",
  );
  const supabaseRealtimeOrigin = new URL(supabaseOrigin);
  supabaseRealtimeOrigin.protocol =
    supabaseRealtimeOrigin.protocol === "https:" ? "wss:" : "ws:";

  return {
    environment,
    apiOrigin,
    supabaseOrigin,
    supabaseRealtimeOrigin: supabaseRealtimeOrigin.origin,
  };
}

export function createContentSecurityPolicy(
  runtimeConfig,
  nodeEnvironment = process.env.NODE_ENV,
) {
  const isDevelopment = nodeEnvironment !== "production";
  const scriptPolicy = isDevelopment
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    scriptPolicy,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${runtimeConfig.apiOrigin} ${runtimeConfig.supabaseOrigin} ${runtimeConfig.supabaseRealtimeOrigin}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: frontendRoot,
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    return [
      {
        source: "/api/backend/:path*",
        destination: "http://127.0.0.1:8000/:path*",
      },
    ];
  },
  async headers() {
    const runtimeConfig = createRuntimeSecurityConfig();
    const contentSecurityPolicy = createContentSecurityPolicy(runtimeConfig);
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
