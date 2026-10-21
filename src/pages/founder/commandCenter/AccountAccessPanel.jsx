// Sending and recipients for the salesperson's LINKED Greet-Me account (founder, 2026-10-21).
// Effective access, a one-time grant of N sends, unlimited sending on/off and a per-account recipient limit.
// Finite grants and the unlimited privilege are separate controls. Every change goes through a confirmation; the dialog
// keeps one change id until the change succeeds, so pressing Confirm again after a failure cannot apply it twice.
// The server is the authority for every value shown here; nothing is applied optimistically.
import { useCallback, useEffect, useState } from "react";
import CommissionSection from "./CommissionSection.jsx";
import { useUnsavedEdit } from "./unsavedEdits.js";
import { salesAdminErrorMessage } from "../../../api/salesAdmin.js";
import { accessSummary, reasonText, changeText, recipientLimitText, newChangeId, controlErrorMessage, GRANT_MAX } from "./accountAccessLogic.js";

const muted = { color: "var(--text-secondary)", fontSize: ".82rem" };
const h4 = { fontSize: ".84rem", margin: "0 0 .4rem" };
const block = { borderTop: "1px solid var(--border)", paddingTop: ".8rem" };
const pill = (ok) => ({ display: "inline-block", padding: ".1rem .5rem", borderRadius: 999, fontSize: ".75rem", fontWeight: 700,
  background: ok ? "var(--success-bg, #e7f6ec)" : "var(--danger-bg, #fdecec)", color: ok ? "var(--success, #166534)" : "var(--danger, #b42318)" });
// Same as the gift panel's checkbox: the global input style (width 100%) must not stretch ticks and radios.
const tick = { width: "auto", padding: 0, margin: 0, verticalAlign: "middle", display: "inline-block", flex: "0 0 auto" };
const card = { background: "var(--surface, #fff)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 14px)", padding: "1.1rem" };

