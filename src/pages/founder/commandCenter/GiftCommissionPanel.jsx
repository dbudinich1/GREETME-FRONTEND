// Founder-only "Gift commission" settings panel for the salesperson profile. NO payout / approve controls. It records TERMS only;
// accrual stays off platform-wide until activation. Opening or cancelling never writes: the only write is the explicit confirm step.
// The gift-sales panel next to it stays informational and shows no commission figure.
import { useCallback, useEffect, useState } from "react";
import {
  GIFT_COMMISSION_BANNER, GIFT_TYPE_OPTIONS, NEVER_EARN, DURATION_MODES, blankDraft, draftFromCurrent, validateDraft,
  summaryLine, historyRows, giftCommissionErrorMessage,
} from "./giftCommissionLogic.js";

const box = { border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, padding: "12px 14px", display: "grid", gap: 8, background: "#fff" };
const small = { margin: 0, fontSize: ".8rem", color: "#475569", lineHeight: 1.45 };
const lab = { display: "block", fontSize: ".78rem", fontWeight: 700, color: "#3a3552", margin: "6px 0 3px" };
const inp = { padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: ".9rem", boxSizing: "border-box", maxWidth: "100%" };
const err = { color: "#b3261e", fontSize: ".78rem", margin: "2px 0 0" };

