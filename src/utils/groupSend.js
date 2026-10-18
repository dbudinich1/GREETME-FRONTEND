// src/utils/groupSend.js
//
// GROUP SENDING, the thin resolver (G1, Report 103 §0k; founder-authorised 2026-10-18). A group of 2-10 people who
// share ONE occasion is sent as one EXISTING per-recipient send each — POST /api/jobs/send-greeting — with no new
// batch backend. Everything that protects a single send protects each of these:
//   * one stable sendRequestId per recipient (backend Gate B idempotency): a retry or a resume can never send twice;
//   * one stable giftRequestId per recipient for a QR Cash gift (charge-now idempotency): never charged twice;
//   * a charged gift is kept with its recipient, so retrying a failed send re-attaches it instead of re-charging;
//   * the current rules decide (allowance, AI daily cap, rate limits): the run never works around a refusal — it
//     stops, keeps every unsent recipient, and says why.
// Pure logic with injected dependencies (api, payload builder, card confirmation, persistence) so it is testable.
import { qrCashQuote } from './qrCashAmount';
import { qrCashGiftForPayload } from './sendGreetingPayload';
import {
  toGiftBoxQuoteRequest, validateGiftBoxForm, parseGiftBoxQuote, isGiftBoxQuoteExpired, giftBoxErrorCopy,
  PRE_CHARGE_CODES, OUTCOME_UNKNOWN_MESSAGE, PAID_NOT_FINALIZED_MESSAGE, PENDING_FALLBACK_MESSAGE,
} from '../components/providerCheckout/giftBoxRules';

export const GROUP_MIN = 2;
export const GROUP_MAX = 10;
export const GROUP_RUN_KEY = 'gm_group_run_v1';
// The QR Cash amounts the composer offers (its $10 / $25 / $50 / $100 choices); $25 is its default.
export const GROUP_QRCASH_AMOUNTS = Object.freeze([10, 25, 50, 100]);
export const GROUP_QRCASH_DEFAULT = 25;

const newId = () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
  ? globalThis.crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

/**
 * Normalise a gift choice to a supported group gift: none; QR Cash with one of the composer's amounts; or a gift box
 * (G7) — a Gift Place gift-box product, ordered per recipient through the existing gift-box checkout on the saved card.
 */
export function groupGift(choice) {
  if (choice && choice.type === 'gift_box' && choice.product && String(choice.product.providerProductId || '')) {
    return { type: 'gift_box', product: { providerProductId: String(choice.product.providerProductId), name: String(choice.product.name || 'Gift box') } };
  }
  if (!choice || choice.type !== 'qrcash') return { type: 'none' };
  const amount = GROUP_QRCASH_AMOUNTS.includes(Number(choice.amount)) ? Number(choice.amount) : GROUP_QRCASH_DEFAULT;
  return { type: 'qrcash', amount };
}

/** The gift each recipient gets: their individual override when set, else the group default. */
export function effectiveGift(defaultGift, override) {
  return groupGift(override || defaultGift);
}

/**
 * Per-recipient cost and the total. QR Cash uses the backend's own fee arithmetic ($1.99 + 3%); a gift box uses ONLY
 * the server's quote (its four lines: product, S/H, tax, total) — an unquoted gift box is reported as unpriced, never
 * estimated.
 */
export function groupCosts(items) {
  const rows = items.map((it) => {
    const g = groupGift(it.gift);
    if (g.type === 'qrcash') {
      const q = qrCashQuote(g.amount);
      return { contactId: it.contactId, kind: 'qrcash', giftCents: q.amountCents, feeCents: q.feeCents, totalCents: q.totalCents };
    }
    if (g.type === 'gift_box') {
      if (!it.quote || !it.quote.display) return { contactId: it.contactId, kind: 'gift_box', unpriced: true, giftCents: 0, feeCents: 0, totalCents: 0 };
      const d = it.quote.display;
      return { contactId: it.contactId, kind: 'gift_box', display: d, giftCents: d.totalCents, feeCents: 0, totalCents: d.totalCents };
    }
    return { contactId: it.contactId, kind: 'none', giftCents: 0, feeCents: 0, totalCents: 0 };
  });
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  return { rows, giftCents: sum('giftCents'), feeCents: sum('feeCents'), totalCents: sum('totalCents'), unpriced: rows.filter((r) => r.unpriced).length };
}

