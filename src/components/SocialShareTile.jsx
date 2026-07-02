// src/components/SocialShareTile.jsx
// Social Share tile — platform buttons that request a tracked share link, open the
// platform/native share, and show ONLY honest states.
//
// HONESTY CONTRACT (load-bearing):
//   • Local facts we can observe are shown immediately:
//       - "Share started"  → we opened a platform intent / native share sheet.
//       - "Link copied"    → we wrote the link to the clipboard.
//     Opening a share sheet is NOT proof the user posted — so we never say "shared"
//     or "verified shared". We say "Share started".
//   • Backend-PROVEN states are shown ONLY from `verifiedStatus` (server truth), never
//     inferred locally:
//       - "Viewed"          ← verifiedStatus.viewed (someone opened the shared link)
//       - "Referral earned" ← verifiedStatus.referralEarned (a real conversion)
//   • There is NO "verified shared" badge anywhere. If the backend hasn't proven it,
//     it isn't shown.
//
// Tracked link: each button asks the backend for a tracked link (api.createShareLink).
// If the endpoint is absent/errors, we fall back to the raw `shareUrl` and make NO
// tracking claim — the share still works, just untracked.

import { useState, useCallback } from "react";
import api from "../api/api";
import "./SocialShareTile.css";

const enc = encodeURIComponent;

