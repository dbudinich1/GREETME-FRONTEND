// Panels added to the existing Salespeople profile (SalespersonControlCenter detail). Both are READ-ONLY and gated by the api:
// when the client has no such read (or the read fails) the panel renders nothing or one plain sentence, and the rest of the
// profile is untouched. No token or hash is ever shown; the private link is only ever reported as a state.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { money, readGiftSales } from "./commandCenterLogic.js";

const box = { border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, padding: "12px 14px", display: "grid", gap: 6, background: "#fff" };
const small = { margin: 0, fontSize: ".8rem", color: "#475569", lineHeight: 1.45 };
const head = { display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontWeight: 700, fontSize: ".9rem" };

function CopyButton({ text, testid }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { setDone(false); }
  }
  return <button type="button" className="btn-secondary" style={{ padding: ".3rem .7rem", fontSize: ".78rem" }} data-testid={testid} onClick={copy}>{done ? "Copied" : "Copy link"}</button>;
}
function QrImage({ text }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { margin: 1, width: 160 }).then((u) => { if (live) setSrc(u); }).catch(() => { if (live) setSrc(""); });
    return () => { live = false; };
  }, [text]);
  return src ? <img src={src} width="120" height="120" alt={`QR code for ${text}`} data-testid="cc-link-qr-img" /> : null;
}

export function AssignedLinksPanel({ api, salespersonId }) {
  const [state, setState] = useState({ loading: true });
  const has = typeof api.assignedLinks === "function";
  useEffect(() => {
    if (!has) return undefined;
    let live = true;
    setState({ loading: true });
    api.assignedLinks(salespersonId).then((r) => { if (live) setState(r.ok && r.data && Array.isArray(r.data.links) ? { data: r.data } : { error: true }); });
    return () => { live = false; };
  }, [api, salespersonId, has]);
  if (!has) return null;
  if (state.loading) return <p style={small} data-testid="cc-links-loading">Loading assigned links...</p>;
  if (state.error) return <p style={small} data-testid="cc-links-error">Assigned links are not available right now.</p>;
  const by = Object.fromEntries(state.data.links.map((l) => [l.type, l]));
  const share = by.share_link; const vanity = by.vanity_alias; const claim = by.gift_claim_attribution;
  return (
    <section data-testid="cc-assigned-links" style={{ display: "grid", gap: 10 }}>
      <h3 style={{ fontSize: ".92rem", margin: 0 }}>Assigned links</h3>
      {state.data.referralPublicEnabled === false ? <p style={{ ...small, color: "#92400e" }} data-testid="cc-links-platform-off">Referral links are switched off platform-wide, so none of these links credit anyone yet.</p> : null}
      {vanity ? (
        <div style={box} data-testid="cc-link-vanity">
          <div style={head}><span>Shareable link</span><span data-testid="cc-link-vanity-state">{vanity.active ? "Active" : "Paused"}</span></div>
          {vanity.assigned && vanity.url ? (
            <>
              <code data-testid="cc-link-vanity-url" style={{ wordBreak: "break-all", userSelect: "all" }}>{vanity.url}</code>
              <p style={small}>Opens: {vanity.destination}.{vanity.active ? "" : " This salesperson is inactive, so new visitors are not credited to them."}</p>
              <div><CopyButton text={vanity.url} testid="cc-link-vanity-copy" /></div>
              <div data-testid="cc-link-qr"><QrImage text={vanity.url} /><p style={small}>QR code made from the shareable link above.</p></div>
            </>
          ) : <p style={small} data-testid="cc-link-vanity-none">No shareable link assigned yet. Assign one below.</p>}
        </div>
      ) : null}
      {share ? (
        <div style={box} data-testid="cc-link-share">
          <div style={head}><span>Private tracking link</span><span data-testid="cc-link-share-state">{share.active ? "Active" : "Paused"}, version {share.tokenVersion}</span></div>
          <p style={small}>Opens: {share.destination}. {share.note}</p>
        </div>
      ) : null}
      {claim ? (
        <div style={box} data-testid="cc-link-claim">
          <div style={head}><span>QR Cash gift link</span><span data-testid="cc-link-claim-state">{claim.linked ? (claim.active ? "Active" : "Paused") : "Not linked"}</span></div>
          <p style={small}>{claim.linked ? claim.destination : "Link a Greet-Me account below so recipients who claim this person's QR Cash gifts are credited to them."}</p>
        </div>
      ) : null}
    </section>
  );
}

export function GiftSalesPanel({ api, salespersonId }) {
  const [state, setState] = useState({ loading: true });
  const has = typeof api.giftSales === "function";
  useEffect(() => {
    if (!has) return undefined;
    let live = true;
    setState({ loading: true });
    Promise.all([api.giftSales(salespersonId, "30"), api.giftSales(salespersonId, "all")]).then(([a, b]) => {
      if (!live) return;
      const g30 = readGiftSales(a); const gAll = readGiftSales(b);
      setState(g30.ok && gAll.ok ? { g30, gAll } : { error: true });
    });
    return () => { live = false; };
  }, [api, salespersonId, has]);
  if (!has) return null;
  if (state.loading) return <p style={small} data-testid="cc-gifts-loading">Loading gift sales...</p>;
  if (state.error) return <p style={small} data-testid="cc-gifts-error">Gift sales are not available right now.</p>;
  return (
    <section data-testid="cc-profile-gifts" style={box}>
      <div style={head}><span>Gift sales</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".86rem" }}><span>Last 30 days</span><strong data-testid="cc-profile-gifts-30">{state.g30.count} orders ({money(state.g30.grossGiftVolumeMinor)})</strong></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".86rem" }}><span>All time</span><strong data-testid="cc-profile-gifts-all">{state.gAll.count} orders ({money(state.gAll.grossGiftVolumeMinor)})</strong></div>
      <p style={small}>Gift orders placed by customers this salesperson brought in. For information only: no commission is calculated on gifts and nothing here is paid out.</p>
      <a href="#/dashboard/founder/sales/performance" data-testid="cc-profile-to-performance" style={{ fontSize: ".82rem", color: "#4F2D7F", fontWeight: 700 }}>Open the performance tracker</a>
    </section>
  );
}
