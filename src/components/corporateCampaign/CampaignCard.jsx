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
  resolveAudienceRefs,
  selectedCountsByCategory,
  contactCategoryLabel,
  buildDeliveryConfigBody,
} from "./corporateDashboardModel.js";
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
  onOpenIndividualPicker, onAfterMutate, onOpenDetail,
}) {
  const delivery = campaign.deliveryConfig || {};
  const status = deriveCampaignStatus(campaign);
  const actions = deriveActions(campaign, { isOwner });
  const locked = campaign.lockStatus === "locked";

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

  const uid = (s) => `c-${campaign.campaignId}-${s}`;
  const run = async (key, fn) => {
    setMessage(null); setPending(key);
    try {
      const res = await fn();
      // Never claim success before the API confirms it.
      if (!res || res.ok !== true) {
        setMessage((res && (res.error || (res.dormant && "This feature isn’t active yet.") || (res.unauthorized && "You don’t have access to this action."))) || "That didn’t go through. Please try again.");
        return null;
      }
      if (onAfterMutate) await onAfterMutate();
      return res;
    } finally { setPending(null); }
  };

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
              {campaign.name || "Untitled campaign"}
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
          <button type="button" className="gcd-btn gcd-btn--quiet" data-testid={`card-review-${campaign.campaignId}`}
            onClick={() => (onOpenDetail ? onOpenDetail(campaign.campaignId) : setShowSpreadEditor((v) => !v))}>Review</button>
        </div>
      </header>

      {/* 2 — AUDIENCE */}
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

      {/* 3 — GIFT OPTION */}
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

      {/* 4 — FEATURED SPREAD */}
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

      {/* 5 — SCHEDULE */}
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
      {/* 6 — ACTION FOOTER: every action always present. */}
      <div className="gcd-footer" data-testid={`card-footer-${campaign.campaignId}`}>
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
    </article>
  );
}

export { contactCategoryLabel };
