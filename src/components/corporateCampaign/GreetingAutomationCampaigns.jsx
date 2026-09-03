// src/components/corporateCampaign/GreetingAutomationCampaigns.jsx
//
// TEAM A — Greeting Automation Campaigns surface. The corporateOrganizationId is derived
// EXCLUSIVELY from the authenticated user's active corporate memberships
// (GET /api/corporate-campaigns/memberships) — NEVER from a user id, role, or list order.
// Capability is SERVER-derived: while the feature is dormant the endpoints return 503 and the
// entire surface stays hidden with zero campaign writes. No client self-enabling flag.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createCorporateCampaignsClient, isOrderVersion, ORDERING_UNAVAILABLE } from "../../api/corporateCampaigns.js";
import {
  activeMemberships, resolveOrganizationContext, deriveCampaignSummary, interpretCapability, TERMS,
} from "./campaignSurfaceModel.js";
import CampaignDetail from "./CampaignDetail.jsx";
// TEAM I (CONNECTION D) — the corporate saved-card panel. One more section in this dashboard; the
// dashboard itself is unchanged.
//
// The panel OWNS its own client. That is deliberate rather than incidental: this surface is under a
// conformity lock (campaignSurface.teamA.test.mjs) that forbids it from importing anything
// payment-, gift- or fundraising-shaped, and that lock is worth keeping. So the dashboard knows
// only that there is a panel; everything about how a card is collected lives behind it.
import SavedCardPanel from "./SavedCardPanel.jsx";
// SLICE D — the consolidated premium surface.
import CampaignCard from "./CampaignCard.jsx";
import ContactTiles from "./ContactTiles.jsx";
import IndividualContactPicker from "./IndividualContactPicker.jsx";
import {
  readViewerOwnerCapability, readExecutionCapability, findAudienceOverlaps, overlapLine,
  GIFT_PAYMENT_DISCLOSURE,
  moveCampaignId, applyCampaignOrder, campaignIdsOf, reorderAnnouncement,
} from "./corporateDashboardModel.js";

// How many overlapping contacts to name before the list becomes wallpaper. The rest are counted,
// never hidden - a warning that silently truncates reads as "these are all of them".
const OVERLAP_SHOWN = 6;
import "./premiumDashboard.css";

const PURPLE = "linear-gradient(135deg, #6d74ee 0%, #764ba2 100%)";

function StatusPill({ label, kind }) {
  const c = kind === "ready"
    ? { fg: "#1f9d6b", bg: "rgba(31,157,107,.12)", bd: "rgba(31,157,107,.35)" }
    : kind === "processing"
    ? { fg: "#4a3fb0", bg: "rgba(109,92,240,.12)", bd: "rgba(109,92,240,.30)" }
    : { fg: "#bd7a10", bg: "rgba(214,145,16,.15)", bd: "rgba(214,145,16,.4)" };
  return <span style={{ fontSize: ".72rem", fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 999, padding: "3px 10px" }}>{label}</span>;
}

function Shell({ children }) {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <header style={{ background: PURPLE, color: "#fff", borderRadius: 20, padding: "28px 28px 30px", marginBottom: 24 }}>
        <div style={{ fontFamily: "monospace", fontSize: ".7rem", letterSpacing: ".14em", opacity: .85, textTransform: "uppercase" }}>Corporate</div>
        <h1 style={{ margin: "6px 0 6px", fontSize: "1.7rem", fontWeight: 700 }}>{TERMS.SURFACE}</h1>
        <p style={{ margin: 0, opacity: .92, fontSize: ".95rem", maxWidth: "48ch" }}>
          Set up organization-wide greetings once per campaign. {TERMS.YOU_DONT_NEED_EVERYTHING}
        </p>
      </header>
      {children}
    </div>
  );
}