export default function GiftCommissionPanel({ api, salespersonId, now = () => new Date() }) {
  const has = typeof api.giftCommission === "function" && typeof api.setGiftCommission === "function";
  const [state, setState] = useState({ loading: true });
  const [mode, setMode] = useState("view"); // view | edit | confirm
  const [draft, setDraft] = useState(blankDraft());
  const [errors, setErrors] = useState({});
  const [payload, setPayload] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    const r = await api.giftCommission(salespersonId);
    if (r.ok && r.data && r.data.giftCommission !== undefined) setState({ gc: r.data.giftCommission || { current: null, history: [] } });
    else setState({ error: giftCommissionErrorMessage(r), forbidden: r.status === 403 });
  }, [api, salespersonId]);
  useEffect(() => { if (has) { setState({ loading: true }); setMode("view"); setSaved(""); load(); } }, [has, load]);

  if (!has) return null;
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const toggleType = (id) => setDraft((d) => ({ ...d, types: d.types.includes(id) ? d.types.filter((x) => x !== id) : [...d.types, id] }));
  const cur = state.gc && state.gc.current;

  function review(ev) {
    ev.preventDefault();
    const v = validateDraft(draft, now());
    setErrors(v.errors); setMessage("");
    if (v.payload) { setPayload(v.payload); setMode("confirm"); }
  }
  async function confirm() {
    setBusy(true); setMessage("");
    const r = await api.setGiftCommission(salespersonId, payload);
    setBusy(false);
    if (!r.ok) { setMessage(giftCommissionErrorMessage(r)); setMode("edit"); return; }
    setSaved("Terms saved. They apply to future sales only.");
    setMode("view"); load();
  }
  const startsOn = payload && payload.effectiveFrom ? payload.effectiveFrom.slice(0, 10) : "now";

  return (
    <section data-testid="cc-giftcomm" style={box}>
      <h3 style={{ margin: 0, fontSize: ".95rem" }}>Gift commission</h3>
      <p style={{ ...small, background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, padding: "8px 12px", color: "#3b2a6b" }} data-testid="cc-giftcomm-banner">{GIFT_COMMISSION_BANNER}</p>
      {saved ? <p role="status" style={{ ...small, color: "#166534" }} data-testid="cc-giftcomm-saved">{saved}</p> : null}
      {state.loading ? <p style={small} data-testid="cc-giftcomm-loading">Loading gift commission terms...</p> : null}
      {state.error ? <p role="alert" style={err} data-testid="cc-giftcomm-error">{state.forbidden ? state.error : `${state.error} `}{state.forbidden ? null : <button type="button" className="btn-secondary" onClick={load} data-testid="cc-giftcomm-retry">Try again</button>}</p> : null}

      {state.gc ? (
        <>
          <div data-testid="cc-giftcomm-current" style={{ display: "grid", gap: 4 }}>
            <p style={{ margin: 0, fontSize: ".9rem", fontWeight: 600 }} data-testid="cc-giftcomm-summary">{summaryLine(cur, cur && cur.effectiveFrom ? String(cur.effectiveFrom).slice(0, 10) : "")}</p>
            {cur ? (
              <dl style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: ".2rem .8rem", margin: 0, fontSize: ".82rem" }}>
                <dt>Status</dt><dd style={{ margin: 0 }} data-testid="cc-giftcomm-enabled">{cur.enabled ? "On (accrues only after activation)" : "Off"}</dd>
                <dt>Share of Greet-Me's margin</dt><dd style={{ margin: 0 }} data-testid="cc-giftcomm-rate">{cur.rateBps / 100}%</dd>
                <dt>Starts</dt><dd style={{ margin: 0 }} data-testid="cc-giftcomm-from">{String(cur.effectiveFrom || "").slice(0, 10)}</dd>
                <dt>Set</dt><dd style={{ margin: 0 }} data-testid="cc-giftcomm-setby">{String(cur.setAt || "").slice(0, 10)} by account {cur.setBy}</dd>
              </dl>
            ) : <p style={small} data-testid="cc-giftcomm-unset">No terms set. Nothing accrues for this salesperson.</p>}
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: ".8rem", color: "#475569" }} data-testid="cc-giftcomm-never">
              {NEVER_EARN.map((n) => <li key={n.id} data-testid={`cc-giftcomm-never-${n.id}`}>{n.label}: never earns</li>)}
              <li data-testid="cc-giftcomm-flowers-note">Flowers: not available yet</li>
              <li data-testid="cc-giftcomm-merch-note">Merch: accrues nothing while the merch mark-up is off</li>
            </ul>
          </div>

          {mode === "view" ? (
            <div><button type="button" className="btn-secondary" data-testid="cc-giftcomm-edit" onClick={() => { setDraft(draftFromCurrent(cur)); setErrors({}); setMessage(""); setSaved(""); setMode("edit"); }}>{cur ? "Change terms" : "Set terms"}</button></div>
          ) : null}

          {mode === "edit" ? (
            <form onSubmit={review} noValidate data-testid="cc-giftcomm-form" style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: ".86rem" }}><input type="checkbox" data-testid="cc-giftcomm-f-enabled" checked={draft.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Gift commission on for this salesperson</label>
              <label style={lab} htmlFor="gc-rate">Share of Greet-Me's margin (percent)</label>
              <input id="gc-rate" style={{ ...inp, width: 120 }} inputMode="decimal" data-testid="cc-giftcomm-f-rate" value={draft.ratePercent} onChange={(e) => set("ratePercent", e.target.value)} />
              {errors.rate ? <p style={err} data-testid="cc-giftcomm-err-rate">{errors.rate}</p> : null}
              <span style={lab}>How long it earns</span>
              {DURATION_MODES.map((m) => (
                <label key={m.id} style={{ fontSize: ".86rem" }}><input type="radio" name="gc-dur" data-testid={`cc-giftcomm-f-mode-${m.id}`} checked={draft.mode === m.id} onChange={() => set("mode", m.id)} /> {m.label}</label>
              ))}
              {draft.mode === "months_from_first_gift" ? (
                <div><label style={lab} htmlFor="gc-months">Months (1 to 120)</label><input id="gc-months" style={{ ...inp, width: 100 }} inputMode="numeric" data-testid="cc-giftcomm-f-months" value={draft.months} onChange={(e) => set("months", e.target.value)} /></div>
              ) : null}
              {errors.months ? <p style={err} data-testid="cc-giftcomm-err-months">{errors.months}</p> : null}
              {errors.duration ? <p style={err} data-testid="cc-giftcomm-err-duration">{errors.duration}</p> : null}
              <span style={lab}>Gift types that can earn</span>
              {GIFT_TYPE_OPTIONS.map((o) => (
                <label key={o.id} style={{ fontSize: ".86rem", opacity: o.selectable ? 1 : 0.6 }}>
                  <input type="checkbox" data-testid={`cc-giftcomm-f-type-${o.id}`} disabled={!o.selectable} checked={draft.types.includes(o.id)} onChange={() => toggleType(o.id)} /> {o.label} <span style={small}>({o.note})</span>
                </label>
              ))}
              {NEVER_EARN.map((n) => (
                <label key={n.id} style={{ fontSize: ".86rem", opacity: 0.6 }}>
                  <input type="checkbox" disabled checked={false} readOnly data-testid={`cc-giftcomm-f-type-${n.id}`} /> {n.label} <span style={small}>(Never earns)</span>
                </label>
              ))}
              {errors.types ? <p style={err} data-testid="cc-giftcomm-err-types">{errors.types}</p> : null}
              <label style={lab} htmlFor="gc-start">Start date (optional, YYYY-MM-DD; leave empty to start now)</label>
              <input id="gc-start" style={{ ...inp, width: 160 }} data-testid="cc-giftcomm-f-start" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} />
              {errors.startDate ? <p style={err} data-testid="cc-giftcomm-err-start">{errors.startDate}</p> : null}
              {message ? <p role="alert" style={err} data-testid="cc-giftcomm-form-error">{message}</p> : null}
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button type="submit" className="btn-primary" data-testid="cc-giftcomm-review">Review terms</button>
                <button type="button" className="btn-secondary" data-testid="cc-giftcomm-cancel" onClick={() => { setMode("view"); setErrors({}); setMessage(""); }}>Cancel</button>
              </div>
            </form>
          ) : null}

          {mode === "confirm" && payload ? (
            <div role="alertdialog" aria-label="Confirm gift commission terms" data-testid="cc-giftcomm-confirm" style={{ border: "1px solid #4F2D7F", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: ".9rem" }} data-testid="cc-giftcomm-confirm-summary">{summaryLine(payload, startsOn)}</p>
              <p style={small} data-testid="cc-giftcomm-confirm-note">This applies to future sales only. Sales already made are not changed, and the previous terms stay in the history.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn-primary" disabled={busy} data-testid="cc-giftcomm-confirm-go" onClick={confirm}>Confirm and save</button>
                <button type="button" className="btn-secondary" disabled={busy} data-testid="cc-giftcomm-confirm-back" onClick={() => setMode("edit")}>Go back</button>
                <button type="button" className="btn-secondary" disabled={busy} data-testid="cc-giftcomm-confirm-cancel" onClick={() => { setMode("view"); setPayload(null); }}>Cancel</button>
              </div>
            </div>
          ) : null}

          <div>
            <h4 style={{ margin: "4px 0", fontSize: ".85rem" }}>History</h4>
            {historyRows(state.gc).length === 0 ? <p style={small} data-testid="cc-giftcomm-history-empty">No earlier terms. When terms change, the previous ones are kept here.</p> : (
              <ul data-testid="cc-giftcomm-history" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
                {historyRows(state.gc).map((h) => (
                  <li key={h.key} data-testid="cc-giftcomm-history-row" style={{ fontSize: ".8rem", borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                    <div>{h.text}</div><div style={{ color: "#64748b" }}>Starts {h.effectiveFrom}; set {h.setAt} by account {h.setBy}</div>
                  </li>))}
              </ul>
            )}
            <p style={small}>The history is a record only; earlier terms cannot be edited.</p>
          </div>
        </>
      ) : null}
    </section>
  );
}
