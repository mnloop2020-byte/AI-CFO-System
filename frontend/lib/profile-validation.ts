export type PasswordValidationCode =
  | "too_short"
  | "missing_uppercase"
  | "missing_lowercase"
  | "missing_number"
  | "missing_symbol";

export function normalizeProfileName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 120) {
    throw new Error("invalid_name");
  }
  return normalized;
}

export function normalizeAvatarUrl(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > 2048) {
    throw new Error("invalid_avatar_url");
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("invalid_avatar_url");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("invalid_avatar_url");
  }
  return parsed.toString();
}

export function validateNewPassword(
  value: string,
): PasswordValidationCode | null {
  if (value.length < 12) return "too_short";
  if (!/[A-Z]/.test(value)) return "missing_uppercase";
  if (!/[a-z]/.test(value)) return "missing_lowercase";
  if (!/\d/.test(value)) return "missing_number";
  if (!/[^A-Za-z0-9]/.test(value)) return "missing_symbol";
  return null;
}
