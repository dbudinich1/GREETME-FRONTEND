// src/api/corporatePayments.js
//
// TEAM I (CONNECTION D) — client for the authenticated corporate saved-card routes mounted at
// /api/corporate-payments. It consumes ONLY the four routes that already exist and adds none.
//
// WHAT THIS FILE IS ALLOWED TO CARRY. Card data never passes through here. The client secret the
// setup-intent route returns is handed straight to Stripe.js by the caller and is NEVER stored,
// logged, or put in any other response this module produces — `summarizeSetupIntent` below exists
// precisely so a caller can log or display the outcome without the secret coming with it.
//
// Conventions are the existing ones (src/api/corporateCampaigns.js): a factory taking an injectable
// `fetchImpl` and `getToken` so behaviour is unit-testable without a browser, one `call` with a
// single auth story, and a STRICT allowlist on anything read out of a response body — an arbitrary
// server object reaching the UI is how internal ids and stack traces leak into a screen.

function viteApiBase() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) {
      return import.meta.env.VITE_API_BASE;
    }
  } catch { /* import.meta.env not present under node:test */ }
  return "";
}

function defaultGetToken() {
  try { return localStorage.getItem("token"); } catch { return null; }
}

/** Stable server refusals this surface knows how to act on. */
export const PAYMENT_ERRORS = Object.freeze({
  PAYMENTS_UNCONFIGURED: "payments_unconfigured",
  NOT_ORG_OWNER: "not_org_owner",
  SETUP_INTENT_REQUIRED: "setup_intent_required",
  SETUP_INTENT_NOT_SUCCEEDED: "setup_intent_not_succeeded",
});

/** A short machine code: lower snake case, length-capped so a stack trace can never qualify. */
const isSafeCode = (v) => typeof v === "string" && v.length > 0 && v.length <= 64 && /^[a-z0-9_]+$/.test(v);

/** A card brand as Stripe reports it — a short bare word, nothing exotic. */
const isSafeBrand = (v) => typeof v === "string" && v.length > 0 && v.length <= 24 && /^[a-z_ ]+$/i.test(v);

/** Exactly four digits. Anything else is dropped rather than displayed. */
const isSafeLast4 = (v) => typeof v === "string" && /^[0-9]{4}$/.test(v);

/** An ISO-ish timestamp. Length-capped and character-restricted. */
const isSafeStamp = (v) => typeof v === "string" && v.length > 0 && v.length <= 40 && /^[0-9TZ:.+-]+$/.test(v);

/**
 * Read the server's payment-method summary, FIELD BY FIELD.
 *
 * The body is never spread. `ready` is the only field that decides anything, and it is required to
 * be a real boolean — a missing or malformed summary reads as NOT ready, which is the safe
 * direction: it prompts for a card rather than letting a campaign proceed as if one existed.
 */
export function readPaymentMethodSummary(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
  const ready = src ? src.ready === true : false;
  const out = { ready, status: ready ? "saved_card_ready" : "card_update_required" };
  if (!ready) return out;
  if (isSafeBrand(src.brand)) out.brand = src.brand;
  if (isSafeLast4(src.last4)) out.last4 = src.last4;
  if (isSafeStamp(src.authorizedAt)) out.authorizedAt = src.authorizedAt;
  if (isSafeStamp(src.updatedAt)) out.updatedAt = src.updatedAt;
  return out;
}

/**
 * Describe a setup-intent response WITHOUT its client secret.
 *
 * The secret is returned to the caller separately and used once, in the browser, by Stripe.js. This
 * summary is what may safely be logged, rendered or put in component state.
 */
export function summarizeSetupIntent(res) {
  return {
    ok: res && res.ok === true,
    status: res ? res.status : 0,
    replacing: Boolean(res && res.data && res.data.replacing === true),
    hasClientSecret: Boolean(res && res.data && typeof res.data.clientSecret === "string" && res.data.clientSecret.length),
  };
}

export function createCorporatePaymentsClient({
  fetchImpl = (typeof fetch !== "undefined" ? fetch : undefined),
  getToken = defaultGetToken,
  apiBase = viteApiBase(),
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("corporatePaymentsClient: fetchImpl is required");
  }

  async function call(method, path, { body } = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken && getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetchImpl(`${apiBase}/api/corporate-payments${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      });
    } catch {
      // A network failure is REPORTED, never swallowed into a false "no card saved". The
      // difference matters: one is retryable, the other asks the reader to enter a card again.
      return { ok: false, networkError: true, status: 0 };
    }

    // Payments not configured on the server. Distinct from "no card": there is nothing the reader
    // can do about it, so the surface must not ask them to try.
    if (res.status === 503) {
      return { ok: false, unavailable: true, status: 503, error: PAYMENT_ERRORS.PAYMENTS_UNCONFIGURED };
    }
    // Never surface organization data on an authorization failure.
    if (res.status === 401 || res.status === 403) {
      return { ok: false, unauthorized: true, status: res.status };
    }

    let data = null;
    try { data = await res.json(); } catch { /* tolerate an empty body */ }

    if (!res.ok) {
      const code = data && isSafeCode(data.error) ? data.error : null;
      return { ok: false, status: res.status, error: code || `http_${res.status}` };
    }
    return { ok: true, status: res.status, data };
  }

  const base = (orgId) => `/${encodeURIComponent(orgId)}/payment-method`;

  return {
    /** The safe summary: readiness, brand, last four, timestamps. No Stripe identifier at all. */
    async getPaymentMethod(orgId) {
      const res = await call("GET", base(orgId));
      if (res.ok !== true) return res;
      return { ...res, paymentMethod: readPaymentMethodSummary(res.data && res.data.paymentMethod) };
    },

    /**
     * Begin authorization. The response's `clientSecret` is for immediate use by Stripe.js and
     * must not be persisted anywhere by the caller.
     */
    createSetupIntent: (orgId) => call("POST", `${base(orgId)}/setup-intent`),

    /** Replacement is a fresh SetupIntent; the existing card stays usable until this completes. */
    replacePaymentMethod: (orgId) => call("POST", `${base(orgId)}/replace`),

    /** Finish authorization after the browser confirmed. Only the SetupIntent ID is sent. */
    async completeSetupIntent(orgId, setupIntentId) {
      const res = await call("POST", `${base(orgId)}/complete`, { body: { setupIntentId } });
      if (res.ok !== true) return res;
      return { ...res, paymentMethod: readPaymentMethodSummary(res.data && res.data.paymentMethod) };
    },
  };
}