/**
 * G7 — price every gift-box recipient with the existing quote route, right before the one confirmation. Each item is
 * { contactId, gift, address } (address = the gift-box checkout's own form shape). Sets item.quote or item.quoteError.
 * Returns true only when every gift box has a valid quote.
 */
export async function quoteGroupGiftBoxes(items, { api, now = () => Date.now() }) {
  let allOk = true;
  for (const it of items) {
    const g = groupGift(it.gift);
    if (g.type !== 'gift_box') continue;
    it.quote = null; it.quoteError = null;
    const errors = validateGiftBoxForm({ quantity: '1', ...(it.address || {}) });
    const firstError = Object.values(errors)[0];
    if (firstError) { it.quoteError = firstError; allOk = false; continue; }
    let res;
    try { res = await api.quoteGiftBox(toGiftBoxQuoteRequest({ quantity: '1', ...it.address }, g.product)); }
    catch (err) { it.quoteError = giftBoxErrorCopy(err); allOk = false; continue; }
    const parsed = parseGiftBoxQuote(res, now());
    if (parsed.quote) it.quote = parsed.quote; else { it.quoteError = parsed.failure; allOk = false; }
  }
  return allOk;
}

/**
 * What the current rules allow for a group of n, from the existing send pre-check (allowance) and its AI daily
 * figure (G4). Nothing is changed here; this only reads the rules so the review can say so before anything runs.
 */
export function groupAllowance(preflight, n) {
  const reasons = [];
  // Fail closed: a pre-check that could not be read (no answer, or the server's own PREFLIGHT_UNAVAILABLE) blocks, and
  // says so — it never claims the sender has no send.
  const unreadable = !preflight || (preflight.ok === false && (preflight.reasonCode === 'PREFLIGHT_UNAVAILABLE' || preflight.canSendGreeting !== true));
  if (unreadable) reasons.push('We couldn\u2019t check your sends just now. Please try again in a moment.');
  else if (preflight.canSendGreeting === false) reasons.push(preflight.message || 'You don\u2019t have a send available right now.');
  const unlimited = preflight && preflight.sendLimitUnlimited === true;
  const remaining = preflight && typeof preflight.remaining === 'number' ? preflight.remaining : null;
  if (!unlimited && remaining !== null && n > remaining) reasons.push(`You have ${remaining} send${remaining === 1 ? '' : 's'} left; this group needs ${n}.`);
  // G4: every current plan has a real daily cap (999 is a cap, not "unlimited"). A count the server could not read
  // (used/remaining null) is "unknown" and never blocks; the server's own cap still applies at send time.
  const aiRaw = preflight && preflight.aiDaily ? preflight.aiDaily : null;
  const ai = aiRaw && typeof aiRaw.remaining === 'number' ? aiRaw : null;
  const aiUnknown = Boolean(aiRaw && !ai);
  if (ai && n > ai.remaining) reasons.push(`Today you can create ${ai.remaining} more Greet-Me${ai.remaining === 1 ? '' : 's'} (daily limit ${ai.limit}); this group needs ${n}.`);
  return { ok: reasons.length === 0, reasons, remaining, unlimited, aiDaily: ai, aiUnknown, aiLimit: aiRaw && typeof aiRaw.limit === 'number' ? aiRaw.limit : null };
}