export default function AccountAccessPanel({ api, salesperson }) {
  const spId = salesperson.salespersonId;
  // Gated by the api, like the Links panel: an injected api without these reads renders nothing.
  const supported = Boolean(api && typeof api.accountControls === "function" && typeof api.accountAudit === "function");
  const linked = Boolean(salesperson.linkedUserId);
  const [view, setView] = useState(null);       // null = loading; { error } = failed; else server view
  const [audit, setAudit] = useState(null);
  const [grantDraft, setGrantDraft] = useState("");
  const [unlimitedDraft, setUnlimitedDraft] = useState(false);
  const [limitMode, setLimitMode] = useState("plan"); // plan | number | unlimited
  const [limitDraft, setLimitDraft] = useState("");
  const [pending, setPending] = useState(null);  // { kind, value, changeId, title, body, error }
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const savedOverride = view && !view.error && view.recipients ? (view.recipients.override ?? null) : null;
  const savedMode = savedOverride === null ? "plan" : savedOverride === "unlimited" ? "unlimited" : "number";
  useUnsavedEdit("sending-and-recipients", pending !== null || grantDraft !== ""
    || (Boolean(view) && !view.error && Boolean(view.controls) && (unlimitedDraft !== view.controls.unlimitedSending
      || limitMode !== savedMode || (limitMode === "number" && limitDraft !== String(savedOverride)))));

  const adopt = useCallback((data) => {
    setView(data);
    setUnlimitedDraft(Boolean(data.controls && data.controls.unlimitedSending));
    const o = data.recipients ? data.recipients.override : null;
    setLimitMode(o === null || o === undefined ? "plan" : o === "unlimited" ? "unlimited" : "number");
    setLimitDraft(typeof o === "number" ? String(o) : "");
  }, []);

  const load = useCallback(async () => {
    const [res, aud] = await Promise.all([api.accountControls(spId), api.accountAudit(spId)]);
    if (!res.ok) { setView({ error: res.data && res.data.code === "NO_LINKED_ACCOUNT" ? "unlinked" : salesAdminErrorMessage(res, { context: "load" }) }); return; }
    adopt(res.data);
    setAudit(aud.ok ? (aud.data.changes || []) : { error: true });
  }, [api, spId, adopt]);

  useEffect(() => {
    if (!linked || !supported) return undefined;
    let alive = true;
    (async () => { if (alive) await load(); })();
    return () => { alive = false; };
  }, [linked, supported, load]);

  async function confirmPending() {
    if (!pending || busy) return;
    setBusy(true);
    const { kind, value, changeId } = pending;
    const res = kind === "grant" ? await api.grantSends(spId, value, changeId)
      : kind === "unlimited" ? await api.setUnlimitedSending(spId, value, changeId)
      : await api.setRecipientLimit(spId, value, changeId);
    setBusy(false);
    if (!res.ok) { setPending((p) => ({ ...p, error: controlErrorMessage(res) })); return; } // same changeId kept for a retry
    setPending(null);
    adopt(res.data);
    setGrantDraft("");
    setNotice(res.data.duplicate ? "Already applied — nothing was changed twice." : "Saved.");
    const aud = await api.accountAudit(spId);
    setAudit(aud.ok ? (aud.data.changes || []) : { error: true });
  }

  const name = salesperson.displayName || spId;
  const summary = !linked ? "No linked account" : view === null ? "Loading…" : view.error ? (view.error === "unlinked" ? "No linked account" : "Couldn’t load") : accessSummary(view);

  let body;
  if (!linked || (view && view.error === "unlinked")) {
    body = <p data-testid="acc-unlinked" style={{ ...muted, margin: 0 }}>No Greet-Me account is linked to this salesperson. Link one in Links to manage its sending and recipients.</p>;
  } else if (view === null) {
    body = <p data-testid="acc-loading" style={{ ...muted, margin: 0 }}>Loading…</p>;
  } else if (view.error) {
    body = (
      <div data-testid="acc-load-error" style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
        <p style={{ margin: 0, color: "var(--danger, #b42318)", fontSize: ".85rem" }}>{view.error}</p>
        <button type="button" className="btn-secondary" style={{ padding: ".3rem .7rem", fontSize: ".78rem" }} onClick={() => { setView(null); load(); }}>Try again</button>
      </div>
    );
  } else {
    const { account, access, controls, recipients, grants, grantAvailable } = view;
    const grantN = Number(grantDraft);
    const grantValid = Number.isInteger(grantN) && grantN >= 1 && grantN <= GRANT_MAX;
    const limitN = Number(limitDraft);
    const limitValue = limitMode === "plan" ? null : limitMode === "unlimited" ? "unlimited" : limitN;
    const limitValid = limitMode !== "number" || (limitDraft.trim() !== "" && Number.isInteger(limitN) && limitN >= 0 && limitN <= 10000);
    const limitChanged = limitValue !== (recipients.override ?? null);
    body = (
      <div style={{ display: "grid", gap: ".9rem" }}>
        {notice ? <p data-testid="acc-notice" role="status" style={{ margin: 0, fontSize: ".82rem", color: "var(--success, #166534)" }}>{notice}</p> : null}
        <div data-testid="acc-account">
          <p style={{ margin: 0, fontWeight: 600, fontSize: ".9rem" }}>{account.name || "No name on the account"}</p>
          <p style={{ margin: 0, ...muted }}>{account.email || "No email"}</p>
        </div>

        <div data-testid="acc-access">
          <h4 style={h4}>Sending access</h4>
          <p style={{ margin: "0 0 .3rem" }}>
            <span data-testid="acc-access-pill" style={pill(access.canSend)}>{access.canSend ? "Can send" : "Blocked"}</span>{" "}
            <span data-testid="acc-access-remaining" style={{ fontSize: ".86rem" }}>
              {controls.unlimitedSending ? "Unlimited" : `${access.remaining ?? 0} of ${access.limit} sends left`}
            </span>
          </p>
          <p data-testid="acc-access-reason" style={{ ...muted, margin: 0 }}>{reasonText(access, controls)}</p>
        </div>

        <div style={block} data-testid="acc-unlimited">
          <h4 style={h4}>Unlimited sending</h4>
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center", fontSize: ".86rem" }}>
            <input type="checkbox" style={tick} data-testid="acc-unlimited-toggle" checked={unlimitedDraft} onChange={(e) => setUnlimitedDraft(e.target.checked)} />
            Unlimited sending
          </label>
          <div style={{ marginTop: ".5rem" }}>
          <button type="button" className="btn-primary" data-testid="acc-unlimited-save"
            disabled={busy || unlimitedDraft === controls.unlimitedSending}
            onClick={() => setPending({ kind: "unlimited", value: unlimitedDraft, changeId: newChangeId(),
              title: unlimitedDraft ? `Turn on unlimited sending for “${name}”?` : `Turn off unlimited sending for “${name}”?`,
              body: unlimitedDraft ? "The send count, the recipient limit and the per-account daily AI limit stop applying to this account."
                : "The plan’s send count, recipient limit and daily AI limit apply again. Nothing is deleted; any one-time grant stays." })}>
            Save
          </button>
          </div>
        </div>

        <div style={block} data-testid="acc-grant">
          <h4 style={h4}>Grant sends (one-time)</h4>
          {grantAvailable ? (
            <div style={{ display: "flex", flexDirection: "column", gap: ".5rem", alignItems: "flex-start" }}>
              <input data-testid="acc-grant-input" aria-label="Number of sends to grant" inputMode="numeric" value={grantDraft}
                onChange={(e) => setGrantDraft(e.target.value.replace(/[^0-9]/g, ""))} style={{ width: 110 }} placeholder="e.g. 10" />
              <button type="button" className="btn-primary" data-testid="acc-grant-submit" disabled={busy || !grantValid}
                onClick={() => setPending({ kind: "grant", value: grantN, changeId: newChangeId(),
                  title: `Grant ${grantN} one-time send${grantN === 1 ? "" : "s"} to “${name}”?`,
                  body: `Remaining becomes ${(access.remaining ?? 0) + grantN}. This allowance does not refill.` })}>
                Grant sends
              </button>
              {grantDraft !== "" && !grantValid ? <span data-testid="acc-grant-invalid" style={{ ...muted, color: "var(--danger, #b42318)" }}>Enter 1 to {GRANT_MAX}.</span> : null}
            </div>
          ) : (
            <p data-testid="acc-grant-unavailable" style={{ ...muted, margin: 0 }}>
              {controls.unlimitedSending ? "Not needed while unlimited sending is on."
                : "Available on free-trial accounts only. On a monthly plan a grant would be added again every month."}
            </p>
          )}
          {grants.length ? (
            <ul data-testid="acc-grants" style={{ ...muted, margin: ".6rem 0 0", paddingLeft: "1.1rem" }}>
              {grants.map((g) => <li key={g.id}>{g.sends} sends, one-time, {String(g.grantedAt || "").slice(0, 10) || "date not recorded"}</li>)}
            </ul>
          ) : null}
        </div>

        <div style={block} data-testid="acc-recipients">
          <h4 style={h4}>Recipient limit</h4>
          <p data-testid="acc-recipients-current" style={{ margin: "0 0 .4rem", fontSize: ".86rem" }}>{recipientLimitText(recipients, controls)}</p>
          {controls.unlimitedSending ? <p style={{ ...muted, margin: "0 0 .4rem" }}>Unlimited sending already removes the recipient limit. This setting applies when unlimited sending is off.</p> : null}
          <div role="radiogroup" aria-label="Recipient limit" style={{ display: "flex", gap: ".9rem", flexWrap: "wrap", fontSize: ".84rem", marginBottom: ".45rem" }}>
            {[["plan", `Plan limit (${recipients.planLimit === null ? "no limit" : recipients.planLimit})`], ["number", "Custom"], ["unlimited", "No limit"]].map(([m, l]) => (
              <label key={m} style={{ display: "flex", gap: ".35rem", alignItems: "center", whiteSpace: "nowrap" }}>
                <input type="radio" style={tick} name={`acc-limit-${spId}`} data-testid={`acc-limit-${m}`} checked={limitMode === m} onChange={() => setLimitMode(m)} />{l}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "center" }}>
            {limitMode === "number" ? (
              <input data-testid="acc-limit-input" aria-label="Recipient limit" inputMode="numeric" value={limitDraft}
                onChange={(e) => setLimitDraft(e.target.value.replace(/[^0-9]/g, ""))} style={{ width: 110 }} />
            ) : null}
            <button type="button" className="btn-primary" data-testid="acc-limit-save" disabled={busy || !limitValid || !limitChanged}
              onClick={() => setPending({ kind: "recipient_limit", value: limitValue, changeId: newChangeId(),
                title: `Change the recipient limit for “${name}”?`,
                body: `${limitValue === null ? `Back to the plan limit (${recipients.planLimit === null ? "no limit" : recipients.planLimit}).` : limitValue === "unlimited" ? "No recipient limit." : `Limit ${limitValue}.`} Contacts are never deleted; above the limit, no new contacts can be added until below it.` })}>
              Save
            </button>
            {limitMode === "number" && !limitValid ? <span data-testid="acc-limit-invalid" style={{ ...muted, color: "var(--danger, #b42318)" }}>Enter a whole number from 0 to 10000.</span> : null}
          </div>
        </div>

        <div style={block} data-testid="acc-audit">
          <h4 style={h4}>Recent changes</h4>
          {audit === null ? <p style={{ ...muted, margin: 0 }}>Loading…</p>
            : audit.error ? <p data-testid="acc-audit-error" style={{ ...muted, margin: 0 }}>Couldn’t load the change history.</p>
            : audit.length === 0 ? <p data-testid="acc-audit-empty" style={{ ...muted, margin: 0 }}>No changes made here yet.</p>
            : (
              <ul style={{ ...muted, margin: 0, paddingLeft: "1.1rem" }}>
                {audit.map((a) => <li key={a.id || a.changeId} data-testid="acc-audit-row">{changeText(a)}</li>)}
              </ul>
            )}
        </div>
      </div>
    );
  }

  if (!supported) return null;
  return (
    <>
      <CommissionSection id="access" testPrefix="fcc-section" title="Sending and recipients" summary={summary}>{body}</CommissionSection>
      {pending ? (
        <div role="dialog" aria-modal="true" aria-labelledby="acc-confirm-title" data-testid="acc-confirm"
          onKeyDown={(e) => { if (e.key === "Escape" && !busy) setPending(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 50 }}>
          <div style={{ ...card, maxWidth: 460, width: "100%" }}>
            <h2 id="acc-confirm-title" style={{ fontSize: "1.05rem", margin: "0 0 .5rem" }}>{pending.title}</h2>
            <p data-testid="acc-confirm-body" style={{ margin: "0 0 .8rem", color: "var(--text-secondary)", fontSize: ".88rem" }}>{pending.body}</p>
            {pending.error ? <p data-testid="acc-confirm-error" role="alert" style={{ margin: "0 0 .8rem", color: "var(--danger, #b42318)", fontSize: ".85rem" }}>{pending.error}</p> : null}
            <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="btn-secondary" data-testid="acc-confirm-cancel" disabled={busy} onClick={() => setPending(null)} autoFocus>Cancel</button>
              <button type="button" className="btn-primary" data-testid="acc-confirm-go" disabled={busy} onClick={confirmPending}>
                {busy ? "Saving…" : pending.error ? "Try again" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
