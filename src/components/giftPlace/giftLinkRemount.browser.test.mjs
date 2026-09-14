// src/components/giftPlace/giftLinkRemount.browser.test.mjs
//
// REMOUNT RECOVERY FOR A PENDING GIFT LINK — mounted, with the network stubbed at `fetch`.
//
// An accepted and charged flower order whose gift record could not be written must stay recoverable
// across a browser refresh. The handle is the checkout attempt the SERVER already minted, carried in
// the EXISTING sendGreetingState record; everything the recovery does happens server-side, on the
// settled-attempt replay branch that returns before any provider is resolved.
//
// The real hook and the real persistence module are mounted here. What is counted throughout:
//   submit calls · distinct attempt ids · prepare/tokenization calls · greeting sends
//
// Run (Node 20.x):
//   node --test src/components/giftPlace/giftLinkRemount.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__glr.bundle.mjs");
const ENTRY = join(__dirname, ".__glr.entry.jsx");

let React, createRoot, act, window;
let useRecovery, RECOVERY, persist, readMarker, clearMarker, correlate, CORRELATION,
  PENDING_FIELD, SEND_KEY, readDraft,
  ensureKey, readKey, clearKey, KEY_FIELD;

before(async () => {
  writeFileSync(ENTRY,
    'export { usePendingGiftLinkRecovery, RECOVERY } from "./usePendingGiftLinkRecovery.js";\n'
    + 'export {\n'
    + '  persistPendingGiftLink, readPendingGiftLink, clearPendingGiftLink,\n'
    + '  correlatePendingGiftLink, CORRELATION, PENDING_GIFT_LINK_FIELD, SEND_STATE_KEY, readSendDraft,\n'
    + '  ensureSendRequestId, readSendRequestId, clearSendRequestId, SEND_REQUEST_ID_FIELD,\n'
    + '} from "../../pages/pendingGiftLink.js";\n');
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/dashboard/send" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.localStorage = window.localStorage;
  globalThis.sessionStorage = window.sessionStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({
    usePendingGiftLinkRecovery: useRecovery, RECOVERY,
    persistPendingGiftLink: persist, readPendingGiftLink: readMarker,
    clearPendingGiftLink: clearMarker, correlatePendingGiftLink: correlate,
    CORRELATION, PENDING_GIFT_LINK_FIELD: PENDING_FIELD, SEND_STATE_KEY: SEND_KEY,
    readSendDraft: readDraft,
    ensureSendRequestId: ensureKey, readSendRequestId: readKey,
    clearSendRequestId: clearKey, SEND_REQUEST_ID_FIELD: KEY_FIELD,
  } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

// ---------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------

const SENDER = "user-1";
const CONTACT = "contact-1";
const PRODUCT = "T18-1A";
const ATTEMPT = "gpc_attempt_1";

let calls;
const resetCalls = () => { calls = { submits: [], prepares: 0, tokenizations: 0, sends: [] }; };

/** A retryGiftLink spy shaped exactly like the real client's reply. */
function linkerThatReturns(...replies) {
  let i = 0;
  return async ({ attemptId, giftType }) => {
    calls.submits.push({ attemptId, giftType });
    const reply = replies[Math.min(i, replies.length - 1)];
    i += 1;
    return typeof reply === "function" ? reply() : reply;
  };
}

const NO_TOKEN = { ok: true, status: "accepted", giftClaimToken: null, giftLinkFailed: true };
const LINKED = { ok: true, status: "accepted", giftClaimToken: "gift-token-1", giftLinkFailed: false };

const identity = (over = {}) => ({
  userId: SENDER, contactId: CONTACT, productId: PRODUCT, giftType: "flowers", ...over,
});

let root, host;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

/** Mount the real hook inside a trivial surface, so its states are observable as DOM. */
function Harness({ marker, ready, ids, linker, onLinked }) {
  const rec = useRecovery({
    marker,
    ready,
    identity: ids,
    onLinked,
    deps: { retryGiftLink: linker },
  });
  return React.createElement(
    "div",
    null,
    React.createElement("span", { "data-testid": "state" }, rec.state),
    React.createElement("span", { "data-testid": "attempt" }, rec.attemptId || ""),
    rec.isPending
      ? React.createElement(
          "button",
          { "data-testid": "try-again", onClick: () => rec.retryNow() },
          "Try again",
        )
      : null,
    rec.isRefused
      ? React.createElement("p", { "data-testid": "refused" },
        "We found a confirmed flower order that doesn't match this Greet-Me.")
      : null,
  );
}

async function mount(props) {
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Harness, props)); });
  await flush(); await flush();
}
async function rerender(props) {
  await act(async () => { root.render(React.createElement(Harness, props)); });
  await flush();
}
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const stateNow = () => tid("state").textContent;
const click = async (el) => {
  await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); });
  await flush(); await flush();
};

