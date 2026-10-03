// Pure helpers for the Command Center hubs. No network, no React. Money is integer minor units, USD only.
export const PERIODS = [
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
  { id: "all", label: "All time" },
];
export const PAYOUTS_OFF_LINE = "Payouts are off. Nothing on this page has been paid out and nothing here can be paid, approved or changed.";

export function money(minor) {
  if (typeof minor !== "number" || !Number.isFinite(minor)) return "—";
  const sign = minor < 0 ? "-" : "";
  return `${sign}$${(Math.abs(minor) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export const statusWord = (s) => (s === "active" ? "Active" : "Inactive");
export const COMMISSION_YEAR_WORDS = { 1: "Year 1", 2: "Year 2", 3: "Year 3 and later" };
export const CUSTOMER_TYPE_WORDS = { customer: "Customer", fundraiser_partner: "Fundraiser partner" };

/** One flat row for the performance list from an A1 salesperson entry (+ optional gift sales {count, grossGiftVolumeMinor}). */
export function toRow(sp, gift) {
  const c = sp.commission || {};
  return {
    salespersonId: sp.salespersonId, displayName: sp.displayName || "", status: sp.status,
    customers: sp.customers ? (sp.customers.newInPeriod ?? 0) : 0,
    customersTotal: sp.customers ? (sp.customers.total ?? 0) : 0,
    newSubscribers: sp.newSubscribers ?? 0, renewals: sp.renewals ?? 0,
    revenueMinor: sp.revenueMinor ?? 0,
    commissionMinor: (c.directMinor ?? 0) + (c.overrideMinor ?? 0),
    giftOrders: gift ? gift.count : null, giftGrossMinor: gift ? gift.grossGiftVolumeMinor : null,
  };
}
export const SORTS = {
  name: (a, b) => a.displayName.localeCompare(b.displayName),
  customers: (a, b) => a.customers - b.customers,
  newSubscribers: (a, b) => a.newSubscribers - b.newSubscribers,
  revenue: (a, b) => a.revenueMinor - b.revenueMinor,
  gifts: (a, b) => (a.giftGrossMinor ?? -1) - (b.giftGrossMinor ?? -1),
  commission: (a, b) => a.commissionMinor - b.commissionMinor,
};
export function filterSort(rows, { status = "all", sortKey = "revenue", dir = "desc", q = "" } = {}) {
  const needle = q.trim().toLowerCase();
  const out = rows.filter((r) => (status === "all" || r.status === status) && (!needle || r.displayName.toLowerCase().includes(needle)));
  const cmp = SORTS[sortKey] || SORTS.revenue;
  out.sort((a, b) => (dir === "asc" ? cmp(a, b) : cmp(b, a)) || a.displayName.localeCompare(b.displayName));
  return out;
}
/** A rank number is only meaningful for a numeric sort, high to low. */
export const showRank = (sortKey, dir) => sortKey !== "name" && dir === "desc";

export function inactivePeriodsText(periods) {
  return (Array.isArray(periods) ? periods : []).filter((p) => p && p.from).map((p) => `${String(p.from).slice(0, 10)} to ${p.to ? String(p.to).slice(0, 10) : "now"}`);
}
/** Plain-words stage label; never an internal state name. */
export const STAGE_LABELS = { waitingApprovalMinor: "Waiting for approval", approvedMinor: "Approved (not paid out)", reversedMinor: "Reversed (refund)" };

/** Sum gift sales across a map of results; ignores entries that failed to load. */
export function sumGiftSales(results) {
  let count = 0; let gross = 0; let loaded = 0;
  for (const r of Object.values(results)) if (r && r.ok) { loaded += 1; count += r.count; gross += r.grossGiftVolumeMinor; }
  return { count, gross, loaded };
}
/** Normalise an A5 envelope to {ok, count, grossGiftVolumeMinor} or {ok:false}. */
export function readGiftSales(res) {
  const g = res && res.ok && res.data && res.data.giftSales;
  if (!g || !Number.isFinite(g.count) || !Number.isFinite(g.grossGiftVolumeMinor)) return { ok: false };
  return {
    ok: true, count: g.count, grossGiftVolumeMinor: g.grossGiftVolumeMinor,
    byType: Array.isArray(g.byType) ? g.byType.filter((t) => t && Number.isFinite(t.count)) : [],
    truncated: !!res.data.truncated,
    considered: Number.isFinite(res.data.attributedCustomersConsidered) ? res.data.attributedCustomersConsidered : null,
    resolved: Number.isFinite(res.data.resolvedAccounts) ? res.data.resolvedAccounts : null,
  };
}
/** Accurate label: the backend counts gift orders AND store (merch / marketplace) orders. */
export const GIFT_SALES_LABEL = "Gift & store sales";
export const GIFT_SALES_NOTE = "Gift and store orders placed by customers this salesperson brought in, including merch and marketplace orders. For information only: no commission is calculated on them and nothing here is paid out.";
export function giftTypeLabel(t) {
  const v = String(t || "").replace(/[_-]+/g, " ").trim();
  return v ? v.split(" ").map((w) => (w.toLowerCase() === "qr" ? "QR" : w.charAt(0).toUpperCase() + w.slice(1))).join(" ") : "Other";
}
/** One plain sentence when the figure may be incomplete, else an empty string. */
export function giftTruncationNote(g) {
  if (!g || !g.ok) return "";
  const partial = g.truncated || (g.considered != null && g.resolved != null && g.resolved < g.considered);
  if (!partial) return "";
  const of = g.considered != null && g.resolved != null ? ` (${g.resolved} of ${g.considered} customer accounts counted)` : "";
  return `This figure may be incomplete${of}.`;
}
