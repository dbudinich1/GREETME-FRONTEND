// src/pages/Contacts.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Upload, Search, Edit, Trash2, ArrowLeft, Users, Calendar, Gift, Clock, Send } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from "../api/api";
import RecipientsPracticeView from '../components/RecipientsPracticeView';
import { readPracticeView, clearSampleWorkspace } from '../import/sampleWorkspace.js';
import { showManualToast } from '../utils/notify';
import { COMMS_CATEGORIES } from '../utils/commsCatalog';
import Modal from '../components/Modal';
import ContactForm from '../components/ContactForm';
import CSVImport from '../components/CSVImport';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { getOccasionIcon, getOccasionLabel } from '../utils/helpers';
import { autoAddRecipientPhotosToLibrary } from '../utils/mediaLibrary';
import { getErrorMessage } from '../utils/errorMessages';
import { getHoverHandlers } from '../utils/hoverable';
import giftLuxuryBox from '../assets/gifts/gift-luxury-box.png';
import giftBouquet from '../assets/gifts/gift-bouquet.png';
import giftCard from '../assets/gifts/gift-card.png';
import giftBoxStack from '../assets/gifts/gift-box-stack.png';

// Session storage key (must match ContactForm.jsx)
const FORM_DRAFT_KEY = 'greetme_contact_form_draft';

// Hero gift carousel — founder-approved imagery, fixed rotation order.
const GIFT_IMAGES = [
  { src: giftLuxuryBox, alt: 'Luxury gift box' },
  { src: giftBouquet, alt: 'Flower bouquet' },
  { src: giftCard, alt: 'Greet-Me gift card' },
  { src: giftBoxStack, alt: 'Stack of wrapped gifts' },
];