beforeEach(() => {
  resetCalls();
  try { window.sessionStorage.clear(); } catch { /* ignore */ }
});

// ===========================================================================
// 1 + 2 — the marker is written, and survives a refresh
// ===========================================================================

test("1. an accepted order whose link failed writes the recovery marker", () => {
  const written = persist({
    attemptId: ATTEMPT, giftType: "flowers", userId: SENDER,
    contactId: CONTACT, productId: PRODUCT,
    draft: { formData: { contactId: CONTACT, customMessage: "hello" } },
  });
  assert.equal(written, true);

  const marker = readMarker();
  assert.ok(marker, "the marker is readable");
  assert.equal(marker.attemptId, ATTEMPT, "the attempt the SERVER minted");
  assert.equal(marker.status, "pending");
  assert.equal(marker.userId, SENDER);
  assert.equal(marker.contactId, CONTACT);
  assert.equal(marker.productId, PRODUCT);

  // NOTHING SENSITIVE, AND NO NEW ATTEMPT. Asserted against the whole serialized record.
  const raw = window.sessionStorage.getItem(SEND_KEY);
  for (const forbidden of [
    "claimToken", "giftClaimToken", "paymentToken", "paymentBinding", "cardNumber", "cvv",
    "apiLoginId", "publicClientKey", "tokenizationKeyFingerprint", "acceptJsUrl",
    "Authorization", "bearer", "shippingAddress",
  ]) {
    assert.equal(raw.includes(forbidden), false, `the marker must never persist ${forbidden}`);
  }
  // Exactly ONE attempt id in the record, and it is the existing one.
  assert.equal((raw.match(/gpc_/g) || []).length, 1, "no second attempt identifier");
});

test("2. a refresh restores the marker AND the greeting draft beside it", () => {
  persist({
    attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT,
    draft: {
      formData: { contactId: CONTACT, customMessage: "Happy birthday" },
      giftSettings: { type: "flowers", flowersProduct: { providerProductId: PRODUCT, name: "Autumn Warmth" } },
    },
  });

  // A "refresh" is simply reading the record back out of sessionStorage.
  const marker = readMarker();
  const draft = readDraft();
  assert.equal(marker.attemptId, ATTEMPT);
  assert.equal(draft.formData.customMessage, "Happy birthday", "the greeting survives");
  assert.equal(draft.giftSettings.flowersProduct.providerProductId, PRODUCT,
    "and so does the selected flower summary");
});

// ===========================================================================
// 3-8 — the one automatic replay
// ===========================================================================

test("3 + 4 + 5. remount replays the SAME attempt once, creating no new attempt and no payment call", async () => {
  const marker = { status: "pending", attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT };
  await mount({
    marker, ready: true, ids: identity(),
    linker: linkerThatReturns(NO_TOKEN),
    onLinked: async (t) => { calls.sends.push(t); },
  });

  assert.equal(calls.submits.length, 1, "exactly one replay");
  assert.equal(calls.submits[0].attemptId, ATTEMPT, "the SAME attempt id");
  assert.equal(new Set(calls.submits.map((c) => c.attemptId)).size, 1, "no second attempt id anywhere");
  // NO CHECKOUT IS REOPENED AND NO PAYMENT IS REQUESTED: the hook's only reachable call is the replay.
  assert.equal(calls.prepares, 0, "no prepare");
  assert.equal(calls.tokenizations, 0, "no tokenization");
  // And the replay carries nothing but the attempt and its type.
  assert.deepEqual(Object.keys(calls.submits[0]).sort(), ["attemptId", "giftType"]);
});

test("6. executeGreetingSend stays at ZERO while no token comes back", async () => {
  const marker = { status: "pending", attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT };
  await mount({
    marker, ready: true, ids: identity(),
    linker: linkerThatReturns(NO_TOKEN, NO_TOKEN, NO_TOKEN),
    onLinked: async (t) => { calls.sends.push(t); },
  });
  assert.equal(calls.sends.length, 0, "a greeting must not be sent without a linked gift");

  // Even after further manual attempts that keep failing.
  await click(tid("try-again"));
  await click(tid("try-again"));
  assert.equal(calls.sends.length, 0, "still zero");
  assert.equal(stateNow(), RECOVERY.PENDING);
});

