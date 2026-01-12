// src/pages/SendGreeting.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, CheckCircle, XCircle, Loader, Edit3, Zap, Gift, ArrowLeft, Camera } from 'lucide-react';
import { occasionTypes } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import GreetingDraftEditor from '../components/GreetingDraftEditor';

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
  });
  const [errors, setErrors] = useState({});

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

      if (response.status === 'completed' || response.status === 'failed') {
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    const selectedContact = contacts.find(c => c.id === formData.contactId);
    if (!selectedContact) return;

    setSending(true);
    setJobStatus(null);
  try {
    const greetingData = {
      userId: user?.id || user?.email || '',
      recipientName: selectedContact.name,
      recipientEmail: selectedContact.email,
      greetingText: formData.customMessage || '',
      voiceId: user?.voiceId || '',
      photoUrl: user?.photoUrl || 'https://via.placeholder.com/512',
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
      customMessage: '',
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
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Send a Greeting</h1>
      <p className="text-gray-600 mb-6">
        Create and send a personalized AI greeting to one of your contacts.
      </p>

      {contacts.length === 0 && (
        <Alert
          type="warning"
          message="You don't have any contacts yet. Add contacts first to send greetings."
        />
      )}

      {/* Top Action Buttons */}
      <div className="flex justify-end space-x-3 mb-4">
        <button
          type="button"
          onClick={() => alert('Draft saved!')}
          className="px-6 py-2 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            document.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }}
          disabled={contacts.length === 0 || sending}
          className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Done & Send'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {errors.submit && <Alert type="error" message={errors.submit} />}

        {/* Select Contact */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Contact <span className="text-red-500">*</span>
          </label>
          <select
            name="contactId"
            value={formData.contactId}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.contactId ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={contacts.length === 0}
          >
            <option value="">Choose a contact...</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name} ({contact.email})
              </option>
            ))}
          </select>
          {errors.contactId && <p className="mt-1 text-sm text-red-500">{errors.contactId}</p>}
        </div>

        {/* Select Occasion */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Occasion <span className="text-red-500">*</span>
          </label>
          <select
            name="occasionType"
            value={formData.occasionType}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.occasionType ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Choose an occasion...</option>
            {occasionTypes.map((occasion) => (
              <option key={occasion.value} value={occasion.value}>
                {occasion.icon} {occasion.label}
              </option>
            ))}
            <option value="other">Other</option>
          </select>
          {errors.occasionType && <p className="mt-1 text-sm text-red-500">{errors.occasionType}</p>}

          {/* Other Occasion Field */}
          {formData.occasionType === 'other' && (
            <div className="mt-3">
              <input
                type="text"
                name="customOccasion"
                value={formData.customOccasion}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter custom occasion..."
              />
            </div>
          )}

          {/* Recurring Toggle */}
          <div className="mt-3 flex items-center">
            <input
              type="checkbox"
              id="isRecurring"
              name="isRecurring"
              checked={formData.isRecurring}
              onChange={(e) => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isRecurring" className="ml-2 block text-sm text-gray-700">
              Make this a recurring occasion (send annually)
            </label>
          </div>
        </div>

        {/* AI Context */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            AI Context (Optional)
          </label>
          <textarea
            name="aiContext"
            value={formData.aiContext}
            onChange={handleChange}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add context to help AI personalize your greeting (e.g., 'They just got promoted' or 'We met at a conference')..."
          />
          <p className="mt-1 text-xs text-gray-500">
            Help AI generate a more personalized greeting
          </p>
        </div>

        {/* Custom Message */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Message (Optional)
          </label>
          <textarea
            name="customMessage"
            value={formData.customMessage}
            onChange={handleChange}
            rows="4"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add a personal touch to your greeting..."
          />
          <p className="mt-1 text-xs text-gray-500">
            This will be incorporated into the AI-generated message
          </p>
        </div>

        {/* Memory Album */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Memory Album (Optional)
          </label>
          <div className="grid grid-cols-2 gap-4">
            {/* Default Photo Pane */}
            <div className="border-2 border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">Default Photo</h4>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✓ Default
                </span>
              </div>
              <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-400">
                <Camera size={48} />
              </div>
              <button
                type="button"
                className="w-full px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
              >
                Upload Photo
              </button>
              <button
                type="button"
                className="w-full mt-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
              >
                Select from Media Library
              </button>
            </div>

            {/* Memory Photos Pane */}
            <div className="border-2 border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Memory Photos</h4>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                  <Camera size={32} />
                </div>
                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                  <Camera size={32} />
                </div>
              </div>
              <button
                type="button"
                className="w-full px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
              >
                Add Memory Photos
              </button>
              <p className="mt-2 text-xs text-gray-500">Upload multiple photos to create a memory album</p>
            </div>
          </div>
        </div>

        {/* Add a Gift (Coming Soon) */}
        <div className="mb-6">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Gift size={20} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Add a Gift</h3>
                  <p className="text-xs text-gray-600">Make it extra special with an American-made gift</p>
                </div>
              </div>
              <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                Coming Soon
              </span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-between items-center">
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
    </div>
  );
}
