// src/pages/fundraiser/PartnerFundraisingDashboard.jsx
//
// Partner Administrator fundraising dashboard — the APPROVED rev 6 layout (Report 77 rev 6, Report 87
// A7). Scoped to :organizationId; the backend enforces requirePartnerAdminFor server-side (cross-org ⇒
// 403). The partner administrator creates and runs campaigns inside its own organization; participants
// and their links/QR codes live inside each campaign, so a campaign ID is never typed. The partner's
// own agreement is one understated, read-only line. Participants are records (no participant login).
// No payout control exists here. Dark while the fundraiser gate is off (no request is made).
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fundraiserApi, stateFor } from "../../api/fundraiserApi.js";
import { isFundraiserUiEnabled } from "../../config/fundraiserGate.js";
import { pageWrap, box, h, btn, btnGhost, Stat, StateView, Empty } from "./FundraiserUI.jsx";
import ParticipantQrCode from "./ParticipantQrCode.jsx"; // F1-7 — scannable QR from the server payload
import Chip from "./FundraiserChip.jsx";
import { money, termsLine, partnerTermsRules, failureText } from "./fundraiserP1Model.js";

const input = { padding: 8, borderRadius: 6, border: "1px solid #d8cdbb", font: "inherit", boxSizing: "border-box" };
const label = { display: "block", fontSize: ".85rem", fontWeight: 700, margin: "0 0 4px" };
const help = { fontSize: ".8rem", color: "#5b4f42", margin: "4px 0 0" };
const muted = { color: "#8a7c6c", fontSize: 13 };
const err = { color: "#b00", fontSize: ".8rem", margin: "4px 0 0" };
const errBox = { margin: "0 0 12px", padding: "8px 12px", borderRadius: 6, background: "#fbeeea", border: "1px solid #e3b7a6", color: "#8a3b25", fontSize: 13 };
const n = (v) => (typeof v === "number" ? v : 0);
const live = (rows) => (Array.isArray(rows) ? rows.filter((r) => r && r.status !== "removed") : []);

