// src/pages/DashboardHome.jsx
//
// Personal dashboard on the Base44 direction (founder-approved rendering and revisions, Report 103, 2026-10-18).
// The page PREPARES; it never sends, schedules, charges or grants anything on its own:
//   * Send Now hands one recipient + one occasion (with optional words and memory photos) to the existing send
//     flow (/dashboard/send), which keeps its own review, consent, payment and sending rules;
//   * one recipient with several occasions (or Schedule the Love) is saved through that recipient's EXISTING
//     Occasion Scheduler record — one scheduled Greet-Me per occasion, never a combined card — with the scheduler's
//     own normalisation and authorisation step (utils/occasionResolver.js);
//   * several recipients (2-10) share one occasion. Send Now: one review (each person's gift and cost, the total,
//     the current rules), then one EXISTING per-recipient send each (utils/groupSend.js). Schedule the Love: the
//     occasion is saved to each person's own Occasion Scheduler (S3, utils/occasionResolver.js).
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
import { relationshipErrors, sanitizeRelationshipForSave } from '../components/contactFormValidation.js';
import SaveAuthorizationModal from '../components/w07Auth/SaveAuthorizationModal';
import { planAuthorization } from '../utils/scheduledQrCashConsent';
import { normalizeGiftSettingsForSave } from '../utils/occasionGiftSave';
import {
  SCHEDULER_OCCASION_TYPES, isSchedulerOccasion, prefillRow, chooseGift, rowComplete, buildResolverContact, finalizeResolverSave,
  RESOLVER_GIFT_OPTIONS, resolverGiftStatus, resolverGiftAmount,
} from '../utils/occasionResolver';
import { writeDashboardHandoff, HANDOFF_MAX_WORDS, HANDOFF_MAX_PHOTOS } from '../utils/dashboardSendHandoff';
import { buildGreetingPayload } from '../utils/sendGreetingPayload';
import { GROUP_MAX, loadRun, clearRun, runSummary } from '../utils/groupSend';
import { saveGroupSchedules } from '../utils/occasionResolver';
import GroupReview from '../components/dashboard/GroupReview';
import InfoTip from '../components/dashboard/InfoTip';
import G1G1Badge from '../components/G1G1Badge';
import { qrCashQuote, centsToDollarString } from '../utils/qrCashAmount';
import { DASHBOARD_HOME_CSS } from './dashboardHomeStyles';
import { OCCASION_CHIPS, OCCASION_MENUS } from '../utils/dashboardOccasions';
import ScheduledGiftPicker from '../components/scheduledGift/ScheduledGiftPicker';
import ScheduledGiftEntry from '../components/scheduledGift/ScheduledGiftEntry';
import { SCHEDULED_PHYSICAL_GIFT_AVAILABLE } from '../config/scheduledPhysicalGift';
import { scheduledGiftConsentsFor, authorizationStepEnabled, scheduledGiftSavedConfirmations } from '../utils/scheduledPhysicalGift';
import { SCHEDULED_QRCASH_AVAILABLE } from '../config/scheduledQrCash';
import { saveLauncherState, readLauncherState, clearLauncherState } from '../utils/dashboardLauncherState';
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
  skipped_transient: { text: 'Preparing', color: '#7F8C8D', bg: '#F4F6F7', tone: 'muted' }, // the scheduler retries it
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

// Occasions: the Recipients page's own list and groups (utils/dashboardOccasions.js — OCCASION_CHIPS, OCCASION_MENUS),
// plus the send page's Thank You, Congratulations, Just Because and the generic Season's Greetings. GREETING_RULES untouched.
// Base44 "Send to" segments mapped onto the recipient's existing relationshipCategory (family | friend | professional).
// The lower card's Recipients filter: the same relationshipCategory values, All by default.
// Report 135: the same organisation as the Celebrations page — Individuals | Friends | Family | Professional, shown
// below the Recipients | Occasions toggle and above the search. Individuals (key 'all') lists everyone, one by one.
const RECIPIENT_FILTERS = [
  { key: 'all', label: 'Individuals', people: 'recipients' },
  { key: 'friend', label: 'Friends', people: 'friends' },
  { key: 'family', label: 'Family', people: 'family members' },
  { key: 'professional', label: 'Professional', people: 'professional contacts' },
];
const AUDIENCES = [
  { key: 'one', segment: 'Individuals', label: 'People you choose' },
  { key: 'friend', segment: 'Friends', label: 'All friends', people: 'friends' },
  { key: 'family', segment: 'Family', label: 'All family', people: 'family members' },
  { key: 'professional', segment: 'Professional', label: 'All professional contacts', people: 'professional contacts' },
  { key: 'all', segment: 'Everyone', label: 'Everyone in your circle', people: 'people' },
];
// Every occasion the dashboard offers: restored choices are kept only when they are one of these (Team 5 F-C2).
const OFFERED_OCCASIONS = new Set([...OCCASION_CHIPS, ...OCCASION_MENUS.flatMap((m) => m.groups.flatMap((g) => g.items))]);
const SENDER_PHOTO_REQUIRED_MESSAGE = 'Every Greet-Me includes your photo so the recipient knows it is from you. Add a profile photo to send — your greeting stays saved while you do.';
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// Occasion keys the backend stores for sends (occasionKey) shown with the send flow's own labels.
const OCC_KEY_LABELS = { thankyou: 'Thank You', thank_you: 'Thank You', congrats: 'Congratulations', just_because: 'Just Because', holiday: "Season's Greetings", baby: 'Baby', general: 'Thinking of You' };
const OCC_LABEL = (t) => OCC_KEY_LABELS[t] || (t || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace('Mothers Day', "Mother's Day").replace('Fathers Day', "Father's Day").replace('Getwell', 'Get Well');
function initials(name) { return (name || '?').split(/\s+/).filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || '?'; }
const AVATAR = ['#5A3E8A', '#7C63AE', '#4A3273', '#8A5A2B', '#3E5A7C', '#6B3E6B'];
function avatarBg(name) { let h = 0; for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR[h % AVATAR.length]; }
const first = (n) => (n || '').split(' ')[0];
// The scheduler refuses to save a relationship that is started but missing its group or specific relationship
// (ContactForm validate -> relationshipErrors); saving it anyway would clear the stored closeness and profile
// (sanitizeRelationshipForSave). The dashboard refuses exactly that case and sends the sender to the scheduler.
const relationshipWouldBeCleared = (built) => Boolean(relationshipErrors(built).relationship);
// A scheduled row's gift, compactly: QR Cash amount + fee = total, one short status, and the explanation (and the
// fee formula) behind the info icon.
function ScheduledGiftLine({ gift }) {
  if (!gift) return null;
  const st = resolverGiftStatus(gift);
  const amount = resolverGiftAmount(gift);
  const q = gift.type === 'qrcash' && amount !== null ? qrCashQuote(amount) : null;
  return (
    <>
      {gift.type === 'qrcash' ? <b>{q ? `QR Cash ${centsToDollarString(q.amountCents)} + ${centsToDollarString(q.feeCents)} fee = ${centsToDollarString(q.totalCents)} \u00b7 ` : 'QR Cash \u00b7 '}</b> : null}
      <span data-testid="gx-sched-status">{st.label}</span>
      <InfoTip label={`About: ${st.label}`} testid="gx-sched-info">{st.detail}{gift.type === 'qrcash' ? ' The QR Cash fee is $1.99 + 3% of the gift amount.' : ''}</InfoTip>
    </>
  );
}

const SCHEDULER_TYPE_OF = (label) => SCHEDULER_OCCASION_TYPES[label] || label;
const labelForType = (type) => (occasionTypes.find((o) => o.value === type) || {}).label;
const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader(); r.onloadend = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
});