// Minimal create form — collects a required name and an optional free-text type. The backend
// accepts both (`name`, `campaignType`) as optional free strings; no new endpoint, no enum, no
// occasion/scheduling semantics implied. Inputs set explicit padding-free-safe styles inline.
function CreateCampaignForm({ name, type, onName, onType, onSubmit, onCancel, creating }) {
  const canCreate = name.trim().length > 0 && !creating;
  const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(27,24,48,.2)", fontSize: ".9rem" };
  return (
    <form data-testid="create-form" onSubmit={(e) => { e.preventDefault(); if (canCreate) onSubmit(); }}
      style={{ background: "#fff", border: "1px solid rgba(27,24,48,.12)", borderRadius: 16, padding: "20px 22px" }}>
      <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.15rem", margin: "0 0 4px" }}>{TERMS.CREATE}</h2>
      <p style={{ color: "#605c78", fontSize: ".82rem", margin: "0 0 16px" }}>Name your campaign and, optionally, add a type. {TERMS.YOU_DONT_NEED_EVERYTHING}</p>
      <label htmlFor="cc-name" style={{ display: "block", fontSize: ".78rem", fontWeight: 700, color: "#1b1830", marginBottom: 5 }}>Campaign name</label>
      <input id="cc-name" data-testid="create-name" value={name} onChange={(e) => onName(e.target.value)} autoFocus
        placeholder="e.g. Q4 Client Appreciation" style={{ ...input, marginBottom: 14 }} />
      <label htmlFor="cc-type" style={{ display: "block", fontSize: ".78rem", fontWeight: 700, color: "#1b1830", marginBottom: 5 }}>Type <span style={{ fontWeight: 400, color: "#928ea8" }}>(optional)</span></label>
      <input id="cc-type" data-testid="create-type" value={type} onChange={(e) => onType(e.target.value)}
        placeholder="e.g. Holiday, Milestone" style={{ ...input, marginBottom: 18 }} />
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" data-testid="create-submit" disabled={!canCreate}
          style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontWeight: 700, fontSize: ".85rem", cursor: canCreate ? "pointer" : "not-allowed", opacity: canCreate ? 1 : .55 }}>
          {creating ? "Creating…" : TERMS.CREATE}
        </button>
        <button type="button" data-testid="create-cancel" onClick={onCancel}
          style={{ background: "transparent", color: "#1b1830", border: "1px solid rgba(27,24,48,.15)", borderRadius: 11, padding: "10px 18px", fontWeight: 700, fontSize: ".85rem", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// `client` is an optional injection seam used ONLY by tests (default = the real server-derived
// client). App usage renders <GreetingAutomationCampaigns /> with no props → identical behavior.
export default function GreetingAutomationCampaigns({
  client: injectedClient, navigate: injectedNavigate,
  // TEAM I — the same injection seam, for the saved-card surface. Both unset in the app: the panel
  // builds its own client and resolves the shared Stripe instance itself.
  cardClient, stripeOverride,
} = {}) {
  const client = useMemo(() => injectedClient || createCorporateCampaignsClient(), [injectedClient]);
  const [membershipResult, setMembershipResult] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null); // explicit multi-org selection only
  const [rows, setRows] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignAuthError, setCampaignAuthError] = useState(false);
  const [campaignDormant, setCampaignDormant] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [capabilityResult, setCapabilityResult] = useState(null); // server-derived, from the campaign list load
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  // SLICE D — the organisation contact pool and the individual-selection surface.
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [pickerCampaign, setPickerCampaign] = useState(null);
  // SLICE F1 - which campaign is expanded, by CAMPAIGN ID and never by array position. The list
  // re-sorts and re-fetches; an index would silently expand a different campaign the moment one
  // was created or removed. Null means all four tiles are collapsed.
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);
  // Fails closed: nobody is treated as the owner until the server says so on a successful list.
  const [isOwnerViewer, setIsOwnerViewer] = useState(false);
  // SLICE E3 — the backend's execution interlock, published on the campaign list. Fails closed for
  // exactly the same reason ownership does: until a successful response says otherwise, the two
  // owner-only actions must not look pressable. This is the SERVER's answer held verbatim — the
  // dashboard never infers it, never remembers it across organizations, and never invents it.
  const [canAuthorizeRun, setCanAuthorizeRun] = useState(false);
  // Navigation without a Router dependency. The app mounts a HashRouter, so a hash assignment IS
  // the route change; injecting it keeps this component mountable on its own, which useNavigate()
  // would prevent by throwing outside a <Router>.
  // Recomputed from the campaigns and contacts already loaded - no extra request, and it cannot
  // disagree with what the cards show because it reads the same data they do.
  const overlaps = useMemo(
    () => findAudienceOverlaps(rows.map((r) => r.campaign), contacts),
    [rows, contacts],
  );



  const goTo = injectedNavigate || ((path) => { try { window.location.hash = `#${path}`; } catch { /* non-browser host */ } });

  // Organization context is derived purely from the membership response + any explicit
  // selection. Never guesses; clears a selection that is no longer active.
  const ctx = useMemo(() => resolveOrganizationContext(membershipResult, selectedOrgId), [membershipResult, selectedOrgId]);
  const effectiveOrgId = ctx.selectedOrgId;

  // ══ TEAM C — CAMPAIGN REORDER ══════════════════════════════════════════════════════════════
  //
  // DISPLAY ORDER ONLY. Nothing below can change an audience, gift, spread, schedule, title or
  // switch, and nothing below can reach an execution, charge or send. The only write it performs
  // is the ordering adapter, which is UNBOUND in production until Team A ships the contract.
  //
  // Three things make this safe rather than merely pretty:
  //   • the LAST CONFIRMED order is kept separately, so a refusal restores exactly what the
  //     server last agreed to rather than "whatever it looked like a moment ago";
  //   • every commit carries a sequence number and a late reply for an older sequence is DROPPED,
  //     so a slow first request cannot overwrite a faster second one;
  //   • expansion is keyed by campaign id throughout, so moving rows never expands the wrong one.
  const [orderIds, setOrderIds] = useState([]);          // what is on screen right now
  // ── TWO SEPARATE CHANNELS, because they answer two different questions ──
  //
  // My earlier description was self-contradictory: it claimed every older response was "discarded
  // outright" while also letting an older success advance the confirmed state. Both cannot be
  // true, and the difference matters precisely in the case the founder ruled on.
  //
  //   VISIBLE INTENT   — what the reader is looking at. Only the NEWEST commit may paint it. An
  //                      older reply, success or failure, may never repaint over a newer one.
  //   CONFIRMED STATE  — what the server has actually accepted. Any success may advance this, as
  //                      long as it is newer than the last success we recorded. It is what a
  //                      failure falls back to.
  //
  // Ordered by REQUEST SEQUENCE, never by arrival order: arrival order is evidence about the
  // network, not about what the server persisted.
  const confirmedRef = useRef({ ids: [], version: null });// what the server last confirmed
  const mountedRef = useRef(true);                        // no setState after unmount
  // loadCampaigns is declared further down; referencing it here directly would sit in the temporal
  // dead zone and throw on first render. The ref is filled in immediately after its declaration.
  // NAMED to avoid a prefix collision with the list-loader declaration, which the source-slicing
  // tests in premiumDashboard.browser.test.mjs use as a text anchor.
  const reloadListRef = useRef(null);
  const inFlightRef = useRef(null);                       // the order currently being written
  const queuedRef = useRef(null);                         // newest intent formed while a write is out
  const rowsRef = useRef([]);                             // latest rows, readable from async code
  // NOTE: an `unsynced` state used to be tracked alongside this. It was written in all three
  // failure paths and READ in none of them - the reader's signal is the announcement below, which
  // every one of those paths already sets. A state nobody renders is a promise nobody keeps.
  // Reordering is offered ONLY when the server gave us a usable version for this exact list.
  const [orderingAvailable, setOrderingAvailable] = useState(false);

  useEffect(() => () => { mountedRef.current = false; }, []);
  const [grabbedId, setGrabbedId] = useState(null);       // keyboard pick-up
  const [draggingId, setDraggingId] = useState(null);     // pointer drag
  const [announcement, setAnnouncement] = useState("");

  // The rows the dashboard actually renders, in the current display order.
  const orderedRows = useMemo(() => applyCampaignOrder(rows, orderIds), [rows, orderIds]);


  // Adopt the arrival order whenever the campaign SET changes (load, create, delete). Compared as
  // a set, so a reorder we just performed is not undone by the next list refresh.
  useEffect(() => {
    const incoming = campaignIdsOf(rows);
    const known = new Set(orderIds);
    const same = incoming.length === orderIds.length && incoming.every((id) => known.has(id));
    if (!same) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrderIds(incoming);
      if (confirmedRef.current.ids.length === 0) confirmedRef.current = { ids: incoming, version: null };
    }
  }, [rows]);   // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = useCallback(
    (id) => {
      const hit = rows.find((r) => r.campaign && r.campaign.campaignId === id);
      return (hit && hit.campaign && hit.campaign.name) || "Campaign";
    },
    [rows],
  );

  // ── SINGLE-FLIGHT, VERSION-AUTHORITATIVE REORDER ───────────────────────────────────────────
  //
  // WHY THE PREVIOUS MODEL WAS WRONG. It ordered outcomes by CLIENT REQUEST SEQUENCE. A sequence
  // number records the order requests were *issued*, which is not evidence of the order the server
  // *persisted*: A can be submitted first, B second, B can reply first, and the server can still
  // have written A last. Preferring B because B held the higher counter could therefore leave the
  // dashboard showing an order the server does not hold.
  //
  // The fix is to stop inferring and start serialising. AT MOST ONE reorder write is ever in
  // flight, so there is never a pair of outcomes whose relative order has to be guessed. Newer
  // intent formed while a write is out does not race it - it waits, and only the NEWEST such
  // intent is kept, because intermediate drag positions are not worth a write each.
  //
  // Authority comes from the server's own `orderVersion`, echoed back as `expectedVersion` on the
  // next write. Client counters survive only to suppress obsolete UI callbacks; they never decide
  // what the server holds.
  const sameOrder = (a, b) =>
    Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

  /** Re-read the authoritative list and adopt it as confirmed. Used whenever an outcome is unclear. */
  const resyncFromServer = useCallback(async () => {
    // The list is re-read DIRECTLY so its outcome is observable here. Delegating to loadCampaigns
    // alone was a real gap: it swallows its own failure, so a reload that never happened looked
    // exactly like one that succeeded, and case 14 could never report an unsynchronised state.
    let res = null;
    try { res = await client.listCampaigns(effectiveOrgId); } catch { res = null; }
    if (!mountedRef.current) return false;
    if (!res || res.ok !== true || !res.data || !Array.isArray(res.data.campaigns)) return false;

    const ids = res.data.campaigns.map((c) => c && c.campaignId).filter(Boolean);
    confirmedRef.current = { ids, version: confirmedRef.current.version };
    setOrderIds(ids);
    // Refresh the rest of the surface from the same authority.
    if (reloadListRef.current) await reloadListRef.current(effectiveOrgId);
    return mountedRef.current;
  }, [client, effectiveOrgId]);

  const submitRef = useRef(null);

  const submitOrder = useCallback(async (intent, movedId) => {
    // A write is already out: keep only the NEWEST intent and let the in-flight one finish.
    if (inFlightRef.current) { queuedRef.current = intent; return; }

    // ── COMPLETE-SET PRECONDITION ──
    // The request represents the ORGANISATION's canonical order, so a partial, filtered or
    // duplicated set must never be sent — the server would faithfully persist a wrong answer.
    const authoritative = campaignIdsOf(rowsRef.current);
    const wellFormed = Array.isArray(intent)
      && intent.length === authoritative.length
      && intent.every((id) => typeof id === "string" && id.length > 0)
      && new Set(intent).size === intent.length
      && authoritative.every((id) => intent.includes(id))
      && intent.every((id) => authoritative.includes(id));
    if (!wellFormed || !confirmedRef.current.version) {
      // Zero writes. Ask the server what is true instead of guessing.
      const recovered = await resyncFromServer();
      if (!mountedRef.current) return;
      if (!recovered) setAnnouncement("The campaign order could not be confirmed. Reload to see the saved order.");
      queuedRef.current = null;
      return;
    }

    inFlightRef.current = intent;

    let res = null;
    try {
      res = await client.reorderCampaigns({
        orgId: effectiveOrgId,
        orderedCampaignIds: intent,
        expectedVersion: confirmedRef.current.version,   // the server's own token, never a counter
      });
    } catch { res = null; }

    if (!mountedRef.current) { inFlightRef.current = null; queuedRef.current = null; return; }
    inFlightRef.current = null;

    let unresolved = false;
    if (res && res.ok === true && res.data) {
      const listed = Array.isArray(res.data.campaigns)
        ? res.data.campaigns.map((c) => c && c.campaignId).filter(Boolean)
        : null;
      const version = res.data.orderVersion;
      if (!listed || listed.length === 0 || !version) {
        // Accepted, but we cannot tell WHAT was accepted - or it came back without a usable
        // version to build the next write on. Ambiguous, so we ask the server rather than guess.
        unresolved = true;
      } else {
        confirmedRef.current = { ids: listed, version };
        // Never repaint an older canonical result over newer queued intent.
        if (!queuedRef.current) setOrderIds(listed);
      }
    } else if (res && res.unavailable) {
      // The route does not exist on this server yet. Ordering is retired for this loaded surface -
      // calmly, with no retry loop and no local persistence.
      setOrderingAvailable(false);
      setOrderIds(confirmedRef.current.ids.length ? confirmedRef.current.ids : campaignIdsOf(rowsRef.current));
      setAnnouncement("Saved campaign order isn't available yet. Your other changes are unaffected.");
      queuedRef.current = null;
      return;
    } else if (res && res.versionConflict && res.data) {
      // A COMPLETE, VALID conflict already carries the server's current truth, so it is adopted
      // directly - a second GET would only ask a question we have just been answered.
      const canonical = res.data.campaigns.map((c) => c && c.campaignId).filter(Boolean);
      confirmedRef.current = { ids: canonical, version: res.data.orderVersion };
      if (!queuedRef.current) {
        setOrderIds(canonical);
        setAnnouncement("The campaign order was refreshed from the server.");
      }
    } else if (res && (res.conflict || res.versionConflict || res.ambiguous)) {
      // Any conflict we could NOT fully validate - including an ordering 409 whose payload was
      // incomplete - is ambiguous. The branch above already handled the complete, valid case, so
      // reaching here means we do not know the server's truth and must ask rather than roll back.
      // A version conflict means our expectedVersion was stale: someone else moved first. The only
      // truthful answer is the server's current list.
      unresolved = true;
    } else {
      // A plain refusal that proves nothing was written - roll back to confirmed state.
      if (!queuedRef.current) {
        setOrderIds(confirmedRef.current.ids.length ? confirmedRef.current.ids : campaignIdsOf(rowsRef.current));
        setAnnouncement(reorderAnnouncement("failed", { name: nameOf(movedId) }));
      }
    }

    if (unresolved) {
      const ok = await resyncFromServer();
      if (!mountedRef.current) return;
      if (!ok) {
        // Even the refresh failed. Say so plainly rather than presenting an optimistic order as
        // saved; the reader can retry, which re-enters this same path.
        setAnnouncement("The campaign order could not be confirmed. Reload to see the saved order.");
        queuedRef.current = null;
        return;
      }
      if (!queuedRef.current) setOrderIds(confirmedRef.current.ids);
    }

    // ── drain exactly one queued intent ──
    const queued = queuedRef.current;
    queuedRef.current = null;
    if (!queued || !mountedRef.current) return;
    if (sameOrder(queued, confirmedRef.current.ids)) {
      // The queue already matches what the server holds - a write would say nothing.
      setOrderIds(confirmedRef.current.ids);
      return;
    }
    if (submitRef.current) await submitRef.current(queued, movedId);
  }, [client, effectiveOrgId, nameOf, resyncFromServer]);

  /** Optimistically show an order, then serialise the write behind the single-flight queue. */
  const commitOrder = useCallback(async (nextIds, movedId) => {
    setOrderIds(nextIds);
    await submitOrder(nextIds, movedId);
  }, [submitOrder]);

  // ── keyboard: space picks up, arrows move, space drops, escape cancels ──
  const onReorderKeyDown = useCallback((e, id) => {
    const ids = orderIds.length ? orderIds : campaignIdsOf(rows);
    const from = ids.indexOf(id);
    if (from < 0) return;
    const total = ids.length;

    if (e.key === " " || e.key === "Enter" || e.key === "Spacebar") {
      e.preventDefault();
      if (grabbedId === id) {
        setGrabbedId(null);
        setAnnouncement(reorderAnnouncement("dropped", { name: nameOf(id), position: from + 1, total }));
        commitOrder(ids, id);
      } else {
        setGrabbedId(id);
        setAnnouncement(reorderAnnouncement("grabbed", { name: nameOf(id), position: from + 1, total }));
      }
      return;
    }
    if (e.key === "Escape" && grabbedId === id) {
      e.preventDefault();
      const restore = confirmedRef.current.ids.length ? confirmedRef.current.ids : campaignIdsOf(rows);
      setOrderIds(restore);
      setGrabbedId(null);
      setAnnouncement(reorderAnnouncement("cancelled", { name: nameOf(id), position: restore.indexOf(id) + 1, total }));
      return;
    }
    if (grabbedId !== id) return;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const to = e.key === "ArrowUp" ? from - 1 : from + 1;
    if (to < 0 || to >= total) return;
    const next = moveCampaignId(ids, from, to);
    setOrderIds(next);                                    // moves while held; committed on drop
    setAnnouncement(reorderAnnouncement("moved", { name: nameOf(id), position: to + 1, total }));
  }, [orderIds, rows, grabbedId, nameOf, commitOrder]);

  // ── pointer: one path for mouse AND touch ──
  const onReorderPointerDown = useCallback((e, id) => {
    const ids = orderIds.length ? orderIds : campaignIdsOf(rows);
    if (ids.indexOf(id) < 0) return;
    setDraggingId(id);
    setAnnouncement(reorderAnnouncement("grabbed", { name: nameOf(id), position: ids.indexOf(id) + 1, total: ids.length }));
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported in jsdom */ }

    const tileOf = (cid) => document.querySelector(`[data-testid="campaign-card-${cid}"]`);
    let working = ids;

    const onMove = (ev) => {
      const y = ev.clientY;
      const current = working.indexOf(id);
      if (current < 0) return;

      // TARGET IS COMPUTED, NOT STEPPED.
      //
      // The first version swapped with one neighbour per pointer event and stopped. A fast drag -
      // a flick from the first tile past the fourth tile's midpoint - delivers few events, so the
      // row crawled one place per event and landed short of where the reader aimed. Worse, the
      // one-step rule is what MAKES oscillation possible: each event re-evaluates from a position
      // it only just moved to.
      //
      // So the destination is derived directly from the pointer: find the furthest tile whose
      // midpoint the pointer has crossed in the direction of travel, and move there in a single
      // step. One event can now cross every relevant midpoint, in either direction, and because
      // the answer is a function of the pointer position rather than of the previous move, the
      // same y always yields the same index - which is precisely what removes the oscillation.
      let target = current;
      for (let i = 0; i < working.length; i++) {
        if (i === current) continue;
        const el = tileOf(working[i]);
        if (!el || !el.getBoundingClientRect) continue;
        const r = el.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        if (i > current && y > mid) target = Math.max(target, i);        // travelling down
        if (i < current && y < mid) target = target === current ? i : Math.min(target, i); // up
      }
      if (target === current) return;

      working = moveCampaignId(working, current, target);
      setOrderIds(working);
      setAnnouncement(reorderAnnouncement("moved", { name: nameOf(id), position: target + 1, total: working.length }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      setDraggingId(null);
      setAnnouncement(reorderAnnouncement("dropped", { name: nameOf(id), position: working.indexOf(id) + 1, total: working.length }));
      commitOrder(working, id);
    };
    const onCancel = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      setDraggingId(null);
      const restore = confirmedRef.current.ids.length ? confirmedRef.current.ids : campaignIdsOf(rows);
      setOrderIds(restore);
      setAnnouncement(reorderAnnouncement("cancelled", { name: nameOf(id), position: restore.indexOf(id) + 1, total: restore.length }));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }, [orderIds, rows, nameOf, commitOrder]);


  // SLICE D — the organisation's contact pool. Categories come from the PERSISTED
  // corporateContactType the backend now returns; the frontend never infers or stores one.
  const loadContacts = useCallback(async (orgId) => {
    if (typeof client.listOrgContacts !== "function") { setContacts([]); return; }
    setLoadingContacts(true);
    try {
      const res = await client.listOrgContacts(orgId);
      setContacts(res && res.ok ? ((res.data && res.data.contacts) || []) : []);
    } catch {
      setContacts([]);           // a contact-load failure must never surface stale or partial data
    }
    setLoadingContacts(false);
  }, [client]);

  const loadMemberships = useCallback(async () => {
    const res = await client.listMemberships();
    setMembershipResult(res);
    const active = activeMemberships(res).map((m) => m.corporateOrganizationId);
    // Drop an explicit selection that vanished/became inactive (membership-change safety).
    setSelectedOrgId((prev) => (prev && active.includes(prev) ? prev : null));
  }, [client]);

  const loadCampaigns = useCallback(async (orgId) => {
    // STALE-AUTHORITY RESET, before the first awaited request.
    //
    // Ownership belongs to ONE organization. Switching organizations, or failing to load one, must
    // never leave the previous organization's `true` on screen — an owner-only control would stay
    // enabled for an organization the viewer may not own. Clearing FIRST means the window between
    // organizations is unauthorized rather than optimistically authorized, and every path below —
    // dormant, unauthorized, non-ok, or thrown — leaves it false unless a successful response says
    // otherwise.
    // The execution capability is organization-scoped in exactly the same way and is cleared on the
    // same line of defence: a stale `true` carried across a switch would re-enable Schedule for an
    // organization whose interlock has not been read yet.
    setIsOwnerViewer(false); setCanAuthorizeRun(false);
    setCampaignAuthError(false); setCampaignDormant(false); setLoadingCampaigns(true);
    try {
      const listRes = await client.listCampaigns(orgId);
      setCapabilityResult(listRes); // server-derived capability (ok / dormant / unauthorized) — never fabricated
      if (listRes.dormant) { setCampaignDormant(true); setRows([]); setLoadingCampaigns(false); return; }
      if (listRes.unauthorized) { setCampaignAuthError(true); setRows([]); setLoadingCampaigns(false); return; } // 401/403 clears protected data
      if (!listRes.ok) { setRows([]); setLoadingCampaigns(false); return; }
      // Only a SUCCESSFUL list can confer ownership, and only if it says so exactly.
      setIsOwnerViewer(readViewerOwnerCapability(listRes));

      // TEAM C — the authoritative ordering token, taken ONLY from this successful list response.
      //
      // A version belonging to an earlier list must never survive into a newer one, so it is
      // replaced (or cleared) on every successful load rather than merged. Strictly validated:
      // anything that is not `cord_` + 32 lowercase hex makes ordering unavailable, because a
      // token we cannot trust is worse than no token — it would be sent as `expectedVersion` and
      // rejected by the server on every attempt.
      const listVersion = listRes.data && listRes.data.orderVersion;
      const usableVersion = isOrderVersion(listVersion) ? listVersion : null;
      confirmedRef.current = {
        ids: (listRes.data.campaigns || []).map((c) => c && c.campaignId).filter(Boolean),
        version: usableVersion,
      };
      setOrderingAvailable(Boolean(usableVersion));
      setCanAuthorizeRun(readExecutionCapability(listRes));
      const list = (listRes.data && (listRes.data.campaigns || listRes.data.items || listRes.data)) || [];
      const arr = Array.isArray(list) ? list : [];
      const merged = await Promise.all(arr.map(async (campaign) => {
        const cid = campaign.campaignId || campaign.id;
        const rRes = await client.readReadiness(orgId, cid);
        const readiness = (rRes.ok && rRes.data) ? rRes.data : {};
        return { summary: deriveCampaignSummary(campaign, readiness), campaign: { ...campaign, campaignId: cid }, readiness };
      }));
      setRows(merged); setLoadingCampaigns(false);
    } catch {
      // A thrown load cannot retain ownership or execution capability either. Fail closed.
      setIsOwnerViewer(false); setCanAuthorizeRun(false);
      setRows([]); setLoadingCampaigns(false);
    }
  }, [client]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMemberships();
  }, [loadMemberships]);

  // ── LATEST-REF SYNCHRONISATION ────────────────────────────────────────────────────────────
  //
  // These three refs hold the newest `rows`, the newest `submitOrder` and the newest
  // `loadCampaigns` so that ASYNC ordering code - a settled reorder response, the single-flight
  // drain, a resync - reads what is true now rather than what was true when its closure was
  // created. They used to be assigned during render, which react-hooks/refs flags for a real
  // reason: under concurrent React a render can be started and thrown away, and a discarded
  // render would still have overwritten the ref, leaving async code reading a value the user
  // never saw committed.
  //
  // useLayoutEffect, NOT useEffect, and not because of layout. It is the narrowest React-supported
  // point that still closes the timing question the render-phase assignment was answering:
  //   • it flushes SYNCHRONOUSLY inside the commit, before the browser paints - so the refs are
  //     current before any pointer, touch or keyboard interaction can possibly reach a handler;
  //   • ALL layout effects run before ANY passive effect, so `reloadListRef` is populated before
  //     the `loadCampaigns` effect below can fire, even though that effect is declared first;
  //   • every consumer of these refs is an async continuation or an event handler - none reads
  //     them during render - so there is no window in which a ref is consumed while still stale.
  //
  // Declared AFTER the effect above deliberately: two source-slicing tests in
  // premiumDashboard.browser.test.mjs bound the `loadCampaigns` region at the first
  // "useEffect(() => {" that follows it, and a hook introduced between the two would move that
  // boundary. Hook ORDER is irrelevant here - layout effects run before passive ones regardless.
  useLayoutEffect(() => { rowsRef.current = rows; }, [rows]);
  useLayoutEffect(() => { submitRef.current = submitOrder; }, [submitOrder]);
  useLayoutEffect(() => { reloadListRef.current = loadCampaigns; }, [loadCampaigns]);

  // Load campaigns ONLY once an organization is resolved (single auto or explicit multi).
  useEffect(() => {
    if (effectiveOrgId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadCampaigns(effectiveOrgId);
      loadContacts(effectiveOrgId);
    } else {
      setRows([]);
      setContacts([]);
    }
  }, [effectiveOrgId, loadCampaigns, loadContacts]);

  async function handleCreate() {
    if (!effectiveOrgId || creating) return;
    const name = newName.trim();
    if (!name) return; // a campaign must be named (client-side only; backend still accepts null)
    const body = { name };
    const campaignType = newType.trim();
    if (campaignType) body.campaignType = campaignType;
    setCreating(true);
    const res = await client.createCampaign(effectiveOrgId, body);
    setCreating(false);
    if (res.ok) {
      setShowCreateForm(false); setNewName(""); setNewType("");
      await loadCampaigns(effectiveOrgId);
    }
  }

  function openCreate() { setNewName(""); setNewType(""); setShowCreateForm(true); }

  // Dormant (corporate capability off / caller not enrolled) → render the Founder-approved
  // read-only state (F3 Draft B) instead of a blank page. Truthful for personal users and
  // non-enrolled organizations. Zero writes, zero new requests, no access claim, no date promise,
  // no support/contact promise. Preserves the existing server-derived dormancy/authorization gate:
  // dormancy is still discovered only via the pre-existing membership probe (503 → dormant).
  if (ctx.phase === "dormant" || campaignDormant) {
    return (
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div data-testid="corporate-dormant" style={{ textAlign: "center", padding: "48px 24px", border: "1px solid rgba(27,24,48,.1)", borderRadius: 18, background: "#faf9fd" }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", margin: "0 0 10px", color: "#1b1830" }}>Greet-Me for Business</h1>
          <p style={{ color: "#605c78", maxWidth: "52ch", margin: "0 auto", lineHeight: 1.6 }}>
            Corporate campaign management is available to enrolled organizations. Your account isn’t currently enrolled.
          </p>
        </div>
      </div>
    );
  }

  if (selectedCampaignId && effectiveOrgId) {
    return (
      <CampaignDetail
        orgId={effectiveOrgId}
        campaignId={selectedCampaignId}
        client={client}
        capability={interpretCapability(capabilityResult)}
        onBack={() => { setSelectedCampaignId(null); loadMemberships(); }}
      />
    );
  }

  if (membershipResult === null) return <Shell><p style={{ color: "#605c78" }}>Loading…</p></Shell>;

  if (ctx.phase === "unauthorized" || ctx.phase === "error" || campaignAuthError) {
    return <Shell><p style={{ color: "#605c78" }}>You don't have access to corporate campaigns right now.</p></Shell>;
  }

  if (ctx.phase === "no_org") {
    // Safe no-organization state — no org campaign request, no user id, no org creation.
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "44px 24px", border: "1px solid rgba(27,24,48,.1)", borderRadius: 18, background: "#faf9fd" }}>
          <div style={{ fontSize: "2rem" }}>🏢</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.2rem", margin: "10px 0 6px" }}>No corporate organization yet</h2>
          <p style={{ color: "#605c78", maxWidth: "46ch", margin: "0 auto" }}>
            Your account isn't an active member of a corporate organization. When you're added to one, your campaigns will appear here.
          </p>
        </div>
      </Shell>
    );
  }

  if (ctx.phase === "select_org") {
    // More than one active membership → explicit choice required; no campaigns load yet.
    return (
      <Shell>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.05rem", margin: "0 0 6px" }}>Choose an organization</h2>
        <p style={{ color: "#605c78", fontSize: ".85rem", margin: "0 0 14px" }}>You're an active member of more than one organization. Select one to view its campaigns.</p>
        <div style={{ display: "grid", gap: 10 }}>
          {ctx.memberships.map((m) => (
            <button key={m.corporateOrganizationId} onClick={() => setSelectedOrgId(m.corporateOrganizationId)}
              style={{ textAlign: "left", cursor: "pointer", background: "#fff", border: "1px solid rgba(27,24,48,.12)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontFamily: "monospace", fontSize: ".85rem" }}>{m.corporateOrganizationId}</div>
              <div style={{ fontSize: ".78rem", color: "#605c78", marginTop: 3 }}>Role: {m.role}</div>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  // phase === "ready" — SLICE D consolidated surface: a wide campaigns viewport with its own
  // internal scroll, and the three contact tiles beneath it. Both stay on one desktop screen.
  // Ownership is the AUTHORITATIVE backend signal, not the caller's membership role. The two are
  // different facts: a member can hold an owner ROLE while the organisation names someone else as
  // its current owner, and only the latter may authorize a run.
  const isOwner = isOwnerViewer;
  return (
    <div className="gcd-root" data-testid="corporate-dashboard">
      <div className="gcd-underlay">
        <header className="gcd-hero">
          <div className="gcd-eyebrow">Corporate</div>
          <h1 className="gcd-title">{TERMS.SURFACE}</h1>
          <p className="gcd-sub">Set up organization-wide greetings once per campaign. {TERMS.YOU_DONT_NEED_EVERYTHING}</p>
        </header>

        {showCreateForm ? (
          <div className="gcd-panel" style={{ padding: 4 }}>
            <CreateCampaignForm
              name={newName} type={newType} onName={setNewName} onType={setNewType}
              onSubmit={handleCreate} onCancel={() => setShowCreateForm(false)} creating={creating}
            />
          </div>
        ) : null}

        {/* TEAM I (CONNECTION D) — PAYMENT METHOD. Placed above Campaigns because a gift campaign
            cannot be locked, scheduled or activated without a usable card: the reader should meet
            that requirement before configuring something it would block. */}
        <SavedCardPanel
          orgId={effectiveOrgId}
          client={cardClient}
          stripeOverride={stripeOverride}
        />

        {/* A — CAMPAIGNS: fixed-height internal scroll, sticky header + Add CTA. */}
        <section className="gcd-panel" data-testid="campaigns-panel" aria-labelledby="gcd-campaigns-head">
          <div className="gcd-panel-head">
            <div>
              <h2 className="gcd-panel-title" id="gcd-campaigns-head">Campaigns</h2>
              <p className="gcd-panel-note">Every campaign shows the same sections, whatever its state.</p>
            </div>
            <button type="button" className="gcd-btn gcd-btn--primary" data-testid="open-create" onClick={openCreate}>
              + {TERMS.CREATE}
            </button>
          </div>

          {/* SLICE E5 - OVERLAP WARNING. Names the people and the campaigns involved, then stops.
              It blocks nothing and disables nothing: someone may genuinely belong in two
              campaigns, and the organization knows whether that is intended far better than this
              surface does. A guardrail that refuses would be wrong more often than it was right. */}
          {overlaps.length > 0 ? (
            <div className="gcd-overlap" data-testid="overlap-warning" role="status">
              <p className="gcd-overlap-head">
                {overlaps.length === 1
                  ? "One contact is set to receive more than one campaign:"
                  : `${overlaps.length} contacts are set to receive more than one campaign:`}
              </p>
              <ul className="gcd-overlap-list">
                {overlaps.slice(0, OVERLAP_SHOWN).map((o) => (
                  <li key={o.contactId} data-testid={`overlap-${o.contactId}`}>{overlapLine(o)}</li>
                ))}
              </ul>
              {overlaps.length > OVERLAP_SHOWN ? (
                <p className="gcd-overlap-more" data-testid="overlap-more">
                  and {overlaps.length - OVERLAP_SHOWN} more
                </p>
              ) : null}
              <p className="gcd-overlap-note">
                That may be exactly what you want. Adjust an audience if it isn’t.
              </p>
            </div>
          ) : null}
          {/* TEAM C - reorder announcements. A polite live region, so pickup, movement, drop,
              cancellation and failure are all spoken without a visible banner competing with the
              campaign list. The instructions are ALSO on each handle's accessible name, so the
              keyboard affordance is discoverable from the control itself, not only from here. */}
          <p className="gcd-sr-only" aria-live="polite" role="status" data-testid="reorder-live">
            {announcement}
          </p>
          <div className="gcd-scroll" data-testid="campaign-viewport" tabIndex={0} role="region" aria-label="Campaigns list">
            {loadingCampaigns ? (
              <p className="gcd-empty">Loading campaigns…</p>
            ) : rows.length === 0 ? (
              <div className="gcd-empty" data-testid="campaigns-empty">
                <div style={{ fontSize: "2rem" }}>📣</div>
                <p style={{ margin: "8px 0 0" }}>No campaigns yet. Create your first — a name is enough to start.</p>
              </div>
            ) : (
              orderedRows.map((r, i) => (
                <CampaignCard
                  key={r.campaign.campaignId}
                  reorderIndex={i}
                  reorderTotal={orderedRows.length}
                  reorderAvailable={orderingAvailable}
                  grabbed={grabbedId === r.campaign.campaignId}
                  dragging={draggingId === r.campaign.campaignId}
                  onReorderPointerDown={onReorderPointerDown}
                  onReorderKeyDown={onReorderKeyDown}
                  campaign={r.campaign}
                  contacts={contacts}
                  orgId={effectiveOrgId}
                  client={client}
                  isOwner={isOwner}
                  canAuthorizeRun={canAuthorizeRun}
                  busy={loadingCampaigns}
                  /* DEFENCE IN DEPTH, not the primary source. The list above is authoritative; this
                     only catches the race where the interlock closes between a load and a click. */
                  onExecutionDormant={() => setCanAuthorizeRun(false)}
                  expanded={expandedCampaignId === r.campaign.campaignId}
                  onToggleExpanded={(cid) => setExpandedCampaignId((cur) => (cur === cid ? null : cid))}
                  onOpenIndividualPicker={(c) => setPickerCampaign(c)}
                  onAfterMutate={async () => { await loadCampaigns(effectiveOrgId); }}
                />
              ))
            )}
          </div>
        </section>

        {/* F1C ADDENDUM — the standing gift/payment note. Deliberately OUTSIDE the scroll
            viewport and outside every campaign card: one note for the surface, not one per tile.
            It is presentational only — a paragraph and a link. It performs no request, holds no
            state, and reads nothing about the account, so rendering it can never cause a payment
            call or make a reader wait. It is styled as a quiet aside, not an alert: no role
            "alert", no error tone, nothing to dismiss or agree to, and it never disables Save. */}
        <aside className="gcd-paynote" data-testid="gift-payment-note">
          <svg className="gcd-paynote-icon" viewBox="0 0 24 24" width="18" height="18"
            fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true" focusable="false">
            <rect x="3" y="8" width="18" height="4" rx="1" />
            <path d="M12 8v13" />
            <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
            <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
          </svg>
          <p className="gcd-paynote-text" data-testid="gift-payment-note-text">
            {GIFT_PAYMENT_DISCLOSURE.text}{" "}
            <a className="gcd-paynote-link" data-testid="gift-payment-note-link"
              href={GIFT_PAYMENT_DISCLOSURE.linkHref}>
              {GIFT_PAYMENT_DISCLOSURE.linkLabel}
            </a>
          </p>
        </aside>

        {/* B — CONTACT TILES: Employees / Clients / Vendors, always visible beneath the viewport.

            SLICE E5 - Manage is handled INSIDE the tile, which opens its own roster inline. It is
            deliberately NOT routed to /dashboard/contacts: that page reads the PERSONAL contact
            partition, while these contacts live under the organization with contactScope
            "corporate". Navigating there would show a different roster and let a reader believe it
            was this one. The dead `pickerCategory` state this used to set is gone - it was written
            and never read, so the button did nothing at all. */}
        <ContactTiles
          contacts={contacts}
          loading={loadingContacts}
          onAddCategory={(key) => {
            // The EXISTING import wizard route, with this category carried in the URL.
            goTo(`/dashboard/import-wizard?mode=corporate&category=${encodeURIComponent(key)}`);
          }}
          onSelectIndividual={() => setPickerCampaign(rows.length ? rows[0].campaign : null)}
        />

        {pickerCampaign ? (
          <IndividualContactPicker
            contacts={contacts}
            orgId={effectiveOrgId}
            campaign={pickerCampaign}
            client={client}
            onClose={() => setPickerCampaign(null)}
            onSaved={async () => { setPickerCampaign(null); await loadCampaigns(effectiveOrgId); }}
          />
        ) : null}
      </div>
    </div>
  );
}
