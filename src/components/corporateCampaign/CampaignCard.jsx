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

import { useMemo, useState } from "react";
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
  suggestedSeasonalDateLocal,
  describeCampaignPlan,
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

const OCCASION_TYPES = ["birthday", "anniversary", "work-anniversary", "holiday"];
const TIME_ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"];

export default function CampaignCard({
  campaign, contacts, orgId, client, isOwner, busy,
  // SLICE E3 — the server's execution interlock, read from the campaign list by the dashboard and
  // handed down. Defaults to false so a card rendered without it (an older caller, a test, a
  // partially wired parent) refuses rather than offers. Never derived here.
  canAuthorizeRun = false,
  // The day the card is being read, as YYYY-MM-DD. Injectable so the seasonal suggestion is a
  // pure function of its input; defaults to today for the real surface.
  todayIso = new Date().toISOString().slice(0, 10),
  onExecutionDormant,
  onOpenIndividualPicker, onAfterMutate, onOpenDetail,
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

  const [showInfo, setShowInfo] = useState(false);
  const [spreadSource, setSpreadSource] = useState("organization_default");
  const [showSpreadEditor, setShowSpreadEditor] = useState(false);
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

  // One source for the displayed name, shared by the header and the rail so they can never drift.
  const campaignLabel = campaign.name || "Untitled campaign";
  const uid = (s) => `c-${campaign.campaignId}-${s}`;
  // Report a refusal. Extracted from run() because Save now makes TWO calls and both report the
  // same way; returns false so a caller can stop on the first failure.
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

  return (
    <article className="gcd-card" data-testid={`campaign-card-${campaign.campaignId}`} aria-labelledby={uid("name")}>
      {/* 1 — HEADER */}
      <header className="gcd-card-head">
        <div>
          {/* The name is the way into the full campaign detail view — the same destination the
              pre-consolidation list offered, kept so nothing became unreachable. */}
          <h3 className="gcd-card-name" id={uid("name")}>
            <button type="button" className="gcd-btn gcd-btn--quiet" data-testid={`card-open-${campaign.campaignId}`}
              style={{ font: "inherit", padding: 0, textDecoration: "none" }}
              onClick={() => onOpenDetail && onOpenDetail(campaign.campaignId)}>
              {campaignLabel}
            </button>
          </h3>
          {campaign.campaignType ? (
            <p className="gcd-bubble-note" data-testid={`card-type-${campaign.campaignId}`} style={{ margin: "0 0 4px" }}>
              {campaign.campaignType}
            </p>
          ) : null}
          <p className="gcd-next" data-testid={`card-next-${campaign.campaignId}`}>{status.next}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`gcd-status gcd-status--${status.tone}`} data-testid={`card-status-${campaign.campaignId}`}>{status.label}</span>
          {/* SLICE E5 - THE RUNTIME SWITCH.
              Sits with the STATUS, not in the action rail, because it reports a state as much as
              it performs an action: the chip says what the campaign is doing and the switch says
              whether it is meant to be doing it. Putting it among Save/Approve/Lock would have
              made a persistent condition look like one more one-shot command.
              Reads `campaign.enabled` on every render, so what it shows is the server's answer
              after the refetch - never a local guess that could disagree with the engine. */}
          {/* SLICE E5 - the information control. `padding: 0` is set INLINE deliberately: the
              global `button` rule in src/index.css sets padding on the ELEMENT, and would inflate
              a fixed 26px circle into an oval on desktop and a 48px block on a phone. */}
          <button type="button" className="gcd-info-btn" data-testid={`card-info-${campaign.campaignId}`}
            style={{ padding: 0 }}
            aria-expanded={showInfo} aria-controls={uid("info")}
            title={showInfo ? "Hide the summary" : "What will this campaign do?"}
            aria-label={`What will ${campaignLabel} do?`}
            onClick={() => setShowInfo((v) => !v)}>
            i
          </button>
          <label className={`gcd-switch${actions.toggle.enabled ? "" : " gcd-switch--disabled"}`}
            title={disabledNote(actions.toggle) || `${actions.toggle.nextLabel} ${campaignLabel}`}>
            <input type="checkbox" role="switch" checked={enabled}
              data-testid={`card-toggle-${campaign.campaignId}`}
              aria-label={`${campaignLabel} - ${actions.toggle.nextLabel}`}
              disabled={!actions.toggle.enabled || busy || pending === "toggle"}
              onChange={(e) => setEnabled(e.target.checked)} />
            <span className="gcd-switch-track" aria-hidden="true" />
            <span className="gcd-switch-label" data-testid={`card-toggle-label-${campaign.campaignId}`}>{actions.toggle.label}</span>
          </label>
        </div>
      </header>

      {/* 2 — ACTION RAIL. Moved out of the card footer and pinned directly under the header:
          on a tall card the actions were scrolled out of reach exactly when a reader had
          finished deciding and wanted to act. Sticky inside the campaign viewport, so the
          ACTIVE campaign keeps its actions on screen while its own settings scroll past.
          Layout only — every enablement rule, disabled reason, owner gate and API call is
          the same code, unmoved. */}
      <div className="gcd-actions" data-testid={`card-footer-${campaign.campaignId}`}
        role="group" aria-label={`Actions for ${campaignLabel} — ${status.label}`}>
        {/* WHOSE actions these are. Once a rail is pinned, the header that named the campaign has
            scrolled away — six unlabelled buttons over someone else's settings is how a reader
            locks the wrong campaign. The label rides with the rail, so the answer is always on
            screen, and the next card's rail replaces it with its own name and status.
            `title` carries the untruncated text for anyone whose name is clipped. */}
        <span className="gcd-actions-id" data-testid={`rail-context-${campaign.campaignId}`}
          title={`${campaignLabel} · ${status.label}`}>
          <span className="gcd-actions-id-name">{campaignLabel}</span>
          <span className="gcd-actions-id-sep" aria-hidden="true">·</span>
          <span className={`gcd-actions-id-status gcd-actions-id-status--${status.tone}`}>{status.label}</span>
        </span>
        <button type="button" className="gcd-btn gcd-btn--primary" data-testid={`act-save-${campaign.campaignId}`}
          disabled={!actions.save.enabled || !dirty || busy || pending === "save"}
          title={disabledNote(actions.save) || (!dirty ? "No unsaved changes." : undefined)}
          onClick={saveAll}>{pending === "save" ? "Saving..." : "Save Changes"}</button>
        {/* SLICE E5 - the bail-out. Enabled ONLY while there is something to discard, so it never
            offers to undo nothing; and it touches the server not at all, because nothing has been
            sent yet. It is not gated on `locked` the way Save is: discarding your own unsaved
            edits is always safe, whatever state the campaign is in. */}
        <button type="button" className="gcd-btn" data-testid={`act-cancel-${campaign.campaignId}`}
          disabled={!dirty || busy || pending === "save"}
          title={dirty ? "Discard your unsaved changes." : "No unsaved changes."}
          onClick={cancelEdits}>Cancel</button>
        <button type="button" className="gcd-btn" data-testid={`act-approve-${campaign.campaignId}`}
          disabled={!actions.approve.enabled || busy} title={disabledNote(actions.approve) || undefined}
          onClick={() => run("approve", () => client.approve(orgId, campaign.campaignId))}>Approve</button>
        <button type="button" className="gcd-btn" data-testid={`act-lock-${campaign.campaignId}`}
          disabled={!actions.lock.enabled || busy} title={disabledNote(actions.lock) || undefined}
          onClick={() => run("lock", () => client.lock(orgId, campaign.campaignId, { lockOperationId: `lock-${campaign.campaignId}-${campaign.snapshotVersion || 0}` }))}>Lock Campaign</button>
        <button type="button" className="gcd-btn" data-testid={`act-unlock-${campaign.campaignId}`}
          disabled={!actions.unlock.enabled || busy} title={disabledNote(actions.unlock) || undefined}
          onClick={() => run("unlock", () => client.unlock(orgId, campaign.campaignId))}>Unlock</button>
        <button type="button" className="gcd-btn" data-testid={`act-schedule-${campaign.campaignId}`}
          disabled={!actions.schedule.enabled || busy} title={disabledNote(actions.schedule) || undefined}
          onClick={() => run("schedule", () => client.schedule(orgId, campaign.campaignId))}>Schedule</button>
        <button type="button" className="gcd-btn" data-testid={`act-activate-${campaign.campaignId}`}
          disabled={!actions.activate.enabled || busy} title={disabledNote(actions.activate) || undefined}
          onClick={() => run("activate", () => client.activate(orgId, campaign.campaignId))}>Activate</button>

        {/* Why the final action is unavailable — stated, not left to a tooltip alone. */}
        {!isOwner ? (
          <p className="gcd-reason" data-testid={`card-owner-note-${campaign.campaignId}`}>
            {actions.schedule.reason || actions.activate.reason}
          </p>
        ) : null}
        {dirty ? (
          <p className="gcd-dirty" data-testid={`card-dirty-${campaign.campaignId}`} role="status">
            Unsaved changes - nothing is sent until you save.
          </p>
        ) : null}
        {message ? <p className="gcd-msg" data-testid={`card-msg-${campaign.campaignId}`} role="status">{message}</p> : null}
      </div>

      {/* SLICE E5 - WHAT THIS CAMPAIGN WILL DO.
          Every line is derived from the draft in front of the reader, never written as prose, so
          it cannot drift out of step with the controls below it. Because it reads the DRAFT it
          describes what SAVING would do while there are unsaved changes - which is the question
          someone actually has at that moment. */}
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

      {/* 3 — AUDIENCE */}
      <BubbleGroup label="Audience" testId={uid("audience")}>
        {CONTACT_CATEGORIES.map((cat) => (
          <CategoryBubble
            key={cat.key} id={uid(`aud-${cat.key}`)} label={cat.label}
            count={counts[cat.key]}
            checked={draft.categories.includes(cat.key)}
            disabled={locked}
            reason={locked ? "Unlock the campaign to change its audience." : null}
            onChange={(on) => edit({
              categories: on
                ? [...draft.categories, cat.key]
                : draft.categories.filter((k) => k !== cat.key),
            })}
          />
        ))}
      </BubbleGroup>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="gcd-btn" data-testid={`card-individual-${campaign.campaignId}`}
          disabled={locked} onClick={() => onOpenIndividualPicker && onOpenIndividualPicker(campaign)}>
          Select Individual Contacts
        </button>
        {/* Counts the DRAFT, not the saved campaign: ticking a category has to visibly change
            something, or the control reads as broken while the change sits unsaved. */}
        <span className="gcd-bubble-note" data-testid={`card-audience-total-${campaign.campaignId}`}>
          {draftRefs.length} {draftRefs.length === 1 ? "contact" : "contacts"} selected
          {counts.unclassified > 0 ? ` · ${counts.unclassified} unclassified` : ""}
        </span>
      </div>

      {/* 4 — GIFT OPTION */}
      <BubbleGroup label="Gift Option" role="radiogroup" testId={uid("gift")}>
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
        <div className="gcd-fields" data-testid={`card-curated-${campaign.campaignId}`} style={{ marginTop: 10 }}>
          <div className="gcd-field">
            <label htmlFor={uid("tier")}>Spend limit <span style={{ fontWeight: 400, color: "#928ea8" }}>(private to you)</span></label>
            <select id={uid("tier")} value={draft.tierCents} disabled={locked}
              onChange={(e) => edit({ tierCents: Number(e.target.value) })} data-testid={`card-tier-${campaign.campaignId}`}>
              {/* Values are CENTS on the wire; the label is only a display. */}
              {CURATED_TIERS_CENTS.map((c) => <option key={c} value={c}>{centsToDisplay(c)}</option>)}
            </select>
          </div>
        </div>
      ) : null}

      {/* 5 — FEATURED SPREAD */}
      <BubbleGroup label="Which featured spread style do you prefer?" role="radiogroup" testId={uid("spread")}>
        {SPREAD_SOURCES.map((s) => (
          <ChoiceBubble key={s.value} id={uid(`spread-${s.value}`)} name={uid("spread-group")} value={s.value}
            label={s.label} note={s.note} checked={spreadSource === s.value} disabled={locked}
            onChange={(v) => { setSpreadSource(v); if (v === "customize") setShowSpreadEditor(true); }} />
        ))}
      </BubbleGroup>
      {showSpreadEditor ? (
        <div style={{ marginTop: 12 }} data-testid={`card-spread-editor-${campaign.campaignId}`}>
          {/* The EXISTING Team C editor and the existing featured-spread API — never a second one. */}
          <CampaignFeaturedSpreadEditor orgId={orgId} campaignId={campaign.campaignId} client={client} />
        </div>
      ) : null}

      {/* 6 — SCHEDULE */}
      <BubbleGroup label="Schedule" role="radiogroup" testId={uid("schedule")}>
        {SCHEDULE_MODES.map((m) => (
          <ChoiceBubble key={m.value} id={uid(`mode-${m.value}`)} name={uid("mode-group")} value={m.value}
            label={m.label} note={m.description} checked={draft.scheduleMode === m.value} disabled={locked}
            onChange={(v) => edit({ scheduleMode: v })} />
        ))}
      </BubbleGroup>
      <div className="gcd-fields" style={{ marginTop: 10 }}>
        {draft.scheduleMode === "campaign_date" ? (
          <div className="gcd-field">
            <label htmlFor={uid("when")}>Send date and time</label>
            <input id={uid("when")} type="datetime-local" value={draft.scheduledForLocal} disabled={locked}
              onChange={(e) => edit({ scheduledForLocal: e.target.value })} data-testid={`card-when-${campaign.campaignId}`} />
            {/* SLICE E5 - a NUDGE, not a default.
                Only offered while the field is empty, and it fills the field rather than saving
                anything - so it is one click to accept, one edit to override, and it never makes
                an untouched campaign look changed. Pre-filling would have lit up Save on every
                unconfigured campaign over a date nobody chose. */}
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
    </article>
  );
}

export { contactCategoryLabel };
