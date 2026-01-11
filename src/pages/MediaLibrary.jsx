// src/pages/MediaLibrary.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Play, Pause, Image as ImageIcon, Mic } from 'lucide-react';

export default function MediaLibrary() {
  const [voices, setVoices] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [activeVoice, setActiveVoice] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const voiceInputRef = useRef(null);
  const photoInputRef = useRef(null);

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = () => {
    // Load saved voice
    const savedVoice = localStorage.getItem('greetme_voice_file');
    if (savedVoice) {
      setVoices([{
        id: 'main-voice',
        name: 'My Voice Recording',
        dataUrl: savedVoice,
        date: new Date().toLocaleDateString()
      }]);
    }

    // Load saved photo
    const savedPhoto = localStorage.getItem('greetme_photo_file');
    if (savedPhoto) {
      setPhotos([{
        id: 'main-photo',
        name: 'My Profile Photo',
        dataUrl: savedPhoto,
        date: new Date().toLocaleDateString()
      }]);
    }
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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image file must be less than 5MB');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      localStorage.setItem('greetme_photo_file', dataUrl);
      loadMedia();
      alert('Photo uploaded successfully!');
    } catch (error) {
      console.error('Photo upload error:', error);
      alert('Failed to upload photo.');
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

  const deletePhoto = (id) => {
    if (confirm('Are you sure you want to delete this photo?')) {
      localStorage.removeItem('greetme_photo_file');
      setPhotos([]);
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
      <h1 style={{
        fontSize: '2rem',
        fontWeight: 700,
        marginBottom: '0.5rem',
        color: 'var(--text-primary)'
      }}>Media Library</h1>
      <p style={{
        color: 'var(--text-secondary)',
        marginBottom: '2rem'
      }}>Manage your voice recordings and photos</p>

      {/* Voice Recordings Section */}
      <div style={{
        background: 'white',
        border: '2px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid var(--border)'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Mic size={20} />
            Voice Recordings
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
              transition: 'all 0.2s'
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

      {/* Photos Section */}
      <div style={{
        background: 'white',
        border: '2px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid var(--border)'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <ImageIcon size={20} />
            Photos
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
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#5568d3'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#667eea'}
          >
            <Upload size={16} />
            Upload Photo
          </button>
        </div>

        {photos.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: 'var(--text-secondary)'
          }}>
            <ImageIcon size={48} style={{ color: 'var(--gray-300)', margin: '0 auto 1rem' }} />
            <p>No photos yet</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Upload your first photo to get started</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            {photos.map(photo => (
              <div
                key={photo.id}
                style={{
                  position: 'relative',
                  border: '2px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  background: 'white'
                }}
              >
                <img
                  src={photo.dataUrl}
                  alt={photo.name}
                  style={{
                    width: '100%',
                    height: '200px',
                    objectFit: 'cover'
                  }}
                />
                <div style={{
                  padding: '0.75rem',
                  borderTop: '1px solid var(--border)'
                }}>
                  <h3 style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0.25rem'
                  }}>{photo.name}</h3>
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)'
                  }}>Uploaded {photo.date}</p>
                </div>
                <button
                  onClick={() => deletePhoto(photo.id)}
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    padding: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.9)',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
