// src/pages/Contacts.jsx
import { useState, useEffect, useRef } from 'react';
import { Plus, Upload, Search, Edit, Trash2, ArrowLeft, Users, Calendar, Gift, Clock, Send } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from "../api/api";
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

export default function Recipients() {
  const navigate = useNavigate();
  const location = useLocation();
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
    !searchTerm ||
    occ.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    occ.recipientName?.toLowerCase().includes(searchTerm.toLowerCase())
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
        padding: isMobile ? '26px 20px' : '40px',
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
            onClick={() => setShowImportModal(true)}
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
        padding: isMobile ? '3rem 1.75rem' : '4rem 3rem',
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

        {/* Body */}
        <p style={{
          position: 'relative',
          zIndex: 1,
          fontSize: isMobile ? '0.9375rem' : '1rem',
          lineHeight: 1.7,
          color: '#8a7a63',
          maxWidth: '30rem',
          margin: isMobile ? '0.75rem 0 0 0' : '1rem 0 0 0'
        }}>
          Add a thoughtful gift, QR Cash™, flowers, or other surprises to make every Greet-Me unforgettable.
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
      {/* View Toggle and Search - only when recipients exist */}
      {recipients.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          {/* View Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{
              display: 'inline-flex',
              background: 'rgba(15, 23, 42, 0.04)',
              borderRadius: '9999px',
              padding: '5px'
            }}>
              <button
                onClick={() => setViewMode('recipients')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  background: viewMode === 'recipients' ? '#ffffff' : 'transparent',
                  color: viewMode === 'recipients' ? '#5a4fcf' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  boxShadow: viewMode === 'recipients' ? '0 1px 3px rgba(15, 23, 42, 0.10)' : 'none'
                }}
              >
                <Users size={16} />
                Recipients
              </button>
              <button
                onClick={() => setViewMode('occasions')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  background: viewMode === 'occasions' ? '#ffffff' : 'transparent',
                  color: viewMode === 'occasions' ? '#5a4fcf' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  boxShadow: viewMode === 'occasions' ? '0 1px 3px rgba(15, 23, 42, 0.10)' : 'none'
                }}
              >
                <Calendar size={16} />
                Occasions
              </button>
            </div>
          </div>

          {/* Search — Spotlight-style inset surface */}
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '18px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              placeholder={viewMode === 'recipients' ? "Find someone…" : "Find an occasion…"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
              style={{
                width: '100%',
                padding: '14px 18px 14px 48px',
                border: '1px solid transparent',
                borderRadius: 'var(--radius-xl)',
                fontSize: '1rem',
                fontFamily: 'inherit',
                background: 'rgba(15, 23, 42, 0.035)',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s'
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.35)';
                e.currentTarget.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.12)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.035)';
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
        </div>
      )}

      {viewMode === 'recipients' ? (
        /* Recipients Card List */
        <div>
          {filteredRecipients.length === 0 ? (
            searchTerm
              ? renderEmptyState(Search, `No recipients match "${searchTerm}"`, 'Try a different name or email.')
              : renderEmptyState(Users, 'No people yet', 'Add someone you care about, and Greet-Me will help you remember every moment.')
          ) : (
            <div style={{
              maxHeight: 'min(480px, 50dvh)',
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              background: 'transparent',
              borderRadius: 'var(--radius-lg)',
              padding: '2px'
            }}>
              {filteredRecipients.map((contact) => (
              <div
                key={contact.id}
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  padding: isMobile ? '18px' : '22px 24px',
                  marginBottom: '14px',
                  border: '1px solid rgba(15, 23, 42, 0.05)',
                  borderRadius: '20px',
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
                  transition: `box-shadow 0.2s ${EASE}, transform 0.2s ${EASE}, border-color 0.2s ${EASE}`,
                  gap: isMobile ? '16px' : '18px'
                }}
                {...getHoverHandlers({
                  onEnter: (e) => {
                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(76, 61, 143, 0.14)';
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.35)';
                    e.currentTarget.style.transform = reduceMotion ? 'none' : 'translateY(-2px)';
                  },
                  onLeave: (e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  },
                })}
              >
                {/* Left: Avatar + Name + Relationship */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: isMobile ? 'none' : '0 0 260px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '58px',
                      height: '58px',
                      borderRadius: '50%',
                      background: contact.avatar
                        ? `url(${contact.avatar}) center/cover`
                        : `radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.30) 0%, rgba(255, 255, 255, 0) 46%), ${avatarGradient(contact.name)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '1.375rem',
                      letterSpacing: '0.01em',
                      textShadow: contact.avatar ? 'none' : '0 1px 2px rgba(20, 14, 40, 0.28)',
                      flexShrink: 0,
                      boxShadow: '0 0 0 3px #fffdf9, 0 4px 12px rgba(20, 14, 40, 0.22)',
                      transition: `box-shadow 0.2s ${EASE}`
                    }}
                    {...getHoverHandlers({
                      onEnter: (e) => { e.currentTarget.style.boxShadow = '0 0 0 3px #ffffff, 0 6px 16px rgba(20, 14, 40, 0.30)'; },
                      onLeave: (e) => { e.currentTarget.style.boxShadow = '0 0 0 3px #fffdf9, 0 4px 12px rgba(20, 14, 40, 0.22)'; },
                    })}
                  >
                    {!contact.avatar && contact.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.0625rem', letterSpacing: '-0.01em', marginBottom: '5px', lineHeight: 1.25 }}>
                      {contact.name}
                    </div>
                    {contact.relationship && (
                      <span style={{
                        background: 'rgba(102, 126, 234, 0.10)',
                        color: '#5a4fcf',
                        padding: '3px 11px',
                        borderRadius: '9999px',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        textTransform: 'capitalize'
                      }}>
                        {contact.relationship}
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle: Occasions + Gift */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                  {contact.occasions?.length > 0 && contact.occasions.slice(0, 4).map((occasion, idx) => (
                    <span
                      key={idx}
                      title={getOccasionLabel(occasion.type)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 12px',
                        background: 'rgba(15, 23, 42, 0.04)',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      <span style={{ fontSize: '0.875rem' }}>{getOccasionIcon(occasion.type)}</span>
                      {!isMobile && <span>{getOccasionLabel(occasion.type)}</span>}
                      {occasion.autoSend && <span title="Auto-send enabled" style={{ fontSize: '0.6875rem', color: '#27AE60' }}>⚡</span>}
                    </span>
                  ))}
                  {contact.occasions?.length > 4 && (
                    <span style={{
                      padding: '5px 12px',
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)'
                    }}>
                      +{contact.occasions.length - 4} more
                    </span>
                  )}

                  {/* Positive gift indicator only — no "No gift" negative chip */}
                  {contact.giftSelected && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 12px',
                      background: 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      color: '#92400e',
                      fontWeight: 600
                    }}>
                      🎁 Gift
                    </span>
                  )}
                </div>

                {/* Right: Actions */}
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  justifyContent: isMobile ? 'flex-end' : 'flex-start',
                  flexShrink: 0
                }}>
                  {/* Primary — Send */}
                  <button
                    onClick={() => navigate(`/dashboard/send?contactId=${contact._id || contact.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 18px',
                      minHeight: '44px',
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                      boxShadow: '0 2px 6px rgba(34, 197, 94, 0.28)'
                    }}
                    {...getHoverHandlers({
                      onEnter: (e) => {
                        e.currentTarget.style.background = '#16a34a';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.36)';
                      },
                      onLeave: (e) => {
                        e.currentTarget.style.background = '#22c55e';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(34, 197, 94, 0.28)';
                      },
                    })}
                  >
                    <Send size={14} />
                    Send
                  </button>
                  {/* Quiet secondary — Edit */}
                  <button
                    onClick={() => openEditModal(contact)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 16px',
                      minHeight: '44px',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      border: '1px solid rgba(15, 23, 42, 0.12)',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit'
                    }}
                    {...getHoverHandlers({
                      onEnter: (e) => {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.08)';
                        e.currentTarget.style.color = '#5a4fcf';
                        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.40)';
                      },
                      onLeave: (e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.12)';
                      },
                    })}
                  >
                    <Edit size={14} />
                    Edit
                  </button>
                  {/* Muted danger — Delete (danger surfaces on hover/focus) */}
                  <button
                    onClick={() => setDeleteConfirm(contact)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '44px',
                      height: '44px',
                      padding: 0,
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                      border: '1px solid rgba(15, 23, 42, 0.10)',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    {...getHoverHandlers({
                      onEnter: (e) => {
                        e.currentTarget.style.background = '#fee2e2';
                        e.currentTarget.style.color = '#dc2626';
                        e.currentTarget.style.borderColor = '#dc2626';
                      },
                      onLeave: (e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-tertiary)';
                        e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.10)';
                      },
                    })}
                    onFocus={(e) => {
                      e.currentTarget.style.background = '#fee2e2';
                      e.currentTarget.style.color = '#dc2626';
                      e.currentTarget.style.borderColor = '#dc2626';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-tertiary)';
                      e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.10)';
                    }}
                    title="Delete"
                    aria-label="Delete recipient"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            </div>
          )}

          {/* Upcoming Occasions Section */}
          <div style={{
            marginTop: '28px',
            padding: '28px',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid rgba(15, 23, 42, 0.05)',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <Clock size={18} style={{ color: '#667eea', flexShrink: 0 }} />
              <h3 style={{
                fontSize: '1.0625rem',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary)',
                margin: 0
              }}>Upcoming Occasions</h3>
            </div>

            {allOccasions.filter(occ => occ.date).length === 0 ? (
              <div style={{
                height: 'min(480px, 50dvh)',
                overflowY: 'hidden',
                overflowX: 'hidden',
                borderRadius: 'var(--radius-lg)',
                padding: '2px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.01em' }}>Ready to automate</p>
                <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.875rem', letterSpacing: '0.01em' }}>Schedule the love.</p>
              </div>
            ) : (
              <div style={{
                height: 'min(480px, 50dvh)',
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
                borderRadius: 'var(--radius-lg)',
                padding: '2px',
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                alignContent: 'start',
                gap: '10px'
              }}>
                {allOccasions.filter(occ => occ.date).map((occ, idx) => (
                  <div
                    key={`upcoming-${occ.contactId}-${occ.type}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '14px 16px',
                      background: '#ffffff',
                      border: '1px solid rgba(15, 23, 42, 0.05)',
                      borderRadius: '16px',
                      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
                      transition: `box-shadow 0.2s ${EASE}, transform 0.2s ${EASE}`
                    }}
                    {...getHoverHandlers({
                      onEnter: (e) => {
                        e.currentTarget.style.boxShadow = '0 12px 28px rgba(76, 61, 143, 0.14)';
                        e.currentTarget.style.transform = reduceMotion ? 'none' : 'translateY(-2px)';
                      },
                      onLeave: (e) => {
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.05)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      },
                    })}
                  >
                    <span aria-hidden="true" style={{
                      flexShrink: 0,
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      border: '1px solid rgba(15, 23, 42, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.0625rem'
                    }}>{getOccasionIcon(occ.type)}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontSize: '0.9375rem',
                        letterSpacing: '-0.005em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>{occ.recipientName}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '1px' }}>{getOccasionLabel(occ.type)}</div>
                    </div>
                    <span style={{
                      flexShrink: 0,
                      padding: '5px 12px',
                      borderRadius: '9999px',
                      background: 'rgba(102, 126, 234, 0.10)',
                      color: '#5a4fcf',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.01em',
                      whiteSpace: 'nowrap'
                    }}>{new Date(occ.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Occasions Card List */
        <div>
          {allOccasions.length === 0 ? (
            searchTerm
              ? renderEmptyState(Search, `No occasions match "${searchTerm}"`, 'Try a different name or occasion.')
              : renderEmptyState(Calendar, 'No occasions scheduled', 'Add a birthday or holiday to a recipient and it will appear here.')
          ) : (
            <div style={{
              maxHeight: 'min(480px, 50dvh)',
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              background: 'transparent',
              borderRadius: 'var(--radius-lg)',
              padding: '2px'
            }}>
              {allOccasions.map((occasion, index) => (
              <div
                key={`${occasion.contactId}-${occasion.type}-${index}`}
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  padding: isMobile ? '18px' : '22px 24px',
                  marginBottom: '14px',
                  border: '1px solid rgba(15, 23, 42, 0.05)',
                  borderRadius: '20px',
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
                  transition: `box-shadow 0.2s ${EASE}, transform 0.2s ${EASE}, border-color 0.2s ${EASE}`,
                  gap: isMobile ? '16px' : '18px'
                }}
                {...getHoverHandlers({
                  onEnter: (e) => {
                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(76, 61, 143, 0.14)';
                    e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.35)';
                    e.currentTarget.style.transform = reduceMotion ? 'none' : 'translateY(-2px)';
                  },
                  onLeave: (e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  },
                })}
              >
                {/* Left: Occasion icon + label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: isMobile ? 'none' : '0 0 180px' }}>
                  <span style={{ fontSize: '1.75rem' }}>{getOccasionIcon(occasion.type)}</span>
                  <div style={{
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                    textTransform: 'capitalize'
                  }}>
                    {getOccasionLabel(occasion.type)}
                  </div>
                </div>

                {/* Date */}
                <div style={{
                  padding: '6px 12px',
                  background: 'var(--gray-100)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 500
                }}>
                  {occasion.date ? new Date(occasion.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  }) : 'Not set'}
                </div>

                {/* Recipient info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                    {occasion.recipientName}
                  </span>
                  <span style={{
                    background: 'linear-gradient(135deg, #ddd6fe 0%, #c7d2fe 100%)',
                    color: '#5b21b6',
                    padding: '2px 10px',
                    borderRadius: '9999px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textTransform: 'capitalize'
                  }}>
                    {occasion.recipientRelationship || '-'}
                  </span>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      )}
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
