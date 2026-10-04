// Panels added to the existing Salespeople profile (SalespersonControlCenter detail). Both are READ-ONLY and gated by the api:
// when the client has no such read (or the read fails) the panel renders nothing or one plain sentence, and the rest of the
// profile is untouched. No token or hash is ever shown; the private link is only ever reported as a state.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { money, readGiftSales, GIFT_SALES_LABEL, GIFT_SALES_NOTE, giftTypeLabel, giftTruncationNote } from "./commandCenterLogic.js";

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
/**
 * QR code for the SHAREABLE link only. Drawn in the browser from the public vanity URL string; the private tracking link is never
 * passed in here (its token is shown once and must never be rendered or encoded). Rendered as an SVG built from the QR module
 * matrix so there is no canvas and no stored image; `data-qr-text` records exactly what was encoded.
 */
export function ShareQr({ url }) {
  const [m, setM] = useState(null);
  useEffect(() => {
    let live = true;
    try {
      const q = QRCode.create(url, { errorCorrectionLevel: "M" });
      if (live) setM({ size: q.modules.size, data: Array.from(q.modules.data) });
    } catch { if (live) setM(null); }
    return () => { live = false; };
  }, [url]);
  if (!m) return null;
  const pad = 4; const dim = m.size + pad * 2;
  const rects = [];
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.data[y * m.size + x]) rects.push(`M${x + pad} ${y + pad}h1v1h-1z`);
  const path = rects.join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="256" height="256" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  return (
    <div data-testid="cc-link-qr" style={{ display: "grid", gap: 6, justifyItems: "start" }}>
      <svg viewBox={`0 0 ${dim} ${dim}`} width="140" height="140" role="img" aria-label={`QR code for ${url}`} data-testid="cc-link-qr-svg" data-qr-text={url} data-qr-size={m.size} shape-rendering="crispEdges" style={{ maxWidth: "100%", background: "#fff" }}>
        <rect width={dim} height={dim} fill="#fff" />
        <path d={path} fill="#000" data-testid="cc-link-qr-path" />
      </svg>
      <p style={small}>QR code for the shareable link above. It does not include the private tracking link.</p>
      <a href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} download="salesperson-share-link-qr.svg" style={{ fontSize: ".8rem", color: "#4F2D7F", fontWeight: 700 }} data-testid="cc-link-qr-download">Download QR code</a>
    </div>
  );
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
              {vanity.active ? <ShareQr url={vanity.url} /> : <p style={small} data-testid="cc-link-qr-paused">No QR code is shown while this salesperson is inactive.</p>}
            </>
          ) : <p style={small} data-testid="cc-link-vanity-none">No shareable link assigned yet. Assign one below.</p>}
        </div>
      ) : null}
      {share ? (
        <div style={box} data-testid="cc-link-share">
          <div style={head}><span>Private tracking link</span><span data-testid="cc-link-share-state">{share.active ? "Active" : "Paused"}, version {share.tokenVersion}</span></div>
          <p style={small}>Opens: {share.destination}. {share.note}</p>
          <p style={small} data-testid="cc-link-share-rotate">To get a new link, use Rotate on this profile; the new link is shown once.</p>
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
      <div style={head}><span>{GIFT_SALES_LABEL}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".86rem" }}><span>Last 30 days</span><strong data-testid="cc-profile-gifts-30">{state.g30.count} orders ({money(state.g30.grossGiftVolumeMinor)})</strong></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".86rem" }}><span>All time</span><strong data-testid="cc-profile-gifts-all">{state.gAll.count} orders ({money(state.gAll.grossGiftVolumeMinor)})</strong></div>
      {state.gAll.byType.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }} data-testid="cc-profile-gifts-types">
          {state.gAll.byType.map((t) => <li key={t.giftType} data-testid={`cc-gift-type-${t.giftType}`} style={{ display: "flex", justifyContent: "space-between", fontSize: ".82rem" }}><span>{giftTypeLabel(t.giftType)} (all time)</span><span>{t.count} ({money(t.grossGiftVolumeMinor)})</span></li>)}
        </ul>
      ) : null}
      {giftTruncationNote(state.gAll) || giftTruncationNote(state.g30) ? <p style={small} data-testid="cc-profile-gifts-truncated">{giftTruncationNote(state.gAll) || giftTruncationNote(state.g30)}</p> : null}
      <p style={small}>{GIFT_SALES_NOTE}</p>
      <a href="#/dashboard/founder/sales/performance" data-testid="cc-profile-to-performance" style={{ fontSize: ".82rem", color: "#4F2D7F", fontWeight: 700 }}>Open the performance tracker</a>
    </section>
  );
}
