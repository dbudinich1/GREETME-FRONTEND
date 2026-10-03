// Salesperson performance tracker (W50). Founder-only, READ-ONLY: there is no approve, pay, export or edit control here.
// Every panel is gated by its own response, so a missing or failing read removes that panel (with a plain message) and nothing else.
// Gift sales are INFORMATIONAL: gift orders customers attributed to the salesperson placed. No gift commission exists or is shown.
import { useCallback, useEffect, useMemo, useState } from "react";
import { isFounder } from "../../../utils/accountState.js";
import { salesAdminApi, salesAdminErrorMessage } from "../../../api/salesAdmin.js";
import { Page, ui } from "./commandCenterUi.jsx";
import {
  PERIODS, PAYOUTS_OFF_LINE, STAGE_LABELS, COMMISSION_YEAR_WORDS, CUSTOMER_TYPE_WORDS,
  money, statusWord, toRow, filterSort, showRank, inactivePeriodsText, readGiftSales, GIFT_SALES_LABEL, GIFT_SALES_NOTE, giftTypeLabel, giftTruncationNote,
} from "./commandCenterLogic.js";

function readUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}
const field = { padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: ".88rem", background: "#fff" };

function Tile({ testid, label, value, sub }) {
  return (
    <div data-testid={testid} style={{ flex: "1 1 150px", minWidth: 140, border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", background: "#fff" }}>
      <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#1b1830", margin: "2px 0" }} data-testid={`${testid}-value`}>{value}</div>
      {sub ? <div style={{ fontSize: ".74rem", color: "#64748b" }}>{sub}</div> : null}
    </div>
  );
}
const Pill = ({ status }) => (
  <span data-testid={`pill-${status}`} style={{ fontSize: ".72rem", fontWeight: 700, padding: "2px 9px", borderRadius: 10, background: status === "active" ? "#dcfce7" : "#e5e7eb", color: status === "active" ? "#166534" : "#475569" }}>{statusWord(status)}</span>
);
const PayoutsNote = () => (
  <p data-testid="cc-payouts-note" style={{ ...ui.note, background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, padding: "8px 12px", color: "#3b2a6b" }}>
    <strong>Payouts are off.</strong> {PAYOUTS_OFF_LINE.replace("Payouts are off. ", "")} Commission shown is what has been earned so far, for your information only.
  </p>
);

function ByDayChart({ days, field: f, color, label }) {
  const W = 640; const H = 150; const pad = 24;
  const max = Math.max(1, ...days.map((d) => Math.max(0, d[f] || 0)));
  const bw = (W - pad) / Math.max(1, days.length);
  const total = days.reduce((a, d) => a + (d[f] || 0), 0);
  return (
    <figure style={{ margin: 0 }} data-testid={`chart-${f}`}>
      <figcaption style={{ fontSize: ".8rem", fontWeight: 700, color: "#3a3552", marginBottom: 4 }}>{label} <span style={{ fontWeight: 400, color: "#64748b" }}>(total {money(total)})</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${label} by day, total ${money(total)}`} style={{ display: "block", maxWidth: "100%" }}>
        <line x1={pad} y1={H - 18} x2={W} y2={H - 18} stroke="#cbd5e1" />
        <text x={0} y={12} fontSize="10" fill="#64748b">{money(max)}</text>
        {days.map((d, i) => {
          const h = Math.max(0, d[f] || 0) / max * (H - 40);
          return <rect key={d.date} x={pad + i * bw + 0.5} y={H - 18 - h} width={Math.max(1, bw - 1.5)} height={h} fill={color} rx="1"><title>{`${d.date}: ${money(d[f] || 0)}`}</title></rect>;
        })}
        {days.length ? <text x={pad} y={H - 4} fontSize="10" fill="#64748b">{days[0].date}</text> : null}
        {days.length ? <text x={W} y={H - 4} fontSize="10" fill="#64748b" textAnchor="end">{days[days.length - 1].date}</text> : null}
      </svg>
    </figure>
  );
}

function Panel({ state, testid, errorText, children }) {
  if (!state || state.loading) return <p data-testid={`${testid}-loading`} style={ui.note}>Loading...</p>;
  if (state.error) return <p data-testid={`${testid}-error`} role="alert" style={{ ...ui.note, color: "#b3261e" }}>{errorText}</p>;
  return children(state.data);
}

function Detail({ api, id, period, onBack, onPeriod }) {
  const [perf, setPerf] = useState({ loading: true });
  const [cust, setCust] = useState({ loading: true });
  const [gift, setGift] = useState({ loading: true });
  useEffect(() => {
    let live = true;
    const can = (fn) => typeof api[fn] === "function";
    setPerf({ loading: true }); setCust({ loading: true }); setGift({ loading: true });
    if (can("performanceOne")) api.performanceOne(id, period).then((r) => { if (live) setPerf(r.ok && r.data ? { data: r.data } : { error: true }); }); else setPerf({ error: true });
    if (can("customers")) api.customers(id, period).then((r) => { if (live) setCust(r.ok && r.data && Array.isArray(r.data.customers) ? { data: r.data } : { error: true }); }); else setCust({ error: true });
    if (can("giftSales")) api.giftSales(id, period).then((r) => { if (live) { const g = readGiftSales(r); setGift(g.ok ? { data: g } : { error: true }); } }); else setGift({ error: true });
    return () => { live = false; };
  }, [api, id, period]);
  return (
    <div data-testid="cc-detail" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" style={ui.btn2} onClick={onBack} data-testid="cc-back-list">Back to all salespeople</button>
        <label style={{ fontSize: ".82rem", color: "#3a3552" }}>Period{" "}
          <select style={field} value={period} onChange={(e) => onPeriod(e.target.value)} data-testid="cc-detail-period" aria-label="Period">
            {PERIODS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
      </div>
      <Panel state={perf} testid="cc-detail-perf" errorText="We could not load this salesperson. Nothing was changed. Try again in a moment.">
        {(d) => (
          <>
            <section style={ui.card}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <h2 style={{ ...ui.title, fontSize: "1.25rem" }} data-testid="cc-detail-name">{d.salesperson.displayName}</h2><Pill status={d.salesperson.status} />
              </div>
              <p style={ui.note} data-testid="cc-detail-hierarchy">
                {d.hierarchy && d.hierarchy.referrer ? <>Referred by <strong>{d.hierarchy.referrer.displayName}</strong> (override {d.hierarchy.referrer.overrideRateBps / 100}% to them). </> : "Not referred by another salesperson. "}
                {d.hierarchy && d.hierarchy.referees && d.hierarchy.referees.length ? <>This person referred: {d.hierarchy.referees.map((r) => r.displayName).join(", ")}.</> : "Has not referred other salespeople."}
              </p>
              {d.salesperson.status === "inactive" ? <p style={{ ...ui.note, color: "#92400e" }} data-testid="cc-detail-inactive-note">{d.salesperson.note}</p> : null}
              {inactivePeriodsText(d.salesperson.inactivePeriods).length
                ? <p style={ui.note} data-testid="cc-detail-periods">Inactive periods: {inactivePeriodsText(d.salesperson.inactivePeriods).join("; ")}.</p>
                : <p style={ui.note} data-testid="cc-detail-periods">Never inactive.</p>}
            </section>
            <PayoutsNote />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }} data-testid="cc-tiles">
              <Tile testid="tile-customers" label="Customers brought in" value={d.tiles.customersNew} sub={`${d.tiles.customersTotal} in total`} />
              <Tile testid="tile-subscribers" label="New subscribers" value={d.tiles.newSubscribers} sub="First paid month" />
              <Tile testid="tile-renewals" label="Renewals" value={d.tiles.renewals} sub="Later paid months" />
              <Tile testid="tile-revenue" label="Subscription revenue" value={money(d.tiles.revenueMinor)} sub="Attributed, after refunds" />
              {gift.data ? <Tile testid="tile-gifts" label={GIFT_SALES_LABEL} value={`${gift.data.count} (${money(gift.data.grossGiftVolumeMinor)})`} sub="Information only: no commission" /> : null}
              <Tile testid="tile-commission" label="Commission earned" value={money((d.commissionByStage.directMinor || 0) + (d.commissionByStage.overrideMinor || 0))} sub="Not paid out" />
            </div>
            <section style={ui.card} data-testid="cc-section-chart">
              <h3 style={ui.title}>Day by day</h3>
              {!d.byDay || d.byDay.length === 0 ? <p data-testid="cc-chart-empty" style={ui.note}>No sales activity yet, so there is nothing to chart.</p> : (
                <div style={{ display: "grid", gap: 14 }}>
                  <ByDayChart days={d.byDay} field="revenueMinor" color="#4F2D7F" label="Subscription revenue by day" />
                  <ByDayChart days={d.byDay} field="commissionMinor" color="#0f766e" label="Commission earned by day" />
                </div>
              )}
            </section>
            <section style={ui.card}>
              <h3 style={ui.title}>Commission by stage</h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }} data-testid="cc-stages">
                {Object.entries(STAGE_LABELS).map(([k, label]) => (
                  <li key={k} data-testid={`cc-stage-${k}`} style={{ display: "flex", justifyContent: "space-between", fontSize: ".86rem" }}><span>{label}</span><strong>{money(d.commissionByStage[k])}</strong></li>
                ))}
              </ul>
              <p style={ui.note}>Direct sales {money(d.commissionByStage.directMinor)} and override {money(d.commissionByStage.overrideMinor)} together make up the commission earned. Nothing is shown as paid out because payouts are off.</p>
            </section>
            <section style={ui.card} data-testid="cc-section-override">
              <h3 style={ui.title}>Override earnings (from salespeople they referred)</h3>
              {(d.overrideEarningsBySource || []).length === 0 ? <p data-testid="cc-override-empty" style={ui.note}>No override earnings in this period.</p> : (
                <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }} data-testid="cc-override-table">
                  <thead><tr><th style={ui.th}>From the sales of</th><th style={{ ...ui.th, textAlign: "right" }}>Payments</th><th style={{ ...ui.th, textAlign: "right" }}>Override earned</th></tr></thead>
                  <tbody>{d.overrideEarningsBySource.map((o) => <tr key={o.sourceSalespersonId} data-testid={`cc-override-${o.sourceSalespersonId}`}><td style={ui.td}>{o.sourceDisplayName}</td><td style={ui.num}>{o.entryCount}</td><td style={ui.num}>{money(o.commissionMinor)}</td></tr>)}</tbody>
                </table></div>
              )}
            </section>
          </>
        )}
      </Panel>
      {!gift.loading && gift.error ? <p data-testid="cc-gift-unavailable" style={ui.note}>{GIFT_SALES_LABEL} are not available right now.</p> : null}
      {gift.data ? (
        <section style={ui.card} data-testid="cc-section-gifts">
          <h3 style={ui.title}>{GIFT_SALES_LABEL} by type</h3>
          {gift.data.byType.length === 0 ? <p style={ui.note} data-testid="cc-gifts-none">None in this period.</p> : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }} data-testid="cc-gift-types">
              {gift.data.byType.map((t) => <li key={t.giftType} data-testid={`cc-gift-type-${t.giftType}`} style={{ display: "flex", justifyContent: "space-between", fontSize: ".86rem" }}><span>{giftTypeLabel(t.giftType)}</span><strong>{t.count} ({money(t.grossGiftVolumeMinor)})</strong></li>)}
            </ul>
          )}
          {giftTruncationNote(gift.data) ? <p style={ui.note} data-testid="cc-gifts-truncated">{giftTruncationNote(gift.data)}</p> : null}
          <p style={ui.note}>{GIFT_SALES_NOTE}</p>
        </section>
      ) : null}
      <section style={ui.card} data-testid="cc-section-customers">
        <h3 style={ui.title}>Customers</h3>
        <Panel state={cust} testid="cc-customers" errorText="The customer list is not available right now.">
          {(d) => (d.customers.length === 0 ? <p data-testid="cc-customers-empty" style={ui.note}>No customers yet. They appear here once a referred customer pays for the first time.</p> : (
            <div style={{ overflowX: "auto" }}>
              {d.truncated ? <p style={ui.note} data-testid="cc-customers-truncated">Showing the first {d.customers.length} customers.</p> : null}
              <table style={{ width: "100%", borderCollapse: "collapse" }} data-testid="cc-customers-table">
                <thead><tr><th style={ui.th}>Customer</th><th style={ui.th}>Type</th><th style={ui.th}>Started</th><th style={ui.th}>Commission stage</th><th style={ui.th}>Still paying</th><th style={{ ...ui.th, textAlign: "right" }}>Revenue</th></tr></thead>
                <tbody>{d.customers.map((c) => (
                  <tr key={c.customerRef} data-testid={`cc-customer-${c.customerRef}`}><td style={ui.td}>{c.label}</td><td style={ui.td}>{CUSTOMER_TYPE_WORDS[c.type] || "Customer"}</td><td style={ui.td}>{String(c.originatedAt).slice(0, 10)}</td><td style={ui.td}>{COMMISSION_YEAR_WORDS[c.commissionYear] || "—"}</td><td style={ui.td}>{c.stillPaying ? "Yes" : "No"}</td><td style={ui.num}>{money(c.revenueMinor)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          ))}
        </Panel>
      </section>
      <p style={ui.note}>To change a salesperson's terms, status or links, use <a href="#/dashboard/founder/salespeople" data-testid="cc-manage-link">Salespeople management</a>. This page only reads.</p>
    </div>
  );
}

export default function SalesPerformance({ api = salesAdminApi, user: injectedUser, initialPeriod = "30" }) {
  const user = injectedUser !== undefined ? injectedUser : readUser();
  const founder = isFounder(user);
  const [period, setPeriod] = useState(initialPeriod);
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState("revenue");
  const [dir, setDir] = useState("desc");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [state, setState] = useState({ loading: true });
  const [gifts, setGifts] = useState({});
  const load = useCallback(() => {
    let live = true;
    setState({ loading: true }); setGifts({});
    if (typeof api.performance !== "function") { setState({ error: true }); return undefined; }
    api.performance(period).then((r) => {
      if (!live) return;
      if (!r.ok || !r.data || !Array.isArray(r.data.salespeople)) { setState({ error: true, status: r.status }); return; }
      setState({ sales: r.data.salespeople });
      if (typeof api.giftSales === "function") {
        r.data.salespeople.forEach((sp) => api.giftSales(sp.salespersonId, period).then((g) => { if (live) setGifts((o) => ({ ...o, [sp.salespersonId]: readGiftSales(g) })); }));
      }
    });
    return () => { live = false; };
  }, [api, period]);
  useEffect(() => (founder ? load() : undefined), [load, founder]);
  const rows = useMemo(() => (state.sales ? state.sales.map((s) => toRow(s, gifts[s.salespersonId] && gifts[s.salespersonId].ok ? gifts[s.salespersonId] : null)) : []), [state.sales, gifts]);

  if (!founder) return <div style={{ padding: "2rem" }} data-testid="cc-denied"><h1 style={{ fontSize: "1.25rem", margin: 0 }}>Not available</h1><p style={{ marginTop: ".5rem", color: "#605c78" }}>This area is limited to the founder account.</p></div>;
  const trail = [["Sales", "/dashboard/founder/sales"], ["Performance"]];
  if (openId) return <Page trail={trail} title="Salesperson Performance" testid="cc-performance"><Detail api={api} id={openId} period={period} onBack={() => setOpenId(null)} onPeriod={setPeriod} /></Page>;

  const sortBy = (k) => { if (k === sortKey) setDir(dir === "desc" ? "asc" : "desc"); else { setSortKey(k); setDir(k === "name" ? "asc" : "desc"); } };
  const shown = filterSort(rows, { status, sortKey, dir, q });
  const maxRev = Math.max(1, ...rows.map((r) => r.revenueMinor));
  const rank = showRank(sortKey, dir);
  const head = (k, label, right) => (
    <th style={{ ...ui.th, textAlign: right ? "right" : "left" }} aria-sort={sortKey === k ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => sortBy(k)} data-testid={`cc-sort-${k}`} style={{ all: "unset", cursor: "pointer", fontWeight: 700 }}>{label}{sortKey === k ? (dir === "asc" ? " ▲" : " ▼") : ""}</button>
    </th>
  );
  return (
    <Page trail={trail} title="Salesperson Performance" testid="cc-performance" sub="Read-only. How each salesperson is doing.">
      <div style={{ display: "grid", gap: 12 }} data-testid="cc-list">
        <PayoutsNote />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: ".82rem", color: "#3a3552" }}>Period{" "}
            <select style={field} value={period} onChange={(e) => setPeriod(e.target.value)} data-testid="cc-filter-period" aria-label="Period">
              {PERIODS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select></label>
          <label style={{ fontSize: ".82rem", color: "#3a3552" }}>Show{" "}
            <select style={field} value={status} onChange={(e) => setStatus(e.target.value)} data-testid="cc-filter-status" aria-label="Show">
              <option value="all">All salespeople</option><option value="active">Active only</option><option value="inactive">Inactive only</option>
            </select></label>
          <input style={field} placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} data-testid="cc-search" aria-label="Search by name" />
          <a href="#/dashboard/founder/salespeople" style={{ fontSize: ".82rem", color: "#4F2D7F", fontWeight: 700 }} data-testid="cc-link-manage">Salespeople management (terms, status, links)</a>
        </div>
        {state.loading ? <p data-testid="cc-loading" style={ui.note}>Loading performance...</p> : null}
        {state.error ? <p data-testid="cc-error" role="alert" style={{ ...ui.note, color: "#b3261e" }}>{state.status ? salesAdminErrorMessage({ status: state.status }, { context: "load" }) : "We could not load performance numbers."} Nothing was changed. <button type="button" style={ui.btn2} onClick={() => load()} data-testid="cc-retry">Try again</button></p> : null}
        {state.sales && state.sales.length === 0 ? <p data-testid="cc-empty" style={ui.note}>No salespeople yet. Add one on the Salespeople screen and their performance will appear here.</p> : null}
        {state.sales && state.sales.length > 0 ? (
          shown.length === 0 ? <p data-testid="cc-no-match" style={ui.note}>No salespeople match these filters.</p> : (
            <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }} data-testid="cc-perf-table">
                <thead><tr>{rank ? <th style={ui.th}>Rank</th> : null}{head("name", "Salesperson")}<th style={ui.th}>Status</th>{head("customers", "Customers", true)}{head("newSubscribers", "New subscribers", true)}{head("revenue", "Revenue", true)}{head("gifts", GIFT_SALES_LABEL, true)}{head("commission", "Commission earned", true)}<th style={ui.th} /></tr></thead>
                <tbody>{shown.map((r, i) => (
                  <tr key={r.salespersonId} data-testid={`cc-row-${r.salespersonId}`}>
                    {rank ? <td style={ui.td} data-testid={`cc-rank-${r.salespersonId}`}>{i + 1}</td> : null}
                    <td style={ui.td}><strong>{r.displayName}</strong></td>
                    <td style={ui.td}><Pill status={r.status} /></td>
                    <td style={ui.num}>{r.customers}</td>
                    <td style={ui.num}>{r.newSubscribers}</td>
                    <td style={ui.num}><div>{money(r.revenueMinor)}</div><div aria-hidden="true" style={{ height: 4, background: "#e5e7eb", borderRadius: 2, marginTop: 3 }}><div style={{ height: 4, width: `${Math.max(0, r.revenueMinor) / maxRev * 100}%`, background: "#4F2D7F", borderRadius: 2 }} /></div></td>
                    <td style={ui.num} data-testid={`cc-gifts-${r.salespersonId}`}>{r.giftOrders == null ? "—" : <>{r.giftOrders} <span style={{ color: "#64748b" }}>({money(r.giftGrossMinor)})</span></>}</td>
                    <td style={ui.num}>{money(r.commissionMinor)}</td>
                    <td style={ui.td}><button type="button" style={ui.btn2} onClick={() => setOpenId(r.salespersonId)} data-testid={`cc-open-${r.salespersonId}`}>View</button></td>
                  </tr>))}</tbody>
              </table>
            </div>)
        ) : null}
        <p style={ui.note}>Revenue is subscription revenue attributed to the salesperson, after refunds. Commission earned includes override earnings and is not paid out. Gift & store sales are the gift and store orders (including merch and marketplace) that customers attributed to the salesperson placed, as a count and total value; they are for information only and carry no commission. Dollar amounts are in US dollars.</p>
      </div>
    </Page>
  );
}
