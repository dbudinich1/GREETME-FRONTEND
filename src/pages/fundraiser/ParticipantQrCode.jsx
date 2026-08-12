// src/pages/fundraiser/ParticipantQrCode.jsx
//
// F1-7 — renders a SCANNABLE QR code from the participant's EXISTING server-issued qrPayload.
//
// NO NEW DATA: `payload` is the same string the Links panel already prints as text; it comes from
// GET /api/fundraiser/partner/orgs/:orgId/participants/:participantId/links. Nothing is fabricated
// client-side and no new request is made — this component only re-renders a value already in hand.
//
// SVG on screen (vector ⇒ scales to any flyer/table-tent size without resampling); the PNG export is
// raster by definition, so it is generated at a print-usable 1024px. Both are produced by the
// `qrcode` package ALREADY in dependencies (^1.5.4, used by 7 other surfaces) — no library added.
//
// The svg-tag renderer emits only geometry (a background rect + one path of module runs); the payload
// text is never interpolated into the markup, so dangerouslySetInnerHTML has no injection surface here.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { btnGhost } from "./FundraiserUI.jsx";

// ISO/IEC 18004 specifies a 4-module quiet zone. Preserved on BOTH outputs — scanners need it to
// locate the finder patterns, and a code printed without it fails at small sizes.
const QUIET_ZONE_MODULES = 4;
const SCREEN_PX = 168;
const PRINT_PX = 1024;
const COLORS = { dark: "#000000", light: "#ffffff" }; // maximum contrast; never themed

// Filenames are user-visible and land in a Downloads folder — keep them to a safe charset.
function safeFilePart(s) {
  return String(s || "participant").replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64) || "participant";
}

export default function ParticipantQrCode({ payload, referralCode }) {
  // Both pieces of state carry the payload they belong to, and both are DERIVED against the current
  // prop below. A regeneration swaps the payload while the previous render is still in state, so this
  // is what guarantees a stale code for the OLD link can never be displayed — or downloaded — under
  // the new one. It also keeps the effect free of synchronous setState.
  const [rendered, setRendered] = useState(null); // { payload, markup }
  const [failure, setFailure] = useState(null);   // { payload, message }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!payload) return undefined;
    QRCode.toString(payload, { type: "svg", margin: QUIET_ZONE_MODULES, width: SCREEN_PX, color: COLORS })
      .then((markup) => { if (active) setRendered({ payload, markup }); })
      .catch(() => { if (active) setFailure({ payload, message: "Could not render the QR code." }); });
    return () => { active = false; };
  }, [payload]);

  const svg = rendered && rendered.payload === payload ? rendered.markup : null;
  const error = failure && failure.payload === payload ? failure.message : null;

  async function downloadPng() {
    setBusy(true);
    setFailure(null);
    try {
      const dataUrl = await QRCode.toDataURL(payload, { width: PRINT_PX, margin: QUIET_ZONE_MODULES, color: COLORS });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `greet-me-qr-${safeFilePart(referralCode)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setFailure({ payload, message: "Could not prepare the PNG download." }); // truthful; nothing downloaded
    }
    setBusy(false);
  }

  if (!payload) return null;

  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      {svg ? (
        <div
          role="img"
          aria-label={`Scannable QR code for referral ${referralCode || ""}`.trim()}
          style={{ lineHeight: 0, background: "#fff", border: "1px solid #e7e0d4", borderRadius: 6, padding: 6 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null}
      <div style={{ minWidth: 200, flex: 1 }}>
        <button type="button" style={btnGhost} onClick={downloadPng} disabled={busy || !svg}>
          {busy ? "Preparing…" : "Download PNG"}
        </button>
        <p style={{ margin: "8px 0 0", color: "#8a7c6c", fontSize: 12, lineHeight: 1.5 }}>
          Regenerating this participant&rsquo;s referral link immediately invalidates any QR code already
          printed from it. Reprint flyers and table tents after a regeneration.
        </p>
        {error ? <p style={{ margin: "6px 0 0", color: "#8a3b25", fontSize: 12 }}>{error}</p> : null}
      </div>
    </div>
  );
}