// src/pages/SendGreeting.jsx

import { useState, useEffect } from 'react';
import { getPhotoSrc } from '../utils/getPhotoSrc';
import { useNavigate, useLocation } from 'react-router-dom';
import { Send, CheckCircle, XCircle, Loader, Edit3, Gift, ArrowLeft, Camera, Plus, X, Check } from 'lucide-react';
import { useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import GiftSelectorModal from '../components/GiftSelectorModal';
import GiftConfirmationModal from '../components/GiftConfirmationModal';
import HeartsBurst from '../components/HeartsBurst';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import draftService from '../services/draftService';
import { pushInApp } from '../utils/notify';
import { COMMS_EVENTS } from '../utils/commsCatalog';
import { awardGreetingHearts } from '../utils/rewards';
import { normalizeOccasionKey } from '../utils/normalizeOccasionKey';
import { getErrorMessage } from '../utils/errorMessages';

export default function SendGreeting() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [addContactError, setAddContactError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [completedJobId, setCompletedJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [heartsBurstKey, setHeartsBurstKey] = useState(0);
  const [formData, setFormData] = useState({
    contactId: '',
    occasionType: 'Thinking of You',
    customOccasion: '',
    customMessage: '',
    isRecurring: false,
    aiContext: '',
    giftAmount: '',
    tone: 'warm',
  });
  const [errors, setErrors] = useState({});

  // Gift modal state
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftSettings, setGiftSettings] = useState({
    type: 'none',
    amount: 25,
    customAmount: '',
    maxSpend: 50,
    autoGift: false
  });

  // QR Cash™ confirmation modal state
  const [isGiftConfirmOpen, setIsGiftConfirmOpen] = useState(false);
  const [giftCharging, setGiftCharging] = useState(false);
  const [giftChargeError, setGiftChargeError] = useState(null);
  const [pendingGreetingData, setPendingGreetingData] = useState(null);
  const [giftRequestId, setGiftRequestId] = useState(null);
  const [giftConfirmed, setGiftConfirmed] = useState(false);

  // Referral state (viral loop)
  const [referralCode, setReferralCode] = useState(null);
  const [referralValue, setReferralValue] = useState(null);
  const [referralError, setReferralError] = useState(null);

  // Photo state
  const [defaultPhoto, setDefaultPhoto] = useState(null);
  const [memoryPhotos, setMemoryPhotos] = useState([]);
  const [useMemoryPhotos, setUseMemoryPhotos] = useState(true); // Include memory photos by default
  const [excludedMemoryPhotos, setExcludedMemoryPhotos] = useState(new Set()); // Track deselected photos
  const MAX_MEMORY_PHOTOS = 8;
  const defaultPhotoInputRef = useRef(null);
  const memoryPhotoInputRef = useRef(null);
  const addToMemoryInputRef = useRef(null);
  const hasRestoredStateRef = useRef(false); // Track if we've already restored state

  // Memory photos picker modal state
  const [showMemoryPhotosPicker, setShowMemoryPhotosPicker] = useState(false);

  // Get selected contact's memory photos
  const selectedContact = contacts.find(c => c._id === formData.contactId || c.id === formData.contactId);
  const contactMemoryPhotos = selectedContact?.memoryPhotos || [];

  // Handle default photo selection
  const handleDefaultPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDefaultPhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle memory photo addition
  const handleMemoryPhotoAdd = (e) => {
    const file = e.target.files?.[0];
    if (file && memoryPhotos.length < MAX_MEMORY_PHOTOS) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMemoryPhotos(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // Remove a memory photo
  const handleRemoveMemoryPhoto = (index) => {
    setMemoryPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Toggle memory photo selection
  const toggleMemoryPhotoSelection = (photoUrl) => {
    setExcludedMemoryPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoUrl)) {
        newSet.delete(photoUrl);
      } else {
        newSet.add(photoUrl);
      }
      return newSet;
    });
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Demo mode prefill: ?demo=true&contactId=X → auto-select contact + Mother's Day
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') !== 'true') return;
    const demoContactId = params.get('contactId');
    if (demoContactId) {
      setFormData(prev => ({
        ...prev,
        contactId: demoContactId,
        occasionType: 'mothersday',
        tone: 'warm',
      }));
    }
  }, [location.search]);

  // Auto-save draft when form has meaningful content
  useEffect(() => {
    if (!formData.contactId || !formData.occasionType) return;
    const timer = setTimeout(() => {
      try {
        draftService.saveDraft({
          contactId: formData.contactId,
          occasionType: formData.occasionType,
          formData,
          status: 'draft',
        });
      } catch { /* localStorage full or unavailable — non-critical */ }
    }, 1000); // debounce 1s
    return () => clearTimeout(timer);
  }, [formData]);

  // Restore draft if navigating to send with a contact+occasion pre-selected
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const contactId = params.get('contactId');
    const occasion = params.get('occasion');
    if (!contactId || !occasion) return;
    const saved = draftService.getDraft(contactId, occasion);
    if (saved?.formData) {
      setFormData(prev => ({ ...prev, ...saved.formData }));
    }
  }, [location.search]);

  // Pre-select recipient from contactId URL param (e.g., Contacts page "Send" button)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const contactId = params.get('contactId');
    if (!contactId) return;
    if (params.get('demo') === 'true') return;   // demo mode handles this
    if (params.get('returnTo')) return;           // browse-return handles this
    setFormData(prev => ({ ...prev, contactId }));
  }, [location.search]);

  // Prefill occasion from query param (explosion layer — new user entry)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const occasion = params.get('occasion');
    if (!occasion) return;
    // Only prefill if no contact is also specified (draft restore handles that case)
    if (params.get('contactId')) return;
    setFormData(prev => ({ ...prev, occasionType: occasion }));
  }, [location.search]);

  // Detect referral code from URL and validate
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('referral');
    if (!code) return;

    api.getReferral(code).then((res) => {
      if (res?.ok && res.referralCreditCents) {
        setReferralCode(code);
        setReferralValue(res.referralCreditCents);
        // Pre-fill gift settings with credit value
        setGiftSettings({
          type: 'qrcash',
          amount: res.referralCreditCents / 100,
          customAmount: '',
          maxSpend: res.referralCreditCents / 100,
          autoGift: false,
        });
      } else {
        setReferralError('This referral credit is no longer valid.');
      }
    }).catch((err) => {
      if (err?.code === 'REFERRAL_ALREADY_USED') {
        setReferralError('This referral credit has already been used.');
      } else {
        setReferralError('This referral credit is not valid.');
      }
    });
  }, [location.search]);

  // Handle return from merch/marketplace/media browse - restore saved state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const returnTo = params.get('returnTo');
    const giftType = params.get('giftType');
    const selectedPhoto = params.get('selectedPhoto');
    const fromMediaLibrary = params.get('fromMediaLibrary');

    // Only restore once per navigation - prevents race conditions
    if (returnTo === 'send' && !hasRestoredStateRef.current) {
      hasRestoredStateRef.current = true;
      // Restore saved form state from sessionStorage
      const savedState = sessionStorage.getItem('sendGreetingState');
      let restoredMemoryPhotos = [];

      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (parsed.formData) setFormData(parsed.formData);
          if (giftType) {
            setGiftSettings({ ...parsed.giftSettings, type: giftType });
          } else if (parsed.giftSettings) {
            setGiftSettings(parsed.giftSettings);
          }
          if (parsed.defaultPhoto) setDefaultPhoto(parsed.defaultPhoto);
          if (parsed.useMemoryPhotos !== undefined) setUseMemoryPhotos(parsed.useMemoryPhotos);
          // Always restore excludedMemoryPhotos, even if empty array
          if (parsed.excludedMemoryPhotos) {
            setExcludedMemoryPhotos(new Set(parsed.excludedMemoryPhotos));
          }
          // Save restored memory photos to combine with new selections
          restoredMemoryPhotos = parsed.memoryPhotos || [];
        } catch (e) {
          // State restoration failed — non-critical, proceed with defaults
        }
        // Clean up saved state - delay to handle React Strict Mode double-render
        setTimeout(() => {
          sessionStorage.removeItem('sendGreetingState');
        }, 100);
      } else if (giftType) {
        // No saved state, just set the gift type
        setGiftSettings(prev => ({ ...prev, type: giftType }));
      }

      // If returning from media library with a selected photo (single photo, legacy)
      if (selectedPhoto) {
        setDefaultPhoto(decodeURIComponent(selectedPhoto));
      }

      // If returning from media library with multiple selected photos
      if (fromMediaLibrary === 'true') {
        const selectedPhotosJson = sessionStorage.getItem('selectedMediaLibraryPhotos');
        if (selectedPhotosJson) {
          try {
            const selectedUrls = JSON.parse(selectedPhotosJson);
            if (Array.isArray(selectedUrls) && selectedUrls.length > 0) {
              // Combine restored photos with newly selected photos (avoiding duplicates)
              const existing = new Set(restoredMemoryPhotos);
              const newPhotos = selectedUrls.filter(url => !existing.has(url));
              const combinedPhotos = [...restoredMemoryPhotos, ...newPhotos].slice(0, MAX_MEMORY_PHOTOS);
              setMemoryPhotos(combinedPhotos);
            } else {
              // No new photos selected, just restore the old ones
              setMemoryPhotos(restoredMemoryPhotos);
            }
          } catch (e) {
            setMemoryPhotos(restoredMemoryPhotos);
          }
          // Clean up
          sessionStorage.removeItem('selectedMediaLibraryPhotos');
        } else {
          // No selected photos in sessionStorage, just restore
          setMemoryPhotos(restoredMemoryPhotos);
        }
      } else {
        // Not from media library, just restore the memory photos
        if (restoredMemoryPhotos.length > 0) {
          setMemoryPhotos(restoredMemoryPhotos);
        }
      }

      // Open the gift modal only if returning from gift browse
      if (giftType) {
        setIsGiftModalOpen(true);
      }

      // Clean up the URL - delay to ensure state updates are committed
      setTimeout(() => {
        navigate('/dashboard/send', { replace: true });
        // Reset the ref after navigation so future returns can restore state
        setTimeout(() => {
          hasRestoredStateRef.current = false;
        }, 50);
      }, 0);
    }
  }, [location.search, navigate]);

  useEffect(() => {
    if (jobId) {
      const MAX_POLL_DURATION = 5 * 60 * 1000;
      const POLL_INTERVAL = 1500;
      const pollStart = Date.now();

      const interval = setInterval(async () => {
        if (Date.now() - pollStart > MAX_POLL_DURATION) {
          clearInterval(interval);
          setErrors({
            submit: "Your Greet-Me is still being created. You'll receive an email when it's ready. You can close this page."
          });
          setSending(false);
          return;
        }
        await pollJobStatus();
      }, POLL_INTERVAL);

      return () => clearInterval(interval);
    }
  }, [jobId]);

  const fetchContacts = async () => {
    try {
      const response = await api.getContacts();

      const contacts =
        Array.isArray(response?.data) ? response.data :
        Array.isArray(response?.contacts) ? response.contacts :
        Array.isArray(response) ? response :
        [];

    setContacts(contacts);
  } catch (error) {
    setContacts([]);
  } finally {
    setLoading(false);
  }
};

  const handleInlineAddContact = async () => {
    if (!newContactName.trim() || !newContactEmail.trim()) {
      setAddContactError('Name and email are required.');
      return;
    }
    setAddingContact(true);
    setAddContactError(null);
    try {
      const result = await api.createContact({
        name: newContactName.trim(),
        email: newContactEmail.trim(),
      });
      const newId = result?.contact?.id || result?.id;
      await fetchContacts();
      if (newId) {
        setFormData(prev => ({ ...prev, contactId: newId }));
      }
      setNewContactName('');
      setNewContactEmail('');
      setShowInlineAdd(false);
    } catch (err) {
      setAddContactError(err?.message || 'Failed to add contact.');
    } finally {
      setAddingContact(false);
    }
  };

  const pollJobStatus = async () => {
    try {
      const response = await api.getJobStatus(jobId);
      setJobStatus(response.status);

      if (response.status === 'completed') {
        setSending(false);
        setCompletedJobId(jobId);
        setHeartsBurstKey((k) => k + 1);
        setJobId(null);
        // Mark draft as sent so it won't be restored
        if (formData.contactId && formData.occasionType) {
          try { draftService.markDraftAsSent(formData.contactId, formData.occasionType); } catch {}
        }
        // Trigger notification and rewards
        const selectedContact = contacts.find(c => c._id === formData.contactId);
        const recipientName = selectedContact?.name || 'your recipient';
        pushInApp(COMMS_EVENTS.GREETING_SENT, { recipientName });
        // Award hearts for sending greeting
        const heartsEarned = awardGreetingHearts();
        if (heartsEarned > 0) {
          pushInApp(COMMS_EVENTS.REWARDS_EARNED, {
            amount: heartsEarned,
            reason: 'sending a greeting',
            timestamp: Date.now()
          });
        }
      } else if (response.status === 'failed') {
        setJobId(null);
      }
    } catch (error) {
      // Poll failure — will retry on next interval
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.contactId) {
      newErrors.contactId = 'Please select a contact';
    }

    if (!formData.occasionType) {
      newErrors.occasionType = 'Please select an occasion';
    }

    // Validate user has a REAL photo URL (https://...), not a data URL or placeholder
    // Order of preference: user.photoUrl from backend profile (real Azure Blob URL)
    const photoUrl = user?.photoUrl || '';

    // Reject if empty, is a data URL, or is a placeholder domain
    const isDataUrl = photoUrl.startsWith('data:');
    const isPlaceholder = !photoUrl ||
      photoUrl.includes('placeholder.com') ||
      photoUrl.includes('placehold.co') ||
      photoUrl.includes('placekitten.com') ||
      photoUrl.includes('dummyimage.com');

    if (isDataUrl || isPlaceholder) {
      newErrors.photo = 'Please upload your photo first \u2014 go to Dashboard \u2192 Your Presence and add a profile photo.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if in demo mode (URL param)
  const isDemo = new URLSearchParams(location.search).get('demo') === 'true';

  // Build greeting payload (shared by direct send and QR Cash flow)
  const buildGreetingData = (selectedContact) => {
    const effectivePhotoUrl = user?.photoUrl || '';
    const payload = {
      userId: user?.id || user?.email || '',
      recipientName: selectedContact.name,
      recipientEmail: selectedContact.email,
      greetingText: formData.customMessage || '',
      voiceId: user?.voiceId || '',
      photoUrl: effectivePhotoUrl,
      occasionKey: normalizeOccasionKey(formData.occasionType) || formData.occasionType,
      occasionType: formData.occasionType,
      relationshipKey: selectedContact.relationship || 'friend',
      relationshipNote: selectedContact.relationshipContext || '',
      personalSentiment: formData.customMessage || '',
      tone: formData.tone || 'warm',
      photos: [...new Set([
        ...memoryPhotos,
        ...(useMemoryPhotos
          ? (selectedContact.memoryPhotos || [])
              .map(p => typeof p === 'string' ? p : p?.url)
              .filter(Boolean)
              .filter(url => !excludedMemoryPhotos.has(url))
          : []),
      ])].slice(0, MAX_MEMORY_PHOTOS),
      layoutBudget: { introMaxChars: 280 },
      includeGift: Boolean(giftSettings?.type && giftSettings.type !== 'none'),
    };

    // Demo mode: attach pre-written content to skip AI generation
    if (isDemo) {
      const n = selectedContact.name;
      payload.demoContent = {
        // Intro: ≤280 chars, 2 paragraphs. Occasion in first line after salutation.
        writtenIntroText: `Happy Mother\u2019s Day!\n\nYour love and strength inspire me every single day. I hope today reminds you just how deeply you are appreciated and how much joy you bring to everyone around you.`,
        // Video: ~15 seconds spoken, natural and warm
        videoScriptText: `${n}, happy Mother\u2019s Day. You mean the world to me. I hope today brings you all the love and joy you deserve. Thank you for everything.`,
        // Poem: exactly 4 lines, each ≤35 chars, terminal punctuation, complete thoughts
        poemText: `A mother\u2019s love lights every day.\nYou guide us in the warmest way.\nYour grace fills every single room.\nYou turn each shadow into bloom.`,
        // Finale: body 120-180 chars, 3 paragraphs
        finaleText: `${n}, you are the heart of this family.\n\nThank you for every sacrifice, every laugh, and every moment of grace. Today is yours.\n\nWith All My Love This Mother\u2019s Day!!!`,
      };
    }

    return payload;
  };

  // Execute the actual greeting send (called directly or after gift charge)
  const executeGreetingSend = async (greetingData) => {
    setSending(true);
    setJobStatus(null);
    try {
      const response = await api.sendGreeting(greetingData);
      setJobId(response.jobId);
      setJobStatus('queued');
    } catch (error) {
      setErrors({ submit: getErrorMessage(error) });
      setSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    const selectedContact = contacts.find(c => c.id === formData.contactId);
    if (!selectedContact) return;

    const greetingData = buildGreetingData(selectedContact);

    // QR Cash™ referral: skip payment, redeem referral code instead
    if (giftSettings.type === 'qrcash' && referralCode) {
      setSending(true);
      try {
        const redeemResult = await api.redeemReferral(referralCode, {
          recipientEmail: greetingData.recipientEmail,
          recipientName: greetingData.recipientName,
        });

        if (!redeemResult.ok || !redeemResult.gift) {
          throw new Error(redeemResult.error || 'Referral redemption failed');
        }

        const giftObj = redeemResult.gift;
        const greetingDataWithGift = {
          ...greetingData,
          includeGift: true,
          hasGift: true,
          gift: {
            type: 'qrcash',
            amount: referralValue / 100,
            feeAmount: 0,
            totalAmount: 0,
            status: 'charged',
            claimToken: giftObj.claimToken,
            qrUrl: giftObj.qrImageUrl,
            qrBlobUrl: giftObj.qrBlobUrl,
            claimUrl: giftObj.claimUrl,
            creditApplied: true,
          },
        };

        await executeGreetingSend(greetingDataWithGift);
      } catch (error) {
        setErrors({ submit: error?.message || 'Failed to apply referral credit.' });
        setSending(false);
      }
      return;
    }

    // QR Cash™ intercept: open confirmation modal instead of sending directly
    if (giftSettings.type === 'qrcash') {
      setPendingGreetingData(greetingData);
      setGiftChargeError(null);
      setGiftRequestId(crypto.randomUUID());
      setIsGiftConfirmOpen(true);
      return;
    }

    // Non-QR-Cash: send directly
    await executeGreetingSend(greetingData);
  };

  // QR Cash™ confirmation handler: charge then send (with 3DS support)
  const handleGiftConfirm = async (paymentMethodId, stripeInstance) => {
    if (!pendingGreetingData || !paymentMethodId) return;
    setGiftCharging(true);
    setGiftChargeError(null);

    const giftAmountDollars = giftSettings.amount === 0
      ? (giftSettings.customAmount || 0)
      : (giftSettings.amount || 25);
    const giftAmountCents = Math.round(giftAmountDollars * 100);

    try {
      // Step 1: Charge for the QR Cash™ gift
      const chargeResult = await api.chargeGift({
        giftAmountCents,
        recipientEmail: pendingGreetingData.recipientEmail,
        recipientName: pendingGreetingData.recipientName,
        paymentMethodId,
        giftRequestId,
      });

      let giftObj;

      if (chargeResult.requiresAction && chargeResult.clientSecret) {
        // Step 1b: 3D Secure authentication required
        if (!stripeInstance) throw new Error('Payment authentication failed. Please try again.');

        const { error: confirmError, paymentIntent } = await stripeInstance.confirmCardPayment(
          chargeResult.clientSecret
        );

        if (confirmError) {
          throw new Error(confirmError.message || 'Card authentication failed.');
        }

        if (paymentIntent.status !== 'succeeded') {
          throw new Error('Payment was not completed after authentication.');
        }

        // Step 1c: Finalize gift order after successful 3DS
        const finalizeResult = await api.finalizeGift({
          paymentIntentId: chargeResult.paymentIntentId,
          recipientEmail: pendingGreetingData.recipientEmail,
          recipientName: pendingGreetingData.recipientName,
          giftAmountCents,
        });

        if (!finalizeResult.ok || !finalizeResult.gift) {
          throw new Error(finalizeResult.error || 'Gift finalization failed');
        }

        giftObj = finalizeResult.gift;
      } else if (chargeResult.ok && chargeResult.gift) {
        // Direct success (no 3DS needed)
        giftObj = chargeResult.gift;
      } else {
        throw new Error(chargeResult.error || 'Gift charge failed');
      }

      // Step 2: Attach gift object to greeting payload and send
      const greetingDataWithGift = {
        ...pendingGreetingData,
        includeGift: true,
        hasGift: true,
        gift: {
          type: 'qrcash',
          amount: giftAmountDollars,
          feeAmount: giftObj.feeCents / 100,
          totalAmount: giftObj.totalCents / 100,
          status: 'charged',
          claimToken: giftObj.claimToken,
          qrUrl: giftObj.qrImageUrl,
          qrBlobUrl: giftObj.qrBlobUrl,
          claimUrl: giftObj.claimUrl,
        },
      };

      // Show brief payment success confirmation before sending
      setIsGiftConfirmOpen(false);
      setGiftConfirmed(true);
      await new Promise((r) => setTimeout(r, 2000));
      setGiftConfirmed(false);
      setPendingGreetingData(null);
      await executeGreetingSend(greetingDataWithGift);
    } catch (error) {
      const msg = error?.message || error?.error || 'Failed to charge QR Cash™ gift. Please try again.';
      setGiftChargeError(msg);
      // Fresh idempotency key so the next attempt isn't blocked by Stripe
      setGiftRequestId(crypto.randomUUID());
    } finally {
      setGiftCharging(false);
    }
  };

  const handleSendFromEditor = async (draft) => {
    const selectedContact = contacts.find(c => c.id === draft.contactId);
    if (!selectedContact) return;

    setSending(true);
    setJobStatus(null);

    try {
      const greetingData = convertDraftToSendFormat(draft, selectedContact, user);
      const response = await api.sendGreeting(greetingData);
      setJobId(response.jobId);
      setJobStatus('queued');

      // Mark draft as sent
// V1 SAFETY: draft service disabled (persisted drafts deferred)
if (typeof window !== "undefined") {
  // no-op for V1
}
    } catch (error) {
      setErrors({ submit: getErrorMessage(error) });
      setSending(false);
    }
  };

  const resetForm = () => {
    setFormData({
      contactId: '',
      occasionType: 'Thinking of You',
      customOccasion: '',
      customMessage: '',
      isRecurring: false,
      aiContext: '',
      giftAmount: '',
      tone: 'warm',
    });
    setJobId(null);
    setCompletedJobId(null);
    setJobStatus(null);
    setSending(false);
    setErrors({});
    // Reset gift state so next send starts fresh
    setGiftSettings({ type: 'none', amount: 25, customAmount: '', maxSpend: 50, autoGift: false });
    setIsGiftModalOpen(false);
    setIsGiftConfirmOpen(false);
    setGiftCharging(false);
    setGiftChargeError(null);
    setPendingGreetingData(null);
  };

  if (loading) {
    return <LoadingSpinner text="Loading contacts..." />;
  }

  // Success State
  if (jobStatus === 'completed') {
    return (
      <div className="max-w-2xl mx-auto">
        <HeartsBurst triggerKey={heartsBurstKey} />
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Greet-Me has been sent</h2>
          <p className="text-gray-600 mb-1">
            That Greet-Me is on its way.
          </p>
          <p className="text-gray-400 mb-8" style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>
            Personal. Instant. Unforgettable.
          </p>
          <div className="flex flex-col items-center space-y-3">
            {completedJobId && (
              <button
                onClick={() => navigate(`/g/${completedJobId}`)}
                className="px-6 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 font-medium w-64"
              >
                View Greet-Me
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium w-64"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (jobStatus === 'failed') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <XCircle className="mx-auto text-red-500 mb-4" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">We couldn't send your Greet-Me</h2>
          <p className="text-gray-600 mb-8">
            Something went wrong. Please try again, or contact support if this continues.
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
            >
              Back to Dashboard
            </button>
            <button
              onClick={resetForm}
              className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // QR Cash™ payment confirmed — brief interstitial
  if (giftConfirmed) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <CheckCircle className="mx-auto mb-4" size={64} style={{ color: '#d97706' }} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            QR Cash™ payment confirmed
          </h2>
          <p className="text-gray-600">
            Your gift has been attached to this Greet-Me
          </p>
        </div>
      </div>
    );
  }

  // Processing State
  if (sending || jobStatus === 'processing' || jobStatus === 'queued') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Loader className="mx-auto text-blue-500 mb-4 animate-spin" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {jobStatus === 'queued' ? 'Preparing your moment...' : 'Bringing your greeting to life...'}
          </h2>
          <p className="text-gray-600">
            This may take a moment. Something special is being created just for them.
          </p>
          <div className="mt-8 bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2 text-blue-600">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm text-blue-800 mt-2">
              Making it personal, making it unforgettable...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Form State
  return (
    <div className="max-w-2xl mx-auto">
      {/* Background Frame for Page Body */}
      <div style={{
        background: '#f8fafc',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid #e2e8f0',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Banner Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem 1.5rem',
          marginBottom: '1.5rem',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            margin: 0
          }}>Send a Greet-Me™</h1>
          <p style={{
            fontSize: '0.9375rem',
            opacity: 0.9,
            marginTop: '0.25rem',
            fontStyle: 'italic'
          }}>Just Because</p>
        </div>
        {contacts.length === 0 && !showInlineAdd && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <span style={{ color: '#92400e', fontSize: '0.875rem' }}>
              Add your first recipient to send a Greet-Me.
            </span>
            <button
              type="button"
              onClick={() => setShowInlineAdd(true)}
              style={{
                padding: '0.4rem 1rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              + Add Recipient
            </button>
          </div>
        )}
        {showInlineAdd && (
          <div style={{
            background: 'white',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
          }}>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Add a recipient
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Name"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem',
                  border: '1px solid var(--border, #e5e7eb)', borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none',
                }}
              />
              <input
                type="email"
                placeholder="Email"
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem',
                  border: '1px solid var(--border, #e5e7eb)', borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none',
                }}
              />
              {addContactError && (
                <p style={{ color: 'var(--error, #ef4444)', fontSize: '0.75rem', margin: 0 }}>{addContactError}</p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={handleInlineAddContact}
                  disabled={addingContact}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: addingContact ? '#d1d5db' : '#667eea',
                    color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem', fontWeight: 600,
                    cursor: addingContact ? 'default' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {addingContact ? 'Adding...' : 'Add & Continue'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowInlineAdd(false); setAddContactError(null); }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'transparent', color: 'var(--text-secondary, #6b7280)',
                    border: '1px solid var(--border, #e5e7eb)', borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem', fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
            <a
              href="#/dashboard/contacts"
              style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary, #9ca3af)', marginTop: '0.75rem', textDecoration: 'underline' }}
            >
              Or manage all contacts
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-10">
        {/* Referral banner */}
        {referralCode && referralValue && (
          <div style={{
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            borderRadius: '0.75rem',
            border: '1px solid #6ee7b7',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <span style={{ fontSize: '1.5rem' }}>🎁</span>
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: '#065f46', fontSize: '0.9375rem' }}>
                ${(referralValue / 100).toFixed(0)} Greet-Me Credit Applied
              </p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#047857' }}>
                Your $10 credit has been applied toward this Greet-Me subscription. Terms and conditions apply.
              </p>
            </div>
          </div>
        )}
        {referralError && (
          <Alert type="error" message={referralError} />
        )}
        {errors.submit && <Alert type="error" message={errors.submit} />}
        {errors.photo && <Alert type="error" message={errors.photo} />}

        {/* Recipient, Occasion, and Tone - Side by Side */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {/* Select Contact */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Recipient <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowInlineAdd(true)}
                style={{ fontSize: '0.75rem', color: '#667eea', background: 'none', border: 'none', fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                + Add New
              </button>
            </div>
            <select
              name="contactId"
              value={formData.contactId}
              onChange={handleChange}
              disabled={contacts.length === 0}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: errors.contactId ? '2px solid var(--error)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                WebkitAppearance: 'menulist',
                appearance: 'menulist',
                cursor: 'pointer',
                touchAction: 'manipulation',
                position: 'relative',
                zIndex: 1,
                fontSize: '0.875rem',
                outline: 'none'
              }}
            >
              <option value="">Choose...</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
            {errors.contactId && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.contactId}</p>}
          </div>

          {/* Occasion - Free Text Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Occasion <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="occasionType"
              value={formData.occasionType}
              onChange={handleChange}
              placeholder="e.g., Thinking of you"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: errors.occasionType ? '2px solid var(--error)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
            {errors.occasionType && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.occasionType}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '0.375rem' }}>
              {[
                { label: 'Birthday', value: 'Birthday' },
                { label: 'Anniversary', value: 'Anniversary' },
                { label: 'Thank You', value: 'Thank You' },
                { label: 'Get Well', value: 'Get Well' },
                { label: 'Congrats', value: 'Congratulations' },
                { label: 'Just Because', value: 'Just Because' },
              ].map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, occasionType: chip.value }));
                    if (errors.occasionType) setErrors(prev => ({ ...prev, occasionType: '' }));
                  }}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.6875rem',
                    borderRadius: '999px',
                    border: `1px solid ${formData.occasionType === chip.value ? '#667eea' : 'var(--border, #e5e7eb)'}`,
                    background: formData.occasionType === chip.value ? '#eef2ff' : 'transparent',
                    color: formData.occasionType === chip.value ? '#667eea' : 'var(--text-tertiary, #9ca3af)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                    fontWeight: formData.occasionType === chip.value ? 600 : 400,
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tone Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tone
            </label>
            <select
              name="tone"
              value={formData.tone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={{ fontSize: '0.875rem' }}
            >
              <option value="warm">Warm</option>
              <option value="funny">Funny</option>
              <option value="heartfelt">Heartfelt</option>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
            </select>
          </div>
        </div>

        {/* Personal Sentiment Textarea */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Personal Sentiment (Optional)
          </label>
          <textarea
            name="customMessage"
            value={formData.customMessage}
            onChange={handleChange}
            rows={3}
            maxLength={280}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Add a personal touch or give Greet-Me™ a hint about what to say..."
          />
          <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
            <span>Your message will appear on the card. Longer messages may not be spoken aloud.</span>
            <span className="text-gray-400 ml-2 flex-shrink-0">{(formData.customMessage || '').length}/280</span>
          </div>
        </div>

        {/* Photo Selection Section */}
        <div style={{
          marginTop: '1.5rem',
          marginBottom: '1.5rem',
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
            marginBottom: '0.5rem'
          }}>
            <Camera size={18} style={{ color: '#3b82f6' }} />
            <span>Choose Photos</span>
          </h3>
          <p style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            marginBottom: '1rem'
          }}>
            Select photos to include with this Greet-Me™. If no photos are added, your saved memory photos will be included by default unless disabled.
          </p>

          {/* Hidden file inputs */}
          <input
            type="file"
            ref={defaultPhotoInputRef}
            onChange={handleDefaultPhotoChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <input
            type="file"
            ref={memoryPhotoInputRef}
            onChange={handleMemoryPhotoAdd}
            accept="image/*"
            style={{ display: 'none' }}
          />

          {/* Selected Photo Preview */}
          {defaultPhoto && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.25rem',
              border: '2px solid #22c55e'
            }}>
              <img
                src={defaultPhoto}
                alt="Selected Photo"
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: 'var(--radius-md)',
                  objectFit: 'cover',
                  border: '2px solid white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  flexShrink: 0,
                  cursor: 'pointer'
                }}
                onClick={() => window.open(defaultPhoto, '_blank')}
                title="Click to enlarge"
              />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#166534', margin: 0 }}>
                  Photo Selected
                </p>
                <p style={{ fontSize: '0.75rem', color: '#15803d', margin: '0.125rem 0 0 0' }}>
                  This photo will be included with your Greet-Me
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDefaultPhoto(null)}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: 'white',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <X size={14} />
                Remove
              </button>
            </div>
          )}

          {/* Hidden file input for adding to memory album */}
          <input
            type="file"
            ref={addToMemoryInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  // Add to the local memoryPhotos array (for this session)
                  setMemoryPhotos(prev => [...prev, reader.result]);
                };
                reader.readAsDataURL(file);
              }
              e.target.value = '';
            }}
            accept="image/*"
            style={{ display: 'none' }}
          />

          {/* Option 1: Recipient's Memory Photos */}
          {formData.contactId && (
            <div style={{
              marginBottom: '1.25rem',
              padding: '1rem',
              background: useMemoryPhotos
                ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
                : 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
              borderRadius: 'var(--radius-lg)',
              border: useMemoryPhotos ? '1px solid #93c5fd' : '1px solid #e5e7eb',
              opacity: useMemoryPhotos ? 1 : 0.7,
              transition: 'all 0.2s'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: useMemoryPhotos ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>1</div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: useMemoryPhotos ? '#1e40af' : '#6b7280', margin: 0 }}>
                    {selectedContact?.name}'s Memory Photos
                  </h4>
                </div>
                {/* Checkbox to enable/disable memory photos */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: useMemoryPhotos ? '#3b82f6' : '#9ca3af'
                }}>
                  <input
                    type="checkbox"
                    checked={useMemoryPhotos}
                    onChange={(e) => setUseMemoryPhotos(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: '#3b82f6',
                      cursor: 'pointer'
                    }}
                  />
                  Include
                </label>
              </div>
              <p style={{ fontSize: '0.75rem', color: useMemoryPhotos ? '#1d4ed8' : '#9ca3af', marginBottom: '0.75rem' }}>
                {contactMemoryPhotos.length > 0
                  ? 'Use photos you\'ve already saved for this recipient'
                  : 'No memory photos saved yet - add some below!'}
              </p>
              {useMemoryPhotos && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                  gap: '0.5rem'
                }}>
                  {contactMemoryPhotos.map((photo, index) => {
                    const photoUrl = typeof photo === 'string' ? photo : photo?.url;
                    if (!photoUrl) return null;
                    const isIncluded = !excludedMemoryPhotos.has(photoUrl);
                    return (
                      <div
                        key={`contact-${index}`}
                        onClick={() => toggleMemoryPhotoSelection(photoUrl)}
                        style={{
                          position: 'relative',
                          paddingBottom: '100%',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          border: isIncluded ? '2px solid #3b82f6' : '2px solid #d1d5db',
                          cursor: 'pointer',
                          boxShadow: isIncluded ? '0 2px 8px rgba(59, 130, 246, 0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s',
                          opacity: isIncluded ? 1 : 0.5
                        }}
                      >
                        <img
                          src={photoUrl}
                          alt={`Memory ${index + 1}`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        {/* Selection Checkbox */}
                        <div style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          background: isIncluded ? '#3b82f6' : 'rgba(255, 255, 255, 0.9)',
                          border: isIncluded ? '2px solid #3b82f6' : '2px solid #9ca3af',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                        }}>
                          {isIncluded && (
                            <Check size={12} color="white" strokeWidth={3} />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Photo to Memory Album Placeholder */}
                  <div
                    onClick={() => addToMemoryInputRef.current?.click()}
                    style={{
                      position: 'relative',
                      paddingBottom: '100%',
                      borderRadius: 'var(--radius-md)',
                      border: '2px dashed #93c5fd',
                      background: 'rgba(255, 255, 255, 0.8)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    title="Add photo to memory album"
                  >
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
                      color: '#3b82f6'
                    }}>
                      <Plus size={18} />
                      <span style={{ fontSize: '0.5rem', fontWeight: 600, marginTop: '0.125rem' }}>Add</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Option 2: Add Photos for This Occasion */}
          <div style={{
            marginBottom: '1.25rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #c4b5fd'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#8b5cf6',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>{formData.contactId && contactMemoryPhotos.length > 0 ? '2' : '1'}</div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b21a8', margin: 0 }}>
                Add Photo for This Occasion
              </h4>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#7c3aed', marginBottom: '0.75rem' }}>
              Upload a new photo specifically for this Greet-Me
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
              gap: '0.5rem'
            }}>
              {/* Photos added for this occasion */}
              {memoryPhotos.map((photoUrl, index) => {
                const isSelected = photoUrl === defaultPhoto;
                return (
                  <div key={`local-${index}`} style={{ position: 'relative' }}>
                    <div
                      onClick={() => setDefaultPhoto(photoUrl)}
                      style={{
                        position: 'relative',
                        paddingBottom: '100%',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        border: isSelected ? '3px solid #22c55e' : '2px solid white',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 2px 8px rgba(34, 197, 94, 0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <img
                        src={photoUrl}
                        alt={`Added ${index + 1}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          bottom: '4px',
                          left: '4px',
                          background: '#22c55e',
                          color: 'white',
                          fontSize: '0.5rem',
                          fontWeight: 700,
                          padding: '2px 4px',
                          borderRadius: '3px'
                        }}>
                          Selected
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveMemoryPhoto(index); }}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '18px',
                        height: '18px',
                        background: 'rgba(255, 255, 255, 0.95)',
                        color: '#dc2626',
                        border: 'none',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }}
                      title="Remove photo"
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}

              {/* Add Photo Button */}
              <div
                onClick={() => memoryPhotoInputRef.current?.click()}
                style={{
                  position: 'relative',
                  paddingBottom: '100%',
                  borderRadius: 'var(--radius-md)',
                  border: '2px dashed #a78bfa',
                  background: 'white',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
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
                  color: '#8b5cf6'
                }}>
                  <Plus size={18} />
                  <span style={{ fontSize: '0.5rem', fontWeight: 600, marginTop: '0.125rem' }}>Upload</span>
                </div>
              </div>
            </div>
          </div>

          {/* Option 3: Media Library */}
          <div style={{
            padding: '1rem',
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #7dd3fc'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#0ea5e9',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>{formData.contactId && contactMemoryPhotos.length > 0 ? '3' : '2'}</div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0369a1', margin: 0 }}>
                Browse Media Library
              </h4>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#0284c7', marginBottom: '0.75rem' }}>
              Choose from your collection of saved photos and media
            </p>
            <button
              type="button"
              onClick={() => {
                // Save current state before navigating to media library
                const excludedArray = Array.from(excludedMemoryPhotos);
                const stateToSave = {
                  formData,
                  giftSettings,
                  defaultPhoto,
                  memoryPhotos,
                  useMemoryPhotos,
                  excludedMemoryPhotos: excludedArray
                };
                sessionStorage.setItem('sendGreetingState', JSON.stringify(stateToSave));
                navigate('/dashboard/media?select=photo&returnTo=send');
              }}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'white',
                border: '2px solid #0ea5e9',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
            >
              <Camera size={18} />
              Open Media Library
            </button>
          </div>
        </div>

        {/* Add a Gift - Modal Button */}
        <div className="mt-10 mb-10">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add a Gift (Optional)
          </label>
          <div style={{
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
            border: '2px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '0.75rem',
            padding: '1.5rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)'
              }}>
                <Gift size={24} style={{ color: 'white' }} />
              </div>
              <div>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#1f2937',
                  marginBottom: '0.25rem'
                }}>Make it Extra Special</h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#6b7280'
                }}>Add QR Cash, curated gifts, or browse our marketplace</p>
              </div>
            </div>

            {/* Add/Edit Gift Button */}
            <button
              type="button"
              onClick={() => setIsGiftModalOpen(true)}
              style={{
                width: '100%',
                padding: '0.875rem 1.5rem',
                background: giftSettings.type !== 'none' ? '#10b981' : '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Gift size={18} />
              {giftSettings.type !== 'none' ? 'Edit Gift' : 'Add a Gift (Optional)'}
            </button>

            {/* Gift Summary */}
            {giftSettings.type !== 'none' && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.75rem 1rem',
                background: '#dcfce7',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#16a34a'
                }}>
                  {giftSettings.type === 'qrcash' && (
                    <>Gift: QR Cash (${giftSettings.amount === 0 ? giftSettings.customAmount || '0' : giftSettings.amount})</>
                  )}
                  {giftSettings.type === 'curated' && (
                    <>Gift: Curated (Max ${giftSettings.maxSpend}){giftSettings.qrCashAddOn && ` + QR Cash ($${giftSettings.qrCashAddOnAmount === 0 ? giftSettings.qrCashAddOnCustomAmount || '0' : giftSettings.qrCashAddOnAmount || 25})`}</>
                  )}
                  {giftSettings.type === 'merch' && (
                    <>Gift: Merch{giftSettings.qrCashAddOn && ` + QR Cash ($${giftSettings.qrCashAddOnAmount === 0 ? giftSettings.qrCashAddOnCustomAmount || '0' : giftSettings.qrCashAddOnAmount || 25})`}</>
                  )}
                  {giftSettings.type === 'marketplace' && (
                    <>Gift: American Gift Place{giftSettings.qrCashAddOn && ` + QR Cash ($${giftSettings.qrCashAddOnAmount === 0 ? giftSettings.qrCashAddOnCustomAmount || '0' : giftSettings.qrCashAddOnAmount || 25})`}</>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setGiftSettings(prev => ({ ...prev, type: 'none' }))}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div style={{
          marginTop: '3rem',
          paddingTop: '2rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <button
            type="submit"
            disabled={contacts.length === 0 || sending}
            style={{
              padding: '0.75rem 2rem',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'white',
              cursor: contacts.length === 0 || sending ? 'not-allowed' : 'pointer',
              opacity: contacts.length === 0 || sending ? 0.5 : 1,
              transition: 'all 0.2s',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
            }}
            title="Send Greet-Me"
          >
            <Send size={18} />
            {sending ? 'Sending...' : 'Done & Send'}
          </button>
        </div>
      </form>
      </div>

      {/* Gift Selector Modal */}
      <GiftSelectorModal
        isOpen={isGiftModalOpen}
        onClose={() => setIsGiftModalOpen(false)}
        occasions={[{ type: 'just_because', date: new Date().toISOString().split('T')[0] }]}
        occasionGiftSettings={{ just_because: giftSettings }}
        onGiftChange={(occasionType, field, value) => {
          setGiftSettings(prev => ({ ...prev, [field]: value }));
        }}
        getOccasionLabel={() => 'Just Because'}
        getOccasionEmoji={() => '💝'}
        context="oneoff"
        onBrowse={(type) => {
          // Save current state to sessionStorage before navigating
          const stateToSave = {
            formData,
            giftSettings,
            defaultPhoto,
            memoryPhotos,
            useMemoryPhotos,
            excludedMemoryPhotos: Array.from(excludedMemoryPhotos)
          };
          sessionStorage.setItem('sendGreetingState', JSON.stringify(stateToSave));

          // Close the modal and navigate to the appropriate page
          setIsGiftModalOpen(false);
          if (type === 'merch') {
            navigate('/dashboard/merch?returnTo=send&giftType=merch');
          } else if (type === 'marketplace') {
            navigate('/dashboard/gifts?returnTo=send&giftType=marketplace');
          }
        }}
      />

      {/* QR Cash™ Confirmation Modal */}
      <GiftConfirmationModal
        isOpen={isGiftConfirmOpen}
        onClose={() => {
          setIsGiftConfirmOpen(false);
          setPendingGreetingData(null);
          setGiftChargeError(null);
        }}
        onConfirm={handleGiftConfirm}
        giftAmountCents={(() => {
          const amt = giftSettings.amount === 0
            ? (giftSettings.customAmount || 0)
            : (giftSettings.amount || 25);
          return Math.round(amt * 100);
        })()}
        feeCents={(() => {
          const amt = giftSettings.amount === 0
            ? (giftSettings.customAmount || 0)
            : (giftSettings.amount || 25);
          return 199 + Math.round(amt * 100 * 0.03);
        })()}
        totalCents={(() => {
          const amt = giftSettings.amount === 0
            ? (giftSettings.customAmount || 0)
            : (giftSettings.amount || 25);
          const amtCents = Math.round(amt * 100);
          return amtCents + 199 + Math.round(amtCents * 0.03);
        })()}
        charging={giftCharging}
        chargeError={giftChargeError}
      />
    </div>
  );
}