function GiftCarousel({ chosen, onAdd, onRemove, onLearnQr, smartCardAvailable }) {
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
        {/* Adding never toggles off on a second tap; removing is its own action. */}
        <button type="button" className="link" data-testid="gx-gift-remove" style={{ visibility: chosen ? 'visible' : 'hidden' }} tabIndex={chosen ? 0 : -1} onClick={onRemove}>Remove {chosen === 'qrcash' ? 'QR Cash' : 'gift'}</button>
        {/* Report 135: QR Cash is offered beside the gold button on its own slide; its space is kept on every slide so
            nothing moves as the carousel turns. */}
        <span className="qr-acts" style={{ visibility: s.key === 'qrcash' ? 'visible' : 'hidden' }}>
          <button type="button" className="link" onClick={onLearnQr} tabIndex={s.key === 'qrcash' ? 0 : -1}>How it works</button>
          <button type="button" className="btn btn-sm btn-line qr-add" data-testid="gx-add-qr" tabIndex={s.key === 'qrcash' ? 0 : -1} aria-pressed={chosen === 'qrcash'} onClick={() => onAdd('qrcash')}>
            {chosen === 'qrcash' ? <><Check size={15} /> QR Cash added</> : <><QrCode size={15} /> Add QR Cash</>}
          </button>
        </span>
        {/* The gold "Add a gift" stays in place on every slide (Report 135): it opens the Gift Place, which holds
            every gift, so it never depends on the slide showing. */}
        <button type="button" className="btn btn-sm btn-gold" style={{ height: 40 }} data-testid="gx-add-gift" aria-pressed={chosen === 'gift'} onClick={() => onAdd('gift')}>
          {chosen === 'gift' ? <><Check size={16} /> Gift added</> : <><Gift size={16} /> Add a gift</>}
        </button>
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
  // The lower card's Recipients filter. Display only: it never changes who is chosen in the composer.
  const [recipFilter, setRecipFilter] = useState('all');
  const lastWhen = useRef('upcoming');

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

  // ── Launcher state: local to this page, never saved to the server. The send flow and the Occasion Scheduler own the
  // real data. Choices are kept for one round trip to the Recipients page (editing a recipient or opening their
  // Occasion Scheduler) and restored here on return (utils/dashboardLauncherState.js).
  const [kept] = useState(() => readLauncherState(window.sessionStorage, user?.id));
  const K = (f, d) => (kept && kept[f] !== undefined ? kept[f] : d);
  // Restored values are kept only when they are values this page itself offers (a hand-edited tab can't inject others).
  const [mode, setMode] = useState(['now', 'occasion'].includes(K('mode', null)) ? K('mode', null) : null);
  const [occasions, setOccasions] = useState((Array.isArray(K('occasions', [])) ? K('occasions', []) : []).filter((o) => OFFERED_OCCASIONS.has(o)));
  const [menuOpen, setMenuOpen] = useState(null);
  const [audience, setAudience] = useState(AUDIENCES.some((a) => a.key === K('audience', 'one')) ? K('audience', 'one') : 'one');
  const [picks, setPicks] = useState(K('picks', []));
  const [excluded, setExcluded] = useState(K('excluded', []));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [find, setFind] = useState('');
  const [words, setWords] = useState(K('words', ''));
  const [memoryPhotos, setMemoryPhotos] = useState(K('memoryPhotos', []));
  const [photoNote, setPhotoNote] = useState('');
  const [gift, setGift] = useState(['qrcash', 'gift'].includes(K('gift', null)) ? K('gift', null) : null);
  const [whoDone, setWhoDone] = useState(K('whoDone', false));
  const [persDone, setPersDone] = useState(K('persDone', false));
  const [ruleNote, setRuleNote] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const [rows, setRows] = useState(K('rows', {}));
  const [datesOpen, setDatesOpen] = useState(K('datesOpen', false));
  // Scheduled physical gift (Report 117 U1): the row whose product picker is open. Its card and consent are collected
  // at the final confirmation (Save schedules -> the scheduler's own authorisation step), never in the picker.
  const [sgPick, setSgPick] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [authModal, setAuthModal] = useState(null);
  const [authForm, setAuthForm] = useState(null);
  // Group sending (2-10 people, one shared occasion).
  const [groupReviewOpen, setGroupReviewOpen] = useState(false);
  const [pendingRun, setPendingRun] = useState(() => { const r = loadRun(window.localStorage, user?.id); return r && !runSummary(r).done ? r : null; });
  const [resumeRun, setResumeRun] = useState(null);
  const [groupDefaultGift, setGroupDefaultGift] = useState(K('groupDefaultGift', null)); // scheduled groups: the gift for everyone
  const [groupResults, setGroupResults] = useState({}); // scheduled groups: per-person save outcome
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
  // Editing a recipient (or opening their Occasion Scheduler) from here keeps the in-progress choices and brings the
  // sender back to them after saving or closing the edit (Contacts.jsx returnTo).
  const keepChoices = () => {
    const kept2 = saveLauncherState(window.sessionStorage, user?.id, { mode, occasions, audience, picks, excluded, words, memoryPhotos, gift, whoDone, persDone, rows, groupDefaultGift, datesOpen });
    if (kept2 === 'without_photos') showManualToast('Photos not kept', 'Your memory photos were too large to keep on this device while you edit. Your other choices are kept.', COMMS_CATEGORIES.SYSTEM);
  };
  const goAddFromFlow = () => { keepChoices(); navigate('/dashboard/contacts', { state: { openAddRecipient: true, returnTo: 'dashboard' } }); };
  const goEdit = (id) => { keepChoices(); navigate('/dashboard/contacts', { state: { openEditRecipientId: id, returnTo: 'dashboard' } }); };
  const goScheduler = (contactId, occasionType) => { keepChoices(); navigate(`/dashboard/contacts?contactId=${encodeURIComponent(contactId)}&occasion=${encodeURIComponent(occasionType)}`, { state: { returnTo: 'dashboard' } }); };
  const filtered = useMemo(() => contacts.filter((c) => (c.name || '').toLowerCase().includes(term.toLowerCase()) || (c.relationship || '').toLowerCase().includes(term.toLowerCase())), [contacts, term]);
  const shownRecipients = recipFilter === 'all' ? filtered : filtered.filter((c) => c.relationshipCategory === recipFilter);

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
    if (!picks.includes(id) && picks.length >= GROUP_MAX) { setRuleNote('cap'); return; }
    setRuleNote(''); setSaveMsg(null); setPicks((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  const pickFromHero = (c) => {
    if (audience !== 'one') { if (occasions.length > 1) { setRuleNote('who'); return; } }
    else if (!picks.includes(c.id) && occasions.length > 1 && picks.length >= 1) { setRuleNote('who'); return; }
    else if (!picks.includes(c.id) && picks.length >= GROUP_MAX) { setRuleNote('cap'); return; }
    setRuleNote(''); setSaveMsg(null); setAudience('one'); setPicks((cur) => (cur.includes(c.id) ? cur : [...cur, c.id]));
  };
  const chooseAudience = (k) => {
    if (k !== 'one' && occasions.length > 1) { setRuleNote('group'); return; }
    setRuleNote(''); setSaveMsg(null); setAudience(k); setExcluded([]); setPickerOpen(false);
  };
  const aud = AUDIENCES.find((x) => x.key === audience);
  const occLocked = chosen.length > 1 && occasions.length >= 1;   // several people: no further occasions
  const whoLocked = occasions.length > 1;                          // several occasions: one person only
  const notSchedulable = mode === 'occasion' && occasions.find((o) => !isSchedulerOccasion(o));
  const overCap = chosen.length > GROUP_MAX;
  const ruleText = ruleNote === 'cap' ? `A group is up to ${GROUP_MAX} people.`
    : overCap ? `A group is up to ${GROUP_MAX} people. Leave out ${chosen.length - GROUP_MAX} more to continue.`
    : ruleNote === 'occ' ? 'You’re sending to several people, so they share one occasion. Remove people to add more occasions.'
    : ruleNote === 'who' || ruleNote === 'group' ? 'Several occasions go to one person. To send to several people, keep just one occasion.'
      : ruleNote.startsWith('sched:') ? `${ruleNote.slice(6)} is sent on its own with Send Now. Several occasions for one person are each scheduled in their Occasion Scheduler, so they must all be occasions it holds.`
        : notSchedulable ? `${notSchedulable} isn’t an Occasion Scheduler occasion, so it can’t be scheduled. Choose Send Now for it.`
          : occLocked ? 'Several people share one occasion.'
            : whoLocked ? 'Several occasions go to one person.'
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

  // S3: Schedule the Love for a group - one shared scheduler occasion, one row per person. Each person's own saved
  // gift is kept (an individual setting); otherwise the gift for everyone; any row can be changed.
  const groupSchedOn = chosen.length >= 2 && !overCap && mode === 'occasion' && occasions.length === 1 && isSchedulerOccasion(occasions[0]);
  useEffect(() => {
    if (!groupSchedOn) return;
    setRows((cur) => {
      const next = { ...cur };
      chosen.forEach((p) => { const k = `${p.id}:${occasions[0]}`; if (!next[k]) next[k] = prefillRow(p, occasions[0]); });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupSchedOn, chosen.map((p) => p.id).join('|'), occasions.join('|')]);
  const groupRowOf = (p) => {
    const r = rows[`${p.id}:${occasions[0]}`] || { type: undefined, date: '', gift: null };
    return { ...r, gift: r.chosen || r.gift || groupDefaultGift || null };
  };
  const setGroupRow = (p, patch) => { setSaveMsg(null); setGroupResults({}); setRows((cur) => ({ ...cur, [`${p.id}:${occasions[0]}`]: { ...cur[`${p.id}:${occasions[0]}`], ...patch } })); };
  const groupSchedComplete = !groupSchedOn || chosen.every((p) => rowComplete(groupRowOf(p)));

  const saveGroupSchedulesNow = async () => {
    if (!groupSchedOn || !groupSchedComplete || saving) return;
    setSaving(true); setSaveMsg(null); setGroupResults({});
    try {
      const people = chosen.slice();
      let card; // fetched once, only if a QR Cash Auto-Gift is involved
      const plan = authorizationStepEnabled(SCHEDULED_QRCASH_AVAILABLE, SCHEDULED_PHYSICAL_GIFT_AVAILABLE) ? async (person, toSave) => {
        const settings = normalizeGiftSettingsForSave(toSave.occasionGiftSettings);
        if (card === undefined && hasAutoGiftNeedingCard(settings)) {
          try { const r = await api.getQrCashCardStatus(); card = (r && r.card) || null; } catch { card = null; }
        }
        return planAuthorization({ settings, initialSettings: person.occasionGiftSettings, occasions: toSave.occasions, card: card || null, formData: toSave, labelFor: labelForType, requiresDelivery: requiresDeliveryAddress, storedScheduledGiftConsents: person.scheduledGiftConsents }).need;
      } : null;
      const results = await saveGroupSchedules({
        people, rowFor: (p) => groupRowOf(p), api, sanitize: sanitizeRelationshipForSave, plan,
        validate: (built) => !relationshipWouldBeCleared(built),
        onProgress: (rs) => setGroupResults(Object.fromEntries(rs.map((x) => [x.id, x]))),
      });
      setSaveMsg(groupSaveMsg(results));
      if (results.some((x) => x.status === 'saved')) { showManualToast('Saved ✓', 'Recipient settings have been saved.', COMMS_CATEGORIES.PROFILE); fetchDashboardData(); }
    } finally {
      setSaving(false);
    }
  };

  const sgConsents = (types, settings) => (types && types.length ? scheduledGiftConsentsFor(types, settings) : null);
  const hasAutoGiftNeedingCard = (settings) => Object.values(settings || {}).some((g) => g && g.autoGift === true && (g.type === 'qrcash' || g.scheduledGift));
  const dayLabel = (d) => { const t = d ? new Date(`${String(d).slice(0, 10)}T12:00:00`) : null; return t && !Number.isNaN(t.getTime()) ? t.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'the occasion date'; };
  // After a save has succeeded (never before): what happens on the date for each scheduled physical gift on Auto-Gift.
  const sgAfterSave = (toSave) => { const t = scheduledGiftSavedConfirmations(toSave.occasionGiftSettings, (k) => dayLabel(((toSave.occasions || []).find((o) => o.type === k) || {}).date)); return t ? ` ${t}` : ''; };
  // Physical gift types whose exact product can be chosen for the date (Goody gift box, Printful Branded Goods).
  const sgChoosable = (g) => SCHEDULED_PHYSICAL_GIFT_AVAILABLE && g && ['merch', 'marketplace', 'gift_boxes'].includes(g.type);

  const groupSaveMsg = (results) => {
    const saved = results.filter((x) => x.status === 'saved').length;
    const needs = results.filter((x) => x.status === 'needs_scheduler').length;
    const failed = results.filter((x) => x.status === 'failed').length;
    return { ok: failed === 0 && needs === 0, text: `Saved ${saved} of ${results.length} scheduled Greet-Mes for ${occasions[0]}.${needs ? ` ${needs} still need${needs === 1 ? 's' : ''} details: see the row.` : ''}${failed ? ` ${failed} couldn\u2019t be saved; see the row.` : ''}` };
  };

  // A scheduled group member whose save needs the scheduler's own step (a missing delivery address, or consent / a card
  // for a QR Cash Auto-Gift): that step opens for this one person — the scheduler's SaveAuthorizationModal, prefilled
  // from their saved record so only what is missing is asked — and on completion their record is saved like any other.
  const finishGroupPerson = async (person) => {
    const built = buildResolverContact(person, [groupRowOf(person)]);
    if (relationshipWouldBeCleared(built)) { goScheduler(person.id, SCHEDULER_TYPE_OF(occasions[0])); return; }
    const toSave = sanitizeRelationshipForSave(built);
    const settings = normalizeGiftSettingsForSave(toSave.occasionGiftSettings);
    let card = null;
    if (hasAutoGiftNeedingCard(settings)) {
      try { const r = await api.getQrCashCardStatus(); card = (r && r.card) || null; }
      catch { setSaveMsg({ ok: false, text: 'We couldn’t check the card on file just now. Please try again.' }); return; }
    }
    const plan = planAuthorization({ settings, initialSettings: person.occasionGiftSettings, occasions: toSave.occasions, card, formData: toSave, labelFor: labelForType, requiresDelivery: requiresDeliveryAddress, storedScheduledGiftConsents: person.scheduledGiftConsents });
    setAuthForm(toSave); setAuthModal({ plan, card, person, group: true });
  };
  const commitGroupPerson = async (person, toSave, consents = [], sgTypes = []) => {
    const res = await api.updateContact(person.id, finalizeResolverSave(toSave, consents, sgConsents(sgTypes, toSave.occasionGiftSettings)));
    if (res && res.ok === false) {
      throw new Error(res.networkError ? 'We couldn’t save — check your connection and try again.' : (res.error || res.message || 'We couldn’t save this schedule.'));
    }
    const next = { ...groupResults, [person.id]: { id: person.id, status: 'saved' } };
    setGroupResults(next);
    setSaveMsg(groupSaveMsg(chosen.map((p) => next[p.id] || { id: p.id, status: 'failed' })));
    showManualToast('Saved ✓', sgAfterSave(toSave).trim() || 'Recipient settings have been saved.', COMMS_CATEGORIES.PROFILE);
    fetchDashboardData();
  };

  const commitSchedules = async (person, toSave, consents = [], sgTypes = []) => {
    const res = await api.updateContact(person.id, finalizeResolverSave(toSave, consents, sgConsents(sgTypes, toSave.occasionGiftSettings)));
    if (res && res.ok === false) {
      throw new Error(res.networkError ? 'We couldn’t save — check your connection and try again.' : (res.error || res.message || 'We couldn’t save those schedules. Please try again.'));
    }
    const n = occasions.length;
    setSaveMsg({ ok: true, text: `Saved: ${n} scheduled Greet-Me${n === 1 ? '' : 's'} for ${first(person.name)}, each on its own date. You’ll find ${n === 1 ? 'it' : 'them'} in their Occasion Scheduler and under Upcoming Occasions.${sgAfterSave(toSave)}` });
    showManualToast('Saved ✓', sgAfterSave(toSave).trim() || 'Recipient settings have been saved.', COMMS_CATEGORIES.PROFILE);
    fetchDashboardData();
  };

  const saveSchedules = async () => {
    if (!resolvePerson || !resolverComplete || saving) return;
    setSaving(true); setSaveMsg(null);
    try {
      const person = resolvePerson;
      const built = buildResolverContact(person, occasions.map((o) => rowOf(o)));
      if (relationshipWouldBeCleared(built)) {
        setSaveMsg({ ok: false, text: `${first(person.name)}’s relationship details are incomplete. Finish them in their Occasion Scheduler (“Gift details in their Occasion Scheduler”), then save here.` });
        return;
      }
      const toSave = sanitizeRelationshipForSave(built);
      const settings = normalizeGiftSettingsForSave(toSave.occasionGiftSettings);
      if (authorizationStepEnabled(SCHEDULED_QRCASH_AVAILABLE, SCHEDULED_PHYSICAL_GIFT_AVAILABLE)) {
        // The scheduler's own SAVE-time authorisation: consent for a new or changed QR Cash Auto-Gift, a card when
        // none usable is on file, the mailing address of a shipped gift. Nothing is requested when none applies.
        let card = null;
        if (hasAutoGiftNeedingCard(settings)) {
          try { const res = await api.getQrCashCardStatus(); card = (res && res.card) || null; }
          catch { setSaveMsg({ ok: false, text: 'We couldn’t check the card on file just now. Please try again.' }); return; }
        }
        const plan = planAuthorization({
          settings, initialSettings: person.occasionGiftSettings, occasions: toSave.occasions, card, formData: toSave,
          labelFor: labelForType, requiresDelivery: requiresDeliveryAddress, storedScheduledGiftConsents: person.scheduledGiftConsents,
        });
        if (plan.need.consent || plan.need.address || plan.need.scheduledGiftConsent || plan.need.card) { setAuthForm(toSave); setAuthModal({ plan, card, person }); return; }
      }
      await commitSchedules(person, toSave);
    } catch (error) {
      setSaveMsg({ ok: false, text: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!pickerOpen && !menuOpen) return undefined;
    const close = (e) => { if (!e.target.closest('.picker, .addsome, .menu, .relpop')) { setPickerOpen(false); setMenuOpen(null); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pickerOpen, menuOpen]);

  // Back from a recipient edit: the kept choices are used once, then cleared; the flow is brought into view.
  useEffect(() => {
    if (!kept) return;
    clearLauncherState(window.sessionStorage);
    if (kept.photosDropped) setPhotoNote('Your memory photos were too large to keep while you edited. Add them again here.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (kept && !loading) { const el = document.getElementById('gx-flow'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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
  const sendNowGroup = mode === 'now' && isGroup && !overCap && occasions.length === 1;
  const canContinue = step1Done && step2Done && !overCap && !notSchedulable && !saving && (
    resolverOn || groupSchedOn ? true
      : sendNowGroup ? true
        : sendNowSingle);
  const datesComplete = resolverOn ? resolverComplete : groupSchedOn ? groupSchedComplete : false;
  const canSaveDates = step1Done && chosen.length > 0 && !overCap && !notSchedulable && !saving && datesComplete;
  const saveDates = () => {
    if (!canSaveDates) return;
    setWhoDone(true);
    if (resolverOn) saveSchedules(); else saveGroupSchedulesNow();
  };
  // Step 2's Save: one clear action. It confirms who it is for and, when the choices are schedules, opens Dates & gifts.
  const completeWho = () => {
    if (!chosen.length) return;
    setWhoDone(true); setPickerOpen(false);
    if (resolverOn || groupSchedOn) setDatesOpen(true);
  };

  const handoff = () => {
    if (!canContinue) return;
    if (resolverOn || groupSchedOn) { if (datesComplete) saveDates(); else setDatesOpen(true); return; }
    if (sendNowGroup) { setResumeRun(null); setGroupReviewOpen(true); return; }
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

  useEffect(() => { if (saveMsg && saveMsg.ok && datesOpen) setDatesOpen(false); }, [saveMsg]); // eslint-disable-line react-hooks/exhaustive-deps
  // Only once the recipients have loaded: a restored Dates & gifts waits for the people it belongs to.
  useEffect(() => { if (contactsLoaded && !(resolverOn || groupSchedOn) && datesOpen) setDatesOpen(false); }, [contactsLoaded, resolverOn, groupSchedOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const occLabel = occasions.length === 0 ? 'no occasion yet' : occasions.length <= 2 ? occasions.join(' + ') : `${occasions.length} occasions`;
  const whoLabel = chosen.length === 0 ? 'no one yet' : chosen.length === 1 ? first(chosen[0].name) : `${chosen.length} people`;
  const summary = !mode ? 'Choose Send Now or Schedule the Love'
    : [mode === 'now' ? 'Send Now' : 'Schedule the Love', occLabel, whoLabel, gift && !resolverOn && !groupSchedOn ? `${gift === 'qrcash' ? 'QR Cash' : 'gift'}${chosen.length > 1 ? ' for everyone · change per person at review' : ''}` : null].filter(Boolean).join(' · ');
  const fineText = saveMsg ? saveMsg.text
    : giftNote ? giftNote
    : overCap ? `A group is up to ${GROUP_MAX} people.`
      : groupSchedOn ? (groupSchedComplete ? `Each person\u2019s ${occasions[0]} is saved as their own scheduled Greet-Me in their Occasion Scheduler.` : 'Set a date and a gift choice for everyone to continue.')
        : sendNowGroup ? 'Next: review each person\u2019s gift and cost. Nothing is charged or sent until you confirm.'
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
              {/* Phones: the header has no room, so the G1G1 control (and its explanation on tap) sits here. */}
              <span className="g1g1-phone"><G1G1Badge compact /></span>
            </div>
            <div className="acts" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-sm btn-ghost-w" data-testid="gx-add-recipient" onClick={goAddRecipient}><UserPlus size={16} /> Add Recipient</button>
              <button type="button" className="btn btn-sm btn-ghost-w" onClick={() => navigate('/dashboard/import-wizard')}><Upload size={16} /> Import Wizard</button>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <h1>{firstName ? `${firstName}, who would you like to celebrate today?` : 'Who would you like to celebrate today?'}<button type="button" className="quick" data-testid="gx-quick-hero" onClick={() => navigate('/dashboard/gifts')}><Gift size={15} /> Quick Gift <ChevronRight size={15} /></button></h1>
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
            <div><h2>Greet-Me, right now, or right on time?</h2></div>
            <p>You review everything, and pay for any gift, before anything is sent.</p>
          </div>

          {pendingRun ? (
            <div className="warn" data-testid="gx-group-resume" style={{ marginTop: 14 }}>
              <AlertCircle size={16} style={{ flex: 'none', marginTop: 2 }} />
              <span style={{ flex: 1 }}>An unfinished group send for {pendingRun.occasion}: {runSummary(pendingRun).sent} of {runSummary(pendingRun).total} sent. Nobody is sent twice if you continue.</span>
              <button type="button" className="btn btn-sm btn-primary" style={{ height: 34 }} data-testid="gx-group-resume-btn" onClick={() => { setResumeRun(pendingRun); setGroupReviewOpen(true); }}>Resume</button>
              <button type="button" className="link" onClick={() => { clearRun(window.localStorage); setPendingRun(null); }}>Dismiss</button>
            </div>
          ) : null}
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
              {OCCASION_CHIPS.map((o) => <button key={o} type="button" className={`chip-btn occ ${occLocked && !occasions.includes(o) ? 'locked' : ''}`} aria-pressed={occasions.includes(o)} aria-disabled={occLocked && !occasions.includes(o)} onClick={() => toggleOcc(o)}>{o}</button>)}
              {OCCASION_MENUS.map((m) => {
                const sel = occasions.filter((o) => m.groups.some((g) => g.items.includes(o)));
                return (
                  <span className="relpop" key={m.key}>
                    <button type="button" className="chip-btn occ" data-testid={`gx-menu-${m.key}`} aria-pressed={sel.length > 0} aria-haspopup="menu" aria-expanded={menuOpen === m.key} onClick={() => setMenuOpen((v) => (v === m.key ? null : m.key))}>
                      {sel.length === 1 ? sel[0] : sel.length > 1 ? `${m.label} · ${sel.length}` : m.label}<ChevronDown size={15} />
                    </button>
                    {menuOpen === m.key ? (
                      <span className={`menu menu-${m.key}`} role="menu" aria-label={m.label}>
                        {m.groups.map((g) => (
                          <span key={g.title} role="group" aria-label={g.title} style={{ display: 'block' }}>
                            <span className="mgroup" aria-hidden="true">{g.title}</span>
                            {g.items.map((o) => (
                              <button key={o} type="button" role="menuitemcheckbox" aria-checked={occasions.includes(o)} aria-disabled={occLocked && !occasions.includes(o)} className={occLocked && !occasions.includes(o) ? 'locked' : ''} onClick={() => { toggleOcc(o); setMenuOpen(null); }}>
                                <span className={`box ${occasions.includes(o) ? 'on' : ''}`}><Check size={12} /></span>{o}
                              </button>
                            ))}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>
            <p className={`rule ${ruleNote || notSchedulable || overCap ? 'warn2' : ''}`} data-testid="gx-rule" role="status" aria-live="polite">{ruleText}</p>
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
                              <button type="button" className="btn btn-sm btn-line" style={{ flex: 1, borderStyle: 'dashed' }} onClick={goAddFromFlow}><Plus size={15} /> Add a new recipient</button>
                              <button type="button" className="btn btn-sm btn-primary" style={{ height: 38 }} data-testid="gx-picker-done" onClick={() => (chosen.length ? completeWho() : setPickerOpen(false))}>Done</button>
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
                  {/* Save: confirms who it is for (nothing is scheduled or sent here). For schedules it opens the
                      Dates & gifts pop-up, which keeps these choices. */}
                  <div className="donerow whosave" data-testid="gx-who-donerow">
                    <span className="hint">{!chosen.length ? 'Select at least one person'
                      : `${chosen.length} selected · ${resolverOn || groupSchedOn ? 'next, dates & gifts' : 'nothing is sent yet'}`}</span>
                    <button type="button" className="btn btn-sm btn-primary" style={{ height: 40 }} data-testid="gx-who-done" disabled={!chosen.length} onClick={completeWho}><Check size={15} /> Save</button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="step" data-testid="gx-step-3">
            <StepHead n={3} label="Personalize" isDone={persDone} />
            <div className="ptiles">
              <div className="ptile" data-testid="gx-voice-tile">
                <span className={`ic ${voiceDone ? 'okc' : 'hero'}`}>{voiceDone ? <Check size={20} /> : <Mic size={20} />}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><b>{voiceDone ? 'Voice greeting ready' : 'Record your voice'}</b>{voiceDone ? <span className="tag" style={{ background: 'var(--g100)', color: '#6b4f08' }}>Saved</span> : null}</div>
                  <p className="sub2">{voiceDone ? 'Your saved voice is used. No need to record again.' : 'Required for group sending — about 15 seconds is plenty.'}</p>
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
              <span className="hint">Words and memory photos are optional.</span>
              <button type="button" className="btn btn-sm btn-primary" style={{ height: 40 }} data-testid="gx-pers-done" onClick={() => setPersDone(true)}><Check size={15} /> Done</button>
            </div>
          </div>

          <div className="giftband" id="gx-gifts" data-testid="gx-step-4">
            <StepHead n={4} label="Add a gift (optional)" isDone={Boolean(gift) && !resolverOn} />
            <GiftCarousel
              chosen={resolverOn || groupSchedOn ? null : gift}
              smartCardAvailable={smartCardAvailable}
              onAdd={(g) => {
                // Scheduled Greet-Mes take each occasion's gift from Dates & gifts (the Occasion Scheduler's own gift choice).
                if (resolverOn || groupSchedOn) { setGiftNote('For scheduled Greet-Mes, each gift is chosen in Dates & gifts.'); setDatesOpen(true); return; }
                setGift(g);
                setGiftNote(isGroup && g === 'gift' ? 'For a group, choose a gift box (or QR Cash) for each person at review, before anything is charged.'
                  : g === 'qrcash' ? 'QR Cash added. You set the amount on the next screen, before anything is charged.'
                    : 'Gift added. Send takes you to the Gift Place to choose it, with this greeting kept. Nothing is charged until you confirm.');
              }}
              onRemove={() => { setGift(null); setGiftNote(''); }}
              onLearnQr={() => setShowHowItWorksModal(true)}
            />
          </div>

          <div className="footbar" data-testid="gx-footbar">
            <div style={{ minWidth: 0 }}>
              <StepHead n={5} label={resolverOn || groupSchedOn ? 'Save' : 'Send'} isDone={Boolean(saveMsg && saveMsg.ok)} />
              <div className="sum" data-testid="gx-summary" style={{ marginTop: 6 }}>{summary}</div>
              <div className={`fine ${saveMsg && !saveMsg.ok ? 'saveerr' : ''}`} data-testid="gx-fine" role="status" aria-live="polite">{fineText}</div>
            </div>
            <button type="button" className="btn btn-primary" data-testid="gx-continue" disabled={!canContinue} onClick={handoff}>
              {/* Report 135: the final labels are "Send" (Send Now: the send flow, where it is reviewed) and "Save"
                  (Schedule the Love: saved to their Occasion Scheduler). The line beside it says what happens next. */}
              {resolverOn || groupSchedOn ? <><CalendarDays size={18} /> {saving ? 'Saving…' : 'Save'}</>
                : <><Send size={18} /> Send</>}
            </button>
          </div>
        </section>

        {/* 3. One full-width card: Recipients | Upcoming Occasions | Past Occasions (fixed size, scrolls inside) */}
        <section className="card tabcard" data-testid="gx-lower">
          <div className="tabhead">
            {/* Report 135: Recipients | Occasions, the Celebrations page's two paths; Upcoming | Past sits below it. */}
            <div className="tabs" role="tablist" aria-label="Your people and occasions">
              <button type="button" role="tab" id="gx-tab-recipients" data-testid="gx-lower-recipients" aria-selected={tab === 'recipients'} aria-controls="gx-tabpanel" onClick={() => setTab('recipients')}>Recipients</button>
              <button type="button" role="tab" id="gx-tab-occasions" data-testid="gx-lower-occasions" aria-selected={tab !== 'recipients'} aria-controls="gx-tabpanel" onClick={() => setTab((t) => (t === 'recipients' ? lastWhen.current : t))}>Occasions</button>
            </div>
            <div className="tabact">
              {tab === 'recipients' ? <button type="button" className="btn btn-sm btn-primary" style={{ height: 38 }} onClick={goAddRecipient}><UserPlus size={15} /> Add Recipient</button>
                : tab === 'past' ? <button type="button" className="link" onClick={() => navigate('/dashboard/sent')}>See all</button>
                  : <span className="sub" style={{ marginTop: 0 }}>From Occasion Schedulers</span>}
            </div>
          </div>
          {tab === 'recipients' ? (
            <div className="segrow" role="tablist" aria-label="Show recipients" data-testid="gx-recip-segments">
              {RECIPIENT_FILTERS.map((f) => (
                <button key={f.key} type="button" role="tab" aria-selected={recipFilter === f.key} data-testid={`gx-recip-filter-${f.key}`} onClick={() => setRecipFilter(f.key)}>{f.label}</button>
              ))}
            </div>
          ) : (
            <div className="segrow" role="tablist" aria-label="Upcoming or past occasions" data-testid="gx-when">
              {[['upcoming', 'Upcoming Occasions'], ['past', 'Past Occasions']].map(([k, t]) => (
                <button key={k} type="button" role="tab" id={`gx-tab-${k}`} aria-selected={tab === k} aria-controls="gx-tabpanel" onClick={() => { lastWhen.current = k; setTab(k); }}>{t}</button>
              ))}
            </div>
          )}
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
                  {shownRecipients.length === 0 ? (
                    <p className="rempty" data-testid="gx-recip-filter-empty">{recipFilter === 'all' ? 'No one matches that name yet.' : `No ${RECIPIENT_FILTERS.find((f) => f.key === recipFilter).people} ${term ? 'match that name' : 'yet — set a relationship on a recipient'}.`}</p>
                  ) : null}
                  {shownRecipients.map((c) => (
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
                            <button type="button" className="iconbtn" aria-label={`Edit ${occasion.contactName}`} title="Edit" onClick={() => goEdit(occasion.contactId)}><Pencil size={16} /></button>
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

        {/* Dates & gifts: one scheduled Greet-Me per occasion (or per person), saved through each recipient's own Occasion
            Scheduler. Close keeps every choice; Save schedules saves. It steps aside while the scheduler's own
            authorisation step (consent, card, address) is open. */}
        {SCHEDULED_PHYSICAL_GIFT_AVAILABLE && sgPick ? (
          <ScheduledGiftPicker isOpen contact={sgPick.person} occasionLabel={sgPick.occasion}
            occasionDateLabel={sgPick.date ? new Date(`${String(sgPick.date).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'the occasion date'}
            initial={sgPick.initial} onClose={() => setSgPick(null)}
            onSave={(setting) => { sgPick.apply(setting); setSgPick(null); }} />
        ) : null}
        {datesOpen && (resolverOn || groupSchedOn) && !authModal && !sgPick ? (
          <div className="grv-backdrop" role="dialog" aria-modal="true" aria-labelledby="gx-dates-title" data-testid="gx-dates-modal" onKeyDown={(e) => { if (e.key === 'Escape') setDatesOpen(false); }}>
            <div className="grv">
              <div className="grv-head">
                <div>
                  <span className="eyebrow">Dates &amp; gifts</span>
                  <h2 id="gx-dates-title" tabIndex={-1} ref={(el) => { if (el && !el.dataset.f) { el.dataset.f = 1; el.focus({ preventScroll: true }); } }}>
                    {resolverOn ? `${occasions.length} scheduled Greet-Me${occasions.length === 1 ? '' : 's'} for ${first(resolvePerson.name)}` : `${occasions[0]} for ${chosen.length} people`}
                  </h2>
                  <span className="sub" style={{ marginTop: 2 }}>{resolverOn ? 'Each occasion is its own scheduled Greet-Me, in their Occasion Scheduler.' : 'Each person gets their own scheduled Greet-Me, in their Occasion Scheduler.'}</span>
                </div>
                <button type="button" className="iconbtn" aria-label="Close" data-testid="gx-dates-x" onClick={() => setDatesOpen(false)}><X size={16} /></button>
              </div>
            <div className="resolver inmodal" data-testid="gx-resolver">
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
                          {r.gift && r.gift.type === 'gift_boxes' ? <option value="gift_boxes">Gift box</option> : null}
                        </select>
                        <span className="rline"><ScheduledGiftLine gift={r.gift} />{r.gift && r.gift.type !== 'none' ? <> <button type="button" className="link" style={{ fontSize: 12.5 }} onClick={() => goScheduler(resolvePerson.id, r.type)}>Gift details in their Occasion Scheduler</button></> : null}</span>
                        {sgChoosable(r.gift) ? <div style={{ gridColumn: '1 / -1' }}><ScheduledGiftEntry compact setting={r.gift} onChoose={() => setSgPick({ person: resolvePerson, occasion: o, type: r.type, date: r.date, initial: r.gift, apply: (g) => setRow(o, { gift: g }) })} onRemove={() => setRow(o, { gift: { type: 'none', autoGift: false } })} /></div> : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                groupSchedOn ? (
                  <>
                    <label className="rgroupdefault">
                      <span className="fieldlabel">Gift for everyone</span>
                      <select data-testid="gx-group-default-gift" aria-label="Gift for everyone" value={groupDefaultGift ? groupDefaultGift.type : ''} onChange={(e) => { setSaveMsg(null); setGroupResults({}); setGroupDefaultGift(e.target.value ? chooseGift({ gift: null }, e.target.value) : null); }} className="rgift">
                        {RESOLVER_GIFT_OPTIONS.map(([v, t]) => <option key={v} value={v} disabled={v === ''}>{t}</option>)}
                      </select>
                    </label>
                    <div className="rrows">
                      {chosen.map((p) => {
                        const r = groupRowOf(p);
                        const raw = rows[`${p.id}:${occasions[0]}`] || {};
                        const ok = rowComplete(r);
                        const res = groupResults[p.id];
                        return (
                          <div className="rrow" key={p.id} data-testid="gx-group-row">
                            <span className={`num ${ok ? 'done' : ''}`} style={{ width: 22, height: 22 }}>{ok ? <Check size={12} /> : ''}</span>
                            <span className="rname">{p.name}{raw.prefilled ? <span className="rpre">saved</span> : null}{res ? <span className={`tag ${res.status === 'saved' ? 'ok' : res.status === 'failed' ? 'muted' : 'amber'}`} data-testid="gx-group-row-status">{res.status === 'saved' ? 'Saved' : res.status === 'failed' ? 'Not saved' : 'Needs their scheduler'}</span> : null}</span>
                            <input type="date" aria-label={`${p.name} ${occasions[0]} date`} value={r.date || ''} onChange={(e) => setGroupRow(p, { date: e.target.value })} className="rdate" />
                            <select aria-label={`${p.name} gift`} value={raw.chosen ? raw.chosen.type : 'default'} onChange={(e) => setGroupRow(p, { chosen: e.target.value === 'default' ? null : chooseGift({ gift: raw.gift }, e.target.value) })} className="rgift">
                              <option value="default">{raw.gift ? `Keep their saved gift (${(RESOLVER_GIFT_OPTIONS.find(([v]) => v === raw.gift.type) || [null, raw.gift.type])[1]})` : groupDefaultGift ? 'Same as everyone' : 'Choose a gift…'}</option>
                              {RESOLVER_GIFT_OPTIONS.filter(([v]) => v !== '').map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                              {raw.chosen && raw.chosen.type === 'gift_boxes' ? <option value="gift_boxes">Gift box</option> : null}
                            </select>
                            <span className="rline">{res && res.status === 'failed' ? res.message : null}{res && res.status === 'needs_scheduler' ? (res.need && res.need.relationship ? 'Their relationship details need finishing in their Occasion Scheduler. '
                              : <>{res.need && res.need.address && !res.need.consent && !res.need.card ? 'Their delivery address is needed. ' : res.need && (res.need.consent || res.need.card || res.need.scheduledGiftConsent) && !res.need.address ? 'Your Auto-Gift authorization is needed. ' : 'Their delivery address and your Auto-Gift authorization are needed. '}<button type="button" className="btn btn-xs btn-primary" style={{ height: 30 }} data-testid="gx-group-finish" onClick={() => finishGroupPerson(p)}>Add missing details</button> </>) : null}{!res || res.status !== 'failed' ? <ScheduledGiftLine gift={r.gift} /> : null}{r.gift && r.gift.type !== 'none' || (res && res.status === 'needs_scheduler') ? <> <button type="button" className="link" style={{ fontSize: 12.5 }} onClick={() => goScheduler(p.id, SCHEDULER_TYPE_OF(occasions[0]))}>Gift details in their Occasion Scheduler</button></> : null}</span>
                            {sgChoosable(r.gift) ? <div style={{ gridColumn: '1 / -1' }}><ScheduledGiftEntry compact setting={r.gift} onChoose={() => setSgPick({ person: p, occasion: occasions[0], type: SCHEDULER_TYPE_OF(occasions[0]), date: r.date, initial: r.gift, apply: (g) => setGroupRow(p, { chosen: g }) })} onRemove={() => setGroupRow(p, { chosen: { type: 'none', autoGift: false } })} /></div> : null}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null
              )}
            </div>
              <div className={`fine ${saveMsg && !saveMsg.ok ? 'saveerr' : ''}`} data-testid="gx-dates-fine" role="status" aria-live="polite">{fineText}</div>
              <div className="grv-actions">
                <button type="button" className="btn btn-sm btn-line" style={{ height: 40 }} data-testid="gx-dates-close" onClick={() => setDatesOpen(false)}>Close</button>
                <button type="button" className="btn btn-sm btn-primary" style={{ height: 40 }} data-testid="gx-dates-save" disabled={!canSaveDates} onClick={saveDates}>
                  <CalendarDays size={16} /> {saving ? 'Saving…' : resolverOn ? `Save schedule${occasions.length === 1 ? '' : 's'}` : `Save ${chosen.length} schedules`}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {groupReviewOpen ? (
          <GroupReview
            recipients={resumeRun ? resumeRun.items.map((it) => ({ id: it.contactId, name: it.name, email: it.email })) : chosen}
            occasion={resumeRun ? resumeRun.occasion : occasions[0]}
            words={resumeRun ? resumeRun.words : words}
            defaultGiftChoice={gift === 'qrcash' ? { type: 'qrcash', amount: 25 } : gift === 'gift' ? { type: 'other' } : null}
            senderPhotoMissing={!photoDone}
            senderVoiceMissing={!voiceDone}
            userId={user?.id}
            initialRun={resumeRun}
            buildPayload={(item, run) => {
              const contact = contacts.find((c) => c.id === item.contactId);
              if (!contact) return null;
              // Each card uses that person's own saved memory photos; photos added on this page are for single sends.
              return buildGreetingPayload({ user, contact, formData: { occasionType: run.occasion, customMessage: run.words, tone: 'warm' }, memoryPhotos: [], useMemoryPhotos: true, excludedMemoryPhotos: new Set(), giftSettings: null, maxPhotos: HANDOFF_MAX_PHOTOS });
            }}
            onClose={() => { setGroupReviewOpen(false); setResumeRun(null); const r = loadRun(window.localStorage, user?.id); setPendingRun(r && !runSummary(r).done ? r : null); }}
            onDone={() => { setPendingRun(null); fetchDashboardData(); }}
          />
        ) : null}

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
      {authorizationStepEnabled(SCHEDULED_QRCASH_AVAILABLE, SCHEDULED_PHYSICAL_GIFT_AVAILABLE) && authModal && authForm && (
        <SaveAuthorizationModal
          plan={authModal.plan} card={authModal.card}
          formData={authForm} setFormData={setAuthForm}
          onCancel={() => { setAuthModal(null); setAuthForm(null); }}
          onSave={async (consents, sgTypes = []) => {
            if (authModal.group) await commitGroupPerson(authModal.person, sanitizeRelationshipForSave(authForm), consents, sgTypes);
            else await commitSchedules(authModal.person, sanitizeRelationshipForSave(authForm), consents, sgTypes);
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
