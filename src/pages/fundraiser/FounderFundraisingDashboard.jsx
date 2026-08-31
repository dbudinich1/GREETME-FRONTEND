// src/pages/fundraiser/FounderFundraisingDashboard.jsx
//
// TEAM B — Founder/Admin fundraising dashboard (ONE of exactly two authenticated dashboards).
// Every panel's data is fetched from the backend, which enforces founder_admin server-side. No
// client role grants access. Truthful loading/empty/error/dormant/forbidden states. Payouts +
// economics activation are HELD. Not activated while the gate is false.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { fundraiserApi, stateFor } from "../../api/fundraiserApi.js";
import { isFundraiserUiEnabled } from "../../config/fundraiserGate.js";
import { pageWrap, box, h, btn, btnGhost, Stat, StateView, Empty, HeldBadge } from "./FundraiserUI.jsx";
// P2 — pure state model for the partner-administrator panel (no React/DOM/fetch inside).
import { STATES, resolveOutcome, assignOutcome, messageFor, canAssign, isAssigned } from "./partnerAdminAssign.js";

// NOTE: everything here is module-LOCAL. Exporting helpers from a component file trips
// react-refresh/only-export-components, and a separate module would fall outside this slice's
// authorized paths. The behaviour is proven through the rendered form instead, which is the
// stronger test anyway.
// ── F1 · DRAFT ECONOMICS ──────────────────────────────────────────────────────────────────────
//
// Every enum below is copied from the BACKEND validator (services/fundraiser/economics/
// economicsState.js) so the form can never offer a value the server would reject. Nothing is
// preselected: this module contains no default percentage, basis, share type or treatment,
// because a default here becomes a commercial term nobody chose.
//
// PERCENT UNIT: percentage points. 10 means 10%. The service renders `${percent}% of ${basis}`,
// so a decimal fraction would display as 0.1%. Founder-decided client range is 0-100 inclusive;
// the value is never silently clamped or transformed - it is refused with a visible reason.
const F1_SHARE_TYPES = ["none", "percent_of_base", "custom"];
const F1_BASES = ["ENSR", "ENGP", "gross", "custom"];
const F1_TREATMENTS = Object.freeze({
  onboardingFeeTreatment: ["excluded_retained", "excluded_waived"],
  veteransContributionTreatment: ["excluded", "contribute_from_platform_share_only"],
  discountTreatment: ["ineligible", "eligible_on_net", "eligible_on_gross"],
  taxTreatment: ["excluded_from_base"],
  processorFeeTreatment: ["net_of_processor", "gross_absorbed_by_platform"],
});

/** Percent text -> { ok, value } | { ok:false, error }. Never clamps; never coerces silently. */
function f1ParsePercent(raw) {
  const text = String(raw ?? "").trim();
  if (text === "") return { ok: false, error: "Enter a percentage." };
  const n = Number(text);
  if (!Number.isFinite(n)) return { ok: false, error: "Enter a number between 0 and 100." };
  if (n < 0) return { ok: false, error: "A share cannot be negative." };
  if (n > 100) return { ok: false, error: "A share cannot exceed 100." };
  return { ok: true, value: n };
}

/** Build one share rule from form state, or report why it is not yet resolvable. */
function f1BuildShare(draft) {
  const type = draft.type;
  if (!F1_SHARE_TYPES.includes(type)) return { ok: false, error: "Choose a share type." };
  if (type === "none") return { ok: true, rule: { type: "none" } };
  if (type === "custom") {
    const notes = String(draft.notes ?? "").trim();
    if (notes === "") return { ok: false, error: "Custom terms need a note describing them." };
    return { ok: true, rule: { type: "custom", notes } };
  }
  if (!F1_BASES.includes(draft.basis)) return { ok: false, error: "Choose a basis." };
  const pct = f1ParsePercent(draft.percent);
  if (!pct.ok) return { ok: false, error: pct.error };
  return { ok: true, rule: { type: "percent_of_base", basis: draft.basis, percent: pct.value } };
}

/** The whole form, validated the way the server validates it. No inference anywhere. */
function f1BuildPayload({ organizationId, campaignId, initial, renewal, giftEnabled, gift, treatments }) {
  const errors = {};
  if (!organizationId || !campaignId) errors.selection = "Choose an organization and campaign.";

  const i = f1BuildShare(initial);
  if (!i.ok) errors.initial = i.error;
  const r = f1BuildShare(renewal);
  if (!r.ok) errors.renewal = r.error;

  let g = null;
  if (giftEnabled) {
    const built = f1BuildShare(gift);
    if (!built.ok) errors.gift = built.error; else g = built.rule;
  }

  for (const [key, allowed] of Object.entries(F1_TREATMENTS)) {
    if (!allowed.includes(treatments[key])) errors[key] = "Choose a treatment.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const rules = {
    initialSubscriptionShare: i.rule,
    renewalShare: r.rule,
    // Stated explicitly either way: the server reads `=== true`, and an absent flag would leave
    // the gift position unsaid rather than deliberately off.
    giftParticipationEnabled: giftEnabled === true,
  };
  if (giftEnabled) rules.giftShare = g;

  return { ok: true, payload: { organizationId, campaignId, rules, treatments: { ...treatments } } };
}

/** Read-only rendering of a stored share, including shapes F1 cannot create (e.g. tiered). */
function f1DescribeShare(rule) {
  if (!rule || typeof rule !== "object") return "\u2014";
  if (rule.type === "none") return "none";
  if (rule.type === "custom") return `custom \u2014 ${rule.notes || "(no note)"}`;
  if (rule.type === "percent_of_base") return `${rule.percent}% of ${rule.basis}`;
  if (rule.type === "tiered") {
    // F1 cannot CREATE a tiered share, but an existing one is valid and must read accurately
    // rather than as malformed.
    const tiers = Array.isArray(rule.tiers) ? rule.tiers : [];
    return `tiered (${tiers.length} tier${tiers.length === 1 ? "" : "s"}) of ${rule.basis}`;
  }
  return String(rule.type || "\u2014");
}

// -- F2 . APPROVE ECONOMICS -------------------------------------------------------------------
//
// Approval SEALS terms server-side and cannot be undone by editing. The client therefore approves
// nothing it assembled itself: the version, its id and its terms all come from the economics
// history, and the request carries only the founder's reason.
//
// The two predicates below mirror the BACKEND guard (economicsState.js validateComplete /
// isResolvableShare) so an incomplete draft is never offered for approval in the first place.
// They are deliberately a COPY, not a relaxation: a share with a null percent is not resolvable,
// and no value here is ever defaulted or inferred.
const F2_SHARE_TYPES_ANY = ["none", "percent_of_base", "tiered", "custom"];

function f2IsResolvableShare(rule) {
  if (!rule || typeof rule !== "object") return false;
  if (!F2_SHARE_TYPES_ANY.includes(rule.type)) return false;
  if (rule.type === "none") return true;
  if (rule.type === "custom") return typeof rule.notes === "string" && rule.notes.trim() !== "";
  if (!F1_BASES.includes(rule.basis)) return false;
  if (rule.type === "percent_of_base") {
    return typeof rule.percent === "number" && Number.isFinite(rule.percent) && rule.percent >= 0;
  }
  return Array.isArray(rule.tiers) && rule.tiers.length > 0 &&
    rule.tiers.every((t) => t && typeof t.percent === "number" && Number.isFinite(t.percent) &&
      t.percent >= 0 && typeof t.thresholdCents === "number");
}

