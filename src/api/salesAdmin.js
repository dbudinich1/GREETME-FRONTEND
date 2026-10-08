// src/api/salesAdmin.js
//
// TEAM B — SALES S1 · founder-only salesperson management client.
//
// This is a thin transport over endpoints that ALREADY exist and are already founder-guarded
// server-side (`routes/salesRoutes.js`, every admin route behind `requireAuth, requireFounder`).
// It adds no capability. The backend remains the authority: this client never decides who may
// call anything, and a founder-only UI is a convenience, never a control.
//
// Deliberately mirrors `fundraiserApi.js` — same Bearer-from-localStorage read, same
// `{ ok, status, data }` envelope, same network-failure shape — so there is one request story in
// this codebase rather than two.
//
// TOKEN HANDLING, stated once and enforced throughout:
// the raw attribution token is returned by create and rotate EXACTLY ONCE. It is passed straight
// back to the caller and is never written to localStorage, sessionStorage, a cookie, a query
// string, or a log line by this module. Nothing here persists it, so a refresh cannot reproduce
// it — that is a property of the code, not a promise.

const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || "";

function authHeaders(extra = {}) {
  let token = null;
  try { token = localStorage.getItem("token"); } catch { /* no-op */ }
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function req(method, endpoint, body) {
  let res, data = null;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: body ? authHeaders({ "Content-Type": "application/json" }) : authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: null, networkError: true };
  }
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

const get = (e) => req("GET", e);
const post = (e, b) => req("POST", e, b);

const BASE = "/api/sales/admin/salespeople";
const one = (id) => `${BASE}/${encodeURIComponent(id)}`;