/** A new run: every recipient gets its own stable keys, created once and persisted with the run. */
export function createGroupRun({ userId, occasion, words, recipients, defaultGift, overrides = {}, addresses = {}, quotes = {} }) {
  // H-1: a run belongs to the signed-in account that created it. It is never loaded, resumed or run for another.
  if (!userId) { const e = new Error('Sign in again to send to a group.'); e.code = 'OWNER_REQUIRED'; throw e; }
  if (!Array.isArray(recipients) || recipients.length < GROUP_MIN || recipients.length > GROUP_MAX) {
    const e = new Error(`A group is ${GROUP_MIN} to ${GROUP_MAX} people.`); e.code = 'GROUP_SIZE'; throw e;
  }
  const ids = new Set();
  for (const r of recipients) { if (ids.has(r.contactId)) { const e = new Error('Each person can be in a group once.'); e.code = 'GROUP_DUPLICATE'; throw e; } ids.add(r.contactId); }
  return {
    runId: newId(),
    userId: String(userId),
    createdAt: Date.now(),
    occasion,
    words: String(words || ''),
    stopped: null,
    items: recipients.map((r) => ({
      contactId: r.contactId, name: r.name, email: r.email,
      gift: effectiveGift(defaultGift, overrides[r.contactId]),
      sendRequestId: newId(), giftRequestId: newId(),
      address: addresses[r.contactId] || null, quote: quotes[r.contactId] || null, paymentIntentId: null,
      // The gift-box total the sender saw and confirmed at review. A re-quote with the SAME total may be charged
      // without asking again; a different total never is (consent is never assumed for a changed price).
      confirmedTotalCents: quotes[r.contactId] && Number.isSafeInteger(quotes[r.contactId].quotedTotalCents) ? quotes[r.contactId].quotedTotalCents : null,
      giftPayload: null, status: 'pending', jobId: null, error: null,
    })),
  };
}

// Refusals that apply to the whole run (the next recipient would be refused for the same reason).
const STOP_STATUSES = new Set([401, 402, 403, 429]);
const STOP_CODES = new Set(['NO_SAVED_PAYMENT_METHOD', 'SAVED_PAYMENT_METHOD_DISABLED', 'PAYMENT_ALREADY_IN_PROGRESS', 'SEND_ENTITLEMENT_AT_RISK', 'AI_DAILY_LIMIT', 'EMAIL_NOT_VERIFIED', 'VOICE_CLONE_MISSING', 'PHOTO_REQUIRED', 'GIFT_BOX_QUOTE_EXPIRED']);
export function isRunStopping(err) {
  if (!err) return false;
  if (err.networkError || err.outcomeUnknown) return true; // outcome unknown: stop; never guess
  if (err.declined) return false; // a declined card is that person's, not the run's
  return STOP_STATUSES.has(err.status) || STOP_CODES.has(err.code);
}

function failure(res, fallback) {
  const e = new Error((res && (res.error || res.message)) || fallback);
  if (res) { e.status = res.status; e.code = res.code; if (res.networkError) e.networkError = true; }
  return e;
}
const tagged = (err, props) => Object.assign(err instanceof Error ? err : new Error(String(err)), props);

// The single send's QR Cash key rule: the key is replaced only after an outcome that is DEFINITELY not a charge (a
// decline, a refused request, a 3-D Secure check that failed); after an unknown outcome it is kept, so a retry can
// never become a second charge.
const QR_UNKNOWN_MESSAGE = 'We couldn\u2019t confirm whether this gift payment went through. Trying again uses the same payment key, so it can\u2019t be charged twice.';
async function chargeQrCash(item, { api, confirmCardPayment }) {
  const amount = groupGift(item.gift).amount;
  const giftAmountCents = Math.round(amount * 100);
  // G3: the saved card, on the existing charge route, with this recipient's own giftRequestId.
  let res;
  try {
    res = await api.chargeGift({
      giftAmountCents, recipientEmail: item.email, recipientName: item.name,
      useSavedPaymentMethod: true, giftRequestId: item.giftRequestId,
    });
  } catch (err) {
    if (!err || err.status >= 500 || !err.status) throw tagged(err || new Error(''), { outcomeUnknown: true, message: QR_UNKNOWN_MESSAGE }); // keep the key
    if (err.code === 'PAYMENT_ALREADY_IN_PROGRESS') throw err; // an attempt under this key is still open: keep it
    item.giftRequestId = newId(); // refused before any charge, or declined: definitely not charged
    throw err;
  }
  if (!res || res.networkError) throw tagged(new Error(QR_UNKNOWN_MESSAGE), { outcomeUnknown: true }); // keep the key
  if (res.requiresAction && res.clientSecret) {
    // 3-D Secure: the same confirmation the send page performs, then the existing /finalize.
    const { error, paymentIntent } = await confirmCardPayment(res.clientSecret);
    if (error || !paymentIntent || paymentIntent.status !== 'succeeded') {
      item.giftRequestId = newId(); // not charged
      const e = new Error((error && error.message) || 'Your bank didn\u2019t confirm the payment.'); e.code = 'CARD_AUTH_FAILED'; e.declined = true; throw e;
    }
    let fin;
    try { fin = await api.finalizeGift({ paymentIntentId: res.paymentIntentId, recipientEmail: item.email, recipientName: item.name, giftAmountCents }); } catch { fin = null; }
    // The bank confirmed, so the money may be taken: an unfinished finalize is an unknown outcome (key kept).
    if (!fin || !fin.ok || !fin.gift) throw tagged(new Error(QR_UNKNOWN_MESSAGE), { outcomeUnknown: true });
    return qrCashGiftForPayload(amount, fin.gift);
  }
  if (res.ok && res.gift) return qrCashGiftForPayload(amount, res.gift);
  // 401 / 404 resolve rather than throw (api.js) before the route ran: nothing was charged.
  item.giftRequestId = newId();
  throw failure(res, 'The gift payment didn\u2019t go through.');
}

