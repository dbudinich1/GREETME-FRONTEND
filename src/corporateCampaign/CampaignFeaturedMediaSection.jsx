// src/corporateCampaign/CampaignFeaturedMediaSection.jsx
//
// LANE 3 — For Business → Campaign → Message → Featured Spread. Mounts the SHARED personalization
// controls (FeaturedMediaChooser + PreviewMyCard) for one campaign. The campaign keeps its own
// selection in its own existing storage (featuredSpreadConfig); there is no organization default.
//
// The choice is an unsaved draft until Save. Preview My Card renders that draft for one of the
// campaign's recipients and makes no request. Save goes through the existing featured-spread API
// via `onSave(body)` — only for a choice the campaign's storage can actually hold
// (see campaignFeaturedMedia.js); otherwise the reason is shown and nothing is sent.

import { useMemo, useState } from "react";
import FeaturedMediaChooser from "../components/personalization/FeaturedMediaChooser.jsx";
import PreviewMyCard from "../components/personalization/PreviewMyCard.jsx";
import { selectionKey, validateSelection, VALIDATION_TEXT } from "../components/personalization/featuredMediaModel.js";
import {
  selectionFromCampaignConfig, campaignSaveSupport, campaignFeaturedSpreadBody,
  usesRetiredOrganizationDefault, savedChoiceLabel,
} from "./campaignFeaturedMedia.js";

export default function CampaignFeaturedMediaSection({
  idPrefix,
  campaign,
  recipients = [],
  senderName = "",
  occasionKey = "general",
  locked = false,
  saving = false,
  onSave, // (body) => Promise<{ ok }>
}) {
  const config = campaign ? campaign.featuredSpreadConfig : null;
  const persisted = useMemo(() => selectionFromCampaignConfig(config), [config]);
  const persistedKey = selectionKey(persisted);
  const [selection, setSelection] = useState(persisted);
  const [syncedKey, setSyncedKey] = useState(persistedKey);
  const [status, setStatus] = useState(null);
  // Resync on VALUE when the saved campaign changes (same rule as the card's edit buffer).
  if (syncedKey !== persistedKey) {
    setSelection(persisted);
    setSyncedKey(persistedKey);
  }

  // A config still carrying the retired organization default reads as "No featured media" but the
  // server still holds the old setting, so saving that explicit choice is allowed even unchanged.
  const dirty = selectionKey(selection) !== persistedKey || usesRetiredOrganizationDefault(config);
  const support = campaignSaveSupport(selection);
  const { valid, errors } = validateSelection(selection);
  const canSave = !locked && !saving && dirty && valid && support.savable && typeof onSave === "function";
  const id = (s) => `${idPrefix}-${s}`;

  async function save() {
    if (!canSave) return;
    const built = campaignFeaturedSpreadBody(selection, config);
    if (!built.ok) { setStatus(built.reason); return; }
    setStatus(null);
    const res = await onSave(built.body);
    setStatus(res && res.ok ? "Saved." : null);
  }

  return (
    <div className="cfm-section" data-testid={id("featured-media")}>
      <p className="gcd-wcard-note" data-testid={id("featured-saved")} style={{ margin: "0 0 10px", fontSize: ".82rem" }}>
        {usesRetiredOrganizationDefault(config)
          ? "This campaign still has the earlier organization photo-and-voice setting saved. Choose its own featured media below and save."
          : <>Saved for this campaign: <strong>{savedChoiceLabel(config)}</strong>.</>}
      </p>

      <FeaturedMediaChooser idPrefix={id("fm")} selection={selection} onChange={(s) => { setStatus(null); setSelection(s); }}
        disabled={locked} />

      {locked ? <p className="gcd-reason" data-testid={id("featured-locked")}>Unlock the campaign to change its featured media.</p> : null}
      {!support.savable && support.reason ? (
        <p className="gcd-reason" role="status" data-testid={id("featured-save-reason")}>{support.reason}</p>
      ) : null}
      {support.notes.map((n) => <p key={n} className="gcd-wcard-note" style={{ fontSize: ".8rem" }} data-testid={id("featured-note")}>{n}</p>)}
      {!valid && support.savable ? (
        <p className="gcd-reason" data-testid={id("featured-invalid")}>{errors.map((e) => VALIDATION_TEXT[e] || e).join(" ")}</p>
      ) : null}

      <div className="gcd-wcard-foot" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <PreviewMyCard idPrefix={id("fm")} selection={selection} recipients={recipients}
          senderName={senderName} occasionKey={occasionKey} />
        <button type="button" className="gcd-btn" data-testid={id("featured-save")} disabled={!canSave} onClick={save}>
          {saving ? "Saving…" : "Save featured media"}
        </button>
        {status ? <span className="gcd-wcard-note" role="status" data-testid={id("featured-status")}>{status}</span> : null}
      </div>
    </div>
  );
}
