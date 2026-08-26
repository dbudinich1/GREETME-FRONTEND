// src/components/corporateCampaign/CampaignCard.jsx
//
// TEAM A — SLICE D: one campaign, rendered IDENTICALLY at every status.
//
// The six sections — Header, Audience, Gift Option, Featured Spread, Schedule, Action footer —
// always render, in that order. A control may be disabled, but it never disappears: a layout that
// changes shape with status makes a reader re-learn the card each time and hides the very control
// they came for. Disabled controls carry their reason as text.
//
// Nothing here decides anything. Status, capability, and enablement all come from
// corporateDashboardModel.js, which reads persisted backend state only.

import { useEffect, useMemo, useState } from "react";
import {
  CONTACT_CATEGORIES,
  CORPORATE_GIFT_OPTIONS,
  CURATED_TIERS_CENTS,
  SCHEDULE_MODES,
  centsToDisplay,
  giftOptionState,
  deriveCampaignStatus,
  deriveActions,
  isCampaignEnabled,
  resolveAudienceRefs,
  selectedCountsByCategory,
  contactCategoryLabel,
  buildDeliveryConfigBody,
  buildCampaignDraft,
  draftFingerprint,
  SEASONAL_SUGGESTION,
  describeSchedule,
  suggestedSeasonalDateLocal,
  describeCampaignPlan,
  rankActions,
  OWNER_ONLY_MESSAGE,
  EXECUTION_DORMANT_MESSAGE,
} from "./corporateDashboardModel.js";
import { EXECUTION_DORMANT_REASON } from "../../api/corporateCampaigns.js";
import { CategoryBubble, ChoiceBubble, BubbleGroup } from "./Bubbles.jsx";
import CampaignFeaturedSpreadEditor from "../../corporateCampaign/CampaignFeaturedSpreadEditor.jsx";
import "./premiumDashboard.css";

const SPREAD_SOURCES = [
  { value: "organization_default", label: "Organization Default", note: "Use the organization’s standard look." },
  { value: "saved_spread", label: "Saved Featured Spread", note: "Reuse a spread you’ve already built." },
  { value: "customize", label: "Customize This Campaign", note: "Adjust the spread for this campaign only." },
];

// SLICE F1 — mirrors the server's founder-ratified cap. Used for `maxLength` and for the message
// shown if a paste exceeds it; the SERVER remains the authority and refuses independently.
const CAMPAIGN_NAME_MAX = 120;

const OCCASION_TYPES = ["birthday", "anniversary", "work-anniversary", "holiday"];
const TIME_ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"];

