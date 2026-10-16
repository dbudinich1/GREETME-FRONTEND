// src/pages/fundraiser/fundraiserP1Model.js
//
// Report 87 Part 1 (A7) — pure helpers shared by the founder and partner fundraiser screens (approved
// rev 6 layout). No React, no DOM, no fetch: every value shown comes from a server response passed in.
// Nothing here defaults a percentage, a date or a status.

/** Minor units (cents) -> "$1,234.56". null/undefined/non-finite -> "—" (never a fabricated 0). */
export function money(minor) {
  const n = Number(minor);
  if (minor === null || minor === undefined || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  return `${sign}$${(Math.abs(n) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "2026-Q4" -> "2026 Q4" (display only). */
export function quarterLabel(key) {
  const m = /^(\d{4})-Q([1-4])$/.exec(String(key || ""));
  return m ? `${m[1]} Q${m[2]}` : String(key || "");
}

/** ISO instant -> "YYYY-MM-DD" (UTC). Anything unparseable -> "". */
export function isoDate(iso) {
  if (typeof iso !== "string" || iso === "") return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toISOString().slice(0, 10);
}

// ── Year 1 / Year 2 / Year 3+ terms (contract A9: rules = { kind: "year_rates", basis: "ENSR", yearRates }) ──

export const YEAR_KEYS = Object.freeze([["y1", "year_1"], ["y2", "year_2"], ["y3", "year_3_plus"]]);
const PCT_RE = /^\d{1,3}(\.\d{1,2})?$/;

/** Validate the three typed percentages exactly as rev 6 does. Returns { ok, errors, yearRates }. */
export function validateYearRates(value = {}) {
  const errors = {};
  const yearRates = {};
  for (const [k, key] of YEAR_KEYS) {
    const t = String(value[k] ?? "").trim();
    if (!PCT_RE.test(t) || Number(t) > 100) errors[k] = "Enter 0–100, up to 2 decimals.";
    else yearRates[key] = Number(t);
  }
  const ok = Object.keys(errors).length === 0;
  return { ok, errors, yearRates: ok ? yearRates : null };
}

/** The A9 rule object sent to the existing draft / change-rate routes. */
export function buildYearRatesRule(yearRates) {
  return { kind: "year_rates", basis: "ENSR", yearRates: { ...yearRates } };
}

/**
 * A calendar date "YYYY-MM-DD" -> the instant 00:00 UTC on that date. Strict: a date that does not
 * exist (2026-02-30) is refused rather than rolled forward. Returns { ok, iso } | { ok:false, error }.
 */
export function dateToUtcInstant(date) {
  const text = String(date ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return { ok: false, error: "Choose when the terms take effect." };
  const iso = `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.toISOString() !== iso) return { ok: false, error: "That date does not exist. Check the day and month." };
  return { ok: true, iso };
}

const pct = (n) => `${n}%`;

/** One line for a rules object (a stored economics version's `rules`, or the partner terms read). */
export function termsLine(rules) {
  if (!rules || typeof rules !== "object") return "Not set";
  const yr = rules.yearRates;
  if (rules.kind === "year_rates" && yr && typeof yr === "object") {
    return `Year 1 ${pct(yr.year_1)} · Year 2 ${pct(yr.year_2)} · Year 3+ ${pct(yr.year_3_plus)}`;
  }
  // Terms recorded before Year 1 / 2 / 3+ existed (existing rule kinds, unchanged by the contract).
  const share = (s) => (s && s.type === "percent_of_base" && typeof s.percent === "number" ? pct(s.percent)
    : s && s.type === "none" ? "none" : null);
  const initial = share(rules.initialSubscriptionShare || rules.initialShare);
  const renewal = share(rules.renewalShare);
  if (initial !== null || renewal !== null) return `First payment ${initial ?? "—"} · Renewals ${renewal ?? "—"}`;
  return "Set (other terms)";
}

/** Normalise the partner GET /terms body ({ terms: { kind, yearRates | initialShare/renewalShare } | null }). */
export function partnerTermsRules(terms) {
  if (!terms || typeof terms !== "object") return null;
  if (terms.kind === "year_rates") return { kind: "year_rates", yearRates: terms.yearRates };
  return { initialShare: terms.initialShare, renewalShare: terms.renewalShare };
}

/**
 * The organization's terms in force: the ACTIVE economics version whose window is still open
 * (effectiveThrough null) across the organization's campaigns — the same definition the server uses
 * for "the organization's current rate". `histories` is an array of economics-history arrays.
 */
export function activeTermsFromHistories(histories = []) {
  const open = [];
  for (const list of histories) {
    if (!Array.isArray(list)) continue;
    for (const v of list) {
      if (v && v.status === "active" && (v.effectiveThrough === null || v.effectiveThrough === undefined)) open.push(v);
    }
  }
  if (open.length === 0) return null;
  open.sort((a, b) => (Date.parse(b.effectiveFrom || "") || 0) - (Date.parse(a.effectiveFrom || "") || 0));
  return open[0];
}

