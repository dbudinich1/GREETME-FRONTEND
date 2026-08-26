// src/corporateCampaign/CampaignFeaturedSpreadEditor.jsx
//
// TEAM C — Phase A3: Campaign Featured Spread editor (campaign-centered, never recipient-
// centered). Three enable/disable controls; Corporate Video visibly labeled unavailable.
// Capability comes from the SERVER (prop), never a self-enabling client constant: while the
// backend flag is false the parent passes capabilityEnabled=false and this renders nothing,
// so the editor entry point stays hidden/unavailable. Readiness is server-derived (prop) —
// never fabricated here.

import { useReducer } from "react";
import { featuredSpreadReducer, ACTIONS, defaultFeaturedSpreadConfig } from "./featuredSpreadModel.js";
import { readinessLabel, defaultStateNotice, availableActions, CORPORATE_VIDEO } from "./campaignEditorModel.js";

export default function CampaignFeaturedSpreadEditor({
  capabilityEnabled = false, // server-derived capability (backend flag)
  campaignName = "",
  initialConfig,
  readiness, // { featuredSpreadReadiness, approvalStatus, lockStatus, featuredSpreadPresent }
  onSaveDraft,
  onApprove,
  onLock,
  onUnlock,
  onReturn,
  // TEAM C - LAUNCH READINESS. The dashboard retired Approve / Lock / Unlock as user-facing
  // controls, but this editor has always rendered them in its footer. Embedding it inline would
  // therefore put exactly the CTAs the founder removed back onto the campaign surface.
  //
  // DEFAULT TRUE, so CampaignDetail - the only existing caller - is completely unaffected. The
  // dashboard passes false. Nothing is renamed, nothing is hidden behind another CTA, and no
  // backend permission, lifecycle guard or readiness rule changes: `availableActions` still
  // computes every capability exactly as before, and the server still enforces all of them.
  showLifecycleActions = true,
}) {
  const [config, dispatch] = useReducer(featuredSpreadReducer, initialConfig || defaultFeaturedSpreadConfig());

  // Server capability gate — hidden/unavailable while dormant.
  if (!capabilityEnabled) return null;

  const rd = readinessLabel(readiness && readiness.featuredSpreadReadiness);
  const actions = availableActions(readiness || {});
  const locked = readiness && readiness.lockStatus === "locked";
  const disabled = locked; // no editing while locked

  return (
    <section className="cfs-editor" aria-label="Campaign Featured Spread">
      <header className="cfs-editor__head">
        <h2>Campaign Featured Spread</h2>
        <p className="cfs-editor__context">Campaign: {campaignName || "—"}</p>
        <p className="cfs-editor__notice">{defaultStateNotice(config)}</p>
        <p className={`cfs-editor__status cfs-editor__status--${rd.kind}`}>{rd.label}</p>
      </header>

      <div className="cfs-editor__controls">
        {/* 1. Greet-Me Animated Message */}
        <label className="cfs-toggle">
          <input
            type="checkbox"
            checked={config.animatedMessageEnabled}
            disabled={disabled}
            onChange={() => dispatch({ type: ACTIONS.TOGGLE_ANIMATION })}
          />
          <span>Greet-Me Animated Message</span>
        </label>
        {config.animatedMessageEnabled && (
          <div className="cfs-subcontrols">
            <button type="button" disabled={disabled} onClick={() => dispatch({ type: ACTIONS.SET_ANIMATION_SOURCE, source: "organization_default" })}>
              Use Organization Default
            </button>
            <button type="button" disabled={disabled} onClick={() => dispatch({ type: ACTIONS.SET_ANIMATION_IMAGE_REF, ref: null })}>
              Restore Default
            </button>
          </div>
        )}

        {/* 2. Corporate Video — visibly unavailable/proposed (never functional) */}
        <label className="cfs-toggle cfs-toggle--unavailable">
          <input type="checkbox" checked={false} disabled aria-disabled="true" readOnly />
          <span>{CORPORATE_VIDEO.label} <em className="cfs-unavailable">{CORPORATE_VIDEO.note}</em></span>
        </label>

        {/* 3. Additional Images */}
        <label className="cfs-toggle">
          <input
            type="checkbox"
            checked={config.additionalImagesEnabled}
            disabled={disabled}
            onChange={() => dispatch({ type: ACTIONS.TOGGLE_ADDITIONAL_IMAGES })}
          />
          <span>Additional Images</span>
        </label>

        <button type="button" className="cfs-disable-featured" disabled={disabled} onClick={() => dispatch({ type: ACTIONS.RESTORE_DEFAULT })}>
          Reset Featured Spread
        </button>
      </div>

      <footer className="cfs-editor__actions">
        <button type="button" disabled={!actions.canSaveDraft} onClick={() => onSaveDraft && onSaveDraft(config)}>Save Draft</button>
        {showLifecycleActions ? (
          <>
            <button type="button" disabled={!actions.canApprove} onClick={() => onApprove && onApprove(config)}>Approve</button>
            <button type="button" disabled={!actions.canLock} onClick={() => onLock && onLock(config)}>Lock</button>
            <button type="button" disabled={!actions.canUnlock} onClick={() => onUnlock && onUnlock()}>Unlock / Edit</button>
            <button type="button" onClick={() => onReturn && onReturn()}>Return to Campaign</button>
          </>
        ) : null}
      </footer>
    </section>
  );
}
