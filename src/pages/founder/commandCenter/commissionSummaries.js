// Pure one-line summaries of SAVED commission terms, shown in each collapsed commission panel. They read only what the
// server returned (basis points), never the unsaved form draft, so a collapsed panel always shows what is in force.

const pct = (bps) => `${bps / 100}%`;
const isBps = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 10000;

/** "20% / 10% / 10%" from a saved { year_1, year_2, year_3_plus } block, or null when no complete schedule is saved. */
export function scheduleText(compensation) {
  const c = compensation;
  if (!c || !isBps(c.year_1) || !isBps(c.year_2) || !isBps(c.year_3_plus)) return null;
  return `${pct(c.year_1)} / ${pct(c.year_2)} / ${pct(c.year_3_plus)}`;
}

/** "Year 1 20% · Year 2 10% · Year 3+ 10%": the inherited gift-rate display, or null when no complete schedule is saved. */
export function inheritedRatesText(compensation) {
  const c = compensation;
  if (!c || !isBps(c.year_1) || !isBps(c.year_2) || !isBps(c.year_3_plus)) return null;
  return `Year 1 ${pct(c.year_1)} · Year 2 ${pct(c.year_2)} · Year 3+ ${pct(c.year_3_plus)}`;
}

/**
 * Subscription commission, from the salesperson record. `nameOf(id)` turns a permanent salesperson id into a display name.
 * With no saved schedule, new customers earn nothing until terms are saved (A11, no default rates).
 */
export function subscriptionSummary(sp, nameOf = (id) => id) {
  const sched = scheduleText(sp && sp.compensation);
  const head = sched ? `Year 1 / 2 / 3+: ${sched}` : "No terms saved: new customers earn nothing until terms are saved";
  const r = sp && sp.referral;
  let tail = "No override";
  if (r && r.referrerSalespersonId) {
    const who = nameOf(r.referrerSalespersonId) || r.referrerSalespersonId;
    tail = r.status === "active" && isBps(r.overrideRateBps)
      ? `Override ${pct(r.overrideRateBps)} to ${who}`
      : `Override to ${who} ended`;
  }
  return `${head} · ${tail}`;
}

const TYPE_WORDS = { gift_boxes: "gift boxes", merch: "merch", flowers: "flowers" };
function typesText(types) {
  const w = (Array.isArray(types) ? types : []).map((t) => TYPE_WORDS[t] || t);
  if (w.length === 0) return "no gift types";
  if (w.length === 1) return w[0];
  return `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}`;
}
function durationText(d) {
  if (!d || d.mode === "ongoing") return "ongoing";
  if (d.mode === "first_gift_only") return "first gift only";
  if (d.mode === "months_from_first_gift") return `${d.months} month${d.months === 1 ? "" : "s"} from first gift`;
  return "";
}

/**
 * Gift commission, from the stored `current` setting. A customer_schedule setting shows the salesperson's saved schedule
 * (what new customers are frozen on); existing customers keep the schedule frozen when they started.
 * `state` is "loading" | "error" | "ready".
 */
export function giftSummary(cur, compensation, state = "ready") {
  if (state === "loading") return "Loading…";
  if (state === "error") return "Could not load gift commission terms";
  if (!cur) return "Not set: nothing accrues";
  if (cur.enabled !== true) return "Disabled: nothing accrues";
  const rate = cur.rateSource === "customer_schedule"
    ? `Inherited (${inheritedRatesText(compensation) || "no subscription terms saved"})`
    : `${pct(cur.rateBps)} of margin`;
  return `${rate} · ${durationText(cur.duration)} · ${typesText(cur.eligibleTypes)}`;
}

/** Commission activity, from the server's summary figures. `money(minor)` formats minor units. */
export function activitySummary(summary, money) {
  if (!summary) return "Not loaded";
  const parts = [
    ["Pending", summary.pendingCommissionMinor],
    ["Approved", summary.approvedCommissionMinor],
    ["Paid", summary.paidCommissionMinor],
  ].filter(([, v]) => Number.isSafeInteger(v));
  if (parts.length === 0) return "No figures";
  return parts.map(([k, v]) => `${k} ${money(v)}`).join(" · ");
}

/**
 * Links section, closed row (founder 2026-10-19): the status indicators of every link - the shareable link, the private
 * tracking link and the QR Cash gift link - so their states stay visible while their boxes are not shown.
 */
export function linksSummary(info, sp) {
  if (!info || info.state === "loading") return "Loading…";
  if (info.state === "unavailable") return sp && sp.referralSlug ? `Vanity URL: ${sp.referralSlug}` : "No vanity URL yet";
  if (info.state === "error") return "Links not available right now";
  const parts = [`Shareable link: ${info.vanityUrl ? (info.vanityActive ? "Active" : "Paused") : "Not assigned"}`];
  if (info.shareStatus) parts.push(`Private tracking link: ${info.shareStatus}`);
  if (info.claimStatus) parts.push(`QR Cash gift link: ${info.claimStatus}`);
  return parts.join(" · ");
}