// Deterministic premium fallback-avatar gradients. Curated jewel tones —
// every lighter stop is dark enough for the white monogram to hold AA on
// large bold text; the centered initial sits over the darker blended midpoint.
const AVATAR_GRADIENTS = [
  ['#667eea', '#764ba2'], ['#c0456b', '#7d1f3f'], ['#0f9d8f', '#0b5e63'],
  ['#4f46e5', '#3730a3'], ['#b07515', '#6f4310'], ['#2f855a', '#184e37'],
  ['#556080', '#2f3a52'], ['#8b3fd0', '#5a1a8f'],
];
function avatarGradient(name) {
  const s = name || '';
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const [a, b] = AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

// One restrained easing curve for all hover/focus transitions.
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

// Side-by-side workspace panel chrome — shared by the Recipients and
// Upcoming Occasions columns so both read as one system.
const PANEL_STYLE = {
  background: 'var(--bg-primary)',
  border: '1px solid rgba(15, 23, 42, 0.05)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
  padding: '22px',
  minWidth: 0,
};
const PANEL_TITLE = {
  fontSize: '1.0625rem',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: 'var(--text-primary)',
  margin: 0,
};
const PANEL_VIEWPORT = {
  height: 'min(480px, 50dvh)',
  overflowY: 'auto',
  overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch',
  borderRadius: 'var(--radius-lg)',
  padding: '2px',
};

// Upcoming Occasions is organised into a fixed, always-present set of
// automation categories. Each renders the soonest real occasion (or an
// invitation to schedule). Order is intentional and must not change.
const KNOWN_OCCASION_KEYS = ['birthday', 'anniversary', 'christmas', 'valentines', 'mothers_day', 'fathers_day'];
const OCCASION_CATEGORIES = [
  { key: 'birthday',    label: 'Birthday',        icon: '🎂', match: (t) => t === 'birthday' },
  { key: 'anniversary', label: 'Anniversary',     icon: '💑', match: (t) => t === 'anniversary' },
  { key: 'christmas',   label: 'Christmas',       icon: '🎄', match: (t) => t === 'christmas' },
  { key: 'valentines',  label: "Valentine's Day", icon: '💝', match: (t) => t === 'valentines' },
  { key: 'mothers_day', label: "Mother's Day",    icon: '💐', match: (t) => t === 'mothers_day' },
  { key: 'fathers_day', label: "Father's Day",    icon: '👔', match: (t) => t === 'fathers_day' },
  { key: 'custom',      label: 'Custom Occasion', icon: '✨', match: (t) => !KNOWN_OCCASION_KEYS.includes(t) },
];

export default function Recipients() {
  const navigate = useNavigate();
  const location = useLocation();
  // Recipients PRACTICE VIEW (fail-closed): render session-scoped Test Drive contacts in the normal
  // layout ONLY when the explicit marker is present AND a valid current-session workspace exists.
  const practiceMarker = new URLSearchParams(location.search || '').get('practice') === '1';
  const practiceView = useMemo(() => (practiceMarker ? readPracticeView() : { status: 'none', contacts: [] }), [practiceMarker]);
  const practiceActive = practiceMarker && (practiceView.status === 'active' || practiceView.status === 'empty');
  const exitPractice = () => {
    clearSampleWorkspace();                                   // deterministic cleanup; never a production delete
    try { showManualToast('Test Drive ended', 'Test Drive ended. Practice contacts were removed. Your real recipients were not changed.', COMMS_CATEGORIES.PROFILE); } catch { /* ignore */ }
    navigate('/dashboard/contacts', { replace: true });      // drop the practice=1 marker; Back cannot restore cleared data
  };
  const returnToWizardFromPractice = () => navigate('/dashboard/import-wizard');
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [alert, setAlert] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewMode, setViewMode] = useState('recipients');
  const [occasionSearch, setOccasionSearch] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [reduceMotion, setReduceMotion] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  const [giftIndex, setGiftIndex] = useState(0);
  const giftPausedRef = useRef(false);

  // Respect the OS reduced-motion preference (gates hover transforms only).
  useEffect(() => {
    let m;
    try { m = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return undefined; }
    const onChange = () => setReduceMotion(m.matches);
    m.addEventListener ? m.addEventListener('change', onChange) : m.addListener(onChange);
    return () => { m.removeEventListener ? m.removeEventListener('change', onChange) : m.removeListener(onChange); };
  }, []);
  const hasAutoOpenedRef = useRef(false);
  const hasAutoOpenedAddRef = useRef(false);

  // Hero gift carousel — cross-fade auto-rotation; pauses while hovered.
  useEffect(() => {
    const id = setInterval(() => {
      if (!giftPausedRef.current) setGiftIndex((i) => (i + 1) % GIFT_IMAGES.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  // Handle resize for responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (practiceActive) return;               // Practice View never fetches production recipients
    fetchRecipients();

    // Check if there's a saved form draft
    try {
      const saved = sessionStorage.getItem(FORM_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.timestamp && Date.now() - draft.timestamp < 30 * 60 * 1000 && !draft.isEditing) {
          setShowAddModal(true);
          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 150);
        }
      }
    } catch (e) {
      console.warn('Could not check form draft:', e);
    }
  }, []);

  // Handle deep link from Dashboard to auto-open Edit Recipient modal
  useEffect(() => {
    const editId = location.state?.openEditRecipientId;
    if (editId && recipients.length > 0 && !hasAutoOpenedRef.current) {
      const target = recipients.find(r => r.id === editId);
      if (target) {
        hasAutoOpenedRef.current = true;
        setEditingContact(target);
        setShowEditModal(true);
        // Clear the state so refresh doesn't re-open
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [recipients, location.state, navigate, location.pathname]);

  // Handle deep link from Dashboard to auto-open Add Recipient modal
  useEffect(() => {
    if (location.state?.openAddRecipient && !hasAutoOpenedAddRef.current) {
      hasAutoOpenedAddRef.current = true;
      try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
      setShowAddModal(true);
      // Clear the state so refresh doesn't re-open
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  const fetchRecipients = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const response = await api.getContacts();

      if (response && response.ok === false && response.status === 401) {
        console.warn('API authentication failed, using local storage');
        const stored = localStorage.getItem('greetme_recipients');
        setRecipients(stored ? JSON.parse(stored) : []);
      } else {
        setRecipients(response.data || []);
      }
    } catch (error) {
      console.warn('API error, using local storage fallback:', error);
      const stored = localStorage.getItem('greetme_recipients');
      setRecipients(stored ? JSON.parse(stored) : []);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const showAlertMessage = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleAddRecipient = async (contactData) => {
    try {
      const response = await api.createContact(contactData);

      const newRecipient = {
        id: response?.data?.id || Date.now(),
        ...contactData,
        createdAt: new Date().toISOString()
      };

      setRecipients(prev => {
        const updated = [...prev, newRecipient];
        localStorage.setItem('greetme_recipients', JSON.stringify(updated));
        return updated;
      });

      // Auto-add recipient photos to media library
      autoAddRecipientPhotosToLibrary(contactData);

      showAlertMessage('success', 'Recipient added successfully');
      setShowAddModal(false);

      if (response && response.data) {
        fetchRecipients();
      }
    } catch (error) {
      console.error('Add recipient error:', error);

      // SUB-RECIPIENT-CAPS — do NOT fall back to local/offline storage when the plan cap is hit.
      if (error?.code === 'RECIPIENT_LIMIT_REACHED') {
        showAlertMessage('error', getErrorMessage(error));
        return;
      }

      const newRecipient = {
        id: Date.now(),
        ...contactData,
        createdAt: new Date().toISOString()
      };

      setRecipients(prev => {
        const updated = [...prev, newRecipient];
        localStorage.setItem('greetme_recipients', JSON.stringify(updated));
        return updated;
      });

      // Auto-add recipient photos to media library (even in offline mode)
      autoAddRecipientPhotosToLibrary(contactData);

      showAlertMessage('success', 'Recipient added (stored locally - backend unavailable)');
      setShowAddModal(false);
    }
  };

  const handleEditRecipient = async (contactData) => {
    try {
      await api.updateContact(editingContact.id, contactData);

      // Auto-add any new recipient photos to media library
      autoAddRecipientPhotosToLibrary(contactData);

      showAlertMessage('success', 'Recipient updated successfully');
      setShowEditModal(false);
      setEditingContact(null);
      fetchRecipients();
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteRecipient = async (contactId) => {
    try {
      await api.deleteContact(contactId);
      showAlertMessage('success', 'Recipient deleted successfully');
      setDeleteConfirm(null);
      fetchRecipients();
    } catch (error) {
      showAlertMessage('error', getErrorMessage(error));
    }
  };

  const handleImportRecipients = async (contactsToImport) => {
    let outcome;
    try {
      // One atomic-intent bulk call — whole-batch limit reject + dedup + per-row results.
      const res = await api.importContacts(contactsToImport);
      const { imported = 0, failed = 0, errors = [] } = (res && res.data) || {};
      const rows = (errors || []).map((e) => ({
        name: e?.contact?.name || '',
        email: e?.contact?.email || '',
        reason:
          e?.error === 'Email already exists' ? 'Duplicate — already in your recipients'
          : e?.error === 'Missing name or email' ? 'Missing name or email'
          : 'Could not be added',
      }));
      if (failed === 0) {
        outcome = { kind: 'full', imported, failed, rows: [], message: `${imported} recipient${imported === 1 ? '' : 's'} imported successfully.` };
      } else {
        outcome = { kind: 'partial', imported, failed, rows, message: `${imported} recipient${imported === 1 ? '' : 's'} imported. ${failed} could not be added.` };
      }
    } catch (error) {
      if (error && (error.code === 'RECIPIENT_LIMIT_REACHED' || error.status === 403)) {
        const m = /\((\d+)\)/.exec(error.message || '');
        const limit = m ? m[1] : '3';
        outcome = { kind: 'limit', imported: 0, failed: contactsToImport.length, rows: [], message: `You've reached your plan's recipient limit of ${limit}. Upgrade your plan to add more recipients.` };
      } else {
        outcome = { kind: 'error', imported: 0, failed: contactsToImport.length, rows: [], message: getErrorMessage(error) };
      }
    }
    // Always refresh so any imported rows appear without a manual reload.
    // Silent: never toggle page-level loading, or the modal subtree would unmount
    // and lose the per-row result panel before the user can read it.
    await fetchRecipients({ silent: true });
    showAlertMessage(
      outcome.kind === 'full' ? 'success' : outcome.kind === 'partial' ? 'warning' : 'error',
      outcome.message,
    );
    // Close only on full success; otherwise keep the modal open for the user.
    if (outcome.kind === 'full') setShowImportModal(false);
    return outcome;
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setShowEditModal(true);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const filteredRecipients = recipients.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // PRACTICE VIEW — render the session-scoped Test Drive contacts in the normal layout, in place of the
  // ordinary Recipients page. Genuine recipients are never fetched or shown here (fail-closed above).
  if (practiceActive) {
    return <RecipientsPracticeView status={practiceView.status} contacts={practiceView.contacts} onExit={exitPractice} onReturnToWizard={returnToWizardFromPractice} isMobile={isMobile} />;
  }

  if (loading) {
    return <LoadingSpinner text="Loading recipients..." />;
  }

  // Example placeholder data for empty state
  const placeholderRecipients = [
    { name: 'Mom', relationship: 'Parent', occasions: [{ type: 'birthday' }], hasGift: true },
    { name: 'Best Friend', relationship: 'Friend', occasions: [{ type: 'birthday' }, { type: 'christmas' }], hasGift: false },
    { name: 'Partner', relationship: 'Partner', occasions: [{ type: 'birthday' }, { type: 'anniversary' }], hasGift: true }
  ];

  // Flatten occasions for occasions view
  const allOccasions = recipients.flatMap(contact =>
    (contact.occasions || []).map(occasion => ({
      ...occasion,
      recipientName: contact.name,
      recipientRelationship: contact.relationship,
      contactId: contact.id
    }))
  ).filter(occ =>
    !occasionSearch ||
    occ.type?.toLowerCase().includes(occasionSearch.toLowerCase()) ||
    getOccasionLabel(occ.type)?.toLowerCase().includes(occasionSearch.toLowerCase()) ||
    occ.recipientName?.toLowerCase().includes(occasionSearch.toLowerCase())
  ).sort((a, b) => {
    const dateA = new Date(a.date || '9999-12-31');
    const dateB = new Date(b.date || '9999-12-31');
    return dateA - dateB;
  });

  // Shared premium empty-state — icon badge + primary line + optional secondary.
  // Matches the Upcoming Occasions empty-state language. Restrained; no illustration.
  const renderEmptyState = (Icon, primary, secondary) => (
    <div style={{
      textAlign: 'center',
      padding: '44px 24px',
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid rgba(15, 23, 42, 0.05)',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '14px'
    }}>
      <div style={{
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        background: 'rgba(102, 126, 234, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={24} style={{ color: '#8b93d6' }} />
      </div>
      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.005em' }}>
        {primary}
      </p>
      {secondary && (
        <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.8125rem', lineHeight: 1.5, maxWidth: '22rem' }}>
          {secondary}
        </p>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Premium page shell — unifies header, gift presentation, and workspace
          into one elevated luxury surface. Visual only; no structural change. */}
      <div style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f7f5fc 100%)',
        borderRadius: isMobile ? 'var(--radius-xl)' : '28px',
        border: '1px solid rgba(102, 126, 234, 0.10)',
        boxShadow: '0 24px 60px rgba(76, 61, 143, 0.10), 0 2px 6px rgba(15, 23, 42, 0.04)',
        padding: isMobile ? '1.25rem' : '2.5rem'
      }}>
      {/* Header Banner */}
      <div style={{
        position: 'relative',
        background: 'radial-gradient(120% 140% at 15% 0%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 45%), linear-gradient(135deg, #6d74ee 0%, #764ba2 55%, #6a3f96 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: isMobile ? '30px 20px' : '46px 40px',
        marginBottom: isMobile ? '24px' : '32px',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 16px 38px rgba(76, 61, 143, 0.30), inset 0 1px 0 rgba(255, 255, 255, 0.24)'
      }}>
        {/* Title Row with Back Arrow on Left, Recipients Centered */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          marginBottom: '12px'
        }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              fontFamily: 'inherit',
              position: 'absolute',
              left: 0
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{
            fontSize: isMobile ? '1.625rem' : '1.875rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'white',
            margin: 0,
            lineHeight: 1.2,
            width: '100%',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}>
            My People
            {recipients.length > 0 && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.85)',
                background: 'rgba(255, 255, 255, 0.14)',
                padding: '2px 9px',
                borderRadius: '9999px',
                textAlign: 'center',
                alignSelf: 'center'
              }}>{recipients.length}</span>
            )}
          </h1>
        </div>

        {/* Subtitle — sentence-case value proposition; wraps naturally, centered */}
        <p style={{
          margin: '0 auto',
          maxWidth: '44rem',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.90)',
          fontSize: isMobile ? '1.09375rem' : '1.25rem',
          fontWeight: 500,
          lineHeight: 1.7,
          letterSpacing: '-0.005em'
        }}>
          Automate personalized Greet-Me greetings, gifts, and unforgettable moments for the people who matter most. Forget them NOT!
        </p>

        {/* Header actions — one balanced row: Send (primary) · Add (secondary) · Import (tertiary) */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: '10px',
          justifyContent: 'center',
          marginTop: '22px'
        }}>
          <button
            onClick={() => navigate('/dashboard/send')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              padding: '11px 20px',
              background: '#ffffff',
              color: '#5a4fcf',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(20, 12, 60, 0.20)',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            {...getHoverHandlers({
              onEnter: (e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(20, 12, 60, 0.28)';
              },
              onLeave: (e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(20, 12, 60, 0.20)';
              },
            })}
          >
            <Send size={14} />
            Send Greet-Me
          </button>
          <button
            onClick={() => {
              try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
              setShowAddModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '11px 18px',
              background: 'rgba(255, 255, 255, 0.16)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            {...getHoverHandlers({
              onEnter: (e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.26)'; },
              onLeave: (e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)'; },
            })}
          >
            Add Recipient
          </button>
          <button
            onClick={() => {
              // Rollback-controlled migration: VITE_IMPORT_WIZARD_ENTRY==="true" routes to the new
              // Import Wizard; unset/false keeps the legacy CSVImport modal. Manual Add Recipient
              // and the CSVImport component both remain fully available regardless of the flag.
              if (import.meta.env.VITE_IMPORT_WIZARD_ENTRY === 'true') navigate('/dashboard/import-wizard');
              else setShowImportModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '11px 18px',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            {...getHoverHandlers({
              onEnter: (e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'; },
              onLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
            })}
          >
            Import Contacts
          </button>
        </div>
      </div>

      {/* Gift Presentation Panel — premium cream/gold "Complete the Moment".
          Pure CSS + inline SVG (no assets). Decorative only: no CTA, no click. */}
      {/* Cinematic gift moment — premium product-photograph treatment.
          Ivory box · crimson satin bow · gold foil · lifted lid · paper texture ·
          soft vignette. Inline SVG only; decorative, no CTA, no interaction. */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        marginTop: isMobile ? '2rem' : '2.5rem',
        marginBottom: isMobile ? '2rem' : '2.5rem',
        padding: isMobile ? '2.5rem 1.75rem' : '3.25rem 3rem',
        background: 'radial-gradient(75% 55% at 32% 18%, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0) 55%), linear-gradient(165deg, #fdfbf5 0%, #f7f1e6 55%, #efe7d6 100%)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid rgba(150, 120, 70, 0.22)',
        boxShadow: '0 22px 50px rgba(74, 51, 20, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.85), inset 0 0 90px rgba(74, 51, 20, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {/* Luxurious paper grain — inline SVG turbulence, desaturated, very restrained */}
        <svg aria-hidden="true" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06, mixBlendMode: 'multiply', pointerEvents: 'none', zIndex: 0 }}>
          <filter id="paperGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="n" />
            <feColorMatrix in="n" type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#paperGrain)" />
        </svg>

        {/* Hero gift carousel — founder-approved imagery, cross-fade only,
            auto-rotate (4.5s), pause on hover. No arrows/dots/controls. */}
        <div
          onMouseEnter={() => { giftPausedRef.current = true; }}
          onMouseLeave={() => { giftPausedRef.current = false; }}
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: isMobile ? '260px' : '360px',
            height: isMobile ? '180px' : '240px',
          }}
        >
          {GIFT_IMAGES.map((img, i) => (
            <img
              key={i}
              src={img.src}
              alt={i === giftIndex ? img.alt : ''}
              aria-hidden={i === giftIndex ? undefined : 'true'}
              loading="lazy"
              decoding="async"
              draggable="false"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                opacity: i === giftIndex ? 1 : 0,
                transition: 'opacity 600ms ease-in-out',
                pointerEvents: 'none'
              }}
            />
          ))}
        </div>

        {/* Title */}
        <p style={{
          position: 'relative',
          zIndex: 1,
          fontSize: isMobile ? '1.375rem' : '1.75rem',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: '#4e3b28',
          margin: isMobile ? '1.75rem 0 0 0' : '2rem 0 0 0'
        }}>
          Complete the Moment
        </p>

        {/* Body — two sentences; line break between them aids readability */}
        <p style={{
          position: 'relative',
          zIndex: 1,
          fontSize: isMobile ? '0.9375rem' : '1rem',
          lineHeight: 1.7,
          color: '#8a7a63',
          maxWidth: '30rem',
          margin: isMobile ? '0.75rem 0 0 0' : '1rem 0 0 0'
        }}>
          Remember to add a thoughtful Greet-Me gift.
        </p>
        <p style={{
          position: 'relative',
          zIndex: 1,
          fontSize: isMobile ? '0.9375rem' : '1rem',
          lineHeight: 1.7,
          color: '#8a7a63',
          maxWidth: '30rem',
          margin: isMobile ? '0.5rem 0 0 0' : '0.6rem 0 0 0'
        }}>
          Choose from QR Cash, Greet-Me Gift Cards, flowers, gift boxes, Americana, or branded corporate gifts to make every Greet-Me truly unforgettable.
        </p>
      </div>

      {/* Alert */}
      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Premium workspace container — unifies tabs, search, filters, recipient
          list, and upcoming occasions in one surface. Layout/functionality within
          is unchanged. */}
      <div style={{
        padding: 0
      }}>
      {/* Side-by-side workspace — Recipients | Upcoming Occasions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* ── LEFT PANEL · Recipients ─────────────────────────── */}
        <div style={PANEL_STYLE}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Users size={18} style={{ color: '#667eea', flexShrink: 0 }} />
            <h3 style={PANEL_TITLE}>Recipients</h3>
            {/* Premium CTA — reuses the existing Add Recipient handler; no new behavior */}
            <button
              onClick={() => {
                try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
                setShowAddModal(true);
              }}
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 22px',
                background: 'linear-gradient(135deg, #6d74ee 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(76, 61, 143, 0.28)',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              {...getHoverHandlers({
                onEnter: (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(76, 61, 143, 0.36)'; },
                onLeave: (e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(76, 61, 143, 0.28)'; },
              })}
            >
              + Add Recipient
            </button>
          </div>

          {/* Search — Spotlight-style inset surface */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Find someone…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
              style={{ width: '100%', padding: '12px 16px 12px 44px', border: '1px solid transparent', borderRadius: 'var(--radius-xl)', fontSize: '0.9375rem', fontFamily: 'inherit', background: 'rgba(15, 23, 42, 0.035)', color: 'var(--text-primary)', outline: 'none', transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s' }}
              onFocus={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.35)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.12)'; }}
              onBlur={(e) => { e.currentTarget.style.background = 'rgba(15, 23, 42, 0.035)'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Recipient list — fixed-height internal scroll */}
          {filteredRecipients.length === 0 ? (
            <div style={{ ...PANEL_VIEWPORT, overflowY: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.01em' }}>{searchTerm ? `No one matches “${searchTerm}”` : 'No people yet'}</p>
              <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>{searchTerm ? 'Try a different name or email.' : 'Add someone you care about.'}</p>
            </div>
          ) : (
            <div style={PANEL_VIEWPORT}>
              {filteredRecipients.map((contact) => {
                const primaryOcc = (contact.occasions || []).filter(o => o.date).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
                return (
                  <div
                    key={contact.id}
                    style={{ padding: '14px', marginBottom: '10px', border: '1px solid rgba(15, 23, 42, 0.05)', borderRadius: '16px', background: '#ffffff', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)', transition: `box-shadow 0.2s ${EASE}, border-color 0.2s ${EASE}, transform 0.2s ${EASE}` }}
                    {...getHoverHandlers({
                      onEnter: (e) => { e.currentTarget.style.boxShadow = '0 12px 28px rgba(76, 61, 143, 0.14)'; e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.35)'; e.currentTarget.style.transform = reduceMotion ? 'none' : 'translateY(-2px)'; },
                      onLeave: (e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.05)'; e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.05)'; e.currentTarget.style.transform = 'translateY(0)'; },
                    })}
                  >
                    {/* Identity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: contact.avatar ? `url(${contact.avatar}) center/cover` : `radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.30) 0%, rgba(255, 255, 255, 0) 46%), ${avatarGradient(contact.name)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.125rem', textShadow: contact.avatar ? 'none' : '0 1px 2px rgba(20, 14, 40, 0.28)', flexShrink: 0, boxShadow: '0 0 0 3px #fffdf9, 0 4px 12px rgba(20, 14, 40, 0.22)' }}>
                        {!contact.avatar && contact.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem', letterSpacing: '-0.01em', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.name}</div>
                        {contact.relationship && (
                          <span style={{ display: 'inline-block', marginTop: '4px', background: 'rgba(102, 126, 234, 0.10)', color: '#5a4fcf', padding: '2px 10px', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'capitalize' }}>{contact.relationship}</span>
                        )}
                      </div>
                    </div>

                    {/* Primary occasion — nearest scheduled date */}
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-secondary)', fontSize: '0.8125rem', minWidth: 0 }}>
                      {primaryOcc ? (
                        <>
                          <span style={{ fontSize: '0.9375rem', flexShrink: 0 }}>{getOccasionIcon(primaryOcc.type)}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getOccasionLabel(primaryOcc.type)} · {new Date(primaryOcc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>No occasions yet</span>
                      )}
                    </div>

                    {/* Actions — Send / Edit / Delete (always visible) */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
                      <button
                        onClick={() => navigate(`/dashboard/send?contactId=${contact._id || contact.id}`)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0 12px', height: '40px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit', boxShadow: '0 2px 6px rgba(34, 197, 94, 0.28)' }}
                        {...getHoverHandlers({ onEnter: (e) => { e.currentTarget.style.background = '#16a34a'; }, onLeave: (e) => { e.currentTarget.style.background = '#22c55e'; } })}
                      >
                        <Send size={14} />
                        Send
                      </button>
                      <button
                        onClick={() => openEditModal(contact)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0 12px', height: '40px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(15, 23, 42, 0.12)', borderRadius: 'var(--radius-lg)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' }}
                        {...getHoverHandlers({ onEnter: (e) => { e.currentTarget.style.background = 'rgba(102, 126, 234, 0.08)'; e.currentTarget.style.color = '#5a4fcf'; e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.40)'; }, onLeave: (e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.12)'; } })}
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(contact)}
                        title="Delete"
                        aria-label="Delete recipient"
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', padding: 0, background: 'transparent', color: 'var(--text-tertiary)', border: '1px solid rgba(15, 23, 42, 0.10)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'all 0.2s' }}
                        {...getHoverHandlers({ onEnter: (e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#dc2626'; }, onLeave: (e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.10)'; } })}
                        onFocus={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#dc2626'; }}
                        onBlur={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.10)'; }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL · Upcoming Occasions ────────────────── */}
        <div style={PANEL_STYLE}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Clock size={18} style={{ color: '#667eea', flexShrink: 0 }} />
            <h3 style={PANEL_TITLE}>Upcoming Occasions</h3>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Find an occasion…"
              value={occasionSearch}
              onChange={(e) => setOccasionSearch(e.target.value)}
              autoComplete="off"
              style={{ width: '100%', padding: '12px 16px 12px 44px', border: '1px solid transparent', borderRadius: 'var(--radius-xl)', fontSize: '0.9375rem', fontFamily: 'inherit', background: 'rgba(15, 23, 42, 0.035)', color: 'var(--text-primary)', outline: 'none', transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s' }}
              onFocus={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.35)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.12)'; }}
              onBlur={(e) => { e.currentTarget.style.background = 'rgba(15, 23, 42, 0.035)'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Category tiles — fixed order, always present; real data or an invitation to schedule */}
          <div style={{ ...PANEL_VIEWPORT, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {OCCASION_CATEGORIES.map((cat) => {
              const items = allOccasions.filter(o => o.date && cat.match(o.type));
              const soonest = items[0];
              return (
                <div
                  key={cat.key}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', background: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.05)', borderRadius: '16px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)', transition: `box-shadow 0.2s ${EASE}, transform 0.2s ${EASE}` }}
                  {...getHoverHandlers({ onEnter: (e) => { e.currentTarget.style.boxShadow = '0 12px 28px rgba(76, 61, 143, 0.14)'; e.currentTarget.style.transform = reduceMotion ? 'none' : 'translateY(-2px)'; }, onLeave: (e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.05)'; e.currentTarget.style.transform = 'translateY(0)'; } })}
                >
                  <span aria-hidden="true" style={{ flexShrink: 0, width: '34px', height: '34px', borderRadius: '50%', background: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.0625rem' }}>{cat.icon}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem', letterSpacing: '-0.005em' }}>{cat.label}</div>
                    {soonest ? (
                      <>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {soonest.recipientName} · {new Date(soonest.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        {items.length > 1 && (
                          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '2px' }}>+{items.length - 1} more</div>
                        )}
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', flexWrap: 'wrap' }}>
                        <span style={{ padding: '3px 9px', borderRadius: '9999px', background: 'rgba(102, 126, 234, 0.10)', color: '#5a4fcf', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Ready to Automate</span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>Schedule the love.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Closing brand tile */}
            <div style={{ marginTop: '2px', padding: '18px 16px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.06) 0%, rgba(118, 75, 162, 0.06) 100%)', border: '1px solid rgba(102, 126, 234, 0.12)', textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>Moments are better shared.</p>
              <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.5 }}>Add dates and Greet-Me will take care of the rest.</p>
              <p style={{ margin: '8px 0 0', color: '#5a4fcf', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.02em' }}>Schedule the love.</p>
            </div>
          </div>
        </div>
      </div>
      </div>
      {/* End premium workspace container */}
      </div>
      {/* End premium page shell */}

      {/* Add Recipient Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
        }}
        title="Add New Recipient"
        size="lg"
      >
        <ContactForm
          onSubmit={handleAddRecipient}
          onCancel={() => {
            setShowAddModal(false);
            try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
          }}
        />
      </Modal>

      {/* Edit Recipient Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingContact(null);
        }}
        title="Edit Recipient"
        size="lg"
      >
        <ContactForm
          contact={editingContact}
          onSubmit={handleEditRecipient}
          onCancel={() => {
            setShowEditModal(false);
            setEditingContact(null);
          }}
        />
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Recipients from CSV"
        size="lg"
      >
        <CSVImport
          onImport={handleImportRecipients}
          onCancel={() => setShowImportModal(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Recipient"
          size="sm"
        >
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9375rem' }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '10px 24px',
                  background: 'var(--gray-100)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRecipient(deleteConfirm.id)}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
