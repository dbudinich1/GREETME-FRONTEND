// src/pages/MediaLibrary.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Play, Pause, Image as ImageIcon, Mic, ArrowLeft, Smartphone, QrCode, Video, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function MediaLibrary() {
  const navigate = useNavigate();
  const { user, updateUser, getToken } = useAuth();
  const [voices, setVoices] = useState([]);
  const [activeVoice, setActiveVoice] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const audioRef = useRef(null);
  const voiceInputRef = useRef(null);
  const photoInputRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_BASE || 'https://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net';

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = () => {
    // Load saved voice from localStorage (voice still uses localStorage)
    const savedVoice = localStorage.getItem('greetme_voice_file');
    if (savedVoice) {
      setVoices([{
        id: 'main-voice',
        name: 'My Voice Recording',
        dataUrl: savedVoice,
        date: new Date().toLocaleDateString()
      }]);
    }
    // Photo comes from user.photoUrl (AuthContext / backend)
  };

  const fileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleVoiceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Audio file must be less than 10MB');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      localStorage.setItem('greetme_voice_file', dataUrl);
      loadMedia();
      alert('Voice uploaded successfully!');
    } catch (error) {
      console.error('Voice upload error:', error);
      alert('Failed to upload voice.');
    }
  };

  // Upload photo to backend (POST /api/profile/photo)
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const token = getToken();
      if (!token) {
        alert('Please log in to upload a photo');
        return;
      }

      const form = new FormData();
      form.append('photo', file);

      const res = await fetch(`${API_URL}/api/profile/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Update AuthContext with new photoUrl from backend
      updateUser({ photoUrl: data.photoUrl });
      alert('Photo uploaded successfully!');
    } catch (error) {
      console.error('Photo upload error:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const deleteVoice = (id) => {
    if (confirm('Are you sure you want to delete this voice recording?')) {
      localStorage.removeItem('greetme_voice_file');
      setVoices([]);
      setActiveVoice(null);
      setIsPlaying(false);
    }
  };

  const playVoice = (voice) => {
    if (activeVoice?.id === voice.id && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      setActiveVoice(voice);
      setIsPlaying(true);
      setTimeout(() => {
        audioRef.current?.play();
      }, 100);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
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
            borderRadius: 'var(--radius-md)',
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
      <h1 style={{
        fontSize: '2rem',
        fontWeight: 700,
        marginBottom: '0.5rem',
        color: 'var(--text-primary)'
      }}>Media Library</h1>
      <p style={{
        color: 'var(--text-secondary)',
        marginBottom: '2rem'
      }}>Manage your voice recordings and default photo</p>

      {/* Demo Video Section */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        marginBottom: '2rem',
        color: 'white',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Video size={24} style={{ color: 'white' }} />
          </div>
          <div>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              margin: 0,
              marginBottom: '0.25rem'
            }}>Watch the Demo</h2>
            <p style={{
              fontSize: '0.875rem',
              opacity: 0.9,
              margin: 0
            }}>Learn how to use Greet-Me in under 2 minutes</p>
          </div>
        </div>
        <button
          onClick={() => alert('Demo video will open here - integration coming soon')}
          style={{
            width: '100%',
            padding: '0.875rem',
            background: 'white',
            color: '#667eea',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
          }}
        >
          <Play size={20} />
          Watch Demo Video
        </button>
      </div>

      {/* Mobile App QR Code */}
      <div style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem 1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
          }}>
            <Smartphone size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.25rem'
            }}>Download Greet-Me Mobile App</h3>
            <p style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              margin: 0
            }}>Send greetings on the go - scan QR code to download</p>
          </div>
        </div>
        <div style={{
          width: '5rem',
          height: '5rem',
          background: 'white',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--border)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          position: 'relative'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        title="Scan to download mobile app"
        >
          <QrCode size={40} style={{ color: '#667eea' }} />
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.5rem',
            fontWeight: 700,
            color: '#667eea',
            pointerEvents: 'none'
          }}>
            <div style={{
              width: '70%',
              height: '70%',
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gridTemplateRows: 'repeat(8, 1fr)',
              gap: '1px'
            }}>
              {[...Array(64)].map((_, i) => (
                <div key={i} style={{
                  background: Math.random() > 0.5 ? '#667eea' : 'transparent',
                  borderRadius: '1px'
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Voice Recordings Section */}
      <div style={{
        background: 'white',
        border: '2px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        width: '100%',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid var(--border)',
          width: '100%'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            minWidth: 0,
            flex: '1 1 auto'
          }}>
            <Mic size={20} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Voice Recordings</span>
          </h2>
          <input
            ref={voiceInputRef}
            type="file"
            accept="audio/*"
            onChange={handleVoiceUpload}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => voiceInputRef.current?.click()}
            style={{
              padding: '0.625rem 1.25rem',
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
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#5568d3'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#667eea'}
          >
            <Upload size={16} />
            Upload Voice
          </button>
        </div>

        {voices.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: 'var(--text-secondary)'
          }}>
            <Mic size={48} style={{ color: 'var(--gray-300)', margin: '0 auto 1rem' }} />
            <p>No voice recordings yet</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Upload your first voice recording to get started</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <audio
              ref={audioRef}
              src={activeVoice?.dataUrl}
              onEnded={() => setIsPlaying(false)}
              style={{ display: 'none' }}
            />
            {voices.map(voice => (
              <div
                key={voice.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  background: activeVoice?.id === voice.id ? '#f0f4ff' : 'var(--gray-50)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Mic size={20} style={{ color: 'white' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0.25rem'
                  }}>{voice.name}</h3>
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)'
                  }}>Uploaded {voice.date}</p>
                </div>
                <button
                  onClick={() => playVoice(voice)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: (activeVoice?.id === voice.id && isPlaying) ? '#10b981' : '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {(activeVoice?.id === voice.id && isPlaying) ? <Pause size={16} /> : <Play size={16} />}
                  {(activeVoice?.id === voice.id && isPlaying) ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={() => deleteVoice(voice.id)}
                  style={{
                    padding: '0.5rem',
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fecaca'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fee2e2'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Default Photo Section (Single Photo from Backend) */}
      <div style={{
        background: 'white',
        border: '2px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        width: '100%',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid var(--border)',
          width: '100%'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            minWidth: 0,
            flex: '1 1 auto'
          }}>
            <ImageIcon size={20} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Default Photo</span>
          </h2>
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
              padding: '0.625rem 1.25rem',
              background: uploadingPhoto ? '#e5e7eb' : '#667eea',
              color: uploadingPhoto ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => { if (!uploadingPhoto) e.currentTarget.style.background = '#5568d3'; }}
            onMouseLeave={(e) => { if (!uploadingPhoto) e.currentTarget.style.background = '#667eea'; }}
          >
            <Upload size={16} />
            {uploadingPhoto ? 'Uploading...' : (user?.photoUrl ? 'Replace Photo' : 'Upload Photo')}
          </button>
        </div>

        {!user?.photoUrl ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: 'var(--text-secondary)'
          }}>
            <ImageIcon size={48} style={{ color: 'var(--gray-300)', margin: '0 auto 1rem' }} />
            <p>No default photo yet</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Upload your photo to use in greetings</p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            justifyContent: 'center'
          }}>
            <div
              style={{
                position: 'relative',
                border: '3px solid #22c55e',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                background: 'white',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                maxWidth: '300px',
                width: '100%'
              }}
            >
              {/* Default Badge */}
              <div style={{
                position: 'absolute',
                top: '0.5rem',
                left: '0.5rem',
                padding: '0.25rem 0.5rem',
                background: '#22c55e',
                color: 'white',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                zIndex: 10
              }}>
                <CheckCircle size={12} />
                DEFAULT
              </div>
              <img
                src={user.photoUrl}
                alt="Default greeting photo"
                style={{
                  width: '100%',
                  height: '250px',
                  objectFit: 'cover'
                }}
              />
              <div style={{
                padding: '0.75rem',
                borderTop: '1px solid var(--border)'
              }}>
                <div style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#dcfce7',
                  color: '#15803d',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem'
                }}>
                  <CheckCircle size={14} />
                  Used for Greetings
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
