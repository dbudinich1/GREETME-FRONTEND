// src/components/ContactForm.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateEmail, getOccasionsByCategory, calculateVaryingOccasionDate, occasionTypes } from '../utils/helpers';
import { getOccasionCadenceLabel } from '../utils/occasionCadence';
import { getPhotoSrc } from '../utils/getPhotoSrc';
import Alert from './Alert';
import FaithBasedOccasionSelector from './FaithBasedOccasionSelector';
import GiftSelectorModal from './GiftSelectorModal';
import { Heart, User, Mail, Info, Plus, Camera, X, Gift, ChevronDown, ChevronUp, DollarSign, ExternalLink, Trash2, Loader2, Calendar, PartyPopper } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { showManualToast } from '../utils/notify';
import { COMMS_CATEGORIES } from '../utils/commsCatalog';
import { relationshipErrors, sanitizeRelationshipForSave } from './contactFormValidation.js';
import { getErrorMessage } from '../utils/errorMessages';
import { formatPersonName } from '../utils/formatPersonName';
import api from '../api/api';
import { SCHEDULED_QRCASH_AVAILABLE, SCHEDULED_QRCASH_UNAVAILABLE_COPY } from '../config/scheduledQrCash';
import { deterministicStructuredForContact } from '../import/completionModel.js';

// Session storage key for preserving form data during gift selection navigation
const FORM_DRAFT_KEY = 'greetme_contact_form_draft';
// Session storage key for scroll position
const FORM_SCROLL_KEY = 'greetme_contact_form_scroll';

// TEAM I — gift types that ship a PHYSICAL parcel and therefore need a delivery address.
// Provider-backed types (Flowers, Gift Boxes) are fulfilled by an external provider via Direct
// Send; the recipient never leaves the Greet-Me experience. Listing them here does NOT make them
// selectable — the gift selector's own option list governs that — it only ensures that WHEN one is
// selected the delivery interface is the existing one, already correct.
export const DELIVERY_REQUIRED_GIFT_TYPES = ['curated', 'flowers', 'gift_boxes'];
export const requiresDeliveryAddress = (giftType) =>
  DELIVERY_REQUIRED_GIFT_TYPES.includes(giftType);

const getInitialFormData = () => ({
  name: '',
  email: '',
  // CONFIRMED delivery names. Never derived from `name`: a shipping label printed from a split of
  // "Dr. Maria de la Cruz" or "The Alvarez Family" is not recoverable. Empty means "not confirmed",
  // and the backend refuses a physical order rather than guessing.
  firstName: '',
  lastName: '',
  gender: '',
  relationshipCategory: '',
  relationship: '',
  relationshipCloseness: '',
  relationshipContext: '',
  relationshipProfile: null,
  occasions: [],
  occasionGiftSettings: {},
  avatar: '',
  memoryPhotos: [],
  coverPhoto: '',
  culturalContext: {
    heritage: [],
    faith: null,
    preferCulturalGifts: false,
  },
  giftPreferences: {
    enabled: false,
    budgetCap: '',
    giftingMode: 'always',
  },
  shippingAddress: {
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
  },
});

// "Cinematic" gift mark: the existing lucide Gift in a brand-gradient disc with a soft glow.
function CinematicGiftIcon() {
  return (
    <span aria-hidden="true" data-testid="cinematic-gift-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, flexShrink: 0, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', boxShadow: '0 0 0 4px rgba(102,126,234,0.14), 0 6px 18px rgba(118,75,162,0.45)' }}>
      <Gift size={22} style={{ color: '#fff' }} strokeWidth={2} />
    </span>
  );
}

