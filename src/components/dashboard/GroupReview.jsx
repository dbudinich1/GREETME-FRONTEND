// src/components/dashboard/GroupReview.jsx
//
// G2 (+ G7) — the ONE review for a group Send Now (2-10 people, one shared occasion; Report 103 §0k). Shows, before
// anything is charged or sent: who gets a Greet-Me, each person's gift (the group default or their own override) and
// cost, the total, the card that pays, and what the current rules allow (sends left, today's AI greetings, the
// hourly limit). Gifts: No gift, QR Cash, or a gift box from the Gift Place (G7) — each gift-box recipient needs their
// own address and their own server quote (four lines: product, S/H, tax, total), fetched together right before the
// one confirmation. Pressing Send runs utils/groupSend.js: gifts first, then one EXISTING per-recipient send each,
// with their own idempotency keys. Results stay on screen; only failures are retried; an unfinished run resumes.
import { useEffect, useState } from 'react';
import { Check, X, AlertCircle, RotateCcw, Send, Users } from 'lucide-react';
import api from '../../api/api';
import { stripePromise } from '../../stripe/stripeProvider';
import { centsToDollarString } from '../../utils/qrCashAmount';
import { useProviderCatalogue } from '../giftPlace/useProviderCatalogue';
import { isGiftBoxQuoteExpired, EMPTY_GIFT_BOX_FORM } from '../providerCheckout/giftBoxRules';
import {
  GROUP_MAX, GROUP_QRCASH_AMOUNTS, groupGift, effectiveGift, groupCosts, groupAllowance,
  createGroupRun, runGroup, runSummary, saveRun, clearRun, quoteGroupGiftBoxes, sendWithoutGift,
} from '../../utils/groupSend';

const STATUS_LABEL = {
  pending: 'Waiting', charging: 'Paying for gift…', ready: 'Gift ready', sending: 'Sending…', sent: 'Accepted', failed: 'Not sent',
  held: 'Greeting held', unknown: 'Payment unconfirmed', needs_quote: 'Needs a fresh price',
};
const STATUS_TONE = { sent: 'ok', failed: 'muted', held: 'amber', unknown: 'amber', needs_quote: 'amber' };

// The address a gift box ships to: the checkout's own form shape. Prefilled only from CONFIRMED saved data — the
// recipient's stored shipping address and confirmed delivery names; a first name is never split from the full name.
function addressFor(contact) {
  const a = (contact && contact.shippingAddress) || {};
  return {
    ...EMPTY_GIFT_BOX_FORM,
    firstName: contact?.firstName || '', lastName: contact?.lastName || '',
    address1: a.line1 || '', address2: a.line2 || '', city: a.city || '', state: a.state || '', postalCode: a.zip || '',
  };
}