// ── G7: one gift-box order per recipient, through the existing gift-box checkout routes, on the saved card. The
// rules are the single checkout's own (giftBoxRules.js): only a CONFIRMED order attaches to the greeting; a paid order
// that is not confirmed holds the greeting and is only ever re-FINALIZED; a refused or uncertain outcome is never
// re-placed; the key changes only after an outcome that is definitively not a charge.
function giftBoxOutcome(body) {
  const fulfillmentStatus = body?.fulfillmentStatus === 'confirmed' ? 'confirmed' : (body?.fulfillmentStatus === 'failed' ? 'failed' : 'pending');
  const token = body?.gift && typeof body.gift.claimToken === 'string' ? body.gift.claimToken : '';
  if (fulfillmentStatus === 'confirmed' && token) return { giftPayload: { type: 'gift_boxes', claimToken: token } };
  return { held: body?.error || PENDING_FALLBACK_MESSAGE, refused: fulfillmentStatus === 'failed' };
}
async function finalizeGiftBoxOrder(item, api) {
  let res;
  try { res = await api.finalizeGiftBox({ paymentIntentId: item.paymentIntentId }); } catch { res = null; }
  if (res?.ok && res.pending) return { held: PENDING_FALLBACK_MESSAGE };
  if (res?.ok && res.gift) { const o = giftBoxOutcome(res); if (o.giftPayload) item.paymentIntentId = null; return o; }
  return { held: PAID_NOT_FINALIZED_MESSAGE };
}
// A quote older than 2 minutes is refreshed for this person before charging. The order goes ahead only when the
// fresh total equals the total the sender confirmed; a different total stops the run for re-confirmation.
async function refreshExpiredQuote(item, api, now) {
  const fresh = { contactId: item.contactId, gift: item.gift, address: item.address };
  await quoteGroupGiftBoxes([fresh], { api, now });
  if (fresh.quote && item.confirmedTotalCents !== null && fresh.quote.quotedTotalCents === item.confirmedTotalCents) {
    item.quote = fresh.quote;
    return true;
  }
  item.quote = null;
  const message = fresh.quote
    ? `The price for ${item.name}\u2019s gift box changed from $${(item.confirmedTotalCents / 100).toFixed(2)} to $${(fresh.quote.quotedTotalCents / 100).toFixed(2)}. Review the new price to continue.`
    : (fresh.quoteError || 'Gift box prices are valid for 2 minutes. Get fresh prices to continue.');
  throw tagged(new Error(message), { code: 'GIFT_BOX_QUOTE_EXPIRED', needsQuote: true });
}

