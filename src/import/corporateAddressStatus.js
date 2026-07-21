// src/import/corporateAddressStatus.js
//
// TEAM A — Slice 2B-1 DISPLAY-ONLY delivery-address status for the Corporate import PREVIEW.
// Pure, framework-free, Node-testable. This computes a preview badge only; it NEVER mutates,
// never calls a backend, and NEVER reports "verified" — verification is owned by the backend +
// a future authorized admin flow (Slice 2C). The backend (services/corporate/addressMeta.js)
// remains AUTHORITATIVE on commit; this mirrors its deterministic absent/incomplete/unknown-country
// rules so the preview matches what the backend will record as review_required/absent.

export const ADDRESS_KEYS = Object.freeze(["line1", "line2", "city", "state", "zip", "country"]);
export const ADDRESS_REQUIRED = Object.freeze(["line1", "city", "state", "zip", "country"]);

// Preview status values (NO "verified" — the FE must never claim an address is verified).
export const PREVIEW_STATUS = Object.freeze({
  ABSENT: "absent",             // no address supplied
  INCOMPLETE: "incomplete",     // a required field is missing
  UNKNOWN_COUNTRY: "unknown_country", // all required present but the country isn't recognized
  REVIEW: "review",             // complete + recognized country → needs backend/admin review
});

// Recognized country names/codes (mirrors the backend alias + ISO alpha-2 recognition, DISPLAY-ONLY).
const RECOGNIZED_NAMES = new Set([
  "united states", "united states of america", "usa", "u.s.", "u.s.a.", "america",
  "canada", "united kingdom", "uk", "great britain", "britain", "england", "scotland", "wales",
  "mexico", "australia", "germany", "deutschland", "france", "spain", "españa", "italy", "italia",
  "netherlands", "ireland", "new zealand", "japan", "india", "brazil", "brasil", "china",
  "south korea", "korea", "sweden", "norway", "denmark", "finland", "switzerland", "austria",
  "belgium", "portugal", "poland", "singapore", "hong kong", "south africa",
  "united arab emirates", "uae", "israel",
]);
const ISO_ALPHA2 = new Set((
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO " +
  "FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE " +
  "JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO " +
  "MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW " +
  "PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM " +
  "TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" "));

const _t = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
export function isRecognizedCountry(raw) {
  const v = _t(raw);
  if (!v) return false;
  if (v.length === 2 && ISO_ALPHA2.has(v.toUpperCase())) return true;
  return RECOGNIZED_NAMES.has(v.toLowerCase());
}

const LABELS = Object.freeze({
  [PREVIEW_STATUS.ABSENT]: "No delivery address",
  [PREVIEW_STATUS.INCOMPLETE]: "Incomplete address",
  [PREVIEW_STATUS.UNKNOWN_COUNTRY]: "Unrecognized country",
  [PREVIEW_STATUS.REVIEW]: "Needs review",
});

// Compute the preview status for a normalized 6-key shippingAddress (or null/undefined).
// Returns { status, label, missing }. Never "verified".
export function corporateAddressStatus(shippingAddress) {
  const a = shippingAddress || {};
  const present = ADDRESS_KEYS.some((k) => _t(a[k]));
  if (!present) return { status: PREVIEW_STATUS.ABSENT, label: LABELS.absent, missing: [] };
  const missing = ADDRESS_REQUIRED.filter((k) => !_t(a[k]));
  if (missing.length) return { status: PREVIEW_STATUS.INCOMPLETE, label: LABELS.incomplete, missing };
  if (!isRecognizedCountry(a.country)) return { status: PREVIEW_STATUS.UNKNOWN_COUNTRY, label: LABELS.unknown_country, missing: [] };
  return { status: PREVIEW_STATUS.REVIEW, label: LABELS.review, missing: [] };
}

// Whether a preview status blocks (future) automated physical-gift eligibility. Advisory only in 2B-1.
export const isPhysicalGiftEligible = (status) => status === PREVIEW_STATUS.REVIEW;
