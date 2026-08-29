// src/pages/founder/SalespersonControlCenter.jsx
//
// TEAM B — SALES S1 · Founder Control Center (slice B1).
//
// Replaces PowerShell for the everyday salesperson-management work. B1 covers list, detail,
// create, and the one-time attribution link. Rotation, status, vanity URLs and reporting are
// deliberately NOT here yet — they arrive in later slices, green-gated on this one.
//
// AUTHORITY: the backend decides. Every endpoint behind this page is already
// `requireAuth, requireFounder`. The client-side gate below hides a door it does not lock: it
// keeps an ordinary user from seeing a surface that would only 403 anyway, and nothing more.
//
// THE ONE-TIME LINK is the sharpest rule on this page. `attributionToken` / `attributionLink`
// come back from create exactly once. They live in component state for that render and nowhere
// else — no storage, no URL, no logging. Navigating away or refreshing loses them, which is the
// intended behaviour and is asserted in test.

import { useCallback, useEffect, useMemo, useState } from "react";
import { salesAdminApi, salesAdminErrorMessage } from "../../api/salesAdmin.js";
import { isFounder } from "../../utils/accountState.js";

const card = {
  background: "var(--bg-primary)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)", padding: "1.25rem", boxShadow: "var(--shadow-xs)",
};
const label = {
  display: "block", fontSize: ".72rem", fontWeight: 700, letterSpacing: ".06em",
  textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: ".35rem",
};
const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: ".82rem" };

function readUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

