// src/pages/SendGreeting.jsx

import { useState, useEffect } from 'react';
import { getPhotoSrc } from '../utils/getPhotoSrc';
import { useNavigate } from 'react-router-dom';
import { Send, CheckCircle, XCircle, Loader, Edit3, Gift, ArrowLeft, Camera, Plus, X } from 'lucide-react';
import { useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import GiftSelectorModal from '../components/GiftSelectorModal';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import GreetingDraftEditor from '../components/GreetingDraftEditor';
import { pushInApp } from '../utils/notify';
import { COMMS_EVENTS } from '../utils/commsCatalog';
import { awardGreetingHearts } from '../utils/rewards';

// TEMP STUB — models layer intentionally disabled for V1 build safety
const greetingDraftModel = {
  createEmpty: () => ({
    message: "",
    tone: "warm",
    occasion: "",
    recipientName: "",
  }),
  normalize: (draft) => draft ?? {},
  validate: () => ({ ok: true, errors: [] }),
};


export default function SendGreeting() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [editorMode, setEditorMode] = useState(false); // Simple form vs advanced editor
  const [formData, setFormData] = useState({
    contactId: '',
    occasionType: '',
    customOccasion: '',
    customMessage: '',
    isRecurring: false,
    aiContext: '',
    giftAmount: '',
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

  // Photo state
  const [defaultPhoto, setDefaultPhoto] = useState(null);
  const [memoryPhotos, setMemoryPhotos] = useState([]);
  const MAX_MEMORY_PHOTOS = 8;
  const defaultPhotoInputRef = useRef(null);
  const memoryPhotoInputRef = useRef(null);

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

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    if (jobId) {
      const interval = setInterval(pollJobStatus, 2000);
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
    console.error("Failed to fetch contacts:", error);
    setContacts([]);
  } finally {
    setLoading(false);
  }
};


  const pollJobStatus = async () => {
    try {
      const response = await api.getJobStatus(jobId);
      setJobStatus(response.status);

      if (response.status === 'completed') {
        setJobId(null);
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
      console.error('Failed to poll job status:', error);
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
      newErrors.photo = 'Please upload a Default Greeting Photo in the Your Presence section on the Dashboard.';
    }

    setErrors(newErrors);
    console.log("🔴 validate() newErrors:", newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("🔴 handleSubmit FIRED", { formData, user });

    if (!validate()) {
      console.log("🔴 validate() returned FALSE - check newErrors above");
      return;
    }
    console.log("🔴 validate() PASSED, proceeding to send");

    const selectedContact = contacts.find(c => c.id === formData.contactId);
    if (!selectedContact) return;

    setSending(true);
    setJobStatus(null);
  try {
    // Use user.photoUrl from backend profile (real Azure Blob URL)
    // Do NOT use localStorage data URLs - they cannot be fetched by the worker
    const effectivePhotoUrl = user?.photoUrl || '';

    const greetingData = {
      userId: user?.id || user?.email || '',
      recipientName: selectedContact.name,
      recipientEmail: selectedContact.email,
      greetingText: formData.customMessage || '',
      voiceId: user?.voiceId || '',
      photoUrl: effectivePhotoUrl,
      occasionKey: formData.occasionType,
      relationshipKey: selectedContact.relationship || 'friend',
      relationshipNote: '',
      personalSentiment: formData.customMessage || '',
};
      const response = await api.sendGreeting(greetingData);
      setJobId(response.jobId);
      setJobStatus('queued');
    } catch (error) {
      setErrors({ submit: error.message });
      setSending(false);
    }
  };

  const handleSendFromEditor = async (draft) => {
    const selectedContact = contacts.find(c => c.id === draft.contactId);
    if (!selectedContact) return;

    setSending(true);
    setJobStatus(null);
    setEditorMode(false);

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
      setErrors({ submit: error.message });
      setSending(false);
    }
  };

  const resetForm = () => {
    setFormData({
      contactId: '',
      occasionType: '',
      customOccasion: '',
      customMessage: '',
      isRecurring: false,
      aiContext: '',
      giftAmount: '',
    });
    setJobId(null);
    setJobStatus(null);
    setSending(false);
    setErrors({});
    setEditorMode(false);
  };

  if (loading) {
    return <LoadingSpinner text="Loading contacts..." />;
  }

  // Success State
  if (jobStatus === 'completed') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Greeting Sent Successfully!</h2>
          <p className="text-gray-600 mb-8">
            Your personalized greeting has been delivered.
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
              Send Another
            </button>
          </div>
        </div>

        {/* QR Cash Microcopy */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'var(--gray-50)',
          borderRadius: '0.5rem',
          borderLeft: '4px solid #f59e0b',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)'
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>Add QR Cash — Send · Scan · Spend</strong>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
            It prints inside the card so the recipient can deposit it like cash.
          </p>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sending Failed</h2>
          <p className="text-gray-600 mb-8">
            There was an error sending your greeting. Please try again.
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

  // Processing State
  if (sending || jobStatus === 'processing' || jobStatus === 'queued') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Loader className="mx-auto text-blue-500 mb-4 animate-spin" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {jobStatus === 'queued' ? 'Queued...' : 'Creating Your Greeting...'}
          </h2>
          <p className="text-gray-600">
            This may take a minute while we generate your personalized video greeting.
          </p>
          <div className="mt-8 bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2 text-blue-600">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm text-blue-800 mt-2">
              Generating AI voice, animating photo, and preparing email...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Editor Mode - Multi-page greeting editor
  if (editorMode && formData.contactId && formData.occasionType) {
    const selectedContact = contacts.find(c => c.id === formData.contactId);

    return (
      <div className="max-w-6xl mx-auto">
        <GreetingDraftEditor
          contactId={formData.contactId}
          occasionType={formData.occasionType}
          contact={selectedContact}
          userProfile={user}
          onSave={(draft) => {
            // Draft saved, show success message
            alert('Draft saved! You can continue editing or send it.');
          }}
          onCancel={() => {
            setEditorMode(false);
          }}
          onSend={handleSendFromEditor}
        />
      </div>
    );
  }

  // Form State
  return (
    <div className="max-w-2xl mx-auto">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'transparent',
            border: '1px solid #000000',
            borderRadius: '0.5rem',
            color: '#000000',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f3f4f6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mt-2">Send a Greeting Just Because!</h1>
      <p className="text-gray-600 mt-2 mb-6">
        Create and send a one-off personalized greeting to one of your recipients.
      </p>

      {contacts.length === 0 && (
        <Alert
          type="warning"
          message="You don't have any contacts yet. Add contacts first to send greetings."
        />
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-10">
        {errors.submit && <Alert type="error" message={errors.submit} />}
        {errors.photo && <Alert type="error" message={errors.photo} />}

        {/* Select Contact */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Recipient <span className="text-red-500">*</span>
          </label>
          <select
            name="contactId"
            value={formData.contactId}
            onChange={handleChange}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.contactId ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={contacts.length === 0}
            style={{
              WebkitAppearance: 'menulist',
              appearance: 'menulist',
              cursor: 'pointer',
              touchAction: 'manipulation',
              position: 'relative',
              zIndex: 1
            }}
          >
            <option value="">Choose a recipient...</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name} ({contact.email})
              </option>
            ))}
          </select>
          {errors.contactId && <p className="mt-1 text-sm text-red-500">{errors.contactId}</p>}
        </div>

        {/* Occasion - Free Text Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Occasion <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="occasionType"
            value={formData.occasionType}
            onChange={handleChange}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.occasionType ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="What's the occasion? (e.g., Just thinking of you, Congrats on the new job, etc.)"
          />
          {errors.occasionType && <p className="mt-1 text-sm text-red-500">{errors.occasionType}</p>}
          <p className="mt-2 text-xs text-gray-500">
            Enter any occasion or reason for sending this greeting
          </p>
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
                    <>Gift: American Marketplace{giftSettings.qrCashAddOn && ` + QR Cash ($${giftSettings.qrCashAddOnAmount === 0 ? giftSettings.qrCashAddOnCustomAmount || '0' : giftSettings.qrCashAddOnAmount || 25})`}</>
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

        {/* Photo Section - Responsive Grid */}
        <div className="mt-10 mb-10">
          <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
            Photos
          </label>
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
          {/* Responsive grid: stacked on mobile, side-by-side on md+ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Default Photo Pane */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              padding: '1.25rem',
              background: 'white',
              minHeight: '260px'
            }}>
              {/* Panel Header - Centered */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '0.5rem'
              }}>
                <h4 style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#1f2937',
                  marginBottom: '0.25rem'
                }}>Default Photo</h4>
                {defaultPhoto && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.25rem 0.625rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    background: '#dcfce7',
                    color: '#16a34a'
                  }}>
                    ✓ Photo Set
                  </span>
                )}
              </div>
              {/* Panel Content - centered photo viewer */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  width: '140px',
                  height: '140px',
                  background: defaultPhoto ? 'transparent' : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: defaultPhoto ? 'none' : '2px dashed #d1d5db',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {defaultPhoto ? (
                    <>
                      <img
                        src={defaultPhoto}
                        alt="Default"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '0.5rem'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setDefaultPhoto(null)}
                        style={{
                          position: 'absolute',
                          top: '0.25rem',
                          right: '0.25rem',
                          width: '1.5rem',
                          height: '1.5rem',
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.6)',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <Camera size={20} style={{ color: '#9ca3af' }} />
                  )}
                </div>
              </div>
              {/* Panel Buttons - pinned to bottom */}
              <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => defaultPhotoInputRef.current?.click()}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: '0.375rem',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#16a34a'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#22c55e'}
                >
                  {defaultPhoto ? 'Change Photo' : 'Upload Photo'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/media-library?select=photo')}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'white',
                    color: '#667eea',
                    border: '1px solid #667eea',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#667eea';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = '#667eea';
                  }}
                >
                  Media Library
                </button>
              </div>
            </div>

            {/* Memory Photos Pane */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              padding: '1.25rem',
              background: 'white',
              minHeight: '260px'
            }}>
              {/* Panel Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem'
              }}>
                <h4 style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#1f2937'
                }}>Memory Photos</h4>
                <span style={{
                  fontSize: '0.75rem',
                  color: '#6b7280'
                }}>
                  {memoryPhotos.length}/{MAX_MEMORY_PHOTOS}
                </span>
              </div>
              {/* Panel Content - 4 tile grid */}
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.375rem'
                }}>
                  {/* Always render 4 tiles */}
                  {[0, 1, 2, 3].map((index) => {
                    const photo = memoryPhotos[index];
                    if (photo) {
                      // Filled tile with photo
                      return (
                        <div
                          key={index}
                          style={{
                            aspectRatio: '1',
                            borderRadius: '0.375rem',
                            overflow: 'hidden',
                            position: 'relative'
                          }}
                        >
                          <img
                            src={getPhotoSrc(photo)}
                            alt={`Memory ${index + 1}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveMemoryPhoto(index)}
                            style={{
                              position: 'absolute',
                              top: '0.125rem',
                              right: '0.125rem',
                              width: '1.25rem',
                              height: '1.25rem',
                              borderRadius: '50%',
                              background: 'rgba(0,0,0,0.6)',
                              color: 'white',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0
                            }}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      );
                    } else if (index === memoryPhotos.length && memoryPhotos.length < MAX_MEMORY_PHOTOS) {
                      // Add button tile (first empty slot)
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => memoryPhotoInputRef.current?.click()}
                          style={{
                            aspectRatio: '1',
                            background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                            borderRadius: '0.375rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px dashed #d1d5db',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#667eea';
                            e.currentTarget.style.background = 'rgba(102, 126, 234, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#d1d5db';
                            e.currentTarget.style.background = 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)';
                          }}
                        >
                          <Plus size={18} style={{ color: '#9ca3af' }} />
                        </button>
                      );
                    } else {
                      // Empty placeholder tile
                      return (
                        <div
                          key={index}
                          style={{
                            aspectRatio: '1',
                            background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                            borderRadius: '0.375rem',
                            border: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Camera size={18} style={{ color: '#d1d5db' }} />
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
              {/* Panel Buttons - pinned to bottom */}
              <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => memoryPhotoInputRef.current?.click()}
                  disabled={memoryPhotos.length >= MAX_MEMORY_PHOTOS}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: memoryPhotos.length >= MAX_MEMORY_PHOTOS ? '#9ca3af' : '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: memoryPhotos.length >= MAX_MEMORY_PHOTOS ? 'not-allowed' : 'pointer',
                    marginBottom: '0.375rem',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (memoryPhotos.length < MAX_MEMORY_PHOTOS) {
                      e.currentTarget.style.background = '#16a34a';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (memoryPhotos.length < MAX_MEMORY_PHOTOS) {
                      e.currentTarget.style.background = '#22c55e';
                    }
                  }}
                >
                  Add Photos
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/media-library?select=memories')}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'white',
                    color: '#667eea',
                    border: '1px solid #667eea',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#667eea';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = '#667eea';
                  }}
                >
                  Media Library
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-between items-center pt-10">
          {/* Advanced Editor Toggle */}
          {formData.contactId && formData.occasionType && (
            <button
              type="button"
              onClick={() => setEditorMode(true)}
              className="px-4 py-2 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 font-medium flex items-center space-x-2 border-2 border-purple-200"
            >
              <Edit3 size={18} />
              <span>Advanced Editor</span>
            </button>
          )}

          <div className="flex space-x-3 ml-auto">
            <button
              type="button"
              onClick={() => alert('Draft saved!')}
              className="px-6 py-2 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              Save Draft
            </button>
            <button
              type="submit"
              disabled={contacts.length === 0 || sending}
              className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center"
              title="Send greeting"
            >
              <Send size={18} className="mr-2" />
              {sending ? 'Sending...' : 'Done & Send'}
            </button>
          </div>
        </div>
      </form>

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
      />
    </div>
  );
}