export default function GroupReview({ recipients, occasion, words, defaultGiftChoice, buildPayload, senderPhotoMissing = false, senderVoiceMissing = false, userId = null, initialRun = null, onClose, onDone }) {
  const [preflight, setPreflight] = useState(null);
  const [card, setCard] = useState(undefined); // undefined = loading, null = none
  const [cardExpired, setCardExpired] = useState(false); // charge-now does not refuse an expired card itself
  const [loading, setLoading] = useState(true);
  const [defaultGift, setDefaultGift] = useState(groupGift(defaultGiftChoice));
  const [overrides, setOverrides] = useState({});
  const [left, setLeft] = useState([]); // people the sender leaves out at review (never dropped silently)
  const [addresses, setAddresses] = useState(() => Object.fromEntries(recipients.map((r) => [r.id, addressFor(r)])));
  const [quotes, setQuotes] = useState({});
  const [quoteErrors, setQuoteErrors] = useState({});
  const [quoting, setQuoting] = useState(false);
  const [expiredNote, setExpiredNote] = useState(false);
  const [run, setRun] = useState(initialRun);
  const [running, setRunning] = useState(false);
  const [, force] = useState(0);
  const { products: giftBoxes, state: boxState } = useProviderCatalogue('gift_boxes');

  useEffect(() => {
    let off = false;
    (async () => {
      let pf = null; let cd = null;
      try { pf = await api.getSendEntitlementPreflight(); } catch { pf = null; }
      let exp = false;
      try { const r = await api.getQrCashCardStatus(); exp = Boolean(r && r.card && r.card.present === true && r.card.expired === true); cd = r && r.card && r.card.present === true && r.card.expired !== true ? r.card : null; } catch { cd = null; }
      if (!off) { setPreflight(pf); setCard(cd); setCardExpired(exp); setLoading(false); }
    })();
    return () => { off = true; };
  }, []);

  const productById = (id) => (giftBoxes || []).find((p) => String(p.providerProductId) === String(id));
  const giftValue = (g) => (g.type === 'qrcash' ? `qrcash:${g.amount}` : g.type === 'gift_box' ? `box:${g.product.providerProductId}` : 'none');
  const giftFromValue = (v) => {
    if (v && v.startsWith('qrcash:')) return { type: 'qrcash', amount: Number(v.split(':')[1]) };
    if (v && v.startsWith('box:')) { const p = productById(v.slice(4)); return p ? { type: 'gift_box', product: { providerProductId: p.providerProductId, name: p.name } } : { type: 'none' }; }
    return { type: 'none' };
  };
  const giftLabel = (g) => (g.type === 'qrcash' ? `QR Cash $${g.amount}` : g.type === 'gift_box' ? `Gift box: ${g.product.name}` : 'No gift');
  const giftOptions = [
    ['none', 'No gift'],
    ...GROUP_QRCASH_AMOUNTS.map((a) => [`qrcash:${a}`, `QR Cash™ $${a}`]),
    ...(giftBoxes || []).map((p) => [`box:${p.providerProductId}`, `Gift box: ${p.name}${Number.isFinite(p.priceMinor) ? ` (from ${centsToDollarString(p.priceMinor)})` : ''}`]),
  ];

  const included = recipients.filter((r) => !left.includes(r.id));
  const items = included.map((r) => ({ contactId: r.id, gift: effectiveGift(defaultGift, overrides[r.id]), quote: quotes[r.id] || null, address: addresses[r.id] }));
  const costs = groupCosts(items);
  const allowance = groupAllowance(preflight, included.length);
  const needsCard = items.some((i) => i.gift.type !== 'none');
  const boxItems = items.filter((i) => i.gift.type === 'gift_box');
  const paidCount = items.filter((i) => i.gift.type !== 'none').length;
  const sizeOk = included.length >= 2 && included.length <= GROUP_MAX;
  // Everything that would stop the group part-way is checked here, before any charge: the account, the sender's voice
  // and photo, the sends left and today's AI greetings. The hourly limit cannot be read in advance (see the note).
  const ownerMismatch = Boolean(run && (!userId || String(run.userId) !== String(userId)));
  const blockers = [
    ...(!userId || ownerMismatch ? ['Sign in again to send to a group.'] : []),
    ...(senderVoiceMissing ? ['Every Greet-Me uses your recorded voice. Record it first: Start recording, in Personalize on the dashboard.'] : []),
    ...(senderPhotoMissing ? ['Every Greet-Me includes your photo so the recipient knows it is from you. Add a profile photo first.'] : []),
    ...(!sizeOk ? [included.length > GROUP_MAX ? `A group is up to ${GROUP_MAX} people.` : 'A group needs at least two people. Send to one person with Send Now.'] : []),
    ...allowance.reasons,
    ...(needsCard && card === null ? [cardExpired
      ? 'Your saved card has expired, so this group can’t include a paid gift. Update the card (it is the one your QR Cash Auto-Gift uses, in a recipient’s Occasion Scheduler), or choose “No gift”.'
      : 'No saved card on file, so this group can’t include a paid gift. Choose “No gift”, or send gifts one person at a time.'] : []),
    ...(boxItems.length && costs.unpriced ? ['Get prices for the gift boxes before sending.'] : []),
    ...(expiredNote ? ['Gift box prices are valid for 2 minutes and these have expired. Get fresh prices to continue.'] : []),
  ];
  const canSend = !loading && !run && !quoting && blockers.length === 0;

  const clearQuote = (id) => { setExpiredNote(false); setQuotes((q) => { const n = { ...q }; delete n[id]; return n; }); setQuoteErrors((e) => { const n = { ...e }; delete n[id]; return n; }); };
  const setAddress = (id, key, value) => { clearQuote(id); setAddresses((a) => ({ ...a, [id]: { ...a[id], [key]: value } })); };

  const getPrices = async () => {
    setQuoting(true); setExpiredNote(false);
    const toQuote = items.filter((i) => i.gift.type === 'gift_box').map((i) => ({ ...i }));
    await quoteGroupGiftBoxes(toQuote, { api });
    setQuotes((q) => ({ ...q, ...Object.fromEntries(toQuote.map((i) => [i.contactId, i.quote])) }));
    setQuoteErrors(Object.fromEntries(toQuote.filter((i) => i.quoteError).map((i) => [i.contactId, i.quoteError])));
    setQuoting(false);
  };

  const execute = async (r) => {
    setRun(r); setRunning(true);
    saveRun(window.localStorage, r);
    const stripe = stripePromise ? await stripePromise : null;
    await runGroup(r, {
      userId,
      api,
      buildPayload: (it) => buildPayload(it, r),
      confirmCardPayment: async (cs) => (stripe ? stripe.confirmCardPayment(cs) : { error: { message: 'Card confirmation is unavailable right now.' } }),
      onChange: (x) => { saveRun(window.localStorage, x); force((n) => n + 1); },
    });
    setRunning(false); force((n) => n + 1);
    if (runSummary(r).done) { clearRun(window.localStorage); onDone && onDone(r); }
  };

  const start = async () => {
    // A stale gift-box price is never charged: the sender gets fresh prices to look at first.
    if (boxItems.some((i) => isGiftBoxQuoteExpired(i.quote))) { setExpiredNote(true); return; }
    await execute(createGroupRun({
      userId, occasion, words,
      recipients: included.map((p) => ({ contactId: p.id, name: p.name, email: p.email })),
      defaultGift, overrides, addresses, quotes,
    }));
  };

  const refreshRunPrices = async () => {
    setQuoting(true);
    await quoteGroupGiftBoxes(run.items.filter((i) => i.status === 'needs_quote'), { api });
    // The sender is shown these new prices; pressing Continue confirms them.
    run.items.forEach((i) => { if (i.status === 'needs_quote' && i.quote) { i.status = 'pending'; i.error = null; i.confirmedTotalCents = i.quote.quotedTotalCents; } });
    saveRun(window.localStorage, run);
    setQuoting(false); force((n) => n + 1);
  };

  const summary = run ? runSummary(run) : null;
  const fourLines = (d) => `Product ${centsToDollarString(d.productCents)} · S/H ${centsToDollarString(d.shippingHandlingCents)} · Tax ${centsToDollarString(d.taxCents)} · Total ${centsToDollarString(d.totalCents)}`;
  const freshlyPriced = run ? run.items.filter((i) => i.quote && i.status === 'pending' && groupGift(i.gift).type === 'gift_box') : [];

  return (
    <div className="grv-backdrop" role="dialog" aria-modal="true" aria-labelledby="grv-title" data-testid="gx-group-review">
      <div className="grv">
        <div className="grv-head">
          <div>
            <span className="eyebrow">{run ? 'Sending' : 'Review'}</span>
            <h2 id="grv-title">{run && ownerMismatch ? 'Group send unavailable' : run ? `${summary.sent} of ${summary.total} accepted for sending` : `${included.length} Greet-Mes for ${occasion}`}</h2>
          </div>
          <button type="button" className="iconbtn" aria-label="Close" onClick={onClose} disabled={running}><X size={16} /></button>
        </div>

        {!run ? (
          <>
            <div className="grv-rules" data-testid="grv-rules">
              <div><Users size={15} style={{ flex: 'none', marginTop: 2 }} /> Each person gets their own Greet-Me, personalized with their name. Your words go into each card; each card uses that person&rsquo;s own saved memory photos.</div>
              <div>{loading ? 'Checking your sends…'
                : allowance.unlimited ? 'Sends: unlimited on your plan.'
                  : allowance.remaining !== null ? `Sends: ${allowance.remaining} left; this group uses ${included.length}.` : 'Sends: each person uses one send.'}
              {allowance.aiDaily ? ` Today: ${allowance.aiDaily.remaining} of ${allowance.aiDaily.limit} Greet-Mes left to create.` : allowance.aiUnknown ? ` Daily limit: ${allowance.aiLimit ?? '—'} Greet-Mes (today’s count couldn’t be checked).` : ''} Up to 20 Greet-Mes can be sent per hour.</div>
            </div>

            <label className="grv-default">
              <span className="fieldlabel">Gift for everyone</span>
              <select data-testid="grv-default-gift" value={giftValue(defaultGift)} onChange={(e) => { setExpiredNote(false); setQuotes({}); setQuoteErrors({}); setDefaultGift(giftFromValue(e.target.value)); }}>
                {giftOptions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              <span className="sub">{defaultGiftChoice && defaultGiftChoice.type === 'other'
                ? 'A group can include QR Cash or a gift box; other gifts are chosen one person at a time in the send flow.'
                : boxState === 'loading' ? 'Change it for anyone below. Loading gift boxes…' : 'Change it for anyone below.'}</span>
            </label>

            <div className="grv-list" data-testid="grv-list">
              {recipients.map((r) => {
                const out = left.includes(r.id);
                const g = effectiveGift(defaultGift, overrides[r.id]);
                const row = costs.rows.find((x) => x.contactId === r.id);
                const a = addresses[r.id] || {};
                return (
                  <div className={`grv-row ${out ? 'out' : ''}`} key={r.id} data-testid="grv-row">
                    <button type="button" className={`box ${out ? '' : 'on'}`} aria-pressed={!out} aria-label={out ? `Include ${r.name}` : `Leave out ${r.name}`} onClick={() => setLeft((cur) => (out ? cur.filter((x) => x !== r.id) : [...cur, r.id]))}><Check size={12} /></button>
                    <div className="grv-who"><b>{r.name}</b><span>{r.email}</span></div>
                    <select aria-label={`Gift for ${r.name}`} disabled={out} value={overrides[r.id] ? giftValue(groupGift(overrides[r.id])) : 'default'} onChange={(e) => { clearQuote(r.id); setOverrides((cur) => { const n = { ...cur }; if (e.target.value === 'default') delete n[r.id]; else n[r.id] = giftFromValue(e.target.value); return n; }); }}>
                      <option value="default">Same as everyone</option>
                      {giftOptions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                    <span className="grv-cost">{out ? 'Left out'
                      : row && row.kind === 'qrcash' ? `${centsToDollarString(row.giftCents)} + ${centsToDollarString(row.feeCents)} fee`
                        : row && row.kind === 'gift_box' ? (row.display ? centsToDollarString(row.display.totalCents) : 'Price needed')
                          : 'No gift'}</span>
                    {!out && g.type === 'gift_box' ? (
                      <div className="grv-addr" data-testid="grv-address">
                        <span className="fieldlabel">Ship {g.product.name} to</span>
                        <div className="grv-addr-grid">
                          <input aria-label={`${r.name} first name`} placeholder="First name" value={a.firstName || ''} onChange={(e) => setAddress(r.id, 'firstName', e.target.value)} />
                          <input aria-label={`${r.name} last name`} placeholder="Last name" value={a.lastName || ''} onChange={(e) => setAddress(r.id, 'lastName', e.target.value)} />
                          <input aria-label={`${r.name} street address`} placeholder="Street address" className="wide" value={a.address1 || ''} onChange={(e) => setAddress(r.id, 'address1', e.target.value)} />
                          <input aria-label={`${r.name} apartment`} placeholder="Apt, suite (optional)" className="wide" value={a.address2 || ''} onChange={(e) => setAddress(r.id, 'address2', e.target.value)} />
                          <input aria-label={`${r.name} city`} placeholder="City" value={a.city || ''} onChange={(e) => setAddress(r.id, 'city', e.target.value)} />
                          <input aria-label={`${r.name} state`} placeholder="State (NJ)" value={a.state || ''} onChange={(e) => setAddress(r.id, 'state', e.target.value)} />
                          <input aria-label={`${r.name} ZIP`} placeholder="ZIP" value={a.postalCode || ''} onChange={(e) => setAddress(r.id, 'postalCode', e.target.value)} />
                        </div>
                        {quoteErrors[r.id] ? <span className="saveerr" data-testid="grv-quote-error">{quoteErrors[r.id]}</span> : null}
                        {quotes[r.id] ? <span className="sub" data-testid="grv-quote-lines">{fourLines(quotes[r.id].display)}</span> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="grv-total" data-testid="grv-total">
              <span>{costs.unpriced
                ? `The total is shown once the ${costs.unpriced === 1 ? 'gift box is' : `${costs.unpriced} gift boxes are`} priced.`
                : costs.totalCents
                  ? `${costs.feeCents ? `Gifts ${centsToDollarString(costs.giftCents)} + QR Cash fees ${centsToDollarString(costs.feeCents)} = ` : 'Total '}${centsToDollarString(costs.totalCents)}`
                  : 'No gifts: nothing is charged.'}</span>
              {needsCard ? <span className="sub">{card === undefined ? 'Checking your saved card…' : card ? `Charged to your saved ${card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : 'card'} •••• ${card.last4 || ''}, one charge per person.` : ''}</span> : null}
            </div>
            {paidCount ? <div className="sub" data-testid="grv-rate-note">Payments are limited to 20 requests an hour, shared by QR Cash and gift boxes and counting any payments you made in the last hour. This group makes {paidCount} (up to {paidCount * 2} if your bank asks to confirm). Greetings are limited to 20 an hour. If a limit is reached, sending stops before anyone else is charged and nobody is lost; you can continue later.</div> : null}
            {blockers.length ? <div className="warn" data-testid="grv-blockers"><AlertCircle size={16} style={{ flex: 'none', marginTop: 2 }} /><span>{blockers.join(' ')}</span></div> : null}
            <div className="grv-actions">
              <span className="sub">{boxItems.length ? 'Prices are the gift-box checkout’s own and valid for 2 minutes. ' : ''}Nothing is charged or sent until you press Send.</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {boxItems.length ? <button type="button" className="btn btn-line" data-testid="grv-get-prices" disabled={quoting || running} onClick={getPrices}>{quoting ? 'Getting prices…' : costs.unpriced || expiredNote ? 'Get prices' : 'Refresh prices'}</button> : null}
                <button type="button" className="btn btn-primary" data-testid="grv-send" disabled={!canSend} onClick={start}>
                  <Send size={17} /> Send {included.length} Greet-Mes{costs.totalCents ? ` · ${centsToDollarString(costs.totalCents)}` : ''}
                </button>
              </div>
            </div>
          </>
        ) : ownerMismatch ? (
          // N-7: another account's run — show none of its data (no names, emails, gifts, amounts or counts).
          <>
            <div className="warn" data-testid="grv-owner"><AlertCircle size={16} style={{ flex: 'none', marginTop: 2 }} /><span>This group send belongs to a different account and can&rsquo;t be continued here.</span></div>
            <div className="grv-actions">
              <span className="sub" />
              <button type="button" className="btn btn-primary" data-testid="grv-retry" disabled><RotateCcw size={16} /> Continue</button>
            </div>
          </>
        ) : (
          <>
            {run.stopped ? <div className="warn" data-testid="grv-stopped"><AlertCircle size={16} style={{ flex: 'none', marginTop: 2 }} /><span>Stopped: {run.stopped.message} Nobody after this was charged or sent; nothing was lost.</span></div> : null}
            <div className="grv-list" data-testid="grv-results">
              {run.items.map((it) => {
                const g = groupGift(it.gift);
                return (
                  <div className="grv-row" key={it.contactId} data-testid="grv-result">
                    <span className={`num ${it.status === 'sent' ? 'done' : ''}`} style={{ width: 22, height: 22 }}>{it.status === 'sent' ? <Check size={12} /> : ''}</span>
                    <div className="grv-who"><b>{it.name}</b><span>{it.error && ['failed', 'held', 'unknown', 'needs_quote'].includes(it.status) ? it.error.message : it.email}</span></div>
                    <span className="grv-cost">{g.type === 'none' ? (it.giftDropped ? 'Sent without the gift' : 'No gift') : `${giftLabel(g)}${it.giftPayload ? ' · paid' : ''}`}</span>
                    <span className={`tag ${STATUS_TONE[it.status] || 'amber'}`} data-testid="grv-status">{STATUS_LABEL[it.status] || it.status}</span>
                    {(it.status === 'held' || it.status === 'unknown') && !running ? (
                      <button type="button" className="link" data-testid="grv-send-without-gift" onClick={() => { sendWithoutGift(run, it.contactId); saveRun(window.localStorage, run); force((n) => n + 1); }}>Send the greeting without the gift</button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {freshlyPriced.length ? (
              <div className="sub" data-testid="grv-run-fresh-prices">New prices — {freshlyPriced.map((i) => `${i.name}: ${fourLines(i.quote.display)}`).join(' · ')}</div>
            ) : null}
            <div className="grv-actions">
              <span className="sub">{summary.done ? 'All accepted for sending. You\u2019ll see each one under Past Occasions as it goes out.'
                : summary.held || summary.unknown ? 'A held or unconfirmed gift order is never placed again; check your orders, or send that greeting without the gift.'
                  : summary.failed ? 'A gift that was paid for stays with its person and is not charged again on retry.' : ''}</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {summary.needsQuote ? <button type="button" className="btn btn-line" data-testid="grv-refresh-run-prices" disabled={quoting || running} onClick={refreshRunPrices}>{quoting ? 'Getting prices…' : 'Get fresh prices'}</button> : null}
                {!summary.done ? <button type="button" className="btn btn-primary" data-testid="grv-retry" disabled={running || quoting || summary.needsQuote > 0} onClick={() => execute(run)}><RotateCcw size={16} /> {run.stopped || summary.failed ? 'Try the rest again' : 'Continue'}</button>
                  : <button type="button" className="btn btn-primary" onClick={onClose}><Check size={16} /> Done</button>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
