// src/context/authLogoutGroupRun.test.mjs
//
// Team 5 H-1 (Report 112): an unfinished group run belongs to one account. Logging out removes it (and the
// dashboard's one-shot send hand-off) together with the other account-specific cached data, so the next account on
// the same browser can never see or resume it. (loadRun also refuses a run whose owner differs — groupSend.test.mjs.)
// Source scan of AuthContext's logout; AuthContext is wired to the network and router.
// Run (Node 20.x): node --test src/context/authLogoutGroupRun.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "AuthContext.jsx"), "utf8");
const GROUP = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "utils", "groupSend.js"), "utf8");

test("logout removes the stored group run and the dashboard hand-off", () => {
  const start = SRC.indexOf("const logout = () => {");
  assert.ok(start > -1);
  const body = SRC.slice(start, SRC.indexOf("setUser(null);", start));
  assert.match(body, /safeRemove\('gm_group_run_v1'\)/);
  assert.match(body, /sessionStorage\.removeItem\('gm_dashboard_send_handoff_v1'\)/);
});

test("the key logout removes is the one group runs are stored under", () => {
  assert.match(GROUP, /export const GROUP_RUN_KEY = 'gm_group_run_v1';/);
});
