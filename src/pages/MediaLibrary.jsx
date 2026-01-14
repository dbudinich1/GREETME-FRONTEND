// src/pages/MediaLibrary.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Play, Pause, Image as ImageIcon, Mic, ArrowLeft, Smartphone, QrCode, Video, Star, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MediaLibrary() {
  const navigate = useNavigate();
  const [voices, setVoices] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [activeVoice, setActiveVoice] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [defaultPhotoId, setDefaultPhotoId] = useState(null);
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

    // Load saved photos (new multi-photo structure)
    const savedPhotos = localStorage.getItem('greetme_photos');
    if (savedPhotos) {
      try {
        const parsedPhotos = JSON.parse(savedPhotos);
        setPhotos(parsedPhotos);
      } catch (error) {
        console.error('Error loading photos:', error);
      }
    } else {
      // Fallback to old single photo storage for backward compatibility
      const savedPhoto = localStorage.getItem('greetme_photo_file');
      if (savedPhoto) {
        setPhotos([{
          id: 'main-photo',
          name: 'My Profile Photo',
          dataUrl: savedPhoto,
          date: new Date().toLocaleDateString()
        }]);
      }
    }

    // Load default photo ID
    const savedDefaultPhotoId = localStorage.getItem('greetme_default_photo_id');
    if (savedDefaultPhotoId) {
      setDefaultPhotoId(savedDefaultPhotoId);
    }
  };

  const setAsDefaultPhoto = (photoId) => {
    const photo = photos.find(p => p.id === photoId);
    if (photo) {
      // Save as default photo for greetings
      localStorage.setItem('greetme_default_photo_id', photoId);
      localStorage.setItem('greetme_photo_file', photo.dataUrl);
      setDefaultPhotoId(photoId);
      alert('Photo set as default for greetings!');
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
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate all files first
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file. Only images are allowed.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is too large. Images must be less than 5MB.`);
        return;
      }
    }

    try {
      // Get existing photos from localStorage
      const existingPhotos = JSON.parse(localStorage.getItem('greetme_photos') || '[]');

      // Process each file
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file);
        const newPhoto = {
          id: Date.now() + Math.random(),
          name: file.name,
          dataUrl: dataUrl,
          date: new Date().toLocaleDateString()
        };
        existingPhotos.push(newPhoto);
      }

      // Save back to localStorage
      localStorage.setItem('greetme_photos', JSON.stringify(existingPhotos));

      // Also keep the old single photo storage for backward compatibility
      if (existingPhotos.length > 0) {
        localStorage.setItem('greetme_photo_file', existingPhotos[0].dataUrl);
      }

      loadMedia();
      alert(`${files.length} photo(s) uploaded successfully!`);
    } catch (error) {
      console.error('Photo upload error:', error);
      alert('Failed to upload photos.');
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
      // Get current photos
      const savedPhotos = JSON.parse(localStorage.getItem('greetme_photos') || '[]');

      // Remove the photo with matching id
      const updatedPhotos = savedPhotos.filter(photo => photo.id !== id);

      // Save updated list
      localStorage.setItem('greetme_photos', JSON.stringify(updatedPhotos));

      // Update backward compatibility storage
      if (updatedPhotos.length > 0) {
        localStorage.setItem('greetme_photo_file', updatedPhotos[0].dataUrl);
      } else {
        localStorage.removeItem('greetme_photo_file');
      }

      // Update state
      setPhotos(updatedPhotos);
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
      }}>Manage your voice recordings and photos</p>

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
            multiple
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
            Upload Photos
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
            {photos.map(photo => {
              const isDefault = defaultPhotoId === photo.id || (defaultPhotoId === null && photos.indexOf(photo) === 0);
              return (
                <div
                  key={photo.id}
                  style={{
                    position: 'relative',
                    border: isDefault ? '3px solid #22c55e' : '2px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    background: 'white',
                    boxShadow: isDefault ? '0 4px 12px rgba(34, 197, 94, 0.2)' : 'none'
                  }}
                >
                  {/* Default Badge */}
                  {isDefault && (
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
                      <Star size={12} fill="currentColor" />
                      DEFAULT
                    </div>
                  )}
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
                      color: 'var(--text-secondary)',
                      marginBottom: '0.5rem'
                    }}>Uploaded {photo.date}</p>
                    {/* Set as Default Button */}
                    {!isDefault && (
                      <button
                        onClick={() => setAsDefaultPhoto(photo.id)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.375rem',
                          transition: 'all 0.2s',
                          fontFamily: 'inherit'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <CheckCircle size={14} />
                        Set as Default for Greetings
                      </button>
                    )}
                    {isDefault && (
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
                    )}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
