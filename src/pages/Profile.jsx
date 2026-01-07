// src/pages/Profile.jsx
import React, { useState, useEffect } from 'react';
import { User, Mic, Camera } from 'lucide-react';
import api from "../api/api";
import VoiceRecorder from '../components/VoiceRecorder';
import PhotoUpload from '../components/PhotoUpload';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const [activeTab, setActiveTab] = useState('info');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.getProfile();
      setProfile(response.data);
    } catch (error) {
      showAlert('error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleVoiceUpload = async (formData) => {
  try {
    // Add userId to formData
    if (user?.id || user?.email) {
      formData.append('userId', user.id || user.email);
    }
    await api.uploadVoice(formData);
    showAlert('success', 'Voice uploaded successfully! Processing may take a moment.');
    fetchProfile();
  } catch (error) {
    throw error;
  }
};

  const handlePhotoUpload = async (formData) => {
  try {
    // Add userId to formData
    if (user?.id || user?.email) {
      formData.append('userId', user.id || user.email);
    }
    await api.uploadPhoto(formData);
    showAlert('success', 'Photo uploaded successfully!');
    fetchProfile();
  } catch (error) {
    throw error;
  }
};

  const tabs = [
    { id: 'info', label: 'Profile Info', icon: <User size={18} /> },
    { id: 'voice', label: 'Voice Setup', icon: <Mic size={18} /> },
    { id: 'photo', label: 'Photo Upload', icon: <Camera size={18} /> },
  ];

  if (loading) {
    return <LoadingSpinner text="Loading profile..." />;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile</h1>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 pb-4 border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.icon}
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {activeTab === 'info' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={profile?.name || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Your voice and photo are used to create personalized AI-generated greetings. 
                Configure them in the Voice Setup and Photo Upload tabs.
              </p>
            </div>

            {/* Status Indicators */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className={`border rounded-lg p-4 ${profile?.voiceId ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center space-x-2 mb-1">
                  <Mic size={20} className={profile?.voiceId ? 'text-green-600' : 'text-gray-400'} />
                  <span className="font-medium text-gray-900">Voice</span>
                </div>
                <p className={`text-sm ${profile?.voiceId ? 'text-green-600' : 'text-gray-500'}`}>
                  {profile?.voiceId ? '✓ Configured' : 'Not configured'}
                </p>
              </div>

              <div className={`border rounded-lg p-4 ${profile?.photoUrl ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center space-x-2 mb-1">
                  <Camera size={20} className={profile?.photoUrl ? 'text-green-600' : 'text-gray-400'} />
                  <span className="font-medium text-gray-900">Photo</span>
                </div>
                <p className={`text-sm ${profile?.photoUrl ? 'text-green-600' : 'text-gray-500'}`}>
                  {profile?.photoUrl ? '✓ Configured' : 'Not configured'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'voice' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Record Your Voice
            </h3>
            <p className="text-gray-600 mb-6">
              Record a 30-60 second voice sample. This will be used to clone your voice for personalized greetings.
            </p>
            <VoiceRecorder
              onUpload={handleVoiceUpload}
              existingVoice={profile?.voiceId}
            />
          </div>
        )}

        {activeTab === 'photo' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Upload Your Photo
            </h3>
            <p className="text-gray-600 mb-6">
              Upload a clear photo of yourself. This will be used to create animated video greetings.
            </p>
            <PhotoUpload
              onUpload={handlePhotoUpload}
              existingPhoto={profile?.photoUrl}
            />
          </div>
        )}
      </div>
    </div>
  );
}
