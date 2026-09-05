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

/**
 * Money, stated honestly.
 *
 * The API returns MINOR UNITS and the summary carries no currency at all, so nothing here divides
 * by 100 or attaches a symbol - a guessed currency on a commission figure is worse than an ugly
 * one. The raw integer is shown with its unit named, and the currency is printed only when the
 * server actually supplied one.
 */
function minorUnits(value, currency) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "\u2014";
  const n = value.toLocaleString("en-US");
  return currency ? `${n} ${currency} (minor units)` : `${n} (minor units)`;
}

/**
 * The complete shareable link for a stored vanity slug.
 *
 * RECONSTRUCTED, never remembered. The slug is the only thing the server persists, so the link is
 * derived from it plus the CURRENT origin every time it is rendered. That is what makes it survive
 * a refresh: there is nothing to lose. It also means the surface no longer depends on the API
 * returning `publicReferralLink` — that field is a convenience on two mutation responses, not
 * something a page load ever receives.
 *
 * The origin is read from the browser, so production yields https://greet-me.com/<slug> while a
 * local or test environment yields its own origin and stays testable.
 */
function shareableLink(slug, origin) {
  const clean = typeof slug === "string" ? slug.trim() : "";
  if (!clean) return null;
  let base = origin;
  if (!base) {
    try { base = window.location.origin; } catch { base = ""; }
  }
  if (!base) return null;
  return `${String(base).replace(/\/+$/, "")}/${clean}`;
}

function readUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

/**
 * The platform default schedule, as percentages. A salesperson with no stored terms earns exactly
 * this, so the form shows it rather than blanks — the founder edits what is true today instead of
 * guessing what the empty state means.
 */
function defaultCompDraft() {
  return {
    year_1: "25", year_2: "15", year_3_plus: "10",
    referrerSalespersonId: "", overrideRateBps: "5", referralStatus: "active",
  };
}

/** Stored basis points → the percentages shown in the form. */
function compDraftFrom(sp) {
  const pct = (bps) => (Number.isFinite(bps) ? String(bps / 100) : null);
  const c = sp && sp.compensation;
  const r = sp && sp.referral;
  const base = defaultCompDraft();
  return {
    year_1: (c && pct(c.year_1)) ?? base.year_1,
    year_2: (c && pct(c.year_2)) ?? base.year_2,
    year_3_plus: (c && pct(c.year_3_plus)) ?? base.year_3_plus,
    referrerSalespersonId: (r && r.referrerSalespersonId) || "",
    overrideRateBps: (r && pct(r.overrideRateBps)) ?? base.overrideRateBps,
    referralStatus: (r && r.status) || "active",
  };
}