export const salesAdminApi = {
  /** GET /api/sales/admin/salespeople → { ok, salespeople: [...] } */
  list: () => get(BASE),

  /** GET /api/sales/admin/salespeople/:id → { ok, salesperson } | 404 */
  read: (salespersonId) => get(one(salespersonId)),

  /**
   * POST /api/sales/admin/salespeople
   *
   * `email` is OPTIONAL server-side and is omitted entirely when blank rather than sent as "",
   * because the backend's own comment is explicit that an invented address is indistinguishable
   * from a real one once stored.
   *
   * 201 → { ok, salesperson, attributionToken, attributionLink }  ← the link is shown ONCE
   * 400 → invalid request · 409 → already exists
   */
  create: ({ salespersonId, displayName, email } = {}) => {
    // Trimmed HERE, not only in the page. A stray space in an identifier is indistinguishable
    // from a deliberate one once stored, and the client is the last place that can see both.
    const str = (v) => (typeof v === "string" ? v.trim() : v);
    const body = { salespersonId: str(salespersonId), displayName: str(displayName) };
    const mail = str(email);
    if (mail) body.email = mail;
    return post(BASE, body);
  },

  /**
   * PUT …/referral-slug — assign, replace, or REMOVE the vanity alias.
   *
   * The backend treats `null` and `""` as removal, and touches `referralSlug` and nothing else:
   * no token rotation, no status change, no attribution history. Passing null here is therefore a
   * removal, not an accidental blank assignment.
   *
   * 200 → { ok, salesperson, publicReferralLink }   (publicReferralLink is null once removed)
   * 400 → slug_* validation reason · 409 → SLUG_TAKEN / slug_reserved · 404 → unknown salesperson
   */
  setReferralSlug: (salespersonId, referralSlug) =>
    req("PUT", `${one(salespersonId)}/referral-slug`, {
      referralSlug: typeof referralSlug === "string" ? referralSlug.trim() : null,
    }),

  removeReferralSlug: (salespersonId) =>
    req("PUT", `${one(salespersonId)}/referral-slug`, { referralSlug: null }),

  /**
   * PUT …/linked-user — link, replace, or REMOVE the salesperson's own Greet-Me account.
   *
   * This is what makes the gift-claim sales-attribution source work: a recipient who claims a
   * QR Cash gift sent by THIS account can be attributed to this salesperson. Same null/""-is-
   * removal contract as the referral slug above, and touches `linkedUserId` and nothing else.
   *
   * The caller resolves an email to a userId FIRST (see fundraiserApi.founder.resolveUserByEmail,
   * the same founder-only exact-match resolver already used for corporate partner-admin
   * assignment) — this method takes the resolved userId, never a raw email.
   *
   * 200 → { ok, salesperson } · 400 → INVALID_LINKED_USER · 409 → USER_ALREADY_LINKED ·
   * 404 → unknown salesperson
   */
  linkUser: (salespersonId, linkedUserId) =>
    req("PUT", `${one(salespersonId)}/linked-user`, { linkedUserId }),

  unlinkUser: (salespersonId) =>
    req("PUT", `${one(salespersonId)}/linked-user`, { linkedUserId: null }),

  /**
   * PUT …/compensation — set the terms that will apply to this salesperson's NEXT originated
   * customer.
   *
   * This is deliberately FORWARD-ONLY. Terms are frozen onto each customer's origination record
   * when that customer is first originated, so saving here cannot change what an existing customer
   * has generated or will generate, and cannot alter a single ledger entry.
   *
   * Both fields accept null: `compensation: null` restores the platform default schedule
   * (25% / 15% / 10%), and `referral: null` removes the override entirely.
   *
   * `referrerSalespersonId` is a PERMANENT salesperson id chosen from the existing directory —
   * never a vanity slug, which is a re-assignable display string and must never carry financial
   * identity.
   *
   * 200 → { ok, salesperson } · 400 → INVALID_COMPENSATION / INVALID_REFERRAL / SELF_REFERRAL /
   * REFERRER_NOT_FOUND / REFERRAL_CHAIN_TOO_DEEP · 404 → unknown salesperson
   */
  setCompensation: (salespersonId, { compensation = null, referral = null } = {}) =>
    req("PUT", `${one(salespersonId)}/compensation`, { compensation, referral }),

  /**
   * POST …/rotate-token — mints a NEW opaque token and invalidates the previous one.
   *
   * DESTRUCTIVE. The response carries the replacement link exactly once; there is no route that
   * returns an existing token, by design, so a rotation that is not captured is not recoverable.
   */
  rotateToken: (salespersonId) => post(`${one(salespersonId)}/rotate-token`, {}),

  /** POST …/status — "active" | "inactive". Deactivation stops NEW attribution only. */
  setStatus: (salespersonId, status) => post(`${one(salespersonId)}/status`, { status }),

  // ── B3 · READ-ONLY REPORTING ────────────────────────────────────────────────────────────
  // Every one of these is a GET. There is no founder endpoint that mutates reporting data, and
  // none is invented here. Money arrives in MINOR UNITS (`*Minor`); the summary carries no
  // currency of its own, so this client never attaches one — the ledger's per-entry `currency`
  // is the only currency the server states, and it is passed through untouched.

  /** GET …/summary → { ok, summary } — aggregated from the ledger, never from customer docs. */
  summary: (salespersonId) => get(`${one(salespersonId)}/summary`),

  /** GET …/attribution-health → { ok, attributionHealth, controls } — counts only, no PII. */
  attributionHealth: (salespersonId) => get(`${one(salespersonId)}/attribution-health`),

  /** GET …/ledger → { ok, entries } — the raw commission entries. */
  ledger: (salespersonId) => get(`${one(salespersonId)}/ledger`),

  // ── MANUAL PAYOUT (founder decision 2026-10-07 #12). Records a payment the founder made by hand; no money moves. ──
  /** POST …/ledger/:entryId/approve → { ok, noop, entry, summary }. pending -> approved. 404 / 409 (reason) when refused. */
  approveCommission: (salespersonId, entryId) =>
    post(`${one(salespersonId)}/ledger/${encodeURIComponent(entryId)}/approve`, {}),
  /** POST …/ledger/:entryId/record-payment body { reference, paidOn: "YYYY-MM-DD", note? } → { ok, noop, entry, summary }. approved -> paid. */
  recordCommissionPayment: (salespersonId, entryId, { reference, paidOn, note } = {}) =>
    post(`${one(salespersonId)}/ledger/${encodeURIComponent(entryId)}/record-payment`, {
      reference: typeof reference === "string" ? reference.trim() : reference,
      paidOn,
      ...(typeof note === "string" && note.trim() ? { note: note.trim() } : {}),
    }),

  /**
   * GET /admin/pending/:userId → { ok, pending }
   *
   * Takes ONE deliberately supplied user id. There is no list form and none is added: pending
   * attribution is looked up for a person the founder already has in hand, never enumerated.
   */
  pendingForUser: (userId) => get(`/api/sales/admin/pending/${encodeURIComponent(userId)}`),

  /** GET /admin/controls → { ok, controls } — read-only. No endpoint can flip a flag. */
  controls: () => get("/api/sales/admin/controls"),

  // ── COMMAND CENTER READS (W50 tracker, assigned links, gift sales). All GET, founder-only, read-only. ──
  // `period` is one of 7 | 30 | 90 | all. Shapes: reports/closeout-sprint/contracts/T3-command-center-backend-contract.md
  /** GET /admin/performance?period= -> { ok, period, currency, payouts, salespeople:[...] } */
  performance: (period = "30") => get(`/api/sales/admin/performance?period=${encodeURIComponent(period)}`),
  /** GET /admin/salespeople/:id/performance?period= */
  performanceOne: (salespersonId, period = "30") => get(`${one(salespersonId)}/performance?period=${encodeURIComponent(period)}`),
  /** GET /admin/salespeople/:id/customers?period=&limit= (masked) */
  customers: (salespersonId, period = "all", limit = 200) => get(`${one(salespersonId)}/customers?period=${encodeURIComponent(period)}&limit=${limit}`),
  /** GET /admin/salespeople/:id/links -> assigned link states (never a token) */
  assignedLinks: (salespersonId) => get(`${one(salespersonId)}/links`),
  /** GET /admin/salespeople/:id/gift-sales?period= -> informational only */
  giftSales: (salespersonId, period = "30") => get(`${one(salespersonId)}/gift-sales?period=${encodeURIComponent(period)}`),

  /** GET /admin/salespeople/:id/gift-commission -> { ok, giftCommission:{ current, history } } (founder only) */
  giftCommission: (salespersonId) => get(`${one(salespersonId)}/gift-commission`),
  /**
   * PUT /admin/salespeople/:id/gift-commission body { enabled, rateBps, duration, eligibleTypes, effectiveFrom? }.
   * Records TERMS only: effective-dated, never retroactive, previous terms move to an append-only history. Accrues nothing
   * by itself (a platform switch and marker must also be live). 400 carries a `reason` code (mapped to plain words by the UI).
   */
  setGiftCommission: (salespersonId, body) => req("PUT", `${one(salespersonId)}/gift-commission`, body),
};

