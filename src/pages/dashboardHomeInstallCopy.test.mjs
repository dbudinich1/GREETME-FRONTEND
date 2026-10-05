// Run: node --test src/pages/dashboardHomeInstallCopy.test.mjs
// W41: the install panel is a home-screen (PWA) install page, not an app-store download.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "DashboardHome.jsx"), "utf8");
const CODE = SRC.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").split("\n").map((l) => l.split("//")[0]).join("\n");

test("visible install copy matches the home-screen wording and claims no store", () => {
  assert.match(CODE, />Add Greet-Me™ to Your Home Screen<\/h3>/);
  assert.match(CODE, /Scan the QR code to open the install page\. No app store needed\./);
  assert.doesNotMatch(CODE, /Download Greet-Me|Mobile App|scan QR code to download/);
});
