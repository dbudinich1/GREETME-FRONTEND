// Run: node --test src/w49Preview/partnerEarningsCopy.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partnerEarningsCopy, payoutOnlyLine, STATES, dollars } from './partnerEarningsCopy.js';

const BANNED = /manual_review|review_only|posture|economics_not|computation_held|\bheld\b|stripe|printful|goody|florist|prezzee|shopify|ENSR|endowment|guarantee|will receive|you will be paid|within \d+ days|\d+\s?%/i;
const get = (id) => STATES.find((s) => s.id === id);

test('every state maps to its intended key', () => {
  for (const s of STATES) assert.equal(partnerEarningsCopy(s.earnings, s.payout).key, s.key, s.id);
});
test('no state shows an internal word, a vendor name, a rate, a date or a guarantee', () => {
  for (const s of STATES) {
    const c = partnerEarningsCopy(s.earnings, s.payout);
    const all = [c.label, c.amount, c.pill, c.payoutLine, ...c.lines].filter(Boolean).join(' | ');
    assert.doesNotMatch(all, BANNED, `${s.id}: ${all}`);
  }
});
test('amounts are dollars, never raw cents', () => {
  assert.equal(dollars(48250), '$482.50');
  assert.equal(partnerEarningsCopy(get('s4').earnings, get('s4').payout).amount, '$482.50');
  assert.equal(partnerEarningsCopy(get('s3').earnings, get('s3').payout).amount, '$0.00');
});
test('no amount unless the server said an estimate is available', () => {
  for (const id of ['s1', 's2', 's7', 's8']) assert.ok(!partnerEarningsCopy(get(id).earnings, get(id).payout).amount, id);
});
test('payout line says "not started" only while payouts are off', () => {
  assert.equal(partnerEarningsCopy(get('s1').earnings, get('s1').payout).payoutLine, 'Payouts have not started yet.');
  assert.equal(partnerEarningsCopy(get('s5').earnings, get('s5').payout).payoutLine, null);
});
test('a missing or odd payout body degrades to the off wording, not a crash', () => {
  assert.equal(partnerEarningsCopy(get('s1').earnings, null).payoutLine, 'Payouts have not started yet.');
  assert.equal(partnerEarningsCopy(get('s1').earnings, {}).key, 'not-active');
});
test('founder payout line is plain for every payout state', () => {
  for (const s of STATES) assert.doesNotMatch(payoutOnlyLine(s.payout), BANNED, s.id);
  assert.equal(payoutOnlyLine({ payoutsEnabled: false, held: true, posture: 'manual_review_only' }), 'Payouts have not started yet.');
  assert.equal(payoutOnlyLine(undefined), 'Payouts have not started yet.');
  assert.equal(payoutOnlyLine({ paidToDateCents: 42250 }), 'Paid so far: $422.50.');
});