export default function SalespersonControlCenter({ api = salesAdminApi, user: injectedUser } = {}) {
  const user = injectedUser !== undefined ? injectedUser : readUser();
  const founder = isFounder(user);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const [form, setForm] = useState({ salespersonId: "", displayName: "", email: "" });
  const [creating, setCreating] = useState(false);
  // The show-once payload. Never persisted; cleared the moment it is dismissed.
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);

  // ── B2 state ──
  // `confirm` holds the pending destructive intent: { kind, salespersonId, name }. Nothing acts
  // until it is confirmed, and dismissing it performs no request at all.
  const [slugDraft, setSlugDraft] = useState("");
  const [publicLink, setPublicLink] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(null);

  // AWAITS BEFORE IT TOUCHES STATE. Calling setState synchronously from an effect body triggers a
  // cascading render, which `react-hooks/set-state-in-effect` rightly flags; `loading` therefore
  // starts true and is only ever resolved after the request settles.
  const load = useCallback(async () => {
    const res = await api.list();
    if (!res.ok) {
      setRows([]); setMessage(salesAdminErrorMessage(res, { context: "load" })); setLoading(false);
      return;
    }
    setRows(Array.isArray(res.data && res.data.salespeople) ? res.data.salespeople : []);
    setMessage(null); setLoading(false);
  }, [api]);

  // The initial load lives INSIDE the effect as an async block that awaits before touching state.
  // Calling a setState-bearing helper straight from an effect body is what
  // `react-hooks/set-state-in-effect` warns about, and the warning is fair: it is the shape that
  // causes cascading renders. The `alive` guard is the other half — an unmounted page must not
  // set state when a slow response finally lands.
  useEffect(() => {
    if (!founder) return undefined;
    let alive = true;
    (async () => {
      const res = await api.list();
      if (!alive) return;
      if (!res.ok) {
        setRows([]); setMessage(salesAdminErrorMessage(res, { context: "load" })); setLoading(false);
        return;
      }
      setRows(Array.isArray(res.data && res.data.salespeople) ? res.data.salespeople : []);
      setMessage(null); setLoading(false);
    })();
    return () => { alive = false; };
  }, [founder, api]);

  // A PLAIN function, deliberately: it is invoked from a click handler and never from an effect,
  // and wrapping it in useCallback made the lint rule read its synchronous setState as effect
  // behaviour. Nothing depends on its identity, so the hook bought nothing.
  async function openDetail(id) {
    setSelectedId(id); setDetail(null); setDetailBusy(true); setMessage(null);
    const res = await api.read(id);
    setDetailBusy(false);
    if (!res.ok) { setMessage(salesAdminErrorMessage(res, { context: "read" })); return; }
    const sp = (res.data && res.data.salesperson) || null;
    setDetail(sp);
    setSlugDraft((sp && sp.referralSlug) || "");
    setPublicLink((res.data && res.data.publicReferralLink) || null);
  }

  /** Apply the detail payload every B2 mutation returns, so the surface never guesses. */
  function adoptDetail(res) {
    const sp = (res.data && res.data.salesperson) || null;
    if (sp) setDetail(sp);
    setSlugDraft((sp && sp.referralSlug) || "");
    if (Object.prototype.hasOwnProperty.call(res.data || {}, "publicReferralLink")) {
      setPublicLink(res.data.publicReferralLink || null);
    }
  }

  async function saveSlug(remove) {
    if (!detail || busy) return;
    setBusy(remove ? "slug-remove" : "slug-save"); setMessage(null);
    const res = remove
      ? await api.removeReferralSlug(detail.salespersonId)
      : await api.setReferralSlug(detail.salespersonId, slugDraft);
    setBusy(null);
    if (!res.ok) { setMessage(salesAdminErrorMessage(res, { context: "slug" })); return; }
    adoptDetail(res);
    await refresh();
  }

  /** Every destructive action funnels through here — nothing runs without an explicit confirm. */
  async function runConfirmed() {
    if (!confirm || busy) return;
    const { kind, salespersonId } = confirm;
    setBusy(kind); setMessage(null);
    let res;
    if (kind === "rotate") res = await api.rotateToken(salespersonId);
    else if (kind === "disable") res = await api.setStatus(salespersonId, "inactive");
    else if (kind === "reactivate") res = await api.setStatus(salespersonId, "active");
    setBusy(null);
    setConfirm(null);
    if (!res || !res.ok) { setMessage(salesAdminErrorMessage(res, { context: kind })); return; }
    if (kind === "rotate") {
      // The replacement link, held in state for this render only — exactly like creation.
      setIssued({
        salespersonId,
        displayName: (detail && detail.displayName) || salespersonId,
        attributionLink: (res.data && res.data.attributionLink) || "",
        rotated: true,
      });
      setCopied(false);
    }
    // Status changes are adopted from the SERVER response, never applied optimistically.
    adoptDetail(res);
    await refresh();
  }

  /** Re-read the list so the surface reflects the server after any mutation. */
  async function refresh() {
    const res = await api.list();
    if (!res.ok) return;
    setRows(Array.isArray(res.data && res.data.salespeople) ? res.data.salespeople : []);
  }

  const canCreate = useMemo(
    () => form.salespersonId.trim() !== "" && form.displayName.trim() !== "" && !creating,
    [form, creating],
  );

  async function submitCreate(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!canCreate) return;
    setCreating(true); setMessage(null); setCopied(false);
    const res = await api.create({
      salespersonId: form.salespersonId.trim(),
      displayName: form.displayName.trim(),
      email: form.email,
    });
    setCreating(false);
    if (!res.ok) { setMessage(salesAdminErrorMessage(res, { context: "create" })); return; }
    // Held in state only. This is the single moment the link exists on the client.
    setIssued({
      salespersonId: (res.data && res.data.salesperson && res.data.salesperson.salespersonId) || form.salespersonId.trim(),
      displayName: form.displayName.trim(),
      attributionLink: (res.data && res.data.attributionLink) || "",
    });
    setForm({ salespersonId: "", displayName: "", email: "" });
    await load();
  }

  async function copyLink() {
    if (!issued || !issued.attributionLink) return;
    try {
      await navigator.clipboard.writeText(issued.attributionLink);
      setCopied(true);
    } catch {
      // Clipboard can be denied; the link is on screen and selectable either way.
      setCopied(false);
      setMessage("Couldn’t copy automatically — select the link and copy it manually.");
    }
  }

  // ── ORDINARY USERS SEE NOTHING ──
  // Rendered before any request is issued, so a non-founder never even triggers a call that would
  // 403. The route and the navigation entry are gated identically.
  if (!founder) {
    return (
      <div style={{ padding: "2rem" }} data-testid="fcc-denied">
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Not available</h1>
        <p style={{ marginTop: ".5rem", color: "var(--text-secondary)" }}>
          This area is limited to the founder account.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }} data-testid="founder-control-center">
      <header style={{ marginBottom: "1.25rem" }}>
        <p style={{ ...label, marginBottom: ".15rem" }}>Founder</p>
        <h1 style={{ fontSize: "1.6rem", margin: 0 }}>Salesperson Control Center</h1>
        <p style={{ margin: ".35rem 0 0", color: "var(--text-secondary)", fontSize: ".9rem" }}>
          Create and review salespeople and their attribution links.
        </p>
      </header>

      {message ? (
        <p data-testid="fcc-message" role="status"
          style={{ ...card, borderColor: "var(--warning)", color: "var(--text-primary)", marginBottom: "1rem", fontSize: ".88rem" }}>
          {message}
        </p>
      ) : null}

      {/* ── THE ONE-TIME LINK ───────────────────────────────────────────────────────────────
          Shown once, immediately after creation, and never again. The copy makes that explicit
          rather than leaving the founder to discover it by refreshing and losing the link. */}
      {issued ? (
        <section data-testid="fcc-issued-link"
          style={{ ...card, borderColor: "var(--primary)", marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", margin: "0 0 .25rem" }}>
            Attribution link for {issued.displayName}
          </h2>
          <p style={{ margin: "0 0 .75rem", color: "var(--text-secondary)", fontSize: ".85rem" }}>
            {issued.rotated
              ? "The previous link is now invalid and will no longer attribute anyone. This replacement is shown once — copy it now; refreshing this page will clear it."
              : "This link is shown once. Copy it now — you won’t be able to see it again, and refreshing this page will clear it."}
          </p>
          <p data-testid="fcc-issued-link-value" style={{ ...mono, wordBreak: "break-all", margin: "0 0 .75rem" }}>
            {issued.attributionLink}
          </p>
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            <button type="button" className="btn-primary" data-testid="fcc-copy-link" onClick={copyLink}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <button type="button" className="btn-secondary" data-testid="fcc-dismiss-link"
              onClick={() => { setIssued(null); setCopied(false); }}>
              I’ve saved it
            </button>
          </div>
        </section>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "1.25rem", alignItems: "start" }}>
        {/* ── CREATE ── */}
        <section style={card}>
          <h2 style={{ fontSize: "1rem", margin: "0 0 .75rem" }}>Add a salesperson</h2>
          <form onSubmit={submitCreate} data-testid="fcc-create-form">
            <div style={{ marginBottom: ".75rem" }}>
              <label style={label} htmlFor="fcc-id">Salesperson ID</label>
              <input id="fcc-id" data-testid="fcc-input-id" value={form.salespersonId}
                onChange={(e) => setForm((f) => ({ ...f, salespersonId: e.target.value }))} />
            </div>
            <div style={{ marginBottom: ".75rem" }}>
              <label style={label} htmlFor="fcc-name">Display name</label>
              <input id="fcc-name" data-testid="fcc-input-name" value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div style={{ marginBottom: ".9rem" }}>
              <label style={label} htmlFor="fcc-email">Email (optional)</label>
              <input id="fcc-email" data-testid="fcc-input-email" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary" data-testid="fcc-create-submit" disabled={!canCreate}>
              {creating ? "Creating…" : "Create salesperson"}
            </button>
          </form>
        </section>

        {/* ── LIST ── */}
        <section style={card}>
          <h2 style={{ fontSize: "1rem", margin: "0 0 .75rem" }}>Salespeople</h2>
          {loading ? (
            <p data-testid="fcc-loading" style={{ color: "var(--text-secondary)", fontSize: ".88rem" }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p data-testid="fcc-empty" style={{ color: "var(--text-secondary)", fontSize: ".88rem" }}>
              No salespeople yet.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: ".4rem" }}>
              {rows.map((sp) => (
                <li key={sp.salespersonId}>
                  <button type="button" data-testid={`fcc-row-${sp.salespersonId}`}
                    onClick={() => openDetail(sp.salespersonId)}
                    style={{
                      width: "100%", textAlign: "left", background: "transparent",
                      border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
                      padding: ".6rem .75rem", cursor: "pointer",
                      outline: selectedId === sp.salespersonId ? "2px solid var(--primary)" : "none",
                    }}>
                    <span style={{ fontWeight: 600 }}>{sp.displayName || sp.salespersonId}</span>
                    <span style={{ ...mono, display: "block", color: "var(--text-tertiary)" }}>{sp.salespersonId}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── DETAIL ── */}
      {selectedId ? (
        <section style={{ ...card, marginTop: "1.25rem" }} data-testid="fcc-detail">
          <h2 style={{ fontSize: "1rem", margin: "0 0 .75rem" }}>Details</h2>
          {detailBusy ? (
            <p data-testid="fcc-detail-loading" style={{ color: "var(--text-secondary)", fontSize: ".88rem" }}>Loading…</p>
          ) : detail ? (
            <dl style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: ".4rem 1rem", margin: 0 }}>
              {[
                ["ID", detail.salespersonId],
                ["Name", detail.displayName],
                ["Email", detail.email || "—"],
                ["Status", detail.status || (detail.active === false ? "inactive" : "active")],
                ["Vanity URL", detail.referralSlug || "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt style={{ ...label, margin: 0 }}>{k}</dt>
                  <dd style={{ margin: 0, fontSize: ".88rem" }} data-testid={`fcc-detail-${k.toLowerCase().replace(/\s+/g, "-")}`}>
                    {String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p style={{ color: "var(--text-secondary)", fontSize: ".88rem" }}>Nothing to show.</p>
          )}

          {detail ? (
            <div style={{ marginTop: "1.1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              {/* ── VANITY ALIAS ──
                  Separate from the opaque link by design, and the copy says so: changing or
                  removing an alias never touches the attribution token. */}
              <h3 style={{ fontSize: ".92rem", margin: "0 0 .5rem" }}>Vanity URL</h3>
              <p style={{ margin: "0 0 .6rem", color: "var(--text-secondary)", fontSize: ".82rem" }}>
                A readable alias. The opaque attribution link is separate and is not changed by
                editing or removing this.
              </p>
              {publicLink ? (
                <p data-testid="fcc-public-link" style={{ ...mono, margin: "0 0 .6rem", wordBreak: "break-all" }}>{publicLink}</p>
              ) : null}
              <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "center" }}>
                <input data-testid="fcc-slug-input" aria-label="Vanity URL" value={slugDraft}
                  onChange={(e) => setSlugDraft(e.target.value)} style={{ maxWidth: 260 }} />
                <button type="button" className="btn-primary" data-testid="fcc-slug-save"
                  disabled={busy !== null || slugDraft.trim() === ""} onClick={() => saveSlug(false)}>
                  {detail.referralSlug ? "Replace" : "Assign"}
                </button>
                {detail.referralSlug ? (
                  <button type="button" className="btn-secondary" data-testid="fcc-slug-remove"
                    disabled={busy !== null} onClick={() => saveSlug(true)}>Remove</button>
                ) : null}
              </div>

              {/* ── DESTRUCTIVE ACTIONS, deliberately set apart ── */}
              <div style={{ marginTop: "1.1rem", display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
                <button type="button" className="btn-secondary" data-testid="fcc-rotate"
                  disabled={busy !== null}
                  onClick={() => setConfirm({ kind: "rotate", salespersonId: detail.salespersonId, name: detail.displayName })}>
                  Rotate attribution link
                </button>
                {String(detail.status) === "inactive" ? (
                  <button type="button" className="btn-secondary" data-testid="fcc-reactivate"
                    disabled={busy !== null}
                    onClick={() => setConfirm({ kind: "reactivate", salespersonId: detail.salespersonId, name: detail.displayName })}>
                    Reactivate
                  </button>
                ) : (
                  <button type="button" className="btn-secondary" data-testid="fcc-disable"
                    disabled={busy !== null}
                    onClick={() => setConfirm({ kind: "disable", salespersonId: detail.salespersonId, name: detail.displayName })}>
                    Disable
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── DESTRUCTIVE CONFIRMATION ──
          One dialog for all three actions. Cancel is the safe default, Escape dismisses, and
          NOTHING is requested until the explicit confirm button is pressed. */}
      {confirm ? (
        <div role="dialog" aria-modal="true" aria-labelledby="fcc-confirm-title"
          data-testid="fcc-confirm"
          onKeyDown={(e) => { if (e.key === "Escape") setConfirm(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 50 }}>
          <div style={{ ...card, maxWidth: 460, width: "100%" }}>
            <h2 id="fcc-confirm-title" style={{ fontSize: "1.05rem", margin: "0 0 .5rem" }}>
              {confirm.kind === "rotate" ? `Rotate the attribution link for “${confirm.name}”?`
                : confirm.kind === "disable" ? `Disable “${confirm.name}”?`
                : `Reactivate “${confirm.name}”?`}
            </h2>
            <p data-testid="fcc-confirm-body" style={{ margin: "0 0 1rem", color: "var(--text-secondary)", fontSize: ".88rem" }}>
              {confirm.kind === "rotate"
                ? "The current attribution link stops working immediately and cannot be recovered. Anyone using it will no longer be attributed. The replacement is shown once."
                : confirm.kind === "disable"
                  ? "New attribution stops. Existing attribution history and commission records are kept."
                  : "New attribution resumes for this salesperson."}
            </p>
            <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="btn-secondary" data-testid="fcc-confirm-cancel"
                onClick={() => setConfirm(null)} autoFocus>Cancel</button>
              <button type="button" className="btn-primary" data-testid="fcc-confirm-go"
                disabled={busy !== null} onClick={runConfirmed}>
                {confirm.kind === "rotate" ? "Rotate link" : confirm.kind === "disable" ? "Disable" : "Reactivate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
