// src/components/corporateCampaign/SendNowFlow.jsx
//
// SURFACE 8 - "Send a Greet-Me now": a ONE-TIME, UNSCHEDULED send from the corporate dashboard, owner only.
// Three steps: Who (a category or one contact) -> What (a gift or none, and the owner's "Exclude Featured
// Spread" option) -> Review and send. The review is the server's own preview (recipients, plan capacity, gift
// quote, sender, blockers); the final button is the approval and says it is final. There is no cancel.
//
// The component holds NO rules of its own: it asks the server (preview), shows the answer, and sends exactly
// what was reviewed (expected recipient count and gift total) under one idempotency key per review, so a retry
// after a lost response can never send twice.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CONTACT_CATEGORIES, CURATED_TIERS_CENTS, centsToDisplay, corporateGiftOptions, giftOptionState, qrCashDollarsToCents,
  PROVIDER_GIFT_OPTION, isProviderFundableGiftType, publishedCatalogItems, publishedVariantNames, selectedProductId,
  toggleVariantSelection, isStaleProductSelection,
} from "./corporateDashboardModel.js";
import { BubbleGroup, ChoiceBubble } from "./Bubbles.jsx";
import SavedCardPanel from "./SavedCardPanel.jsx";
import {
  buildPreviewRequest, buildSendRequest, newIdempotencyKey, planLine, blockerText, notReadyText, giftPayload, totalLine, canConfirm,
  FINAL_BUTTON_LABEL, FINAL_NOTE, TOP_UP_HREF, UPGRADE_HREF, money, OCCASIONS, isOccasion, linkHref, perRecipientCosts,
  PAYMENT_UNCERTAIN_TEXT, UNRESOLVED_PAYMENT_CODES, buildPendingRecord, loadPending, savePending, clearPending,
  oneTimeSendIdFor, paymentStateFromStatus, RESOLVED_FOR_SEND, PAYMENT_STATUS_TEXT, pendingKeyFor, SEND_IN_FLIGHT_MS,
} from "./oneTimeSendModel.js";
import "./premiumDashboard.css";

const SHOWN_NAMES = 8;
// The global `input { width: 100% }` rule (index.css) stretches a checkbox across the row; these keep the box beside its
// label with a 44px tap row.
const CHECK_ROW = { display: "flex", alignItems: "center", gap: 8, minHeight: 44 };
const CHECK_BOX = { width: "auto", margin: 0, flexShrink: 0 };

// Founder 2026-10-28: "contact support" in a message links to the existing Support page.
function withSupportLink(text) {
  const t = String(text || "");
  const i = t.indexOf("contact support");
  if (i < 0) return t;
  return <>{t.slice(0, i)}<a href="#/support" data-testid="sendnow-support-link" style={{ textDecoration: "underline", fontWeight: 600 }}>contact support</a>{t.slice(i + "contact support".length)}</>;
}
function defaultStorage() {
  try { return typeof window !== "undefined" && window.localStorage ? window.localStorage : null; } catch { return null; }
}
// After the status check PROVED no payment was taken, the replacement-card refusal needs no statement caveat.
const PENDING_REPLACE_PROVEN_TEXT = "No payment was taken, and this card can’t be tried again for this send. Add a different card below, then press Send now.";
const PENDING_CHANGED_TEXT = "This send changed since it was confirmed (its price or its recipients), so it can\u2019t be finished as it stands. Nothing more was charged. If a payment was taken for it, contact support; if not, start over.";