/**
 * Turn a transport envelope into one sentence a founder can act on.
 *
 * Deliberately NOT a passthrough of the server's `code`: internal codes, stack traces and flag
 * names are not user-facing text. Unknown failures fall back to a plain, honest sentence rather
 * than exposing whatever the backend happened to say.
 */
export function salesAdminErrorMessage(res, { context = "load" } = {}) {
  if (!res) return "That didn’t go through. Please try again.";
  if (res.networkError) return "Couldn’t reach the server. Check your connection and try again.";
  switch (res.status) {
    case 401: return "Your session has expired. Sign in again to continue.";
    case 403: return "This area is limited to the founder account.";
    case 404: return context === "read" ? "That salesperson no longer exists." : context === "payout" ? "That commission entry was not found for this salesperson." : "Not found.";
    case 409: {
      if (context === "payout") {
        const why = res.data && res.data.reason;
        // The server (services/sales/commissionPayout.js) returns REVERSED both when refunds or disputes leave nothing
        // to pay AND when the entry is no longer in a state that step accepts (e.g. approving a non-pending entry),
        // so the sentence must be true in both cases.
        if (why === "REVERSED") return "This commission can’t be approved or paid in its current state. Refresh the page to see its latest status.";
        if (why === "NOT_APPROVED") return "Approve this commission first, then record the payment.";
        if (why === "PAYMENT_ALREADY_RECORDED") return "A different payment is already recorded for this commission.";
        return "This commission changed while you were working. Reload the page and check it.";
      }
      // The slug conflict, the linked-user conflict and the duplicate-id conflict share a status
      // but mean different things, and the server distinguishes them with `reason`. Reported
      // truthfully rather than merged.
      const reason = res.data && res.data.reason;
      if (reason === "SLUG_TAKEN") return "That vanity URL is already taken. Try another.";
      if (reason === "slug_reserved") return "That vanity URL is reserved. Try another.";
      if (reason === "USER_ALREADY_LINKED") return "That account is already linked to a different salesperson.";
      if (context === "slug") return "That vanity URL isn’t available. Try another.";
      return "A salesperson with that ID already exists. Choose a different ID.";
    }
    case 400:
      // slug_*/INVALID_LINKED_USER reasons are machine codes, never shown raw.
      if (context === "slug") return "That vanity URL isn’t valid. Use letters, numbers and hyphens.";
      if (context === "linkedUser") return "Enter a valid email address.";
      if (context === "payout") return "Enter a payment reference and a valid date that is not in the future.";
      return "Check the details and try again.";
    default:  return "That didn’t go through. Please try again.";
  }
}

export default salesAdminApi;
