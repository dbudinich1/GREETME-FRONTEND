// src/components/celebrations/CelebrationsWorkspace.jsx
//
// Celebrations (Report 135): the place to manage people and their occasions, in two separate cards (founder layout
// adjustment 2026-10-22), each with its own bounded, scrolling viewport and its own state, both always mounted:
//   * Celebration Manager — Recipients | Occasions, two ways into the SAME per-recipient Occasion Scheduler
//     (ContactForm) records:
//       - Recipients: Individuals | Friends | Family | Professional (the recipient's existing relationshipCategory),
//         then search, then people. A person, or one of their occasion chips, opens their Occasion Scheduler.
//       - Occasions: the scheduler's occasion list and sub-occasions (with its own search). Selecting an occasion shows
//         every recipient with what their own record holds for it: saved dates, the shared calendar date where the
//         occasion has one, or the date still needed. One person opens their Occasion Scheduler at that occasion
//         (added there if they don't hold it yet); several people open the dashboard's own Dates & gifts resolver.
//   * Celebration Schedule — Upcoming Occasions | Past Occasions, its own search and results: saved dates and real
//     statuses only; Past lists real sends only (utils/celebrationsModel.js).
// This component schedules, sends and saves nothing itself.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Pencil, Trash2, Search, Upload, Plus, CalendarDays, ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import {
  RECIPIENT_SEGMENTS, CATEGORY_LABELS, filterRecipients, segmentCounts, OCCASION_GROUPS, occasionSummaries, occasionRoster,
  upcomingForContact, nextUp, occasionLabel, occasionIcon, scheduleUpcoming, schedulePast, scheduleMatches,
} from '../../utils/celebrationsModel';
import { isSchedulerOccasion } from '../../utils/occasionResolver';
import { GROUP_MAX } from '../../utils/groupSend';
import { CELEBRATIONS_CSS } from './celebrationsStyles';
import giftBoxStack from '../../assets/gifts/gift-box-stack.png';
import giftLuxuryBox from '../../assets/gifts/gift-luxury-box.png';
import giftBouquet from '../../assets/gifts/gift-bouquet.png';
import giftCard from '../../assets/gifts/gift-card.png';

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
const chipClass = (u) => (u.missingDate ? 'amber' : u.status.planned ? 'planned' : u.status.tone === 'muted' && u.status.source === 'scheduler' ? 'muted' : 'open');
const pastClass = (p) => (p.status.tone === 'ok' ? 'planned' : p.status.tone === 'amber' ? 'amber' : 'muted');
const titleCase = (v) => String(v || '').replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());