/** A version is approvable only if every treatment is valid and every ENABLED share resolves. */
function f2IsComplete(version) {
  if (!version || typeof version !== "object") return false;
  const t = version.treatments;
  if (!t || typeof t !== "object") return false;
  for (const [key, allowed] of Object.entries(F1_TREATMENTS)) {
    if (!allowed.includes(t[key])) return false;
  }
  const rules = version.rules || {};
  if (!f2IsResolvableShare(rules.initialSubscriptionShare)) return false;
  if (!f2IsResolvableShare(rules.renewalShare)) return false;
  if (rules.giftParticipationEnabled === true && !f2IsResolvableShare(rules.giftShare)) return false;
  return true;
}

/** Pick the draft awaiting approval: the highest-numbered version whose status is exactly draft. */
function f2PickDraft(versions) {
  return versions
    .filter((v) => v && v.status === "draft")
    .sort((a, b) => (b.economicsVersion || 0) - (a.economicsVersion || 0))[0] || null;
}

/**
 * A failed approval must say what happened without handing the founder an internal code. The
 * backend maps ETAG_MISMATCH / BAD_TRANSITION / INCOMPLETE onto a bare 400, so the code in the
 * body is what distinguishes "someone else changed this" from "these terms were rejected" -- it is
 * read to CHOOSE a sentence and is never rendered, and neither is the server's raw message.
 */
function f2ApprovalMessage(res) {
  if (!res || res.networkError || res.status === 0) {
    return "Couldn't reach the server. Nothing was approved.";
  }
  const code = res.data && typeof res.data.code === "string" ? res.data.code : "";
  if (code === "ETAG_MISMATCH") return "This draft changed while you were reviewing it. Reload the campaign and review it again.";
  if (code === "BAD_TRANSITION") return "This version is no longer a draft, so it cannot be approved.";
  if (code === "INCOMPLETE") return "These terms are incomplete, so they cannot be approved.";
  const byStatus = {
    400: "The approval was rejected. Reload the campaign and review the draft again.",
    401: "Your session has expired. Sign in again to continue.",
    403: "Approving economics is limited to the founder account.",
    404: "That draft no longer exists.",
    409: "This draft changed while you were reviewing it. Reload the campaign and review it again.",
    423: "Approvals are on hold right now. Nothing was approved.",
  };
  return byStatus[res.status] || "That didn't go through. Nothing was approved.";
}

// ── F3 · ACTIVATE ECONOMICS ───────────────────────────────────────────────────────────────────
//
// Activation is offered ONLY for a version the SERVER says is exactly "approved". A local draft
// result, a draft, an already-active version, or anything suspended/superseded/archived is not
// activatable, and the control does not appear for them.
const F3_ACTIVATABLE_STATUS = "approved";

/** The one version eligible for activation, taken from a server response or nothing at all. */
function f3PickActivatable(version) {
  if (!version || typeof version !== "object") return null;
  if (version.status !== F3_ACTIVATABLE_STATUS) return null;
  const id = version.id || version.versionId;
  if (typeof id !== "string" || id === "") return null;
  return version;
}

/**
 * Parse an explicitly-UTC effective time.
 *
 * The field is labelled UTC and takes YYYY-MM-DDTHH:MM. It is deliberately NOT a `datetime-local`
 * input: that control yields a wall-clock value with no zone, which is genuinely ambiguous across
 * a daylight-saving transition (01:30 on a fall-back date occurs twice), and no amount of client
 * code can resolve which instant the founder meant. An explicit UTC field has exactly one meaning.
 *
 * Validation is strict on all three axes:
 *   - FORMAT: the shape must match exactly, so a partial value mid-edit is refused, not guessed.
 *   - CALENDAR: the date must really exist. `new Date("2026-02-30T00:00:00.000Z")` silently rolls
 *     forward to March 2, so the parsed instant is round-tripped and compared field by field;
 *     anything that moved is rejected.
 *   - ROUND TRIP: the ISO string produced here is what is previewed AND what is submitted, byte
 *     for byte. Nothing re-derives it later.
 */
