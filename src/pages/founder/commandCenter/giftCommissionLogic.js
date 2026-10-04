// Gift commission settings: pure helpers (no network, no React). Contract: reports/closeout-sprint/contracts/T3-gift-commission-contract.md.
// The base is a share of Greet-Me's MARGIN on a gift, set per salesperson. Smart Card and QR Cash never earn.

/** The backend does NOT expose the platform switch to the browser (GET /admin/controls reports only the referral/attribution
 *  switches), so the "OFF platform-wide" banner is a static note. Flip this only if a real read is wired. */
export const GIFT_COMMISSION_PLATFORM_SWITCH_READABLE = false;
export const GIFT_COMMISSION_BANNER = "Gift commission is OFF platform-wide until you activate it, and payouts are off. Saving terms here only records them: nothing accrues, and nothing is paid, until activation.";

/** What the founder can pick. `selectable:false` rows are shown but cannot be chosen. */
export const GIFT_TYPE_OPTIONS = [
  { id: "gift_boxes", label: "Gift boxes", selectable: true, note: "Earns on Greet-Me's mark-up on the gift box." },
  { id: "merch", label: "Merch", selectable: true, note: "Accrues nothing while the merch mark-up is off." },
  { id: "flowers", label: "Flowers", selectable: false, note: "Not available yet: it is refused until a definition is approved." },
];
export const NEVER_EARN = [
  { id: "qrcash", label: "QR Cash", note: "Never earns." },
  { id: "gift_cards", label: "Smart Card", note: "Never earns." },
];
const TYPE_WORDS = { gift_boxes: "gift boxes", merch: "merch", flowers: "flowers" };

export const DURATION_MODES = [
  { id: "first_gift_only", label: "First gift only" },
  { id: "months_from_first_gift", label: "A number of months from the first gift" },
  { id: "ongoing", label: "Ongoing" },
];

export const blankDraft = () => ({ enabled: true, ratePercent: "", mode: "first_gift_only", months: "12", types: [], startDate: "" });

/** Draft from the stored `current` block (or blank when nothing is set). */
export function draftFromCurrent(cur) {
  if (!cur) return blankDraft();
  return {
    enabled: cur.enabled === true,
    ratePercent: Number.isFinite(cur.rateBps) ? String(cur.rateBps / 100) : "",
    mode: cur.duration && cur.duration.mode ? cur.duration.mode : "first_gift_only",
    months: cur.duration && cur.duration.months ? String(cur.duration.months) : "12",
    types: Array.isArray(cur.eligibleTypes) ? cur.eligibleTypes.filter((t) => GIFT_TYPE_OPTIONS.some((o) => o.id === t && o.selectable)) : [],
    startDate: "",
  };
}

/** @returns {{errors:Object, payload:Object|null}} payload is the exact PUT body when valid. `now` is injectable for tests. */
export function validateDraft(d, now = new Date()) {
  const errors = {};
  let rateBps = null;
  const raw = String(d.ratePercent ?? "").trim();
  if (d.enabled || raw !== "") {
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) errors.rate = "Enter the percentage of Greet-Me's margin, for example 20.";
    else if (n < 0 || n > 100) errors.rate = "The percentage must be between 0 and 100.";
    else if (Math.round(n * 100) / 100 !== n) errors.rate = "Use at most two decimal places.";
    else rateBps = Math.round(n * 100);
  } else rateBps = 0;
  let duration = { mode: d.mode };
  if (!DURATION_MODES.some((m) => m.id === d.mode)) errors.duration = "Choose how long it earns.";
  else if (d.mode === "months_from_first_gift") {
    const m = Number(d.months);
    if (!Number.isInteger(m) || m < 1 || m > 120) errors.months = "Enter a whole number of months from 1 to 120.";
    else duration = { mode: d.mode, months: m };
  }
  const types = (d.types || []).filter((t) => GIFT_TYPE_OPTIONS.some((o) => o.id === t && o.selectable));
  if (d.enabled && types.length === 0) errors.types = "Choose at least one gift type.";
  let effectiveFrom;
  if (d.startDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.startDate) || Number.isNaN(Date.parse(`${d.startDate}T00:00:00.000Z`))) errors.startDate = "Use the date format YYYY-MM-DD.";
    else {
      const t = Date.parse(`${d.startDate}T00:00:00.000Z`);
      // Midnight UTC of today has already passed, so "today" means "now": leave effectiveFrom out. Only a later day is sent.
      const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      if (t < todayStart) errors.startDate = "The start date cannot be in the past. Terms apply to future sales only.";
      else if (t > todayStart) effectiveFrom = new Date(t).toISOString();
    }
  }
  if (Object.keys(errors).length) return { errors, payload: null };
  const payload = { enabled: !!d.enabled, rateBps, duration, eligibleTypes: d.enabled ? types : types };
  if (effectiveFrom) payload.effectiveFrom = effectiveFrom;
  return { errors, payload };
}