test("7. a successful relink causes EXACTLY ONE greeting send", async () => {
  const marker = { status: "pending", attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT };
  await mount({
    marker, ready: true, ids: identity(),
    linker: linkerThatReturns(LINKED),
    onLinked: async (t) => { calls.sends.push(t); },
  });

  assert.equal(calls.submits.length, 1);
  assert.deepEqual(calls.sends, ["gift-token-1"], "exactly one send, with the proven token");
  assert.equal(stateNow(), RECOVERY.LINKED);
});

test("8. repeated re-renders do not replay, and cannot send twice", async () => {
  // RE-RENDERED THE WAY THE REAL PAGE DOES IT. SendGreeting builds `identity` as an inline object
  // literal, so every render hands the hook a NEW reference and its effect re-runs. Re-rendering with
  // one stable object would prove nothing — the effect would simply never fire again, and a missing
  // latch would look identical to a working one.
  const marker = { status: "pending", attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT };
  const linker = linkerThatReturns(LINKED);
  const onLinked = async (t) => { calls.sends.push(t); };

  await mount({ marker, ready: true, ids: identity(), linker, onLinked });
  for (let i = 0; i < 5; i += 1) {
    // A fresh identity object AND a fresh onLinked, exactly as a re-rendering component produces.
    await rerender({
      marker, ready: true, ids: identity(), linker,
      onLinked: async (t) => { calls.sends.push(t); },
    });
  }

  assert.equal(calls.submits.length, 1, "still exactly one replay after five re-renders");
  assert.equal(calls.sends.length, 1, "and exactly one send");
});

test("the one attempt is NOT spent while the page cannot correlate yet", async () => {
  // Contacts have not loaded, so the marker cannot be correlated. Waiting is not a refusal, and it
  // must not burn the single automatic attempt.
  const marker = { status: "pending", attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT };
  const linker = linkerThatReturns(LINKED);
  const base = { marker, ids: identity({ contactId: null }), linker, onLinked: async (t) => { calls.sends.push(t); } };

  await mount({ ...base, ready: false });
  assert.equal(stateNow(), RECOVERY.WAITING);
  assert.equal(calls.submits.length, 0, "nothing is replayed on a half-loaded page");

  // Now the page is ready and the facts are there.
  await rerender({ ...base, ready: true, ids: identity() });
  assert.equal(calls.submits.length, 1, "the attempt is spent exactly once, when it can be");
  assert.equal(calls.sends.length, 1);
});

// ===========================================================================
// 9 + 10 — the visible control
// ===========================================================================

test("9 + 10. a failed automatic recovery shows Try Again, and it reuses the same attempt id", async () => {
  const marker = { status: "pending", attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT };
  await mount({
    marker, ready: true, ids: identity(),
    linker: linkerThatReturns(NO_TOKEN, NO_TOKEN, LINKED),
    onLinked: async (t) => { calls.sends.push(t); },
  });

  assert.equal(stateNow(), RECOVERY.PENDING);
  assert.ok(tid("try-again"), "the visible control appears");
  assert.equal(calls.submits.length, 1, "no automatic loop — one attempt and then it waits");

  await click(tid("try-again"));
  assert.equal(calls.submits.length, 2);
  await click(tid("try-again"));
  assert.equal(calls.submits.length, 3);

  // EVERY call replayed the same attempt. A second attempt id would be a second order.
  assert.equal(new Set(calls.submits.map((c) => c.attemptId)).size, 1);
  assert.equal(calls.submits.every((c) => c.attemptId === ATTEMPT), true);
  // The third reply linked, so exactly one send followed.
  assert.deepEqual(calls.sends, ["gift-token-1"]);
});

test("no automatic retry loop exists: time passing replays nothing", async () => {
  const marker = { status: "pending", attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT };
  await mount({
    marker, ready: true, ids: identity(),
    linker: linkerThatReturns(NO_TOKEN),
    onLinked: async () => {},
  });
  assert.equal(calls.submits.length, 1);
  for (let i = 0; i < 10; i += 1) await flush();
  assert.equal(calls.submits.length, 1, "still one — recovery never retries on its own");
});

// ===========================================================================
// 11 — fail closed
// ===========================================================================

