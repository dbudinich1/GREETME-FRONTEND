// src/pages/founder/attributionHealthView.js
//
// CLOSEOUT W37 - pure view-model for the founder's per-salesperson "attribution health" read.
//
// The backend (services/sales/attributionObservability.js#readAttributionCounters) returns:
//   { salespersonId, totals: {<outcome>: n}, byDay: {<YYYY-MM-DD>: {<outcome>: n}},
//     validatedCount, attributedCount, carrierUnavailableCount, expiredCount,
//     lossRateBps, consideredCount }
// The page used to print every entry as `${key}: ${String(value)}`, which turned the two object
// members (`totals`, `byDay`) into the literal text "[object Object]". This module turns the same
// payload into labeled metrics, a totals table and a by-day table/chart, and degrades honestly on
// an empty or malformed payload. It is READ-ONLY: it never computes a figure the server did not
// state (the only arithmetic is a bar's relative width, which is presentation).
//
// No React, no DOM, no fetch in here.

const OUTCOME_LABELS = Object.freeze({
  no_referral: "No referral",
  referral_validated: "Referral links validated",
  attributed: "Attributed to a purchase",
  gift_claim_validated: "Gift claims validated",
  carrier_unavailable: "Lost before checkout",
  window_expired: "Window expired",
  unresolvable: "Link did not resolve",
  attribution_disabled: "Attribution switched off",
});

const METRIC_LABELS = Object.freeze({
  validatedCount: "Referrals validated",
  attributedCount: "Attributed",
  carrierUnavailableCount: "Lost before checkout",
  expiredCount: "Window expired",
  consideredCount: "Referrals considered",
});

/** Readable label for a backend outcome key; unknown keys are title-cased, never dropped. */
export function outcomeLabel(key) {
  const k = String(key ?? "");
  if (OUTCOME_LABELS[k]) return OUTCOME_LABELS[k];
  const spaced = k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  if (!spaced) return "Unknown";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isCount = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A scalar the page may print. Objects/arrays are NEVER stringified. */
function scalarText(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "—";
  if (typeof v === "string") return v;
  return "—";
}

/** 1234 basis points -> "12.34%". Null when the server said null (idle salesperson). */
export function bpsToPercentText(bps) {
  if (!isCount(bps)) return null;
  return `${(bps / 100).toFixed(2).replace(/\.00$/, "")}%`;
}

/**
 * @param {unknown} health  the `attributionHealth` member of the server response
 * @returns {{
 *   state: "ok"|"empty"|"malformed",
 *   metrics: {key:string,label:string,value:string}[],
 *   totals: {key:string,label:string,count:number}[],
 *   days: {day:string,cells:{key:string,label:string,count:number}[],total:number}[],
 *   outcomeKeys: string[],
 *   maxDayTotal: number,
 *   extras: {key:string,label:string,value:string}[],
 * }}
 */
export function buildAttributionHealthView(health) {
  const view = { state: "ok", metrics: [], totals: [], days: [], outcomeKeys: [], maxDayTotal: 0, extras: [] };
  if (!isPlainObject(health)) return { ...view, state: "malformed" };

  // Headline metrics: only counts the server stated, in a fixed order.
  for (const key of Object.keys(METRIC_LABELS)) {
    if (key in health && isCount(health[key])) {
      view.metrics.push({ key, label: METRIC_LABELS[key], value: String(health[key]) });
    }
  }
  if ("lossRateBps" in health) {
    const pct = bpsToPercentText(health.lossRateBps);
    // Null means "nothing validated yet" - say so, never 0%.
    view.metrics.push({ key: "lossRateBps", label: "Loss rate", value: pct ?? "No referrals yet" });
  }

  // Totals by outcome.
  if (isPlainObject(health.totals)) {
    for (const [key, n] of Object.entries(health.totals)) {
      if (isCount(n)) view.totals.push({ key, label: outcomeLabel(key), count: n });
    }
  }

  // By day: { day: { outcome: n } }. Malformed days/cells are skipped, not stringified.
  const outcomeSet = new Set();
  if (isPlainObject(health.byDay)) {
    for (const day of Object.keys(health.byDay).sort()) {
      const row = health.byDay[day];
      if (!DAY_RE.test(day) || !isPlainObject(row)) continue;
      const cells = [];
      for (const [key, n] of Object.entries(row)) {
        if (!isCount(n)) continue;
        cells.push({ key, label: outcomeLabel(key), count: n });
        outcomeSet.add(key);
      }
      if (cells.length === 0) continue;
      const total = cells.reduce((a, c) => a + c.count, 0);
      view.days.push({ day, cells, total });
      if (total > view.maxDayTotal) view.maxDayTotal = total;
    }
  }
  view.outcomeKeys = [...outcomeSet].sort();

  // Any other scalar member (older/flat shapes) is shown labeled; objects are never printed raw.
  const consumed = new Set([...Object.keys(METRIC_LABELS), "lossRateBps", "totals", "byDay", "salespersonId"]);
  for (const [key, v] of Object.entries(health)) {
    if (consumed.has(key)) continue;
    if (isPlainObject(v) || Array.isArray(v)) continue;
    view.extras.push({ key, label: outcomeLabel(key), value: scalarText(v) });
  }

  const anything = view.metrics.length + view.totals.length + view.days.length + view.extras.length;
  if (anything === 0) view.state = Object.keys(health).length === 0 ? "empty" : "malformed";
  else if (view.totals.every((t) => t.count === 0) && view.days.length === 0 && view.extras.length === 0
    && view.metrics.every((m) => m.key === "lossRateBps" || m.value === "0")) view.state = "empty";
  return view;
}