const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : "");
export function typesPhrase(types) {
  const w = (types || []).map((t) => TYPE_WORDS[t] || t);
  if (w.length <= 1) return w[0] || "no gift types";
  return `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}`;
}
export function durationPhrase(dur) {
  if (!dur) return "";
  if (dur.mode === "first_gift_only") return "on the first gift only";
  if (dur.mode === "months_from_first_gift") return `for ${dur.months} month${dur.months === 1 ? "" : "s"} from the first gift`;
  return "for as long as they stay active (ongoing)";
}
/** Plain-language summary of a setting (stored block or validated payload). `startsOn` is a display date. */
export function summaryLine(s, startsOn) {
  if (!s || s.enabled !== true) return "Gift commission is off for this salesperson: nothing accrues.";
  const pct = s.rateBps / 100;
  const dur = s.duration || {};
  const when = startsOn ? ` starting ${startsOn}` : "";
  if (dur.mode === "first_gift_only") return `Earns ${pct}% of Greet-Me's margin on ${typesPhrase(s.eligibleTypes)}, on the first gift only${when}.`;
  if (dur.mode === "months_from_first_gift") return `Earns ${pct}% of Greet-Me's margin on ${typesPhrase(s.eligibleTypes)} for ${dur.months} month${dur.months === 1 ? "" : "s"}${when}.`;
  return `Earns ${pct}% of Greet-Me's margin on ${typesPhrase(s.eligibleTypes)}, ongoing${when}.`;
}

export function historyRows(gc) {
  const h = gc && Array.isArray(gc.history) ? gc.history : [];
  return h.slice().reverse().map((x, i) => ({
    key: `${x.setAt || ""}-${i}`, effectiveFrom: fmtDate(x.effectiveFrom), setAt: fmtDate(x.setAt), setBy: x.setBy || "",
    text: summaryLine(x, ""),
  }));
}

/** Contract reasons -> one plain sentence. Never shows the raw code. */
export function giftCommissionErrorMessage(res) {
  if (!res) return "That didn't go through. Please try again.";
  if (res.networkError) return "Couldn't reach the server. Check your connection and try again.";
  switch (res.status) {
    case 401: return "Your session has expired. Sign in again to continue.";
    case 403: return "Gift commission settings are limited to the founder account.";
    case 404: return "That salesperson no longer exists.";
    case 429: return "Too many requests. Wait a moment and try again.";
    case 400: {
      const reason = res.data && res.data.reason;
      return ({
        rate_out_of_range: "The percentage must be between 0 and 100.",
        duration_invalid: "The duration is not valid. Choose a duration, and for months enter 1 to 120.",
        eligible_types_required: "Choose at least one gift type.",
        ineligible_type: "One of the chosen gift types can never earn commission (QR Cash and Smart Card never do) or is not available yet.",
        effective_from_in_the_past: "The start date cannot be in the past. Terms apply to future sales only.",
      })[reason] || "Those terms were not accepted. Check the highlighted fields.";
    }
    default: return "That didn't go through. Please try again.";
  }
}
