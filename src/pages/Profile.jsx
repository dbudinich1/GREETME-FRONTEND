// src/pages/Profile.jsx - Renamed to Media Library
//
// 🔒 PROTECTED SUBSYSTEM — Locked Viral Loop + Verification Gate + Voice Integrity
//
// This page hosts the persistent voice-stale recovery banner. When the
// authenticated user has `voiceIdStaleAt` set (from the API pre-flight or
// worker safety net), a warm parchment-toned banner appears above the voice
// section inviting them to re-record. The banner disappears immediately on
// successful re-record (backend clears the stale fields atomically).
//
// Any change to this file MUST:
//   1. Declare affected locked milestones (commit SHAs)
//   2. Declare potential regressions
//   3. Pass scripts/verify-creditclaim-viral-loop-lock.mjs
//   4. Fail build if guard violates
// Last reviewed: 2026-05-27 (Stage 3 implementation).

import { useState, useEffect } from 'react';
import { Mic, Camera, Play, Trash2, CheckCircle, Upload, Link as LinkIcon, Star } from 'lucide-react';
import api from "../api/api";
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorMessages';
import { validateAudioFile } from '../utils/helpers';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [voiceFiles, setVoiceFiles] = useState([]);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [playingVoice, setPlayingVoice] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.getProfile();
      // Backend returns { ok: true, profile: {...} }
      const profileData = response.profile || response.data;
      setProfile(profileData);

      // Simulate voice and photo files (in production, fetch from backend)
      if (profileData?.voiceId) {
        setVoiceFiles([
          {
            id: profileData.voiceId,
            name: 'My Voice',
            uploadedAt: new Date().toISOString(),
            isDefault: true,
            url: profileData.voiceUrl || '#',
          }
        ]);
      }

      if (profileData?.photoUrl) {
        setPhotoFiles([
          {
            id: '1',
            url: profileData.photoUrl,
            uploadedAt: new Date().toISOString(),
            isDefault: true,
          }
        ]);
      }
    } catch (error) {
      showAlert('error', 'Failed to load media library');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleVoiceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Use the canonical audio allowlist from helpers.js so Safari (audio/mp4)
    // and Chrome (audio/webm) pass the same validation rules everywhere.
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      showAlert('error', validation.error);
      return;
    }

    try {
      setUploadingVoice(true);
      const formData = new FormData();
      formData.append('voice', file);
      if (user?.id || user?.email) {
        formData.append('userId', user.id || user.email);
      }

      await api.uploadVoice(formData);
      showAlert('success', 'Voice uploaded successfully! Processing may take a moment.');
      fetchProfile();
    } catch (error) {
      showAlert('error', getErrorMessage(error));
    } finally {
      setUploadingVoice(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      showAlert('error', 'Please upload an image file (JPG or PNG)');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showAlert('error', 'Image size must be less than 5MB');
      return;
    }

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append('photo', file);
      if (user?.id || user?.email) {
        formData.append('userId', user.id || user.email);
      }

      await api.uploadPhoto(formData);
      showAlert('success', 'Photo uploaded successfully!');
      fetchProfile();
    } catch (error) {
      showAlert('error', getErrorMessage(error));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoUrlSubmit = async (e) => {
    e.preventDefault();
    if (!photoUrl.trim()) return;

    // Basic URL validation
    try {
      new URL(photoUrl);
    } catch {
      showAlert('error', 'Please enter a valid URL');
      return;
    }

    try {
      setUploadingPhoto(true);
      // In production, send URL to backend
      showAlert('success', 'Photo URL added successfully!');
      setPhotoFiles(prev => [...prev, {
        id: Date.now().toString(),
        url: photoUrl,
        uploadedAt: new Date().toISOString(),
        isDefault: false,
      }]);
      setPhotoUrl('');
    } catch (error) {
      showAlert('error', 'Failed to add photo URL');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const playVoice = (voiceFile) => {
    // In production, play actual audio file
    showAlert('info', `Playing: ${voiceFile.name}`);
    setPlayingVoice(voiceFile.id);
    setTimeout(() => setPlayingVoice(null), 3000);
  };

  const deleteVoice = (voiceId) => {
    if (confirm('Are you sure you want to delete this voice recording?')) {
      setVoiceFiles(prev => prev.filter(v => v.id !== voiceId));
      showAlert('success', 'Voice recording deleted');
    }
  };

  const deletePhoto = (photoId) => {
    if (confirm('Are you sure you want to delete this photo?')) {
      setPhotoFiles(prev => prev.filter(p => p.id !== photoId));
      showAlert('success', 'Photo deleted');
    }
  };

  const setDefaultPhoto = (photoId) => {
    setPhotoFiles(prev => prev.map(p => ({
      ...p,
      isDefault: p.id === photoId,
    })));
    showAlert('success', 'Default photo updated');
  };

  if (loading) {
    return <LoadingSpinner text="Loading media library..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Media Library</h1>
          <p className="text-gray-600 mt-1">Your default voice and photo used across all greetings (unless overridden per greeting)</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Star className="text-blue-600" size={24} fill="currentColor" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-1">Default Media Settings</h3>
            <p className="text-sm text-blue-800">
              Upload your default voice and photo here. These will be automatically used in all your greetings.
              You can override them with specific photos when creating individual greeting cards.
            </p>
          </div>
        </div>
      </div>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Voice Integrity Recovery Banner (Protected Subsystem) —
          Persistent calm prompt shown when user.voiceIdStaleAt is set.
          Disappears immediately on successful re-record. */}
      {user?.voiceIdStaleAt && (
        <div
          style={{
            backgroundColor: '#fffdf8',
            border: '1px solid #d4c5b3',
            borderLeft: '3px solid #c8a06b',
            borderRadius: '12px',
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '15px',
              lineHeight: 1.5,
              color: '#3a2a1f',
              margin: 0,
              flex: '1 1 auto',
              minWidth: '240px',
            }}
          >
            Your voice could use a fresh recording — let&rsquo;s get you back on the air.
          </p>
          <label
            style={{
              backgroundColor: '#6b3a2a',
              color: '#ffffff',
              padding: '10px 22px',
              borderRadius: '14px',
              fontFamily: 'Georgia, serif',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Record my voice
            <input
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={handleVoiceUpload}
            />
          </label>
        </div>
      )}

      {/* Voice Recordings Section */}
      <div className="card space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Mic className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <span>Default Voice</span>
                <Star size={16} className="text-yellow-500" fill="currentColor" />
              </h2>
              <p className="text-sm text-gray-600">Upload audio samples to clone your voice for all greetings</p>
            </div>
          </div>

          <label className="btn-primary cursor-pointer">
            <Upload size={18} />
            <span>{uploadingVoice ? 'Uploading...' : 'Upload Voice'}</span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleVoiceUpload}
              className="hidden"
              disabled={uploadingVoice}
            />
          </label>
        </div>

        {/* Voice Files Table */}
        {voiceFiles.length > 0 ? (
          <div className="overflow-hidden border border-gray-200 rounded-xl">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recording
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {voiceFiles.map((voice) => (
                  <tr key={voice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Mic className="text-purple-600" size={20} />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{voice.name}</div>
                          <div className="text-sm text-gray-500">Voice ID: {voice.id.substring(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(voice.uploadedAt).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(voice.uploadedAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {voice.isDefault && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle size={14} className="mr-1" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => playVoice(voice)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        disabled={playingVoice === voice.id}
                      >
                        <Play size={14} className="mr-1" />
                        {playingVoice === voice.id ? 'Playing...' : 'Play'}
                      </button>
                      <button
                        onClick={() => deleteVoice(voice.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} className="mr-1" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <Mic className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No voice recordings</h3>
            <p className="mt-1 text-sm text-gray-500">Upload your first voice sample to get started</p>
          </div>
        )}
      </div>

      {/* Photos Section */}
      <div className="card space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Camera className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                <span>Default Photo</span>
                <Star size={16} className="text-yellow-500" fill="currentColor" />
              </h2>
              <p className="text-sm text-gray-600">Your default photo used in greetings (upload or add from URL)</p>
            </div>
          </div>

          <label className="btn-secondary cursor-pointer">
            <Upload size={18} />
            <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              disabled={uploadingPhoto}
            />
          </label>
        </div>

        {/* Photo URL Upload */}
        <form onSubmit={handlePhotoUrlSubmit} className="flex space-x-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <LinkIcon className="text-gray-400" size={20} />
            </div>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="Or paste photo URL here..."
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <button
            type="submit"
            className="btn-outline px-6"
            disabled={!photoUrl.trim() || uploadingPhoto}
          >
            Add URL
          </button>
        </form>

        {/* Photo Gallery */}
        {photoFiles.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photoFiles.map((photo) => (
              <div
                key={photo.id}
                className="relative group rounded-xl overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition-all"
              >
                <div className="aspect-square bg-gray-100">
                  <img
                    src={photo.url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/300?text=Photo';
                    }}
                  />
                </div>

                {/* Default Badge */}
                {photo.isDefault && (
                  <div className="absolute top-2 left-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-500 text-white shadow-lg">
                      <Star size={12} className="mr-1" fill="currentColor" />
                      Default
                    </span>
                  </div>
                )}

                {/* Hover Actions */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="space-x-2">
                    {!photo.isDefault && (
                      <button
                        onClick={() => setDefaultPhoto(photo.id)}
                        className="px-3 py-2 bg-white rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Upload Date */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                  <p className="text-xs text-white">
                    {new Date(photo.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <Camera className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No photos yet</h3>
            <p className="mt-1 text-sm text-gray-500">Upload a photo or add from URL to get started</p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="card bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
              <CheckCircle className="text-white" size={20} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Tips for Best Results</h3>
            <ul className="mt-2 text-sm text-gray-700 space-y-1">
              <li>• Voice: Record 30-60 seconds in a quiet environment for best voice cloning</li>
              <li>• Photos: Use clear, front-facing photos with good lighting</li>
              <li>• Default: Mark your preferred photo as default for all greetings</li>
              <li>• Messages: AI will use relationship context to create 20+ second personalized messages</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
