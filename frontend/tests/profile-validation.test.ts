import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAvatarUrl,
  normalizeProfileName,
  validateNewPassword,
} from "../lib/profile-validation.ts";

test("normalizes a profile name without changing its meaning", () => {
  assert.equal(normalizeProfileName("  Pilot   Owner  "), "Pilot Owner");
});

test("rejects an empty or oversized profile name", () => {
  assert.throws(() => normalizeProfileName("   "));
  assert.throws(() => normalizeProfileName("x".repeat(121)));
});

test("accepts only optional HTTPS avatar URLs", () => {
  assert.equal(normalizeAvatarUrl(""), null);
  assert.equal(
    normalizeAvatarUrl("https://example.com/avatar.png"),
    "https://example.com/avatar.png",
  );
  assert.throws(() => normalizeAvatarUrl("http://example.com/avatar.png"));
  assert.throws(() => normalizeAvatarUrl("javascript:alert(1)"));
});

test("enforces the profile password policy", () => {
  assert.equal(validateNewPassword("short"), "too_short");
  assert.equal(validateNewPassword("lowercase123!"), "missing_uppercase");
  assert.equal(validateNewPassword("UPPERCASE123!"), "missing_lowercase");
  assert.equal(validateNewPassword("NoNumbersHere!"), "missing_number");
  assert.equal(validateNewPassword("NoSymbolsHere123"), "missing_symbol");
  assert.equal(validateNewPassword("StrongProfile!123"), null);
});