// Platforms. `mode`:
//   intent → open a web/deep-link share URL (Share started)
//   copy   → no honest web-post intent (Instagram/TikTok); copy link so the user can post (Link copied)
//   native → OS share sheet via navigator.share (Share started)
const PLATFORMS = [
  { key: "facebook", label: "Facebook", mode: "intent", brand: "#1877F2", intent: (u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
  { key: "x", label: "X", mode: "intent", brand: "#000000", intent: (u, t) => `https://twitter.com/intent/tweet?url=${enc(u)}&text=${enc(t)}` },
  { key: "linkedin", label: "LinkedIn", mode: "intent", brand: "#0A66C2", intent: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(u)}` },
  { key: "instagram", label: "Instagram", mode: "copy", brand: "#E4405F", open: "https://www.instagram.com/" },
  { key: "tiktok", label: "TikTok", mode: "copy", brand: "#010101", open: "https://www.tiktok.com/" },
  { key: "sms", label: "SMS", mode: "intent", brand: "#34C759", intent: (u, t) => `sms:?&body=${enc(`${t} ${u}`)}` },
  { key: "email", label: "Email", mode: "intent", brand: "#6B7280", intent: (u, t, s) => `mailto:?subject=${enc(s)}&body=${enc(`${t} ${u}`)}` },
  { key: "native", label: "Share…", mode: "native", brand: "#8B5CF6" },
];

/**
 * @param {object}  props
 * @param {string}  props.shareUrl        raw canonical link — the honest fallback if no tracked link (required)
 * @param {string} [props.jobId]          Greet-Me id used to mint the tracked share link (SOCIAL-A)
 * @param {string} [props.shareText]      message text accompanying the link
 * @param {string} [props.shareSubject]   email subject
 * @param {{viewed?:boolean, referralEarned?:boolean}} [props.verifiedStatus]
 *        BACKEND-PROVEN states only. Absent/false ⇒ not shown.
 * @param {(info:{platform:string, trackedUrl:string, tracked:boolean, action:string})=>void} [props.onShare]
 */
export default function SocialShareTile({
  shareUrl,
  jobId,
  shareText = "",
  shareSubject = "A little something from Greet-Me",
  verifiedStatus = {},
  onShare,
}) {
  // Local honest status: { kind: 'started'|'copied'|'error', label } — one line, live region.
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null); // platform key currently resolving

  // Mint a tracked share link (SOCIAL-A). Degrade honestly to the raw shareUrl with NO tracking
  // claim when the subsystem is dormant ({disabled}) / absent (404) / errored.
  const getTrackedUrl = useCallback(
    async (platform) => {
      const raw = { url: shareUrl, tracked: false, shareId: null };
      if (!jobId) return raw;
      try {
        const res = await api.createShareLink({ jobId, platform });
        if (res && res.ok && !res.disabled && typeof res.shareUrl === "string" && res.shareUrl) {
          return { url: res.shareUrl, tracked: true, shareId: res.shareId || null };
        }
      } catch {
        return raw; // network/4xx/5xx → untracked fallback (statement keeps catch non-empty)
      }
      return raw; // dormant {disabled} or unexpected shape → untracked fallback
    },
    [shareUrl, jobId]
  );

  const handle = useCallback(
    async (p) => {
      if (!shareUrl || busy) return;
      setBusy(p.key);
      setStatus(null);
      const { url, tracked, shareId } = await getTrackedUrl(p.key);
      let acted = false; // a real (non-aborted) share action occurred

      try {
        if (p.mode === "native") {
          if (navigator.share) {
            await navigator.share({ title: shareSubject, text: shareText, url });
            setStatus({ kind: "started", label: "Share started" });
            acted = true;
            onShare?.({ platform: p.key, trackedUrl: url, tracked, action: "started" });
          } else {
            await navigator.clipboard?.writeText(`${shareText} ${url}`.trim());
            setStatus({ kind: "copied", label: "Link copied" });
            acted = true;
            onShare?.({ platform: p.key, trackedUrl: url, tracked, action: "copied" });
          }
        } else if (p.mode === "copy") {
          // Instagram / TikTok have no honest web post intent — copy the link so the user posts.
          await navigator.clipboard?.writeText(url);
          if (p.open) window.open(p.open, "_blank", "noopener,noreferrer");
          setStatus({ kind: "copied", label: `Link copied — paste into ${p.label}` });
          acted = true;
          onShare?.({ platform: p.key, trackedUrl: url, tracked, action: "copied" });
        } else {
          // intent — open the platform/deep-link share URL.
          const target = p.intent(url, shareText, shareSubject);
          window.open(target, "_blank", "noopener,noreferrer");
          setStatus({ kind: "started", label: `Share started — ${p.label}` });
          acted = true;
          onShare?.({ platform: p.key, trackedUrl: url, tracked, action: "started" });
        }
      } catch (err) {
        // navigator.share throws on user-cancel (AbortError) — that is NOT a share.
        if (err && err.name === "AbortError") {
          setStatus(null);
        } else {
          setStatus({ kind: "error", label: "Couldn’t open share — try another option" });
        }
      } finally {
        setBusy(null);
      }

      // Record the share attempt ONLY after a real tracked share start (analytics; best-effort).
      if (acted && tracked && shareId) {
        api.recordShareAttempt({ shareId, platform: p.key }).catch(() => {});
      }
    },
    [shareUrl, shareText, shareSubject, busy, getTrackedUrl, onShare]
  );

  const disabled = !shareUrl;
  const viewed = verifiedStatus?.viewed === true;
  const referralEarned = verifiedStatus?.referralEarned === true;

  return (
    <section className="gm-sst" aria-label="Share">
      <div className="gm-sst-head">
        <h3 className="gm-sst-title">Share this</h3>
        <p className="gm-sst-sub">Send it anywhere. We only confirm views and referrals when they actually happen.</p>
      </div>

      <div className="gm-sst-grid" role="group" aria-label="Share options">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            type="button"
            className="gm-sst-btn"
            style={{ "--gm-sst-brand": p.brand }}
            onClick={() => handle(p)}
            disabled={disabled || busy === p.key}
            aria-label={`Share via ${p.label}`}
            aria-busy={busy === p.key || undefined}
          >
            <span className="gm-sst-glyph" aria-hidden="true">{p.label.charAt(0)}</span>
            <span className="gm-sst-label">{p.label}</span>
          </button>
        ))}
      </div>

      {/* Local honest status (live region). Never claims the share was completed/verified. */}
      <p className="gm-sst-status" role="status" aria-live="polite">
        {status ? status.label : " "}
      </p>

      {/* Backend-PROVEN states only. Rendered strictly from verifiedStatus. */}
      {(viewed || referralEarned) && (
        <div className="gm-sst-proven" aria-label="Confirmed by Greet-Me">
          {viewed && <span className="gm-sst-badge gm-sst-badge--viewed">👁 Viewed</span>}
          {referralEarned && <span className="gm-sst-badge gm-sst-badge--referral">🎁 Referral earned</span>}
        </div>
      )}
    </section>
  );
}