export default function CelebrationsWorkspace({
  contacts = [], upcomingRows = [], sent = [], now = new Date(), scopeToggle = null, initialPath = 'recipients', initialOccasion = 'birthday',
  onOpenScheduler, onSend, onDelete, onAddRecipient, onImport, onScheduleGroup, onAddGift,
}) {
  // Celebration Manager state.
  const [path, setPath] = useState(initialPath === 'occasions' ? 'occasions' : 'recipients');
  const [segment, setSegment] = useState('individuals');
  const [term, setTerm] = useState('');
  const [occTerm, setOccTerm] = useState('');
  const [occ, setOcc] = useState(OCCASION_GROUPS.some((g) => g.types.includes(initialOccasion)) ? initialOccasion : 'birthday');
  const [picked, setPicked] = useState([]);
  // Celebration Schedule state (independent).
  const [when, setWhen] = useState('upcoming');
  const [schedTerm, setSchedTerm] = useState('');

  const counts = useMemo(() => segmentCounts(contacts), [contacts]);
  const shown = useMemo(() => filterRecipients(contacts, segment, term), [contacts, segment, term]);
  const summaries = useMemo(() => occasionSummaries(contacts, upcomingRows, sent, now), [contacts, upcomingRows, sent, now]);
  const roster = useMemo(() => occasionRoster(contacts, occ, upcomingRows, now), [contacts, occ, upcomingRows, now]);
  const next = useMemo(() => nextUp(contacts, upcomingRows, now), [contacts, upcomingRows, now]);
  const upcomingAll = useMemo(() => scheduleUpcoming(contacts, upcomingRows, now), [contacts, upcomingRows, now]);
  const pastAll = useMemo(() => schedulePast(contacts, sent, now), [contacts, sent, now]);
  const segInfo = RECIPIENT_SEGMENTS.find((s) => s.key === segment);
  const schedulable = isSchedulerOccasion(occasionLabel(occ));
  const occQuery = occTerm.trim().toLowerCase();
  const groups = OCCASION_GROUPS.map((g) => ({ ...g, types: g.types.filter((t) => !occQuery || occasionLabel(t).toLowerCase().includes(occQuery)) })).filter((g) => g.types.length);

  const chooseOcc = (t) => { setOcc(t); setPicked([]); };
  const togglePick = (id) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= GROUP_MAX ? cur : [...cur, id]));

  const recipientsView = (
    <div className="mgrview" data-testid="cx-recipients">
      {scopeToggle}
      {/* Founder: Individuals / Friends / Family / Professional below the primary toggle and above the search. */}
      <div className="circle"><span className="eyebrow">Your circle</span>
      <div className="chips" role="tablist" aria-label="Show recipients" data-testid="cx-segments">
        {RECIPIENT_SEGMENTS.map((s) => (
          <button key={s.key} type="button" role="tab" aria-selected={segment === s.key} data-testid={`cx-seg-${s.key}`} onClick={() => setSegment(s.key)}>
            {s.label}<span className="n">{counts[s.key]}</span>
          </button>
        ))}
      </div></div>
      <label className="search"><Search size={16} color="#8a8199" /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Find someone…" aria-label="Find someone" data-testid="cx-manager-search" /></label>
      <div className="rows" data-testid="cx-rows">
        {shown.length === 0 ? (
          <p className="empty" data-testid="cx-empty">{term ? `No one matches “${term}”.` : segment === 'individuals' ? 'No people yet. Add someone you care about.' : `No ${segInfo.label.toLowerCase()} yet — set a relationship on a recipient.`}</p>
        ) : shown.map((c) => {
          const ups = upcomingForContact(c, upcomingRows, now);
          const soon = ups.find((u) => !u.missingDate);
          const relName = titleCase(c.relationship);
          const cat = CATEGORY_LABELS[c.relationshipCategory];
          const rel = [relName, cat && cat.toLowerCase() !== relName.toLowerCase() ? cat : ''].filter(Boolean).join(' · ');
          return (
            <div className="row" key={c.id} data-testid="cx-row" data-contact={c.id}>
              <button type="button" className="person" data-testid="cx-person" onClick={() => onOpenScheduler(c, null)} aria-label={`Open ${c.name}'s occasions and Occasion Scheduler`}>
                <span className="av" style={{ background: avBg(c.name) }}>{initials(c.name)}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="pname" style={{ display: 'block' }}>{c.name}</span>
                  <span className="pmeta" style={{ display: 'block' }} data-testid="cx-meta">{rel}{soon ? ` — ${soon.label} ${inDays(soon.daysUntil)}` : ' — no upcoming occasions'}</span>
                  {soon ? <span className="pdate" style={{ display: 'block' }}>{day(soon.date)}</span> : null}
                </span>
              </button>
              <div className="racts">
                <button type="button" className="sendbtn" onClick={() => onSend(c)} aria-label={`Send a Greet-Me to ${c.name}`}><Send size={14} /> Send</button>
                <button type="button" className="iconbtn" data-testid="cx-edit" onClick={() => onOpenScheduler(c, null)} aria-label={`Edit ${c.name}`} title="Edit"><Pencil size={15} /></button>
                <button type="button" className="iconbtn del" onClick={() => onDelete(c)} aria-label="Delete recipient" title="Delete"><Trash2 size={15} /></button>
              </div>
              <div className="occchips" data-testid="cx-chips">
                {ups.map((u) => (
                  <button key={u.type} type="button" data-testid="cx-chip" data-status={u.status.key} className={`chip ${chipClass(u)}`}
                    data-note={chipNote(u)} aria-label={chipNote(u)} onClick={() => onOpenScheduler(c, u.type)}>
                    <span className="dot" />{u.label}{u.status.source === 'scheduler' ? ` · ${u.status.label}` : ''}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
        {schedulable ? <input type="checkbox" aria-label={`Choose ${c.name}`} checked={picked.includes(c.id)} disabled={!picked.includes(c.id) && picked.length >= GROUP_MAX} onChange={() => togglePick(c.id)} /> : <span />}
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

  const occasionsView = (
    <div className="mgrview" data-testid="cx-occasions">
      <label className="search" style={{ marginTop: 14 }}><Search size={16} color="#8a8199" /><input value={occTerm} onChange={(e) => setOccTerm(e.target.value)} placeholder="Find an occasion…" aria-label="Find an occasion" data-testid="cx-occasion-search" /></label>
      <div className="occgrid">
        <div className="occlist" role="tablist" aria-label="Occasions" data-testid="cx-occlist">
          {groups.length === 0 ? <p className="empty">No occasion matches “{occTerm}”.</p> : groups.map((g) => (
            <div key={g.key} role="group" aria-label={g.title}>
              <div className="ogroup">{g.title}</div>
              {g.types.map((t) => {
                const s = summaries[t];
                return (
                  <button key={t} type="button" role="tab" className="occbtn" aria-selected={occ === t} data-testid={`cx-occ-${t}`} onClick={() => chooseOcc(t)}>
                    <span className="ic" aria-hidden="true">{s.icon}</span>
                    <span className="ol">{s.label}</span>
                    <span className="cnt">{s.heldCount}</span>
                    <span className="os">
                      {s.kind === 'personal' ? 'Each person’s own date' : s.sharedDate ? `Shared date · ${day(s.sharedDate, { month: 'short', day: 'numeric' })}` : 'Shared date · entered per person'}
                      {s.soonest ? ` · next ${day(s.soonest.date, { month: 'short', day: 'numeric' })}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="roster" data-testid="cx-roster" data-kind={roster.kind}>
          <h3><span aria-hidden="true">{occasionIcon(occ)}</span>{roster.label} <span className={`kind ${roster.kind}`} data-testid="cx-kind">{roster.kind === 'personal' ? 'Each person’s own date' : 'Shared calendar date'}</span></h3>
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
        </div>
      </div>
    </div>
  );

  const schedUp = upcomingAll.filter((u) => scheduleMatches(u, schedTerm));
  const schedPast = pastAll.filter((p) => scheduleMatches(p, schedTerm));
  const scheduleCard = (
    <section className="card section" data-testid="cx-schedule">
      <div className="sechead"><span className="eyebrow">Section 2</span><h2>Celebration Schedule</h2></div>
      <div className="viewport schedvp">
        <div className="segrow-c">
          <div className="seg small" role="tablist" aria-label="When" data-testid="cx-when">
            <button type="button" role="tab" aria-selected={when === 'upcoming'} data-testid="cx-when-upcoming" onClick={() => setWhen('upcoming')}>Upcoming Occasions</button>
            <button type="button" role="tab" aria-selected={when === 'past'} data-testid="cx-when-past" onClick={() => setWhen('past')}>Past Occasions</button>
          </div>
        </div>
        <label className="search"><Search size={16} color="#8a8199" /><input value={schedTerm} onChange={(e) => setSchedTerm(e.target.value)} placeholder="Find an occasion…" aria-label="Find in the schedule" data-testid="cx-schedule-search" /></label>
        <div className="schedbody" data-testid="cx-schedule-body">
          {when === 'upcoming' ? (
            schedUp.length === 0 ? <p className="empty" data-testid="cx-schedule-empty">{schedTerm ? `Nothing upcoming matches “${schedTerm}”.` : 'No upcoming occasions saved yet.'}</p>
              : schedUp.map((u) => (
                <div className="srow" key={u.id} data-testid="cx-sched-row" data-contact={u.contact.id} data-status={u.status.key}>
                  <span className="oicon" aria-hidden="true">{u.icon}</span>
                  <div className="who">
                    <div className="pname" style={{ fontSize: 14.5 }}>{u.label}</div>
                    <div className="line">{u.contact.name} · {u.date ? `${day(u.date)} · ${inDays(u.daysUntil)}` : 'date needed'} · {giftText(u.gift)}</div>
                  </div>
                  <div className="stat">
                    <button type="button" className="iconbtn" aria-label={`Edit ${u.contact.name}'s ${u.label}`} title="Edit" onClick={() => onOpenScheduler(u.contact, u.type)}><Pencil size={15} /></button>
                    {/* A real status only; with none, the action to schedule it (never a made-up state). */}
                    {u.status.key === 'open' ? (
                      <button type="button" className="pill pill-act" data-testid="cx-sched-status" onClick={() => onOpenScheduler(u.contact, u.type)}><CalendarDays size={13} /> Schedule the love</button>
                    ) : (
                      <span className={`pill ${chipClass(u)}`} data-testid="cx-sched-status" data-note={chipNote(u)}>{u.status.label}</span>
                    )}
                  </div>
                </div>
              ))
          ) : (
            schedPast.length === 0 ? <p className="empty" data-testid="cx-schedule-empty">{schedTerm ? `No past occasion matches “${schedTerm}”.` : 'No sends recorded yet.'}</p>
              : schedPast.map((p) => (
                <div className="srow" key={p.id} data-testid="cx-past-row" data-status={p.status.key} data-contact={p.contact ? p.contact.id : ''}>
                  <span className="oicon" aria-hidden="true">{p.icon}</span>
                  <div className="who">
                    <div className="pname" style={{ fontSize: 14.5 }}>{p.label}</div>
                    <div className="line">{p.contact ? p.contact.name : p.name} · {day(p.when, { month: 'short', day: 'numeric', year: 'numeric' })} · passed{p.kind === 'passed' ? ' · no Greet-Me send is recorded for it' : ''}</div>
                  </div>
                  <div className="stat"><span className={`pill ${pastClass(p)}`} data-testid="cx-past-status">{p.status.label}</span></div>
                </div>
              ))
          )}
        </div>
      </div>
    </section>
  );

  return (
    <div className="cx" data-testid="cx-root">
      <style>{CELEBRATIONS_CSS}</style>
      {next ? <p className="nextup" data-testid="cx-nextup">Next up: <b>{next.label} for {next.contact.name}</b> — {day(next.date)}</p> : null}
      <div className="titlerow pagetitle" data-testid="cx-head"><h1>My Celebrations</h1><span className="script">Forget Them Not!™</span></div>
      <section className="card section" data-testid="cx-manager">
        <div className="sechead"><span className="eyebrow">Section 1</span><h2>Celebration Manager</h2></div>
        <div className="viewport mgrvp">
          <div className="vtop">
            <div className="seg" role="tablist" aria-label="Recipients or occasions" data-testid="cx-path">
              <button type="button" role="tab" aria-selected={path === 'recipients'} data-testid="cx-path-recipients" onClick={() => setPath('recipients')}>Recipients</button>
              <button type="button" role="tab" aria-selected={path === 'occasions'} data-testid="cx-path-occasions" onClick={() => setPath('occasions')}>Occasions</button>
            </div>
            <div className="hacts">
              <button type="button" className="btn btn-out btn-sm" onClick={onImport}><Upload size={15} /> Import Wizard</button>
              <button type="button" className="btn btn-pri btn-sm" data-testid="add-recipient" onClick={onAddRecipient}><Plus size={15} /> Add Recipient</button>
            </div>
          </div>
          {/* Both views stay mounted (each keeps its filter, search and scroll); only the selected one is shown. */}
          <div className="mgrbody" data-testid="cx-manager-body">
            <div hidden={path !== 'recipients'} style={{ height: '100%' }}>{recipientsView}</div>
            <div hidden={path !== 'occasions'} style={{ height: '100%' }}>{occasionsView}</div>
          </div>
        </div>
      </section>
      <GiftStrip onAddGift={onAddGift} />
      {scheduleCard}
      <div className="moment" data-testid="cx-moment">
        <span><b>Send a separate gift</b> — a standalone purchase from the Greet-Me Gift Place.</span>
        <button type="button" className="linkbtn" data-testid="cx-moment-add-gift" onClick={onAddGift}>Visit the Gift Place</button>
      </div>
    </div>
  );
}

// "The Greet-Me Gift Place" strip between the sections (founder render 2026-10-22): the dashboard's gift slides, slim,
// with the one gold Add a gift in the same place on every slide (no separate Add QR Cash).
const STRIP = [
  { key: 'box', src: giftLuxuryBox, title: 'Luxury gift box', line: 'Something to unwrap, delivered to their door.' },
  { key: 'flowers', src: giftBouquet, title: 'Flower bouquet', line: 'Fresh flowers for the day itself.' },
  { key: 'card', src: giftCard, title: 'Greet-Me gift card', line: 'A gift card tucked inside the greeting.' },
  { key: 'stack', src: giftBoxStack, title: 'Stack of wrapped gifts', line: 'Browse every gift in the Gift Place.' },
  { key: 'qrcash', src: null, title: 'QR Cash™', line: 'Send cash they can spend the moment it lands. Choose it in your greeting’s gift options.' },
];
function GiftStrip({ onAddGift }) {
  const [i, setI] = useState(0);
  const paused = useRef(false);
  useEffect(() => { const id = setInterval(() => { if (!paused.current) setI((x) => (x + 1) % STRIP.length); }, 4500); return () => clearInterval(id); }, []);
  const s = STRIP[i];
  const step = (d) => setI((x) => (x + d + STRIP.length) % STRIP.length);
  return (
    <section className="giftstrip" data-testid="cx-giftstrip" onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}>
      <span className="gart" aria-hidden="true">{s.src ? <img src={s.src} alt="" /> : <span className="gqr">QR Cash™</span>}</span>
      <div className="gtext" aria-live="polite">
        <span className="eyebrow gold">The Greet-Me Gift Place</span>
        <b>{s.title}</b>
        <span className="gline">{s.line}</span>
      </div>
      <div className="gnav" role="group" aria-label="Gift slides">
        <button type="button" className="garrow" aria-label="Previous gift" onClick={() => step(-1)}><ChevronLeft size={15} /></button>
        {STRIP.map((x, k) => <button key={x.key} type="button" className="gdot" aria-label={x.title} aria-current={k === i} onClick={() => setI(k)} />)}
        <button type="button" className="garrow" aria-label="Next gift" onClick={() => step(1)}><ChevronRight size={15} /></button>
      </div>
      <button type="button" className="btn btn-gold btn-sm" data-testid="cx-add-gift" onClick={onAddGift}><Gift size={15} /> Add a gift</button>
    </section>
  );
}
