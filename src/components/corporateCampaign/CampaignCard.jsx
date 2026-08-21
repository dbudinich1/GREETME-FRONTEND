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
  onExecutionDormant,
  onOpenIndividualPicker, onAfterMutate, onOpenDetail,
}) {
  const delivery = campaign.deliveryConfig || {};
  const status = deriveCampaignStatus(campaign);
  const actions = deriveActions(campaign, { isOwner, canAuthorizeRun });
  const locked = campaign.lockStatus === "locked";
  // Straight from the campaign the server just returned - deliberately NOT React state, so the
  // switch cannot drift out of step with the engine while a refetch is in flight.
  const enabled = isCampaignEnabled(campaign);

  const [categories, setCategories] = useState([]);
  const [giftType, setGiftType] = useState(delivery.defaultGift ? delivery.defaultGift.type : "none");
  const [tierCents, setTierCents] = useState(delivery.defaultGift ? delivery.defaultGift.maxSpendCents : CURATED_TIERS_CENTS[0]);
  const [spreadSource, setSpreadSource] = useState("organization_default");
  const [showSpreadEditor, setShowSpreadEditor] = useState(false);
  const [mode, setMode] = useState(delivery.scheduleMode || "campaign_date");
  const [whenUtc, setWhenUtc] = useState(delivery.scheduledForUtc ? String(delivery.scheduledForUtc).slice(0, 16) : "");
  const [occasionType, setOccasionType] = useState(delivery.occasionType || OCCASION_TYPES[0]);
  const [timeZone, setTimeZone] = useState(delivery.timeZone || TIME_ZONES[0]);
  const [message, setMessage] = useState(null);
  const [pending, setPending] = useState(null);

  const audienceRefs = Array.isArray(campaign.audienceRefs) ? campaign.audienceRefs : [];
  const counts = useMemo(() => selectedCountsByCategory(contacts, audienceRefs), [contacts, audienceRefs]);

  // One source for the displayed name, shared by the header and the rail so they can never drift.
  const campaignLabel = campaign.name || "Untitled campaign";
  const uid = (s) => `c-${campaign.campaignId}-${s}`;
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

  async function saveDelivery() {
    const body = buildDeliveryConfigBody({
      scheduleMode: mode,
      scheduledForUtc: whenUtc ? new Date(whenUtc).toISOString() : null,
      occasionType, timeZone, giftType, curatedTierCents: tierCents,
    });
    await run("save", () => client.updateDeliveryConfig(orgId, campaign.campaignId, body));
  }

  async function applyCategories(nextKeys) {
    setCategories(nextKeys);
    const refs = resolveAudienceRefs({ contacts, selectedCategories: nextKeys, individuallySelected: audienceRefs });
    await run("audience", () => client.setAudience(orgId, campaign.campaignId, refs));
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
          disabled={!actions.save.enabled || busy || pending === "save"} title={disabledNote(actions.save) || undefined}
          onClick={saveDelivery}>Save Changes</button>
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
        {message ? <p className="gcd-msg" data-testid={`card-msg-${campaign.campaignId}`} role="status">{message}</p> : null}
      </div>

      {/* 3 — AUDIENCE */}
      <BubbleGroup label="Audience" testId={uid("audience")}>
        {CONTACT_CATEGORIES.map((cat) => (
          <CategoryBubble
            key={cat.key} id={uid(`aud-${cat.key}`)} label={cat.label}
            count={counts[cat.key]}
            checked={categories.includes(cat.key)}
            disabled={locked}
            reason={locked ? "Unlock the campaign to change its audience." : null}
            onChange={(on) => applyCategories(on ? [...categories, cat.key] : categories.filter((k) => k !== cat.key))}
          />
        ))}
      </BubbleGroup>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="gcd-btn" data-testid={`card-individual-${campaign.campaignId}`}
          disabled={locked} onClick={() => onOpenIndividualPicker && onOpenIndividualPicker(campaign)}>
          Select Individual Contacts
        </button>
        <span className="gcd-bubble-note" data-testid={`card-audience-total-${campaign.campaignId}`}>
          {audienceRefs.length} {audienceRefs.length === 1 ? "contact" : "contacts"} selected
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
              checked={giftType === opt.value}
              disabled={!state.selectable || locked}
              onChange={setGiftType}
            />
          );
        })}
      </BubbleGroup>
      {giftType === "curated" ? (
        <div className="gcd-fields" data-testid={`card-curated-${campaign.campaignId}`} style={{ marginTop: 10 }}>
          <div className="gcd-field">
            <label htmlFor={uid("tier")}>Spend limit <span style={{ fontWeight: 400, color: "#928ea8" }}>(private to you)</span></label>
            <select id={uid("tier")} value={tierCents} disabled={locked}
              onChange={(e) => setTierCents(Number(e.target.value))} data-testid={`card-tier-${campaign.campaignId}`}>
              {/* Values are CENTS on the wire; the label is only a display. */}
              {CURATED_TIERS_CENTS.map((c) => <option key={c} value={c}>{centsToDisplay(c)}</option>)}
            </select>
          </div>
        </div>
      ) : null}

      {/* 5 — FEATURED SPREAD */}
      <BubbleGroup label="Featured Spread" role="radiogroup" testId={uid("spread")}>
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
            label={m.label} note={m.description} checked={mode === m.value} disabled={locked}
            onChange={setMode} />
        ))}
      </BubbleGroup>
      <div className="gcd-fields" style={{ marginTop: 10 }}>
        {mode === "campaign_date" ? (
          <div className="gcd-field">
            <label htmlFor={uid("when")}>Send date and time</label>
            <input id={uid("when")} type="datetime-local" value={whenUtc} disabled={locked}
              onChange={(e) => setWhenUtc(e.target.value)} data-testid={`card-when-${campaign.campaignId}`} />
          </div>
        ) : (
          <div className="gcd-field">
            <label htmlFor={uid("occasion")}>Occasion</label>
            <select id={uid("occasion")} value={occasionType} disabled={locked}
              onChange={(e) => setOccasionType(e.target.value)} data-testid={`card-occasion-${campaign.campaignId}`}>
              {OCCASION_TYPES.map((o) => <option key={o} value={o}>{o.replace(/-/g, " ")}</option>)}
            </select>
          </div>
        )}
        <div className="gcd-field">
          <label htmlFor={uid("tz")}>Time zone</label>
          <select id={uid("tz")} value={timeZone} disabled={locked}
            onChange={(e) => setTimeZone(e.target.value)} data-testid={`card-tz-${campaign.campaignId}`}>
            {TIME_ZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </div>
    </article>
  );
}

export { contactCategoryLabel };