function NewCampaign({ organizationId, onCreated, onCancel }) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [e, setE] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (ev) => {
    ev.preventDefault();
    if (busy) return;
    const g = goal.trim().replace(/[$,\s]/g, "");
    const x = {};
    if (!title.trim()) x.title = "Enter a campaign name.";
    if (g && !/^\d{1,9}(\.\d{1,2})?$/.test(g)) x.goal = "Enter a dollar amount, like 2500, or leave it blank.";
    setE(x);
    if (Object.keys(x).length) return;
    const body = { title: title.trim() };
    if (g) body.goalCents = Math.round(Number(g) * 100);
    setBusy(true);
    const r = await fundraiserApi.partner.createCampaign(organizationId, body);
    setBusy(false);
    if (stateFor(r) !== "ok") { setE({ submit: failureText(r) }); return; }
    // ADDENDUM 1 / N4: the server always returns { campaign, termsIssue }; only termsIssue.issued === false
    // means the campaign was created without terms.
    onCreated(body.title, !!(r.data && r.data.termsIssue && r.data.termsIssue.issued === false));
  };
  return (
    <form onSubmit={submit} noValidate data-testid="new-campaign" style={{ border: "1px solid #e6e2da", borderRadius: 8, padding: 14, maxWidth: 520, marginTop: 10 }}>
      <label htmlFor="nc-title" style={label}>Campaign name</label>
      <input id="nc-title" data-testid="nc-title" value={title} autoFocus onChange={(ev) => { setTitle(ev.target.value); setE({ ...e, title: undefined, submit: undefined }); }} placeholder="For example, Fall 2026 Drive" style={{ ...input, width: "100%" }} />
      {e.title ? <p style={err}>{e.title}</p> : null}
      <label htmlFor="nc-goal" style={{ ...label, marginTop: 12 }}>Fundraising goal (optional)</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span>$</span>
        <input id="nc-goal" data-testid="nc-goal" value={goal} inputMode="decimal" onChange={(ev) => { setGoal(ev.target.value); setE({ ...e, goal: undefined, submit: undefined }); }} placeholder="2500" style={{ ...input, width: 160 }} />
      </div>
      {e.goal ? <p style={err}>{e.goal}</p> : null}
      <p style={help}>A target your participants can work toward. It doesn’t change your share.</p>
      <p style={{ ...help, margin: "10px 0 12px" }}>The campaign starts as a draft. Add participants, then start it when you’re ready.</p>
      {e.submit ? <p data-testid="nc-error" role="status" style={{ ...err, marginBottom: 8 }}>{e.submit}</p> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" style={btn} data-testid="nc-submit" disabled={busy}>{busy ? "Creating…" : "Create campaign"}</button>
        <button type="button" style={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

const ACTIONS = {
  draft: [["active", "Start campaign"]],
  active: [["paused", "Pause"], ["closed", "Close campaign"]],
  paused: [["active", "Resume"], ["closed", "Close campaign"]],
  closed: [],
};

function CampaignPage({ organizationId, campaign: c, onBack, onChanged }) {
  const [data, setData] = useState({ loading: true });
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");
  const [qrFor, setQrFor] = useState(null);
  const [links, setLinks] = useState({});
  const [confirmClose, setConfirmClose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const [nonce, setNonce] = useState(0);
  const load = useCallback(async () => { setNonce((x) => x + 1); }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      const o = await fundraiserApi.partner.overview(organizationId, c.campaignId);
      if (!alive) return;
      if (stateFor(o) !== "ok" || !o.data) { setData({ error: true }); return; }
      setData({ totals: o.data.totals || {}, participants: live(o.data.participants) });
    })();
    return () => { alive = false; };
  }, [organizationId, c.campaignId, nonce]);

  async function status(to) {
    setBusy(true); setActionError(null);
    const r = await fundraiserApi.partner.setCampaignStatus(organizationId, c.campaignId, to);
    setBusy(false); setConfirmClose(false);
    if (stateFor(r) !== "ok") { setActionError(failureText(r)); return; }
    await onChanged();
  }
  async function add(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true); setActionError(null);
    const r = await fundraiserApi.partner.createParticipant(organizationId, { campaignId: c.campaignId, displayName: name.trim() });
    setBusy(false);
    if (!r.ok) { setActionError(`Add failed (${r.status || "network error"}). No participant was added.`); return; } // H9
    setName(""); await load();
  }
  async function doImport(e) {
    e.preventDefault();
    const rows = bulk.split("\n").map((s) => s.trim()).filter(Boolean).map((displayName) => ({ displayName }));
    if (rows.length === 0) { setActionError("Paste at least one participant name (one per line)."); return; }
    setBusy(true); setActionError(null);
    const r = await fundraiserApi.partner.importRoster(organizationId, { campaignId: c.campaignId, rows });
    setBusy(false);
    if (!r.ok) { setActionError(`Import failed (${r.status || "network error"}). No participants were added.`); return; } // H9
    setBulk(""); await load();
  }
  async function toggleLinks(pid) {
    if (qrFor === pid) { setQrFor(null); return; }
    setActionError(null);
    if (!links[pid]) {
      const r = await fundraiserApi.partner.participantLinks(organizationId, pid);
      if (!r.ok || !r.data) { setActionError(`Could not retrieve links (${r.status || "network error"}).`); return; } // H9
      setLinks((m) => ({ ...m, [pid]: r.data }));
    }
    setQrFor(pid);
  }
  // Destructive + irreversible: revokes the old token, so any printed QR or shared link stops working.
  async function regenerate(pid, who) {
    setActionError(null);
    if (!window.confirm(`Regenerate the referral token for "${who}"?\n\nThis invalidates the current link immediately. Any printed QR code or already-shared link will STOP working. This cannot be undone.`)) return;
    setBusy(true);
    const r = await fundraiserApi.partner.regenerate(organizationId, pid, "compromised");
    setBusy(false);
    if (!r.ok) { setActionError(`Token regeneration failed (${r.status || "network error"}). The existing link is unchanged.`); return; } // H9
    setLinks((m) => { const x = { ...m }; delete x[pid]; return x; }); setQrFor(null); await load();
  }
  async function remove(pid, who) {
    setActionError(null);
    if (!window.confirm(`Remove "${who}" from the roster?\n\nThey will no longer appear here. Historical attribution is preserved server-side.`)) return;
    setBusy(true);
    const r = await fundraiserApi.partner.deactivateParticipant(organizationId, pid);
    setBusy(false);
    if (!r.ok) { setActionError(`Remove failed (${r.status || "network error"}). The participant is unchanged.`); return; } // H9
    setQrFor(null); await load();
  }

  const actions = ACTIONS[c.status] || [];
  const people = data.participants || [];
  const t = data.totals || {};
  const open = qrFor ? people.find((m) => m.participantId === qrFor) : null;
  const link = qrFor ? links[qrFor] : null;
  return (
    <>
      <button type="button" style={btnGhost} onClick={onBack} data-testid="back-campaigns">← All campaigns</button>
      <div style={box} data-testid="campaign-page">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ ...h, margin: 0 }}>{c.title || c.campaignId}</h2><Chip s={c.status} />
        </div>
        <p style={muted}>Goal: {typeof c.goalCents === "number" && c.goalCents > 0 ? money(c.goalCents) : "none set"}</p>
        {data.error ? <p style={err}>This information couldn’t be loaded.</p> : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Stat label="Participants" value={people.length} /><Stat label="Visits" value={n(t.visits)} /><Stat label="Scans" value={n(t.scans)} /><Stat label="Supporters" value={n(t.conversions)} />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {actions.map(([to, text]) => (
            to === "closed"
              ? <button key={to} type="button" style={{ ...btnGhost, color: "#8a3b25", borderColor: "#8a3b25" }} data-testid="status-close" disabled={busy} onClick={() => setConfirmClose(true)}>{text}</button>
              : <button key={to} type="button" style={btn} data-testid={`status-${to}`} disabled={busy} onClick={() => status(to)}>{text}</button>
          ))}
        </div>
        {c.status === "draft" ? <p style={help}>Starting the campaign makes its participant links count toward your share. It can start once your partnership is active.</p> : null}
        {c.status === "closed" ? <p style={help}>This campaign is closed. Its links no longer bring in new supporters; supporters who already joined keep counting while your partnership is active.</p> : null}
        {confirmClose ? (
          <div role="dialog" aria-label="Close campaign" data-testid="close-confirm" style={{ marginTop: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10 }}>
            <p style={{ margin: "0 0 8px" }}>Close {c.title || c.campaignId}? A closed campaign can’t be reopened, and its links stop bringing in new supporters. Supporters who already joined keep counting while your partnership is active.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={{ ...btn, background: "#8a3b25" }} data-testid="close-yes" disabled={busy} onClick={() => status("closed")}>Close campaign</button>
              <button type="button" style={btnGhost} onClick={() => setConfirmClose(false)}>Keep it open</button>
            </div>
          </div>
        ) : null}
        {actionError ? <p data-testid="campaign-error" role="status" style={{ ...errBox, marginTop: 10 }}>{actionError}</p> : null}
      </div>

      <div style={box} data-testid="participants-box">
        <h3 style={{ ...h, fontSize: 17 }}>Participants</h3>
        {c.status !== "closed" ? (
          <>
            <form onSubmit={add} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <input aria-label="Participant name" data-testid="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Participant name" style={{ ...input, flex: "1 1 200px" }} />
              <button type="submit" style={btn} data-testid="p-add" disabled={busy || !name.trim()}>Add participant</button>
            </form>
            <form onSubmit={doImport} style={{ marginBottom: 12 }}>
              <label htmlFor="p-bulk" style={{ ...label, fontWeight: 400, color: "#8a7c6c" }}>Or paste several names, one per line</label>
              <textarea id="p-bulk" data-testid="p-bulk" value={bulk} onChange={(e) => setBulk(e.target.value)} rows={3} style={{ ...input, width: "100%" }} />
              <button type="submit" style={{ ...btnGhost, marginTop: 6 }} data-testid="p-import" disabled={busy}>Import names</button>
            </form>
          </>
        ) : null}
        {data.loading ? <StateView state="loading" /> : data.error ? <p style={err}>This information couldn’t be loaded.</p> : people.length === 0 ? <Empty>No participants yet.</Empty> : (
          <ul data-testid="participants" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {people.map((m) => (
              <li key={m.participantId || m.attributionId} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f0ebe3", padding: "8px 0" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{m.displayName || m.attributionId}</div>
                  <div style={muted}>{n(m.visits)} visits · {n(m.scans)} scans · {n(m.conversions)} supporters</div>
                </div>
                <button type="button" style={btnGhost} data-testid={`qr-${m.participantId}`} onClick={() => toggleLinks(m.participantId)}>{qrFor === m.participantId ? "Hide QR" : "Link and QR"}</button>
              </li>
            ))}
          </ul>
        )}
        {open && link ? (
          <div style={{ marginTop: 10 }} data-testid="participant-link">
            <p style={muted}>Link: <a href={link.referralLink} target="_blank" rel="noreferrer">{link.referralLink}</a></p>
            <ParticipantQrCode payload={link.qrPayload} referralCode={link.referralCode} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button type="button" style={btnGhost} disabled={busy} onClick={() => regenerate(open.participantId, open.displayName || open.attributionId)}>Regenerate</button>
              <button type="button" style={{ ...btnGhost, color: "#8a3b25", borderColor: "#8a3b25" }} disabled={busy} onClick={() => remove(open.participantId, open.displayName || open.attributionId)}>Remove</button>
            </div>
          </div>
        ) : null}
        <p style={{ ...help, marginTop: 10 }}>Participants are records managed here — they have no login or dashboard.</p>
      </div>
    </>
  );
}

