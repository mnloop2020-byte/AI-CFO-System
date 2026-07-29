import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


test("stored language is loaded before the default can be persisted", () => {
  const provider = readFileSync(
    new URL(
      "../components/providers/LanguageProvider.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  const loadedState = provider.indexOf(
    "setHasLoadedStoredLanguage(true)",
  );
  const persistGuard = provider.indexOf(
    "if (!hasLoadedStoredLanguage)",
  );
  const storageWrite = provider.indexOf(
    "window.localStorage.setItem",
  );

  assert.ok(loadedState >= 0);
  assert.ok(persistGuard > loadedState);
  assert.ok(storageWrite > persistGuard);
});
