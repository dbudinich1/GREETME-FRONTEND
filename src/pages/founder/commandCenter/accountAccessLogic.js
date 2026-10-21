// Pure text and helpers for the Sending and recipients panel (AccountAccessPanel.jsx). Tested without a browser.

export const GRANT_MAX = 1000;

const REASONS = {
  OK: "Sending is allowed.",
  UNLIMITED_OVERRIDE: "Unlimited sending is on.",
  TRIAL_EXPIRED: "Blocked: the free trial has ended and no one-time sends remain.",
  LIMIT_EXCEEDED: "Blocked: this period’s sends are used up.",
  WALLET_EXHAUSTED: "Blocked: no Greet-Mes left this month.",
  ANYTIME_OVERFLOW: "Allowance used; sending continues on purchased Anytime credits.",
  EMAIL_NOT_VERIFIED: "Blocked: the account’s email address is not confirmed yet.",
  LOOP_EXEMPT: "Sending is allowed.",
};

export function reasonText(access, controls) {
  const base = REASONS[access && access.reasonCode] || (access && access.canSend ? "Sending is allowed." : "Blocked.");
  if (access && access.reasonCode === "OK" && access.period === "trial" && access.trialActive === false && !(controls && controls.unlimitedSending)) {
    return "Sending is allowed on one-time sends (the free trial has ended).";
  }
  return base;
}

const lim = (n) => (n === null || n === undefined ? "no limit" : String(n));

export function recipientLimitText(recipients, controls) {
  const limit = recipients.limit;
  const used = `${recipients.count} recipient${recipients.count === 1 ? "" : "s"}`;
  const source = controls && controls.unlimitedSending ? "removed by unlimited sending"
    : recipients.override === null || recipients.override === undefined ? "plan limit"
    : recipients.override === "unlimited" ? "custom: no limit" : `custom; plan limit ${lim(recipients.planLimit)}`;
  const over = limit !== null && recipients.count > limit ? " · above the limit: contacts kept, none can be added" : "";
  return limit === null ? `${used}, no limit (${source})` : `${used} of ${limit} (${source})${over}`;
}

export function accessSummary(view) {
  const { access, controls, recipients } = view;
  const sends = controls.unlimitedSending ? "Unlimited sending" : `${access.canSend ? "Can send" : "Blocked"} · ${access.remaining ?? 0} of ${access.limit} left`;
  return `${sends} · recipients ${recipients.count}${recipients.limit === null ? ", no limit" : ` of ${recipients.limit}`}`;
}

function fmtAt(at) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return String(at || "");
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";
}

/** One audit row in plain words, with before → after. */
export function changeText(a) {
  const b = a.before || {}, f = a.after || {};
  let what;
  if (a.kind === "grant") what = `Granted ${a.result && a.result.sends} one-time sends (one-time sends total ${b.bonusGreetings} → ${f.bonusGreetings})`;
  else if (a.kind === "unlimited") what = `Unlimited sending ${b.unlimitedSending ? "on" : "off"} → ${f.unlimitedSending ? "on" : "off"}`;
  else if (a.kind === "recipient_limit") {
    const show = (s) => (s.recipientLimitOverride === null || s.recipientLimitOverride === undefined ? `plan (${lim(s.planRecipientLimit)})` : s.recipientLimitOverride === "unlimited" ? "no limit" : String(s.recipientLimitOverride));
    what = `Recipient limit ${show(b)} → ${show(f)}`;
  } else what = "Change";
  const who = a.actorId ? `founder account …${String(a.actorId).slice(-6)}` : "founder account";
  return `${fmtAt(a.at)} · ${what} · by ${who}`;
}

export function newChangeId() {
  const c = typeof globalThis !== "undefined" && globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

const CODES = {
  GRANT_REFILLS_ON_MONTHLY_PLAN: "One-time grants are available on free-trial accounts only. On a monthly plan a grant would be added again every month.",
  GRANT_NOT_NEEDED_UNLIMITED: "This account has unlimited sending, so a grant would have no effect.",
  GRANT_SENDS_INVALID: `Enter a whole number of sends from 1 to ${GRANT_MAX}.`,
  RECIPIENT_LIMIT_INVALID: "Enter a whole number from 0 to 10000, or choose Plan limit or No limit.",
  ACCOUNT_CHANGED: "The account changed while saving. Close this, check the latest values and try again.",
  NO_LINKED_ACCOUNT: "No account is linked to this salesperson any more.",
  ACCOUNT_NOT_FOUND: "The linked account no longer exists.",
  CHANGE_ID_REUSED: "This change could not be applied. Close this and start again.",
};

export function controlErrorMessage(res) {
  if (!res) return "That didn’t go through. Please try again.";
  if (res.networkError) return "Couldn’t reach the server. Nothing is applied twice if you try again.";
  const code = res.data && res.data.code;
  if (code && CODES[code]) return CODES[code];
  if (res.status === 401) return "Your session has expired. Sign in again to continue.";
  if (res.status === 403) return "This area is limited to the founder account.";
  if (res.status === 429) return "Too many changes in a short time. Wait a few minutes and try again.";
  return "That didn’t go through. Try again; it will not be applied twice.";
}

// ── Salesperson list: Active | Inactive view (default Active) with search inside the selected view ──
export const STATUS_VIEWS = Object.freeze([{ key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }]);
/** Same rule as the profile's Status row: inactive when status is "inactive" (or a legacy active:false); otherwise active. */
export function isInactiveRow(r) {
  if (!r) return false;
  if (r.status) return String(r.status) !== "active";
  return r.active === false;
}
export function salespersonView(rows, view, search) {
  const q = String(search || "").trim().toLowerCase();
  return (Array.isArray(rows) ? rows : []).filter((r) => {
    const isActive = !isInactiveRow(r);
    if ((view === "inactive") === isActive) return false;
    if (!q) return true;
    return [r.displayName, r.salespersonId, r.email].some((v) => typeof v === "string" && v.toLowerCase().includes(q));
  });
}
