// src/pages/SendGreeting.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, CheckCircle, XCircle, Loader, Edit3, Zap } from 'lucide-react';
import { occasionTypes } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import GreetingDraftEditor from '../components/GreetingDraftEditor';
import { convertDraftToSendFormat } from '../models/greetingDraft';
import draftService from '../services/draftService';

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
    customMessage: '',
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
      draftService.markDraftAsSent(draft.contactId, draft.occasionType);
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {occasionTypes.map((occasion) => (
              <button
                key={occasion.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, occasionType: occasion.value }))}
                className={`p-3 border-2 rounded-lg text-left transition ${
                  formData.occasionType === occasion.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl block mb-1">{occasion.icon}</span>
                <span className="text-sm font-medium text-gray-900">{occasion.label}</span>
              </button>
            ))}
          </div>
          {errors.occasionType && <p className="mt-1 text-sm text-red-500">{errors.occasionType}</p>}
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
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={contacts.length === 0 || sending}
              className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center"
              title="Quick send with simple message"
            >
              <Zap size={18} className="mr-2" />
              {sending ? 'Sending...' : 'Quick Send'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
