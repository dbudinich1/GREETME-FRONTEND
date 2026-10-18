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

export const GROUP_MIN = 2;
export const GROUP_MAX = 10;
export const GROUP_RUN_KEY = 'gm_group_run_v1';
// The QR Cash amounts the composer offers (its $10 / $25 / $50 / $100 choices); $25 is its default.
export const GROUP_QRCASH_AMOUNTS = Object.freeze([10, 25, 50, 100]);
export const GROUP_QRCASH_DEFAULT = 25;

const newId = () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
  ? globalThis.crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

/** Normalise a gift choice to a supported group gift: none, or QR Cash with one of the composer's amounts. */
export function groupGift(choice) {
  if (!choice || choice.type !== 'qrcash') return { type: 'none' };
  const amount = GROUP_QRCASH_AMOUNTS.includes(Number(choice.amount)) ? Number(choice.amount) : GROUP_QRCASH_DEFAULT;
  return { type: 'qrcash', amount };
}

/** The gift each recipient gets: their individual override when set, else the group default. */
export function effectiveGift(defaultGift, override) {
  return groupGift(override || defaultGift);
}

/** Per-recipient cost and the total, with the backend's own QR Cash fee arithmetic ($1.99 + 3%). */
export function groupCosts(items) {
  const rows = items.map((it) => {
    const g = groupGift(it.gift);
    if (g.type !== 'qrcash') return { contactId: it.contactId, giftCents: 0, feeCents: 0, totalCents: 0 };
    const q = qrCashQuote(g.amount);
    return { contactId: it.contactId, giftCents: q.amountCents, feeCents: q.feeCents, totalCents: q.totalCents };
  });
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  return { rows, giftCents: sum('giftCents'), feeCents: sum('feeCents'), totalCents: sum('totalCents') };
}

/**
 * What the current rules allow for a group of n, from the existing send pre-check (allowance) and its AI daily
 * figure (G4). Nothing is changed here; this only reads the rules so the review can say so before anything runs.
 */
export function groupAllowance(preflight, n) {
  const reasons = [];
  if (preflight && preflight.canSendGreeting === false) reasons.push(preflight.message || 'You don’t have a send available right now.');
  const unlimited = preflight && preflight.sendLimitUnlimited === true;
  const remaining = preflight && typeof preflight.remaining === 'number' ? preflight.remaining : null;
  if (!unlimited && remaining !== null && n > remaining) reasons.push(`You have ${remaining} send${remaining === 1 ? '' : 's'} left; this group needs ${n}.`);
  const ai = preflight && preflight.aiDaily && typeof preflight.aiDaily.remaining === 'number' ? preflight.aiDaily : null;
  if (ai && n > ai.remaining) reasons.push(`Today you can create ${ai.remaining} more Greet-Me${ai.remaining === 1 ? '' : 's'} (daily limit ${ai.limit}); this group needs ${n}.`);
  return { ok: reasons.length === 0, reasons, remaining, unlimited, aiDaily: ai };
}

/** A new run: every recipient gets its own stable keys, created once and persisted with the run. */
export function createGroupRun({ occasion, words, recipients, defaultGift, overrides = {} }) {
  if (!Array.isArray(recipients) || recipients.length < GROUP_MIN || recipients.length > GROUP_MAX) {
    const e = new Error(`A group is ${GROUP_MIN} to ${GROUP_MAX} people.`); e.code = 'GROUP_SIZE'; throw e;
  }
  const ids = new Set();
  for (const r of recipients) { if (ids.has(r.contactId)) { const e = new Error('Each person can be in a group once.'); e.code = 'GROUP_DUPLICATE'; throw e; } ids.add(r.contactId); }
  return {
    runId: newId(),
    createdAt: Date.now(),
    occasion,
    words: String(words || ''),
    stopped: null,
    items: recipients.map((r) => ({
      contactId: r.contactId, name: r.name, email: r.email,
      gift: effectiveGift(defaultGift, overrides[r.contactId]),
      sendRequestId: newId(), giftRequestId: newId(),
      giftPayload: null, status: 'pending', jobId: null, error: null,
    })),
  };
}

// Refusals that apply to the whole run (the next recipient would be refused for the same reason).
const STOP_STATUSES = new Set([401, 402, 403, 429]);
const STOP_CODES = new Set(['NO_SAVED_PAYMENT_METHOD', 'SEND_ENTITLEMENT_AT_RISK', 'AI_DAILY_LIMIT', 'EMAIL_NOT_VERIFIED', 'VOICE_CLONE_MISSING', 'PHOTO_REQUIRED']);
export function isRunStopping(err) {
  if (!err) return false;
  if (err.networkError) return true; // outcome unknown: stop; the same keys make a later retry safe
  return STOP_STATUSES.has(err.status) || STOP_CODES.has(err.code);
}