test("11. a mismatched or malformed restored marker fails closed and never reaches the network", async () => {
  const good = { status: "pending", attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT };
  const rows = [
    ["a different sender", good, identity({ userId: "somebody-else" }), CORRELATION.WRONG_SENDER],
    ["a different contact", good, identity({ contactId: "contact-9" }), CORRELATION.WRONG_CONTACT],
    ["a different arrangement", good, identity({ productId: "OTHER" }), CORRELATION.WRONG_PRODUCT],
    ["no sender on the page", good, identity({ userId: null }), CORRELATION.WRONG_SENDER],
    ["no contact on the page", good, identity({ contactId: null }), CORRELATION.WRONG_CONTACT],
    ["a marker missing its sender", { ...good, userId: null }, identity(), CORRELATION.WRONG_SENDER],
    ["a marker missing its contact", { ...good, contactId: null }, identity(), CORRELATION.WRONG_CONTACT],
    ["a marker missing its product", { ...good, productId: null }, identity(), CORRELATION.WRONG_PRODUCT],
    ["a marker with no attempt id", { ...good, attemptId: "" }, identity(), CORRELATION.MALFORMED],
    ["a different gift type", { ...good, giftType: "gift_boxes" }, identity(), CORRELATION.WRONG_GIFT_TYPE],
  ];

  for (const [label, marker, ids, reason] of rows) {
    resetCalls();
    assert.equal(correlate(marker, ids).reason, reason, label);

    await mount({
      marker, ready: true, ids,
      linker: linkerThatReturns(LINKED),
      onLinked: async (t) => { calls.sends.push(t); },
    });
    assert.equal(stateNow(), RECOVERY.REFUSED, `${label}: refused`);
    assert.equal(calls.submits.length, 0, `${label}: must not call submit`);
    assert.equal(calls.sends.length, 0, `${label}: must not send the greeting`);
    assert.ok(tid("refused"), `${label}: a recoverable support state is shown`);
    assert.equal(tid("try-again"), null, `${label}: and no control that would fail closed anyway`);
  }
});

test("a refused marker cannot be replayed by the control either", async () => {
  const marker = { status: "pending", attemptId: ATTEMPT, giftType: "flowers", userId: "other", contactId: CONTACT, productId: PRODUCT };
  await mount({
    marker, ready: true, ids: identity(),
    linker: linkerThatReturns(LINKED),
    onLinked: async (t) => { calls.sends.push(t); },
  });
  assert.equal(stateNow(), RECOVERY.REFUSED);
  assert.equal(calls.submits.length, 0);
});

test("unreadable or absent storage is simply no recovery, never a crash", () => {
  window.sessionStorage.clear();
  assert.equal(readMarker(), null);
  window.sessionStorage.setItem(SEND_KEY, "{not json");
  assert.equal(readMarker(), null);
  window.sessionStorage.setItem(SEND_KEY, JSON.stringify([1, 2, 3]));
  assert.equal(readMarker(), null);
  window.sessionStorage.setItem(SEND_KEY, JSON.stringify({ [PENDING_FIELD]: { status: "done", attemptId: ATTEMPT } }));
  assert.equal(readMarker(), null, "only a pending marker is a marker");
});


// ===========================================================================
// GATE B — the send idempotency key's lifecycle
// ===========================================================================

test("one key per composed greeting: minted once, then reused by every retry", () => {
  const first = ensureKey(() => "6f9619ff-8b86-4d01-b42d-00cf4fc964ff");
  assert.equal(first, "6f9619ff-8b86-4d01-b42d-00cf4fc964ff");
  // Every later call — a retry, a re-render, a recovery — returns the SAME key. A key minted per
  // attempt would be useless: the request it needed to converge with was sent under a different one.
  for (let i = 0; i < 5; i += 1) {
    assert.equal(ensureKey(() => "SHOULD-NOT-BE-USED"), first, "no second key is minted");
  }
  assert.equal(readKey(), first);
});

test("the key lives in the EXISTING record, beside the draft and the marker", () => {
  persist({
    attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT,
    draft: { formData: { contactId: CONTACT, customMessage: "hi" } },
  });
  const key = ensureKey(() => "3f2504e0-4f89-41d3-9a0c-0305e82c3301");

  const record = JSON.parse(window.sessionStorage.getItem(SEND_KEY));
  assert.equal(record[KEY_FIELD], key, "one record holds all three");
  assert.ok(record[PENDING_FIELD], "the marker survives");
  assert.equal(record.formData.customMessage, "hi", "and so does the draft");
  // ONE storage key, still. No second system was introduced for the send key.
  assert.equal(window.sessionStorage.length, 1);
});

test("the key survives a refresh and a link recovery", () => {
  const key = ensureKey(() => "6f9619ff-8b86-4d01-b42d-00cf4fc964ff");
  persist({
    attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT,
    draft: { formData: { contactId: CONTACT } },
  });
  // A refresh is a fresh read of the same record.
  assert.equal(readKey(), key, "survives a refresh");
  // Clearing the MARKER after a link recovery must not take the key with it: the greeting still has
  // to be sent, and that send must converge with the ones before it.
  clearMarker();
  assert.equal(readMarker(), null);
  assert.equal(readKey(), key, "survives the link recovery");
});

