// src/components/celebrations/CelebrationsWorkspace.jsx
//
// Celebrations (Report 135): the place to manage people and their occasions, with two ways into the SAME
// per-recipient Occasion Scheduler (ContactForm) records:
//   * Recipients path: Individuals | Friends | Family | Professional (the recipient's existing relationshipCategory),
//     then search, then people. Selecting a person, or one of their occasion chips, opens their Occasion Scheduler.
//   * Occasions path: the scheduler's occasion list and sub-occasions. Selecting an occasion shows every recipient with
//     what their own record holds for it: saved dates, the shared calendar date where the occasion has one, or the
//     date still needed. One person opens their Occasion Scheduler at that occasion (added there if they don't hold
//     it yet); several people open the dashboard's own Dates & gifts resolver. Both save each person's full record.
//   * Upcoming | Past: saved dates and real statuses only (utils/celebrationsModel.js).
// This component schedules, sends and saves nothing itself.
import { useMemo, useState } from 'react';
import { Send, Pencil, Trash2, Search, UserPlus, Upload, Plus, CalendarDays } from 'lucide-react';
import {
  RECIPIENT_SEGMENTS, CATEGORY_LABELS, filterRecipients, segmentCounts, OCCASION_GROUPS, occasionSummaries, occasionRoster,
  upcomingForContact, pastForContact, pastForOccasion, nextUp, occasionLabel, occasionIcon,
} from '../../utils/celebrationsModel';
import { isSchedulerOccasion } from '../../utils/occasionResolver';
import { GROUP_MAX } from '../../utils/groupSend';
import { CELEBRATIONS_CSS } from './celebrationsStyles';
import giftBoxStack from '../../assets/gifts/gift-box-stack.png';

const AV = ['#5A3E8A', '#7C63AE', '#4A3273', '#8A5A2B', '#3E5A7C', '#6B3E6B'];
const avBg = (n) => { let h = 0; for (const c of n || '') h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };
const initials = (n) => (n || '?').split(/\s+/).filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || '?';
const day = (d, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', opts) : '');
const inDays = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 14 ? `in ${n} days` : n < 60 ? `in ${Math.round(n / 7)} weeks` : `in ${Math.round(n / 30)} months`);
const GIFT_NAMES = { none: 'No gift', qrcash: 'QR Cash', merch: 'Branded Goods', curated: 'Greet-Me Select', marketplace: 'Gift Place', gift_boxes: 'Gift box', flowers: 'Flowers' };
export function giftText(g) {
  if (!g || !g.type) return 'Gift not chosen';
  if (g.type === 'none') return 'No gift';
  const amount = g.type === 'qrcash' && (g.amount || g.customAmount) ? ` $${g.amount || g.customAmount}` : '';
  const product = g.scheduledGift && g.scheduledGift.name ? `: ${g.scheduledGift.name}` : '';
  return `${GIFT_NAMES[g.type] || g.type}${amount}${product} · ${g.autoGift ? 'Auto-Gift on' : 'reminder only'}`;
}
const chipNote = (u) => (u.missingDate ? `${u.label}: a date is still needed in their Occasion Scheduler.`
  : u.status.source === 'scheduler' ? `${u.label} ${day(u.date)}: ${u.status.label} (from the scheduler).`
    : u.status.planned ? `${u.label} is planned — set to auto-send on ${day(u.date)}.` : `${u.label} is still open — not set to send yet.`);