export default function ContactForm({ contact, onSubmit, onCancel }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState(getInitialFormData());
  const [selectedFaiths, setSelectedFaiths] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [secularExpanded, setSecularExpanded] = useState(false);
  const [faithSectionExpanded, setFaithSectionExpanded] = useState(false);
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(0); // Track number of photos currently uploading
  // SURFACE 2 (founder-approved — W05 progressive disclosure): Memory Photos and the per-occasion
  // Gift & Delivery block were the two sections still always-expanded, crowding the basic
  // add-contact task. Collapsed by default, same pattern as culturalSectionExpanded/secularExpanded/
  // faithSectionExpanded above. No field removed — only disclosure timing changes.
  const [memoryPhotosExpanded, setMemoryPhotosExpanded] = useState(false);
  // FOUNDER 2026-10-01 (PROPOSED): the Special Occasions section is collapsed by default.
  const [occasionsExpanded, setOccasionsExpanded] = useState(false);
  useEffect(() => { if (errors && errors.occasions) setOccasionsExpanded(true); }, [errors]);
  // FOUNDER round 4 (PROPOSED): the "Add gift" checkbox is a view of the SAME occasionGiftSettings data
  // (checked <=> type !== 'none'); this map only remembers a just-ticked box whose mode is not chosen yet.
  const [addGiftOn, setAddGiftOn] = useState({});

  // Phase 3D Batch B — B.4: three inline `window.innerWidth > 600` reads
  // (gridTemplateColumns at lines 445/525/590) recomputed on render but never
  // updated on resize. Promoted to a single boolean in state with a resize
  // listener. Scope intentionally narrow — no surrounding restructuring.
  const [isWideForm, setIsWideForm] = useState(window.innerWidth > 600);
  useEffect(() => {
    const handleResize = () => setIsWideForm(window.innerWidth > 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ref for the form container - used for scroll restoration
  const formRef = useRef(null);
  // Ref for the first input field - used for auto-focus
  const nameInputRef = useRef(null);

  const occasionCategories = getOccasionsByCategory();

  // Save form data to sessionStorage for persistence during navigation
  // IMPORTANT: Strip memoryPhotos and avatar to prevent quota errors (they can be base64/blob URLs)
  const saveFormDraft = useCallback((data, faiths) => {
    try {
      // Create a safe copy without large binary data
      const safeDraftData = {
        ...data,
        memoryPhotos: [], // Never store photos in draft - they're uploaded to Blob already
        avatar: data.avatar?.startsWith('http') ? data.avatar : '', // Only keep HTTPS URLs
      };
      sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify({
        formData: safeDraftData,
        selectedFaiths: faiths,
        timestamp: Date.now(),
        isEditing: !!contact
      }));
    } catch (e) {
      // Handle quota exceeded by clearing and retrying
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn('sessionStorage quota exceeded, clearing draft');
        try {
          sessionStorage.removeItem(FORM_DRAFT_KEY);
        } catch {}
      } else {
        console.warn('Could not save form draft:', e);
      }
    }
  }, [contact]);

  // Clear form draft from sessionStorage
  const clearFormDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(FORM_DRAFT_KEY);
    } catch (e) {
      console.warn('Could not clear form draft:', e);
    }
  }, []);

  // Save current scroll position before navigating to gift selection
  const saveScrollPosition = useCallback(() => {
    try {
      const modalContent = formRef.current?.closest('.modal-content') || formRef.current?.closest('[class*="modal"]');
      const scrollTop = modalContent ? modalContent.scrollTop : window.scrollY;
      sessionStorage.setItem(FORM_SCROLL_KEY, JSON.stringify({
        scrollTop,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Could not save scroll position:', e);
    }
  }, []);

  // Load saved draft on mount (only if not editing an existing contact)
  useEffect(() => {
    if (!contact) {
      try {
        const saved = sessionStorage.getItem(FORM_DRAFT_KEY);
        if (saved) {
          const draft = JSON.parse(saved);
          // Only restore if draft is less than 30 minutes old and wasn't for editing
          if (draft.timestamp && Date.now() - draft.timestamp < 30 * 60 * 1000 && !draft.isEditing && draft.formData) {
            // Merge with initial form data to ensure all required nested objects exist
            // Note: memoryPhotos intentionally not restored (they're in Blob storage, not draft)
            const restoredData = {
              ...getInitialFormData(),
              ...draft.formData,
              memoryPhotos: [], // Never restore photos from draft - they should be empty
              avatar: draft.formData.avatar?.startsWith('http') ? draft.formData.avatar : '', // Only restore HTTPS URLs
              culturalContext: {
                ...getInitialFormData().culturalContext,
                ...(draft.formData.culturalContext || {})
              },
              giftPreferences: {
                ...getInitialFormData().giftPreferences,
                ...(draft.formData.giftPreferences || {})
              },
              shippingAddress: {
                ...getInitialFormData().shippingAddress,
                ...(draft.formData.shippingAddress || {})
              }
            };
            setFormData(restoredData);
            setSelectedFaiths(draft.selectedFaiths || []);
          } else {
            clearFormDraft();
          }
        }
      } catch (e) {
        console.warn('Could not restore form draft:', e);
        clearFormDraft();
      }
    }
  }, [contact, clearFormDraft]);

  // Restore scroll position after form loads (when returning from gift page)
  // DISABLED: This was causing modal freeze issues
  // useEffect(() => {
  //   try {
  //     const savedScroll = sessionStorage.getItem(FORM_SCROLL_KEY);
  //     if (savedScroll) {
  //       const scrollData = JSON.parse(savedScroll);
  //       if (scrollData.timestamp && Date.now() - scrollData.timestamp < 5 * 60 * 1000) {
  //         setTimeout(() => {
  //           const modalContent = formRef.current?.closest('.modal-content') || formRef.current?.closest('[class*="modal"]');
  //           if (modalContent) {
  //             modalContent.scrollTop = scrollData.scrollTop;
  //           } else if (formRef.current) {
  //             window.scrollTo(0, scrollData.scrollTop);
  //           }
  //         }, 100);
  //       }
  //       sessionStorage.removeItem(FORM_SCROLL_KEY);
  //     }
  //   } catch (e) {
  //     console.warn('Could not restore scroll position:', e);
  //   }
  // }, []);

  // Auto-save form data when it changes
  useEffect(() => {
    // Only auto-save if form has meaningful data (name or email entered)
    if (formData.name || formData.email) {
      saveFormDraft(formData, selectedFaiths);
    }
  }, [formData, selectedFaiths, saveFormDraft]);

  useEffect(() => {
    if (contact) {
      // Compatibility for legacy imported contacts that have a raw `relationship` but no structured
      // fields: show the DETERMINISTIC Type/Relation only (e.g. "colleague" → Professional/Colleague).
      // Display-only — never auto-saves or rewrites; returns null when a category already exists
      // (manual + already-completed contacts hydrate byte-identically). Non-deterministic values and
      // the Description/closeness stay user-confirmed.
      const _det = deterministicStructuredForContact(contact);
      setFormData({
        name: contact.name || '',
        email: contact.email || '',
        // A previously CONFIRMED delivery name is loaded back so the sender confirms once, not
        // every time. Absent stays empty — it is never back-filled from `name`.
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        gender: contact.gender || '',
        relationshipCategory: contact.relationshipCategory || (_det ? _det.relationshipCategory : ''),
        relationship: _det ? _det.relationship : (contact.relationship || ''),
        relationshipCloseness: contact.relationshipCloseness || '',
        relationshipContext: contact.relationshipContext || '',
        relationshipProfile: contact.relationshipProfile || null,
        occasions: contact.occasions || [],
        occasionGiftSettings: contact.occasionGiftSettings || {},
        avatar: contact.avatar || '',
        memoryPhotos: contact.memoryPhotos || [],
        coverPhoto: contact.coverPhoto || '',
        culturalContext: contact.culturalContext || {
          heritage: [],
          faith: null,
          preferCulturalGifts: false,
        },
        giftPreferences: contact.giftPreferences || {
          enabled: false,
          budgetCap: '',
          giftingMode: 'always',
        },
      });

      // Extract selected faiths from occasions
      const occasions = contact.occasions || [];
      const faiths = new Set();
      occasions.forEach(occ => {
        const occasion = [...occasionCategories.christian, ...occasionCategories.jewish, ...occasionCategories.muslim, ...occasionCategories.secular].find(o => o.value === occ.type);
        if (occasion && ['christian', 'jewish', 'muslim', 'secular'].includes(occasion.category)) {
          faiths.add(occasion.category);
        }
      });
      setSelectedFaiths(Array.from(faiths));
    }
  }, [contact]);

  const handleNameBlur = () => {
    setFormData(prev => {
      const formatted = formatPersonName(prev.name);
      if (formatted === prev.name) return prev;
      return { ...prev, name: formatted };
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleOccasionToggle = (occasionValue, fixedDate) => {
    setFormData(prev => {
      const occasions = prev.occasions || [];
      const exists = occasions.find(o => o.type === occasionValue);

      if (exists) {
        return {
          ...prev,
          occasions: occasions.filter(o => o.type !== occasionValue),
        };
      } else {
        const currentYear = new Date().getFullYear();
        let dateValue = '';

        // If occasion has fixed date (like Christmas 12-25), pre-fill it
        if (fixedDate) {
          dateValue = `${currentYear}-${fixedDate}`;
        } else {
          // Try to calculate varying date (Mother's Day, Thanksgiving, etc.)
          const calculatedDate = calculateVaryingOccasionDate(occasionValue, currentYear);
          if (calculatedDate) {
            dateValue = calculatedDate;
          }
        }

        return {
          ...prev,
          occasions: [...occasions, { type: occasionValue, date: dateValue, autoSend: occasionTypes.find(o => o.value === occasionValue)?.recurring !== false }],
        };
      }
    });
  };

  const handleOccasionDateChange = (occasionValue, date) => {
    setFormData(prev => ({
      ...prev,
      occasions: prev.occasions.map(o =>
        o.type === occasionValue ? { ...o, date } : o
      ),
    }));
  };

  // Gift settings helper - default: { type: "none", autoGift: false }
  // autoGift: false = Manual Selection (user must confirm 10 days before)
  // autoGift: true = Auto-Gift Enabled (gift sends automatically)
  const getOccasionGiftSetting = (occasionValue) => {
    return formData.occasionGiftSettings?.[occasionValue] || { type: 'none', autoGift: false };
  };

  const isAddGiftChecked = (occ) => (addGiftOn[occ] !== undefined ? addGiftOn[occ] : getOccasionGiftSetting(occ).type !== 'none');
  // Unticking == choosing "None" in the old dropdown: the very same handleOccasionGiftChange(type, 'none').
  const handleAddGiftToggle = (occ, on) => {
    setAddGiftOn((prev) => ({ ...prev, [occ]: on }));
    if (!on) handleOccasionGiftChange(occ, 'type', 'none');
  };
  // Annual-repeat claim only for occasions flagged yearly-repeating (helpers.js occasionTypes: every occasion
  // repeats unless `recurring: false`, i.e. Graduation / Get Well are one-time).
  const repeatsAnnually = (occ) => getOccasionCadenceLabel(occ) === 'Repeats yearly';
  const renderAddGiftRow = (occ) => {
    const gs = getOccasionGiftSetting(occ);
    const checked = isAddGiftChecked(occ);
    return (
      <div data-testid={`add-gift-row-${occ}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              data-testid={`add-gift-${occ}`}
              checked={checked}
              onChange={(e) => handleAddGiftToggle(occ, e.target.checked)}
              style={{ width: '1.125rem', height: '1.125rem', accentColor: '#8b5cf6' }}
            />
            <Gift size={16} style={{ color: '#059669' }} />
            Add gift
          </label>
          <select
            aria-label="Gift selector"
            data-testid={`gift-selector-${occ}`}
            disabled={!checked}
            value={gs.type === 'none' ? '' : gs.type}
            onChange={(e) => handleOccasionGiftChange(occ, 'type', e.target.value)}
            style={{ flex: '1 1 10rem', minWidth: 0, maxWidth: '16rem', padding: '0.375rem 0.625rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontFamily: 'inherit', background: checked ? 'white' : 'var(--gray-100)', cursor: checked ? 'pointer' : 'not-allowed' }}
          >
            <option value="" disabled>Choose a gift...</option>
            <option value="qrcash">QR Cash{'\u2122'}</option>
            <option value="merch">Branded Goods</option>
            <option value="curated">Let Greet-Me select a gift</option>
            <option value="marketplace">Browse Marketplace</option>
          </select>
        </div>
        {checked && repeatsAnnually(occ) && (
          <small data-testid={`add-gift-repeat-${occ}`} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Your gift selection will automatically repeat annually until changed.
          </small>
        )}
      </div>
    );
  };

  // Scheduled QR Cash is not live (src/config/scheduledQrCash.js): a QR Cash gift is sent when the sender sends the
  // Greet-Me, never automatically on the occasion date. The inline Auto-Gift toggle must therefore be off/disabled.
  const qrCashManualOnly = (gs) => gs?.type === 'qrcash' && !SCHEDULED_QRCASH_AVAILABLE;
  // The amount <select> DISPLAYS $25 when no amount is stored; write that default so the form never shows a
  // figure it does not send.
  const QRCASH_DEFAULT_DOLLARS = 25;

  const handleOccasionGiftChange = (occasionValue, field, value) => {
    setFormData(prev => {
      const current = getOccasionGiftSetting(occasionValue);
      const next = { ...current, [field]: value };
      if (field === 'type' && value === 'qrcash' && (next.amount === undefined || next.amount === null)) {
        next.amount = QRCASH_DEFAULT_DOLLARS;
      }
      return {
        ...prev,
        occasionGiftSettings: {
          ...prev.occasionGiftSettings,
          [occasionValue]: next
        }
      };
    });
  };

  // Save-path normalisation (see qrCashManualOnly): every qrcash entry saves with autoGift:false while scheduled QR Cash
  // is unavailable, and with the amount the form displays. Other gift types are passed through untouched.
  const normalizeGiftSettingsForSave = (settings) => {
    if (!settings || typeof settings !== 'object') return settings;
    const out = {};
    for (const [key, gs] of Object.entries(settings)) {
      if (gs && gs.type === 'qrcash' && !SCHEDULED_QRCASH_AVAILABLE) {
        out[key] = { ...gs, autoGift: false, amount: gs.amount === undefined || gs.amount === null ? QRCASH_DEFAULT_DOLLARS : gs.amount };
      } else {
        out[key] = gs;
      }
    }
    return out;
  };

  const handleFaithSelectionChange = (newSelectedFaiths) => {
    // Phase 3D Batch H H12+H13 — diff-based reconciliation. Replaces the
    // prior full-rebuild logic so untouched occasions preserve their autoSend
    // and date edits, removed faiths remove ONLY their own occasions, and
    // toggling secular does not rebuild unrelated faith occasions. Orphan
    // occasions (types not in any category) are intentionally preserved to
    // avoid silent data loss for legacy/deprecated saved contact data.
    const addedFaiths = newSelectedFaiths.filter(f => !selectedFaiths.includes(f));
    const removedFaiths = selectedFaiths.filter(f => !newSelectedFaiths.includes(f));

    setSelectedFaiths(newSelectedFaiths);

    if (addedFaiths.length === 0 && removedFaiths.length === 0) return;

    setFormData(prev => {
      const currentOccasions = prev.occasions || [];

      const removedOccasionTypes = new Set();
      removedFaiths.forEach(faithId => {
        (occasionCategories[faithId] || []).forEach(o => removedOccasionTypes.add(o.value));
      });

      const preservedOccasions = currentOccasions.filter(occ => !removedOccasionTypes.has(occ.type));

      const existingTypes = new Set(preservedOccasions.map(o => o.type));
      const currentYear = new Date().getFullYear();
      const newOccasions = [];
      addedFaiths.forEach(faithId => {
        (occasionCategories[faithId] || []).forEach(occasion => {
          if (existingTypes.has(occasion.value)) return;
          newOccasions.push({
            type: occasion.value,
            date: occasion.fixedDate ? `${currentYear}-${occasion.fixedDate}` : '',
            autoSend: true
          });
          existingTypes.add(occasion.value);
        });
      });

      return {
        ...prev,
        occasions: [...preservedOccasions, ...newOccasions]
      };
    });
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Relationship is OPTIONAL (guarded): a fully blank relationship is valid so an imported
    // blank-relationship contact can save unrelated edits. Once a group or specific relationship is
    // started, the pair + closeness become required. Closeness-alone is stripped on save (never persisted).
    Object.assign(newErrors, relationshipErrors(formData));

    // Validate that all selected occasions have dates
    if (formData.occasions && formData.occasions.length > 0) {
      const occasionsWithoutDates = formData.occasions.filter(occ => !occ.date || occ.date.trim() === '');
      if (occasionsWithoutDates.length > 0) {
        newErrors.occasions = `Please provide dates for all selected occasions`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    try {
      const toSave = sanitizeRelationshipForSave(formData);
      await onSubmit({ ...toSave, occasionGiftSettings: normalizeGiftSettingsForSave(toSave.occasionGiftSettings) });
      // Clear draft on successful submission
      clearFormDraft();
      // Show saved toast
      showManualToast('Saved ✓', 'Recipient settings have been saved.', COMMS_CATEGORIES.PROFILE);
    } catch (error) {
      setErrors({ submit: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOccasions = formData.occasions?.map(o => o.type) || [];

  return (
    <>
    <form ref={formRef} onSubmit={handleSubmit} className="gm-cf" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gm-section-gap)', '--gm-section-gap': '1.5rem', '--gm-inner-gap': '1rem' }}>
      {/* FOUNDER round 3 (PROPOSED): ONE section gap (1.5rem) and ONE inner gap (1rem), identical on desktop
          and mobile. Child margins are neutralised so the rhythm is uniform; cards get a brand-token border
          and depth. */}
      <style>{`
        .gm-cf > * { margin-top: 0 !important; margin-bottom: 0 !important; }
        .gm-cf > div { border: 1px solid rgba(99,102,241,0.30) !important; box-shadow: 0 12px 28px -16px rgba(79,70,229,0.50), var(--shadow-sm) !important; }
        .gm-cf > div[data-testid="gift-banner"] { border: 1px solid #d97706 !important; box-shadow: 0 10px 24px -14px rgba(180,83,9,0.55) !important; }
        .gm-cf > div[data-testid="contact-form-footer"] { border: none !important; box-shadow: none !important; border-top: 1px solid rgba(99,102,241,0.30) !important; }
      `}</style>
      {errors.submit && <Alert type="error" message={errors.submit} />}

      {/* Contact Information */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
      }}>
        <h3 style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1.25rem'
        }}>
          <User size={18} style={{ color: '#667eea' }} />
          <span>Contact Information</span>
        </h3>

        {/* Two-column layout on desktop */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isWideForm ? '1fr 1fr' : '1fr',
          gap: '1rem'
        }}>
          {/* Name */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.375rem'
            }}>
              Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              onBlur={handleNameBlur}
              autoComplete="off"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                border: errors.name ? '1.5px solid #ef4444' : '1.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontFamily: 'inherit',
                background: 'white',
                transition: 'border-color 0.2s'
              }}
              placeholder="John Doe"
            />
            {errors.name && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#ef4444' }}>{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.375rem'
            }}>
              Email <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)'
              }} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="off"
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem 0.625rem 2.25rem',
                  border: errors.email ? '1.5px solid #ef4444' : '1.5px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  background: 'white',
                  transition: 'border-color 0.2s'
                }}
                placeholder="john@example.com"
              />
            </div>
            {errors.email && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#ef4444' }}>{errors.email}</p>}
          </div>

          {/* Gender - spans both columns on desktop */}
          <div style={{ gridColumn: isWideForm ? 'span 2' : 'span 1' }}>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.375rem'
            }}>
              Gender
            </label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              style={{
                width: '100%',
                maxWidth: '200px',
                padding: '0.625rem 0.875rem',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontFamily: 'inherit',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <p style={{
              marginTop: '0.25rem',
              fontSize: '0.6875rem',
              color: 'var(--text-tertiary)'
            }}>
              Helps us filter relevant occasions (e.g., hide Mother's Day for males)
            </p>
          </div>
        </div>
      </div>

      {/* Relationship Information */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
      }}>
        <h3 style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1.25rem'
        }}>
          <Heart size={18} style={{ color: '#ec4899' }} fill="#ec4899" />
          <span>Relationship Context</span>
        </h3>

        {/* 3 Cascading Relationship Dropdowns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isWideForm ? '1fr 1fr 1fr' : '1fr',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          {/* Dropdown 1: Category */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.375rem'
            }}>
              Type
            </label>
            <select
              name="relationshipCategory"
              value={formData.relationshipCategory || ''}
              onChange={(e) => {
                const value = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  relationshipCategory: value,
                  relationship: '', // Reset specific role when category changes
                  relationshipProfile: null
                }));
                if (errors.relationship) {
                  setErrors(prev => ({ ...prev, relationship: '' }));
                }
              }}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                border: errors.relationship && !formData.relationshipCategory ? '1.5px solid #ef4444' : '1.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontFamily: 'inherit',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="">Select...</option>
              <option value="family">Family</option>
              <option value="friend">Friend</option>
              <option value="professional">Professional</option>
            </select>
          </div>

          {/* Dropdown 2: Specific Role (depends on Category) */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.375rem'
            }}>
              Relation
            </label>
            <select
              name="relationship"
              value={formData.relationship || ''}
              onChange={(e) => {
                const value = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  relationship: value,
                  relationshipProfile: value ? {
                    group: prev.relationshipCategory,
                    role: value,
                    roleLabel: value,
                    closeness: prev.relationshipCloseness || ''
                  } : null
                }));
                if (errors.relationship) {
                  setErrors(prev => ({ ...prev, relationship: '' }));
                }
              }}
              disabled={!formData.relationshipCategory}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                border: errors.relationship && formData.relationshipCategory && !formData.relationship ? '1.5px solid #ef4444' : '1.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontFamily: 'inherit',
                background: !formData.relationshipCategory ? 'var(--gray-100)' : 'white',
                cursor: formData.relationshipCategory ? 'pointer' : 'not-allowed',
                color: !formData.relationshipCategory ? 'var(--text-tertiary)' : 'inherit'
              }}
            >
              <option value="">Select...</option>
              {formData.relationshipCategory === 'family' && (
                <>
                  <option value="family_member">Family Member</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="child">Child</option>
                  <option value="grandparent">Grandparent</option>
                  <option value="grandchild">Grandchild</option>
                  <option value="aunt_uncle">Aunt/Uncle</option>
                  <option value="cousin">Cousin</option>
                  <option value="nephew">Nephew</option>
                  <option value="niece">Niece</option>
                  <option value="godson">Godson</option>
                  <option value="goddaughter">Goddaughter</option>
                  <option value="spouse">Spouse</option>
                  <option value="partner">Partner</option>
                  <option value="fiancee">Fiancee</option>
                  <option value="in_law">In-Law</option>
                </>
              )}
              {formData.relationshipCategory === 'friend' && (
                <>
                  {/* W06 (PROPOSED, NOT APPLIED): "Friend" under Type=Friend duplicates the Type. Removing it must be
                      done TOGETHER with completionModel.js (taxonomyLock.test.mjs requires ContactForm and the
                      Import Wizard vocabularies to match exactly), so the option is kept here until the
                      paired change is approved - see requests/T1A-completionModel.md. */}
                  <option value="best_friend">Best Friend</option>
                  <option value="close_friend">Close Friend</option>
                  <option value="friend">Friend</option>
                  <option value="acquaintance">Acquaintance</option>
                  <option value="neighbor">Neighbor</option>
                  <option value="teammate">Teammate</option>
                  <option value="classmate">Classmate</option>
                </>
              )}
              {formData.relationshipCategory === 'professional' && (
                <>
                  <option value="colleague">Colleague</option>
                  <option value="mentor">Mentor</option>
                  <option value="mentee">Mentee</option>
                  <option value="boss">Boss</option>
                  <option value="employee">Employee</option>
                  <option value="client">Client</option>
                  <option value="vendor">Vendor</option>
                  <option value="business_partner">Business Partner</option>
                </>
              )}
            </select>
          </div>

          {/* Dropdown 3: Closeness Level */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.375rem'
            }}>
              Description
            </label>
            <select
              name="relationshipCloseness"
              value={formData.relationshipCloseness || ''}
              onChange={(e) => {
                const value = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  relationshipCloseness: value,
                  relationshipProfile: prev.relationshipProfile ? {
                    ...prev.relationshipProfile,
                    closeness: value
                  } : null
                }));
                if (errors.relationshipCloseness) {
                  setErrors(prev => ({ ...prev, relationshipCloseness: '' }));
                }
              }}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                border: errors.relationshipCloseness ? '1.5px solid #ef4444' : '1.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontFamily: 'inherit',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="">Select...</option>
              <option value="inner_circle">Inner Circle</option>
              <option value="greetme_worthy">Greet-Me Worthy</option>
              <option value="obligatory">You Gotta Do What Ya Gotta Do</option>
            </select>
            {errors.relationshipCloseness && (
              <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#ef4444' }}>
                {errors.relationshipCloseness}
              </p>
            )}
          </div>
        </div>

        {/* Combined validation error */}
        {errors.relationship && (
          <p style={{ marginTop: '-0.5rem', marginBottom: '1rem', fontSize: '0.75rem', color: '#ef4444' }}>
            {errors.relationship}
          </p>
        )}
      </div>

      {/* FOUNDER 2026-10-01 (PROPOSED): the "Cultural & Personal Context" section is removed from the form.
          NOT removed: formData.culturalContext (heritage, faith, preferCulturalGifts) is still initialised,
          restored from drafts, loaded from the contact and submitted unchanged, because the backend PUT
          writes `culturalContext || {}` and would blank stored values if the field were omitted. */}

      {/* Memory Photos - Media Library Style - Collapsible (W05 progressive disclosure) */}
      <div style={{
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header - Always Visible */}
        <button
          type="button"
          onClick={() => setMemoryPhotosExpanded(!memoryPhotosExpanded)}
          style={{
            width: '100%',
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, #eef2ff 0%, #fdf2f8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
            <Camera size={18} style={{ color: 'var(--primary-dark)', flexShrink: 0 }} />
            <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
              <h3 data-testid="moments-heading" style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--gray-900)',
                margin: 0,
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                wordBreak: 'normal'
              }}>
                MOMENTS : ADD IMAGES TO MAKE YOUR GREET-ME UNFORGETTABLE
              </h3>
            </div>
          </div>
          {memoryPhotosExpanded ? (
            <ChevronUp size={20} style={{ color: 'var(--primary-dark)', flexShrink: 0 }} />
          ) : (
            <ChevronDown size={20} style={{ color: 'var(--primary-dark)', flexShrink: 0 }} />
          )}
        </button>

        {/* Collapsible Content */}
        {memoryPhotosExpanded && (
        <div style={{
          padding: '1.25rem 1.5rem',
          background: 'var(--bg-primary)',
          borderTop: '1px solid var(--border)',
          overflowWrap: 'anywhere'
        }}>
        <p style={{
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
          marginBottom: '1rem'
        }}>
          Add images below. These images will be presented inside your sent Greet-Me.
        </p>

        {/* Default Photo (user's greeting photo) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem',
          background: 'var(--gray-50)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1rem',
          border: '1px solid var(--border)'
        }}>
          {user?.photoUrl ? (
            <img
              src={user.photoUrl}
              alt="Profile Photo"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--border)',
                flexShrink: 0
              }}
            />
          ) : (
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--gray-200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Camera size={20} style={{ color: 'var(--gray-400)' }} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Profile Photo
            </p>
            {user?.photoUrl ? (
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', margin: '0.125rem 0 0 0' }}>
                Appears in greetings you send
              </p>
            ) : (
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', margin: '0.125rem 0 0 0' }}>
                <button
                  type="button"
                  onClick={() => navigate('/media-library')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.6875rem',
                    textDecoration: 'underline'
                  }}
                >
                  Upload one
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Photo Grid - Media Library Layout - PHASE 3: Fixed size grid with internal scroll */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: '0.75rem',
          maxHeight: '240px',
          overflowY: 'auto',
          padding: '0.25rem'
        }}>
          {/* Default Photo Slot (only show when avatar exists) */}
          {formData.avatar && (
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'relative',
                paddingBottom: '100%',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '3px solid #22c55e',
                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.25)'
              }}>
                <img
                  src={formData.avatar}
                  alt="Profile Photo"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    cursor: 'pointer'
                  }}
                  onClick={() => window.open(formData.avatar, '_blank')}
                  title="Profile photo - Click to enlarge"
                />
                {/* Default badge */}
                <div style={{
                  position: 'absolute',
                  bottom: '4px',
                  left: '4px',
                  background: '#22c55e',
                  color: 'white',
                  fontSize: '0.5625rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em'
                }}>
                  Default
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, avatar: '' }))}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '24px',
                  height: '24px',
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: 'var(--gray-500)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fee2e2';
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.color = 'var(--gray-500)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
                title="Remove photo"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          {/* Memory Photos */}
          {formData.memoryPhotos.map((photo, index) => (
            <div key={index} style={{ position: 'relative' }}>
              <div style={{
                position: 'relative',
                paddingBottom: '100%',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--border)'
              }}>
                <img
                  src={getPhotoSrc(photo)}
                  alt={`Memory ${index + 1}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    cursor: 'pointer'
                  }}
                  onClick={() => window.open(getPhotoSrc(photo), '_blank')}
                  title="Click to enlarge"
                />
                {/* Set as default button on hover */}
                {!formData.avatar && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({
                        ...prev,
                        avatar: getPhotoSrc(photo),
                        memoryPhotos: prev.memoryPhotos.filter((_, i) => i !== index)
                      }));
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      left: '4px',
                      background: 'rgba(34, 197, 94, 0.9)',
                      color: 'white',
                      fontSize: '0.5625rem',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Set Default
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    memoryPhotos: prev.memoryPhotos.filter((_, i) => i !== index)
                  }));
                }}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '24px',
                  height: '24px',
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: 'var(--gray-500)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fee2e2';
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                  e.currentTarget.style.color = 'var(--gray-500)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
                title="Remove photo"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {/* Add More Photos Button */}
          <label style={{ cursor: uploadingPhotos > 0 ? 'wait' : 'pointer' }}>
            <input
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              disabled={uploadingPhotos > 0}
              onChange={async (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;

                // Validate all files first
                for (const file of files) {
                  if (file.size > 5 * 1024 * 1024) {
                    showManualToast('Error', 'Each image must be less than 5MB', COMMS_CATEGORIES.PROFILE);
                    return;
                  }
                }

                // Upload each file to Blob storage
                setUploadingPhotos(files.length);
                const contactId = contact?.id || null;

                for (const file of files) {
                  try {
                    const result = await api.uploadContactMemoryPhoto(contactId, file);
                    if (result.ok && result.blobUrl) {
                      // Store as object with url property (required by sanitizer)
                      setFormData(prev => ({
                        ...prev,
                        memoryPhotos: [...prev.memoryPhotos, { url: result.blobUrl }]
                      }));
                    } else {
                      showManualToast('Upload failed', 'Could not upload photo', COMMS_CATEGORIES.PROFILE);
                    }
                  } catch (err) {
                    console.error('Photo upload error:', err);
                    showManualToast('Upload failed', getErrorMessage(err), COMMS_CATEGORIES.PROFILE);
                  } finally {
                    setUploadingPhotos(prev => Math.max(0, prev - 1));
                  }
                }

                // Clear the input so the same file can be selected again
                e.target.value = '';
              }}
            />
            <div style={{
              position: 'relative',
              paddingBottom: '100%',
              borderRadius: 'var(--radius-md)',
              border: `2px dashed ${uploadingPhotos > 0 ? '#9ca3af' : '#3b82f6'}`,
              background: uploadingPhotos > 0 ? '#f3f4f6' : '#eff6ff',
              overflow: 'hidden',
              transition: 'all 0.2s',
              opacity: uploadingPhotos > 0 ? 0.7 : 1
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: uploadingPhotos > 0 ? '#9ca3af' : '#3b82f6'
              }}>
                {uploadingPhotos > 0 ? (
                  <>
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '0.625rem', fontWeight: 600, marginTop: '0.125rem' }}>
                      {uploadingPhotos > 1 ? `${uploadingPhotos}...` : 'Uploading...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Plus size={24} />
                    <span style={{ fontSize: '0.625rem', fontWeight: 600, marginTop: '0.125rem' }}>Add</span>
                  </>
                )}
              </div>
            </div>
          </label>
        </div>

        {/* Photo count */}
        <p style={{
          fontSize: '0.6875rem',
          color: 'var(--text-tertiary)',
          marginTop: '0.75rem',
          textAlign: 'center'
        }}>
          {(formData.avatar ? 1 : 0) + formData.memoryPhotos.length} photo{((formData.avatar ? 1 : 0) + formData.memoryPhotos.length) !== 1 ? 's' : ''} • Max 5MB each • Click to enlarge
        </p>
        </div>
        )}
      </div>

      {/* Occasions */}
      <div className="card space-y-4">
        {/* FOUNDER 2026-10-01 round 2 (PROPOSED): header renamed "Occasion Scheduler"; typography centred;
            "GIFTS ARE CONFIGURED" shown, with a gift icon on both sides, ONLY when at least one selected
            occasion has a gift configured (assumption stated in render-review/surface2.md). */}
        <button
          type="button"
          data-testid="special-occasions-toggle"
          aria-expanded={occasionsExpanded}
          onClick={() => setOccasionsExpanded((v) => !v)}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #eef2ff 0%, #fdf2f8 100%)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', padding: 'var(--gm-inner-gap, 1rem)', fontFamily: 'inherit' }}
        >
          <span aria-hidden="true" data-testid="scheduler-festive-icons" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--primary-dark)' }}>
            <Calendar size={22} /><PartyPopper size={26} style={{ color: 'var(--accent)' }} /><Heart size={22} fill="currentColor" style={{ color: 'var(--accent)' }} />
          </span>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <h3 data-testid="special-occasions-heading" className="text-lg font-semibold" style={{ textAlign: 'center', margin: 0, color: 'var(--gray-900)' }}>Occasion Scheduler</h3>
            {occasionsExpanded ? <ChevronUp size={20} style={{ color: 'var(--primary-dark)', flexShrink: 0 }} /> : <ChevronDown size={20} style={{ color: 'var(--primary-dark)', flexShrink: 0 }} />}
          </span>
          <span data-testid="scheduler-subtext" style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--primary-dark)', textAlign: 'center' }}>Schedule the love!</span>
        </button>
        {occasionsExpanded && (<>

        {/* Guardrail text */}
        <p style={{
          fontSize: '0.75rem',
          color: 'var(--text-tertiary)',
          padding: '0.75rem',
          background: 'var(--gray-50)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          marginBottom: '0.5rem'
        }}>
          <Gift size={14} style={{ display: 'inline', marginRight: '0.375rem', verticalAlign: 'middle' }} />
          Gifts are optional and never auto-sent unless you select them for a specific occasion.
        </p>

        {/* Personal Occasions */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Personal Occasions</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {occasionCategories.personal.filter(o => o.value !== 'getwell').map((occasion) => {
              const isSelected = selectedOccasions.includes(occasion.value);
              const occasionData = formData.occasions?.find(o => o.type === occasion.value);
              const giftSetting = getOccasionGiftSetting(occasion.value);

              return (
                <div
                  key={occasion.value}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem',
                    background: isSelected ? 'var(--gray-50)' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Occasion header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        id={`occasion-${occasion.value}`}
                        checked={isSelected}
                        onChange={() => handleOccasionToggle(occasion.value, occasion.fixedDate)}
                        style={{ width: '1.125rem', height: '1.125rem', accentColor: '#8b5cf6' }}
                      />
                      <label
                        htmlFor={`occasion-${occasion.value}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                      >
                        <span style={{ fontSize: '1.5rem' }}>{occasion.icon}</span>
                        <span style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{occasion.label}</span>
                          {/* SURFACE 2 W04/W06 — occasion distinct from cadence, e.g. "Repeats yearly"
                              vs "One-time". Reads the real `recurring` flag already on occasionTypes
                              instead of leaving cadence implicit. */}
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                            {getOccasionCadenceLabel(occasion.value)}
                          </span>
                        </span>
                      </label>
                    </div>

                    {/* Date field inline */}
                    {isSelected && (
                      <input
                        type="date"
                        value={occasionData?.date || ''}
                        onChange={(e) => handleOccasionDateChange(occasion.value, e.target.value)}
                        style={{
                          padding: '0.375rem 0.625rem',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.8125rem',
                          fontFamily: 'inherit'
                        }}
                        required
                      />
                    )}
                  </div>

                  {/* FOUNDER round 4: the "Gift & Delivery" label and its icon were removed. The section is just the
                      "Add gift" row (checkbox + selector + repeat note) plus the existing Delivery Details block that
                      appears below it for gift types that ship a parcel. */}

                  {isSelected && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)' }}>

                  {isSelected && (
                    <div style={{
                      marginTop: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {/* FOUNDER round 4: "Add gift" checkbox + the existing gift selector (replaces the Gift Add-On: None dropdown) */}
                        {renderAddGiftRow(occasion.value)}

                        {/* Curated gift max spend selector */}
                        {giftSetting.type === 'curated' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <DollarSign size={14} style={{ color: '#667eea' }} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Max:</span>
                            <select
                              value={giftSetting.maxSpend || 50}
                              onChange={(e) => handleOccasionGiftChange(occasion.value, 'maxSpend', parseInt(e.target.value))}
                              style={{
                                padding: '0.375rem 0.625rem',
                                border: '1px solid #667eea',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit',
                                background: '#f0f4ff',
                                cursor: 'pointer'
                              }}
                            >
                              <option value={25}>$25</option>
                              <option value={50}>$50</option>
                              <option value={75}>$75</option>
                              <option value={100}>$100</option>
                              <option value={150}>$150</option>
                            </select>
                          </div>
                        )}

                        {/* QR Cash amount selector */}
                        {giftSetting.type === 'qrcash' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <DollarSign size={14} style={{ color: '#f59e0b' }} />
                            <select
                              value={giftSetting.amount || 25}
                              onChange={(e) => handleOccasionGiftChange(occasion.value, 'amount', parseInt(e.target.value))}
                              style={{
                                padding: '0.375rem 0.625rem',
                                border: '1px solid #fbbf24',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit',
                                background: '#fffbeb',
                                cursor: 'pointer'
                              }}
                            >
                              <option value={10}>$10</option>
                              <option value={25}>$25</option>
                              <option value={50}>$50</option>
                              <option value={100}>$100</option>
                              <option value={0}>Custom</option>
                            </select>
                            {giftSetting.amount === 0 && (
                              <input
                                type="number"
                                min="1"
                                placeholder="Amount"
                                value={giftSetting.customAmount || ''}
                                onChange={(e) => handleOccasionGiftChange(occasion.value, 'customAmount', parseInt(e.target.value))}
                                style={{
                                  width: '80px',
                                  padding: '0.375rem 0.625rem',
                                  border: '1px solid #fbbf24',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit',
                                  background: '#fffbeb'
                                }}
                              />
                            )}
                          </div>
                        )}

                        {/* Choose Item button for merch/subscription */}
                        {(giftSetting.type === 'merch' || giftSetting.type === 'marketplace' || giftSetting.type === 'subscription') && (
                          <button
                            type="button"
                            onClick={() => {
                              saveScrollPosition();
                              const returnParam = contact?.id ? `&returnRecipientId=${contact.id}` : '';
                              // 'marketplace' routes through the same known-working merch/Gift Place
                              // destination as 'merch' — Merch.jsx does not currently branch on the
                              // `category` query param, so this mirrors 'merch' exactly.
                              navigate((giftSetting.type === 'merch' || giftSetting.type === 'marketplace') ? `/dashboard/merch?category=merch${returnParam}` : `/dashboard/gifts?category=${giftSetting.type}${returnParam}`);
                            }}
                            style={{
                              padding: '0.375rem 0.75rem',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              fontFamily: 'inherit'
                            }}
                          >
                            <ExternalLink size={12} />
                            Choose Item
                          </button>
                        )}
                      </div>

                      {/* Auto-Gift toggle with badge - only when gift is selected */}
                      {giftSetting.type !== 'none' && (
                        <div style={{ marginTop: '0.625rem' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem'
                          }}>
                            <label style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer'
                            }}>
                              <input
                                type="checkbox"
                                checked={!qrCashManualOnly(giftSetting) && giftSetting.autoGift === true}
                                disabled={qrCashManualOnly(giftSetting)}
                                onChange={(e) => handleOccasionGiftChange(occasion.value, 'autoGift', e.target.checked)}
                                style={{ width: '0.875rem', height: '0.875rem', accentColor: '#667eea' }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                Enable Auto-Gift
                              </span>
                            </label>
                            <span style={{
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              padding: '0.25rem 0.5rem',
                              borderRadius: '9999px',
                              background: (giftSetting.autoGift && !qrCashManualOnly(giftSetting)) ? 'rgba(102, 126, 234, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                              color: (giftSetting.autoGift && !qrCashManualOnly(giftSetting)) ? '#667eea' : 'var(--text-tertiary)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.025em'
                            }}>
                              {(giftSetting.autoGift && !qrCashManualOnly(giftSetting)) ? 'Auto-Gift Enabled' : 'Manual Selection'}
                            </span>
                          </div>
                          <p style={{
                            fontSize: '0.6875rem',
                            color: 'var(--text-tertiary)',
                            marginTop: '0.375rem',
                            marginLeft: '1.375rem'
                          }}>
                            {qrCashManualOnly(giftSetting)
                              ? SCHEDULED_QRCASH_UNAVAILABLE_COPY
                              : giftSetting.autoGift
                              ? 'Gift will be sent automatically on the occasion date.'
                              : 'You\'ll receive a reminder 10 days before to confirm.'}
                          </p>
                        </div>
                      )}

                      {/* Delivery details - for every gift type that ships a physical parcel */}
                      {requiresDeliveryAddress(giftSetting.type) && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '1rem',
                          background: 'rgba(102, 126, 234, 0.05)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid rgba(102, 126, 234, 0.2)'
                        }}>
                          <h4 style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: '#667eea',
                            marginBottom: '0.75rem'
                          }}>
                            Delivery Details
                          </h4>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                            A shipping label needs a first name. We never guess it from
                            {formData.name ? ` “${formData.name}”` : ' the contact name'}, so please confirm it.
                            A last name is optional.
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <input
                              type="text"
                              placeholder="Recipient First Name *"
                              value={formData.firstName || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                              autoComplete="off"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit'
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Recipient Last Name (optional)"
                              value={formData.lastName || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                              autoComplete="off"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit'
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Address Line 1 *"
                              value={formData.shippingAddress?.line1 || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                shippingAddress: { ...prev.shippingAddress, line1: e.target.value }
                              }))}
                              autoComplete="off"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit'
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Address Line 2"
                              value={formData.shippingAddress?.line2 || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                shippingAddress: { ...prev.shippingAddress, line2: e.target.value }
                              }))}
                              autoComplete="off"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                type="text"
                                placeholder="City *"
                                value={formData.shippingAddress?.city || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, city: e.target.value }
                                }))}
                                autoComplete="off"
                                style={{
                                  flex: 2,
                                  padding: '0.5rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit'
                                }}
                              />
                              <input
                                type="text"
                                placeholder="State *"
                                value={formData.shippingAddress?.state || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, state: e.target.value }
                                }))}
                                autoComplete="off"
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit'
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                type="text"
                                placeholder="ZIP Code *"
                                value={formData.shippingAddress?.zip || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, zip: e.target.value }
                                }))}
                                autoComplete="off"
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit'
                                }}
                              />
                              <input
                                type="text"
                                placeholder="Country *"
                                value={formData.shippingAddress?.country || 'United States'}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, country: e.target.value }
                                }))}
                                autoComplete="off"
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Secular Occasions - Collapsible */}
        <div style={{
          border: '1px solid',
          borderColor: selectedFaiths.includes('secular') ? 'var(--primary)' : 'var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: selectedFaiths.includes('secular') ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-primary)'
        }}>
          {/* Secular Header */}
          <div style={{
            padding: '0.875rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={selectedFaiths.includes('secular')}
              onChange={() => {
                const newSelection = selectedFaiths.includes('secular')
                  ? selectedFaiths.filter(id => id !== 'secular')
                  : [...selectedFaiths, 'secular'];
                handleFaithSelectionChange(newSelection);
              }}
              style={{
                width: '1.125rem',
                height: '1.125rem',
                cursor: 'pointer',
                accentColor: 'var(--primary)'
              }}
            />

            {/* Click area for expand/collapse */}
            <div
              onClick={() => setSecularExpanded(!secularExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flex: 1,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🎉</span>
                <div style={{ textAlign: 'left' }}>
                  <h4 style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0
                  }}>
                    Secular Holidays
                  </h4>
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-tertiary)',
                    margin: 0
                  }}>
                    {occasionCategories.secular.length} holidays (Mother's Day, Thanksgiving, etc.)
                  </p>
                </div>
              </div>
              {secularExpanded ? (
                <ChevronUp size={18} style={{ color: 'var(--text-tertiary)' }} />
              ) : (
                <ChevronDown size={18} style={{ color: 'var(--text-tertiary)' }} />
              )}
            </div>
          </div>

          {/* Secular Content - Expandable */}
          {secularExpanded && (
            <div style={{
              padding: '1rem',
              borderTop: '1px solid var(--border)',
              background: 'var(--gray-50)'
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: '#eff6ff',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #bfdbfe'
              }}>
                <Info size={12} style={{ display: 'inline', marginRight: '0.375rem', verticalAlign: 'middle' }} />
                Dates for holidays like Mother's Day and Thanksgiving vary each year.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {occasionCategories.secular.filter(occasion => {
              // Gender-based filtering
              const gender = formData.gender?.toLowerCase();

              // Hide Mother's Day for males
              if (occasion.value === 'mothers_day' && gender === 'male') {
                return false;
              }

              // Hide Father's Day for females
              if (occasion.value === 'fathers_day' && gender === 'female') {
                return false;
              }

              // Show all other occasions
              return true;
            }).map((occasion) => {
              const isSelected = selectedOccasions.includes(occasion.value);
              const occasionData = formData.occasions?.find(o => o.type === occasion.value);
              const giftSetting = getOccasionGiftSetting(occasion.value);

              return (
                <div
                  key={occasion.value}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem',
                    background: isSelected ? 'var(--gray-50)' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Occasion header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        id={`occasion-${occasion.value}`}
                        checked={isSelected}
                        onChange={() => handleOccasionToggle(occasion.value, occasion.fixedDate)}
                        style={{ width: '1.125rem', height: '1.125rem', accentColor: '#8b5cf6' }}
                      />
                      <label
                        htmlFor={`occasion-${occasion.value}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                      >
                        <span style={{ fontSize: '1.5rem' }}>{occasion.icon}</span>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{occasion.label}</span>
                        {!occasion.fixedDate && (
                          <span style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>(varying dates auto-adjust annually)</span>
                        )}
                      </label>
                    </div>

                    {/* Date field inline */}
                    {isSelected && (
                      <input
                        type="date"
                        value={occasionData?.date || ''}
                        onChange={(e) => handleOccasionDateChange(occasion.value, e.target.value)}
                        style={{
                          padding: '0.375rem 0.625rem',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.8125rem',
                          fontFamily: 'inherit'
                        }}
                        required
                      />
                    )}
                  </div>

                  {/* Gift Add-On Section - only show when occasion is selected */}
                  {isSelected && (
                    <div style={{
                      marginTop: '0.75rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px dashed var(--border)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {/* FOUNDER round 4: "Add gift" checkbox + the existing gift selector (replaces the Gift Add-On: None dropdown) */}
                        {renderAddGiftRow(occasion.value)}

                        {/* Curated gift max spend selector */}
                        {giftSetting.type === 'curated' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <DollarSign size={14} style={{ color: '#667eea' }} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Max:</span>
                            <select
                              value={giftSetting.maxSpend || 50}
                              onChange={(e) => handleOccasionGiftChange(occasion.value, 'maxSpend', parseInt(e.target.value))}
                              style={{
                                padding: '0.375rem 0.625rem',
                                border: '1px solid #667eea',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit',
                                background: '#f0f4ff',
                                cursor: 'pointer'
                              }}
                            >
                              <option value={25}>$25</option>
                              <option value={50}>$50</option>
                              <option value={75}>$75</option>
                              <option value={100}>$100</option>
                              <option value={150}>$150</option>
                            </select>
                          </div>
                        )}

                        {/* QR Cash amount selector */}
                        {giftSetting.type === 'qrcash' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <DollarSign size={14} style={{ color: '#f59e0b' }} />
                            <select
                              value={giftSetting.amount || 25}
                              onChange={(e) => handleOccasionGiftChange(occasion.value, 'amount', parseInt(e.target.value))}
                              style={{
                                padding: '0.375rem 0.625rem',
                                border: '1px solid #fbbf24',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit',
                                background: '#fffbeb',
                                cursor: 'pointer'
                              }}
                            >
                              <option value={10}>$10</option>
                              <option value={25}>$25</option>
                              <option value={50}>$50</option>
                              <option value={100}>$100</option>
                              <option value={0}>Custom</option>
                            </select>
                            {giftSetting.amount === 0 && (
                              <input
                                type="number"
                                min="1"
                                placeholder="Amount"
                                value={giftSetting.customAmount || ''}
                                onChange={(e) => handleOccasionGiftChange(occasion.value, 'customAmount', parseInt(e.target.value))}
                                style={{
                                  width: '80px',
                                  padding: '0.375rem 0.625rem',
                                  border: '1px solid #fbbf24',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit',
                                  background: '#fffbeb'
                                }}
                              />
                            )}
                          </div>
                        )}

                        {/* Choose Item button for merch/subscription */}
                        {(giftSetting.type === 'merch' || giftSetting.type === 'marketplace' || giftSetting.type === 'subscription') && (
                          <button
                            type="button"
                            onClick={() => {
                              saveScrollPosition();
                              const returnParam = contact?.id ? `&returnRecipientId=${contact.id}` : '';
                              // 'marketplace' routes through the same known-working merch/Gift Place
                              // destination as 'merch' — Merch.jsx does not currently branch on the
                              // `category` query param, so this mirrors 'merch' exactly.
                              navigate((giftSetting.type === 'merch' || giftSetting.type === 'marketplace') ? `/dashboard/merch?category=merch${returnParam}` : `/dashboard/gifts?category=${giftSetting.type}${returnParam}`);
                            }}
                            style={{
                              padding: '0.375rem 0.75rem',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              fontFamily: 'inherit'
                            }}
                          >
                            <ExternalLink size={12} />
                            Choose Item
                          </button>
                        )}
                      </div>

                      {/* Auto-Gift toggle with badge - only when gift is selected */}
                      {giftSetting.type !== 'none' && (
                        <div style={{ marginTop: '0.625rem' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem'
                          }}>
                            <label style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer'
                            }}>
                              <input
                                type="checkbox"
                                checked={!qrCashManualOnly(giftSetting) && giftSetting.autoGift === true}
                                disabled={qrCashManualOnly(giftSetting)}
                                onChange={(e) => handleOccasionGiftChange(occasion.value, 'autoGift', e.target.checked)}
                                style={{ width: '0.875rem', height: '0.875rem', accentColor: '#667eea' }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                Enable Auto-Gift
                              </span>
                            </label>
                            <span style={{
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              padding: '0.25rem 0.5rem',
                              borderRadius: '9999px',
                              background: (giftSetting.autoGift && !qrCashManualOnly(giftSetting)) ? 'rgba(102, 126, 234, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                              color: (giftSetting.autoGift && !qrCashManualOnly(giftSetting)) ? '#667eea' : 'var(--text-tertiary)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.025em'
                            }}>
                              {(giftSetting.autoGift && !qrCashManualOnly(giftSetting)) ? 'Auto-Gift Enabled' : 'Manual Selection'}
                            </span>
                          </div>
                          <p style={{
                            fontSize: '0.6875rem',
                            color: 'var(--text-tertiary)',
                            marginTop: '0.375rem',
                            marginLeft: '1.375rem'
                          }}>
                            {qrCashManualOnly(giftSetting)
                              ? SCHEDULED_QRCASH_UNAVAILABLE_COPY
                              : giftSetting.autoGift
                              ? 'Gift will be sent automatically on the occasion date.'
                              : 'You\'ll receive a reminder 10 days before to confirm.'}
                          </p>
                        </div>
                      )}

                      {/* Delivery details - for every gift type that ships a physical parcel */}
                      {requiresDeliveryAddress(giftSetting.type) && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '1rem',
                          background: 'rgba(102, 126, 234, 0.05)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid rgba(102, 126, 234, 0.2)'
                        }}>
                          <h4 style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: '#667eea',
                            marginBottom: '0.75rem'
                          }}>
                            Delivery Details
                          </h4>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                            A shipping label needs a first name. We never guess it from
                            {formData.name ? ` “${formData.name}”` : ' the contact name'}, so please confirm it.
                            A last name is optional.
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <input
                              type="text"
                              placeholder="Recipient First Name *"
                              value={formData.firstName || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                              autoComplete="off"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit'
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Recipient Last Name (optional)"
                              value={formData.lastName || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                              autoComplete="off"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit'
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Address Line 1 *"
                              value={formData.shippingAddress?.line1 || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                shippingAddress: { ...prev.shippingAddress, line1: e.target.value }
                              }))}
                              autoComplete="off"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit'
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Address Line 2"
                              value={formData.shippingAddress?.line2 || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                shippingAddress: { ...prev.shippingAddress, line2: e.target.value }
                              }))}
                              autoComplete="off"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                type="text"
                                placeholder="City *"
                                value={formData.shippingAddress?.city || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, city: e.target.value }
                                }))}
                                autoComplete="off"
                                style={{
                                  flex: 2,
                                  padding: '0.5rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit'
                                }}
                              />
                              <input
                                type="text"
                                placeholder="State *"
                                value={formData.shippingAddress?.state || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, state: e.target.value }
                                }))}
                                autoComplete="off"
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit'
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                type="text"
                                placeholder="ZIP Code *"
                                value={formData.shippingAddress?.zip || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, zip: e.target.value }
                                }))}
                                autoComplete="off"
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit'
                                }}
                              />
                              <input
                                type="text"
                                placeholder="Country *"
                                value={formData.shippingAddress?.country || 'United States'}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, country: e.target.value }
                                }))}
                                autoComplete="off"
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
              </div>
            </div>
          )}
        </div>

        {/* Faith-Based Occasions - Collapsible Section */}
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}>
          {/* Collapse Header */}
          <button
            type="button"
            onClick={() => setFaithSectionExpanded(!faithSectionExpanded)}
            style={{
              width: '100%',
              padding: '1rem',
              background: faithSectionExpanded ? 'rgba(99, 102, 241, 0.05)' : 'var(--gray-50)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'inherit'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={faithSectionExpanded}
                onChange={(e) => {
                  e.stopPropagation();
                  setFaithSectionExpanded(e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '1rem',
                  height: '1rem',
                  cursor: 'pointer',
                  accentColor: 'var(--primary)'
                }}
              />
              <span style={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}>
                Faith-Based Holidays
              </span>
              <span style={{
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)'
              }}>
                (Optional)
              </span>
            </div>
            <span style={{
              fontSize: '1rem',
              color: 'var(--text-tertiary)',
              transition: 'transform 0.2s',
              transform: faithSectionExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
            }}>
              ▼
            </span>
          </button>

          {/* Collapsible Content */}
          {faithSectionExpanded && (
            <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
              <FaithBasedOccasionSelector
                selectedFaiths={selectedFaiths}
                onChange={handleFaithSelectionChange}
              />
            </div>
          )}
        </div>

        {/* Date entry for faith-based occasions that need dates */}
        {selectedFaiths.length > 0 && (
          <div style={{
            marginTop: 'var(--space-lg)',
            padding: 'var(--space-lg)',
            background: 'var(--gray-50)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)'
          }}>
            <h4 style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-md)'
            }}>
              Faith-Based Holiday Dates
            </h4>
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              marginBottom: 'var(--space-md)'
            }}>
              Enter dates for holidays that vary each year. Fixed-date holidays (like Christmas) are pre-filled.
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 'var(--space-md)'
            }}>
              {formData.occasions?.filter(occ => {
                const occasion = [...occasionCategories.christian, ...occasionCategories.jewish, ...occasionCategories.muslim].find(o => o.value === occ.type);
                return occasion && ['christian', 'jewish', 'muslim'].includes(occasion.category);
              }).map(occ => {
                const occasion = [...occasionCategories.christian, ...occasionCategories.jewish, ...occasionCategories.muslim].find(o => o.value === occ.type);
                if (!occasion) return null;

                return (
                  <div key={occ.type} style={{
                    padding: 'var(--space-sm)',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: 'var(--space-xs)'
                    }}>
                      <span style={{ marginRight: 'var(--space-xs)' }}>{occasion.icon}</span>
                      {occasion.label}
                    </label>
                    <input
                      type="date"
                      value={occ.date || ''}
                      onChange={(e) => handleOccasionDateChange(occ.type, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'inherit'
                      }}
                      required
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Faith-Based Occasion Gift Configuration — same Gift Add-On / Auto-Gift / Choose Item
            pattern Personal and Secular occasions get, applied per currently-selected faith
            holiday. Faith holidays are selected as a whole package (via FaithBasedOccasionSelector
            above), not individually, so there is no per-occasion checkbox here — only the gift
            configuration, listed once per holiday that is currently active in formData.occasions.
            Reuses getOccasionGiftSetting/handleOccasionGiftChange unmodified; no religious labels,
            dates, recurrence, or eligibility are touched. */}
        {formData.occasions?.some(occ => {
          const occasion = [...occasionCategories.christian, ...occasionCategories.jewish, ...occasionCategories.muslim].find(o => o.value === occ.type);
          return occasion && ['christian', 'jewish', 'muslim'].includes(occasion.category);
        }) && (
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <h4 style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-xs)'
            }}>
              Gifts for Faith-Based Holidays
            </h4>
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              marginBottom: 'var(--space-md)'
            }}>
              Configure an optional gift for each selected holiday, the same way you would for a birthday or anniversary.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {formData.occasions.filter(occ => {
                const occasion = [...occasionCategories.christian, ...occasionCategories.jewish, ...occasionCategories.muslim].find(o => o.value === occ.type);
                return occasion && ['christian', 'jewish', 'muslim'].includes(occasion.category);
              }).map(occ => {
                const occasion = [...occasionCategories.christian, ...occasionCategories.jewish, ...occasionCategories.muslim].find(o => o.value === occ.type);
                if (!occasion) return null;
                const giftSetting = getOccasionGiftSetting(occ.type);

                return (
                  <div
                    key={occ.type}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '1rem',
                      background: 'var(--gray-50)'
                    }}
                  >
                    {/* Occasion header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>{occasion.icon}</span>
                      <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{occasion.label}</span>
                    </div>

                    {/* Gift Add-On Section */}
                    <div style={{
                      marginTop: '0.75rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px dashed var(--border)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {/* Gift Add-On dropdown */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Gift size={16} style={{ color: '#10b981' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Gift Add-On:</span>
                          <select
                            value={giftSetting.type}
                            onChange={(e) => handleOccasionGiftChange(occ.type, 'type', e.target.value)}
                            style={{
                              padding: '0.375rem 0.625rem',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.8125rem',
                              fontFamily: 'inherit',
                              background: 'white',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="none">None</option>
                            <option value="qrcash">QR Cash™</option>
                            <option value="merch">Branded Goods</option>
                            <option value="curated">Let Greet-Me select a gift</option>
                            <option value="marketplace">Browse Marketplace</option>
                          </select>
                        </div>

                        {/* Curated gift max spend selector */}
                        {giftSetting.type === 'curated' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <DollarSign size={14} style={{ color: '#667eea' }} />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Max:</span>
                            <select
                              value={giftSetting.maxSpend || 50}
                              onChange={(e) => handleOccasionGiftChange(occ.type, 'maxSpend', parseInt(e.target.value))}
                              style={{
                                padding: '0.375rem 0.625rem',
                                border: '1px solid #667eea',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit',
                                background: '#f0f4ff',
                                cursor: 'pointer'
                              }}
                            >
                              <option value={25}>$25</option>
                              <option value={50}>$50</option>
                              <option value={75}>$75</option>
                              <option value={100}>$100</option>
                              <option value={150}>$150</option>
                            </select>
                          </div>
                        )}

                        {/* QR Cash amount selector */}
                        {giftSetting.type === 'qrcash' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <DollarSign size={14} style={{ color: '#f59e0b' }} />
                            <select
                              value={giftSetting.amount || 25}
                              onChange={(e) => handleOccasionGiftChange(occ.type, 'amount', parseInt(e.target.value))}
                              style={{
                                padding: '0.375rem 0.625rem',
                                border: '1px solid #fbbf24',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit',
                                background: '#fffbeb',
                                cursor: 'pointer'
                              }}
                            >
                              <option value={10}>$10</option>
                              <option value={25}>$25</option>
                              <option value={50}>$50</option>
                              <option value={100}>$100</option>
                              <option value={0}>Custom</option>
                            </select>
                            {giftSetting.amount === 0 && (
                              <input
                                type="number"
                                min="1"
                                placeholder="Amount"
                                value={giftSetting.customAmount || ''}
                                onChange={(e) => handleOccasionGiftChange(occ.type, 'customAmount', parseInt(e.target.value))}
                                style={{
                                  width: '80px',
                                  padding: '0.375rem 0.625rem',
                                  border: '1px solid #fbbf24',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit',
                                  background: '#fffbeb'
                                }}
                              />
                            )}
                          </div>
                        )}

                        {/* Choose Item button for merch/marketplace/subscription */}
                        {(giftSetting.type === 'merch' || giftSetting.type === 'marketplace' || giftSetting.type === 'subscription') && (
                          <button
                            type="button"
                            onClick={() => {
                              saveScrollPosition();
                              const returnParam = contact?.id ? `&returnRecipientId=${contact.id}` : '';
                              navigate((giftSetting.type === 'merch' || giftSetting.type === 'marketplace') ? `/dashboard/merch?category=merch${returnParam}` : `/dashboard/gifts?category=${giftSetting.type}${returnParam}`);
                            }}
                            style={{
                              padding: '0.375rem 0.75rem',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              fontFamily: 'inherit'
                            }}
                          >
                            <ExternalLink size={12} />
                            Choose Item
                          </button>
                        )}
                      </div>

                      {/* Auto-Gift toggle with badge - only when gift is selected */}
                      {giftSetting.type !== 'none' && (
                        <div style={{ marginTop: '0.625rem' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem'
                          }}>
                            <label style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer'
                            }}>
                              <input
                                type="checkbox"
                                checked={!qrCashManualOnly(giftSetting) && giftSetting.autoGift === true}
                                disabled={qrCashManualOnly(giftSetting)}
                                onChange={(e) => handleOccasionGiftChange(occ.type, 'autoGift', e.target.checked)}
                                style={{ width: '0.875rem', height: '0.875rem', accentColor: '#667eea' }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                Enable Auto-Gift
                              </span>
                            </label>
                            <span style={{
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              padding: '0.25rem 0.5rem',
                              borderRadius: '9999px',
                              background: (giftSetting.autoGift && !qrCashManualOnly(giftSetting)) ? 'rgba(102, 126, 234, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                              color: (giftSetting.autoGift && !qrCashManualOnly(giftSetting)) ? '#667eea' : 'var(--text-tertiary)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.025em'
                            }}>
                              {(giftSetting.autoGift && !qrCashManualOnly(giftSetting)) ? 'Auto-Gift Enabled' : 'Manual Selection'}
                            </span>
                          </div>
                          <p style={{
                            fontSize: '0.6875rem',
                            color: 'var(--text-tertiary)',
                            marginTop: '0.375rem',
                            marginLeft: '1.375rem'
                          }}>
                            {qrCashManualOnly(giftSetting)
                              ? SCHEDULED_QRCASH_UNAVAILABLE_COPY
                              : giftSetting.autoGift
                              ? 'Gift will be sent automatically on the occasion date.'
                              : 'You\'ll receive a reminder 10 days before to confirm.'}
                          </p>
                        </div>
                      )}

                      {/* Delivery details - for every gift type that ships a physical parcel */}
                      {requiresDeliveryAddress(giftSetting.type) && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '1rem',
                          background: 'rgba(102, 126, 234, 0.05)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid rgba(102, 126, 234, 0.2)'
                        }}>
                          <h4 style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: '#667eea',
                            marginBottom: '0.75rem'
                          }}>
                            Delivery Details
                          </h4>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                            A shipping label needs a first name. We never guess it from
                            {formData.name ? ` “${formData.name}”` : ' the contact name'}, so please confirm it.
                            A last name is optional.
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <input
                              type="text"
                              placeholder="Recipient First Name *"
                              value={formData.firstName || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                              autoComplete="off"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit'
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Recipient Last Name (optional)"
                              value={formData.lastName || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                              autoComplete="off"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit'
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Address Line 1 *"
                              value={formData.shippingAddress?.line1 || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                shippingAddress: { ...prev.shippingAddress, line1: e.target.value }
                              }))}
                              autoComplete="off"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit'
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Address Line 2"
                              value={formData.shippingAddress?.line2 || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                shippingAddress: { ...prev.shippingAddress, line2: e.target.value }
                              }))}
                              autoComplete="off"
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                type="text"
                                placeholder="City *"
                                value={formData.shippingAddress?.city || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, city: e.target.value }
                                }))}
                                autoComplete="off"
                                style={{
                                  flex: 2,
                                  padding: '0.5rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit'
                                }}
                              />
                              <input
                                type="text"
                                placeholder="State *"
                                value={formData.shippingAddress?.state || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, state: e.target.value }
                                }))}
                                autoComplete="off"
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit'
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                type="text"
                                placeholder="ZIP Code *"
                                value={formData.shippingAddress?.zip || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, zip: e.target.value }
                                }))}
                                autoComplete="off"
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit'
                                }}
                              />
                              <input
                                type="text"
                                placeholder="Country *"
                                value={formData.shippingAddress?.country || 'United States'}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  shippingAddress: { ...prev.shippingAddress, country: e.target.value }
                                }))}
                                autoComplete="off"
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-md)',
                                  fontSize: '0.8125rem',
                                  fontFamily: 'inherit'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        </>)}

        {errors.occasions && <p className="mt-2 text-sm text-red-500">{errors.occasions}</p>}
      </div>

      {/* Gift Reminder Banner - FOUNDER round 3: now BELOW the Occasion Scheduler; copy changed - informational only, no CTA.
          A "Add Gift" button used to sit here and open GiftSelectorModal, duplicating the
          inline "Gift Add-On" picker already on every occasion card below (and offering a
          narrower option set than that picker). Removed per founder-approved brief: this
          banner should explain, not navigate.
          Claims in the copy verified in this file: "Greet-Me Gift Place" = the per-occasion "Choose Item" button
          (navigate to /dashboard/merch, which redirects to /dashboard/gifts); "let Greet-Me select one for you
          within your budget" = the "Let Greet-Me select a gift" option with its $25/$50/$75/$100/$150 Max selector. */}
      <div data-testid="gift-banner" style={{
        padding: 'var(--gm-inner-gap, 1rem)',
        background: 'linear-gradient(135deg, #fffbeb 0%, #fde68a 100%)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #d97706',
        boxShadow: '0 10px 24px -14px rgba(180,83,9,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--gm-inner-gap, 1rem)'
      }}>
        <CinematicGiftIcon />
        <div style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', overflowWrap: 'anywhere' }}>
          <p style={{
            fontSize: '0.9375rem',
            fontWeight: 700,
            color: '#78350f',
            margin: 0,
            textAlign: 'center'
          }}>
            Remember to Include a gift
          </p>
          <p style={{
            fontSize: '0.8125rem',
            color: '#78350f',
            margin: '0.25rem 0 0 0',
            textAlign: 'center'
          }}>
            Complete the moment with the thoughtful gift from the Greet-Me Gift Place. OR let Greet-Me select one for you within your budget.
          </p>
        </div>
        <CinematicGiftIcon />
      </div>

      {/* Actions */}
      <div data-testid="contact-form-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', paddingTop: 'var(--gm-section-gap)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary px-8 py-3 font-semibold disabled:opacity-50"
          style={{ background: 'var(--primary-dark)', color: '#fff', boxShadow: '0 8px 20px -8px rgba(79,70,229,0.7)' }}
          disabled={submitting || uploadingPhotos > 0}
        >
          {submitting ? 'Saving...' : uploadingPhotos > 0 ? 'Uploading photos...' : contact ? 'Update Recipient' : 'Save'}
        </button>
      </div>
    </form>

      {/* Gift Selector Modal */}
      <GiftSelectorModal
        isOpen={giftModalOpen}
        onClose={() => setGiftModalOpen(false)}
        occasions={formData.occasions}
        occasionGiftSettings={formData.occasionGiftSettings}
        onGiftChange={handleOccasionGiftChange}
        onBrowse={() => {
          saveScrollPosition();
          const returnParam = contact?.id ? `&returnRecipientId=${contact.id}` : '';
          navigate(`/dashboard/merch?category=merch${returnParam}`);
        }}
        getOccasionLabel={(type) => {
          const allOccasions = [
            ...occasionCategories.personal,
            ...occasionCategories.christian,
            ...occasionCategories.jewish,
            ...occasionCategories.muslim,
            ...occasionCategories.secular
          ];
          const occ = allOccasions.find(o => o.value === type);
          return occ?.label || type;
        }}
        getOccasionEmoji={(type) => {
          const allOccasions = [
            ...occasionCategories.personal,
            ...occasionCategories.christian,
            ...occasionCategories.jewish,
            ...occasionCategories.muslim,
            ...occasionCategories.secular
          ];
          const occ = allOccasions.find(o => o.value === type);
          return occ?.emoji || '🎉';
        }}
      />
    </>
  );
}