async function placeGiftBox(item, { api, confirmCardPayment, now = () => Date.now() }, retried = false) {
  if (item.paymentIntentId) return finalizeGiftBoxOrder(item, api); // already paid: finalize only, never charge again
  const g = groupGift(item.gift);
  if (!item.quote || isGiftBoxQuoteExpired(item.quote, now())) await refreshExpiredQuote(item, api, now);
  const body = {
    ...toGiftBoxQuoteRequest({ quantity: '1', ...item.address }, g.product),
    quotedTotalCents: item.quote.quotedTotalCents,
    providerQuotedTotalCents: item.quote.providerQuotedTotalCents,
    quotedAt: item.quote.quotedAt,
    useSavedPaymentMethod: true, // G7 contract: the saved card in place of a typed card
    giftRequestId: item.giftRequestId,
    contactId: item.contactId, // per-recipient order binding
  };
  if (item.address && typeof item.address.phone === 'string' && item.address.phone.trim()) body.recipient.phone = item.address.phone.trim();
  let res;
  try {
    res = await api.chargeGiftBox(body);
  } catch (err) {
    const code = err?.code;
    if (code === 'gift_box_quote_expired' && !retried) {
      // Nothing was charged. Refresh this person's price; continue only if it is unchanged (once).
      await refreshExpiredQuote(item, api, now);
      return placeGiftBox(item, { api, confirmCardPayment, now }, true);
    }
    if (code === 'gift_box_quote_changed' || code === 'gift_box_quote_expired') {
      item.quote = null; // nothing was charged; the sender must see the new price first
      throw tagged(err, { code: 'GIFT_BOX_QUOTE_EXPIRED', needsQuote: true, message: code === 'gift_box_quote_changed' ? 'A gift box price changed. Get fresh prices to continue.' : 'Gift box prices are valid for 2 minutes. Get fresh prices to continue.' });
    }
    // A decline of the group's ONE saved card would decline the next person too: not charged (fresh key), and the run
    // stops so the sender can update the card.
    if (err?.status === 402) { item.giftRequestId = newId(); throw tagged(err, { message: err.message || 'Your card was declined.' }); }
    if (PRE_CHARGE_CODES.has(code)) { item.giftRequestId = newId(); throw tagged(err, { message: giftBoxErrorCopy(err) }); }
    // Refused before any charge, for the whole group: stop the run (nothing was charged).
    if (code === 'EMAIL_NOT_VERIFIED' || err?.status === 429 || code === 'SEND_ENTITLEMENT_AT_RISK' || code === 'NO_SAVED_PAYMENT_METHOD' || code === 'SAVED_PAYMENT_METHOD_DISABLED' || code === 'PAYMENT_ALREADY_IN_PROGRESS') throw err;
    throw tagged(err, { outcomeUnknown: true, message: OUTCOME_UNKNOWN_MESSAGE }); // may have happened after the charge
  }
  if (res?.networkError) throw tagged(new Error(OUTCOME_UNKNOWN_MESSAGE), { outcomeUnknown: true });
  if (res?.requiresAction && res.clientSecret) {
    const { error, paymentIntent } = await confirmCardPayment(res.clientSecret);
    if (error || paymentIntent?.status !== 'succeeded') {
      item.giftRequestId = newId(); // not charged
      throw tagged(new Error((error && error.message) || 'Payment was not completed after authentication.'), { code: 'CARD_AUTH_FAILED', declined: true });
    }
    item.paymentIntentId = res.paymentIntentId;
    return finalizeGiftBoxOrder(item, api);
  }
  if (res?.ok && res.pending) { item.paymentIntentId = res.paymentIntentId || null; return { held: PENDING_FALLBACK_MESSAGE }; }
  if (res?.ok && res.gift) return giftBoxOutcome(res);
  // 401 / 404 resolve rather than throw (api.js): nothing was charged.
  throw failure(res, 'We couldn\u2019t complete this gift box purchase.');
}

/**
 * Send (or resume, or retry) a run, one recipient at a time and in order: that person's gift is placed (QR Cash
 * charged, or a gift-box order CONFIRMED), then that person's greeting is sent, before the next person. A person whose
 * gift is not ready is never sent without it silently (they stay for retry, or "send without the gift"). A run-wide
 * refusal stops the run before anyone further is charged or sent, and records why.
 * deps: { userId, api, buildPayload(item) -> payload | null, confirmCardPayment(clientSecret), onChange(run), now() }
 */
