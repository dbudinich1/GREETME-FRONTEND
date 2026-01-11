// src/pages/DashboardHome.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Camera, Users, Plus, Search, Upload, Settings, Play, Pause, Square } from 'lucide-react';
import api from "../api/api";
import { getOccasionIcon } from '../utils/helpers';

export default function DashboardHome() {
  const navigate = useNavigate();
  const voiceInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const audioRef = useRef(null);
  const [contacts, setContacts] = useState([]);
  const [upcomingOccasions, setUpcomingOccasions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voiceRecorded, setVoiceRecorded] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [voiceFileUrl, setVoiceFileUrl] = useState(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);


  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      try {
        const contactsRes = await api.getContacts();
        if (contactsRes?.ok !== false) {
          setContacts(contactsRes.data || []);
        } else {
          // If API fails, try localStorage (same as Recipients page)
          const stored = localStorage.getItem('greetme_recipients');
          if (stored) {
            setContacts(JSON.parse(stored));
          }
        }
      } catch (err) {
        console.log('Contacts endpoint not available yet, checking localStorage');
        const stored = localStorage.getItem('greetme_recipients');
        if (stored) {
          setContacts(JSON.parse(stored));
        }
      }

      try {
        const upcomingRes = await api.getUpcomingOccasions();
        if (upcomingRes?.ok !== false) {
          setUpcomingOccasions(upcomingRes.data || []);
        }
      } catch (err) {
        console.log('Upcoming endpoint not available yet');
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file (MP3, WAV, WebM)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Audio file must be less than 10MB');
      return;
    }

    setUploadingVoice(true);
    try {
      // Create object URL for playback
      const fileUrl = URL.createObjectURL(file);
      setVoiceFileUrl(fileUrl);

      // Simulate upload (replace with actual API call)
      await new Promise(resolve => setTimeout(resolve, 1000));
      setVoiceRecorded(true);
      alert('Voice uploaded successfully!');
    } catch (error) {
      console.error('Voice upload error:', error);
      alert('Failed to upload voice. Please try again.');
    } finally {
      setUploadingVoice(false);
    }
  };

  const handlePlayVoice = () => {
    if (audioRef.current && voiceFileUrl) {
      if (isPlayingVoice) {
        audioRef.current.pause();
        setIsPlayingVoice(false);
      } else {
        audioRef.current.play();
        setIsPlayingVoice(true);
      }
    }
  };

  // Cleanup voice URL on unmount
  useEffect(() => {
    return () => {
      if (voiceFileUrl) {
        URL.revokeObjectURL(voiceFileUrl);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [voiceFileUrl]);

  const startMicRecording = async () => {
  try {
    // Request mic
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // Choose a sane mimeType (Chrome/Edge: webm/opus; Safari may be limited)
    let options = {};
    if (window.MediaRecorder?.isTypeSupported?.("audio/webm;codecs=opus")) {
      options = { mimeType: "audio/webm;codecs=opus" };
    } else if (window.MediaRecorder?.isTypeSupported?.("audio/webm")) {
      options = { mimeType: "audio/webm" };
    }

    mediaRecorderRef.current = new MediaRecorder(stream, options);
    audioChunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = () => {
      try {
        // Build audio blob from chunks
        const mime = mediaRecorderRef.current?.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);

        // Clean up old URL if exists
        if (voiceFileUrl) URL.revokeObjectURL(voiceFileUrl);

        setVoiceFileUrl(url);
        setVoiceRecorded(true);
      } finally {
        // Stop mic hardware
        streamRef.current?.getTracks?.().forEach((t) => t.stop());
        streamRef.current = null;

        // Reset chunks
        audioChunksRef.current = [];

        // Reset UI state
        setIsRecording(false);
        setRecordingTime(0);

        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      }
    };

    // Start recording + start timer
    mediaRecorderRef.current.start();
    setIsRecording(true);
    setRecordingTime(0);

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime((t) => t + 1);
    }, 1000);
  } catch (err) {
    console.error("Mic recording failed:", err);

    // Ensure we clean up if permission denied / error
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;

    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }
};

  const stopMicRecording = () => {
  try {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      // Fallback cleanup if recorder isn't running but stream exists
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
      streamRef.current = null;

      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  } catch (err) {
    console.error("stopMicRecording error:", err);
  }
};


  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image file must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      // Simulate upload (replace with actual API call)
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPhotoUploaded(true);
      alert('Photo uploaded successfully!');
    } catch (error) {
      console.error('Photo upload error:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Mock data matching PDF
  const mockContacts = [
    { id: 1, name: 'John Doe', relationship: 'Dad', occasions: ['Birthday', 'Anniversary'], avatar: '👤', online: true },
    { id: 2, name: 'Jane Smith', relationship: 'Spouse', occasions: ['Birthday'], avatar: '👤', online: true },
    { id: 3, name: 'Bob Johnson', relationship: 'Friend', occasions: ['Christmas'], avatar: '👤', online: true },
  ];

  const comingUpOccasions = [
    { id: 1, recipient: 'Jane Smith', relationship: 'Spouse', icons: ['🎂', '❤️', '❤️'], occasions: ['Birthday', 'Anniversary'], date: 'Jan 15' },
    { id: 2, recipient: 'John Doe', relationship: 'Dad', icons: ['🎂'], occasions: ['Birthday'], date: 'Jan 18' },
    { id: 3, recipient: 'Bob Johnson', relationship: 'Friend', icons: ['🎄'], occasions: ['Christmas'], date: 'Dec 25' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show actual contacts if available, otherwise show examples
  const displayContacts = contacts.length > 0 ? contacts : mockContacts;

  // Filter contacts based on search term
  const filteredContacts = displayContacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.relationship?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Combined Navigation Header */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '2rem',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {/* Hero Program Button - Left Side */}
        <button
          onClick={() => navigate('/dashboard/hero')}
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontSize: '0.9375rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
          }}
          title="Access the Greet-Me Hero™ Program"
        >
          🥇 Greet-Me Hero™
        </button>

        {/* Action Buttons - Right Side */}
        <div style={{
          display: 'flex',
          gap: '1rem'
        }}>
        <button
          onClick={() => navigate('/dashboard/contacts')}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(102, 126, 234, 0.2)',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#5568d3';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#667eea';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.2)';
          }}
        >
          <Plus size={18} />
          Add Recipient
        </button>
        <button
          onClick={() => alert('Add Occasion - Integration coming soon')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'white',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--gray-50)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
          }}
        >
          <Plus size={18} />
          Add Occasion
        </button>
        <button
          onClick={() => navigate('/dashboard/send')}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#16a34a';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(34, 197, 94, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#22c55e';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.2)';
          }}
        >
          ✓ Send Just Because
        </button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '380px 1fr',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Left Column - Your Presence */}
        <div>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.5rem',
            border: '2px solid var(--border)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
              paddingBottom: '0.75rem',
              borderBottom: '2px solid var(--border)'
            }}>Your Presence</h2>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem'
            }}>Record your voice & set your photo</p>

            {/* Voice Section */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{
                  width: '4rem',
                  height: '4rem',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Mic size={24} style={{ color: 'white' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0.25rem'
                  }}>Voice</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: '50%',
                      background: voiceRecorded ? '#22c55e' : '#dc2626'
                    }}></div>
                    <span style={{
                      fontSize: '0.875rem',
                      color: voiceRecorded ? '#22c55e' : '#dc2626',
                      fontWeight: 500
                    }}>{voiceRecorded ? 'Recorded' : 'Not Recorded'}</span>
                  </div>
                </div>
              </div>
              <input
                ref={voiceInputRef}
                type="file"
                accept="audio/*"
                onChange={handleVoiceUpload}
                style={{ display: 'none' }}
              />
              <audio
                ref={audioRef}
                src={voiceFileUrl || ''}
                onEnded={() => setIsPlayingVoice(false)}
                style={{ display: 'none' }}
              />
              {isRecording && (
                <div style={{
                  padding: '1rem',
                  background: '#fee2e2',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: '0.75rem',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: '#dc2626',
                    marginBottom: '0.25rem'
                  }}>
                    {formatTime(recordingTime)}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#991b1b'
                  }}>
                    Recording...
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={isRecording ? stopMicRecording : startMicRecording}
                  disabled={uploadingVoice}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '0.625rem',
                    background: uploadingVoice ? 'var(--gray-200)' : isRecording ? '#dc2626' : '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: uploadingVoice ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    if (!uploadingVoice) {
                      e.currentTarget.style.background = isRecording ? '#b91c1c' : '#dc2626';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!uploadingVoice) {
                      e.currentTarget.style.background = isRecording ? '#dc2626' : '#ef4444';
                    }
                  }}
                >
                  {isRecording ? <Square size={16} /> : <Mic size={16} />}
                  {isRecording ? 'Stop Recording' : 'Use Microphone'}
                </button>
                <button
                  onClick={() => voiceInputRef.current?.click()}
                  disabled={uploadingVoice || isRecording}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '0.625rem',
                    background: (uploadingVoice || isRecording) ? 'var(--gray-200)' : '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: (uploadingVoice || isRecording) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    if (!uploadingVoice && !isRecording) e.currentTarget.style.background = '#5568d3';
                  }}
                  onMouseLeave={(e) => {
                    if (!uploadingVoice && !isRecording) e.currentTarget.style.background = '#667eea';
                  }}
                >
                  <Upload size={16} />
                  {uploadingVoice ? 'Uploading...' : 'Upload File'}
                </button>
                {voiceRecorded && voiceFileUrl && (
                  <button
                    onClick={handlePlayVoice}
                    disabled={isRecording}
                    style={{
                      padding: '0.625rem 1rem',
                      background: isRecording ? 'var(--gray-200)' : (isPlayingVoice ? '#10b981' : '#667eea'),
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: isRecording ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!isRecording) {
                        e.currentTarget.style.background = isPlayingVoice ? '#059669' : '#5568d3';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isRecording) {
                        e.currentTarget.style.background = isPlayingVoice ? '#10b981' : '#667eea';
                      }
                    }}
                  >
                    {isPlayingVoice ? <Pause size={16} /> : <Play size={16} />}
                    {isPlayingVoice ? 'Pause' : 'Play'}
                  </button>
                )}
              </div>
            </div>

            {/* Photo Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{
                  width: '4rem',
                  height: '4rem',
                  borderRadius: '50%',
                  background: 'var(--gray-200)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  <Camera size={24} style={{ color: 'var(--text-tertiary)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0.25rem'
                  }}>Photo</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: '50%',
                      background: photoUploaded ? '#22c55e' : '#dc2626'
                    }}></div>
                    <span style={{
                      fontSize: '0.875rem',
                      color: photoUploaded ? '#22c55e' : '#dc2626',
                      fontWeight: 500
                    }}>{photoUploaded ? 'Uploaded' : 'Not Uploaded'}</span>
                  </div>
                </div>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  background: uploadingPhoto ? 'var(--gray-200)' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  if (!uploadingPhoto) e.currentTarget.style.background = '#5568d3';
                }}
                onMouseLeave={(e) => {
                  if (!uploadingPhoto) e.currentTarget.style.background = '#667eea';
                }}
              >
                <Upload size={16} />
                {uploadingPhoto ? 'Uploading...' : photoUploaded ? 'Replace Photo' : 'Upload Photo'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Recipients & Occasions */}
        <div>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.5rem',
            border: '2px solid var(--border)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--border)' }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0
              }}>Recipients & Occasions</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => navigate('/dashboard/contacts')}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit'
                  }}
                >
                  <Plus size={16} />
                  Add Recipient
                </button>
                <button
                  onClick={() => alert('Add Occasion')}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'white',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit'
                  }}
                >
                  <Plus size={16} />
                  Add Occasion
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)'
                }}
              />
              <input
                type="text"
                placeholder="Search recipients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              />
            </div>

            {/* Contact List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredContacts.length === 0 && searchTerm ? (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem'
                }}>
                  No recipients match "{searchTerm}"
                </div>
              ) : (
                filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => navigate('/dashboard/contacts')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--gray-50)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: '3rem',
                      height: '3rem',
                      borderRadius: '50%',
                      background: 'var(--gray-200)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem'
                    }}>
                      {contact.avatar || '👤'}
                    </div>
                    {contact.online && (
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: '0.75rem',
                        height: '0.75rem',
                        background: '#22c55e',
                        border: '2px solid white',
                        borderRadius: '50%'
                      }}></div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '0.25rem'
                    }}>{contact.name}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {contact.relationship}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {/* Occasion Icons */}
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      {(contact.occasions || []).slice(0, 3).map((occasion, idx) => {
                        const occasionType = typeof occasion === 'object' ? occasion.type : occasion;
                        const icon = getOccasionIcon(occasionType);
                        return (
                          <span
                            key={idx}
                            style={{
                              fontSize: '1.25rem',
                              lineHeight: 1
                            }}
                            title={typeof occasion === 'object' ? occasion.type : occasion}
                          >
                            {icon}
                          </span>
                        );
                      })}
                      {contact.occasions && contact.occasions.length > 3 && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-tertiary)',
                          fontWeight: 500
                        }}>
                          +{contact.occasions.length - 3}
                        </span>
                      )}
                    </div>
                    {/* Settings Icon */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/dashboard/contacts');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        color: 'var(--text-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Edit contact"
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                </div>
              )))}
            </div>
          </div>
        </div>
      </div>

      {/* Coming Up Section */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0
          }}>Coming Up <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(Next 30 Days)</span></h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => navigate('/dashboard/contacts')}
              style={{
                padding: '0.5rem 1rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
            >
              <Plus size={16} />
              Add Recipient
            </button>
            <button
              onClick={() => alert('Add Occasion')}
              style={{
                padding: '0.5rem 1rem',
                background: 'white',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
            >
              <Plus size={16} />
              Add Occasion
            </button>
          </div>
        </div>

        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 2fr 1fr',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          <div>RECIPIENT</div>
          <div>ICONS</div>
          <div>OCCASIONS</div>
          <div style={{ textAlign: 'right' }}>DATE</div>
        </div>

        {/* Table Rows */}
        <div>
          {comingUpOccasions.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 2fr 1fr',
                padding: '1rem',
                borderBottom: index < comingUpOccasions.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--gray-50)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    background: 'var(--gray-200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    position: 'relative'
                  }}>
                    👤
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '0.625rem',
                      height: '0.625rem',
                      background: '#22c55e',
                      border: '2px solid white',
                      borderRadius: '50%'
                    }}></div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)'
                    }}>{item.recipient}</div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)'
                    }}>{item.relationship}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {item.icons.map((icon, idx) => (
                  <span key={idx} style={{ fontSize: '1.25rem' }}>{icon}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {item.occasions.map((occasion, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '0.25rem 0.625rem',
                      background: idx === 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(102, 126, 234, 0.1)',
                      color: idx === 0 ? '#22c55e' : '#667eea',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}
                  >
                    🎂 {occasion}
                  </span>
                ))}
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {item.date}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
