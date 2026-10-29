// src/components/personalization/PreviewMyCard.jsx
//
// LANE 3 — "Preview My Card". Renders the EXISTING card renderer (GreetingCardProto/GreetingCard)
// from the caller's CURRENT, UNSAVED selection and the selected recipient's own memory photos.
//
// Preview only: this file imports no API client and makes no request. It never sends, charges or
// orders anything, and it never creates or reads a greeting record (the greeting has no jobId).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GreetingCard } from "../GreetingCardProto";
import { buildPreviewGreeting, memoryPhotosForRecipient, selectionKey, PREVIEW_SAMPLE_INTRO } from "./featuredMediaModel";
import "./personalization.css";

export const PREVIEW_NOTICE = "Preview only. Nothing is sent, charged or ordered.";

export default function PreviewMyCard({
  idPrefix = "pm",
  selection,
  recipients = [], // [{ id, name, memoryPhotos? }] — the people this card could go to
  initialRecipientId = null,
  senderName = "",
  occasionKey = "general",
  sampleIntroText = PREVIEW_SAMPLE_INTRO,
  disabled = false,
  buttonLabel = "Preview My Card",
}) {
  const list = Array.isArray(recipients) ? recipients.filter((r) => r && r.id != null) : [];
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState(initialRecipientId);
  const id = (s) => `${idPrefix}-${s}`;
  const recipient = list.find((r) => String(r.id) === String(recipientId)) || list[0] || null;
  const memories = memoryPhotosForRecipient(recipient);
  const greeting = buildPreviewGreeting({
    selection, recipient, memoryPhotos: memories, senderName, occasionKey, writtenIntroText: sampleIntroText,
  });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const overlay = open ? (
    <div className="pm-preview-overlay" role="dialog" aria-modal="true" aria-label="Preview My Card" data-testid={id("preview")}>
      <div className="pm-preview-bar">
        <span className="pm-preview-notice" data-testid={id("preview-notice")}>{PREVIEW_NOTICE}</span>
        {list.length > 1 ? (
          <label className="pm-preview-recipient">
            <span>Recipient</span>
            <select value={recipient ? recipient.id : ""} data-testid={id("preview-recipient")}
              onChange={(e) => setRecipientId(e.target.value)}>
              {list.map((r) => <option key={r.id} value={r.id}>{r.name || "Recipient"}</option>)}
            </select>
          </label>
        ) : recipient ? <span className="pm-preview-recipient-name">For {recipient.name || "your recipient"}</span> : null}
        <button type="button" className="pm-btn pm-preview-close" data-testid={id("preview-close")} onClick={() => setOpen(false)}>
          Close preview
        </button>
      </div>
      <div className="pm-preview-stage" data-memory-count={memories.length}>
        {/* Keyed so a different recipient or choice restarts the card from its envelope. */}
        <GreetingCard key={`${recipient ? recipient.id : "none"}|${selectionKey(selection)}`} greeting={greeting} isOwner={false} />
      </div>
    </div>
  ) : null;

  return (
    <>
      <button type="button" className="pm-btn pm-btn--primary" disabled={disabled} data-testid={id("preview-open")}
        onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      {overlay && typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay}
    </>
  );
}
