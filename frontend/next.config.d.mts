export type DeploymentEnvironment =
  | "development"
  | "test"
  | "pilot"
  | "production";

export type RuntimeSecurityConfig = {
  environment: DeploymentEnvironment;
  apiOrigin: string;
  supabaseOrigin: string;
  supabaseRealtimeOrigin: string;
};

export function normalizeDeploymentEnvironment(
  value: string | undefined,
): DeploymentEnvironment;

export function normalizePublicOrigin(
  value: string | undefined,
  name: string,
  environment: DeploymentEnvironment,
  fallback?: string,
): string;

export function createRuntimeSecurityConfig(
  environmentVariables?: Record<string, string | undefined>,
): RuntimeSecurityConfig;

export function createContentSecurityPolicy(
  runtimeConfig: RuntimeSecurityConfig,
  nodeEnvironment?: string,
): string;

declare const nextConfig: import("next").NextConfig;
export default nextConfig;
