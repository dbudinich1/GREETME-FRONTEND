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
import { CONTACT_CATEGORIES, CURATED_TIERS_CENTS, centsToDisplay, corporateGiftOptions, giftOptionState } from "./corporateDashboardModel.js";
import { BubbleGroup, ChoiceBubble } from "./Bubbles.jsx";
import SavedCardPanel from "./SavedCardPanel.jsx";
import {
  buildPreviewRequest, buildSendRequest, newIdempotencyKey, planLine, blockerText, notReadyText, giftPayload, totalLine, canConfirm,
  FINAL_BUTTON_LABEL, FINAL_NOTE, TOP_UP_HREF, UPGRADE_HREF, money,
} from "./oneTimeSendModel.js";
import "./premiumDashboard.css";

const SHOWN_NAMES = 8;

export default function SendNowFlow({ orgId, contacts, client, cardClient, stripeOverride, onSent }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [who, setWho] = useState("category");
  const [category, setCategory] = useState("client");
  const [contactId, setContactId] = useState("");
  const [giftType, setGiftType] = useState("none");
  const [tier, setTier] = useState(CURATED_TIERS_CENTS[0]);
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
  const giftOptions = corporateGiftOptions({ catalogItemCount: 0, currentGiftType: giftType });

  const previewBody = useMemo(() => buildPreviewRequest({
    who, category, contactId, gift: giftPayload(giftType, tier), excludeFeaturedSpread: excludeSpread, skipNotReady,
  }), [who, category, contactId, giftType, tier, excludeSpread, skipNotReady]);
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
    if (!open || step !== 3) return undefined;
    let alive = true;
    (async () => { if (alive) await loadReview(); })();
    return () => { alive = false; };
  }, [open, step, previewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirm() {
    if (sendingRef.current) return;                    // same-tick double press
    const preview = review.preview;
    if (!canConfirm(preview, { busy })) return;
    sendingRef.current = true; setBusy(true); setOutcome(null);
    if (!keyRef.current) keyRef.current = newIdempotencyKey();
    try {
      const res = await client.send(orgId, buildSendRequest(previewBody, preview, keyRef.current));
      if (res && res.ok) {
        setOutcome({ kind: "sent", result: res.result, replay: res.replay });
        if (onSent) onSent(res.result);
      } else if (res && res.indeterminate) {
        setOutcome({ kind: "unsure" });
      } else if (res && res.dormant) {
        setOutcome({ kind: "error", text: blockerText("corporate_campaign_execution_disabled") });
      } else if (res && res.error === "plan_shortfall") {
        setOutcome({ kind: "short", details: res.details || {} });
        await loadReview();
      } else if (res && res.error === "review_out_of_date") {
        setOutcome({ kind: "error", text: blockerText("review_out_of_date") });
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
              {giftOptions.filter((o) => o.value === "none" || o.value === "curated" || o.value === "qrcash").map((opt) => {
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
            <label style={{ display: "block", fontSize: ".88rem", marginTop: 12 }}>
              <input type="checkbox" data-testid="sendnow-exclude-spread" checked={excludeSpread} onChange={(e) => setExcludeSpread(e.target.checked)} /> Exclude Featured Spread
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="gcd-btn" data-testid="sendnow-back-2" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="gcd-btn gcd-btn--primary" data-testid="sendnow-next-2" onClick={() => setStep(3)}>Review</button>
            </div>
          </div>
        ) : null}

        {!sent && step === 3 ? (
          <div data-testid="sendnow-review">
            {review.state === "loading" ? <p data-testid="sendnow-loading" className="gcd-empty">Checking everything…</p> : null}
            {review.state === "failed" ? (
              <p role="alert" data-testid="sendnow-review-error" style={{ color: "#b3261e", fontSize: ".88rem" }}>
                {review.error && review.error.dormant ? blockerText("corporate_campaign_execution_disabled")
                  : review.error && review.error.unauthorized ? "Only the organization owner can send a Greet-Me now."
                  : review.error && review.error.notAvailable ? "Sending a Greet-Me now isn’t available yet."
                  : "We couldn’t prepare the review. Please try again."}
              </p>
            ) : null}
            {pv ? (
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
                    <dd className="gcd-info-value">{pv.gift.type === "none" ? "No gift" : pv.gift.type === "curated" ? `Let Greet-Me™ Select (up to ${money(pv.gift.maxSpendCents || 0)})` : pv.gift.type}</dd></div>
                  <div className="gcd-info-row"><dt className="gcd-info-label">Featured Spread</dt>
                    <dd className="gcd-info-value" data-testid="sendnow-review-spread">{pv.featuredSpread && pv.featuredSpread.included ? "Included" : "Excluded"}</dd></div>
                  <div className="gcd-info-row"><dt className="gcd-info-label">From</dt>
                    <dd className="gcd-info-value" data-testid="sendnow-review-sender">Your own photo and voice{pv.sender && pv.sender.senderName ? ` (${pv.sender.senderName})` : ""}</dd></div>
                </dl>

                {pv.recipients.blocked.length > 0 ? (
                  <div data-testid="sendnow-notready" style={{ margin: "10px 0", fontSize: ".85rem" }}>
                    <p style={{ margin: "0 0 4px", color: "#92400e" }}>
                      {pv.recipients.blocked.length} {pv.recipients.blocked.length === 1 ? "person can’t" : "people can’t"} be included:{" "}
                      {pv.recipients.blocked.slice(0, SHOWN_NAMES).map((b) => `${b.name || "Unnamed"} (${notReadyText(b)})`).join(", ")}
                    </p>
                    <label>
                      <input type="checkbox" data-testid="sendnow-skip-notready" checked={skipNotReady} onChange={(e) => setSkipNotReady(e.target.checked)} /> Send to everyone else
                    </label>
                  </div>
                ) : null}

                {plan ? (
                  <p data-testid="sendnow-plan" data-short={plan.short ? "yes" : "no"} style={{ margin: "10px 0", fontSize: ".88rem", color: plan.short ? "#b3261e" : "inherit" }}>
                    {plan.text}
                    {plan.short ? (
                      <span style={{ display: "inline-flex", gap: 8, marginLeft: 8 }}>
                        <a className="gcd-btn" data-testid="sendnow-topup" href={TOP_UP_HREF}>Top up</a>
                        <a className="gcd-btn" data-testid="sendnow-upgrade" href={UPGRADE_HREF}>Upgrade</a>
                      </span>
                    ) : null}
                  </p>
                ) : null}

                {pv.gift.requiresPayment ? (
                  <div data-testid="sendnow-payment" style={{ margin: "10px 0" }}>
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

            {outcome && outcome.kind === "error" ? <p role="alert" data-testid="sendnow-error" style={{ color: "#b3261e", fontSize: ".88rem" }}>{outcome.text}</p> : null}
            {outcome && outcome.kind === "short" ? (
              <p role="alert" data-testid="sendnow-short" style={{ color: "#b3261e", fontSize: ".88rem" }}>
                {`You are ${outcome.details.shortfall ?? "some"} short, so nothing was sent.`}
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
