// Command Center hub pages. Each embeds the EXISTING Central Command cards for its area (same component, same data, same
// test ids) and lists the existing screens behind it. Founder-only: FounderCentralCommand renders the denied state for anyone
// else before any request is made, and every read is independently founder-gated on the server.
import { useEffect, useState } from "react";
import FounderCentralCommand from "../FounderCentralCommand.jsx";
import { isFounder } from "../../../utils/accountState.js";
import { salesAdminApi } from "../../../api/salesAdmin.js";
import { Page, LinkList, ui, gridStyle } from "./commandCenterUi.jsx";
import { money, readGiftSales, sumGiftSales, GIFT_SALES_LABEL, GIFT_SALES_NOTE } from "./commandCenterLogic.js";

function readUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

export function GiftPlaceHub({ commandProps = {} }) {
  return (
    <Page trail={[["Gift Place"]]} title="Gift Place" sub="Everything for managing the Gift Place catalog." testid="cc-hub-gift">
      <FounderCentralCommand view="gift" {...commandProps} />
      <LinkList testid="cc-gift-items" items={[
        { id: "manage", to: "/dashboard/gifts", label: "Manage Catalog", desc: "Published products, search and provider filter, unpublish, and Add to Catalog for Florist One, Goody, Prezzee and Printful. Opens the Gift Place; use the Manage Catalog button there." },
        { id: "providers", to: "/dashboard/gifts", label: "Provider status", desc: "Goody, Printful, Florist One and Prezzee status is inside Manage Catalog." },
        { id: "smart", to: "/dashboard/gifts/smart-card", label: "Smart eGift Card page", desc: "The Prezzee Smart Card purchase page." },
      ]} />
    </Page>
  );
}

export function SalesHub({ commandProps = {}, api = salesAdminApi, period = "30" }) {
  const founder = isFounder(commandProps.user !== undefined ? commandProps.user : readUser());
  const [gift, setGift] = useState({ loading: true, total: null });
  useEffect(() => {
    if (!founder || typeof api.performance !== "function" || typeof api.giftSales !== "function") { setGift({ loading: false, total: null }); return undefined; }
    let alive = true;
    (async () => {
      const list = await api.performance("all");
      const ids = list.ok && list.data && Array.isArray(list.data.salespeople) ? list.data.salespeople.map((s) => s.salespersonId) : [];
      const res = await Promise.all(ids.map(async (id) => readGiftSales(await api.giftSales(id, period))));
      if (!alive) return;
      const total = sumGiftSales(Object.fromEntries(res.map((r, i) => [ids[i], r])));
      setGift({ loading: false, total: ids.length && total.loaded === ids.length ? total : null });
    })();
    return () => { alive = false; };
  }, [founder, api, period]);
  return (
    <Page trail={[["Sales"]]} title="Sales" sub="Salespeople, their links, their results and gift sales." testid="cc-hub-sales">
      <FounderCentralCommand view="sales" {...commandProps} />
      <div style={{ ...gridStyle, margin: "16px 0" }}>
        <section style={ui.card} data-testid="cc-card-performance" aria-labelledby="cc-perf-title">
          <h2 id="cc-perf-title" style={ui.title}>Salesperson Performance</h2>
          <p style={ui.note}>Compare salespeople by customers, new subscribers, revenue and commission. Read-only.</p>
          <p style={ui.note} data-testid="cc-perf-payouts">Payouts are off. Nothing here has been paid out.</p>
          <a href="#/dashboard/founder/sales/performance" style={{ ...ui.btn, marginTop: "auto", alignSelf: "flex-start" }} data-testid="cc-perf-open">Open Performance</a>
        </section>
        {gift.total ? (
          <section style={ui.card} data-testid="cc-card-gift-sales" aria-labelledby="cc-gs-title">
            <h2 id="cc-gs-title" style={ui.title}>{GIFT_SALES_LABEL}</h2>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem" }}><span>Last 30 days</span><strong data-testid="cc-gift-sales-30">{gift.total.count} orders ({money(gift.total.gross)})</strong></div>
            <p style={ui.note}>{GIFT_SALES_NOTE}</p>
          </section>
        ) : null}
      </div>
      <LinkList testid="cc-sales-items" items={[
        { id: "people", to: "/dashboard/founder/salespeople", label: "Salespeople: list and profiles", desc: "Add a salesperson, status, commission terms, referrer override, assigned links and gift sales per person." },
        { id: "performance", to: "/dashboard/founder/sales/performance", label: "Performance tracker", desc: "Sortable comparison with period filter, then a detail page per salesperson." },
      ]} />
    </Page>
  );
}

export function FundraiserHub({ commandProps = {} }) {
  return (
    <Page trail={[["Fundraiser"]]} title="Fundraiser" sub="Organizations, campaigns, participants, partners and activation." testid="cc-hub-fundraiser">
      <FounderCentralCommand view="fundraiser" {...commandProps} />
      <LinkList testid="cc-fund-items" items={[
        { id: "admin", to: "/dashboard/fundraiser/admin", label: "Fundraising Management", desc: "Platform overview, organizations, campaign status, Draft Economics (draft, approve, activate), partner administrators, reconciliation and audit history." },
        { id: "partner", to: "/dashboard/fundraiser", label: "Partner portal home", desc: "Where partner administrators land; open any organization's partner dashboard from here or from the Partner Portal card." },
      ]} />
    </Page>
  );
}
