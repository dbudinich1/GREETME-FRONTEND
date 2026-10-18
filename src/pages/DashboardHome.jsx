// src/pages/DashboardHome.jsx
//
// Personal dashboard on the Base44 direction (founder-approved rendering and revisions, Report 103, 2026-10-18).
// The page PREPARES; it never sends, schedules, charges or grants anything on its own:
//   * Send Now hands one recipient + one occasion (with optional words and memory photos) to the existing send
//     flow (/dashboard/send), which keeps its own review, consent, payment and sending rules;
//   * one recipient with several occasions (or Schedule the Love) is saved through that recipient's EXISTING
//     Occasion Scheduler record — one scheduled Greet-Me per occasion, never a combined card — with the scheduler's
//     own normalisation and authorisation step (utils/occasionResolver.js);
//   * several recipients share one occasion; sending to them is the separate group-sending package, so Continue
//     stays unavailable for a group in this build (deployment is held until that package ships).
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Send, UserPlus, QrCode, ChevronRight, ChevronLeft, Search, Smartphone, Check, CalendarDays, Gift, Zap, Upload,
  AlertCircle, Plus, ChevronDown, X, Mic, Camera, Play, Pause, ImagePlus, Users, Award, RotateCcw, Pencil, DollarSign,
  CreditCard,
} from 'lucide-react';
import api from '../api/api';
import { getOccasionIcon, occasionTypes } from '../utils/helpers';
import BusinessGiftCreditsPanel from '../components/BusinessGiftCreditsPanel';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorMessages';
import { safeGet } from '../utils/safeStorage';
import OnboardingCoach from '../components/OnboardingCoach';
import WarmReentryWelcome from '../components/WarmReentryWelcome';
import { useAccountState } from '../hooks/useAccountState';
import { shouldShowOnboarding, shouldShowWarmReentry } from '../utils/accountState';
import { getHoverHandlers } from '../utils/hoverable';
import { showManualToast } from '../utils/notify';
import { COMMS_CATEGORIES } from '../utils/commsCatalog';
import { openSetupRevisit } from '../components/setupRevisit';
import { requiresDeliveryAddress } from '../components/ContactForm';
import { sanitizeRelationshipForSave } from '../components/contactFormValidation.js';
import SaveAuthorizationModal from '../components/w07Auth/SaveAuthorizationModal';
import { planAuthorization } from '../utils/scheduledQrCashConsent';
import { SCHEDULED_QRCASH_AVAILABLE } from '../config/scheduledQrCash';
import { normalizeGiftSettingsForSave } from '../utils/occasionGiftSave';
import {
  isSchedulerOccasion, prefillRow, chooseGift, rowComplete, buildResolverContact, finalizeResolverSave,
  RESOLVER_GIFT_OPTIONS, resolverGiftLine,
} from '../utils/occasionResolver';
import { writeDashboardHandoff, HANDOFF_MAX_WORDS, HANDOFF_MAX_PHOTOS } from '../utils/dashboardSendHandoff';
import { DASHBOARD_HOME_CSS } from './dashboardHomeStyles';
import giftLuxuryBox from '../assets/gifts/gift-luxury-box.png';
import giftBouquet from '../assets/gifts/gift-bouquet.png';
import giftCard from '../assets/gifts/gift-card.png';
import giftBoxStack from '../assets/gifts/gift-box-stack.png';
import smartEGiftCardArt from '../assets/gifts/smart-egift-card.png';

// Status labels for the Upcoming Occasions tab — mirrors the scheduleStatus values returned by
// GET /api/dashboard/upcoming. A row with NO schedule yet shows "Auto-send on" or the "Schedule the Love" action
// instead of a status; the null entry remains the fallback for a status this client has never seen.
const OCCASION_STATUS_LABELS = {
  null: { text: 'Preparing', color: '#7F8C8D', bg: '#F4F6F7', tone: 'muted' },
  scheduled: { text: 'Ready to send', color: '#2E86C1', bg: '#D6EAF8', tone: 'plum' },
  queued: { text: 'Creating', color: '#E67E22', bg: '#FDEBD0', tone: 'amber' },
  delivered: { text: 'Sent', color: '#27AE60', bg: '#D5F5E3', tone: 'ok' },
  skipped: { text: 'Not sent', color: '#64748b', bg: '#f1f5f9', tone: 'muted' },
  failed: { text: 'Not sent', color: '#64748b', bg: '#f1f5f9', tone: 'muted' },
  cancelled: { text: 'Cancelled', color: '#64748b', bg: '#f1f5f9', tone: 'muted' },
  paused: { text: 'Paused', color: '#64748b', bg: '#f1f5f9', tone: 'muted' },
  skipped_transient: { text: 'Not sent', color: '#64748b', bg: '#f1f5f9', tone: 'muted' },
  skipped_permanent: { text: 'Not sent', color: '#64748b', bg: '#f1f5f9', tone: 'muted' },
  skipped_terminal: { text: 'Not sent', color: '#64748b', bg: '#f1f5f9', tone: 'muted' },
};
// Past Occasions: the backend's greeting statuses. "completed" is set once the recipient email is sent, so it reads
// "Sent" — not "Delivered", which nothing in the system confirms.
const PAST_STATUS = { completed: ['Sent', 'ok'], pending: ['Creating', 'amber'], processing: ['Creating', 'amber'], failed: ['Not sent', 'muted'], cancelled: ['Cancelled', 'muted'] };
const UPCOMING_DAYS = 60;

// Gift carousel (moved here from the Recipients page): its four images in the same order, then the Gift Place's
// Smart Card art, then QR Cash (no artwork exists; drawn typographically).
const SLIDES = [
  { key: 'box', src: giftLuxuryBox, title: 'Luxury gift box', line: 'Something to unwrap, delivered to their door.' },
  { key: 'flowers', src: giftBouquet, title: 'Flower bouquet', line: 'Fresh flowers for the day itself.' },
  { key: 'card', src: giftCard, title: 'Greet-Me gift card', line: 'A gift card tucked inside the greeting.' },
  { key: 'stack', src: giftBoxStack, title: 'Stack of wrapped gifts', line: 'Browse every gift in the Gift Place.' },
  { key: 'smartcard', src: smartEGiftCardArt, title: 'Greet-Me Smart eGift Card', line: 'One card, spent at the brands they love (Prezzee).' },
  { key: 'qrcash', src: null, title: 'QR Cash™', line: 'Send • Claim • Spend' },
];
const SMARTCARD_UNAVAILABLE_LINE = 'Coming later — not yet available';

// Occasions (founder 2026-10-18): the send flow's five plus Baby and Wedding, and a Season's Greetings menu.
// Engagement, Sympathy and Hanukkah are held until their protected content is ruled on (GREETING_RULES untouched).
const OCCASIONS = ['Birthday', 'Anniversary', 'Thank You', 'Congratulations', 'Just Because', 'Baby', 'Wedding'];
const SEASON = ['Christmas', "Season's Greetings"];
// Base44 "Send to" segments mapped onto the recipient's existing relationshipCategory (family | friend | professional).
const AUDIENCES = [
  { key: 'one', segment: 'Individuals', label: 'People you choose' },
  { key: 'friend', segment: 'Friends', label: 'All friends', people: 'friends' },
  { key: 'family', segment: 'Family', label: 'All family', people: 'family members' },
  { key: 'professional', segment: 'Professional', label: 'All professional contacts', people: 'professional contacts' },
  { key: 'all', segment: 'Everyone', label: 'Everyone in your circle', people: 'people' },
];
const SENDER_PHOTO_REQUIRED_MESSAGE = 'Every Greet-Me includes your photo so the recipient knows it is from you. Add a profile photo to send — your greeting stays saved while you do.';
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// Occasion keys the backend stores for sends (occasionKey) shown with the send flow's own labels.
const OCC_KEY_LABELS = { thankyou: 'Thank You', thank_you: 'Thank You', congrats: 'Congratulations', just_because: 'Just Because', holiday: "Season's Greetings", baby: 'Baby', general: 'Thinking of You' };
const OCC_LABEL = (t) => OCC_KEY_LABELS[t] || (t || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace('Mothers Day', "Mother's Day").replace('Fathers Day', "Father's Day").replace('Getwell', 'Get Well');
function initials(name) { return (name || '?').split(/\s+/).filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || '?'; }
const AVATAR = ['#5A3E8A', '#7C63AE', '#4A3273', '#8A5A2B', '#3E5A7C', '#6B3E6B'];
function avatarBg(name) { let h = 0; for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR[h % AVATAR.length]; }
const first = (n) => (n || '').split(' ')[0];
const labelForType = (type) => (occasionTypes.find((o) => o.value === type) || {}).label;
const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader(); r.onloadend = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
});

