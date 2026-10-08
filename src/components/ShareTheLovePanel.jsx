// src/components/ShareTheLovePanel.jsx
// "Share the Love" — ONE canonical Social Circuit share panel, two honest modalities.
//
//   Mode A — Invite by email: reuses the EXISTING reward path (POST /api/events/share-reward,
//            then POST /api/events/share-invite to send the email — the server fires share_act
//            and, for a gift-attached original greeting only, the separate QR-Cash-match/
//            credit_double referral reward). No new endpoint.
//   Mode B — Broadcast share: reuses the EXISTING <SocialShareTile> (SOCIAL-A tracked link +
//            honest states). Attribution only — no second reward.
//
// CREDIT CONTRACT INTEGRITY (2026-09-29, founder rule 4 — sharing a Greet-Me must not create a
// separate/additional $5 Greet-Me Credit): Mode A no longer mints or promises a $5 credit to the
// invitee. /api/events/share-reward no longer returns a creditCode, and /api/events/share-invite
// no longer requires or accepts one — see routes/eventRoutes.js for the removed mint. The
// original gift-free-delivery credit (the one the RECIPIENT of the shared Greet-Me already
// earned, if eligible) is completely unaffected by any of this.
//
// HONEST STATES ONLY: "Share started" / "Link copied" (local facts, via the tile); "Invite sent"
// (Mode A local fact). "Viewed" / "Referral earned" render ONLY from backend-proven `verifiedStatus`.
// There is NO "verified shared" anywhere. No fabricated verification.
//
// Mode A requires a jobId (the greeting being shared) AND an authed user (the two endpoints are
// requireAuth). When no jobId is available, only Mode B is offered.

import { useState, useCallback } from "react";
import api from "../api/api";
import SocialShareTile from "./SocialShareTile";
import { SHARE_HEARTS_REWARD_LIVE } from "./hub/hubConfig";
import "./ShareTheLovePanel.css";

/**
 * @param {object}  props
 * @param {string} [props.jobId]         greeting id → enables Mode A (email invite) + the tracked link
 * @param {string}  props.shareUrl       raw fallback link for Mode B (required for broadcast)
 * @param {string} [props.shareText]
 * @param {string} [props.shareSubject]
 * @param {{viewed?:boolean, referralEarned?:boolean}} [props.verifiedStatus]  BACKEND-PROVEN only
 * @param {"invite"|"broadcast"} [props.defaultMode]
 * @param {string} [props.heading]
 * @param {()=>void} [props.onInviteSent]  fired after a successful email invite
 */
export default function ShareTheLovePanel({
  jobId,
  shareUrl,
  shareText = "I just shared a little love with Greet-Me — come see.",
  shareSubject = "A little something from Greet-Me",
  verifiedStatus = {},
  defaultMode = "broadcast",
  heading = "Share the Love",
  onInviteSent,
}) {
  const canInvite = !!jobId; // Mode A is tied to a greeting + an authed sender
  const [mode, setMode] = useState(canInvite ? defaultMode : "broadcast");

  // Mode A state (email invite) — mirrors the existing ThankYouFlow share reward path.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteState, setInviteState] = useState(null); // null | 'sending' | 'sent' | 'error'
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleEmailInvite = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (!jobId || !name.trim() || !emailValid || inviteState === "sending") return;
      setInviteState("sending");
      try {
        // 1) fire the share-act/reward hook for this greeting — EXISTING endpoint. No credit
        // code is minted or returned here anymore (founder rule 4) — this step only records the
        // share and applies the SEPARATE, gift-attached-only referral reward, if any.
        const reward = await api.request("/api/events/share-reward", {
          method: "POST",
          body: JSON.stringify({ sourceJobId: jobId }),
        });
        if (!reward?.ok) {
          setInviteState("error");
          return;
        }
        // 2) send the invite email — EXISTING endpoint (server fires share_act). No credit is
        // promised to the invitee.
        const result = await api.request("/api/events/share-invite", {
          method: "POST",
          body: JSON.stringify({
            sourceJobId: jobId,
            recipientName: name.trim(),
            recipientEmail: email.trim().toLowerCase(),
          }),
        });
        if (result && result.ok) {
          setInviteState("sent");
          onInviteSent?.();
        } else {
          setInviteState("error");
        }
      } catch {
        setInviteState("error");
      }
    },
    [jobId, name, email, emailValid, inviteState, onInviteSent]
  );

  return (
    <section className="gm-stl" aria-label={heading}>
      <div className="gm-stl-head">
        <h3 className="gm-stl-title">{heading}</h3>
      </div>
      {/* W16 — honest award copy: the email invite (share_act) earns 50 Hearts, capped at 3 a week
          server-side; social/platform-share rewards are dormant, so never imply Hearts for those. */}
      {!SHARE_HEARTS_REWARD_LIVE && (
        <p className="gm-stl-dormant" data-testid="share-reward-dormant" style={{ fontSize: "0.8125rem", margin: "0 0 0.75rem", opacity: 0.8 }}>
          {canInvite
            ? "Invite friends by email to earn 50 Hearts per invite, up to 3 invites a week. Sharing on social media doesn’t earn Hearts."
            : "Sharing on social media doesn’t earn Hearts."}{" "}
          We’ll only show “Viewed” or “Referral earned” once Greet-Me has confirmed it.
        </p>
      )}

      {canInvite && (
        <div className="gm-stl-tabs" role="tablist" aria-label="Share options">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "invite"}
            className={`gm-stl-tab ${mode === "invite" ? "is-active" : ""}`}
            onClick={() => setMode("invite")}
          >
            Invite by email
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "broadcast"}
            className={`gm-stl-tab ${mode === "broadcast" ? "is-active" : ""}`}
            onClick={() => setMode("broadcast")}
          >
            Share to platforms
          </button>
        </div>
      )}

      {mode === "invite" && canInvite ? (
        <form className="gm-stl-invite" onSubmit={handleEmailInvite}>
          {inviteState === "sent" ? (
            <p className="gm-stl-sent" role="status">
              Invite sent — they'll be able to view your Greet-Me.
            </p>
          ) : (
            <>
              <label className="gm-stl-field">
                <span>Their name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Smith" autoComplete="name" />
              </label>
              <label className="gm-stl-field">
                <span>Their email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jamie@example.com" autoComplete="email" />
              </label>
              <button type="submit" className="gm-stl-send" disabled={inviteState === "sending" || !name.trim() || !emailValid}>
                {inviteState === "sending" ? "Sending…" : "Send invite"}
              </button>
              {inviteState === "error" && <p className="gm-stl-err" role="status">Couldn’t send just now — try again.</p>}
            </>
          )}
        </form>
      ) : (
        <SocialShareTile
          jobId={jobId}
          shareUrl={shareUrl}
          shareText={shareText}
          shareSubject={shareSubject}
          verifiedStatus={verifiedStatus}
        />
      )}
    </section>
  );
}