// `catalogClient`: the campaigns client, whose listGiftCatalog is the campaign editor's own organization catalog read.
// `storage`: where an unresolved paid send is kept (defaults to this browser's localStorage); injectable for tests.
export default function SendNowFlow({ orgId, contacts, client, catalogClient, cardClient, stripeOverride, onSent, storage }) {
  const [open, setOpen] = useState(false);
  // Founder 2026-10-28 - an unresolved paid send, kept across closing, reopening and refresh. While it exists the flow
  // reopens on it, locked; Send is disabled until a read-only status check shows the payment resolved.
  const store = useMemo(() => (storage !== undefined ? storage : defaultStorage()), [storage]);
  const [pending, setPending] = useState(() => loadPending(store, orgId));
  const [payState, setPayState] = useState(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => { setPending(loadPending(store, orgId)); setPayState(null); }, [store, orgId]);
  // Another tab of this browser kept (or cleared) a send for this organisation: follow it at once (Team 5, 2026-10-28).
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return undefined;
    const onStorage = (e) => { if (!e || e.key === null || e.key === pendingKeyFor(orgId)) { setPending(loadPending(store, orgId)); setPayState(null); } };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [store, orgId]);
  const [step, setStep] = useState(1);
  const [who, setWho] = useState("category");
  const [category, setCategory] = useState("client");
  const [contactId, setContactId] = useState("");
  const [occasionType, setOccasionType] = useState("");
  const [giftType, setGiftType] = useState("none");
  const [tier, setTier] = useState(CURATED_TIERS_CENTS[0]);
  // RELEASE 2 - QR Cash: the typed whole-dollar amount. Empty until the person chooses one; no default is invented.
  const [qrDollars, setQrDollars] = useState("");
  const qrCents = qrCashDollarsToCents(qrDollars);
  // Gift box (founder 2026-10-28): the campaign editor's catalog, product and option selection, reused unchanged.
  const [giftCatalog, setGiftCatalog] = useState({ items: [], read: false });
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [excludeSpread, setExcludeSpread] = useState(false);
  const [skipNotReady, setSkipNotReady] = useState(false);
  const [review, setReview] = useState({ state: "idle", preview: null, error: null });
  const [outcome, setOutcome] = useState(null);       // { kind: "sent"|"error"|"unsure", ... }
  const [busy, setBusy] = useState(false);
  const keyRef = useRef(null);
  const sendingRef = useRef(false);

  const list = Array.isArray(contacts) ? contacts : [];
  const inCategory = list.filter((c) => c.corporateContactType === category);
  const chosenCount = who === "single" ? (contactId ? 1 : 0) : inCategory.length;
  const giftOptions = corporateGiftOptions({ catalogItemCount: giftCatalog.items.length, currentGiftType: giftType });
  const isGiftBox = isProviderFundableGiftType(giftType);
  const productChosen = isGiftBox ? selectedProductId(product) : "";
  const variantChoices = publishedVariantNames(product);
  const staleProduct = isStaleProductSelection({ giftType, product, items: giftCatalog.items, catalogRead: giftCatalog.read });
  // A box that publishes options needs one chosen before the review; the server's quote stays the authority.
  const optionsMissing = Boolean(productChosen) && variantChoices.length > 0 && variants.length === 0;
  const giftBoxBlocked = isGiftBox && (!productChosen || staleProduct || optionsMissing);
  const giftBoxNote = !isGiftBox ? null
    : staleProduct ? "That gift box is no longer published. Choose another one."
      : !productChosen ? "Choose a gift box."
        : optionsMissing ? "Choose an option for this gift box." : null;

  // The same organization-scoped read the campaign editor makes, once the flow is opened. Fail-closed and silent: a
  // refusal, a dormant provider and an empty catalog all mean there is no gift box to offer.
  useEffect(() => {
    if (!open || !catalogClient || typeof catalogClient.listGiftCatalog !== "function") return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await catalogClient.listGiftCatalog(orgId, PROVIDER_GIFT_OPTION.value);
        if (alive) setGiftCatalog({ items: publishedCatalogItems(res), read: Boolean(res && res.ok === true) });
      } catch {
        if (alive) setGiftCatalog({ items: [], read: false });
      }
    })();
    return () => { alive = false; };
  }, [open, catalogClient, orgId]);

  const previewBody = useMemo(() => buildPreviewRequest({
    who, category, contactId, occasionType, gift: giftPayload(giftType, tier, qrCents, isGiftBox ? product : null, variants),
    excludeFeaturedSpread: excludeSpread, skipNotReady,
  }), [who, category, contactId, occasionType, giftType, tier, qrCents, isGiftBox, product, variants, excludeSpread, skipNotReady]);
  const previewKey = JSON.stringify(previewBody);

  // A new review (new inputs) is a new send: a fresh idempotency key, so two different sends can never collide.
  useEffect(() => { keyRef.current = null; setOutcome(null); }, [previewKey]);

  // Load the server's review whenever the reviewer is on step 3 and the inputs change.
  const loadReview = async () => {
    setReview({ state: "loading", preview: null, error: null });
    let res;
    try { res = await client.preview(orgId, previewBody); } catch { res = { ok: false, networkError: true }; }
    if (res && res.ok) setReview({ state: "ready", preview: res.preview, error: null });
    else setReview({ state: "failed", preview: null, error: res || {} });
  };
  useEffect(() => {
    if (!open || step !== 3 || !isOccasion(occasionType)) return undefined;
    let alive = true;
    (async () => { if (alive) await loadReview(); })();
    return () => { alive = false; };
  }, [open, step, previewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirm() {
    if (sendingRef.current) return;                    // same-tick double press
    // A send kept unresolved (in this tab or another) blocks every NEW send for this organisation until it is resolved.
    const kept = loadPending(store, orgId);
    if (kept) { setPending(kept); setPayState(null); setOutcome(null); return; }
    const preview = review.preview;
    if (!canConfirm(preview, { busy })) return;
    sendingRef.current = true; setBusy(true); setOutcome(null);
    if (!keyRef.current) keyRef.current = newIdempotencyKey();
    const body = buildSendRequest(previewBody, preview, keyRef.current);
    // The payment outcome is unknown: keep THIS request (and its key) for the organisation, locked, until resolved.
    const keepPending = () => {
      const rec = buildPendingRecord({
        orgId, sendBody: body, at: new Date().toISOString(),
        display: { giftLabel: giftLabelOf(preview.gift), count: preview.recipients.count, totalCents: preview.gift.totalCents ?? null, costs: perRecipientCosts(preview) },
      });
      savePending(store, rec);
      setPending(rec); setPayState(null); setOutcome(null);
    };
    try {
      const res = await client.send(orgId, body);
      if (res && res.ok) {
        setOutcome({ kind: "sent", result: res.result, replay: res.replay });
        if (onSent) onSent(res.result);
      } else if (res && res.indeterminate) {
        // A paid send whose answer was lost may have charged the card: keep it pending, never "press again".
        if (preview.gift && preview.gift.requiresPayment) keepPending(); else setOutcome({ kind: "unsure" });
      } else if (res && UNRESOLVED_PAYMENT_CODES.includes(res.error)) {
        keepPending();
      } else if (res && res.dormant) {
        setOutcome({ kind: "error", text: blockerText("corporate_campaign_execution_disabled") });
      } else if (res && res.error === "recipients_not_ready") {
        setOutcome({ kind: "notready", details: res.details || {} });
        await loadReview();
      } else if (res && res.error === "plan_shortfall") {
        setOutcome({ kind: "short", details: res.details || {} });
        await loadReview();
      } else if (res && (res.error === "review_out_of_date" || res.error === "quote_changed")) {
        // The thing the owner confirmed is no longer true: nothing was sent or charged. A new review is a new send.
        setOutcome({ kind: "error", text: blockerText(res.error) });
        keyRef.current = null;
        await loadReview();
      } else {
        setOutcome({ kind: "error", text: blockerText(res && res.error) });
      }
    } finally { sendingRef.current = false; setBusy(false); }
  }

  function reset() {
    setOpen(false); setStep(1); setOutcome(null); setReview({ state: "idle", preview: null, error: null }); setSkipNotReady(false); keyRef.current = null;
  }

  function giftLabelOf(gift) {
    if (!gift || gift.type === "none") return "No gift";
    if (gift.type === "curated") return `Let Greet-Me™ Select (up to ${money(gift.maxSpendCents || 0)})`;
    if (gift.type === "qrcash") return `QR Cash™ (${money(gift.qrCashAmountCents || 0)} each)`;
    if (isProviderFundableGiftType(gift.type)) return `Gift box: ${(product && (product.title || product.providerProductId)) || "Gift box"}${variants.length ? ` (${variants.join(", ")})` : ""}`;
    return gift.type;
  }

  // READ-ONLY: asks the server what happened to this send's payment. Creates, charges and changes nothing.
  async function checkStatus() {
    if (!pending || checking) return;
    setChecking(true); setOutcome(null);
    let res = null;
    try {
      const sendId = await oneTimeSendIdFor(orgId, pending.idempotencyKey);
      if (sendId && client && typeof client.status === "function") res = await client.status(orgId, sendId);
    } catch { res = null; }
    const sinceMs = Date.now() - Date.parse(pending.at || "");
    const state = paymentStateFromStatus(res, { sinceMs: Number.isFinite(sinceMs) ? sinceMs : null });
    if (state === "sent") {
      const r = (res && res.result) || {};
      clearPending(store, orgId); setPending(null); setPayState(null); setOpen(true);
      setOutcome({ kind: "sent", replay: true, result: { recipientCount: Number.isFinite(r.recipientCount) ? r.recipientCount : pending.display.count, chargedTotalCents: Number.isFinite(r.chargedTotalCents) ? r.chargedTotalCents : 0 } });
    } else {
      setPayState(state);
    }
    setChecking(false);
  }

  // The SAME request and key, only once the payment is resolved: it can reach no other send and no other payment.
  async function sendPending() {
    if (sendingRef.current || !pending || !RESOLVED_FOR_SEND.includes(payState)) return;
    sendingRef.current = true; setBusy(true); setOutcome(null);
    try {
      const res = await client.send(orgId, pending.sendBody);
      if (res && res.ok) {
        clearPending(store, orgId); setPending(null); setPayState(null);
        setOutcome({ kind: "sent", result: res.result, replay: res.replay });
        if (onSent) onSent(res.result);
      } else if (res && (res.indeterminate || UNRESOLVED_PAYMENT_CODES.includes(res.error))) {
        // Unresolved again: Send is disabled until the next check, and the in-flight window restarts from THIS attempt.
        const again = { ...pending, at: new Date().toISOString() };
        savePending(store, again); setPending(again);
        setPayState(null);
      } else if (res && res.error === "replacement_card_required") {
        setOutcome({ kind: "error", text: payState === "not_charged" ? PENDING_REPLACE_PROVEN_TEXT : blockerText(res.error), card: true });
      } else if (res && (res.error === "quote_changed" || res.error === "review_out_of_date")) {
        setOutcome({ kind: "error", text: PENDING_CHANGED_TEXT });
      } else {
        setOutcome({ kind: "error", text: blockerText(res && res.error) });
      }
    } finally { sendingRef.current = false; setBusy(false); }
  }

  // Only once the payment is PROVEN not taken: the kept send is dropped and a fresh one (a new key) may start.
  function startOver() {
    if (payState !== "not_charged" || !(Date.now() - Date.parse(pending.at || "") >= SEND_IN_FLIGHT_MS)) return;
    clearPending(store, orgId); setPending(null); setPayState(null); setOutcome(null);
    setStep(1); setReview({ state: "idle", preview: null, error: null }); keyRef.current = null;
  }

  if (pending && !open) {
    return (
      <section className="gcd-panel" data-testid="sendnow-panel" aria-labelledby="gcd-sendnow-head">
        <div className="gcd-panel-head">
          <div>
            <h2 className="gcd-panel-title" id="gcd-sendnow-head">Send a Greet-Me now</h2>
            <p className="gcd-panel-note" data-testid="sendnow-pending-note">A payment for an earlier send is being confirmed.</p>
          </div>
          <div className="gcd-panel-actions">
            <button type="button" className="gcd-btn gcd-btn--primary" data-testid="sendnow-open" onClick={() => setOpen(true)}>View that send</button>
          </div>
        </div>
      </section>
    );
  }

  if (pending) {
    const d = pending.display || {};
    const resolved = RESOLVED_FOR_SEND.includes(payState);
    return (
      <section className="gcd-panel" data-testid="sendnow-panel" aria-labelledby="gcd-sendnow-head">
        <div className="gcd-panel-head">
          <div>
            <h2 className="gcd-panel-title" id="gcd-sendnow-head">Send a Greet-Me now</h2>
            <p className="gcd-panel-note">This send is kept exactly as you confirmed it until its payment is resolved.</p>
          </div>
          <button type="button" className="gcd-btn" data-testid="sendnow-close" onClick={reset} disabled={busy || checking}>Close</button>
        </div>
        <div style={{ padding: "14px 20px 20px" }} data-testid="sendnow-pending">
          <dl className="gcd-info" style={{ margin: 0 }}>
            <div className="gcd-info-row"><dt className="gcd-info-label">Gift</dt><dd className="gcd-info-value" data-testid="sendnow-pending-gift">{d.giftLabel || "Gift"}</dd></div>
            <div className="gcd-info-row"><dt className="gcd-info-label">Sending to</dt><dd className="gcd-info-value">{d.count} {d.count === 1 ? "person" : "people"}</dd></div>
            {Number.isSafeInteger(d.totalCents) ? (
              <div className="gcd-info-row"><dt className="gcd-info-label">Total</dt><dd className="gcd-info-value" data-testid="sendnow-pending-total">{money(d.totalCents)}</dd></div>
            ) : null}
          </dl>
          {!resolved ? (
            <p role="alert" data-testid="sendnow-payment-uncertain" style={{ color: "#92400e", fontSize: ".88rem", margin: "10px 0" }}>{PAYMENT_UNCERTAIN_TEXT}</p>
          ) : null}
          {payState ? (
            <p role="status" data-testid="sendnow-payment-status" style={{ fontSize: ".88rem", margin: "10px 0" }}>{PAYMENT_STATUS_TEXT[payState]}</p>
          ) : null}
          {outcome && outcome.kind === "error" ? <p role="alert" data-testid="sendnow-error" style={{ color: "#b3261e", fontSize: ".88rem" }}>{withSupportLink(outcome.text)}</p> : null}
          {outcome && outcome.card ? <SavedCardPanel orgId={orgId} client={cardClient} stripeOverride={stripeOverride} /> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" className="gcd-btn" data-testid="sendnow-check-status" onClick={checkStatus} disabled={checking || busy}>
              {checking ? "Checking…" : "Check payment status"}
            </button>
            {payState === "not_charged" && Date.now() - Date.parse(pending.at || "") >= SEND_IN_FLIGHT_MS ? (
              <button type="button" className="gcd-btn" data-testid="sendnow-start-over" onClick={startOver} disabled={busy}>Start over</button>
            ) : null}
            <button type="button" className="gcd-btn gcd-btn--primary" data-testid="sendnow-confirm" disabled={!resolved || busy} onClick={sendPending}>
              {busy ? "Sending…" : FINAL_BUTTON_LABEL}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!open) {
    return (
      <section className="gcd-panel" data-testid="sendnow-panel" aria-labelledby="gcd-sendnow-head">
        <div className="gcd-panel-head">
          <div>
            <h2 className="gcd-panel-title" id="gcd-sendnow-head">Send a Greet-Me now</h2>
            <p className="gcd-panel-note">A one-time Greet-Me to a category or one person. No schedule, no repeat.</p>
          </div>
          <div className="gcd-panel-actions">
            <button type="button" className="gcd-btn gcd-btn--primary" data-testid="sendnow-open" onClick={() => setOpen(true)}>Send a Greet-Me now</button>
          </div>
        </div>
      </section>
    );
  }

  const pv = review.preview;
  const plan = pv ? planLine(pv.plan) : null;
  const planLinks = (pv && pv.plan && pv.plan.links) || (outcome && outcome.kind === "short" && outcome.details.links) || {};
  const topUpHref = linkHref(planLinks.topUp, TOP_UP_HREF);
  const upgradeHref = linkHref(planLinks.upgrade, UPGRADE_HREF);
  const sent = outcome && outcome.kind === "sent";

  return (
    <section className="gcd-panel" data-testid="sendnow-panel" aria-labelledby="gcd-sendnow-head">
      <div className="gcd-panel-head">
        <div>
          <h2 className="gcd-panel-title" id="gcd-sendnow-head">Send a Greet-Me now</h2>
          <p className="gcd-panel-note">One time, right away. No schedule and no repeat.</p>
        </div>
        {!sent ? <button type="button" className="gcd-btn" data-testid="sendnow-close" onClick={reset} disabled={busy}>Close</button> : null}
      </div>

      <div style={{ padding: "14px 20px 20px" }}>
        {sent ? (
          <div role="status" data-testid="sendnow-sent">
            <p style={{ fontSize: ".95rem", margin: "0 0 6px" }}><strong>Your Greet-Me is on its way.</strong></p>
            <p style={{ margin: 0, fontSize: ".85rem" }}>
              Sent to {outcome.result.recipientCount} {outcome.result.recipientCount === 1 ? "person" : "people"}.
              {outcome.result.chargedTotalCents > 0 ? ` ${money(outcome.result.chargedTotalCents)} was charged to your saved card.` : ""}
              {outcome.replay ? " (This send had already gone through; nothing was sent twice.)" : ""}
            </p>
            <button type="button" className="gcd-btn" style={{ marginTop: 10 }} data-testid="sendnow-done" onClick={reset}>Done</button>
          </div>
        ) : null}

        {!sent && step === 1 ? (
          <div data-testid="sendnow-who">
            <label style={{ display: "block", fontSize: ".88rem", margin: "4px 0" }}>
              <input type="radio" name="sendnow-who" data-testid="sendnow-who-category" checked={who === "category"} onChange={() => setWho("category")} /> A whole category
            </label>
            {who === "category" ? (
              <select data-testid="sendnow-category" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} style={{ margin: "2px 0 8px 22px", padding: 6, borderRadius: 6 }}>
                {CONTACT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            ) : null}
            <label style={{ display: "block", fontSize: ".88rem", margin: "4px 0" }}>
              <input type="radio" name="sendnow-who" data-testid="sendnow-who-single" checked={who === "single"} onChange={() => setWho("single")} /> One person
            </label>
            {who === "single" ? (
              <select data-testid="sendnow-contact" aria-label="Person" value={contactId} onChange={(e) => setContactId(e.target.value)} style={{ margin: "2px 0 8px 22px", padding: 6, borderRadius: 6 }}>
                <option value="">Choose a person…</option>
                {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : null}
            <p data-testid="sendnow-count" style={{ fontSize: ".85rem", margin: "8px 0" }}>
              <strong>{chosenCount}</strong> {chosenCount === 1 ? "person" : "people"} selected. The exact list is checked on the review.
            </p>
            <button type="button" className="gcd-btn gcd-btn--primary" data-testid="sendnow-next-1" disabled={chosenCount === 0} onClick={() => setStep(2)}>Next</button>
          </div>
        ) : null}

        {!sent && step === 2 ? (
          <div data-testid="sendnow-what">
            <BubbleGroup label="What goes with the greeting" role="radiogroup" testId="sendnow-gift-group">
              {giftOptions.filter((o) => o.value === "none" || o.value === "curated" || o.value === PROVIDER_GIFT_OPTION.value || o.value === "qrcash").map((opt) => {
                const st = giftOptionState(opt.value);
                return (
                  <ChoiceBubble key={opt.value} id={`sendnow-gift-${opt.value}`} name="sendnow-gift" value={opt.value} label={opt.label}
                    note={st.selectable ? opt.description : null} checked={giftType === opt.value} disabled={!st.selectable}
                    onChange={(v) => setGiftType(v)} />
                );
              })}
            </BubbleGroup>
            {giftType === "curated" ? (
              <label style={{ display: "block", fontSize: ".85rem", marginTop: 8 }}>
                Spend limit <span style={{ color: "#605c78" }}>(a ceiling, never a price)</span>{" "}
                <select data-testid="sendnow-tier" value={tier} onChange={(e) => setTier(Number(e.target.value))} style={{ padding: 6, borderRadius: 6 }}>
                  {CURATED_TIERS_CENTS.map((c) => <option key={c} value={c}>{centsToDisplay(c)}</option>)}
                </select>
              </label>
            ) : null}
            {isGiftBox ? (
              <div data-testid="sendnow-giftbox" style={{ marginTop: 8, fontSize: ".85rem" }}>
                <label style={{ display: "block" }}>
                  Spend limit <span style={{ color: "#605c78" }}>(a ceiling, never a price)</span>{" "}
                  <select data-testid="sendnow-giftbox-tier" value={tier} onChange={(e) => setTier(Number(e.target.value))} style={{ padding: 6, borderRadius: 6 }}>
                    {CURATED_TIERS_CENTS.map((c) => <option key={c} value={c}>{centsToDisplay(c)}</option>)}
                  </select>
                </label>
                {giftCatalog.items.length > 0 ? (
                  <BubbleGroup label="Which gift box" role="radiogroup" testId="sendnow-giftbox-products">
                    {giftCatalog.items.map((item) => {
                      const id = selectedProductId(item);
                      return (
                        <ChoiceBubble key={id} id={`sendnow-gb-${id}`} name="sendnow-gb" value={id} label={item.title || id}
                          checked={productChosen === id}
                          // One box replaces the other outright, and its options go with it.
                          onChange={() => { setProduct(item); setVariants([]); }} />
                      );
                    })}
                  </BubbleGroup>
                ) : (
                  <span style={{ display: "block", color: "#605c78" }} data-testid="sendnow-giftbox-empty">No gift boxes are published yet.</span>
                )}
                {productChosen && variantChoices.length > 0 ? (
                  <fieldset data-testid="sendnow-giftbox-variants" style={{ border: 0, padding: 0, margin: "8px 0 0" }}>
                    <legend style={{ color: "#605c78", padding: 0 }}>Options published for this gift box</legend>
                    {variantChoices.map((name) => (
                      <label key={name} style={CHECK_ROW}>
                        <input type="checkbox" style={CHECK_BOX} value={name} checked={variants.includes(name)}
                          onChange={() => setVariants(toggleVariantSelection(variants, name, variantChoices))} />
                        {name}
                      </label>
                    ))}
                  </fieldset>
                ) : null}
                <span style={{ display: "block", color: "#605c78", fontSize: ".8rem", marginTop: 6 }}>
                  One gift box for each person, mailed to their address. The review shows each person&rsquo;s cost, including shipping and tax, and the full total.
                </span>
                {giftBoxNote ? <span role="status" data-testid="sendnow-giftbox-note" style={{ display: "block", color: "#92400e", marginTop: 4 }}>{giftBoxNote}</span> : null}
              </div>
            ) : null}
            {giftType === "qrcash" ? (
              <label style={{ display: "block", fontSize: ".85rem", marginTop: 8 }}>
                Amount for each person <span style={{ color: "#605c78" }}>(whole dollars, $5 to $100)</span>{" "}
                <input type="text" inputMode="numeric" autoComplete="off" data-testid="sendnow-qr-amount" aria-label="QR Cash amount in dollars"
                  aria-invalid={qrCents === null ? "true" : "false"} value={qrDollars} onChange={(e) => setQrDollars(e.target.value)}
                  style={{ padding: 6, borderRadius: 6, width: 80 }} />
                <span style={{ display: "block", color: "#605c78", fontSize: ".8rem" }}>
                  The standard QR Cash fee is added to your saved card when you confirm; the review shows the exact total.
                </span>
              </label>
            ) : null}
            <label style={{ ...CHECK_ROW, fontSize: ".88rem", marginTop: 12 }}>
              <input type="checkbox" style={CHECK_BOX} data-testid="sendnow-exclude-spread" checked={excludeSpread} onChange={(e) => setExcludeSpread(e.target.checked)} /> Exclude Featured Spread
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="gcd-btn" data-testid="sendnow-back-2" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="gcd-btn gcd-btn--primary" data-testid="sendnow-next-2" disabled={(giftType === "qrcash" && qrCents === null) || giftBoxBlocked} onClick={() => setStep(3)}>Review</button>
            </div>
          </div>
        ) : null}

        {!sent && step === 3 ? (
          <div data-testid="sendnow-review">
            <label style={{ display: "block", fontSize: ".88rem", margin: "0 0 10px" }}>
              Occasion{" "}
              <select data-testid="sendnow-occasion" aria-label="Occasion" value={occasionType} onChange={(e) => setOccasionType(e.target.value)} style={{ padding: 6, borderRadius: 6 }}>
                <option value="">Choose an occasion…</option>
                {OCCASIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span style={{ display: "block", color: "#605c78", fontSize: ".8rem" }}>Greet-Me writes the wording for the occasion.</span>
            </label>
            {!isOccasion(occasionType) ? <p data-testid="sendnow-need-occasion" className="gcd-empty">Choose an occasion to see the review.</p> : null}
            {isOccasion(occasionType) && review.state === "loading" ? <p data-testid="sendnow-loading" className="gcd-empty">Checking everything…</p> : null}
            {review.state === "failed" ? (
              <p role="alert" data-testid="sendnow-review-error" style={{ color: "#b3261e", fontSize: ".88rem" }}>
                {review.error && review.error.dormant ? blockerText("corporate_campaign_execution_disabled")
                  : review.error && review.error.unauthorized ? "Only the organization owner can send a Greet-Me now."
                  : review.error && review.error.notAvailable ? "Sending a Greet-Me now isn’t available yet."
                  : "We couldn’t prepare the review. Please try again."}
              </p>
            ) : null}
            {pv && isOccasion(occasionType) ? (
              <>
                <dl className="gcd-info" style={{ margin: 0 }}>
                  <div className="gcd-info-row"><dt className="gcd-info-label">Sending to</dt>
                    <dd className="gcd-info-value" data-testid="sendnow-review-to">
                      {pv.recipients.count} {pv.recipients.count === 1 ? "person" : "people"}
                      {pv.recipients.list.length ? `: ${pv.recipients.list.slice(0, SHOWN_NAMES).map((r) => r.name).join(", ")}${pv.recipients.list.length > SHOWN_NAMES ? `, and ${pv.recipients.list.length - SHOWN_NAMES} more` : ""}` : ""}
                    </dd></div>
                  <div className="gcd-info-row"><dt className="gcd-info-label">When</dt>
                    <dd className="gcd-info-value" data-testid="sendnow-review-when">Once, right after you confirm. No schedule and no repeat.</dd></div>
                  <div className="gcd-info-row"><dt className="gcd-info-label">Gift</dt>
                    <dd className="gcd-info-value" data-testid="sendnow-review-gift">{pv.gift.type === "none" ? "No gift" : pv.gift.type === "curated" ? `Let Greet-Me™ Select (up to ${money(pv.gift.maxSpendCents || 0)})` : pv.gift.type === "qrcash" ? `QR Cash™ (${money(pv.gift.qrCashAmountCents || 0)} each)` : isProviderFundableGiftType(pv.gift.type) ? `Gift box: ${(product && (product.title || product.providerProductId)) || "Gift box"}${variants.length ? ` (${variants.join(", ")})` : ""}` : pv.gift.type}</dd></div>
                  <div className="gcd-info-row"><dt className="gcd-info-label">Featured Spread</dt>
                    <dd className="gcd-info-value" data-testid="sendnow-review-spread">{pv.featuredSpread && pv.featuredSpread.included ? "Included" : "Excluded"}</dd></div>
                  <div className="gcd-info-row"><dt className="gcd-info-label">From</dt>
                    <dd className="gcd-info-value" data-testid="sendnow-review-sender">{pv.sender && pv.sender.senderName ? `${pv.sender.senderName}, with your own photo and voice` : "Your own photo and voice"}</dd></div>
                </dl>

                {pv.recipients.blocked.length > 0 ? (
                  <div data-testid="sendnow-notready" style={{ margin: "10px 0", fontSize: ".85rem" }}>
                    <p style={{ margin: "0 0 4px", color: "#92400e" }}>
                      {pv.recipients.blocked.length} {pv.recipients.blocked.length === 1 ? "person can’t" : "people can’t"} be included:{" "}
                      {pv.recipients.blocked.slice(0, SHOWN_NAMES).map((b) => `${b.name || "Unnamed"} (${notReadyText(b)})`).join(", ")}
                    </p>
                    <label style={CHECK_ROW}>
                      <input type="checkbox" style={CHECK_BOX} data-testid="sendnow-skip-notready" checked={skipNotReady} onChange={(e) => setSkipNotReady(e.target.checked)} /> Send to the ready ones only
                    </label>
                  </div>
                ) : null}

                {plan ? (
                  <p data-testid="sendnow-plan" data-short={plan.short ? "yes" : "no"} style={{ margin: "10px 0", fontSize: ".88rem", color: plan.short ? "#b3261e" : "inherit" }}>
                    {plan.text}
                    {plan.short ? (
                      <span style={{ display: "inline-flex", gap: 8, marginLeft: 8 }}>
                        <a className="gcd-btn" data-testid="sendnow-topup" href={topUpHref}>Top up</a>
                        <a className="gcd-btn" data-testid="sendnow-upgrade" href={upgradeHref}>Upgrade</a>
                      </span>
                    ) : null}
                  </p>
                ) : null}

                {pv.gift.requiresPayment ? (
                  <div data-testid="sendnow-payment" style={{ margin: "10px 0" }}>
                    {/* Gift box (founder 2026-10-28): each person's cost exactly as the server quoted it (shipping and tax
                        included), then the full total, which is what the card is charged. */}
                    {isProviderFundableGiftType(pv.gift.type) && perRecipientCosts(pv).length ? (
                      <div data-testid="sendnow-costs" style={{ margin: "0 0 8px" }}>
                        <p style={{ margin: "0 0 4px", fontSize: ".85rem" }}>Each person&rsquo;s gift box, including shipping and tax:</p>
                        <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: "12rem", overflowY: "auto", fontSize: ".85rem" }}>
                          {perRecipientCosts(pv).map((r) => (
                            <li key={r.contactId} data-testid="sendnow-cost-row" style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "2px 0", borderBottom: "1px solid #eee" }}>
                              <span style={{ overflowWrap: "anywhere" }}>{r.name}</span><span style={{ whiteSpace: "nowrap" }}>{money(r.totalCents)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {totalLine(pv.gift) ? <p data-testid="sendnow-total" style={{ margin: "0 0 6px", fontSize: ".9rem" }}><strong>{totalLine(pv.gift)}</strong></p> : null}
                    {pv.gift.cardOnFile === false ? <SavedCardPanel orgId={orgId} client={cardClient} stripeOverride={stripeOverride} /> : null}
                  </div>
                ) : <p data-testid="sendnow-nopay" style={{ fontSize: ".85rem", margin: "10px 0" }}>Nothing to pay for this send.</p>}

                {pv.blockers.filter((b) => !["recipients_not_ready", "plan_shortfall"].includes(b)).length > 0 ? (
                  <ul data-testid="sendnow-blockers" style={{ margin: "8px 0", paddingLeft: 18, fontSize: ".85rem", color: "#b3261e" }}>
                    {pv.blockers.filter((b) => !["recipients_not_ready", "plan_shortfall"].includes(b)).map((b) => <li key={b}>{blockerText(b)}</li>)}
                  </ul>
                ) : null}
              </>
            ) : null}

            {outcome && outcome.kind === "error" ? <p role="alert" data-testid="sendnow-error" style={{ color: "#b3261e", fontSize: ".88rem" }}>{withSupportLink(outcome.text)}</p> : null}
            {outcome && outcome.kind === "short" ? (
              <p role="alert" data-testid="sendnow-short" style={{ color: "#b3261e", fontSize: ".88rem" }}>
                {`You are ${outcome.details.shortfall ?? "some"} short, so nothing was sent.`}
              </p>
            ) : null}
            {outcome && outcome.kind === "notready" ? (
              <p role="alert" data-testid="sendnow-notready-refused" style={{ color: "#92400e", fontSize: ".88rem" }}>
                Nothing was sent: some people are missing details
                {Array.isArray(outcome.details.blocked) && outcome.details.blocked.length
                  ? ` (${outcome.details.blocked.slice(0, SHOWN_NAMES).map((b) => `${b.name || "Unnamed"}: ${notReadyText(b)}`).join(", ")})` : ""}.
                Tick “Send to the ready ones only” to send to everyone else.
              </p>
            ) : null}
            {outcome && outcome.kind === "unsure" ? (
              <p role="alert" data-testid="sendnow-unsure" style={{ color: "#92400e", fontSize: ".88rem" }}>
                We couldn’t confirm whether that went through. Press the button again: it will not send twice.
              </p>
            ) : null}

            <p data-testid="sendnow-final-note" style={{ fontSize: ".82rem", color: "#605c78", margin: "10px 0" }}>{FINAL_NOTE}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="gcd-btn" data-testid="sendnow-back-3" onClick={() => setStep(2)} disabled={busy}>Back</button>
              <button type="button" className="gcd-btn gcd-btn--primary" data-testid="sendnow-confirm" disabled={!canConfirm(pv, { busy })} onClick={confirm}>
                {busy ? "Sending…" : FINAL_BUTTON_LABEL}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
