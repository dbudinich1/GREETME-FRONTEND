// pages/Profile.jsx
// User profile page with voice recording and photo upload

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { PhotoUpload } from '../components/PhotoUpload';
import { useAuth } from '../context/AuthContext';

export const Profile = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(searchParams.get('section') || 'overview');
  const [profile, setProfile] = useState({
    hasVoice: false,
    hasPhoto: false,
    voiceId: null,
    photoUrl: null,
  });

  useEffect(() => {
    // TODO: Fetch user profile from API
    // Simulating API call
    setProfile({
      hasVoice: false,
      hasPhoto: false,
      voiceId: null,
      photoUrl: null,
    });
  }, []);

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '👤' },
    { id: 'voice', name: 'Voice', icon: '🎤' },
    { id: 'photo', name: 'Photo', icon: '📸' },
    { id: 'settings', name: 'Settings', icon: '⚙️' },
  ];

  const handleVoiceRecording = (audioBlob) => {
    console.log('Voice recorded:', audioBlob);
    // TODO: Upload to Azure Blob Storage
    // TODO: Call ElevenLabs API to create custom voice
    // TODO: Save voiceId to user profile
  };

  const handlePhotoSelect = (photoFile) => {
    console.log('Photo selected:', photoFile);
    // TODO: Upload to Azure Blob Storage
    // TODO: Save photoUrl to user profile
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
            Your Profile
          </h1>
          <p className="text-gray-600 text-lg">
            Personalize your greetings with your voice and photo
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Profile completion */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 shadow-lg">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">Profile Setup</h2>
                    <p className="text-gray-600">Complete your profile to unlock all features</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-orange-600">
                      {(profile.hasVoice && profile.hasPhoto) ? '100' : profile.hasVoice || profile.hasPhoto ? '50' : '0'}%
                    </div>
                    <div className="text-sm text-gray-600">Complete</div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Voice setup */}
                  <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${
                    profile.hasVoice 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                      profile.hasVoice 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {profile.hasVoice ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Voice Recording</h3>
                      <p className="text-sm text-gray-600">
                        {profile.hasVoice 
                          ? 'Your voice is ready for greetings' 
                          : 'Record your voice to personalize greetings'}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('voice')}
                      className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                    >
                      {profile.hasVoice ? 'Update' : 'Setup'}
                    </button>
                  </div>

                  {/* Photo setup */}
                  <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${
                    profile.hasPhoto 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                      profile.hasPhoto 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {profile.hasPhoto ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Profile Photo</h3>
                      <p className="text-sm text-gray-600">
                        {profile.hasPhoto 
                          ? 'Your photo is ready for video greetings' 
                          : 'Upload your photo for animated greetings'}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('photo')}
                      className="px-4 py-2 text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      {profile.hasPhoto ? 'Update' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Account info */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 shadow-lg">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">Email</label>
                    <p className="text-gray-900">{user?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">Plan</label>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                        Free Plan
                      </span>
                      <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                        Upgrade
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">Member Since</label>
                    <p className="text-gray-900">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Voice Tab */}
          {activeTab === 'voice' && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 lg:p-8 border border-gray-200 shadow-lg">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Voice Recording</h2>
                <p className="text-gray-600">
                  Record your voice to create personalized greetings that sound like you
                </p>
              </div>
              <VoiceRecorder onRecordingComplete={handleVoiceRecording} />
            </div>
          )}

          {/* Photo Tab */}
          {activeTab === 'photo' && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 lg:p-8 border border-gray-200 shadow-lg">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Profile Photo</h2>
                <p className="text-gray-600">
                  Upload a clear photo for animated video greetings
                </p>
              </div>
              <PhotoUpload currentPhoto={profile.photoUrl} onPhotoSelect={handlePhotoSelect} />
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 lg:p-8 border border-gray-200 shadow-lg">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h2>
              
              <div className="space-y-6">
                {/* Notifications */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500" defaultChecked />
                      <span className="text-gray-700">Email me about upcoming occasions (7 days before)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500" defaultChecked />
                      <span className="text-gray-700">Notify me when greetings are sent</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500" />
                      <span className="text-gray-700">Send me product updates and tips</span>
                    </label>
                  </div>
                </div>

                {/* Privacy */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500" defaultChecked />
                      <span className="text-gray-700">Keep my voice and photo data secure</span>
                    </label>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
                  <button className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-colors">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
