// src/pages/Profile.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Profile = () => {
  const { user, getToken } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [recording, setRecording] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'https://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net';

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'voice', label: 'Voice', icon: '🎙️' },
    { id: 'photo', label: 'Photo', icon: '📸' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile</h1>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-3 font-medium ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Account Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={user?.name || ''}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  disabled
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'voice' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Voice Recording</h2>
            <p className="text-gray-600 mb-4">Record your voice for personalized greetings (30-60 seconds)</p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">
              {recording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
            </button>
          </div>
        )}

        {activeTab === 'photo' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Profile Photo</h2>
            <p className="text-gray-600 mb-4">Upload a clear photo of yourself for video greetings</p>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">
              📸 Upload Photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