export default function SalespersonControlCenter({ api = salesAdminApi, user: injectedUser, origin: originOverride } = {}) {
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
  // Percentages as the founder types them. Prefilled from the salesperson's stored terms, or from
  // the platform default (25 / 15 / 10) when they have none — a legacy salesperson is shown what
  // they actually earn, not three empty boxes.
  const [compDraft, setCompDraft] = useState(defaultCompDraft());
  // No `publicLink` state any more. The link is DERIVED from the server-confirmed slug below, so
  // it updates when a replacement succeeds, disappears when a removal succeeds, and is preserved
  // untouched when either fails — because in each case `detail` is only ever replaced by a real
  // server response.
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(null);

  // ── B3 read-only reporting ──
  // `null` means "not requested"; an object with `error` means the request FAILED; an object with
  // data and zero rows means genuinely empty. Those three are never collapsed into one another.
  const [report, setReport] = useState(null);
  const [controls, setControls] = useState(null);
  const [pendingId, setPendingId] = useState("");
  const [pending, setPending] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

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
    setCompDraft(compDraftFrom(sp));
    setReport(null); setPending(null); setPendingId(""); setShareCopied(false);
    if (sp) loadReport(sp.salespersonId);
  }

  /** Read-only. Three GETs, each reported on its own terms — a failure is never shown as empty. */
  async function loadReport(salespersonId) {
    // Reporting is an OPTIONAL capability of the injected client. A client that predates B3 - or a
    // narrower one supplied by a caller - simply has no reporting surface, and the page must stay
    // fully usable rather than throwing on a missing method. Guarded per call, not assumed.
    const can = (fn) => typeof api[fn] === "function";
    if (!can("summary") && !can("attributionHealth") && !can("ledger")) return;
    const [sum, health, led] = await Promise.all([
      can("summary") ? api.summary(salespersonId) : Promise.resolve({ ok: true, data: {} }),
      can("attributionHealth") ? api.attributionHealth(salespersonId) : Promise.resolve({ ok: true, data: {} }),
      can("ledger") ? api.ledger(salespersonId) : Promise.resolve({ ok: true, data: {} }),
    ]);
    setReport({
      summary: sum.ok ? (sum.data && sum.data.summary) || null : null,
      summaryError: sum.ok ? null : salesAdminErrorMessage(sum, { context: "read" }),
      health: health.ok ? (health.data && health.data.attributionHealth) || null : null,
      healthError: health.ok ? null : salesAdminErrorMessage(health, { context: "read" }),
      entries: led.ok && Array.isArray(led.data && led.data.entries) ? led.data.entries : null,
      ledgerError: led.ok ? null : salesAdminErrorMessage(led, { context: "read" }),
    });
    // Controls ride along with attribution-health, and are also readable on their own.
    if (health.ok && health.data && health.data.controls) setControls(health.data.controls);
    else if (typeof api.controls === "function") {
      const c = await api.controls();
      if (c.ok) setControls((c.data && c.data.controls) || null);
    }
  }

  /** Pending attribution for ONE deliberately entered user id. Never enumerated. */
  async function lookupPending() {
    const id = pendingId.trim();
    if (!id || busy) return;
    setBusy("pending"); setPending(null);
    const res = await api.pendingForUser(id);
    setBusy(null);
    if (!res.ok) { setPending({ error: salesAdminErrorMessage(res, { context: "read" }) }); return; }
    setPending({ value: (res.data && res.data.pending) ?? null });
  }

  /** Apply the detail payload every B2 mutation returns, so the surface never guesses. */
  function adoptDetail(res) {
    const sp = (res.data && res.data.salesperson) || null;
    if (sp) setDetail(sp);
    setSlugDraft((sp && sp.referralSlug) || "");
    setCompDraft(compDraftFrom(sp));
    // publicReferralLink is deliberately ignored: the link is reconstructed from the slug the
    // server just confirmed, so there is one source of truth rather than two that can disagree.
  }

  // Derived, not stored. Recomputed on every render from the slug the server confirmed.
  const shareLink = shareableLink(detail && detail.referralSlug, originOverride);

  // Derived the same way: an override is only real when a referrer is selected. Everything the
  // override controls show hangs off this one value, so the display cannot disagree with what a
  // save would actually send.
  const hasReferrer = compDraft.referrerSalespersonId !== "";

  async function copyShareLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareCopied(true);
    } catch {
      // The URL stays on screen and selectable, so a denied clipboard costs nothing.
      setShareCopied(false);
      setMessage("Couldn’t copy automatically — select the link above and copy it manually.");
    }
  }

  /**
   * Save the terms that will apply to the NEXT originated customer.
   *
   * Percentages are entered as percentages and stored as BASIS POINTS, converted here in the one
   * place that sees both, so a founder never has to think in bps and the wire always carries an
   * exact integer. `12.5` becomes 1250; a value that is not a finite number in 0..100 is refused
   * before any request is made.
   */
  async function saveCompensation() {
    if (!detail || busy) return;
    const toBps = (v) => {
      const n = Number(String(v).trim());
      if (!Number.isFinite(n) || n < 0 || n > 100) return null;
      return Math.round(n * 100);
    };
    const y1 = toBps(compDraft.year_1);
    const y2 = toBps(compDraft.year_2);
    const y3 = toBps(compDraft.year_3_plus);
    if (y1 === null || y2 === null || y3 === null) {
      setMessage("Each rate must be a percentage between 0 and 100.");
      return;
    }
    let referral = null;
    if (compDraft.referrerSalespersonId) {
      const ovr = toBps(compDraft.overrideRateBps);
      if (ovr === null) { setMessage("The override must be a percentage between 0 and 100."); return; }
      referral = {
        referrerSalespersonId: compDraft.referrerSalespersonId,
        overrideRateBps: ovr,
        status: compDraft.referralStatus === "ended" ? "ended" : "active",
      };
    }
    setBusy("comp-save"); setMessage(null);
    const res = await api.setCompensation(detail.salespersonId, {
      compensation: { year_1: y1, year_2: y2, year_3_plus: y3 },
      referral,
    });
    setBusy(null);
    if (!res.ok) { setMessage(salesAdminErrorMessage(res, { context: "compensation" })); return; }
    adoptDetail(res);
    await refresh();
    setMessage("Terms saved. They apply to customers originated from now on.");
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
              {shareLink ? (
                <div style={{ margin: "0 0 .7rem" }}>
                  <p style={{ ...label, margin: "0 0 .25rem" }}>Shareable salesperson link</p>
                  <p data-testid="fcc-public-link" style={{ ...mono, margin: "0 0 .45rem", wordBreak: "break-all", userSelect: "all" }}>
                    {shareLink}
                  </p>
                  <button type="button" className="btn-secondary" data-testid="fcc-copy-share"
                    style={{ padding: ".3rem .7rem", fontSize: ".78rem" }}
                    onClick={copyShareLink}>
                    {shareCopied ? "Copied" : "Copy link"}
                  </button>
                </div>
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

              {/* ── COMPENSATION ──
                  FORWARD-ONLY, and the copy says so plainly. Terms are frozen onto each customer
                  when that customer is first originated, so saving here changes what the NEXT
                  originated customer will generate and nothing that already exists. */}
              <div style={{ marginTop: "1.1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                <h3 style={{ fontSize: ".92rem", margin: "0 0 .5rem" }}>Commission terms</h3>
                <p style={{ margin: "0 0 .6rem", color: "var(--text-secondary)", fontSize: ".82rem" }}>
                  Applies to customers originated from now on. Customers who already exist keep the
                  terms frozen when they were originated, and no past commission is recalculated.
                  Each customer&rsquo;s year clock runs from their own start date.
                </p>

                <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                  {[
                    ["year_1", "Year 1 %", "fcc-rate-y1"],
                    ["year_2", "Year 2 %", "fcc-rate-y2"],
                    ["year_3_plus", "Year 3+ %", "fcc-rate-y3"],
                  ].map(([key, labelText, tid]) => (
                    <div key={key}>
                      <p style={{ ...label, margin: "0 0 .25rem" }}>{labelText}</p>
                      <input data-testid={tid} aria-label={labelText} inputMode="decimal"
                        value={compDraft[key]}
                        onChange={(e) => setCompDraft((d) => ({ ...d, [key]: e.target.value }))}
                        style={{ maxWidth: 92 }} />
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: ".7rem" }}>
                  <div>
                    <p style={{ ...label, margin: "0 0 .25rem" }}>Referring salesperson</p>
                    {/* Chosen from the existing directory, so the stored value is always a
                        PERMANENT salesperson id. A vanity URL is never an option here. */}
                    <select data-testid="fcc-referrer" aria-label="Referring salesperson"
                      value={compDraft.referrerSalespersonId}
                      onChange={(e) => setCompDraft((d) => ({ ...d, referrerSalespersonId: e.target.value }))}
                      style={{ maxWidth: 240 }}>
                      <option value="">None</option>
                      {rows
                        .filter((r) => r.salespersonId !== detail.salespersonId)
                        .map((r) => (
                          <option key={r.salespersonId} value={r.salespersonId}>
                            {r.displayName} ({r.salespersonId})
                          </option>
                        ))}
                    </select>
                  </div>
                  {/* An override only exists when a referrer does. Showing "5" and "Active" beside
                      a referrer of None described an override that is not configured and would not
                      be saved — the reader cannot tell an inert default from a live arrangement.
                      Both are DERIVED from the selected referrer rather than mirrored into state,
                      so nothing has to be cleared to make the display honest and re-selecting a
                      referrer restores the draft the founder was working with. */}
                  <div>
                    <p style={{ ...label, margin: "0 0 .25rem" }}>Override %</p>
                    <input data-testid="fcc-override-rate" aria-label="Override %" inputMode="decimal"
                      value={hasReferrer ? compDraft.overrideRateBps : ""}
                      onChange={(e) => setCompDraft((d) => ({ ...d, overrideRateBps: e.target.value }))}
                      disabled={!hasReferrer}
                      style={{ maxWidth: 92 }} />
                  </div>
                  {hasReferrer ? (
                    <div>
                      <p style={{ ...label, margin: "0 0 .25rem" }}>Override status</p>
                      <select data-testid="fcc-override-status" aria-label="Override status"
                        value={compDraft.referralStatus}
                        onChange={(e) => setCompDraft((d) => ({ ...d, referralStatus: e.target.value }))}
                        style={{ maxWidth: 140 }}>
                        <option value="active">Active</option>
                        <option value="ended">Ended</option>
                      </select>
                    </div>
                  ) : null}
                </div>

                <p style={{ margin: ".55rem 0 .6rem", color: "var(--text-secondary)", fontSize: ".8rem" }}>
                  The override is additive: it is paid on the same base as the direct commission and
                  comes out of Greet-Me&rsquo;s share, not the salesperson&rsquo;s.
                </p>

                <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" className="btn-primary" data-testid="fcc-comp-save"
                    disabled={busy !== null} onClick={saveCompensation}>Save terms</button>
                  <button type="button" className="btn-secondary" data-testid="fcc-comp-default"
                    disabled={busy !== null} onClick={() => setCompDraft(defaultCompDraft())}>
                    Reset to default (25 / 15 / 10)
                  </button>
                </div>
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

          {/* B3 - READ-ONLY REPORTING. Nothing below mutates anything, and every figure is
              printed exactly as the server stated it. */}
          {detail && report ? (
            <div style={{ marginTop: "1.2rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }} data-testid="fcc-report">
              <h3 style={{ fontSize: ".92rem", margin: "0 0 .6rem" }}>Attribution and commission</h3>

              {report.summaryError ? (
                <p data-testid="fcc-summary-error" style={{ color: "var(--warning)", fontSize: ".84rem", margin: "0 0 .6rem" }}>{report.summaryError}</p>
              ) : report.summary ? (
                <dl data-testid="fcc-summary" style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: ".3rem 1rem", margin: "0 0 .9rem" }}>
                  {[
                    ["Direct customers", report.summary.originatedDirectCustomers],
                    ["Fundraiser partners", report.summary.originatedFundraiserPartners],
                    ["Initial conversions", report.summary.originalPaidConversions],
                    ["Recurring payments", report.summary.recurringPaidTransactions],
                    ["Ledger entries", report.summary.entryCount],
                    ["Eligible revenue", minorUnits(report.summary.eligibleRevenueMinor)],
                    ["Commission pending", minorUnits(report.summary.pendingCommissionMinor)],
                    ["Commission approved", minorUnits(report.summary.approvedCommissionMinor)],
                    ["Commission paid", minorUnits(report.summary.paidCommissionMinor)],
                    ["Commission reversed", minorUnits(report.summary.reversedCommissionMinor)],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "contents" }}>
                      <dt style={{ ...label, margin: 0 }}>{k}</dt>
                      <dd style={{ margin: 0, fontSize: ".85rem" }}>{v === null || v === undefined ? "\u2014" : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {report.healthError ? (
                <p data-testid="fcc-health-error" style={{ color: "var(--warning)", fontSize: ".84rem", margin: "0 0 .6rem" }}>{report.healthError}</p>
              ) : report.health ? (
                <p data-testid="fcc-health" style={{ fontSize: ".84rem", margin: "0 0 .9rem", color: "var(--text-secondary)" }}>
                  {Object.entries(report.health).map(([k, v]) => `${k}: ${String(v)}`).join(" \u00b7 ")}
                </p>
              ) : null}

              <h4 style={{ ...label, margin: "0 0 .4rem" }}>Commission ledger</h4>
              {report.ledgerError ? (
                <p data-testid="fcc-ledger-error" style={{ color: "var(--warning)", fontSize: ".84rem" }}>{report.ledgerError}</p>
              ) : report.entries && report.entries.length === 0 ? (
                <p data-testid="fcc-ledger-empty" style={{ color: "var(--text-secondary)", fontSize: ".84rem" }}>
                  No commission entries yet.
                </p>
              ) : report.entries ? (
                <ul data-testid="fcc-ledger" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: ".4rem" }}>
                  {report.entries.map((e, i) => (
                    <li key={e.id || e.entryId || i} data-testid={`fcc-ledger-row-${i}`}
                      style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: ".5rem .65rem" }}>
                      <span style={{ ...mono, display: "block", color: "var(--text-tertiary)" }}>{e.id || e.entryId || "\u2014"}</span>
                      <span style={{ fontSize: ".84rem" }}>
                        {(e.status || "\u2014")} {"\u00b7"} {minorUnits(e.salespersonCommissionMinor, e.currency)}
                        {e.effectiveAt || e.at ? ` \u00b7 ${e.effectiveAt || e.at}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <h4 style={{ ...label, margin: "1rem 0 .4rem" }}>Pending attribution lookup</h4>
              <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "center" }}>
                <input data-testid="fcc-pending-input" aria-label="User ID" value={pendingId}
                  onChange={(ev) => setPendingId(ev.target.value)} style={{ maxWidth: 260 }} />
                <button type="button" className="btn-secondary" data-testid="fcc-pending-go"
                  disabled={busy !== null || pendingId.trim() === ""} onClick={lookupPending}>Look up</button>
              </div>
              {pending && pending.error ? (
                <p data-testid="fcc-pending-error" style={{ color: "var(--warning)", fontSize: ".84rem", marginTop: ".5rem" }}>{pending.error}</p>
              ) : pending && pending.value ? (
                <p data-testid="fcc-pending-value" style={{ ...mono, marginTop: ".5rem" }}>
                  {Object.entries(pending.value).map(([k, v]) => `${k}: ${String(v)}`).join(" \u00b7 ")}
                </p>
              ) : pending ? (
                <p data-testid="fcc-pending-none" style={{ color: "var(--text-secondary)", fontSize: ".84rem", marginTop: ".5rem" }}>
                  No pending attribution for that user.
                </p>
              ) : null}

              {controls ? (
                <div style={{ marginTop: "1rem" }} data-testid="fcc-controls">
                  <h4 style={{ ...label, margin: "0 0 .3rem" }}>Sales controls (read-only)</h4>
                  <p style={{ fontSize: ".84rem", margin: 0, color: "var(--text-secondary)" }}>
                    Referral link live: <strong>{String(controls.referralPublicLive)}</strong>
                    {" \u00b7 "}Attribution live: <strong>{String(controls.attributionLive)}</strong>
                  </p>
                </div>
              ) : null}
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