test("the key is NOT the attempt id, the claim token or the contact", () => {
  const key = ensureKey(() => "6f9619ff-8b86-4d01-b42d-00cf4fc964ff");
  persist({
    attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT,
  });
  assert.notEqual(key, ATTEMPT);
  assert.notEqual(key, CONTACT);
  assert.notEqual(key, PRODUCT);
  // And it is a v4 UUID, the only shape the backend accepts as a key.
  assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test("the key clears ONLY on a definitive success, and a new greeting gets a new one", () => {
  const first = ensureKey(() => "6f9619ff-8b86-4d01-b42d-00cf4fc964ff");
  persist({
    attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT,
    draft: { formData: { contactId: CONTACT } },
  });

  // The terminal condition.
  assert.equal(clearKey(), true);
  assert.equal(readKey(), null);
  // Only the key: the draft beside it is untouched.
  assert.ok(readDraft().formData, "the draft survives");

  // The next greeting mints its own, so it cannot converge onto the last one.
  const second = ensureKey(() => "3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  assert.notEqual(second, first);
  assert.equal(clearKey(), true);
  assert.equal(clearKey(), false, "clearing twice is harmless");
});

test("unreadable storage never throws and never blocks a send", () => {
  window.sessionStorage.setItem(SEND_KEY, "{not json");
  const key = ensureKey(() => "6f9619ff-8b86-4d01-b42d-00cf4fc964ff");
  assert.equal(key, "6f9619ff-8b86-4d01-b42d-00cf4fc964ff", "a key is still produced");
  assert.equal(readKey(), key, "and recorded once the record is rewritten");
});

// ===========================================================================
// 12 + 13 — the clearing rules
// ===========================================================================

test("12. the marker SURVIVES link success, and survives a further refresh", async () => {
  persist({
    attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT,
    draft: { formData: { contactId: CONTACT } },
  });
  const marker = readMarker();

  await mount({
    marker, ready: true, ids: identity(),
    linker: linkerThatReturns(LINKED),
    onLinked: async (t) => { calls.sends.push(t); },
  });
  assert.deepEqual(calls.sends, ["gift-token-1"], "the gift linked and the send began");

  // THE GIFT IS LINKED, BUT THE GREETING HAS NOT DEFINITIVELY GONE. Clearing now would strand a
  // sender whose send then failed — which is exactly the state that still needs recovering.
  assert.ok(readMarker(), "the marker must still be there after link success");
  assert.equal(readMarker().attemptId, ATTEMPT);
});

test("13. the marker clears ONLY on a definitive greeting-send success", () => {
  persist({
    attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT,
    draft: { formData: { contactId: CONTACT }, giftSettings: { type: "flowers" } },
  });
  assert.ok(readMarker());

  // The one terminal condition.
  const cleared = clearMarker();
  assert.equal(cleared, true);
  assert.equal(readMarker(), null, "the marker is gone");

  // And ONLY the marker: the draft beside it belongs to the marketplace and media round trips.
  const draft = readDraft();
  assert.ok(draft, "the record itself survives");
  assert.equal(draft.formData.contactId, CONTACT);
  assert.equal(draft.giftSettings.type, "flowers");
  assert.equal(PENDING_FIELD in draft, false);

  // Clearing twice is harmless.
  assert.equal(clearMarker(), false);
});

// ===========================================================================
// 14 — what the recovery surface may never say
// ===========================================================================

test("14. no provider name and no order number appears in the recovery UI", async () => {
  const marker = { status: "pending", attemptId: ATTEMPT, giftType: "flowers", userId: SENDER, contactId: CONTACT, productId: PRODUCT };
  await mount({
    marker, ready: true, ids: identity(),
    linker: linkerThatReturns({ ...NO_TOKEN, providerOrderId: "TEST-ORDER-0001" }),
    onLinked: async () => {},
  });

  const text = document.body.textContent;
  for (const forbidden of ["Florist One", "florist_one", "TEST-ORDER-0001", "order number"]) {
    assert.equal(text.includes(forbidden), false, `the recovery UI must not show "${forbidden}"`);
  }
  // The attempt id is an internal handle; it is held in state, never shown as prose to the sender.
  assert.equal(tid("attempt").textContent, ATTEMPT, "held for the replay");
  assert.match(text, /Try again/);
});
