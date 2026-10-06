// W49 (founder-approved 2026-10-03) wording for the Partner fundraising dashboard "earnings and payouts" line.
// KNOWN LIMITATION (backend org-level answer is a later item): with "All campaigns" selected the dashboard calls the
// earnings endpoint without a campaignId, and the server then always answers reason 'economics_not_activated' even when
// one campaign is active. The first-state wording is deliberately safe in that case; a whole-organization earnings
// answer from the backend is needed before this can be exact.
// Pure function: (earnings, payout) -> what to show. No internal state names, no mechanics, no vendor names.
// Inputs are the two real API bodies the dashboard already fetches:
//   earnings = { available, reason: 'economics_not_activated' | 'computation_held', estimateCents }
//   payout   = { payoutsEnabled, held, posture } or { held: true } when the server answers 503
// FUTURE fields (the server does not send these today; the copy only reacts if they ever appear):
//   earnings.available === true with a numeric estimateCents; payout.paidToDateCents.
export const dollars = (cents) => `$${(Math.round(Number(cents)) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function payoutPhase(payout) {
  if (!payout) return 'unknown';
  if (Number(payout.paidToDateCents) > 0) return 'paid';
  if (payout.payoutsEnabled === true && payout.held === false) return 'on';
  if (payout.payoutsEnabled === true) return 'review';
  return 'off';
}

export function earningsKey(earnings, payout) {
  const ph = payoutPhase(payout);
  if (!earnings) return 'unavailable';
  if (ph === 'paid') return 'paid';
  if (earnings.available === true && Number(earnings.estimateCents) > 0) return ph === 'review' ? 'review' : 'earning';
  if (earnings.available === true) return 'none-yet';
  if (earnings.reason === 'computation_held') return 'terms-set';
  return 'not-active';
}

export function partnerEarningsCopy(earnings, payout) {
  const key = earningsKey(earnings, payout);
  const est = earnings && earnings.available === true ? dollars(earnings.estimateCents) : null;
  const t = {
    'unavailable': { amount: '', pill: '', label: 'Earnings', lines: ['Earnings are not available right now. Please try again later.'] },
    'not-active': { amount: '', pill: 'Coming soon', label: 'Earnings', lines: [
      'Your earnings will appear here once the terms of your partnership are in place.',
      'Visits, scans and conversions are already counted above.'] },
    'terms-set': { amount: '', pill: 'Getting ready', label: 'Earnings', lines: [
      'Your partnership terms are in place. Your earnings will start to show here shortly.'] },
    'none-yet': { amount: est, pill: '', label: 'Estimated earnings', lines: [
      'No earnings yet. As supporters subscribe and stay subscribed, your share builds here.'] },
    'earning': { amount: est, pill: '', label: 'Estimated earnings', lines: [
      'Your share of what supporters have subscribed. It can change as supporters join or leave, and it is not a payment until it is paid.'] },
    'review': { amount: est, pill: 'Being reviewed', label: 'Estimated earnings', lines: [
      'Payments are checked before they are sent. Your estimate can change as supporters join or leave.'] },
    'paid': { amount: payout && dollars(payout.paidToDateCents), pill: '', label: 'Paid to you so far', lines: [
      est ? `Estimated earnings not yet paid: ${est}.` : 'Thank you for partnering with us.'] },
  }[key];
  // Payout status line. Never promises a date, a rate or an outcome.
  const ph = payoutPhase(payout);
  const payoutLine = key === 'unavailable' ? null
    : ph === 'off' || ph === 'unknown' ? 'Payouts have not started yet.'
    : ph === 'on' && key !== 'paid' ? 'Payouts are on.' : null;
  return { key, ...t, payoutLine };
}

// Payout line only (used by the Founder dashboard, which has no partner earnings figure).
export function payoutOnlyLine(payout) {
  const ph = payoutPhase(payout);
  if (ph === 'paid') return `Paid so far: ${dollars(payout.paidToDateCents)}.`;
  if (ph === 'review') return 'Payments are checked before they are sent.';
  if (ph === 'on') return 'Payouts are on.';
  return 'Payouts have not started yet.';
}

// Every state the tests walk and the tests walk, with the API bodies that produce it.
// real:true = the server returns exactly this today; real:false = future shape (not returned by today's server).
const OFF = { payoutsEnabled: false, held: true, posture: 'manual_review_only' };
export const STATES = [
  { id: 's1', key: 'not-active', title: 'Payouts off, economics not active', real: true,
    earnings: { available: false, reason: 'economics_not_activated', estimateCents: null }, payout: OFF },
  { id: 's2', key: 'terms-set', title: 'Economics active, figure not computed yet', real: true,
    earnings: { available: false, reason: 'computation_held', estimateCents: null }, payout: OFF },
  { id: 's3', key: 'none-yet', title: 'Active, no earnings yet', real: false,
    earnings: { available: true, reason: null, estimateCents: 0 }, payout: OFF },
  { id: 's4', key: 'earning', title: 'Active, with earnings (payouts still off)', real: false,
    earnings: { available: true, reason: null, estimateCents: 48250 }, payout: OFF },
  { id: 's5', key: 'review', title: 'Payouts on, held for review', real: false,
    earnings: { available: true, reason: null, estimateCents: 48250 }, payout: { payoutsEnabled: true, held: true, posture: 'manual_review_only' } },
  { id: 's6', key: 'paid', title: 'Paid', real: false,
    earnings: { available: true, reason: null, estimateCents: 6000 }, payout: { payoutsEnabled: true, held: false, paidToDateCents: 42250 } },
  { id: 's7', key: 'not-active', title: 'Payout status unavailable (server answers 503)', real: true,
    earnings: { available: false, reason: 'economics_not_activated', estimateCents: null }, payout: { held: true }, payoutStatusHttp: 503 },
  { id: 's8', key: 'unavailable', title: 'Earnings could not be loaded', real: true,
    earnings: null, payout: { payoutsEnabled: false, held: true }, earningsHttp: 500 },
];