// ── Organization status as the rev 6 screens present it ──

/** applied -> prepared ("Not active yet"); approved + relationship ended -> ended; else the status. */
export function partnerStatus(org) {
  if (!org || typeof org !== "object") return "unknown";
  if (org.status === "applied") return "prepared";
  if (org.status === "approved") return org.relationship && org.relationship.status === "ended" ? "ended" : "active";
  return org.status || "unknown";
}

/** The most recent ended interval of the relationship, or null. */
export function lastEndedInterval(org) {
  const list = org && org.relationship && Array.isArray(org.relationship.intervals) ? org.relationship.intervals : [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i] && list[i].endedAt) return list[i];
  return null;
}

// ── Truthful failure text. Machine codes only SELECT a sentence; they are never rendered. ──

const CODE_TEXT = Object.freeze({
  NOT_APPLIED: "This partner is no longer waiting for activation. Reload to see where it stands.",
  ORG_NOT_ACTIVE: "This partner isn’t active, so campaigns can’t be added or started.",
  ORG_NOT_APPROVED: "This partner isn’t active, so campaigns can’t be added or started.",
  TERMS_NOT_ACTIVE: "This can’t go ahead until the partner share is in place.",
  NO_PARTNER_ADMIN: "Assign a partner administrator before activating.",
  NO_ACTIVE: "There are no terms in force to change yet.",
  ETAG_MISMATCH: "This changed while you were looking at it. Reload and try again.",
  BAD_TRANSITION: "That change is no longer possible from the current status. Reload to see where it stands.",
  NOT_FOUND: "That record no longer exists. Nothing was changed.",
  OVERLAP: "That date overlaps or comes before the terms already in force. Choose a later date.",
  EFFECTIVE_FROM_INVALID: "That date overlaps or comes before the terms already in force. Choose a later date.",
  RATE_MISMATCH: "These terms differ from the partner’s current terms. Use Change terms to move every campaign together.",
  INCOMPLETE: "These terms are incomplete, so they can’t be saved.",
  DUPLICATE_ORGANIZATION: "A partner with this legal name already exists.",
  SALESPERSON_NOT_FOUND: "That salesperson wasn’t found.",
  SALESPERSON_INACTIVE: "That salesperson isn’t active.",
  USER_IS_FOUNDER: "A platform founder cannot be a partner administrator.",
  USER_NOT_FOUND: "No Greet-Me account was found for that person.",
});
const STATUS_TEXT = Object.freeze({
  400: "That was rejected. Nothing was changed.",
  401: "Your session has expired. Sign in again. Nothing was changed.",
  403: "Your account can’t make this change. Nothing was changed.",
  404: "That record no longer exists. Nothing was changed.",
  409: "This changed while you were looking at it. Reload and try again.",
  423: "Changes are on hold right now. Nothing was changed.",
  503: "Fundraising is not currently enabled. Nothing was changed.",
});

export function failureText(res) {
  if (!res || res.networkError || res.status === 0) return "Couldn’t reach the server. Nothing was changed.";
  const code = res.data && typeof res.data.code === "string" ? res.data.code : "";
  if (code && CODE_TEXT[code]) return CODE_TEXT[code];
  return STATUS_TEXT[res.status] || "That didn’t go through. Nothing was changed.";
}

/** A5 rows -> a lookup by key. Malformed bodies yield an empty map (never invented rows). */
export function totalsByKey(body) {
  const rows = body && Array.isArray(body.rows) ? body.rows : [];
  const map = new Map();
  for (const r of rows) if (r && r.key !== undefined && r.key !== null) map.set(String(r.key), r);
  return map;
}

/**
 * Quarterly gross (existing founder route) for ONE organization -> display rows. Uses the A6 split
 * (subscriptionGrossCents / brandedGoodsGrossCents) when the server provides it.
 */
export function quarterlyRows(body, organizationId) {
  const orgs = body && Array.isArray(body.organizations) ? body.organizations : [];
  const org = orgs.find((o) => o && o.organizationId === organizationId) || (orgs.length === 1 ? orgs[0] : null);
  if (!org) return { rows: [], split: false };
  const q = org.quarters && typeof org.quarters === "object" ? org.quarters : {};
  const rows = Object.keys(q).sort().map((k) => ({ key: k, label: quarterLabel(k), ...q[k] }));
  if (org.unsettled && (org.unsettled.records > 0 || org.unsettled.grossCents > 0)) {
    rows.push({ key: "unsettled", label: "Not yet settled", ...org.unsettled });
  }
  const split = rows.some((r) => typeof r.subscriptionGrossCents === "number" || typeof r.brandedGoodsGrossCents === "number");
  return { rows, split };
}

/** Founder rule (A7): Branded Goods partner amounts are not calculated yet (Part 2 held). */
export const BRANDED_GOODS_NOT_CALCULATED = "Branded Goods purchases are recorded; partner amounts for them are not calculated yet.";
