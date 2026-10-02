// Run: node --test src/pages/dashboardHomeNoLegacyQrCash.test.mjs
// DashboardHome must not read the legacy browser-local QR Cash list (simulated gifts only).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "DashboardHome.jsx"), "utf8");
const CODE = SRC.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").split("\n").map((l) => l.split("//")[0]).join("\n");

test("the legacy greetme_qrcash_gifts key is no longer read or written", () => {
  assert.doesNotMatch(CODE, /greetme_qrcash_gifts/);
  assert.doesNotMatch(CODE, /qrCashGifts|setQrCashGifts/);
});

test("history still comes from the server sent-greetings call", () => {
  assert.match(CODE, /api\.getSentGreetings\(\)/);
  assert.match(CODE, /sentGreetings\.map\(g => \(\{ \.\.\.g, type: 'greeting' \}\)\)/);
});
