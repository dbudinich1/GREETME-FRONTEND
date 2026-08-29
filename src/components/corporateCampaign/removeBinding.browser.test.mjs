// src/components/corporateCampaign/removeBinding.browser.test.mjs
//
// TEAM A — the campaign Delete/Remove affordance bound to the committed removal contract.
//
// LAYER A — TRANSPORT. The REAL client from src/api/corporateCampaigns.js against a fake fetch,
//           proving the exact method and path the backend route accepts, and proving the client
//           sends NO mode — the server alone decides delete-vs-archive.
// LAYER B — SURFACE. The rendered card against an injected client boundary, proving the two-step
//           confirmation, the truthful label, and that nothing is claimed before the API confirms.
//
// Every status/shape below matches services/corporateCampaign/campaignRemoval.test.mjs.
//
// Run (Node 20.x): node --test src/components/corporateCampaign/removeBinding.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { createCorporateCampaignsClient } from "../../api/corporateCampaigns.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__remove.bundle.mjs");
const ENTRY = join(__dirname, ".__remove.entry.jsx");
const ORG = "corp_org_11111111-1111-4111-8111-111111111111";
const CID = "campaign_22222222-2222-4222-8222-222222222222";

let React, createRoot, act, Card, window;

before(async () => {
  writeFileSync(ENTRY, `export { default as Card } from "./CampaignCard.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react", logLevel: "silent",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  });
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://greet-me.com/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = await import("react"));
  ({ Card } = await import(`file://${BUNDLE.replace(/\\/g, "/")}?v=${Date.now()}`));
});

after(() => { for (const f of [ENTRY, BUNDLE, BUNDLE.replace(/\.mjs$/, ".css")]) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

const campaign = (over = {}) => ({
  campaignId: CID, name: "Birthdays", campaignType: "birthday",
  approvalStatus: "draft", lockStatus: "unlocked", enabled: false,
  deliveryConfig: null, audienceRefs: [], snapshotVersion: 0, ...over,
});

async function mount(props) {
  const host = window.document.getElementById("root");
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(Card, {
      campaign: campaign(), contacts: [], orgId: ORG, isOwner: true, busy: false, ...props,
    }));
  });
  return { host, root, q: (id) => host.querySelector(`[data-testid="${id}"]`) };
}

// ── LAYER A · TRANSPORT ─────────────────────────────────────────────────────

test("A1 · the client issues DELETE on the campaign path and sends NO body and NO mode", async () => {
  const calls = [];
  const client = createCorporateCampaignsClient({
    apiBase: "https://api.test",
    getToken: () => "jwt-token",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ campaignId: CID, mode: "delete", removed: true, reasons: [] }) };
    },
  });

  const res = await client.removeCampaign(ORG, CID);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "DELETE");
  assert.equal(calls[0].url, `https://api.test/api/corporate-campaigns/organizations/${encodeURIComponent(ORG)}/campaigns/${encodeURIComponent(CID)}`);
  assert.equal(calls[0].init.body, undefined, "no request body at all");
  assert.equal(calls[0].init.headers.Authorization, "Bearer jwt-token");
  assert.equal(res.ok, true);
  assert.equal(res.data.mode, "delete");

  // The client must not offer a mode parameter — the server decides.
  const src = (await import("node:fs")).readFileSync(new URL("../../api/corporateCampaigns.js", import.meta.url), "utf8");
  const line = src.split("\n").find((l) => l.includes("removeCampaign:"));
  assert.equal(/mode|archive|force|permanent/i.test(line), false, `the client must not send a mode: ${line}`);
});

test("A2 · an archive outcome and every documented refusal arrive readable", async () => {
  const mk = (status, payload) => createCorporateCampaignsClient({
    apiBase: "https://api.test", getToken: () => "t",
    fetchImpl: async () => ({ ok: status >= 200 && status < 300, status, json: async () => payload }),
  });

  const archived = await mk(200, { campaignId: CID, mode: "archive", removed: true, reasons: ["currently_locked"] }).removeCampaign(ORG, CID);
  assert.equal(archived.ok, true);
  assert.equal(archived.data.mode, "archive");
  assert.deepEqual(archived.data.reasons, ["currently_locked"]);

  const forbidden = await mk(403, { error: "forbidden", reason: "capability" }).removeCampaign(ORG, CID);
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.status, 403);

  const conflict = await mk(409, { error: "etag_conflict" }).removeCampaign(ORG, CID);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.status, 409);

  // A network failure is reported, never silently treated as success.
  const down = createCorporateCampaignsClient({
    apiBase: "https://api.test", getToken: () => "t",
    fetchImpl: async () => { throw new Error("offline"); },
  });
  const netErr = await down.removeCampaign(ORG, CID);
  assert.equal(netErr.ok, false);
  assert.equal(netErr.networkError, true);
});