function GiftCarousel({ chosen, onAdd, onQuickGift, onLearnQr, smartCardAvailable }) {
  const [i, setI] = useState(0);
  const paused = useRef(false);
  useEffect(() => {
    const id = setInterval(() => { if (!paused.current) setI((x) => (x + 1) % SLIDES.length); }, 4500);
    return () => clearInterval(id);
  }, []);
  const s = SLIDES[i];
  const smartCardOff = s.key === 'smartcard' && !smartCardAvailable;
  const step = (d) => setI((x) => (x + d + SLIDES.length) % SLIDES.length);
  return (
    <div className="carousel" data-testid="gx-carousel" onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }} onFocus={() => { paused.current = true; }} onBlur={() => { paused.current = false; }}>
      <div className="art" aria-hidden="true">
        {SLIDES.map((x, k) => (x.src
          ? <img key={x.key} src={x.src} alt="" loading="lazy" decoding="async" draggable="false" style={{ opacity: k === i ? 1 : 0 }} />
          : <div key={x.key} className="qr" style={{ opacity: k === i ? 1 : 0 }}><QrCode size={46} strokeWidth={1.6} /><span>QR Cash™</span></div>))}
      </div>
      <div style={{ minWidth: 0 }} aria-live="polite">
        <div className="slide-t">{s.title}</div>
        <p className="slide-l">{smartCardOff ? SMARTCARD_UNAVAILABLE_LINE : s.line}</p>
        <div className="dots" role="group" aria-label="Gift slides">
          <button type="button" className="arrow" aria-label="Previous gift" onClick={() => step(-1)}><ChevronLeft size={16} /></button>
          {SLIDES.map((x, k) => <button key={x.key} type="button" className="dot" aria-label={x.title} aria-current={k === i} onClick={() => setI(k)} />)}
          <button type="button" className="arrow" aria-label="Next gift" onClick={() => step(1)}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="cta-col">
        {s.key === 'qrcash' ? (
          <button type="button" className="btn btn-sm btn-primary" style={{ height: 40 }} data-testid="gx-add-qr" aria-pressed={chosen === 'qrcash'} onClick={() => onAdd('qrcash')}>
            {chosen === 'qrcash' ? <><Check size={16} /> QR Cash added</> : <><Gift size={16} /> Add QR Cash</>}
          </button>
        ) : (
          <button type="button" className="btn btn-sm btn-primary" style={{ height: 40, visibility: smartCardOff ? 'hidden' : 'visible' }} tabIndex={smartCardOff ? -1 : 0} data-testid="gx-add-gift" aria-pressed={chosen === 'gift'} onClick={() => onAdd('gift')}>
            {chosen === 'gift' ? <><Check size={16} /> Gift added</> : <><Gift size={16} /> Add a gift</>}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-gold" style={{ height: 40 }} data-testid="gx-quick-banner" onClick={onQuickGift}>Quick Gift <ChevronRight size={15} /></button>
        <button type="button" className="link" style={{ visibility: s.key === 'qrcash' ? 'visible' : 'hidden' }} onClick={onLearnQr} tabIndex={s.key === 'qrcash' ? 0 : -1}>How it works</button>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Phase 3D Batch D Slice 5 — account-state gate for the dashboard onboarding nudge.
  const accountState = useAccountState();

  // F5: real install QR for the home-screen install panel
  const [appQrUrl, setAppQrUrl] = useState(null);
  useEffect(() => {
    QRCode.toDataURL('https://greet-me.com/#/app', {
      width: 200, margin: 1,
      color: { dark: '#667eea', light: '#ffffff' },
    }).then(setAppQrUrl).catch(() => {});
  }, []);

  const [contacts, setContacts] = useState([]);
  // Warm re-entry race mitigation: the contacts fetch is async, so the initial [] is ambiguous with a
  // settled-empty result. The warm-reentry gate is gated on contactsLoaded so it does not flash before it resolves.
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [upcomingOccasions, setUpcomingOccasions] = useState([]);
  const [sentGreetings, setSentGreetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [smartCardAvailable, setSmartCardAvailable] = useState(false);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth <= 768);
  const [term, setTerm] = useState('');
  const [tab, setTab] = useState('recipients');

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize); };
  }, []);

  const fetchDashboardData = async () => {
    try {
      try {
        const contactsRes = await api.getContacts();
        if (contactsRes?.ok !== false) {
          setContacts(contactsRes.data || []);
        } else {
          // If API fails, try localStorage (same as Recipients page)
          const stored = safeGet('greetme_recipients');
          if (stored) setContacts(JSON.parse(stored));
        }
      } catch {
        const stored = safeGet('greetme_recipients');
        if (stored) { try { setContacts(JSON.parse(stored)); } catch { /* unreadable local copy */ } }
      } finally {
        setContactsLoaded(true);
      }

      try {
        const upcomingRes = await api.getUpcomingOccasions(UPCOMING_DAYS);
        if (upcomingRes?.ok !== false) setUpcomingOccasions(upcomingRes.data || []);
      } catch { /* card shows its empty state */ }

      // History comes from the server's sent-greetings list (createdAt / completedAt; the API sends no sentAt).
      try {
        const sentRes = await api.getSentGreetings();
        if (Array.isArray(sentRes?.greetings)) setSentGreetings(sentRes.greetings);
      } catch { /* card shows its empty state */ }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // The Smart Card slide offers its action only when the server reports published cards — the same read the
    // Gift Place makes (fail-closed: any error or a dormant answer keeps "Coming later").
    (async () => {
      try {
        const res = await api.getSmartCardTiles();
        setSmartCardAvailable(res?.ok === true && Array.isArray(res.tiles) && res.tiles.length > 0);
      } catch { setSmartCardAvailable(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Launcher state: local to this page, never saved. The send flow and the Occasion Scheduler own the real data.
  const [mode, setMode] = useState(null);
  const [occasions, setOccasions] = useState([]);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [audience, setAudience] = useState('one');
  const [picks, setPicks] = useState([]);
  const [excluded, setExcluded] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [find, setFind] = useState('');
  const [words, setWords] = useState('');
  const [memoryPhotos, setMemoryPhotos] = useState([]);
  const [photoNote, setPhotoNote] = useState('');
  const [gift, setGift] = useState(null);
  const [whoDone, setWhoDone] = useState(false);
  const [persDone, setPersDone] = useState(false);
  const [ruleNote, setRuleNote] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [authModal, setAuthModal] = useState(null);
  const [authForm, setAuthForm] = useState(null);
  const memoryInputRef = useRef(null);

  // Saved voice playback (same sources the Media Library uses: the local copy, else the profile's voiceUrl).
  const voiceSrc = safeGet('greetme_voice_file') || user?.voiceUrl || null;
  const audioRef = useRef(null);
  const [playingVoice, setPlayingVoice] = useState(false);
  const togglePlay = () => {
    if (!voiceSrc) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(voiceSrc);
      audioRef.current.onended = () => setPlayingVoice(false);
    }
    if (playingVoice) { audioRef.current.pause(); setPlayingVoice(false); }
    else { audioRef.current.play().then(() => setPlayingVoice(true)).catch(() => setPlayingVoice(false)); }
  };
  useEffect(() => () => { if (audioRef.current) audioRef.current.pause(); }, []);

  const voiceDone = Boolean(user?.voiceId || user?.voiceUrl);
  const photoDone = Boolean(user?.photoUrl);
  const firstName = first(user?.name);
  const goAddRecipient = () => navigate('/dashboard/contacts', { state: { openAddRecipient: true } });
  const goEdit = (id) => navigate('/dashboard/contacts', { state: { openEditRecipientId: id } });
  const goScheduler = (contactId, occasionType) => navigate(`/dashboard/contacts?contactId=${encodeURIComponent(contactId)}&occasion=${encodeURIComponent(occasionType)}`);
  const quickGift = () => navigate('/dashboard/gifts');
  const filtered = useMemo(() => contacts.filter((c) => (c.name || '').toLowerCase().includes(term.toLowerCase()) || (c.relationship || '').toLowerCase().includes(term.toLowerCase())), [contacts, term]);

  // Selection only changes styling and completion marks: nothing collapses, scrolls, navigates or resizes.
  // Settled rules: one person may get several occasions; several people share ONE occasion; several occasions for
  // one person are scheduled through their Occasion Scheduler, so they must all be scheduler occasions. A pick that
  // would break a rule is refused with a visible reason; nothing already chosen is dropped.
  const groupMembers = audience === 'one' ? [] : contacts.filter((c) => audience === 'all' || c.relationshipCategory === audience);
  const chosen = audience === 'one' ? contacts.filter((c) => picks.includes(c.id)) : groupMembers.filter((c) => !excluded.includes(c.id));
  const toggleOcc = (o) => {
    if (!occasions.includes(o) && occasions.length >= 1) {
      if (chosen.length > 1) { setRuleNote('occ'); return; }
      if (!isSchedulerOccasion(o) || occasions.some((x) => !isSchedulerOccasion(x))) { setRuleNote(`sched:${isSchedulerOccasion(o) ? occasions.find((x) => !isSchedulerOccasion(x)) : o}`); return; }
    }
    setRuleNote(''); setSaveMsg(null); setOccasions((cur) => (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]));
  };
  const togglePick = (id) => {
    if (!picks.includes(id) && occasions.length > 1 && chosen.length >= 1) { setRuleNote('who'); return; }
    setRuleNote(''); setSaveMsg(null); setPicks((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  const pickFromHero = (c) => {
    if (audience !== 'one') { if (occasions.length > 1) { setRuleNote('who'); return; } }
    else if (!picks.includes(c.id) && occasions.length > 1 && picks.length >= 1) { setRuleNote('who'); return; }
    setRuleNote(''); setSaveMsg(null); setAudience('one'); setPicks((cur) => (cur.includes(c.id) ? cur : [...cur, c.id]));
  };
  const chooseAudience = (k) => {
    if (k !== 'one' && occasions.length > 1) { setRuleNote('group'); return; }
    setRuleNote(''); setSaveMsg(null); setAudience(k); setExcluded([]); setPickerOpen(false);
  };
  const aud = AUDIENCES.find((x) => x.key === audience);
  const seasonSel = occasions.filter((o) => SEASON.includes(o));
  const occLocked = chosen.length > 1 && occasions.length >= 1;   // several people: no further occasions
  const whoLocked = occasions.length > 1;                          // several occasions: one person only
  const notSchedulable = mode === 'occasion' && occasions.find((o) => !isSchedulerOccasion(o));
  const ruleText = ruleNote === 'occ' ? 'You’re sending to several people, so they share one occasion. Remove people to add more occasions.'
    : ruleNote === 'who' || ruleNote === 'group' ? 'Several occasions go to one person. To send to several people, keep just one occasion.'
      : ruleNote.startsWith('sched:') ? `${ruleNote.slice(6)} is sent on its own with Send Now. Several occasions for one person are scheduled in their Occasion Scheduler: Birthday, Anniversary and Christmas.`
        : notSchedulable ? `${notSchedulable} can’t be scheduled in the Occasion Scheduler. Choose Send Now, or Birthday, Anniversary or Christmas.`
          : occLocked ? 'Several people share one occasion.'
            : whoLocked ? 'Several occasions go to one person, each scheduled on its own date.'
              : 'One person: choose one or more occasions. Several people: one shared occasion.';
  const step1Done = Boolean(mode) && occasions.length > 0;
  const step2Done = chosen.length > 0 && whoDone;

  // ── Inline date-and-gift resolver (one recipient): several occasions, or Schedule the Love for one scheduler occasion.
  const resolverOn = chosen.length === 1 && occasions.length >= 1 && occasions.every(isSchedulerOccasion)
    && (occasions.length > 1 || mode === 'occasion');
  const resolvePerson = resolverOn ? chosen[0] : null;
  useEffect(() => {
    if (!resolvePerson) return;
    setRows((cur) => {
      const next = { ...cur };
      occasions.forEach((o) => { const k = `${resolvePerson.id}:${o}`; if (!next[k]) next[k] = prefillRow(resolvePerson, o); });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvePerson && resolvePerson.id, occasions.join('|')]);
  const rowOf = (o) => (resolvePerson && rows[`${resolvePerson.id}:${o}`]) || null;
  const setRow = (o, patch) => { setSaveMsg(null); setRows((cur) => ({ ...cur, [`${resolvePerson.id}:${o}`]: { ...cur[`${resolvePerson.id}:${o}`], ...patch } })); };
  const resolverComplete = !resolverOn || occasions.every((o) => rowComplete(rowOf(o)));

  const commitSchedules = async (person, toSave, consents = []) => {
    const res = await api.updateContact(person.id, finalizeResolverSave(toSave, consents));
    if (res && res.ok === false) {
      throw new Error(res.networkError ? 'We couldn’t save — check your connection and try again.' : (res.error || res.message || 'We couldn’t save those schedules. Please try again.'));
    }
    const n = occasions.length;
    setSaveMsg({ ok: true, text: `Saved: ${n} scheduled Greet-Me${n === 1 ? '' : 's'} for ${first(person.name)}, each on its own date. You’ll find ${n === 1 ? 'it' : 'them'} in their Occasion Scheduler and under Upcoming Occasions.` });
    showManualToast('Saved ✓', 'Recipient settings have been saved.', COMMS_CATEGORIES.PROFILE);
    fetchDashboardData();
  };

  const saveSchedules = async () => {
    if (!resolvePerson || !resolverComplete || saving) return;
    setSaving(true); setSaveMsg(null);
    try {
      const person = resolvePerson;
      const toSave = sanitizeRelationshipForSave(buildResolverContact(person, occasions.map((o) => rowOf(o))));
      const settings = normalizeGiftSettingsForSave(toSave.occasionGiftSettings);
      if (SCHEDULED_QRCASH_AVAILABLE) {
        // The scheduler's own SAVE-time authorisation: consent for a new or changed QR Cash Auto-Gift, a card when
        // none usable is on file, the mailing address of a shipped gift. Nothing is requested when none applies.
        let card = null;
        if (Object.values(settings || {}).some((g) => g && g.type === 'qrcash' && g.autoGift === true)) {
          try { const res = await api.getQrCashCardStatus(); card = (res && res.card) || null; }
          catch { setSaveMsg({ ok: false, text: 'We couldn’t check the card on file just now. Please try again.' }); return; }
        }
        const plan = planAuthorization({
          settings, initialSettings: person.occasionGiftSettings, occasions: toSave.occasions, card, formData: toSave,
          labelFor: labelForType, requiresDelivery: requiresDeliveryAddress,
        });
        if (plan.need.consent || plan.need.address) { setAuthForm(toSave); setAuthModal({ plan, card, person }); return; }
      }
      await commitSchedules(person, toSave);
    } catch (error) {
      setSaveMsg({ ok: false, text: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!pickerOpen && !seasonOpen) return undefined;
    const close = (e) => { if (!e.target.closest('.picker, .addsome, .menu, .relpop')) { setPickerOpen(false); setSeasonOpen(false); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pickerOpen, seasonOpen]);

  const addMemoryPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const room = HANDOFF_MAX_PHOTOS - memoryPhotos.length;
    const usable = files.filter((f) => /^image\//.test(f.type) && f.size <= MAX_PHOTO_BYTES).slice(0, Math.max(0, room));
    const skipped = files.length - usable.length;
    const urls = [];
    for (const f of usable) { try { urls.push(await readAsDataUrl(f)); } catch { /* unreadable file skipped */ } }
    setMemoryPhotos((cur) => [...cur, ...urls].slice(0, HANDOFF_MAX_PHOTOS));
    setPhotoNote(skipped > 0 ? `Up to ${HANDOFF_MAX_PHOTOS} images, 10MB each — ${skipped} not added.` : '');
  };

  const isGroup = chosen.length > 1;
  const sendNowSingle = mode === 'now' && chosen.length === 1 && occasions.length === 1;
  const canContinue = step1Done && step2Done && !isGroup && !notSchedulable && (resolverOn ? resolverComplete && !saving : sendNowSingle);

  const handoff = () => {
    if (!canContinue) return;
    if (resolverOn) { saveSchedules(); return; }
    const person = chosen[0];
    const occasion = occasions[0];
    const carried = writeDashboardHandoff(window.sessionStorage, { contactId: person.id, occasion, words, memoryPhotos });
    if (carried === 'words') showManualToast('Photos not carried over', 'Your memory photos were too large to carry to the next step on this device. You can add them there.', COMMS_CATEGORIES.SYSTEM);
    else if (carried === 'none' && (words.trim() || memoryPhotos.length)) showManualToast('Not carried over', 'Your words and photos couldn’t be carried to the next step on this device. You can add them there.', COMMS_CATEGORIES.SYSTEM);
    const p = new URLSearchParams({ contactId: person.id, occasion, from: 'dashboard' });
    if (gift === 'qrcash') p.set('giftType', 'qrcash');
    else if (gift === 'gift') p.set('gift', 'choose');
    navigate(`/dashboard/send?${p.toString()}`);
  };

  const occLabel = occasions.length === 0 ? 'no occasion yet' : occasions.length <= 2 ? occasions.join(' + ') : `${occasions.length} occasions`;
  const whoLabel = chosen.length === 0 ? 'no one yet' : chosen.length === 1 ? first(chosen[0].name) : `${chosen.length} people`;
  const summary = !mode ? 'Choose Send Now or Schedule the Love'
    : [mode === 'now' ? 'Send Now' : 'Schedule the Love', occLabel, whoLabel, gift && !resolverOn ? `${gift === 'qrcash' ? 'QR Cash' : 'gift'}${chosen.length > 1 ? ' for everyone · change per person at review' : ''}` : null].filter(Boolean).join(' · ');
  const fineText = saveMsg ? saveMsg.text
    : giftNote && resolverOn ? giftNote
    : isGroup ? 'Sending to several people arrives with group sending.'
      : resolverOn ? (resolverComplete ? 'Each occasion is saved as its own scheduled Greet-Me in their Occasion Scheduler.' : 'Set a date and a gift choice for every occasion to continue.')
        : mode === 'occasion' ? 'Nothing is scheduled until you save it.'
          : 'Next: the send flow, where you review it. Nothing is sent, and no gift is charged, until you confirm there.';

  const StepHead = ({ n, label, isDone }) => (
    <div className="step-label"><span className={`num ${isDone ? 'done' : ''}`}>{isDone ? <Check size={13} /> : n}</span>{label}</div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Subscription lifecycle banner — calm neutral style, text-only differentiation
  const SUB_BANNER_TEXT = {
    past_due: 'Your payment method needs updating. Please update your billing details in Settings to avoid service interruption.',
    canceled: 'Your subscription has ended. You can resubscribe anytime from Settings.',
    refunded: 'Your recent payment was refunded. If you have questions, please contact support.',
  };
  const bannerText = SUB_BANNER_TEXT[user?.subscriptionStatus];
  const pastItems = sentGreetings.map(g => ({ ...g, type: 'greeting' }));

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {bannerText && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.875rem 1.25rem', marginBottom: '1rem', color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>
          {bannerText}
        </div>
      )}
      <div className="gx" data-testid="gx-root">
        <style>{DASHBOARD_HOME_CSS}</style>

        {/* 1. Welcome panel */}
        <section className="hero" data-testid="gx-hero">
          <div className="glow1" /><div className="glow2" />
          <div className="hero-top">
            <div className="scriptrow">
              <p className="script">Forget Them Not!™</p>
              <button type="button" className="heroicon" data-testid="gx-hero-icon" aria-label="Greet-Me Hero" onClick={() => navigate('/dashboard/hero')}><Award size={17} /><span className="tip" aria-hidden="true">Greet-Me Hero</span></button>
            </div>
            <div className="acts" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-sm btn-ghost-w" data-testid="gx-add-recipient" onClick={goAddRecipient}><UserPlus size={16} /> Add Recipient</button>
              <button type="button" className="btn btn-sm btn-ghost-w" onClick={() => navigate('/dashboard/import-wizard')}><Upload size={16} /> Import Wizard</button>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <h1>{firstName ? `${firstName}, who would you like to celebrate today?` : 'Who would you like to celebrate today?'}<button type="button" className="quick" data-testid="gx-quick-hero" onClick={quickGift}><Gift size={15} /> Quick Gift <ChevronRight size={14} /></button></h1>
            <p className="lede">Send a personalized Greet-Me now, or set one to arrive on their occasion. Tap a face to begin.</p>
            {contacts.length > 0 ? (
              <>
                <p className="people-label">Your people</p>
                <div className="people">
                  {contacts.slice(0, 6).map((c) => (
                    <button key={c.id} type="button" className="pick" aria-pressed={audience === 'one' && picks.includes(c.id)} onClick={() => pickFromHero(c)}>
                      <span className="av">{initials(c.name)}</span>
                      <span><b>{c.name}</b><small>{c.relationship || 'Someone you love'}</small></span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </section>

        {/* Onboarding Coach (dashboard nudge for incomplete setup) — mount only when account state allows. */}
        {shouldShowOnboarding(accountState) && (
          <OnboardingCoach voiceDone={voiceDone} photoDone={photoDone} recipientDone={contacts.length > 0} />
        )}
        {/* Warm "already personalized" re-entry — mutually exclusive with OnboardingCoach by gate construction. */}
        {shouldShowWarmReentry(accountState, contactsLoaded ? contacts.length : null) && (
          <WarmReentryWelcome isNarrow={isNarrow} />
        )}
        {/* Business-only: annual G1G1 gift-credit panel (renders nothing for personal tiers) */}
        <BusinessGiftCreditsPanel isNarrow={isNarrow} />

        {/* 2. Greeting flow — a persistent screen */}
        <section className="card flow" id="gx-flow" data-testid="gx-flow" style={{ scrollMarginTop: 90 }}>
          <div className="flow-head">
            <div><span className="eyebrow">Send a Greet-Me</span><h2>Greet-Me, right now, or right on time?</h2></div>
            <p>You review everything, and pay for any gift, before anything is sent.</p>
          </div>

          <div className="modes top" data-testid="gx-modes">
            <button type="button" className="mode" aria-pressed={mode === 'now'} onClick={() => { setSaveMsg(null); setMode('now'); }}>
              <span className="ico"><Zap size={20} /></span>
              <span><span className="k">One-timer</span><span className="t">Send Now</span><span className="b">Create it now. You review it before it goes.</span></span>
            </button>
            <button type="button" className="mode" aria-pressed={mode === 'occasion'} onClick={() => { setSaveMsg(null); setMode('occasion'); }}>
              <span className="ico"><CalendarDays size={20} /></span>
              <span><span className="k">On their day</span><span className="t">Schedule the Love</span><span className="b">Set a date in their Occasion Scheduler; yearly occasions repeat.</span></span>
            </button>
          </div>

          <div className="step" data-testid="gx-step-1" style={{ marginTop: 6 }}>
            <StepHead n={1} label="Choose your moment: what are we celebrating?" isDone={step1Done} />
            <div className="chips" data-testid="gx-occasion">
              {OCCASIONS.map((o) => <button key={o} type="button" className={`chip-btn occ ${occLocked && !occasions.includes(o) ? 'locked' : ''}`} aria-pressed={occasions.includes(o)} aria-disabled={occLocked && !occasions.includes(o)} onClick={() => toggleOcc(o)}>{o}</button>)}
              <span className="relpop">
                <button type="button" className="chip-btn occ" data-testid="gx-season" aria-pressed={seasonSel.length > 0} aria-haspopup="menu" aria-expanded={seasonOpen} onClick={() => setSeasonOpen((v) => !v)}>
                  Season&rsquo;s Greetings<ChevronDown size={15} />
                </button>
                {seasonOpen ? (
                  <span className="menu" role="menu">
                    {SEASON.map((o) => (
                      <button key={o} type="button" role="menuitemcheckbox" aria-checked={occasions.includes(o)} aria-disabled={occLocked && !occasions.includes(o)} className={occLocked && !occasions.includes(o) ? 'locked' : ''} onClick={() => toggleOcc(o)}>
                        <span className={`box ${occasions.includes(o) ? 'on' : ''}`}><Check size={12} /></span>{o}
                      </button>
                    ))}
                  </span>
                ) : null}
              </span>
            </div>
            <p className={`rule ${ruleNote || notSchedulable ? 'warn2' : ''}`} data-testid="gx-rule" role="status" aria-live="polite">{ruleText}</p>
          </div>

          <div className="step" data-testid="gx-step-2">
            <StepHead n={2} label="Who is it for?" isDone={step2Done} />
            <div className="whobox" data-testid="gx-whobox">
              {contacts.length === 0 ? (
                <div className="empty" data-testid="gx-recipients-empty" style={{ margin: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div className="ico"><UserPlus size={20} /></div>
                  <div className="t">No recipients yet</div>
                  <p>Add your first recipient to schedule personalized Greet-Me greetings for each occasion where you turn on Enable Auto-Gift. You can also send a Greet-Me anytime.</p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-sm btn-primary" style={{ height: 40 }} onClick={goAddRecipient}><UserPlus size={15} /> Add Recipient</button>
                    <button type="button" className="btn btn-sm btn-line" onClick={() => navigate('/dashboard/import-wizard')}><Upload size={15} /> Import Wizard</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="mini">Send to</span>
                  <div className="track" role="group" aria-label="Send to">
                    {AUDIENCES.map((x) => (
                      <button key={x.key} type="button" aria-pressed={audience === x.key} aria-disabled={whoLocked && x.key !== 'one'} className={whoLocked && x.key !== 'one' && audience !== x.key ? 'locked' : ''} onClick={() => chooseAudience(x.key)}>
                        {x.segment}
                      </button>
                    ))}
                  </div>
                  <p className="cap" data-testid="gx-aud-caption">
                    {whoLocked ? 'Several occasions are selected, so this card goes to one person. To send to several people, keep one occasion.'
                      : audience === 'one'
                        ? (chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'person' : 'people'} added — add as many as you like.` : 'Add people one at a time, or switch to a whole category.')
                        : groupMembers.length === 0 ? `No one is in ${aud.label.toLowerCase()} yet — set a relationship on a recipient.`
                          : `${chosen.length} of your ${groupMembers.length} ${aud.people} will each get their own Greet-Me.`}
                  </p>
                  <div className="whobody">
                    {audience === 'one' ? (
                      <>
                        <button type="button" className="addsome" data-testid="gx-addsome" aria-expanded={pickerOpen} onClick={() => setPickerOpen((v) => !v)}>
                          <span className="pl"><Plus size={16} /></span>
                          <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', font: '500 15px var(--sans)', color: 'var(--ink)' }}>Add someone</span><span style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>{picks.length ? `${picks.length} added — pick another` : 'Pick people one by one, as many as you like'}</span></span>
                          <ChevronDown size={16} color="#9A7CCB" />
                        </button>
                        <div className="whoscroll" style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {chosen.map((c) => (
                              <span key={c.id} className="pchip"><span className="avatar" style={{ width: 24, height: 24, fontSize: 10, background: avatarBg(c.name) }}>{initials(c.name)}</span>{c.name}<button type="button" aria-label={`Remove ${c.name}`} onClick={() => togglePick(c.id)}><X size={14} /></button></span>
                            ))}
                          </div>
                        </div>
                        {pickerOpen ? (
                          <div className="picker" data-testid="gx-picker">
                            <div className="find"><Search size={15} color="#9A7CCB" /><input ref={(el) => { if (el && !el.dataset.f) { el.dataset.f = 1; el.focus({ preventScroll: true }); } }} value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find someone…" aria-label="Find someone" /></div>
                            <div className="list">
                              {contacts.filter((c) => (c.name || '').toLowerCase().includes(find.toLowerCase())).length === 0
                                ? <p style={{ padding: '12px', fontSize: 14, color: 'var(--muted)' }}>No one matches that name yet.</p>
                                : contacts.filter((c) => (c.name || '').toLowerCase().includes(find.toLowerCase())).map((c) => (
                                  <button key={c.id} type="button" className={`prow ${whoLocked && picks.length >= 1 && !picks.includes(c.id) ? 'locked' : ''}`} aria-pressed={picks.includes(c.id)} aria-disabled={whoLocked && picks.length >= 1 && !picks.includes(c.id)} onClick={() => togglePick(c.id)}>
                                    <span className="avatar" style={{ width: 30, height: 30, fontSize: 11, background: avatarBg(c.name) }}>{initials(c.name)}</span>
                                    <span style={{ flex: 1, minWidth: 0 }}><span className="name" style={{ fontSize: 14.5 }}>{c.name}</span><span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)' }}>{c.relationship}</span></span>
                                    {picks.includes(c.id) ? <Check size={16} color="#4A3273" /> : null}
                                  </button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                              <button type="button" className="btn btn-sm btn-line" style={{ flex: 1, borderStyle: 'dashed' }} onClick={goAddRecipient}><Plus size={15} /> Add a new recipient</button>
                              <button type="button" className="btn btn-sm btn-primary" style={{ height: 38 }} onClick={() => setPickerOpen(false)}>Done</button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="whoscroll" data-testid="gx-group-list">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: 'var(--muted)', padding: '0 4px 6px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> Tap anyone to leave them out</span>
                          <span style={{ fontWeight: 600, color: 'var(--p700)' }}>{chosen.length} of {groupMembers.length} selected</span>
                        </div>
                        {groupMembers.map((c) => {
                          const inc = !excluded.includes(c.id);
                          return (
                            <button key={c.id} type="button" className="grow" aria-pressed={inc} onClick={() => setExcluded((cur) => (inc ? [...cur, c.id] : cur.filter((x) => x !== c.id)))}>
                              <span className={`box ${inc ? 'on' : ''}`}><Check size={12} /></span>
                              <span className="avatar" style={{ width: 30, height: 30, fontSize: 11, background: avatarBg(c.name) }}>{initials(c.name)}</span>
                              <span style={{ minWidth: 0 }}><span className="name" style={{ fontSize: 14.5, color: inc ? 'var(--ink)' : 'rgba(44,29,70,.45)' }}>{c.name}</span><span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)' }}>{c.relationship}</span></span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Inline date-and-gift resolver: fixed height, scrolls inside; nothing collapses and no series of modals. */}
            <div className="resolver" data-testid="gx-resolver">
              <div className="rhead"><span className="mini">Dates &amp; gifts</span>{resolverOn ? <span className="sub" style={{ marginTop: 0 }}>{occasions.length} occasion{occasions.length === 1 ? '' : 's'} for {first(resolvePerson.name)} · each is its own scheduled Greet-Me</span> : null}</div>
              {resolverOn && mode === 'now' ? <p className="rnote" data-testid="gx-resolver-sendnow">You chose Send Now. Several occasions can&rsquo;t go in one card, so each one is scheduled separately for its own date. Nothing is sent now; your Send Now choice is unchanged.</p> : null}
              {resolverOn ? (
                <div className="rrows">
                  {occasions.map((o) => {
                    const r = rowOf(o) || { date: '', gift: null };
                    const ok = rowComplete(r);
                    return (
                      <div className="rrow" key={o} data-testid="gx-resolver-row">
                        <span className={`num ${ok ? 'done' : ''}`} style={{ width: 22, height: 22 }}>{ok ? <Check size={12} /> : ''}</span>
                        <span className="rname">{o}{r.prefilled ? <span className="rpre">saved</span> : null}</span>
                        <input type="date" aria-label={`${o} date`} value={r.date || ''} onChange={(e) => setRow(o, { date: e.target.value })} className="rdate" />
                        <select aria-label={`${o} gift`} value={r.gift ? r.gift.type : ''} onChange={(e) => setRow(o, { gift: chooseGift(r, e.target.value) })} className="rgift">
                          {RESOLVER_GIFT_OPTIONS.map(([v, t]) => <option key={v} value={v} disabled={v === ''}>{t}</option>)}
                        </select>
                        <span className="rline">{resolverGiftLine(r.gift)}{r.gift && r.gift.type !== 'none' ? <> <button type="button" className="link" style={{ fontSize: 12.5 }} onClick={() => goScheduler(resolvePerson.id, r.type)}>Gift details in their Occasion Scheduler</button></> : null}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rempty">When one person has several occasions, set each occasion&rsquo;s date and gift here. Each becomes its own scheduled Greet-Me; nothing is combined.</p>
              )}
            </div>
            <div className="donerow">
              <span className="hint">{chosen.length ? `${chosen.length} selected` : 'Select at least one person'}</span>
              <button type="button" className="btn btn-sm btn-primary" style={{ height: 40 }} data-testid="gx-who-done" disabled={!chosen.length} onClick={() => { setWhoDone(true); setPickerOpen(false); }}><Check size={15} /> Done</button>
            </div>
          </div>

          <div className="step" data-testid="gx-step-3">
            <StepHead n={3} label="Personalize — optional" isDone={persDone} />
            <div className="ptiles">
              <div className="ptile" data-testid="gx-voice-tile">
                <span className={`ic ${voiceDone ? 'okc' : 'hero'}`}>{voiceDone ? <Check size={20} /> : <Mic size={20} />}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><b>{voiceDone ? 'Voice greeting ready' : 'Record your voice'}</b>{voiceDone ? <span className="tag" style={{ background: 'var(--g100)', color: '#6b4f08' }}>Saved</span> : null}</div>
                  <p className="sub2">{voiceDone ? 'Your saved voice is used. No need to record again.' : 'Optional — about 15 seconds is plenty.'}</p>
                  <div className="acts2">
                    {voiceDone ? (
                      <>
                        {voiceSrc ? <button type="button" className="btn btn-xs btn-line" data-testid="gx-play-voice" onClick={togglePlay}>{playingVoice ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}</button> : null}
                        <button type="button" className="btn btn-xs btn-line" data-testid="gx-rerecord" onClick={openSetupRevisit}><RotateCcw size={14} /> Re-record</button>
                        <button type="button" className="link" data-testid="gx-revisit" onClick={openSetupRevisit}>Revisit setup · voice &amp; photo</button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-xs btn-primary" style={{ height: 34 }} data-testid="gx-revisit" onClick={openSetupRevisit}><Mic size={14} /> Start recording</button>
                    )}
                  </div>
                </div>
              </div>
              <div className="ptile" data-testid="gx-photo-tile">
                <span className="ic cam">{photoDone ? <img src={user.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={20} />}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><b>{photoDone ? 'Your photo is ready' : 'Add your photo'}</b>{photoDone ? <span className="tag" style={{ background: 'var(--g100)', color: '#6b4f08' }}>Uploaded</span> : null}</div>
                  <p className="sub2">{photoDone ? 'It appears inside the Greet-Me card they receive.' : 'A face makes the moment warmer.'}</p>
                  <div className="acts2">
                    <button type="button" className="btn btn-xs btn-line" onClick={() => navigate('/dashboard/profile')}><Camera size={14} /> {photoDone ? 'Change photo' : 'Add photo'}</button>
                    <button type="button" className="link" onClick={() => navigate('/dashboard/media')}>Media Library</button>
                  </div>
                </div>
              </div>
            </div>
            {!photoDone ? <div className="warn"><AlertCircle size={16} style={{ flex: 'none', marginTop: 2 }} /><span>{SENDER_PHOTO_REQUIRED_MESSAGE}</span></div> : null}
            <label className="words" style={{ display: 'block' }}>
              <span className="fieldlabel">A few words from you (optional)</span>
              <textarea data-testid="gx-words" value={words} onChange={(e) => setWords(e.target.value)} maxLength={HANDOFF_MAX_WORDS} placeholder="Happy birthday, and thank you for always showing up for me…" />
            </label>
            <div className="fieldlabel" style={{ marginTop: 12 }}>Memory photos (optional)</div>
            {/* Fixed-size drop box (the approved size): added photos show inside it, so nothing below moves. */}
            <div className="moments" data-testid="gx-moments">
              {memoryPhotos.length === 0 ? (
                <button type="button" className="madd" data-testid="gx-moments-add" onClick={() => memoryInputRef.current?.click()}>
                  <ImagePlus size={22} color="#7C63AE" />
                  <span style={{ marginTop: 6, font: '600 14.5px var(--sans)', color: 'var(--p800)' }}>Add image here</span>
                  <span style={{ marginTop: 2, fontSize: 13, color: 'var(--muted)' }}>{photoNote || 'These images can be presented inside your Greet-Me cards.'}</span>
                </button>
              ) : (
                <>
                  <div className="mthumbs" data-testid="gx-moments-thumbs" aria-label="Memory photos added">
                    {memoryPhotos.map((src, k) => (
                      <span className="mthumb" key={k}><img src={src} alt={`Memory photo ${k + 1}`} /><button type="button" aria-label={`Remove memory photo ${k + 1}`} onClick={() => setMemoryPhotos((cur) => cur.filter((_, j) => j !== k))}><X size={12} /></button></span>
                    ))}
                  </div>
                  <button type="button" className="link" data-testid="gx-moments-add" style={{ marginTop: 6, fontSize: 13 }} disabled={memoryPhotos.length >= HANDOFF_MAX_PHOTOS} onClick={() => memoryInputRef.current?.click()}>
                    {photoNote || (memoryPhotos.length >= HANDOFF_MAX_PHOTOS ? `${HANDOFF_MAX_PHOTOS} of ${HANDOFF_MAX_PHOTOS} added` : `Add more · ${memoryPhotos.length} of ${HANDOFF_MAX_PHOTOS}`)}
                  </button>
                </>
              )}
            </div>
            <input ref={memoryInputRef} type="file" accept="image/jpeg,image/jpg,image/png" multiple onChange={addMemoryPhotos} style={{ display: 'none' }} data-testid="gx-moments-input" />
            <div className="donerow">
              <span className="hint">Nothing here is required.</span>
              <button type="button" className="btn btn-sm btn-primary" style={{ height: 40 }} data-testid="gx-pers-done" onClick={() => setPersDone(true)}><Check size={15} /> Done</button>
            </div>
          </div>

          <div className="giftband" id="gx-gifts" data-testid="gx-step-4">
            <StepHead n={4} label="Add a gift (optional)" isDone={Boolean(gift) && !resolverOn} />
            <GiftCarousel
              chosen={resolverOn ? null : gift}
              smartCardAvailable={smartCardAvailable}
              onAdd={(g) => {
                // Scheduled Greet-Mes take each occasion's gift from Dates & gifts (the Occasion Scheduler's own choice).
                if (resolverOn) { setGiftNote('For scheduled Greet-Mes, choose each occasion’s gift under Dates & gifts above.'); return; }
                setGiftNote(''); setGift((cur) => (cur === g ? null : g));
              }}
              onQuickGift={quickGift}
              onLearnQr={() => setShowHowItWorksModal(true)}
            />
          </div>

          <div className="footbar" data-testid="gx-footbar">
            <div style={{ minWidth: 0 }}>
              <StepHead n={5} label="Send" isDone={Boolean(saveMsg && saveMsg.ok)} />
              <div className="sum" data-testid="gx-summary" style={{ marginTop: 6 }}>{summary}</div>
              <div className={`fine ${saveMsg && !saveMsg.ok ? 'saveerr' : ''}`} data-testid="gx-fine" role="status" aria-live="polite">{fineText}</div>
            </div>
            <button type="button" className="btn btn-primary" data-testid="gx-continue" disabled={!canContinue} onClick={handoff}>
              {resolverOn ? <><CalendarDays size={18} /> {saving ? 'Saving…' : `Review and save schedule${occasions.length === 1 ? '' : 's'}`}</> : <><Send size={18} /> Continue to review</>}
            </button>
          </div>
        </section>

        {/* 3. One full-width card: Recipients | Upcoming Occasions | Past Occasions (fixed size, scrolls inside) */}
        <section className="card tabcard" data-testid="gx-lower">
          <div className="tabhead">
            <div className="tabs" role="tablist" aria-label="Your people and occasions">
              {[['recipients', 'Recipients'], ['upcoming', 'Upcoming Occasions'], ['past', 'Past Occasions']].map(([k, t]) => (
                <button key={k} type="button" role="tab" id={`gx-tab-${k}`} aria-selected={tab === k} aria-controls="gx-tabpanel" onClick={() => setTab(k)}>{t}</button>
              ))}
            </div>
            <div className="tabact">
              {tab === 'recipients' ? <button type="button" className="btn btn-sm btn-primary" style={{ height: 38 }} onClick={goAddRecipient}><UserPlus size={15} /> Add Recipient</button>
                : tab === 'past' ? <button type="button" className="link" onClick={() => navigate('/dashboard/sent')}>See all</button>
                  : <span className="sub" style={{ marginTop: 0 }}>From Occasion Schedulers</span>}
            </div>
          </div>
          <div className="tabbody" id="gx-tabpanel" role="tabpanel" aria-labelledby={`gx-tab-${tab}`} data-testid="gx-tabbody">
            {tab === 'recipients' ? (
              contacts.length === 0 ? (
                <div className="empty" data-testid="gx-lower-recipients-empty" style={{ marginTop: 0 }}>
                  <div className="ico"><UserPlus size={20} /></div>
                  <div className="t">No recipients yet</div>
                  <p>Add your first recipient to schedule personalized Greet-Me greetings for each occasion where you turn on Enable Auto-Gift. You can also send a Greet-Me anytime.</p>
                  <button type="button" className="btn btn-sm btn-line" onClick={() => navigate('/dashboard/import-wizard')}><Upload size={15} /> Import Wizard</button>
                </div>
              ) : (
                <>
                  <div className="search" style={{ marginTop: 0 }}><Search size={16} color="#8a8199" /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Find someone…" aria-label="Find a recipient" /></div>
                  {filtered.map((c) => (
                    <div className="row" key={c.id}>
                      <div className="avatar" style={{ background: avatarBg(c.name) }}>{initials(c.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="name">{c.name}</div>
                        <div className="meta">{c.relationship}{(c.occasions || []).length ? ' · ' : ''}{(c.occasions || []).slice(0, 3).map((o) => getOccasionIcon(typeof o === 'string' ? o : o.type)).join(' ')}{(c.occasions || []).length > 3 ? ` +${c.occasions.length - 3}` : ''}</div>
                      </div>
                      <button type="button" className="iconbtn" aria-label={`Send a Greet-Me to ${c.name}`} title="Send" onClick={() => navigate(`/dashboard/send?contactId=${c.id}`)}><Send size={16} /></button>
                      <button type="button" className="iconbtn" data-testid="gx-edit-recipient" aria-label={`Edit ${c.name}`} title="Edit" onClick={() => goEdit(c.id)}><Pencil size={16} /></button>
                    </div>
                  ))}
                </>
              )
            ) : tab === 'upcoming' ? (
              <>
                {upcomingOccasions.length === 0 ? (
                  <div className="empty" data-testid="gx-upcoming-empty" style={{ marginTop: 0 }}>
                    <div className="ico"><CalendarDays size={20} /></div>
                    <div className="t">Nothing coming up yet</div>
                    <p>Upcoming occasions will appear here as you add recipients. Add a recipient and an occasion date in their Occasion Scheduler.</p>
                    <button type="button" className="btn btn-sm btn-line" onClick={() => navigate('/dashboard/contacts', { state: { openAddRecipient: true } })}>Add Occasion</button>
                  </div>
                ) : (
                  <>
                    <p className="nudge" data-testid="gx-nudge">Don&rsquo;t miss their moment.</p>
                    {upcomingOccasions.map((occasion) => {
                      const d = new Date(`${String(occasion.date).slice(0, 10)}T12:00:00`);
                      const isUrgent = typeof occasion.daysUntil === 'number' && occasion.daysUntil <= 3;
                      // A row shows its real status once the scheduler holds one; otherwise "Auto-send on" (the scheduler
                      // prepares it 14 days ahead) or the action to schedule it.
                      const status = occasion.scheduleStatus ? (OCCASION_STATUS_LABELS[occasion.scheduleStatus] || OCCASION_STATUS_LABELS[null]) : null;
                      const when = occasion.daysUntil === 0 ? 'Today!' : occasion.daysUntil === 1 ? 'Tomorrow' : `in ${occasion.daysUntil} days`;
                      return (
                        <div className="row uprow" key={occasion.occasionId || `${occasion.contactId}:${occasion.occasionType}`} data-testid="gx-up-row">
                          <div className="datebox"><span>{d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span><b>{d.getDate()}</b></div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="name">{occasion.contactName}</div>
                            <div className="meta">{getOccasionIcon(occasion.occasionType)} {OCC_LABEL(occasion.occasionType)} · {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · <span style={{ color: isUrgent ? '#b4232f' : 'inherit', fontWeight: isUrgent ? 700 : 400 }}>{when}</span></div>
                          </div>
                          {status ? <span className={`tag ${status.tone}`} data-testid="gx-up-status">{status.tone === 'ok' ? <Check size={12} /> : null}{status.text}</span>
                            : occasion.autoSend ? <span className="tag plum" data-testid="gx-up-auto" title="The scheduler prepares it 14 days before the date">Auto-send on</span>
                              : occasion.contactId ? <button type="button" className="btn btn-sm btn-primary sched" data-testid="gx-up-schedule" onClick={() => goScheduler(occasion.contactId, occasion.occasionType)}><CalendarDays size={14} /> Schedule the Love</button> : null}
                          {occasion.contactId && (
                            <button type="button" className="iconbtn" aria-label={`Edit ${occasion.contactName}`} title="Edit" onClick={() => navigate('/dashboard/contacts', { state: { openEditRecipientId: occasion.contactId } })}><Pencil size={16} /></button>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            ) : (
              pastItems.length === 0 ? (
                <div className="empty" data-testid="gx-past-empty" style={{ marginTop: 0 }}>
                  <div className="ico"><Send size={18} /></div>
                  <div className="t">No Greet-Me sends yet</div>
                  <p>Once you add contacts and occasions, Greet-Me™ will handle the rest!</p>
                </div>
              ) : pastItems.map((g) => {
                const [label, tone] = PAST_STATUS[g.status] || ['Creating', 'amber'];
                const when = g.completedAt || g.createdAt;
                return (
                  <div className="row" key={g.id} data-testid="gx-past-row">
                    <div className="avatar" style={{ background: avatarBg(g.recipientName), width: 36, height: 36, fontSize: 13 }}>{initials(g.recipientName)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="name">{g.recipientName || 'Unknown'}</div>
                      <div className="meta">{getOccasionIcon(g.occasionType)} {OCC_LABEL(g.occasionType)}{when ? ` · ${new Date(when).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</div>
                    </div>
                    <span className={`tag ${tone}`}>{tone === 'ok' ? <Check size={12} /> : null}{label}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Mobile App QR Code — home-screen install panel */}
        <section className="card install" data-testid="gx-install">
          <div className="medal" style={{ width: 44, height: 44, background: 'var(--p50)' }}><Smartphone size={20} color="#5A3E8A" /></div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 17 }}>Add Greet-Me™ to Your Home Screen</h3>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2 }}>Scan the QR code to open the install page. No app store needed.</p>
          </div>
          <button type="button" className="qrbtn" onClick={() => navigate('/app')} title="Scan to open the Greet-Me home-screen install page" aria-label="Open the Greet-Me home-screen install page">
            {appQrUrl ? <img src={appQrUrl} alt="Scan to install Greet-Me" style={{ width: 64, height: 64, borderRadius: 8, border: '1px solid var(--line)', display: 'block' }} /> : <QrCode size={32} style={{ color: '#667eea', opacity: 0.3 }} />}
          </button>
        </section>
      </div>

      {/* W07 SAVE-time authorization for the inline resolver — the scheduler's own modal, shown only when needed. */}
      {SCHEDULED_QRCASH_AVAILABLE && authModal && authForm && (
        <SaveAuthorizationModal
          plan={authModal.plan} card={authModal.card}
          formData={authForm} setFormData={setAuthForm}
          onCancel={() => { setAuthModal(null); setAuthForm(null); }}
          onSave={async (consents) => {
            await commitSchedules(authModal.person, sanitizeRelationshipForSave(authForm), consents);
            setAuthModal(null); setAuthForm(null);
          }}
        />
      )}

      {/* How QR Cash Works Modal */}
      {showHowItWorksModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowHowItWorksModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
              backdropFilter: 'blur(4px)'
            }}
          />

          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              borderTopLeftRadius: 'var(--radius-xl)',
              borderTopRightRadius: 'var(--radius-xl)',
              color: 'white',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  margin: 0,
                  marginBottom: '0.25rem'
                }}>How QR Cash Works</h2>
                <p style={{
                  fontSize: '0.875rem',
                  opacity: 0.9,
                  margin: 0
                }}>Send · Scan · Spend</p>
              </div>
              <button
                onClick={() => setShowHowItWorksModal(false)}
                style={{
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  border: '2px solid white',
                  borderRadius: '9999px',
                  padding: '0.5rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: 'white',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                  flexShrink: 0,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  fontFamily: 'inherit'
                }}
                {...getHoverHandlers({
                  onEnter: (e) => { e.currentTarget.style.transform = 'scale(1.05)'; },
                  onLeave: (e) => { e.currentTarget.style.transform = 'scale(1)'; },
                })}
                title="Close"
              >
                <X size={16} strokeWidth={3} />
                Close
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '2rem' }}>
              {/* Introduction */}
              <p style={{
                fontSize: '1rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                marginBottom: '2rem',
                textAlign: 'center'
              }}>
                QR Cash lets you send real money as a gift that recipients can spend anywhere. It's simple, personal, and universally appreciated.
              </p>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Step 1 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(251, 191, 36, 0.2)'
                }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)'
                  }}>
                    <Send size={20} style={{ color: 'white' }} />
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>1. Create & Send</h3>
                    <p style={{
                      fontSize: '0.9375rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      margin: 0
                    }}>
                      Choose an amount ($5, $10, $25, or custom), add a personal message, and enter the recipient's name and email. We'll generate a unique QR code and send it automatically, or you can print/share it yourself.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.05) 100%)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(102, 126, 234, 0.2)'
                }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                  }}>
                    <QrCode size={20} style={{ color: 'white' }} />
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>2. Recipient Scans</h3>
                    <p style={{
                      fontSize: '0.9375rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      margin: 0
                    }}>
                      The recipient receives the QR Cash via email or as a printed gift. They simply scan the QR code with their phone camera to open the redemption page and claim their cash gift.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.05) 100%)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(34, 197, 94, 0.2)'
                }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                  }}>
                    <CreditCard size={20} style={{ color: 'white' }} />
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>3. Spend Anywhere</h3>
                    <p style={{
                      fontSize: '0.9375rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      margin: 0
                    }}>
                      Once redeemed, we review and send the cash to their chosen Zelle, Venmo, Cash App or PayPal. Payouts are processed manually.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tracking Info */}
              <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                textAlign: 'center'
              }}>
                <Gift size={24} style={{ color: '#f59e0b', marginBottom: '0.5rem' }} />
                <p style={{
                  fontSize: '0.9375rem',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.6
                }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Track Your Gifts:</strong> You'll see a red dollar sign for pending gifts and a green dollar sign when they've been received in your Past Greetings dashboard.
                </p>
              </div>

              {/* CTA Button */}
              <button
                onClick={() => {
                  setShowHowItWorksModal(false);
                  navigate('/dashboard/send?giftType=qrcash');
                }}
                style={{
                  width: '100%',
                  marginTop: '2rem',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                {...getHoverHandlers({
                  onEnter: (e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.4)';
                  },
                  onLeave: (e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.3)';
                  },
                })}
              >
                <DollarSign size={20} />
                Send QR Cash Now
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