export async function runGroup(run, deps) {
  const { api, buildPayload, onChange = () => {} } = deps;
  if (!run || !Array.isArray(run.items) || run.items.length > GROUP_MAX) throw new Error('Invalid group run');
  // H-1: only the account that created the run may run it.
  if (!run.userId || !deps.userId || String(deps.userId) !== String(run.userId)) {
    const e = new Error('This group send belongs to a different account.'); e.code = 'OWNER_MISMATCH'; throw e;
  }
  run.stopped = null;

  const stop = (item, err, status) => {
    item.status = status;
    item.error = { message: err.message, code: err.code || null, status: err.status || null, unknown: Boolean(err.networkError || err.outcomeUnknown), giftCharged: Boolean(item.giftPayload || item.paymentIntentId) };
    if (isRunStopping(err)) { run.stopped = { at: item.contactId, ...item.error }; onChange(run); return true; }
    onChange(run);
    return false;
  };

  for (const item of run.items) {
    if (item.status === 'sent') continue;
    const g = groupGift(item.gift);
    // A gift-box order that is held without a payment handle, or whose outcome is unknown, is never placed again.
    if (g.type === 'gift_box' && !item.giftPayload && ((item.status === 'held' && !item.paymentIntentId) || item.status === 'unknown')) continue;

    // 1. This person's gift.
    if (g.type !== 'none' && !item.giftPayload) {
      try {
        item.status = 'charging'; item.error = null; onChange(run);
        if (g.type === 'qrcash') {
          item.giftPayload = await chargeQrCash(item, deps);
        } else {
          const r = await placeGiftBox(item, deps);
          if (r.held) { item.status = 'held'; item.error = { message: r.held, refused: Boolean(r.refused), giftCharged: true }; onChange(run); continue; }
          item.giftPayload = r.giftPayload;
        }
        item.status = 'ready'; onChange(run);
      } catch (err) {
        // An unknown QR Cash outcome is retried later with the SAME key (it cannot charge twice); an unknown gift-box
        // outcome is never re-placed.
        const status = err.needsQuote ? 'needs_quote' : (err.outcomeUnknown && g.type === 'gift_box') ? 'unknown' : 'failed';
        if (stop(item, err, status)) return run;
        continue;
      }
    }

    // 2. This person's greeting.
    try {
      const base = buildPayload(item);
      if (!base) { const e = new Error('This person is no longer in your recipients.'); e.code = 'RECIPIENT_MISSING'; throw e; }
      item.status = 'sending'; item.error = null; onChange(run);
      const res = await api.sendGreeting({
        ...base,
        ...(item.giftPayload ? { includeGift: true, gift: item.giftPayload } : { includeGift: false }),
        sendRequestId: item.sendRequestId,
      });
      if (!res || res.ok === false) throw failure(res, 'This Greet-Me wasn\u2019t accepted.');
      item.status = 'sent'; item.jobId = res.jobId || null; item.error = null;
      onChange(run);
    } catch (err) {
      if (stop(item, err, 'failed')) return run;
    }
  }
  return run;
}

/** The sender chose to send this person's greeting without their gift (e.g. an order that is held or uncertain). */
export function sendWithoutGift(run, contactId) {
  const item = run.items.find((i) => i.contactId === contactId);
  if (!item || item.status === 'sent') return run;
  item.gift = { type: 'none' }; item.giftPayload = null; item.giftDropped = true; item.status = 'pending'; item.error = null;
  return run;
}

export function runSummary(run) {
  const count = (s) => run.items.filter((i) => i.status === s).length;
  const sent = count('sent');
  return {
    total: run.items.length, sent, failed: count('failed'), held: count('held'), unknown: count('unknown'), needsQuote: count('needs_quote'),
    pending: run.items.length - sent - count('failed') - count('held') - count('unknown') - count('needs_quote'),
    done: run.items.every((i) => i.status === 'sent'),
  };
}

export function saveRun(storage, run) { try { storage.setItem(GROUP_RUN_KEY, JSON.stringify(run)); return true; } catch { return false; } }
/**
 * H-1: the stored run is returned ONLY to the account that created it. A run owned by another account, or with no
 * owner (stored before owners were recorded), is discarded — never shown, resumed or charged.
 */
export function loadRun(storage, userId) {
  let r = null;
  try { r = JSON.parse(storage.getItem(GROUP_RUN_KEY) || 'null'); } catch { r = null; }
  if (!r) return null;
  const valid = Array.isArray(r.items) && r.items.length >= GROUP_MIN && r.items.length <= GROUP_MAX;
  if (!valid || !r.userId || !userId || String(r.userId) !== String(userId)) { clearRun(storage); return null; }
  return r;
}
export function clearRun(storage) { try { storage.removeItem(GROUP_RUN_KEY); } catch { /* unavailable */ } }