export default function CelebrationsWorkspace({
  contacts = [], upcomingRows = [], sent = [], now = new Date(), scopeToggle = null,
  onOpenScheduler, onSend, onDelete, onAddRecipient, onImport, onSendGreeting, onScheduleGroup,
}) {
  const [path, setPath] = useState('recipients');
  const [when, setWhen] = useState('upcoming');
  const [segment, setSegment] = useState('individuals');
  const [term, setTerm] = useState('');
  const [occ, setOcc] = useState('birthday');
  const [picked, setPicked] = useState([]);

  const counts = useMemo(() => segmentCounts(contacts), [contacts]);
  const shown = useMemo(() => filterRecipients(contacts, segment, term), [contacts, segment, term]);
  const summaries = useMemo(() => occasionSummaries(contacts, upcomingRows, sent, now), [contacts, upcomingRows, sent, now]);
  const roster = useMemo(() => occasionRoster(contacts, occ, upcomingRows, now), [contacts, occ, upcomingRows, now]);
  const next = useMemo(() => nextUp(contacts, upcomingRows, now), [contacts, upcomingRows, now]);
  const segInfo = RECIPIENT_SEGMENTS.find((s) => s.key === segment);
  const schedulable = isSchedulerOccasion(occasionLabel(occ));

  const chooseOcc = (t) => { setOcc(t); setPicked([]); };
  const togglePick = (id) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= GROUP_MAX ? cur : [...cur, id]));

  const recipientsCard = (
    <section className="card listcard" data-testid="cx-recipients">
      <div className="cardhead">
        <div><h2>Recipients</h2><p>{contacts.length} {contacts.length === 1 ? 'person' : 'people'} in your circle</p></div>
        <button type="button" className="btn btn-pri" data-testid="add-recipient" onClick={onAddRecipient}><Plus size={16} /> Add Recipient</button>
      </div>
      {scopeToggle}
      {/* Founder: Individuals / Friends / Family / Professional below the primary toggle and above the search. */}
      <div className="chips" role="tablist" aria-label="Show recipients" data-testid="cx-segments">
        {RECIPIENT_SEGMENTS.map((s) => (
          <button key={s.key} type="button" role="tab" aria-selected={segment === s.key} data-testid={`cx-seg-${s.key}`} onClick={() => setSegment(s.key)}>
            {s.label}<span className="n">{counts[s.key]}</span>
          </button>
        ))}
      </div>
      <label className="search"><Search size={16} color="#8a8199" /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Find someone…" aria-label="Find someone" /></label>
      <div className="rows" data-testid="cx-rows">
        {shown.length === 0 ? (
          <p className="empty" data-testid="cx-empty">{term ? `No one matches “${term}”.` : segment === 'individuals' ? 'No people yet. Add someone you care about.' : `No ${segInfo.label.toLowerCase()} yet — set a relationship on a recipient.`}</p>
        ) : shown.map((c) => {
          const ups = when === 'upcoming' ? upcomingForContact(c, upcomingRows, now) : [];
          const past = when === 'past' ? pastForContact(c, sent, now) : [];
          const soon = ups.find((u) => !u.missingDate);
          const relName = String(c.relationship || '').replace(/_/g, ' ').replace(/\w/g, (x) => x.toUpperCase());
          const cat = CATEGORY_LABELS[c.relationshipCategory];
          const rel = [relName, cat && cat.toLowerCase() !== relName.toLowerCase() ? cat : ''].filter(Boolean).join(' · ');
          return (
            <div className="row" key={c.id} data-testid="cx-row" data-contact={c.id}>
              <button type="button" className="person" data-testid="cx-person" onClick={() => onOpenScheduler(c, null)} aria-label={`Open ${c.name}'s occasions and Occasion Scheduler`}>
                <span className="av" style={{ background: avBg(c.name) }}>{initials(c.name)}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="pname" style={{ display: 'block' }}>{c.name}</span>
                  <span className="pmeta" style={{ display: 'block' }} data-testid="cx-meta">
                    {rel}{when === 'upcoming' ? (soon ? ` — ${soon.label} ${inDays(soon.daysUntil)}` : ' — no upcoming occasions')
                      : past.length ? ` — last: ${past[0].label}, ${past[0].status.label.toLowerCase()}` : ' — no sends recorded'}
                  </span>
                  {when === 'upcoming' && soon ? <span className="pdate" style={{ display: 'block' }}>{day(soon.date)}</span> : null}
                </span>
              </button>
              <div className="racts">
                <button type="button" className="sendbtn" onClick={() => onSend(c)} aria-label={`Send a Greet-Me to ${c.name}`}><Send size={14} /> Send</button>
                <button type="button" className="iconbtn" data-testid="cx-edit" onClick={() => onOpenScheduler(c, null)} aria-label={`Edit ${c.name}`} title="Edit"><Pencil size={15} /></button>
                <button type="button" className="iconbtn del" onClick={() => onDelete(c)} aria-label="Delete recipient" title="Delete"><Trash2 size={15} /></button>
              </div>
              <div className="occchips" data-testid="cx-chips">
                {when === 'upcoming' ? ups.map((u) => (
                  <button key={u.type} type="button" data-testid="cx-chip" data-status={u.status.key}
                    className={`chip ${u.missingDate ? 'amber' : u.status.planned ? 'planned' : u.status.tone === 'muted' && u.status.source === 'scheduler' ? 'muted' : 'open'}`}
                    data-note={chipNote(u)} aria-label={chipNote(u)} onClick={() => onOpenScheduler(c, u.type)}>
                    <span className="dot" />{u.label}{u.status.source === 'scheduler' ? ` · ${u.status.label}` : ''}
                  </button>
                )) : past.map((p) => (
                  <span key={p.id} className={`chip ${p.status.tone === 'ok' ? 'planned' : p.status.tone === 'amber' ? 'amber' : 'muted'}`} data-testid="cx-past-chip" data-status={p.status.key}
                    data-note={p.kind === 'send' ? `${p.label}: ${p.status.label}, ${day(p.when, { month: 'short', day: 'numeric', year: 'numeric' })}.` : `${p.label} was on ${day(p.when, { month: 'short', day: 'numeric', year: 'numeric' })}. No Greet-Me send is recorded for it.`}>
                    <span className="dot" />{p.label} · {p.status.label}{p.when ? ` · ${day(p.when, { month: 'short', day: 'numeric' })}` : ''}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const heldRows = roster.rows.filter((r) => r.held);
  const otherRows = roster.rows.filter((r) => !r.held);
  const ruleText = roster.kind === 'personal'
    ? `${roster.label} dates belong to each person. Saved dates are shown; anyone without one is asked for theirs.`
    : roster.sharedDate ? `${roster.label} is on the same calendar date for everyone: ${day(roster.sharedDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}. It is filled in for people who don't have it saved yet.`
      : `${roster.label} shares one calendar date, but its date isn't calculated here. Enter it in each person's Occasion Scheduler.`;
  const rosterRow = (r) => {
    const c = r.contact;
    return (
      <div className="rrow" key={c.id} data-testid="cx-roster-row" data-contact={c.id} data-held={r.held} data-source={r.dateSource}>
        {schedulable && when === 'upcoming' ? <input type="checkbox" aria-label={`Choose ${c.name}`} checked={picked.includes(c.id)} disabled={!picked.includes(c.id) && picked.length >= GROUP_MAX} onChange={() => togglePick(c.id)} /> : <span />}
        <span className="av" style={{ background: avBg(c.name), width: 32, height: 32, fontSize: 11 }}>{initials(c.name)}</span>
        <div className="who">
          <div className="pname" style={{ fontSize: 14.5 }}>{c.name}</div>
          <div className="line" data-testid="cx-roster-line">
            {r.dateSource === 'missing' ? 'Date needed' : `${day(r.held && r.next ? r.next.date : r.date)}${r.held && r.next ? ` · ${inDays(r.next.daysUntil)}` : ''}`}
            <span className={`src ${r.dateSource}`}>{r.dateSource === 'saved' ? 'saved date' : r.dateSource === 'shared' ? (r.held ? 'calendar date' : 'calendar date, not saved yet') : 'date needed'}</span>
            {r.held ? <> · {giftText(r.gift)}</> : null}
          </div>
        </div>
        <div className="stat" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {r.held && r.status ? <span className={`chip ${r.status.planned ? 'planned' : r.status.tone === 'amber' ? 'amber' : r.status.source === 'scheduler' ? 'muted' : 'open'}`} data-testid="cx-roster-status"><span className="dot" />{r.status.label}</span> : null}
          <button type="button" className="btn btn-out btn-sm" data-testid="cx-roster-open" onClick={() => onOpenScheduler(c, occ, !r.held)}>
            {r.held ? 'Open scheduler' : 'Add in scheduler'}
          </button>
        </div>
      </div>
    );
  };
  const pastOcc = when === 'past' ? pastForOccasion(sent, occ) : [];

  const occasionsCard = (
    <section className="card listcard" data-testid="cx-occasions">
      <div className="cardhead">
        <div><h2>Occasions</h2><p>Start with an occasion, then choose who it&rsquo;s for.</p></div>
      </div>
      <div className="occgrid">
        <div className="occlist" role="tablist" aria-label="Occasions" data-testid="cx-occlist">
          {OCCASION_GROUPS.map((g) => (
            <div key={g.key} role="group" aria-label={g.title}>
              <div className="ogroup">{g.title}</div>
              {g.types.map((t) => {
                const s = summaries[t];
                return (
                  <button key={t} type="button" role="tab" className="occbtn" aria-selected={occ === t} data-testid={`cx-occ-${t}`} onClick={() => chooseOcc(t)}>
                    <span className="ic" aria-hidden="true">{s.icon}</span>
                    <span className="ol">{s.label}</span>
                    <span className="cnt">{when === 'upcoming' ? s.heldCount : s.pastCount}</span>
                    <span className="os">
                      {s.kind === 'personal' ? 'Each person’s own date' : s.sharedDate ? `Shared date · ${day(s.sharedDate, { month: 'short', day: 'numeric' })}` : 'Shared date · entered per person'}
                      {when === 'upcoming' && s.soonest ? ` · next ${day(s.soonest.date, { month: 'short', day: 'numeric' })}` : ''}
                      {when === 'past' ? ` · ${s.pastCount} sent` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="roster" data-testid="cx-roster" data-kind={roster.kind}>
          <h3><span aria-hidden="true">{occasionIcon(occ)}</span>{roster.label} <span className={`kind ${roster.kind}`} data-testid="cx-kind">{roster.kind === 'personal' ? 'Each person’s own date' : 'Shared calendar date'}</span></h3>
          {when === 'upcoming' ? (
            <>
              <p className="rule" data-testid="cx-rule">{ruleText}</p>
              <div className="rosterbody">
                <div className="rsec">Saved for {heldRows.length} {heldRows.length === 1 ? 'person' : 'people'}</div>
                {heldRows.length ? heldRows.map(rosterRow) : <p className="empty" style={{ padding: '12px 0' }}>No one has {roster.label} saved yet.</p>}
                {otherRows.length ? <div className="rsec">Not added yet</div> : null}
                {otherRows.map(rosterRow)}
              </div>
              {schedulable ? (
                <div className="bulk" data-testid="cx-bulk">
                  <p>Choose up to {GROUP_MAX} people to set {roster.label} for all of them at once in Dates &amp; gifts on your dashboard: saved and calendar dates are filled in, missing ones are asked per person, and each person&rsquo;s other occasions are kept.</p>
                  <button type="button" className="btn btn-pri btn-sm" data-testid="cx-bulk-go" disabled={picked.length === 0} onClick={() => onScheduleGroup(roster.label, picked)}>
                    <CalendarDays size={15} /> Set dates &amp; gifts{picked.length ? ` for ${picked.length}` : ''}
                  </button>
                </div>
              ) : <p className="rule" style={{ marginTop: 12 }}>{roster.label} is a one-time occasion that isn&rsquo;t sent automatically. Open each person&rsquo;s scheduler to save the date; send it with Send Now.</p>}
            </>
          ) : (
            <div className="rosterbody" data-testid="cx-past-occasion">
              {pastOcc.length === 0 ? <p className="empty" style={{ padding: '16px 0' }}>No sends recorded for {roster.label}.</p>
                : pastOcc.map((p) => {
                  const s = sent.find((x) => x.id === p.id) || {};
                  return (
                    <div className="rrow" key={p.id} data-testid="cx-past-row">
                      <span /><span className="av" style={{ background: avBg(s.recipientName), width: 32, height: 32, fontSize: 11 }}>{initials(s.recipientName)}</span>
                      <div className="who"><div className="pname" style={{ fontSize: 14.5 }}>{s.recipientName || 'Unknown'}</div><div className="line">{day(p.when, { month: 'short', day: 'numeric', year: 'numeric' })}</div></div>
                      <div className="stat"><span className={`chip ${p.status.tone === 'ok' ? 'planned' : p.status.tone === 'amber' ? 'amber' : 'muted'}`}><span className="dot" />{p.status.label}</span></div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <div className="cx" data-testid="cx-root">
      <style>{CELEBRATIONS_CSS}</style>
      {next ? <p className="nextup" data-testid="cx-nextup">Next up: <b>{next.label} for {next.contact.name}</b> — {day(next.date)}</p> : null}
      <section className="card head" data-testid="cx-head">
        <span className="thumb" aria-hidden="true"><img src={giftBoxStack} alt="" /></span>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div className="titlerow"><h1>My People</h1><span className="script">Forget Them Not!™</span></div>
          <p className="sub">Automate personalized Greet-Me greetings, gifts and unforgettable moments for the people who matter most.</p>
        </div>
        <div className="hacts">
          <button type="button" className="btn btn-out" onClick={onSendGreeting}><Send size={15} /> Send Greet-Me</button>
          <button type="button" className="btn btn-out" onClick={onAddRecipient}><UserPlus size={15} /> Add Recipient</button>
          <button type="button" className="btn btn-out" onClick={onImport}><Upload size={15} /> Import Wizard</button>
        </div>
      </section>
      <section className="card navcard" data-testid="cx-nav">
        <div className="navrow">
          <span className="eyebrow">Start from</span>
          <div className="seg" role="tablist" aria-label="Start from" data-testid="cx-path">
            <button type="button" role="tab" aria-selected={path === 'recipients'} data-testid="cx-path-recipients" onClick={() => setPath('recipients')}>Recipients</button>
            <button type="button" role="tab" aria-selected={path === 'occasions'} data-testid="cx-path-occasions" onClick={() => setPath('occasions')}>Occasions</button>
          </div>
          <span className="hint">{path === 'recipients' ? 'Start with someone, then add their occasions.' : 'Start with an occasion, then choose who it’s for.'}</span>
        </div>
        <div className="navrow">
          <div className="seg small" role="tablist" aria-label="When" data-testid="cx-when">
            <button type="button" role="tab" aria-selected={when === 'upcoming'} data-testid="cx-when-upcoming" onClick={() => setWhen('upcoming')}>Upcoming Occasions</button>
            <button type="button" role="tab" aria-selected={when === 'past'} data-testid="cx-when-past" onClick={() => setWhen('past')}>Past Occasions</button>
          </div>
        </div>
      </section>
      {path === 'recipients' ? recipientsCard : occasionsCard}
    </div>
  );
}