export default function CampaignCard({
  campaign, contacts, orgId, client, isOwner, busy,
  // SLICE E3 — the server's execution interlock, read from the campaign list by the dashboard and
  // handed down. Defaults to false so a card rendered without it (an older caller, a test, a
  // partially wired parent) refuses rather than offers. Never derived here.
  canAuthorizeRun = false,
  // TEAM C - reorder. The card OWNS no order state; it only reports intent upward, exactly as it
  // does for expansion. `grabbed` is presentation for the keyboard mode the dashboard is in.
  reorderIndex = 0,
  reorderTotal = 0,
  reorderAvailable = false,
  grabbed = false,
  dragging = false,
  onReorderPointerDown = null,
  onReorderKeyDown = null,
  // SLICE F1 — expansion is owned by the DASHBOARD, not the card, because only one campaign may
  // be open at a time. Keyed by campaign id upstream; the card only reports which id was clicked.
  expanded = false,
  onToggleExpanded,
  // The day the card is being read, as YYYY-MM-DD. Injectable so the seasonal suggestion is a
  // pure function of its input; defaults to today for the real surface.
  todayIso = new Date().toISOString().slice(0, 10),
  onExecutionDormant,
  // `onOpenDetail` is deliberately gone: the title is a heading, not a link. A campaign is
  // configured on this card, so routing to CampaignDetail to read the same facts was exactly the
  // secondary-screen sequence this redesign removes.
  onOpenIndividualPicker, onAfterMutate,
}) {
  const status = deriveCampaignStatus(campaign);
  const actions = deriveActions(campaign, { isOwner, canAuthorizeRun });
  const locked = campaign.lockStatus === "locked";
  // Straight from the campaign the server just returned - deliberately NOT React state, so the
  // switch cannot drift out of step with the engine while a refetch is in flight.
  const enabled = isCampaignEnabled(campaign);

  // ── THE EDIT BUFFER ────────────────────────────────────────────────────────────────────────
  // What the server currently holds, and what the reader has changed on top of it. Nothing is
  // sent until Save, so Cancel can restore every field at once - including the audience, which
  // used to be written the instant a box was ticked.
  const persisted = useMemo(() => buildCampaignDraft(campaign, contacts), [campaign, contacts]);
  const persistedKey = draftFingerprint(persisted);
  const [draft, setDraft] = useState(persisted);
  const [syncedKey, setSyncedKey] = useState(persistedKey);

  // Resync on VALUE, not on object identity. A refetch hands down a new campaign object every
  // time, so an identity check would wipe unsaved edits whenever anything else on the card
  // mutated - notably the runtime switch, which refetches but changes nothing in this buffer.
  if (syncedKey !== persistedKey) {
    setDraft(persisted);
    setSyncedKey(persistedKey);
  }

  // Inline rename.
  const [showInfo, setShowInfo] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [spreadSource, setSpreadSource] = useState("organization_default");

  // TEAM C - the Featured Spread editor's server-derived contract.
  //
  // CAPABILITY IS NOT ASSUMED AND NOT A CLIENT CONSTANT. It is read from the SAME readiness
  // endpoint the rest of the surface already uses: a successful read means the capability is
  // live, and a dormant 503 means it is not. That keeps the editor's own rule intact - capability
  // comes from the server - without inventing a second capability source or a new endpoint.
  const [spread, setSpread] = useState({ capabilityEnabled: false, readiness: null, message: null });

  useEffect(() => {
    // Only when the reader is actually looking at this campaign's spread choices.
    if (!expanded || spreadSource !== "customize") return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await client.readReadiness(orgId, campaign.campaignId);
        if (!alive) return;
        if (res && res.ok === true) {
          setSpread({ capabilityEnabled: true, readiness: (res.data && res.data.readiness) || res.data || {}, message: null });
        } else {
          // Truthful, and distinguishes dormancy from a plain failure.
          setSpread({
            capabilityEnabled: false, readiness: null,
            message: res && res.dormant
              ? "Featured Spread editing isn't active yet."
              : "The Featured Spread settings couldn't be loaded.",
          });
        }
      } catch {
        if (alive) setSpread({ capabilityEnabled: false, readiness: null, message: "The Featured Spread settings couldn't be loaded." });
      }
    })();
    return () => { alive = false; };
  }, [expanded, spreadSource, orgId, campaign.campaignId, client]);

  // Saves through the EXISTING featured-spread API. The canonical response replaces local state;
  // a refusal is reported and nothing is optimistically kept.
  const saveSpreadDraft = async (config) => {
    await run("spread", async () => {
      const res = await client.updateFeaturedSpread(orgId, campaign.campaignId, config);
      return res;
    });
  };
  const [message, setMessage] = useState(null);
  const [pending, setPending] = useState(null);

  const edit = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = draftFingerprint(draft) !== persistedKey;

  const audienceRefs = Array.isArray(campaign.audienceRefs) ? campaign.audienceRefs : [];
  const counts = useMemo(() => selectedCountsByCategory(contacts, audienceRefs), [contacts, audienceRefs]);
  const draftRefs = refsOf(draft);
  // Computed from a date the caller supplies rather than the clock, so the card renders the same
  // way in a test as it does in December.
  const suggestion = suggestedSeasonalDateLocal(todayIso);
  // Which schedule shape this campaign uses, read from what is persisted.
  const sched = describeSchedule(campaign, draft);

  // One source for the displayed name, shared by the header and the rail so they can never drift.
  const campaignLabel = campaign.name || "Untitled campaign";
  const uid = (s) => `c-${campaign.campaignId}-${s}`;
  // Report a refusal. Extracted from run() because Save now makes TWO calls and both report the
  // same way; returns false so a caller can stop on the first failure.
  // The server's rename refusals, in the reader's words.
  const renameFailureMessage = (res) => {
    const code = res && res.error;
    if (code === "name_too_long") return `That name is too long — ${CAMPAIGN_NAME_MAX} characters at most.`;
    if (code === "name_required" || code === "name_must_be_a_string") return "A campaign name cannot be empty.";
    if (code === "campaign_locked") return "Unlock the campaign to rename it.";
    if (code === "owner_only" || (res && res.unauthorized)) return OWNER_ONLY_MESSAGE;
    // The client reports a 404 as `error: "campaign_not_found"` (its generic non-ok branch
    // forwards the server code); it never sets a `notFound` flag, so keying on one meant this
    // sentence could never be reached and a deleted campaign read as a transient failure.
    if (code === "campaign_not_found") return "That campaign no longer exists.";
    if (res && res.dormant) return "This feature isn’t active yet.";
    return "That didn’t go through. Please try again.";
  };

  const reportFailure = (res) => {
    const executionDormant = Boolean(res && res.dormant && res.reason === EXECUTION_DORMANT_REASON);
    if (executionDormant && onExecutionDormant) onExecutionDormant();
    setMessage((res && (
      (executionDormant && EXECUTION_DORMANT_MESSAGE)
      || res.error
      || (res.dormant && "This feature isn’t active yet.")
      || (res.unauthorized && "You don’t have access to this action.")
      || (res.conflict && "Someone else changed this campaign. Reload to see the current version.")
    )) || "That didn’t go through. Please try again.");
    return false;
  };

  const run = async (key, fn) => {
    setMessage(null); setPending(key);
    try {
      const res = await fn();
      // Never claim success before the API confirms it.
      if (!res || res.ok !== true) {
        // SLICE E3 — DEFENCE IN DEPTH. The list response is the authoritative source; this only
        // catches the race where the interlock closed after the last load. Telling the dashboard
        // disables the two owner-only actions on EVERY card, not just this one, because the
        // interlock is organization-wide. Status is untouched: nothing is advanced on a refusal.
        const executionDormant = Boolean(res && res.dormant && res.reason === EXECUTION_DORMANT_REASON);
        if (executionDormant && onExecutionDormant) onExecutionDormant();
        setMessage((res && (
          (executionDormant && EXECUTION_DORMANT_MESSAGE)
          || res.error
          || (res.dormant && "This feature isn’t active yet.")
          || (res.unauthorized && "You don’t have access to this action.")
        )) || "That didn’t go through. Please try again.");
        return null;
      }
      if (onAfterMutate) await onAfterMutate();
      return res;
    } finally { setPending(null); }
  };

  // SLICE E5 - the switch is applied IMMEDIATELY, not gathered into Save Changes.
  //
  // Save Changes is gated on `!locked`, and a running campaign is locked - so routing the switch
  // through it would mean a campaign could not be switched off exactly when it is sending. A stop
  // has to be reachable in one click from any state.
  // ── SLICE F1 — RENAME ──────────────────────────────────────────────────────────────────────
  // Same authority and lifecycle rule as the server: owner-only, editable campaigns only. Gated
  // here so the pencil is disabled with a reason rather than opening an editor that must fail.
  const renameAllowed = isOwner && !locked;
  const renameBlockedReason = !isOwner
    ? OWNER_ONLY_MESSAGE
    : "Unlock the campaign to rename it.";

  function beginRename() {
    if (!renameAllowed) return;
    setMessage(null);
    setNameDraft(campaign.name || "");
    setRenaming(true);
  }
  function cancelRename() {
    // Purely local: nothing was sent, so there is nothing to undo.
    setRenaming(false);
    setNameDraft("");
    setMessage(null);
  }
  async function commitRename() {
    if (!renameAllowed) return;
    const next = nameDraft.trim();
    const current = (campaign.name || "").trim();
    // An unchanged normalised name is not a change. Closing without a request is the honest
    // outcome — a no-op round trip would still flash "saved" at someone who edited nothing.
    if (next === current) { setRenaming(false); return; }
    if (next === "") { setMessage("A campaign name cannot be empty."); return; }
    setMessage(null); setPending("rename");
    try {
      const res = await client.renameCampaign(orgId, campaign.campaignId, next);
      if (!res || res.ok !== true) {
        // The persisted title stays on screen: `campaignLabel` reads `campaign.name`, which is
        // untouched, so there is no optimistic value left behind after a failure.
        setMessage(renameFailureMessage(res));
        return;
      }
      setRenaming(false);
      if (onAfterMutate) await onAfterMutate();
    } finally { setPending(null); }
  }

  async function setEnabled(next) {
    // Re-check the gate rather than trusting `disabled` alone. The attribute is the browser's
    // mechanism for suppressing the interaction, and it is the RIGHT mechanism - but it is the
    // only one, and this control commits an organization to real sends against real money. One
    // line buys a second lock that does not depend on the host honouring the first.
    if (!actions.toggle.enabled) return;
    await run("toggle", () => client.setCampaignEnabled(orgId, campaign.campaignId, next));
  }

  // The audience a draft actually describes: the checked categories expanded to their members,
  // plus anyone picked individually. Unchecking a category now genuinely removes its members,
  // because the individual picks are tracked separately rather than being the whole saved list.
  // A function DECLARATION, not a const arrow: it is called from the render body above, and a
  // const would sit in the temporal dead zone there and throw on first paint.
  function refsOf(d) {
    return resolveAudienceRefs({
      contacts, selectedCategories: d.categories, individuallySelected: d.individualRefs,
    });
  }
  const sameRefs = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

  // ── SAVE ───────────────────────────────────────────────────────────────────────────────────
  // Two endpoints, one button. Only what actually changed is sent, so saving a schedule tweak
  // does not rewrite the audience - and the audience is written FIRST, because it is the
  // narrowing decision: if the second call fails, the campaign is left addressed to fewer people
  // rather than to more.
  async function saveAll() {
    if (!dirty || !actions.save.enabled) return;
    setMessage(null); setPending("save");
    try {
      const nextRefs = refsOf(draft);
      if (!sameRefs(nextRefs, refsOf(persisted))) {
        const res = await client.setAudience(orgId, campaign.campaignId, nextRefs);
        if (!res || res.ok !== true) return reportFailure(res);
      }
      const body = buildDeliveryConfigBody({
        scheduleMode: draft.scheduleMode,
        scheduledForUtc: draft.scheduledForLocal ? new Date(draft.scheduledForLocal).toISOString() : null,
        occasionType: draft.occasionType,
        timeZone: draft.timeZone,
        giftType: draft.giftType,
        curatedTierCents: draft.tierCents,
      });
      const res = await client.updateDeliveryConfig(orgId, campaign.campaignId, body);
      if (!res || res.ok !== true) return reportFailure(res);

      // The refetch resyncs the buffer, so the card ends up showing the server's answer rather
      // than the values that were typed into it.
      if (onAfterMutate) await onAfterMutate();
      return true;
    } finally { setPending(null); }
  }

  // ── CANCEL ─────────────────────────────────────────────────────────────────────────────────
  // Nothing to undo on the server, because nothing was sent. One assignment restores every field.
  function cancelEdits() {
    setDraft(persisted);
    setMessage(null);
  }

  const disabledNote = (a) => (a.enabled ? null : a.reason);

  const ranked = rankActions(actions, { scheduleMode: draft.scheduleMode });

  // Every lifecycle action still exists in `actions`; this only decides where each one is placed.
  const ACTION_RUN = {
    save: saveAll,
    approve: () => run("approve", () => client.approve(orgId, campaign.campaignId)),
    lock: () => run("lock", () => client.lock(orgId, campaign.campaignId, { lockOperationId: `lock-${campaign.campaignId}-${campaign.snapshotVersion || 0}` })),
    unlock: () => run("unlock", () => client.unlock(orgId, campaign.campaignId)),
    schedule: () => run("schedule", () => client.schedule(orgId, campaign.campaignId)),
    activate: () => run("activate", () => client.activate(orgId, campaign.campaignId)),
  };
  const actionButton = (key, primary) => {
    const a = actions[key];
    if (!a) return null;
    const isSave = key === "save";
    return (
      <button key={key} type="button"
        className={`gcd-btn${primary ? " gcd-btn--primary" : ""}`}
        data-testid={`act-${key}-${campaign.campaignId}`}
        disabled={!a.enabled || busy || pending === key || (isSave && !dirty)}
        title={a.enabled ? undefined : a.reason}
        onClick={ACTION_RUN[key]}>
        {isSave && pending === "save" ? "Saving\u2026" : a.label}
      </button>
    );
  };

  return (
    <article className={`gcd-card${expanded ? " gcd-card--expanded" : ""}${dragging ? " gcd-card--dragging" : ""}`}
      data-testid={`campaign-card-${campaign.campaignId}`} aria-labelledby={uid("name")}>

      {/* ── HEADER / BANNER ────────────────────────────────────────────────────────────────────
          ONE header, not two. Collapsed it is the tile head; expanded the same element becomes
          the full-width banner. That is deliberate: a separate banner would mean a second copy of
          the title and a second edit pencil, and two controls that rename the same thing is how a
          reader ends up editing the one that is not wired. */}
      <div className={`gcd-tile-head${expanded ? " gcd-tile-head--banner" : ""}`}>
        <div className="gcd-tile-headline">
          {/* TEAM C - THE DRAG HANDLE. A dedicated control, never the whole tile: making the tile
              itself draggable would fight the pencil, the switch and the expander, and would make
              every attempt to press one of them ambiguous.

              It is a real <button>, so it is tabbable, keyboard-operable and announced. Pointer
              events cover mouse AND touch through one code path. `touch-action: none` is set in
              CSS so a drag does not also scroll the list under the finger. Every handler stops
              propagation, so a drag can never expand a campaign, open the rename field, flip the
              switch, or reach any lifecycle call. */}
          {/* TEAM C - the handle appears ONLY when the server gave this exact list a usable
              ordering version. Without one there is nothing valid to send as `expectedVersion`, so
              offering a drag would promise a save that cannot happen. Everything else on the tile -
              expansion, rename, the switch, configuration - stays fully usable. */}
          {reorderAvailable ? (
          <button type="button" className={`gcd-drag${grabbed ? " gcd-drag--grabbed" : ""}`}
            data-testid={`card-drag-${campaign.campaignId}`}
            style={{ padding: 0 }}
            aria-label={`Reorder ${campaignLabel}. Position ${reorderIndex + 1} of ${reorderTotal}. Press space to pick up, then arrow up or arrow down to move.`}
            aria-pressed={grabbed}
            title="Drag to reorder, or press space to pick up"
            onPointerDown={(e) => { e.stopPropagation(); if (onReorderPointerDown) onReorderPointerDown(e, campaign.campaignId); }}
            onKeyDown={(e) => { e.stopPropagation(); if (onReorderKeyDown) onReorderKeyDown(e, campaign.campaignId); }}
            onClick={(e) => e.stopPropagation()}>
            <span className="gcd-drag-grip" aria-hidden="true" />
          </button>
          ) : null}
          {/* A HEADING, not a link. It no longer navigates to CampaignDetail — the campaign is
              configured here, so sending someone to another screen to read the same thing was the
              sub-screen sequence this redesign removes. */}
          <h3 className="gcd-card-name" id={uid("name")} data-testid={`card-title-${campaign.campaignId}`}>
            {campaignLabel}
          </h3>
          {/* `padding: 0` inline: index.css styles the button ELEMENT and would inflate this
              fixed-size control into an oval, then a 48px block on mobile. */}
          <button type="button" className="gcd-pencil" data-testid={`card-rename-${campaign.campaignId}`}
            style={{ padding: 0 }} disabled={!renameAllowed}
            title={renameAllowed ? `Rename ${campaignLabel}` : renameBlockedReason}
            aria-label={`Rename ${campaignLabel}`}
            onClick={beginRename}>
            ✎
          </button>
        </div>

        <div className="gcd-tile-meta">
          {/* SLICE F1C - the lifecycle ceremony is gone from the surface. No Approved chip, no
              campaign-type label, no On/Off text beside the switch. A reader manages a campaign
              with two things: whether it is on, and what it is set up to do. The approval and lock
              records still exist on the server and still govern what may run; they are simply no
              longer a set of buttons a person is asked to operate. */}
          <label className={`gcd-switch${actions.toggle.enabled ? "" : " gcd-switch--disabled"}`}
            title={disabledNote(actions.toggle) || `${enabled ? "Disable" : "Enable"} ${campaignLabel} campaign`}>
            <input type="checkbox" role="switch" checked={enabled}
              data-testid={`card-toggle-${campaign.campaignId}`}
              aria-label={`${enabled ? "Disable" : "Enable"} ${campaignLabel} campaign`}
              disabled={!actions.toggle.enabled || busy || pending === "toggle"}
              onChange={(e) => setEnabled(e.target.checked)} />
            <span className="gcd-switch-track" aria-hidden="true" />
          </label>

          {/* The information panel is RETAINED. The three selector summaries answer who, what and
              which spread — they do not answer "will this fire every year", which is the fact most
              often assumed wrongly and the reason this control was added. */}
          {expanded ? (
            <button type="button" className="gcd-info-btn" data-testid={`card-info-${campaign.campaignId}`}
              style={{ padding: 0 }}
              aria-expanded={showInfo} aria-controls={uid("info")}
              title={showInfo ? "Hide the summary" : "What will this campaign do?"}
              aria-label={`What will ${campaignLabel} do?`}
              onClick={() => setShowInfo((v) => !v)}>
              i
            </button>
          ) : null}

          {/* The expand control sits last so it lands at the far right of the header row. */}
          <button type="button" className="gcd-expand" data-testid={`card-expand-${campaign.campaignId}`}
            style={{ padding: 0 }}
            aria-expanded={expanded} aria-controls={uid("body")}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${campaignLabel}`}
            onClick={() => onToggleExpanded && onToggleExpanded(campaign.campaignId)}>
            <span className="gcd-chevron" aria-hidden="true" />
          </button>
        </div>

        <p className="gcd-next" data-testid={`card-next-${campaign.campaignId}`}>{status.next}</p>
      </div>

      {/* ── INLINE RENAME ──────────────────────────────────────────────────────────────────────
          One compact editor, in the same tile. Never a modal: renaming is the smallest possible
          edit and a dialog would make it feel like a decision. */}
      {renaming ? (
        <form className="gcd-rename" data-testid={`card-rename-form-${campaign.campaignId}`}
          onSubmit={(e) => { e.preventDefault(); commitRename(); }}>
          <label className="gcd-rename-label" htmlFor={uid("rename")}>Campaign name</label>
          <input id={uid("rename")} className="gcd-rename-input" type="text" value={nameDraft}
            data-testid={`card-rename-input-${campaign.campaignId}`}
            maxLength={CAMPAIGN_NAME_MAX}
            autoFocus
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); cancelRename(); } }} />
          <button type="submit" className="gcd-btn gcd-btn--primary" data-testid={`card-rename-save-${campaign.campaignId}`}
            disabled={pending === "rename"}>{pending === "rename" ? "Saving\u2026" : "Save Name"}</button>
          <button type="button" className="gcd-btn" data-testid={`card-rename-cancel-${campaign.campaignId}`}
            onClick={cancelRename}>Cancel</button>
        </form>
      ) : null}

      {message ? <p className="gcd-msg" data-testid={`card-msg-${campaign.campaignId}`} role="status">{message}</p> : null}

      {/* ── EXPANDED BODY ──────────────────────────────────────────────────────────────────── */}
      {expanded ? (
        <div className="gcd-tile-body" id={uid("body")}>

          {showInfo ? (
            <dl className="gcd-info" id={uid("info")} data-testid={`card-info-panel-${campaign.campaignId}`}>
              {describeCampaignPlan({ draft, recipientCount: draftRefs.length, enabled }).map((row) => (
                <div className="gcd-info-row" key={row.key}>
                  <dt className="gcd-info-label">{row.label}</dt>
                  <dd className="gcd-info-value" data-testid={`card-info-${row.key}-${campaign.campaignId}`}>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {/* ══ THE CONFIGURATION WORKSPACE ══════════════════════════════════════════════════
              Three COMPLETE cards, side by side, every option visible at once.

              There is deliberately no Change/Done step in front of these choices. A summary that
              hides its own options makes a reader click to discover what a control even offers,
              and only one of the three could be seen at a time — so comparing "who gets this"
              against "what do they get" meant closing one to open the other. The bubbles ARE the
              controls; the cards only group them.

              Only genuinely SECONDARY tools still open on demand: the individual-contact roster,
              and the saved/custom spread editors. Those reveal content that cannot fit inline,
              and the primary bubbles stay visible the whole time. */}
          <div className="gcd-workspace" data-testid={`card-selectors-${campaign.campaignId}`}>

            {/* ── AUDIENCE ─────────────────────────────────────────────────────────────────── */}
            <section className="gcd-wcard" data-testid={`selector-audience-${campaign.campaignId}`}
              aria-labelledby={uid("wc-audience")}>
              <h4 className="gcd-wcard-title" id={uid("wc-audience")}>
                <span className="gcd-wcard-icon" aria-hidden="true">{"\u{1F465}"}</span>
                Audience
              </h4>
              <BubbleGroup label="Who receives this campaign" testId={uid("audience")}>
                {CONTACT_CATEGORIES.map((cat) => (
                  <CategoryBubble
                    key={cat.key} id={uid(`aud-${cat.key}`)} label={cat.label}
                    count={counts[cat.key]}
                    checked={draft.categories.includes(cat.key)}
                    disabled={locked}
                    reason={locked ? "Unlock the campaign to change its audience." : null}
                    onChange={(on) => edit({
                      categories: on ? [...draft.categories, cat.key] : draft.categories.filter((k) => k !== cat.key),
                    })}
                  />
                ))}
              </BubbleGroup>
              {/* The roster itself opens in the existing picker — it is a list of people, not a
                  choice that fits in a bubble. Its availability and count stay on the card. */}
              <div className="gcd-wcard-foot">
                <button type="button" className="gcd-btn" data-testid={`card-individual-${campaign.campaignId}`}
                  disabled={locked} onClick={() => onOpenIndividualPicker && onOpenIndividualPicker(campaign)}>
                  Select Individual Contacts
                </button>
                <span className="gcd-wcard-note" data-testid={`card-audience-total-${campaign.campaignId}`}>
                  {draftRefs.length} {draftRefs.length === 1 ? "contact" : "contacts"} selected
                  {counts.unclassified > 0 ? ` \u00b7 ${counts.unclassified} unclassified` : ""}
                </span>
              </div>
            </section>

            {/* ── GIFT OPTIONS ─────────────────────────────────────────────────────────────── */}
            <section className="gcd-wcard gcd-wcard--gift" data-testid={`selector-gift-${campaign.campaignId}`}
              aria-labelledby={uid("wc-gift")}>
              <h4 className="gcd-wcard-title" id={uid("wc-gift")}>
                <span className="gcd-wcard-icon" aria-hidden="true">{"\u{1F381}"}</span>
                Gift Options
              </h4>
              {/* All four, always. A gift a campaign cannot run is shown DISABLED and KEPT on
                  screen under its real name - removing it would hide part of the offer. FINAL
                  POLISH: it no longer carries an explanatory sentence beneath it. Its state is
                  carried by the radio's own disabled semantics, which assistive technology already
                  announces, so nothing is communicated by colour alone. */}
              <BubbleGroup label="What goes with the greeting" role="radiogroup" testId={uid("gift")}>
                {CORPORATE_GIFT_OPTIONS.map((opt) => {
                  const state = giftOptionState(opt.value);
                  return (
                    <ChoiceBubble
                      key={opt.value} id={uid(`gift-${opt.value}`)} name={uid("gift-group")} value={opt.value}
                      label={opt.label} note={state.selectable ? opt.description : null}
                      reason={state.selectable ? null : state.reason}
                      checked={draft.giftType === opt.value}
                      disabled={!state.selectable || locked}
                      onChange={(v) => edit({ giftType: v })}
                    />
                  );
                })}
              </BubbleGroup>
              {draft.giftType === "curated" ? (
                <div className="gcd-wcard-foot" data-testid={`card-curated-${campaign.campaignId}`}>
                  <label className="gcd-wcard-field" htmlFor={uid("tier")}>
                    Spend limit <span className="gcd-wcard-note">(private to you)</span>
                  </label>
                  <select id={uid("tier")} value={draft.tierCents} disabled={locked}
                    onChange={(e) => edit({ tierCents: Number(e.target.value) })} data-testid={`card-tier-${campaign.campaignId}`}>
                    {CURATED_TIERS_CENTS.map((c) => <option key={c} value={c}>{centsToDisplay(c)}</option>)}
                  </select>
                </div>
              ) : null}
            </section>

            {/* ── FEATURED SPREAD ──────────────────────────────────────────────────────────── */}
            <section className="gcd-wcard" data-testid={`selector-spread-${campaign.campaignId}`}
              aria-labelledby={uid("wc-spread")}>
              <h4 className="gcd-wcard-title" id={uid("wc-spread")}>
                <span className="gcd-wcard-icon" aria-hidden="true">{"\u{1F3A8}"}</span>
                Featured Spread
              </h4>
              <BubbleGroup label="How the card looks inside" role="radiogroup" testId={uid("spread")}>
                {SPREAD_SOURCES.map((sp) => (
                  <ChoiceBubble key={sp.value} id={uid(`spread-${sp.value}`)} name={uid("spread-group")} value={sp.value}
                    label={sp.label} note={sp.note} checked={spreadSource === sp.value} disabled={locked}
                    onChange={(v) => setSpreadSource(v)} />
                ))}
              </BubbleGroup>
              {/* The three choices above stay visible while these secondary tools are in use. */}
              {spreadSource === "saved_spread" ? (
                <div className="gcd-wcard-foot" data-testid={`card-spread-saved-${campaign.campaignId}`}>
                  <span className="gcd-wcard-note">Choose one of your saved spreads.</span>
                </div>
              ) : null}
              {spreadSource === "customize" ? (
                <div className="gcd-wcard-foot" data-testid={`card-spread-editor-${campaign.campaignId}`}>
                  {/* TEAM C - the pre-existing INERT editor, corrected.
                      It was mounted with orgId/campaignId/client, none of which it accepts, so its
                      first line - `if (!capabilityEnabled) return null` - fired every single time
                      and the editor rendered nothing at all. It now receives the real contract:
                      server-derived capability and readiness, the campaign's persisted config, and
                      a save that goes through the EXISTING updateFeaturedSpread API. No second
                      editor, no second spread model, no modal, no route. */}
                  <CampaignFeaturedSpreadEditor
                    capabilityEnabled={spread.capabilityEnabled}
                    campaignName={campaign.name || ""}
                    initialConfig={campaign.featuredSpreadConfig}
                    readiness={spread.readiness}
                    onSaveDraft={saveSpreadDraft}
                    showLifecycleActions={false}
                  />
                  {spread.message ? (
                    <p className="gcd-reason" data-testid={`card-spread-msg-${campaign.campaignId}`}>{spread.message}</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>

          {/* ── SCHEDULE — unchanged modes and payload, kept beneath the selector area ───────── */}
          {/* SLICE F1C - the schedule shape follows the CAMPAIGN, not a question put to the
              reader. A seasonal campaign sends on one date; a milestone or birthday campaign
              sends on each contact's own saved date. Offering both invited someone to pick the
              mode that cannot work for their campaign, then wonder why it reached nobody.
              `deliveryConfig.scheduleMode` remains the authority - this reads it, and no backend
              scheduling semantics changed. */}
          <div className="gcd-section" data-testid={uid("schedule")}>
            <p className="gcd-section-label">{sched.heading}</p>
            <p className="gcd-sched-summary" data-testid={`card-sched-summary-${campaign.campaignId}`}>{sched.summary}</p>
          </div>
          <div className="gcd-fields" style={{ marginTop: 10 }}>
            {sched.showSharedDate ? (
              <div className="gcd-field">
                <label htmlFor={uid("when")}>Send date and time</label>
                <input id={uid("when")} type="datetime-local" value={draft.scheduledForLocal} disabled={locked}
                  onChange={(e) => edit({ scheduledForLocal: e.target.value })} data-testid={`card-when-${campaign.campaignId}`} />
                {!draft.scheduledForLocal && !locked && suggestion ? (
                  <p className="gcd-suggest" data-testid={`card-suggest-${campaign.campaignId}`}>
                    <button type="button" className="gcd-btn gcd-btn--quiet gcd-suggest-btn"
                      data-testid={`card-suggest-apply-${campaign.campaignId}`}
                      onClick={() => edit({ scheduledForLocal: suggestion })}>
                      Use {SEASONAL_SUGGESTION.label}
                    </button>
                    <span className="gcd-suggest-why">{SEASONAL_SUGGESTION.why}</span>
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="gcd-field">
                <label htmlFor={uid("occasion")}>Occasion</label>
                <select id={uid("occasion")} value={draft.occasionType} disabled={locked}
                  onChange={(e) => edit({ occasionType: e.target.value })} data-testid={`card-occasion-${campaign.campaignId}`}>
                  {OCCASION_TYPES.map((o) => <option key={o} value={o}>{o.replace(/-/g, " ")}</option>)}
                </select>
              </div>
            )}
            <div className="gcd-field">
              <label htmlFor={uid("tz")}>Time zone</label>
              <select id={uid("tz")} value={draft.timeZone} disabled={locked}
                onChange={(e) => edit({ timeZone: e.target.value })} data-testid={`card-tz-${campaign.campaignId}`}>
                {TIME_ZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>

          {/* ── ACTIONS. Every capability is preserved; only prominence changes. The valid next
              step leads, other currently-valid steps stay in a quieter row, and steps that are not
              valid yet are not rendered — a row of five disabled buttons reads as a broken screen
              and teaches nothing. `deriveActions` still computes all seven. */}
          <div className="gcd-actions" data-testid={`card-footer-${campaign.campaignId}`}
            role="group" aria-label={`Actions for ${campaignLabel} \u2014 ${status.label}`}>
            {dirty ? (
              <p className="gcd-dirty" data-testid={`card-dirty-${campaign.campaignId}`} role="status">
                Unsaved changes - nothing is sent until you save.
              </p>
            ) : null}
            {/* WHOSE actions these are. The banner can scroll out of view above a long expanded
                body, and unlabelled buttons over someone else's settings is how a reader acts on
                the wrong campaign. */}
            <span className="gcd-actions-id" data-testid={`rail-context-${campaign.campaignId}`}
              title={campaignLabel}>
              <span className="gcd-actions-id-name">{campaignLabel}</span>
            </span>
            {/* The editor: always present, enabled by whether anything changed. */}
            {actionButton("save", dirty)}
            {/* SLICE F1C - Save and Cancel are the only actions a reader operates. Approve,
                Lock, Unlock, Schedule and Activate are no longer buttons: the founder's contract
                is that saving configures a campaign and the switch turns it on. Those records
                still exist server-side and still govern what may run - `deriveActions` and
                `rankActions` still compute all of them, and the API methods are untouched - they
                are simply not a ceremony a person is asked to perform. */}
            {/* The blocked next step, rendered DISABLED so its reason is on screen. */}
            {/* Always present, disabled when there is nothing to discard. A button that appears
                and vanishes as you type moves the row under the pointer; a steady one that is
                simply inert is calmer and keeps the rail a fixed shape. */}
            <button type="button" className="gcd-btn" data-testid={`act-cancel-${campaign.campaignId}`}
              disabled={!dirty || busy || pending === "save"}
              title={dirty ? "Discard your unsaved changes." : "No unsaved changes."}
              onClick={cancelEdits}>Cancel</button>
            {ranked.blockedNext ? (
              <p className="gcd-reason" data-testid={`card-blocked-${campaign.campaignId}`}>
                {actions[ranked.blockedNext].reason}
              </p>
            ) : null}
            {!isOwner ? (
              <p className="gcd-reason" data-testid={`card-owner-note-${campaign.campaignId}`}>
                {actions.schedule.reason || actions.activate.reason}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export { contactCategoryLabel };