// ── LAYER B · SURFACE ───────────────────────────────────────────────────────

test("B1 · removal requires an EXPLICIT second confirmation — one click never removes", async () => {
  let called = 0;
  const client = { removeCampaign: async () => { called++; return { ok: true, data: { mode: "delete", removed: true } }; } };
  const { q, root } = await mount({ client });

  const btn = q(`card-remove-${CID}`);
  assert.ok(btn, "the affordance is present on the card");
  assert.equal(q(`card-remove-confirm-${CID}`), null, "not armed initially");

  await act(async () => { btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.equal(called, 0, "the first press must NOT call the API");
  assert.ok(q(`card-remove-confirm-${CID}`), "it only arms the confirmation");

  await act(async () => { q(`card-remove-yes-${CID}`).dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.equal(called, 1, "only the confirmation calls the API");
  await act(async () => { root.unmount(); });
});

test("B2 · cancelling disarms and never calls the API", async () => {
  let called = 0;
  const client = { removeCampaign: async () => { called++; return { ok: true, data: {} }; } };
  const { q, root } = await mount({ client });
  await act(async () => { q(`card-remove-${CID}`).dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  await act(async () => { q(`card-remove-no-${CID}`).dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.equal(called, 0);
  assert.equal(q(`card-remove-confirm-${CID}`), null, "disarmed");
  assert.ok(q(`card-remove-${CID}`), "the affordance returns");
  await act(async () => { root.unmount(); });
});

test("B3 · the label is TRUTHFUL — a locked campaign is 'removed from the list', never 'deleted'", async () => {
  const client = { removeCampaign: async () => ({ ok: true, data: {} }) };

  const draft = await mount({ client });
  assert.match(draft.q(`card-remove-${CID}`).getAttribute("aria-label"), /^Delete /);
  await act(async () => { draft.q(`card-remove-${CID}`).dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.match(draft.q(`card-remove-confirm-${CID}`).textContent, /Delete permanently\?/);
  await act(async () => { draft.root.unmount(); });

  const locked = await mount({ client, campaign: campaign({ lockStatus: "locked" }) });
  const lbl = locked.q(`card-remove-${CID}`).getAttribute("aria-label");
  assert.match(lbl, /Remove .* from the active list/);
  assert.equal(/delete/i.test(lbl), false, "a locked campaign must never offer deletion");
  await act(async () => { locked.q(`card-remove-${CID}`).dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.match(locked.q(`card-remove-confirm-${CID}`).textContent, /Remove from list\?/);
  await act(async () => { locked.root.unmount(); });
});

test("B4 · a failed removal claims nothing and leaves the card in place", async () => {
  let after = 0;
  const client = { removeCampaign: async () => ({ ok: false, status: 409, data: { error: "etag_conflict" } }) };
  const { q, root } = await mount({ client, onAfterMutate: () => { after++; } });
  await act(async () => { q(`card-remove-${CID}`).dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  await act(async () => { q(`card-remove-yes-${CID}`).dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.equal(after, 0, "no refresh is signalled on failure — nothing is claimed");
  assert.ok(q(`card-remove-confirm-${CID}`), "still armed so the reader can retry");
  await act(async () => { root.unmount(); });
});

test("B5 · success reports upward exactly once, via the existing onAfterMutate seam", async () => {
  let after = 0;
  const client = { removeCampaign: async () => ({ ok: true, data: { mode: "archive", removed: true } }) };
  const { q, root } = await mount({ client, onAfterMutate: () => { after++; } });
  await act(async () => { q(`card-remove-${CID}`).dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  await act(async () => { q(`card-remove-yes-${CID}`).dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.equal(after, 1, "one refresh signal, through the seam that already exists");
  await act(async () => { root.unmount(); });
});

test("B6 · the affordance is disabled while the card is busy", async () => {
  const client = { removeCampaign: async () => ({ ok: true, data: {} }) };
  const { q, root } = await mount({ client, busy: true });
  assert.equal(q(`card-remove-${CID}`).disabled, true);
  await act(async () => { root.unmount(); });
});