function f3ToInstant(utcValue) {
  const text = String(utcValue ?? "").trim();
  if (text === "") return { ok: false, error: "Enter the UTC date and time these economics take effect." };
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text);
  if (!m) return { ok: false, error: "Use the format YYYY-MM-DDTHH:MM, in UTC." };
  const [, y, mo, d, h, mi] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:00.000Z`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return { ok: false, error: "That date and time is not valid." };
  // A real calendar date survives the round trip unchanged; February 30 does not.
  if (
    parsed.getUTCFullYear() !== Number(y) || parsed.getUTCMonth() + 1 !== Number(mo) ||
    parsed.getUTCDate() !== Number(d) || parsed.getUTCHours() !== Number(h) ||
    parsed.getUTCMinutes() !== Number(mi)
  ) {
    return { ok: false, error: "That date does not exist. Check the day and month." };
  }
  if (parsed.toISOString() !== iso) return { ok: false, error: "That date and time could not be read." };
  return { ok: true, iso };
}

/** Failure text for activation. Machine codes may SELECT a sentence; they never reach the DOM. */
function f3FailureMessage(res) {
  if (!res) return "That didn\u2019t go through. Nothing was activated.";
  if (res.networkError) return "Couldn\u2019t reach the server. Nothing was activated.";
  const code = res.data && typeof res.data.code === "string" ? res.data.code : "";
  if (code === "BAD_TRANSITION") return "This version can no longer be activated. Reload to see its current status.";
  if (code === "NOT_FOUND") return "That version no longer exists. Nothing was activated.";
  if (code === "TAMPERED") return "These sealed terms failed their integrity check, so they were not activated.";
  if (code === "ETAG_MISMATCH") return "This changed while you were reviewing it. Reload and try again.";
  if (code === "OVERLAP" || code === "EFFECTIVE_FROM_INVALID") {
    return "That effective time overlaps or precedes the economics already in force. Choose a later instant.";
  }
  const byStatus = {
    400: "That effective time or reason was rejected. Nothing was activated.",
    401: "Your session has expired. Sign in again. Nothing was activated.",
    403: "This action is limited to the founder account. Nothing was activated.",
    404: "That organization or version no longer exists. Nothing was activated.",
    409: "This changed while you were reviewing it. Reload and try again.",
    423: "Activation is on hold right now. Nothing was activated.",
  };
  return byStatus[res.status] || "That didn\u2019t go through. Nothing was activated.";
}


/**
 * F3 — review and activate an APPROVED economics version.
 *
 * A SEPARATE top-level component on purpose. With this state and markup inline, the parent grew
 * past the React Compiler's budget and every pre-existing memoization in the file was dropped
 * ("Existing memoization could not be preserved"). Bisection showed no single construct at fault —
 * the parent was simply too large. Extraction restores compiler compatibility and leaves F1/F2
 * behaviour untouched.
 *
 * It receives eligibility; it never decides it. `version` and `currentActive` come from server
 * history via the parent, so nothing local is ever promoted into an approved or active version.
 */
function FounderEconomicsActivationPanel({ organizationId, organizationName, campaignLabel, version, currentActive, onRefreshHistory }) {
  const [whenUtc, setWhenUtc] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [activated, setActivated] = useState(null);

  // Escape closes the confirmation without sending anything, whether or not the box holds focus.
  useEffect(() => {
    if (!confirming) return undefined;
    const onKey = (ev) => { if (ev.key === "Escape") setConfirming(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  const when = f3ToInstant(whenUtc);
  const rules = (version && version.rules) || {};
  const versionId = version ? (version.id || version.versionId) : null;

  function openConfirm() {
    if (!when.ok) { setError(when.error); return; }
    if (reason.trim() === "") { setError("Say why these economics are being activated."); return; }
    setError(null); setConfirming(true);
  }

  async function activate() {
    if (busy) return;
    // Revalidated AT SEND TIME. The version may have moved on while this was being read, and a
    // control that was legitimate a moment ago is not a licence to send.
    const eligible = f3PickActivatable(version);
    if (!eligible) { setConfirming(false); setMessage("This version is no longer approved, so it cannot be activated."); return; }
    const at = f3ToInstant(whenUtc);
    const why = reason.trim();
    if (!at.ok) { setConfirming(false); setError(at.error); return; }
    if (why === "") { setConfirming(false); setError("Say why these economics are being activated."); return; }

    setError(null); setMessage(null); setBusy(true);
    const res = await fundraiserApi.founder.activateEconomics(
      organizationId, eligible.id || eligible.versionId,
      { effectiveFrom: at.iso, activationReason: why },
    );
    setBusy(false); setConfirming(false);
    if (!res || stateFor(res) !== "ok") { setMessage(f3FailureMessage(res)); return; }
    const v = res.data || {};
    setActivated({
      id: v.id || v.versionId || (eligible.id || eligible.versionId),
      status: v.status || null,
      effectiveFrom: v.effectiveFrom || at.iso,
    });
    setReason("");
    if (onRefreshHistory) await onRefreshHistory();
  }

  return (
    <div data-testid="f3-panel" style={{ border: "1px solid #c9d8bb", borderRadius: 8, padding: ".7rem", margin: "0 0 .8rem" }}>
      <h3 style={{ fontSize: ".9rem", margin: "0 0 .5rem" }}>Approved economics — review and activate</h3>

      <div data-testid="f3-review" style={{ fontSize: ".82rem", background: "#f7faf2", borderRadius: 8, padding: ".55rem" }}>
        <div>Organization: <span data-testid="f3-review-org">{organizationName}</span></div>
        <div>Campaign: <span data-testid="f3-review-campaign">{campaignLabel}</span></div>
        <div>Version: <span data-testid="f3-review-version">{versionId}</span></div>
        <div>Status: <span data-testid="f3-review-status">{version.status}</span></div>
        <div>Initial subscription share: <span data-testid="f3-review-initial">{f1DescribeShare(rules.initialSubscriptionShare)}</span></div>
        <div>Renewal share: <span data-testid="f3-review-renewal">{f1DescribeShare(rules.renewalShare)}</span></div>
        <div>Gift participation: <span data-testid="f3-review-gift-position">{rules.giftParticipationEnabled === true ? "on" : "off"}</span></div>
        {rules.giftParticipationEnabled === true ? (
          <div>Gift share: <span data-testid="f3-review-gift">{f1DescribeShare(rules.giftShare)}</span></div>
        ) : null}
        {version.treatments ? Object.entries(version.treatments).map(([k, v]) => (
          <div key={k}>{k}: <span data-testid={`f3-review-${k}`}>{String(v)}</span></div>
        )) : null}
        <div>
          Currently active version:{" "}
          <span data-testid="f3-review-current">
            {currentActive
              ? `${currentActive.id || currentActive.versionId} (effective ${currentActive.effectiveFrom || "unknown"})`
              : "none"}
          </span>
        </div>
      </div>

      <ul data-testid="f3-notice" style={{ fontSize: ".8rem", color: "#555", margin: ".55rem 0", paddingLeft: "1.1rem" }}>
        <li>Activating makes these economics effective from the instant you choose.</li>
        <li>This may supersede the campaign’s currently active economics version.</li>
        <li>These sealed terms cannot be edited — changing them later needs a new version.</li>
        <li>This does <strong>not</strong> activate the campaign.</li>
        <li>Payouts remain held.</li>
      </ul>

      <label style={{ display: "block", fontSize: ".8rem", margin: ".4rem 0" }}>
        Effective from (UTC) — YYYY-MM-DDTHH:MM
        <input data-testid="f3-when" value={whenUtc} placeholder="2026-09-01T00:00"
          onChange={(ev) => { setWhenUtc(ev.target.value); setError(null); }} />
      </label>
      <p data-testid="f3-utc" style={{ fontSize: ".8rem", margin: ".2rem 0" }}>
        Will be sent as: <strong data-testid="f3-utc-value">{when.ok ? when.iso : "\u2014"}</strong>
      </p>

      <label style={{ display: "block", fontSize: ".8rem" }}>
        Activation reason
        <textarea data-testid="f3-reason" value={reason} rows={2}
          onChange={(ev) => { setReason(ev.target.value); setError(null); }} />
      </label>
      {error ? <p data-testid="f3-error" style={{ color: "#b00", fontSize: ".8rem" }}>{error}</p> : null}

      {!confirming ? (
        <button type="button" data-testid="f3-activate" disabled={busy} onClick={openConfirm}>
          Activate these economics…
        </button>
      ) : (
        <div data-testid="f3-confirm" role="group" aria-label="Confirm activation"
          style={{ border: "1px solid #b00", borderRadius: 8, padding: ".55rem", marginTop: ".4rem" }}>
          <p data-testid="f3-confirm-text" style={{ fontSize: ".82rem", margin: "0 0 .5rem" }}>
            Activate version {versionId} from <strong>{when.ok ? when.iso : "\u2014"}</strong>? This may
            supersede the version currently in force. It does not activate the campaign, and payouts remain held.
          </p>
          <button type="button" data-testid="f3-cancel" onClick={() => setConfirming(false)}>Cancel</button>
          <button type="button" data-testid="f3-confirm-go" disabled={busy} onClick={activate}>
            {busy ? "Activating\u2026" : "Activate economics"}
          </button>
        </div>
      )}

      {message ? <p data-testid="f3-message" role="status" style={{ color: "#b00", fontSize: ".82rem" }}>{message}</p> : null}
      {activated ? (
        <p data-testid="f3-activated" style={{ fontSize: ".82rem" }}>
          Activated version <strong data-testid="f3-activated-version">{activated.id}</strong>
          {activated.status ? <> · status <strong data-testid="f3-activated-status">{activated.status}</strong></> : null}
          {" "}effective <strong data-testid="f3-activated-from">{activated.effectiveFrom}</strong>.
          {" "}The campaign’s own status is unchanged and payouts remain held.
        </p>
      ) : null}
    </div>
  );
}

export default function FounderFundraisingDashboard() {
  const [state, setState] = useState("loading");
  const [overview, setOverview] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [selected, setSelected] = useState(null);

  // ── F1 draft-economics form state ──
  // Every field starts EMPTY. There is no preselected share type, basis, percentage or treatment,
  // because a prefilled commercial term is one nobody chose. Gift participation starts visibly off.
  const [ecoCampaignId, setEcoCampaignId] = useState("");
  // Guards against a slow economics read landing after the founder picked a different campaign.
  const ecoCampaignRef = useRef("");
  const [ecoInitial, setEcoInitial] = useState({ type: "", basis: "", percent: "", notes: "" });
  const [ecoRenewal, setEcoRenewal] = useState({ type: "", basis: "", percent: "", notes: "" });
  const [ecoGiftEnabled, setEcoGiftEnabled] = useState(false);
  const [ecoGift, setEcoGift] = useState({ type: "", basis: "", percent: "", notes: "" });
  const [ecoTreatments, setEcoTreatments] = useState({
    onboardingFeeTreatment: "", veteransContributionTreatment: "",
    discountTreatment: "", taxTreatment: "", processorFeeTreatment: "",
  });
  const [ecoErrors, setEcoErrors] = useState({});
  const [ecoBusy, setEcoBusy] = useState(false);
  const [ecoResult, setEcoResult] = useState(null);
  const [ecoMessage, setEcoMessage] = useState(null);

  // -- F2 approval state --
  // `apvApproved` is written ONLY from a successful server response; there is no optimistic
  // status anywhere. The reason is never defaulted and never remembered across campaigns.
  const [apvReason, setApvReason] = useState("");
  const [apvConfirming, setApvConfirming] = useState(false);
  const [apvBusy, setApvBusy] = useState(false);
  const [apvReasonError, setApvReasonError] = useState(null);
  const [apvMessage, setApvMessage] = useState(null);
  const [apvApproved, setApvApproved] = useState(null);

  const resetApproval = useCallback(() => {
    setApvReason(""); setApvConfirming(false); setApvBusy(false);
    setApvReasonError(null); setApvMessage(null); setApvApproved(null);
  }, []);

  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ legalName: "", orgType: "school" });
  // P2 — partner-administrator panel. `admin.state` is one of STATES; `admin.account` holds ONLY
  // the resolver's four approved fields. Nothing is cached or persisted; it resets per organization.
  const [adminEmail, setAdminEmail] = useState("");
  const [admin, setAdmin] = useState({ state: STATES.EMPTY, account: null, reason: null });

  const load = useCallback(async () => {
    // Gate OFF ⇒ do not issue any fundraiser API request; render the truthful dormant state.
    if (!isFundraiserUiEnabled()) { setState("dormant"); return; }
    setState("loading");
    const ov = await fundraiserApi.founder.overview();
    const s = stateFor(ov);
    if (s !== "ok") { setState(s); return; }
    if (!ov.data || !ov.data.organizations) { setState("error"); return; } // fail closed on malformed
    setState("ok");
    setOverview(ov.data);
    const list = await fundraiserApi.founder.organizations();
    setOrgs(stateFor(list) === "ok" ? list.data : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  // P2 — resolve an administrator by exact email. Founder-only server-side; this only renders the
  // answer. The founder-entered email is NOT masked; only approved resolver fields are displayed.
  const resolveAdmin = useCallback(async (e) => {
    e.preventDefault();
    setAdmin({ state: STATES.RESOLVING, account: null, reason: null });
    const r = await fundraiserApi.founder.resolveUserByEmail(adminEmail);
    const out = resolveOutcome(r);
    setAdmin({ ...out, reason: null });
  }, [adminEmail]);

  // P2 — assign the RESOLVED userId. The client never invents an id; it forwards only what the
  // server resolved. On success the organization is re-read so the panel reflects real state.
  const assignAdmin = useCallback(async () => {
    if (!selected || !canAssign(admin.state, admin.account)) return;
    const userId = admin.account.userId;
    setAdmin((a) => ({ ...a, state: STATES.ASSIGNING, reason: null }));
    const r = await fundraiserApi.founder.assignPartnerAdmin(selected.organizationId, userId);
    const out = assignOutcome(r);
    setAdmin((a) => ({ ...a, state: out.state, reason: out.reason }));
    if (out.state === STATES.ASSIGNED) {
      // Existing read-back behaviour: refresh the organization list so adminUserIds is truthful.
      const list = await fundraiserApi.founder.organizations();
      if (stateFor(list) === "ok" && Array.isArray(list.data)) {
        setOrgs(list.data);
        const fresh = list.data.find((o) => o.organizationId === selected.organizationId);
        if (fresh) setSelected(fresh);
      }
    }
  }, [selected, admin.state, admin.account]);

  const openOrg = useCallback(async (org) => {
    setSelected(org); setDetail({ loading: true });
    // Reset the panel whenever a different organization is opened — no state carries across orgs.
    setAdminEmail(""); setAdmin({ state: STATES.EMPTY, account: null, reason: null });
    // F1 — the draft form is emptied too, so no term or campaign choice leaks between organizations.
    ecoCampaignRef.current = "";
    setEcoCampaignId(""); setEcoErrors({}); setEcoResult(null); setEcoMessage(null);
    resetApproval();
    setEcoInitial({ type: "", basis: "", percent: "", notes: "" });
    setEcoRenewal({ type: "", basis: "", percent: "", notes: "" });
    setEcoGiftEnabled(false); setEcoGift({ type: "", basis: "", percent: "", notes: "" });
    setEcoTreatments({
      onboardingFeeTreatment: "", veteransContributionTreatment: "",
      discountTreatment: "", taxTreatment: "", processorFeeTreatment: "",
    });
    const [pt, lt, rec, pay, aud, cmp] = await Promise.all([
      fundraiserApi.founder.participantTotals(org.organizationId),
      fundraiserApi.founder.ledgerTotals(org.organizationId),
      fundraiserApi.founder.reconciliation(org.organizationId),
      fundraiserApi.founder.payoutStatus(org.organizationId),
      fundraiserApi.founder.audit(org.organizationId),
      // F1 — campaigns are READ, never invented. The draft form can only ever name a campaign the
      // server returned for this organization, so organizationId/campaignId always agree.
      fundraiserApi.founder.campaigns(org.organizationId),
    ]);
    setDetail({
      participants: pt.data, ledger: lt.data, reconciliation: rec.data,
      payout: pay.status === 503 ? { held: true, dormant: true } : pay.data,
      audit: stateFor(aud) === "ok" ? aud.data : [],
      campaigns: stateFor(cmp) === "ok" && Array.isArray(cmp.data) ? cmp.data : [],
      economics: null,
      economicsDraft: null,
    });
  }, [resetApproval]);

  // F1 — when a campaign is chosen, read its economics history and surface the version that is
  // actually in force. Nothing here is editable: approved/active terms are immutable server-side,
  // and the only legitimate way to change them is a NEW draft version.
  // Read a campaign's economics history and derive BOTH panels from the one response: the version
  // in force (read-only) and the draft awaiting approval. Every id the approval path later uses
  // originates here, in a server response — never in anything the client built.
  const readEconomicsHistory = useCallback(async (campaignId) => {
    const hist = await fundraiserApi.founder.economicsHistory(campaignId);
    const ok = stateFor(hist) === "ok" && Array.isArray(hist.data);
    // COPIED before any ordering. The response array is never sorted in place: it is shared with
    // whatever else reads this history, and an in-place sort would silently reorder it for them.
    const versions = ok ? hist.data.slice() : [];
    // Deterministic newest-first ordering, used for every "which one" question below, so two
    // versions with the same status can never resolve differently between reads.
    const ranked = versions.slice().sort((a, b) => (b?.economicsVersion || 0) - (a?.economicsVersion || 0));
    const newestWith = (status) => ranked.find((v) => v && v.status === status) || null;

    const active = newestWith("active");
    const approved = newestWith("approved");
    // The general read-only view: what is in force, else what is sealed, else the newest of any kind.
    const current = active || approved || ranked[0] || null;

    // Ignore a late response for a campaign the founder has since moved away from.
    if (ecoCampaignRef.current !== campaignId) return;
    setDetail((d) => (d ? {
      ...d,
      economics: current,
      economicsDraft: f2PickDraft(versions),
      // A FAILED read clears activation eligibility rather than leaving a stale approved version
      // on screen that the server may no longer agree with.
      economicsApproved: ok ? approved : null,
      economicsActive: ok ? active : null,
    } : d));
  }, []);

  const selectEcoCampaign = useCallback(async (campaignId) => {
    ecoCampaignRef.current = campaignId;
    setEcoCampaignId(campaignId);
    setEcoResult(null); setEcoMessage(null);
    // Nothing about a previous campaign's approval survives the switch.
    resetApproval();
    setDetail((d) => (d ? { ...d, economics: null, economicsDraft: null } : d));
    if (!campaignId) return;
    await readEconomicsHistory(campaignId);
  }, [readEconomicsHistory, resetApproval]);

  async function submitDraftEconomics(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (ecoBusy) return;
    setEcoMessage(null); setEcoResult(null);
    const built = f1BuildPayload({
      organizationId: selected && selected.organizationId,
      // Forwarded exactly as the server gave it — never trimmed, rewritten or invented.
      campaignId: ecoCampaignId,
      initial: ecoInitial, renewal: ecoRenewal,
      giftEnabled: ecoGiftEnabled, gift: ecoGift,
      treatments: ecoTreatments,
    });
    if (!built.ok) { setEcoErrors(built.errors); return; }   // zero requests while incomplete
    setEcoErrors({});
    setEcoBusy(true);
    const res = await fundraiserApi.founder.draftEconomics(built.payload);
    setEcoBusy(false);
    if (!res || res.ok !== true) {
      // No optimistic success, and no internal code shown.
      const byStatus = {
        400: "Some terms were rejected. Check the values and try again.",
        401: "Your session has expired. Sign in again to continue.",
        403: "This action is limited to the founder account.",
        404: "That organization or campaign no longer exists.",
        409: "This changed while you were editing. Reload and try again.",
      };
      setEcoMessage(res && res.networkError
        ? "Couldn't reach the server. Check your connection and try again."
        : (byStatus[res && res.status] || "That didn't go through. Please try again."));
      return;
    }
    // State is adopted ONLY from the server's response.
    const v = res.data || {};
    setEcoResult({ versionId: v.versionId || v.id || null, status: v.status || null });
    // Reconcile the history so the new draft is reviewable from a SERVER record. The approval path
    // deliberately reads the draft from history rather than from this response, so that what the
    // founder reviews and what the server holds are the same object.
    if (ecoCampaignId) await readEconomicsHistory(ecoCampaignId);
  }

  // -- F2 approval ------------------------------------------------------------------------------
  //
  // Two deliberate gates stand between reviewing and approving: a non-empty reason, and an explicit
  // confirmation. Neither the reason check nor Cancel/Escape issues any request.

  // F3 — the parent decides only WHETHER activation is warranted; the panel owns everything else.
  // Both values come from server-returned history, never from a locally-built response.
  const activatableVersion = f3PickActivatable((detail && detail.economicsApproved) || null);
  const currentActiveVersion = (detail && detail.economicsActive) || null;
  // Named from the server's own campaign record, so the review never labels a version with a title
  // the client made up. f2CampaignLabel cannot serve here: it is keyed to a DRAFT, and an approved
  // version generally has none.
  const f3CampaignRecord = activatableVersion && detail && Array.isArray(detail.campaigns)
    ? detail.campaigns.find((c) => c.campaignId === activatableVersion.campaignId) : null;
  const f3CampaignLabel = f3CampaignRecord
    ? `${f3CampaignRecord.title || f3CampaignRecord.campaignId} (${f3CampaignRecord.campaignId})`
    : (activatableVersion ? activatableVersion.campaignId || "" : "");

  const approvableDraft = detail && detail.economicsDraft && detail.economicsDraft.status === "draft"
    ? detail.economicsDraft : null;
  const draftIsComplete = approvableDraft ? f2IsComplete(approvableDraft) : false;
  const f2Rules = (approvableDraft && approvableDraft.rules) || {};
  // The campaign is named from the server's own record, so the review never labels a draft with a
  // title the client made up.
  const f2CampaignRecord = approvableDraft && detail && Array.isArray(detail.campaigns)
    ? detail.campaigns.find((c) => c.campaignId === approvableDraft.campaignId) : null;
  const f2CampaignLabel = f2CampaignRecord
    ? `${f2CampaignRecord.title || f2CampaignRecord.campaignId} (${f2CampaignRecord.campaignId})`
    : (approvableDraft ? approvableDraft.campaignId : "");

  function openApprovalConfirm() {
    setApvMessage(null);
    if (apvReason.trim() === "") {
      // Zero requests: an approval with no stated reason is not an approval.
      setApvReasonError("Say why these terms are being approved.");
      setApvConfirming(false);
      return;
    }
    setApvReasonError(null);
    setApvConfirming(true);
  }

  const cancelApprovalConfirm = useCallback(() => {
    // Closing the confirmation is purely local. Nothing is sent, and the reviewed draft is kept.
    setApvConfirming(false);
  }, []);

  async function confirmApproval() {
    if (apvBusy) return;
    // Re-checked at the moment of sending: the id and the terms must still be the server's draft.
    if (!approvableDraft || !draftIsComplete || !selected) { setApvConfirming(false); return; }
    const reason = apvReason.trim();
    if (reason === "") { setApvConfirming(false); setApvReasonError("Say why these terms are being approved."); return; }

    setApvBusy(true); setApvMessage(null);
    const res = await fundraiserApi.founder.approveEconomics(
      selected.organizationId, approvableDraft.id, reason,
    );
    setApvBusy(false);
    setApvConfirming(false);
    if (!res || res.ok !== true) {
      // The reviewed draft is left exactly as it was; nothing is marked approved.
      setApvMessage(f2ApprovalMessage(res));
      return;
    }
    // Adopted ONLY from the server response -- no locally assumed "approved".
    const v = res.data || {};
    setApvApproved({ versionId: v.versionId || v.id || null, status: v.status || null });
    setApvReason("");
    // Reconcile against the server so the panel reflects stored state, not this one response.
    if (ecoCampaignId) await readEconomicsHistory(ecoCampaignId);
  }

  // Escape closes the confirmation without sending anything.
  useEffect(() => {
    if (!apvConfirming) return undefined;
    const onKey = (ev) => { if (ev.key === "Escape") cancelApprovalConfirm(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [apvConfirming, cancelApprovalConfirm]);

  async function createOrg(e) {
    e.preventDefault();
    if (!form.legalName.trim()) return;
    const r = await fundraiserApi.founder.createOrganization(form);
    if (r.ok) { setForm({ legalName: "", orgType: "school" }); load(); }
  }

  if (!isFundraiserUiEnabled()) return <StateView state="dormant" />;
  if (state !== "ok") return <div style={pageWrap}><h1 style={h}>Fundraising — Founder/Admin</h1><StateView state={state} onRetry={load} /></div>;

  return (
    <div style={pageWrap}>
      <h1 style={h}>Fundraising — Founder/Admin</h1>

      <div style={box}>
        <h2 style={h}>Platform overview</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Stat label="Organizations" value={overview.organizations.total} />
          <Stat label="Campaigns" value={overview.campaigns.total} />
          <Stat label="Participants" value={overview.participants.total} />
          <Stat label="Active economics" value={overview.economics.activeVersions} />
        </div>
        <p style={{ marginTop: 12, color: "#8a7c6c" }}>Proceeds/payouts <HeldBadge /> — checkout binding and payouts are held.</p>
      </div>

      <div style={box}>
        <h2 style={h}>Organizations</h2>
        <form onSubmit={createOrg} style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input placeholder="Legal name" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #d8cdbb", flex: 1, minWidth: 200 }} />
          <select value={form.orgType} onChange={(e) => setForm({ ...form, orgType: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #d8cdbb" }}>
            <option value="school">School</option><option value="athletic">Athletic</option><option value="youth">Youth</option><option value="community">Community</option><option value="nonprofit">Nonprofit</option><option value="other">Other</option>
          </select>
          <button style={btn} type="submit">Create organization</button>
        </form>
        {orgs.length === 0 ? <Empty>No organizations yet.</Empty> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ textAlign: "left", color: "#8a7c6c", fontSize: 13 }}><th>Name</th><th>Type</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.organizationId} style={{ borderTop: "1px solid #f0ebe3" }}>
                  <td style={{ padding: "8px 0" }}>{o.legalName}</td><td>{o.orgType}</td><td>{o.status}</td>
                  <td style={{ textAlign: "right" }}><button style={btnGhost} onClick={() => openOrg(o)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && detail && !detail.loading ? (
        <section style={box} data-testid="f1-economics">
          <h2 style={h}>Draft economics</h2>

          {/* Existing sealed terms are shown READ-ONLY. An approved or active version is immutable
              server-side, so presenting it as an editable draft would be a lie the UI tells. A
              TIERED share is rendered accurately here even though F1 cannot create one. */}
          {detail.economics && detail.economics.rules ? (
            <div data-testid="f1-existing" style={{ fontSize: ".82rem", background: "#f6f6f6", borderRadius: 8, padding: ".55rem", margin: "0 0 .7rem" }}>
              <strong>Existing terms ({detail.economics.status || "unknown"}) — read-only</strong>
              <div>Initial: <span data-testid="f1-existing-initial">{f1DescribeShare(detail.economics.rules.initialSubscriptionShare)}</span></div>
              <div>Renewal: <span data-testid="f1-existing-renewal">{f1DescribeShare(detail.economics.rules.renewalShare)}</span></div>
              {detail.economics.rules.giftParticipationEnabled ? (
                <div>Gift: <span data-testid="f1-existing-gift">{f1DescribeShare(detail.economics.rules.giftShare)}</span></div>
              ) : null}
            </div>
          ) : null}
          {/* ── F2 · REVIEW AND APPROVE ────────────────────────────────────────────────────
              Rendered only for a SERVER-returned version whose status is exactly "draft". The
              whole draft is shown read-only first: approval seals these terms, so the founder
              approves what is displayed, not what they remember typing. */}
          {/* F3 — the panel owns its own state. Keyed by organization, campaign and approved
              version so moving to a different context REMOUNTS it with a clean effective time,
              reason and result rather than carrying one campaign's inputs into another. */}
          {activatableVersion ? (
            <FounderEconomicsActivationPanel
              key={`${selected.organizationId}:${ecoCampaignId}:${activatableVersion.id || activatableVersion.versionId}`}
              organizationId={selected.organizationId}
              organizationName={selected.legalName}
              campaignLabel={f3CampaignLabel}
              version={activatableVersion}
              currentActive={currentActiveVersion}
              onRefreshHistory={() => readEconomicsHistory(ecoCampaignId)}
            />
          ) : null}

          {approvableDraft ? (
            <div data-testid="f2-panel" style={{ border: "1px solid #d8cdbb", borderRadius: 8, padding: ".7rem", margin: "0 0 .8rem" }}>
              <h3 style={{ fontSize: ".9rem", margin: "0 0 .5rem" }}>Draft awaiting approval — review</h3>

              <div data-testid="f2-review" style={{ fontSize: ".82rem", background: "#faf7f2", borderRadius: 8, padding: ".55rem" }}>
                <div>Organization: <span data-testid="f2-review-org">{selected.legalName}</span></div>
                <div>Campaign: <span data-testid="f2-review-campaign">{f2CampaignLabel}</span></div>
                <div>Initial subscription share: <span data-testid="f2-review-initial">{f1DescribeShare(f2Rules.initialSubscriptionShare)}</span></div>
                <div>Renewal share: <span data-testid="f2-review-renewal">{f1DescribeShare(f2Rules.renewalShare)}</span></div>
                <div>Gift participation: <span data-testid="f2-review-gift-position">{f2Rules.giftParticipationEnabled === true ? "on" : "off"}</span></div>
                {f2Rules.giftParticipationEnabled === true ? (
                  <div>Gift share: <span data-testid="f2-review-gift">{f1DescribeShare(f2Rules.giftShare)}</span></div>
                ) : null}
                {Object.keys(F1_TREATMENTS).map((k) => (
                  <div key={k}>{k}: <span data-testid={`f2-review-${k}`}>{(approvableDraft.treatments || {})[k] || "—"}</span></div>
                ))}
                <div>Version: <span data-testid="f2-review-version">{approvableDraft.id}</span></div>
                <div>Status: <span data-testid="f2-review-status">{approvableDraft.status}</span></div>
              </div>

              {/* Said before approving, not after: sealing is the part that cannot be undone. */}
              <ul data-testid="f2-notice" style={{ fontSize: ".8rem", color: "#555", margin: ".55rem 0", paddingLeft: "1.1rem" }}>
                <li>Approving seals these terms.</li>
                <li>Approved terms cannot be edited &mdash; changing them means a new version.</li>
                <li>Approving does not activate economics.</li>
                <li>Approving does not activate the campaign.</li>
                <li>Payouts remain held.</li>
              </ul>

              {draftIsComplete ? (
                <>
                  <label style={{ display: "block", fontSize: ".8rem" }}>
                    <span style={{ fontWeight: 700 }}>Reason for approval</span>
                    <textarea data-testid="f2-reason" value={apvReason} rows={2}
                      onChange={(ev) => { setApvReason(ev.target.value); setApvReasonError(null); }}
                      style={{ display: "block", width: "100%", maxWidth: 460 }} />
                  </label>
                  {apvReasonError ? <p data-testid="f2-err-reason" style={{ color: "#b00", fontSize: ".8rem", margin: ".3rem 0 0" }}>{apvReasonError}</p> : null}
                  <button type="button" data-testid="f2-open" disabled={apvBusy}
                    onClick={openApprovalConfirm} style={{ marginTop: ".45rem" }}>
                    Review and approve these terms
                  </button>
                </>
              ) : (
                <p data-testid="f2-incomplete" style={{ fontSize: ".8rem", color: "#b00", margin: 0 }}>
                  These terms are incomplete, so they cannot be approved yet.
                </p>
              )}

              {apvConfirming ? (
                <div data-testid="f2-confirm" role="dialog" aria-modal="true" aria-label="Confirm approval"
                  style={{ border: "1px solid #b00", borderRadius: 8, padding: ".6rem", marginTop: ".5rem" }}>
                  <p style={{ fontSize: ".85rem", margin: "0 0 .5rem" }}>
                    Seal version <strong data-testid="f2-confirm-version">{approvableDraft.id}</strong> for {f2CampaignLabel}?
                    This cannot be undone by editing. It does not activate economics, does not
                    activate the campaign, and payouts remain held.
                  </p>
                  <button type="button" data-testid="f2-confirm-yes" disabled={apvBusy} onClick={confirmApproval}>
                    {apvBusy ? "Approving…" : "Yes, approve and seal"}
                  </button>
                  {" "}
                  <button type="button" data-testid="f2-confirm-cancel" onClick={cancelApprovalConfirm}>Cancel</button>
                </div>
              ) : null}

              {apvMessage ? <p data-testid="f2-message" role="status" style={{ color: "#b00", fontSize: ".85rem" }}>{apvMessage}</p> : null}
            </div>
          ) : null}

          {apvApproved ? (
            <p data-testid="f2-approved" style={{ fontSize: ".85rem" }}>
              Terms sealed. Version <strong data-testid="f2-approved-version">{apvApproved.versionId || "—"}</strong>
              {apvApproved.status ? <> &middot; status <strong data-testid="f2-approved-status">{apvApproved.status}</strong></> : null}
              {" "}&mdash; economics are not active, the campaign is unchanged, and payouts remain held.
            </p>
          ) : null}

          <p style={{ fontSize: ".85rem", color: "#555", margin: "0 0 .75rem" }}>
            Creates a DRAFT only. It does not approve terms, activate economics, or change the
            campaign's status. Percentages are percentage points &mdash; 10 means 10%.
          </p>

          <form onSubmit={submitDraftEconomics} data-testid="f1-form">
            <label style={{ display: "block", marginBottom: ".5rem" }}>
              <span style={{ display: "block", fontSize: ".78rem", fontWeight: 700 }}>Campaign</span>
              {/* The id is never typed. Both ids in the payload come from records the server
                  returned: organizationId from the opened organization, campaignId from this list. */}
              <select data-testid="f1-campaign" value={ecoCampaignId}
                onChange={(ev) => selectEcoCampaign(ev.target.value)}>
                <option value="">Choose a campaign…</option>
                {(detail.campaigns || []).map((c) => (
                  <option key={c.campaignId} value={c.campaignId}>
                    {c.title || c.campaignId} ({c.status})
                  </option>
                ))}
              </select>
              {(detail.campaigns || []).length === 0 ? (
                <span data-testid="f1-no-campaigns" style={{ fontSize: ".8rem", color: "#555" }}>
                  {" "}This organization has no campaigns yet.
                </span>
              ) : null}
            </label>
            {ecoErrors.selection ? <p data-testid="f1-err-selection" style={{ color: "#b00", fontSize: ".8rem" }}>{ecoErrors.selection}</p> : null}

            {[["initial", "Initial subscription share", ecoInitial, setEcoInitial],
              ["renewal", "Renewal share", ecoRenewal, setEcoRenewal]].map(([key, title, val, set]) => (
              <fieldset key={key} style={{ border: "1px solid #ddd", borderRadius: 8, padding: ".6rem", margin: ".6rem 0" }}>
                <legend style={{ fontSize: ".8rem", fontWeight: 700 }}>{title}</legend>
                <select data-testid={`f1-${key}-type`} value={val.type}
                  onChange={(ev) => set({ ...val, type: ev.target.value })}>
                  <option value="">Choose a share type…</option>
                  {F1_SHARE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {val.type === "percent_of_base" ? (
                  <>
                    <select data-testid={`f1-${key}-basis`} value={val.basis}
                      onChange={(ev) => set({ ...val, basis: ev.target.value })}>
                      <option value="">Choose a basis…</option>
                      {F1_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <label style={{ marginLeft: ".4rem" }}>
                      <input data-testid={`f1-${key}-percent`} value={val.percent} inputMode="decimal"
                        onChange={(ev) => set({ ...val, percent: ev.target.value })} style={{ width: 90 }} />
                      <span style={{ fontSize: ".8rem" }}> % (percentage points, 0–100)</span>
                    </label>
                  </>
                ) : null}
                {val.type === "custom" ? (
                  <input data-testid={`f1-${key}-notes`} value={val.notes} placeholder="Describe the custom terms"
                    onChange={(ev) => set({ ...val, notes: ev.target.value })} />
                ) : null}
                {ecoErrors[key] ? <p data-testid={`f1-err-${key}`} style={{ color: "#b00", fontSize: ".8rem", margin: ".3rem 0 0" }}>{ecoErrors[key]}</p> : null}
              </fieldset>
            ))}

            <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: ".6rem", margin: ".6rem 0" }}>
              <legend style={{ fontSize: ".8rem", fontWeight: 700 }}>Gift participation</legend>
              <label>
                <input type="checkbox" data-testid="f1-gift-toggle" checked={ecoGiftEnabled}
                  onChange={(ev) => setEcoGiftEnabled(ev.target.checked)} />
                <span style={{ fontSize: ".84rem" }}> Include gifts in this campaign’s economics</span>
              </label>
              {ecoGiftEnabled ? (
                <div style={{ marginTop: ".4rem" }}>
                  <select data-testid="f1-gift-type" value={ecoGift.type}
                    onChange={(ev) => setEcoGift({ ...ecoGift, type: ev.target.value })}>
                    <option value="">Choose a share type…</option>
                    {F1_SHARE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {ecoGift.type === "percent_of_base" ? (
                    <>
                      <select data-testid="f1-gift-basis" value={ecoGift.basis}
                        onChange={(ev) => setEcoGift({ ...ecoGift, basis: ev.target.value })}>
                        <option value="">Choose a basis…</option>
                        {F1_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <input data-testid="f1-gift-percent" value={ecoGift.percent} inputMode="decimal"
                        onChange={(ev) => setEcoGift({ ...ecoGift, percent: ev.target.value })} style={{ width: 90 }} />
                    </>
                  ) : null}
                  {ecoGift.type === "custom" ? (
                    <input data-testid="f1-gift-notes" value={ecoGift.notes}
                      onChange={(ev) => setEcoGift({ ...ecoGift, notes: ev.target.value })} />
                  ) : null}
                </div>
              ) : null}
              {ecoErrors.gift ? <p data-testid="f1-err-gift" style={{ color: "#b00", fontSize: ".8rem" }}>{ecoErrors.gift}</p> : null}
            </fieldset>

            <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: ".6rem", margin: ".6rem 0" }}>
              <legend style={{ fontSize: ".8rem", fontWeight: 700 }}>Treatments</legend>
              {Object.entries(F1_TREATMENTS).map(([key, allowed]) => (
                <label key={key} style={{ display: "block", margin: ".3rem 0", fontSize: ".82rem" }}>
                  {key}
                  {" "}
                  <select data-testid={`f1-${key}`} value={ecoTreatments[key]}
                    onChange={(ev) => setEcoTreatments({ ...ecoTreatments, [key]: ev.target.value })}>
                    {/* Even a single-valued treatment must be chosen, never inserted silently. */}
                    <option value="">Choose…</option>
                    {allowed.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  {ecoErrors[key] ? <span data-testid={`f1-err-${key}`} style={{ color: "#b00" }}> {ecoErrors[key]}</span> : null}
                </label>
              ))}
            </fieldset>

            <button type="submit" data-testid="f1-submit" disabled={ecoBusy}>
              {ecoBusy ? "Creating draft\u2026" : "Create draft economics"}
            </button>
          </form>

          {ecoMessage ? <p data-testid="f1-message" role="status" style={{ color: "#b00", fontSize: ".85rem" }}>{ecoMessage}</p> : null}
          {ecoResult ? (
            <p data-testid="f1-result" style={{ fontSize: ".85rem" }}>
              Draft created. Version <strong data-testid="f1-version">{ecoResult.versionId || "\u2014"}</strong>
              {ecoResult.status ? <> · status <strong data-testid="f1-status">{ecoResult.status}</strong></> : null}
              {" "}— not approved and not active.
            </p>
          ) : null}
        </section>
      ) : null}

      {selected && detail && !detail.loading && (
        <div style={box}>
          <h2 style={h}>{selected.legalName} — detail</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <Stat label="Participants" value={detail.participants?.participants ?? 0} />
            <Stat label="Attribution records" value={detail.participants?.attributionRecords ?? 0} />
            <Stat label="Conversions" value={detail.ledger?.conversions ?? 0} />
            <Stat label="Renewals" value={detail.ledger?.renewals ?? 0} />
            <Stat label="Refunds" value={detail.ledger?.refunds ?? 0} />
          </div>
          <p>Reconciliation: {detail.reconciliation?.reconciled ? "✓ reconciled" : `drift ${detail.reconciliation?.driftCount ?? 0}`}</p>
          <p>Payout review: <strong>{detail.payout?.posture || "manual_review_only"}</strong> <HeldBadge /></p>
          {/* P2 — PARTNER ADMINISTRATOR. Resolve an exact email to an account, review it, assign.
              Authorization is entirely server-side (founder-only for both calls); this panel only
              displays the server's answers and never fabricates or caches an identity. */}
          <h3 style={{ ...h, fontSize: 16 }}>Partner administrator</h3>
          <p style={{ margin: "0 0 8px", color: "#5b4f42", fontSize: ".9rem" }}>
            Current: {Array.isArray(selected.adminUserIds) && selected.adminUserIds.length > 0
              ? `${selected.adminUserIds.length} assigned`
              : "none assigned"}
          </p>
          <form onSubmit={resolveAdmin} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }} data-testid="admin-resolve-form">
            <input
              type="email"
              placeholder="Administrator email"
              value={adminEmail}
              onChange={(e) => { setAdminEmail(e.target.value); setAdmin({ state: STATES.EMPTY, account: null, reason: null }); }}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #d8cdbb", flex: 1, minWidth: 220 }}
              data-testid="admin-email"
            />
            <button style={btn} type="submit" disabled={admin.state === STATES.RESOLVING || admin.state === STATES.ASSIGNING} data-testid="admin-resolve">
              {admin.state === STATES.RESOLVING ? "Resolving…" : "Resolve"}
            </button>
          </form>

          {admin.state === STATES.RESOLVED && admin.account && (
            <div style={{ border: "1px solid #d8cdbb", borderRadius: 6, padding: 10, marginBottom: 8 }} data-testid="admin-resolved">
              {/* Only the resolver's four approved fields are shown. */}
              <div><strong>{admin.account.email}</strong></div>
              <div style={{ color: "#5b4f42", fontSize: ".9rem" }}>
                Email verified: <strong data-testid="admin-verified">{admin.account.emailVerified ? "yes" : "no"}</strong>
                {" · "}Founder account: <strong data-testid="admin-isfounder">{admin.account.isFounder ? "yes" : "no"}</strong>
              </div>
              {admin.account.isFounder ? (
                <p style={{ margin: "8px 0 0", color: "#8a3b2a" }} data-testid="admin-founder-block">
                  A platform founder cannot be a partner administrator.
                </p>
              ) : (
                <button
                  style={{ ...btn, marginTop: 8 }}
                  onClick={assignAdmin}
                  disabled={!canAssign(admin.state, admin.account)}
                  data-testid="admin-assign"
                >Assign as partner administrator</button>
              )}
            </div>
          )}

          {admin.state === STATES.ASSIGNING && <p style={{ color: "#5b4f42" }} data-testid="admin-assigning">Assigning…</p>}

          {[STATES.INVALID_EMAIL, STATES.NOT_FOUND, STATES.AMBIGUOUS, STATES.SERVICE_FAILURE, STATES.ASSIGNED, STATES.ASSIGN_FAILED].includes(admin.state) && (
            <p
              style={{ color: admin.state === STATES.ASSIGNED ? "#2f6f4f" : "#8a3b2a", marginTop: 0 }}
              data-testid={admin.state === STATES.ASSIGNED ? "admin-success" : "admin-error"}
            >{messageFor(admin.state, admin.reason)}</p>
          )}

          {admin.state === STATES.ASSIGNED && admin.account && (
            <p style={{ color: "#5b4f42", fontSize: ".9rem", marginTop: 0 }} data-testid="admin-readback">
              Read-back: {isAssigned(selected, admin.account.userId) ? "present in adminUserIds ✓" : "not yet reflected"}
            </p>
          )}

          <h3 style={{ ...h, fontSize: 16 }}>Audit history</h3>
          {(!detail.audit || detail.audit.length === 0) ? <Empty>No audit events yet.</Empty> : (
            <ul style={{ margin: 0, paddingLeft: 18, color: "#5b4f42" }}>
              {detail.audit.slice(0, 8).map((a) => <li key={a.id}>{a.at} — {a.action} ({a.subjectType})</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