function failure(res, fallback) {
  const e = new Error((res && (res.error || res.message)) || fallback);
  if (res) { e.status = res.status; e.code = res.code; if (res.networkError) e.networkError = true; }
  return e;
}

async function chargeQrCash(item, { api, confirmCardPayment }) {
  const amount = groupGift(item.gift).amount;
  const giftAmountCents = Math.round(amount * 100);
  // G3: the saved card, on the existing charge route, with this recipient's own stable giftRequestId.
  const res = await api.chargeGift({
    giftAmountCents, recipientEmail: item.email, recipientName: item.name,
    useSavedPaymentMethod: true, giftRequestId: item.giftRequestId,
  });
  if (!res || res.networkError) throw failure(res || { networkError: true }, 'We couldn’t confirm the gift payment.');
  if (res.requiresAction && res.clientSecret) {
    // 3-D Secure: the same confirmation the send page performs, then the existing /finalize.
    const { error, paymentIntent } = await confirmCardPayment(res.clientSecret);
    if (error || !paymentIntent || paymentIntent.status !== 'succeeded') {
      const e = new Error((error && error.message) || 'Your bank didn’t confirm the payment.'); e.code = 'CARD_AUTH_FAILED'; throw e;
    }
    const fin = await api.finalizeGift({ paymentIntentId: res.paymentIntentId, recipientEmail: item.email, recipientName: item.name, giftAmountCents });
    if (!fin || !fin.ok || !fin.gift) throw failure(fin, 'The gift payment couldn’t be completed.');
    return qrCashGiftForPayload(amount, fin.gift);
  }
  if (res.ok && res.gift) return qrCashGiftForPayload(amount, res.gift);
  throw failure(res, 'The gift payment didn’t go through.');
}

/**
 * Send (or resume, or retry) a run, one recipient at a time, in order. Already-sent recipients are skipped; a
 * recipient whose gift was charged keeps it. Stops on a run-wide refusal and records why.
 * deps: { api, buildPayload(item) -> payload | null, confirmCardPayment(clientSecret), onChange(run) }
 */
export async function runGroup(run, deps) {
  const { api, buildPayload, onChange = () => {} } = deps;
  if (!run || !Array.isArray(run.items) || run.items.length > GROUP_MAX) throw new Error('Invalid group run');
  run.stopped = null;
  for (const item of run.items) {
    if (item.status === 'sent') continue;
    try {
      const base = buildPayload(item);
      if (!base) { const e = new Error('This person is no longer in your recipients.'); e.code = 'RECIPIENT_MISSING'; throw e; }
      if (groupGift(item.gift).type === 'qrcash' && !item.giftPayload) {
        item.status = 'charging'; item.error = null; onChange(run);
        item.giftPayload = await chargeQrCash(item, deps);
        onChange(run);
      }
      item.status = 'sending'; item.error = null; onChange(run);
      const res = await api.sendGreeting({
        ...base,
        ...(item.giftPayload ? { includeGift: true, gift: item.giftPayload } : { includeGift: false }),
        sendRequestId: item.sendRequestId,
      });
      if (!res || res.ok === false) throw failure(res, 'This Greet-Me wasn’t accepted.');
      item.status = 'sent'; item.jobId = res.jobId || null; item.error = null;
      onChange(run);
    } catch (err) {
      item.status = 'failed';
      item.error = { message: err.message, code: err.code || null, status: err.status || null, unknown: Boolean(err.networkError), giftCharged: Boolean(item.giftPayload) };
      if (isRunStopping(err)) { run.stopped = { at: item.contactId, ...item.error }; onChange(run); return run; }
      onChange(run);
    }
  }
  return run;
}

export function runSummary(run) {
  const count = (s) => run.items.filter((i) => i.status === s).length;
  return { total: run.items.length, sent: count('sent'), failed: count('failed'), pending: run.items.length - count('sent') - count('failed'), done: run.items.every((i) => i.status === 'sent') };
}

export function saveRun(storage, run) { try { storage.setItem(GROUP_RUN_KEY, JSON.stringify(run)); return true; } catch { return false; } }
export function loadRun(storage) {
  try {
    const r = JSON.parse(storage.getItem(GROUP_RUN_KEY) || 'null');
    return r && Array.isArray(r.items) && r.items.length >= GROUP_MIN && r.items.length <= GROUP_MAX ? r : null;
  } catch { return null; }
}
export function clearRun(storage) { try { storage.removeItem(GROUP_RUN_KEY); } catch { /* unavailable */ } }