// C6 — the partner's own agreement, read-only and understated: one small line, details on request.
function AgreementLine({ terms, orgName, orgStatus }) {
  const [open, setOpen] = useState(false);
  const rules = partnerTermsRules(terms);
  const row = (a, b) => <tr key={a}><td style={{ padding: "3px 12px 3px 0", color: "#8a7c6c" }}>{a}</td><td style={{ padding: "3px 0" }}>{b}</td></tr>;
  if (terms === undefined) return null;
  return (
    <div data-testid="agreement" style={{ marginTop: 10, fontSize: 13, color: "#5b4f42" }}>
      {rules ? <>Your agreement: {termsLine(rules)} of qualifying purchases from supporters who join through your links.{" "}</>
        : <>Your agreement: your partner share hasn’t been set yet. Greet-Me sets it with you.{" "}</>}
      <button type="button" data-testid="agreement-toggle" aria-expanded={open} onClick={() => setOpen(!open)}
        style={{ background: "none", border: 0, padding: 0, color: "#6b3a2a", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>
        {open ? "Hide details" : "Details"}
      </button>
      {open ? (
        <div data-testid="agreement-details" style={{ marginTop: 8, background: "#faf7f2", border: "1px solid #e6e2da", borderRadius: 8, padding: "8px 10px" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 13 }}><tbody>
            {row("Organization", orgName)}
            {row("Status", orgStatus === "approved" ? "Active" : String(orgStatus || "—"))}
            {row("Your share", rules ? termsLine(rules) : "Not set yet")}
          </tbody></table>
          <p style={{ margin: "6px 0 0" }}>Each supporter’s Year 1 starts with their first qualifying purchase through your links and lasts 12 months; Year 3+ continues while your partnership is active. To change anything in your agreement, contact Greet-Me.</p>
        </div>
      ) : null}
    </div>
  );
}

export default function PartnerFundraisingDashboard() {
  const { organizationId } = useParams();
  const [state, setState] = useState("loading");
  const [ov, setOv] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsError, setCampaignsError] = useState(false);
  const [counts, setCounts] = useState({});
  const [terms, setTerms] = useState(undefined);
  const [org, setOrg] = useState(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!isFundraiserUiEnabled()) { setState("dormant"); return; } // gate OFF ⇒ no API request
    if (!organizationId) { setState("forbidden"); return; }
    const o = await fundraiserApi.partner.overview(organizationId);
    const s = stateFor(o);
    if (s !== "ok") { setState(s); return; }
    if (!o.data || !o.data.dashboard) { setState("error"); return; } // fail closed on malformed
    setOv(o.data);
    setState("ok");
    const [c, t, mine] = await Promise.all([
      fundraiserApi.partner.campaigns(organizationId),
      fundraiserApi.partner.terms(organizationId),
      fundraiserApi.partner.myOrganizations(),
    ]);
    const list = stateFor(c) === "ok" && Array.isArray(c.data) ? c.data : null;
    setCampaignsError(list === null);
    setCampaigns(list || []);
    setTerms(stateFor(t) === "ok" && t.data ? (t.data.terms ?? null) : undefined);
    const mineList = stateFor(mine) === "ok" && mine.data && Array.isArray(mine.data.organizations) ? mine.data.organizations : [];
    setOrg(mineList.find((x) => x && x.organizationId === organizationId) || null);
    // Per-campaign counts, each recomputed by the server for that campaign (never summed client-side).
    const per = await Promise.all((list || []).map(async (x) => {
      const r = await fundraiserApi.partner.overview(organizationId, x.campaignId);
      return [x.campaignId, stateFor(r) === "ok" && r.data ? { participants: live(r.data.participants).length, supporters: n(r.data.totals && r.data.totals.conversions) } : null];
    }));
    setCounts(Object.fromEntries(per));
  }, [organizationId]);
  useEffect(() => { load(); }, [load]);

  if (!isFundraiserUiEnabled()) return <StateView state="dormant" />;
  if (state !== "ok") return <div style={pageWrap}><h1 style={h}>Fundraising — Partner</h1><StateView state={state} onRetry={load} /></div>;

  const orgName = (org && org.name) || "Your organization";
  const open = campaigns.find((c) => c.campaignId === openId) || null;
  const rows = live(ov.participants);
  return (
    <div style={pageWrap} data-testid="partner-fundraising">
      <h1 style={h}>{orgName}</h1>
      <p style={{ ...muted, marginTop: -6 }}>Fundraising · Partner administrator</p>
      {open ? <CampaignPage key={`${open.campaignId}:${open.status}`} organizationId={organizationId} campaign={open} onBack={() => setOpenId(null)} onChanged={load} /> : (
        <>
          <div style={box}>
            <h2 style={h}>Your fundraising</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Stat label="Active campaigns" value={campaigns.filter((c) => c.status === "active").length} />
              <Stat label="Participants" value={rows.length} />
              <Stat label="Supporters" value={n(ov.totals && ov.totals.conversions)} />
            </div>
            <AgreementLine terms={terms} orgName={orgName} orgStatus={org ? org.status : ov.organizationStatus} />
          </div>

          <div style={box} data-testid="partner-campaigns">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <h2 style={{ ...h, margin: 0 }}>Campaigns</h2>
              {!creating ? <button type="button" style={btn} data-testid="new-campaign-btn" onClick={() => { setCreating(true); setNotice(null); }}>New campaign</button> : null}
            </div>
            {notice ? <p role="status" data-testid="created" style={{ color: "#166534", background: "#ecfdf3", border: "1px solid #bbf7d0", borderRadius: 6, padding: "6px 10px", fontSize: 13.5 }}>{notice}</p> : null}
            {creating ? <NewCampaign organizationId={organizationId} onCancel={() => setCreating(false)}
              onCreated={async (title, termsIssue) => { setCreating(false); setNotice(`“${title}” was created as a draft.${termsIssue ? " It can’t start until your partner share is in place; contact Greet-Me." : ""}`); await load(); }} /> : null}
            {campaignsError ? <p style={err}>This information couldn’t be loaded.</p> : campaigns.length === 0 ? <Empty>No campaigns yet.</Empty> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10, marginTop: 12 }}>
                {campaigns.map((c) => {
                  const k = counts[c.campaignId];
                  return (
                    <div key={c.campaignId} style={{ border: "1px solid #e6e2da", borderRadius: 8, padding: 12, background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <strong style={{ fontSize: 15 }}>{c.title || c.campaignId}</strong><Chip s={c.status} />
                      </div>
                      <p style={{ ...muted, margin: "6px 0 10px" }}>
                        {k ? `${k.participants} participants · ${k.supporters} supporters` : k === null ? "Counts couldn’t be loaded" : "…"}
                        {typeof c.goalCents === "number" && c.goalCents > 0 ? ` · goal ${money(c.goalCents)}` : ""}
                      </p>
                      <button type="button" style={btnGhost} data-testid={`manage-${c.campaignId}`} onClick={() => setOpenId(c.campaignId)}>Manage</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
