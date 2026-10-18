// src/components/dashboard/GroupReview.jsx
//
// G2 — the ONE review for a group Send Now (2-10 people, one shared occasion; Report 103 §0k). Shows, before
// anything is charged or sent: who gets a Greet-Me, each person's gift (the group default or their own
// override) and cost, the total, the card that pays, and what the current rules allow (sends left, today's
// AI greetings, the hourly limit). Pressing Send runs utils/groupSend.js: one EXISTING per-recipient send each,
// with its own idempotency keys. Results stay on screen; only failures are retried; an unfinished run resumes.
import { useEffect, useState } from 'react';
import { Check, X, AlertCircle, RotateCcw, Send, Users } from 'lucide-react';
import api from '../../api/api';
import { stripePromise } from '../../stripe/stripeProvider';
import { centsToDollarString } from '../../utils/qrCashAmount';
import {
  GROUP_MAX, GROUP_QRCASH_AMOUNTS, groupGift, effectiveGift, groupCosts, groupAllowance,
  createGroupRun, runGroup, runSummary, saveRun, clearRun,
} from '../../utils/groupSend';

const giftValue = (g) => (g && g.type === 'qrcash' ? `qrcash:${g.amount}` : 'none');
const giftFromValue = (v) => (v && v.startsWith('qrcash:') ? { type: 'qrcash', amount: Number(v.split(':')[1]) } : { type: 'none' });
const STATUS_LABEL = { pending: 'Waiting', charging: 'Paying for gift…', sending: 'Sending…', sent: 'Sent', failed: 'Not sent' };

