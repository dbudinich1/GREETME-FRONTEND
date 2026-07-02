// src/components/ShareTheLovePanel.jsx
// "Share the Love" — ONE canonical Social Circuit share panel, two honest modalities.
//
//   Mode A — Invite by email: reuses the EXISTING reward path (POST /api/events/share-reward
//            to mint the courtesy credit, then POST /api/events/share-invite to send the email
//            — the server fires share_act +10 and mints the $5 credit). No new endpoint, no new
//            reward behavior.
//   Mode B — Broadcast share: reuses the EXISTING <SocialShareTile> (SOCIAL-A tracked link +
//            honest states). Attribution only — no second reward.
//
// HONEST STATES ONLY: "Share started" / "Link copied" (local facts, via the tile); "Invite sent"
// (Mode A local fact). "Viewed" / "Referral earned" render ONLY from backend-proven `verifiedStatus`.
// There is NO "verified shared" anywhere. No fabricated verification.
//
// Mode A requires a jobId (the greeting the credit attaches to) AND an authed user (the two
// endpoints are requireAuth). When no jobId is available, only Mode B is offered.

import { useState, useCallback } from "react";
import api from "../api/api";
import SocialShareTile from "./SocialShareTile";
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
        // 1) mint (or reuse) the courtesy credit for this greeting — EXISTING endpoint.
        const reward = await api.request("/api/events/share-reward", {
          method: "POST",
          body: JSON.stringify({ sourceJobId: jobId }),
        });
        const creditCode = reward?.creditCode || null;
        if (!creditCode) {
          setInviteState("error");
          return;
        }
        // 2) send the invite email — EXISTING endpoint (server fires share_act + stamps credit).
        const result = await api.request("/api/events/share-invite", {
          method: "POST",
          body: JSON.stringify({
            sourceJobId: jobId,
            recipientName: name.trim(),
            recipientEmail: email.trim().toLowerCase(),
            creditCode,
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
              Invite sent — a $5 credit will be waiting for them at checkout.
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