export default function GroupReview({ recipients, occasion, words, defaultGiftChoice, buildPayload, senderPhotoMissing = false, initialRun = null, onClose, onDone }) {
  const [preflight, setPreflight] = useState(null);
  const [card, setCard] = useState(undefined); // undefined = loading, null = none
  const [loading, setLoading] = useState(true);
  const [defaultGift, setDefaultGift] = useState(groupGift(defaultGiftChoice));
  const [overrides, setOverrides] = useState({});
  const [left, setLeft] = useState([]); // people the sender leaves out at review (never dropped silently)
  const [run, setRun] = useState(initialRun);
  const [running, setRunning] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    let off = false;
    (async () => {
      let pf = null; let cd = null;
      try { pf = await api.getSendEntitlementPreflight(); } catch { pf = null; }
      try { const r = await api.getQrCashCardStatus(); cd = r && r.card && r.card.present === true && r.card.expired !== true ? r.card : null; } catch { cd = null; }
      if (!off) { setPreflight(pf); setCard(cd); setLoading(false); }
    })();
    return () => { off = true; };
  }, []);

  const included = recipients.filter((r) => !left.includes(r.id));
  const items = included.map((r) => ({ contactId: r.id, gift: effectiveGift(defaultGift, overrides[r.id]) }));
  const costs = groupCosts(items);
  const allowance = groupAllowance(preflight, included.length);
  const needsCard = items.some((i) => i.gift.type === 'qrcash');
  const sizeOk = included.length >= 2 && included.length <= GROUP_MAX;
  const blockers = [
    ...(senderPhotoMissing ? ['Every Greet-Me includes your photo so the recipient knows it is from you. Add a profile photo first.'] : []),
    ...(!sizeOk ? [included.length > GROUP_MAX ? `A group is up to ${GROUP_MAX} people.` : 'A group needs at least two people. Send to one person with Send Now.'] : []),
    ...allowance.reasons,
    ...(needsCard && card === null ? ['No saved card on file, so this group can’t include QR Cash. Choose “No gift”, or send QR Cash one person at a time.'] : []),
  ];
  const canSend = !loading && !run && blockers.length === 0;

  const start = async (existing) => {
    const r = existing || createGroupRun({
      occasion, words,
      recipients: included.map((p) => ({ contactId: p.id, name: p.name, email: p.email })),
      defaultGift, overrides,
    });
    setRun(r); setRunning(true);
    saveRun(window.localStorage, r);
    const stripe = stripePromise ? await stripePromise : null;
    await runGroup(r, {
      api,
      buildPayload: (it) => buildPayload(it, r),
      confirmCardPayment: async (cs) => (stripe ? stripe.confirmCardPayment(cs) : { error: { message: 'Card confirmation is unavailable right now.' } }),
      onChange: (x) => { saveRun(window.localStorage, x); force((n) => n + 1); },
    });
    setRunning(false); force((n) => n + 1);
    if (runSummary(r).done) { clearRun(window.localStorage); onDone && onDone(r); }
  };

  const summary = run ? runSummary(run) : null;
  const giftOptions = [['none', 'No gift'], ...GROUP_QRCASH_AMOUNTS.map((a) => [`qrcash:${a}`, `QR Cash™ $${a}`])];

  return (
    <div className="grv-backdrop" role="dialog" aria-modal="true" aria-labelledby="grv-title" data-testid="gx-group-review">
      <div className="grv">
        <div className="grv-head">
          <div>
            <span className="eyebrow">{run ? 'Sending' : 'Review'}</span>
            <h2 id="grv-title">{run ? `${summary.sent} of ${summary.total} sent` : `${included.length} Greet-Mes for ${occasion}`}</h2>
          </div>
          <button type="button" className="iconbtn" aria-label="Close" onClick={onClose} disabled={running}><X size={16} /></button>
        </div>

        {!run ? (
          <>
            <div className="grv-rules" data-testid="grv-rules">
              <div><Users size={15} /> Each person gets their own Greet-Me, personalized with their name. Your words go into each card; each card uses that person&rsquo;s own saved memory photos.</div>
              <div>{loading ? 'Checking your sends…'
                : allowance.unlimited ? 'Sends: unlimited on your plan.'
                  : allowance.remaining !== null ? `Sends: ${allowance.remaining} left; this group uses ${included.length}.` : 'Sends: each person uses one send.'}
              {allowance.aiDaily ? ` Today: ${allowance.aiDaily.remaining} of ${allowance.aiDaily.limit} Greet-Mes left to create.` : ''} Up to 20 Greet-Mes can be sent per hour.</div>
            </div>

            <label className="grv-default">
              <span className="fieldlabel">Gift for everyone</span>
              <select data-testid="grv-default-gift" value={giftValue(defaultGift)} onChange={(e) => setDefaultGift(giftFromValue(e.target.value))}>
                {giftOptions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              <span className="sub">{defaultGiftChoice && defaultGiftChoice.type === 'other'
                ? 'Other gifts are chosen one person at a time in the send flow; a group can include QR Cash.'
                : 'Change it for anyone below.'}</span>
            </label>

            <div className="grv-list" data-testid="grv-list">
              {recipients.map((r) => {
                const out = left.includes(r.id);
                const row = costs.rows.find((x) => x.contactId === r.id);
                return (
                  <div className={`grv-row ${out ? 'out' : ''}`} key={r.id} data-testid="grv-row">
                    <button type="button" className={`box ${out ? '' : 'on'}`} aria-pressed={!out} aria-label={out ? `Include ${r.name}` : `Leave out ${r.name}`} onClick={() => setLeft((cur) => (out ? cur.filter((x) => x !== r.id) : [...cur, r.id]))}><Check size={12} /></button>
                    <div className="grv-who"><b>{r.name}</b><span>{r.email}</span></div>
                    <select aria-label={`Gift for ${r.name}`} disabled={out} value={overrides[r.id] ? giftValue(overrides[r.id]) : 'default'} onChange={(e) => setOverrides((cur) => { const n = { ...cur }; if (e.target.value === 'default') delete n[r.id]; else n[r.id] = giftFromValue(e.target.value); return n; })}>
                      <option value="default">Same as everyone ({groupGift(defaultGift).type === 'qrcash' ? `QR Cash $${groupGift(defaultGift).amount}` : 'No gift'})</option>
                      {giftOptions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                    <span className="grv-cost">{out ? 'Left out' : row && row.totalCents ? `${centsToDollarString(row.giftCents)} + ${centsToDollarString(row.feeCents)} fee` : 'No gift'}</span>
                  </div>
                );
              })}
            </div>

            <div className="grv-total" data-testid="grv-total">
              <span>{costs.totalCents ? `Gifts ${centsToDollarString(costs.giftCents)} + fees ${centsToDollarString(costs.feeCents)} = ${centsToDollarString(costs.totalCents)}` : 'No gifts: nothing is charged.'}</span>
              {needsCard ? <span className="sub">{card === undefined ? 'Checking your saved card…' : card ? `Charged to your saved ${card.brand || 'card'} •••• ${card.last4 || ''}, one charge per person.` : ''}</span> : null}
            </div>
            {blockers.length ? <div className="warn" data-testid="grv-blockers"><AlertCircle size={16} style={{ flex: 'none', marginTop: 2 }} /><span>{blockers.join(' ')}</span></div> : null}
            <div className="grv-actions">
              <span className="sub">Nothing is charged or sent until you press Send.</span>
              <button type="button" className="btn btn-primary" data-testid="grv-send" disabled={!canSend} onClick={() => start()}>
                <Send size={17} /> Send {included.length} Greet-Mes{costs.totalCents ? ` · ${centsToDollarString(costs.totalCents)}` : ''}
              </button>
            </div>
          </>
        ) : (
          <>
            {run.stopped ? <div className="warn" data-testid="grv-stopped"><AlertCircle size={16} style={{ flex: 'none', marginTop: 2 }} /><span>Stopped: {run.stopped.message} Nobody after this was sent; nothing was lost. You can try again later.</span></div> : null}
            <div className="grv-list" data-testid="grv-results">
              {run.items.map((it) => (
                <div className="grv-row" key={it.contactId} data-testid="grv-result">
                  <span className={`num ${it.status === 'sent' ? 'done' : ''}`} style={{ width: 22, height: 22 }}>{it.status === 'sent' ? <Check size={12} /> : ''}</span>
                  <div className="grv-who"><b>{it.name}</b><span>{it.error && it.status === 'failed' ? it.error.message : it.email}</span></div>
                  <span className="grv-cost">{groupGift(it.gift).type === 'qrcash' ? `QR Cash $${groupGift(it.gift).amount}${it.giftPayload ? ' · paid' : ''}` : 'No gift'}</span>
                  <span className={`tag ${it.status === 'sent' ? 'ok' : it.status === 'failed' ? 'muted' : 'amber'}`} data-testid="grv-status">{STATUS_LABEL[it.status] || it.status}</span>
                </div>
              ))}
            </div>
            <div className="grv-actions">
              <span className="sub">{summary.done ? 'All sent. You’ll see them under Past Occasions.' : summary.failed ? 'A gift that was paid for stays with its person and is not charged again on retry.' : ''}</span>
              {!summary.done ? <button type="button" className="btn btn-primary" data-testid="grv-retry" disabled={running} onClick={() => start(run)}><RotateCcw size={16} /> {run.stopped || summary.failed ? 'Try the rest again' : 'Continue'}</button>
                : <button type="button" className="btn btn-primary" onClick={onClose}><Check size={16} /> Done</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

