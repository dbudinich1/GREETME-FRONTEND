// src/pages/DashboardHome.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Camera, Users, Plus, Search, Upload, Settings, Play, Pause, Square, CheckCircle, Copy, Image as ImageIcon, Smartphone, QrCode, DollarSign, X, Send, Gift, CreditCard, Heart } from 'lucide-react';
import api from "../api/api";
import { getOccasionIcon } from '../utils/helpers';
import { getRewardsBalance, getRemainingDailyHearts } from '../utils/rewards';
import { pushInApp } from '../utils/notify';
import { COMMS_EVENTS } from '../utils/commsCatalog';
import QRCashGiftModal from '../components/QRCashGiftModal';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorMessages';
import { safeGet, safeSet, safeSessionGet, safeSessionSet } from '../utils/safeStorage';
import OnboardingCoach from '../components/OnboardingCoach';
import WarmReentryWelcome from '../components/WarmReentryWelcome';
import { useAccountState } from '../hooks/useAccountState';
import { shouldShowOnboarding, shouldShowWarmReentry } from '../utils/accountState';
import { getHoverHandlers } from '../utils/hoverable';
import QRCode from 'qrcode';

export default function DashboardHome() {
  const navigate = useNavigate();
  const { user, getToken, refreshProfile } = useAuth();
  // Phase 3D Batch D Slice 5 — account-state gate for the dashboard onboarding nudge.
  const accountState = useAccountState();

  // F5: real install QR for the "Download Mobile App" panel
  const [appQrUrl, setAppQrUrl] = useState(null);
  useEffect(() => {
    QRCode.toDataURL('https://greet-me.com/#/app', {
      width: 200, margin: 1,
      color: { dark: '#667eea', light: '#ffffff' },
    }).then(setAppQrUrl).catch(() => {});
  }, []);

  // Refs
  const voiceInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);

  // State
  const [contacts, setContacts] = useState([]);
  // Warm re-entry race mitigation: dashboard's contacts fetch is async, so the
  // initial [] is ambiguous with a settled-empty result. The warm-reentry gate
  // is gated on contactsLoaded so it does not flash before fetch resolves.
  const [contactsLoaded, setContactsLoaded] = useState(false);
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
  const [showQRCashModal, setShowQRCashModal] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [showG1G1Modal, setShowG1G1Modal] = useState(false);
  const [sentGreetings, setSentGreetings] = useState([]);
  const [qrCashGifts, setQrCashGifts] = useState([]);
  const [rewardsBalance, setRewardsBalance] = useState(0);
  const [viewMode, setViewMode] = useState('recipients'); // 'recipients' or 'occasions'
  const [isNarrow, setIsNarrow] = useState(window.innerWidth <= 768);
  const [isPortrait, setIsPortrait] = useState(
    typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  );

  // Handle resize + orientation change for mobile/portrait detection
  useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth <= 768);
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // --- Presence persistence (navigation-safe) ---
  const PRESENCE_KEY = 'gm_presence_v1';

  useEffect(() => {
    try {
      const raw = safeSessionGet(PRESENCE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);

      if (typeof saved.voiceRecorded === 'boolean') setVoiceRecorded(saved.voiceRecorded);
      if (typeof saved.photoUploaded === 'boolean') setPhotoUploaded(saved.photoUploaded);
      if (typeof saved.voiceFileUrl === 'string') setVoiceFileUrl(saved.voiceFileUrl);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      safeSessionSet(
        PRESENCE_KEY,
        JSON.stringify({ voiceRecorded, photoUploaded, voiceFileUrl })
      );
    } catch {}
  }, [voiceRecorded, photoUploaded, voiceFileUrl]);



  useEffect(() => {
    fetchDashboardData();
    loadPersistedMedia();
    // Load rewards balance
    setRewardsBalance(getRewardsBalance());
  }, []);

  // Refresh rewards balance when tab regains focus (e.g. after a send)
  useEffect(() => {
    const handleFocus = () => {
      setRewardsBalance(getRewardsBalance());
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Sync photoUploaded state when user.photoUrl changes (e.g., after hydration)
  useEffect(() => {
    if (user?.photoUrl) {
      setPhotoUploaded(true);
    }
  }, [user?.photoUrl]);

  // Load persisted media from localStorage (voice only; photo comes from user.photoUrl)
  const loadPersistedMedia = () => {
    try {
      const savedVoice = safeGet('greetme_voice_file');

      if (savedVoice) {
        setVoiceFileUrl(savedVoice);
        setVoiceRecorded(true);
      } else if (user?.voiceId || user?.voiceUrl) {
        setVoiceRecorded(true);
      }

      // Photo status from backend via AuthContext (user.photoUrl)
      if (user?.photoUrl) {
        setPhotoUploaded(true);
      }

      // Sent greetings now loaded from API in fetchDashboardData()

      // Load QR Cash gifts
      const savedQrCash = safeGet('greetme_qrcash_gifts');
      if (savedQrCash) {
        setQrCashGifts(JSON.parse(savedQrCash));
      }
    } catch (error) {
      console.error('Error loading persisted media:', error);
    }
  };

  // Convert file to base64 data URL for persistence
  const fileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      try {
        const contactsRes = await api.getContacts();
        if (contactsRes?.ok !== false) {
          setContacts(contactsRes.data || []);
        } else {
          // If API fails, try localStorage (same as Recipients page)
          const stored = safeGet('greetme_recipients');
          if (stored) {
            setContacts(JSON.parse(stored));
          }
        }
      } catch (err) {
        console.log('Contacts endpoint not available yet, checking localStorage');
        const stored = safeGet('greetme_recipients');
        if (stored) {
          setContacts(JSON.parse(stored));
        }
      } finally {
        // Warm re-entry race mitigation: fetch settled (success or fall-through);
        // gate may now read contacts.length authoritatively.
        setContactsLoaded(true);
      }

      try {
        const upcomingRes = await api.getUpcomingOccasions();
        if (upcomingRes?.ok !== false) {
          setUpcomingOccasions(upcomingRes.data || []);
        }
      } catch (err) {
        console.log('Upcoming endpoint not available yet');
      }

      // Fetch sent greetings from API
      try {
        const sentRes = await api.getSentGreetings();
        if (sentRes?.greetings) {
          // Map Cosmos fields to the shape the dashboard table expects
          setSentGreetings(sentRes.greetings.map(g => ({
            id: g.id,
            recipient: g.recipientName || 'Unknown',
            recipientEmail: g.recipientEmail,
            relationship: g.occasionType || '',
            icons: [getOccasionIcon(g.occasionType)],
            occasions: [g.occasionType || 'General'],
            date: g.sentAt ? new Date(g.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
            sent: g.status === 'completed',
            status: g.status,
            videoUrl: g.videoUrl,
          })));
        }
      } catch (err) {
        console.log('Sent greetings endpoint not available yet');
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
      // Convert file to base64 data URL for persistence
      const dataUrl = await fileToDataUrl(file);

      // Save to localStorage for persistence
      safeSet('greetme_voice_file', dataUrl);

      setVoiceFileUrl(dataUrl);
      setVoiceRecorded(true);
      pushInApp(COMMS_EVENTS.VOICE_UPLOADED);
    } catch (error) {
      console.error('Voice upload error:', error);
      alert(getErrorMessage(error));
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
  // Cleanup timers on unmount (do NOT revoke voiceFileUrl here)
    useEffect(() => {
      return () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
    }
  };
}, []);


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

    mediaRecorderRef.current.onstop = async () => {
      try {
        // Build audio blob from chunks
        const mime = mediaRecorderRef.current?.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mime });

        // Convert blob to data URL for persistence
        const dataUrl = await fileToDataUrl(blob);

        // Save to localStorage
        safeSet('greetme_voice_file', dataUrl);

        setVoiceFileUrl(dataUrl);
        setVoiceRecorded(true);
        pushInApp(COMMS_EVENTS.VOICE_UPLOADED);
      } catch (error) {
        console.error('Error saving recording:', error);
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
      // Upload to backend /api/profile/photo
      const form = new FormData();
      form.append('photo', file);

      const token = getToken();
      const API_URL = import.meta.env.VITE_API_BASE;
      if (!API_URL) throw new Error("VITE_API_BASE is required");

      const res = await fetch(`${API_URL}/api/profile/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Force re-hydrate profile from backend to ensure photoUrl is current
      await refreshProfile();

      setPhotoUploaded(true);
      pushInApp(COMMS_EVENTS.PHOTO_UPLOADED);
    } catch (error) {
      console.error('Photo upload error:', error);
      alert(getErrorMessage(error));
    } finally {
      setUploadingPhoto(false);
    }
  };

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

  // Filter contacts based on search term
  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.relationship?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Subscription lifecycle banner — calm neutral style, text-only differentiation
  const SUB_BANNER_TEXT = {
    past_due: 'Your payment method needs updating. Please update your billing details in Settings to avoid service interruption.',
    canceled: 'Your subscription has ended. You can resubscribe anytime from Settings.',
    refunded: 'Your recent payment was refunded. If you have questions, please contact support.',
  };
  const bannerText = SUB_BANNER_TEXT[user?.subscriptionStatus];

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', overflowX: 'hidden' }}>
      {/* Subscription lifecycle banner */}
      {bannerText && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '0.875rem 1.25rem',
          marginBottom: '1rem',
          color: '#475569',
          fontSize: '0.9rem',
          lineHeight: 1.5,
        }}>
          {bannerText}
        </div>
      )}
      {/* Background Frame for Page Body */}
      <div style={{
        background: '#f8fafc',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid #e2e8f0',
        padding: isNarrow ? '1rem' : '1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
      {/* Combined Navigation Header */}
      <div style={{
        display: 'flex',
        gap: isNarrow ? '0.5rem' : '1rem',
        marginBottom: isNarrow ? '1rem' : '2rem',
        justifyContent: isPortrait ? 'center' : 'space-between',
        alignItems: 'center',
        flexWrap: isNarrow ? 'wrap' : 'nowrap'
      }}>
        {/* Hero Program Button - Left Side - Hidden on Mobile */}
        {!isPortrait && (
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
            {...getHoverHandlers({
              onEnter: (e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
              },
              onLeave: (e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
              },
            })}
            title="Access the Greet-Me Hero™ Program"
          >
            🥇 Greet-Me Hero™
          </button>
        )}

        {/* Action Buttons - Visible on all screens */}
        <div style={{
          display: 'flex',
          flexDirection: isPortrait ? 'column-reverse' : 'row',
          gap: isNarrow ? '0.5rem' : '1rem',
          width: isPortrait ? '100%' : 'auto',
          justifyContent: isPortrait ? 'center' : 'flex-end'
        }}>
        <button
          onClick={() => navigate('/dashboard/contacts', { state: { openAddRecipient: true } })}
          style={{
            padding: isNarrow ? '0.625rem 1rem' : '0.75rem 1.5rem',
            background: isPortrait ? 'transparent' : '#667eea',
            color: isPortrait ? '#667eea' : 'white',
            border: isPortrait ? '1.5px solid #667eea' : 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: isNarrow ? '0.8125rem' : '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
            boxShadow: isPortrait ? 'none' : '0 2px 4px rgba(102, 126, 234, 0.2)',
            fontFamily: 'inherit',
            flex: isPortrait ? 1 : 'none',
            whiteSpace: 'nowrap'
          }}
          {...(isPortrait ? {} : getHoverHandlers({
            onEnter: (e) => {
              e.currentTarget.style.background = '#5568d3';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
            },
            onLeave: (e) => {
              e.currentTarget.style.background = '#667eea';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.2)';
            },
          }))}
        >
          <Plus size={isNarrow ? 16 : 18} style={{ flexShrink: 0 }} />
          Add Recipient
        </button>
        <button
          onClick={() => navigate('/dashboard/send')}
          style={{
            padding: isNarrow ? '0.625rem 1rem' : '0.75rem 1.5rem',
            background: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: isNarrow ? '0.8125rem' : '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)',
            fontFamily: 'inherit',
            flex: isPortrait ? 1 : 'none'
          }}
          {...getHoverHandlers({
            onEnter: (e) => {
              e.currentTarget.style.background = '#16a34a';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(34, 197, 94, 0.3)';
            },
            onLeave: (e) => {
              e.currentTarget.style.background = '#22c55e';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.2)';
            },
          })}
        >
          <Send size={isNarrow ? 14 : 16} style={{ flexShrink: 0 }} />
          Send Greet-Me
        </button>
        </div>
      </div>

      {/* Onboarding Coach (dashboard nudge for incomplete setup) */}
      {/* Phase 3D Batch D Slice 5 — mount only when account state allows.
          Subscription/payment state wins over localStorage flags. */}
      {shouldShowOnboarding(accountState) && (
        <OnboardingCoach
          voiceDone={voiceRecorded || !!user?.voiceId || !!user?.voiceUrl}
          photoDone={photoUploaded || !!user?.photoUrl}
          recipientDone={contacts.length > 0}
        />
      )}

      {/* Warm "already personalized" dashboard re-entry — Tier 2 follow-on to
          the convergence repair. Mutually exclusive with OnboardingCoach by
          gate construction. contactsLoaded sentinel prevents flash before the
          contacts fetch resolves. */}
      {shouldShowWarmReentry(accountState, contactsLoaded ? contacts.length : null) && (
        <WarmReentryWelcome isNarrow={isNarrow} />
      )}

      {/* Dashboard Cards - All same height */}
      {/* Green G1G1 Card - Full Width */}
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: isNarrow ? '1rem' : '1.25rem',
        marginBottom: '1rem',
        color: 'white',
        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: isNarrow ? 'auto' : '120px',
        textAlign: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div>
            <h3 style={{
              fontSize: isNarrow ? '1.125rem' : '1.375rem',
              fontWeight: 700,
              marginBottom: '0.25rem'
            }}>
              Greet One, Give One™
            </h3>
            <p style={{
              fontSize: isNarrow ? '0.8125rem' : '0.9375rem',
              fontWeight: 600,
              opacity: 0.95
            }}>
              Every subscription includes one for you — and one for a loved one.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={() => setShowG1G1Modal(true)}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'white',
              color: '#059669',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: isNarrow ? '0.75rem' : '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit'
            }}
          >
            Learn More
          </button>
        </div>
      </div>

      {/* QR Cash + Rewards - Two Equal Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isPortrait ? '1fr' : '1fr 1fr',
        gap: '1rem',
        marginBottom: isNarrow ? '1rem' : '1.5rem'
      }}>
        {/* QR Cash Card - PHASE 8.1: Primary visual weight */}
        <div style={{
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: isNarrow ? '1.125rem' : '1.375rem',
          color: 'white',
          boxShadow: '0 4px 12px rgba(251, 191, 36, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: isNarrow ? 'auto' : '120px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <h3 style={{
                  fontSize: isNarrow ? '0.9375rem' : '1.0625rem',
                  fontWeight: 700,
                  marginBottom: '0.125rem'
                }}>
                  QR Cash™
                </h3>
                <span
                  title="QR Cash can be sent as a gift or used toward purchases."
                  style={{
                    cursor: 'help',
                    opacity: 0.85,
                    fontSize: '0.75rem',
                    marginBottom: '0.125rem'
                  }}
                >ⓘ</span>
              </div>
              <p style={{
                fontSize: isNarrow ? '0.6875rem' : '0.75rem',
                opacity: 0.9,
                letterSpacing: '0.025em'
              }}>
                Send • Spend • Gift
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{
                fontSize: isNarrow ? '1.25rem' : '1.5rem',
                fontWeight: 700,
                marginBottom: '0.125rem'
              }}>
                $0.00
              </p>
              <p style={{
                fontSize: isNarrow ? '0.625rem' : '0.6875rem',
                opacity: 0.8
              }}>
                Available balance
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              onClick={() => setShowQRCashModal(true)}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                background: 'white',
                color: '#f59e0b',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: isNarrow ? '0.75rem' : '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              Send
            </button>
            <button
              onClick={() => setShowHowItWorksModal(true)}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: isNarrow ? '0.75rem' : '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              Learn
            </button>
          </div>
        </div>

        {/* Rewards Program Card - PHASE 8.1: Secondary visual weight */}
        <div style={{
          background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: isNarrow ? '1rem' : '1.25rem',
          color: 'white',
          boxShadow: '0 2px 8px rgba(236, 72, 153, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: isNarrow ? 'auto' : '120px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Heart size={isNarrow ? 14 : 16} style={{ fill: 'white', color: 'white', opacity: 0.85 }} />
                <h3 style={{
                  fontSize: isNarrow ? '0.875rem' : '1rem',
                  fontWeight: 600,
                  marginBottom: 0
                }}>
                  Rewards
                </h3>
              </div>
              <p style={{
                fontSize: isNarrow ? '0.6875rem' : '0.75rem',
                opacity: 0.85,
                marginTop: '0.125rem'
              }}>
                Earn • Redeem • Enjoy
              </p>
            </div>
            <p style={{
              fontSize: isNarrow ? '1.25rem' : '1.5rem',
              fontWeight: 700
            }}>
              {rewardsBalance} pts
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              onClick={() => navigate('/dashboard/rewards')}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                background: 'white',
                color: '#be185d',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: isNarrow ? '0.75rem' : '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              View
            </button>
            <button
              onClick={() => navigate('/dashboard/rewards')}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: isNarrow ? '0.75rem' : '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              Redeem
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Layout - PHASE 7: Locked heights, stretch alignment */}
      <div
        className="dashboard-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: isPortrait ? '1fr' : '1fr 1fr',
          gap: '1.5rem',
          marginBottom: '2rem',
          alignItems: 'stretch',
          height: isNarrow ? 'auto' : '600px',
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
        {/* Left Column - Your Presence - PHASE 7: Height from parent, pinned footer */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.5rem',
            border: '2px solid var(--border)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
            minHeight: 0
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
              paddingBottom: '0.75rem',
              borderBottom: '2px solid var(--border)'
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0
              }}>Personalization</h2>
              {!isPortrait && (
                <button
                  onClick={() => navigate('/dashboard/media')}
                  style={{
                    padding: '0.375rem 0.75rem',
                    background: 'transparent',
                    color: '#667eea',
                    border: '1px solid #667eea',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit'
                  }}
                  {...getHoverHandlers({
                    onEnter: (e) => {
                      e.currentTarget.style.background = '#667eea';
                      e.currentTarget.style.color = 'white';
                    },
                    onLeave: (e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#667eea';
                    },
                  })}
                  title="Open Media Library"
                >
                  <ImageIcon size={14} />
                  Media Library
                </button>
              )}
            </div>
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
              {voiceFileUrl && (
                <audio
                  ref={audioRef}
                  src={voiceFileUrl}
                  onEnded={() => setIsPlayingVoice(false)}
                  style={{ display: 'none' }}
                />
              )}


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
              {/* Top row: Record and Play buttons side by side */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={isRecording ? stopMicRecording : startMicRecording}
                  disabled={uploadingVoice}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    background: uploadingVoice ? '#e5e7eb' : isRecording ? '#dc2626' : '#ef4444',
                    color: uploadingVoice ? '#9ca3af' : 'white',
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
                  {...getHoverHandlers({
                    onEnter: (e) => {
                      if (!uploadingVoice) {
                        e.currentTarget.style.background = isRecording ? '#b91c1c' : '#dc2626';
                      }
                    },
                    onLeave: (e) => {
                      if (!uploadingVoice) {
                        e.currentTarget.style.background = isRecording ? '#dc2626' : '#ef4444';
                      }
                    },
                  })}
                >
                  {isRecording ? <Square size={16} /> : <Mic size={16} />}
                  {isRecording ? 'Stop' : 'Record'}
                </button>
                <button
                  type="button"
                  onClick={handlePlayVoice}
                  disabled={!voiceRecorded || !voiceFileUrl || isRecording}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: (!voiceRecorded || isRecording) ? 'not-allowed' : 'pointer',
                    opacity: (!voiceRecorded || isRecording) ? 0.6 : 1,
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  {...getHoverHandlers({
                    onEnter: (e) => {
                      if (voiceRecorded && !isRecording) {
                        e.currentTarget.style.background = '#2563eb';
                      }
                    },
                    onLeave: (e) => {
                      e.currentTarget.style.background = '#3b82f6';
                    },
                  })}
                >
                  {isPlayingVoice ? <Pause size={16} /> : <Play size={16} />}
                  Play
                </button>
              </div>
              {/* Bottom row: Save & Done button spanning full width */}
              <button
                type="button"
                onClick={() => alert('Voice saved successfully!')}
                disabled={!voiceRecorded || uploadingVoice}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  background: '#22c55e',
                  color: 'white',
                  opacity: (!voiceRecorded || uploadingVoice) ? 0.6 : 1,
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: (!voiceRecorded || uploadingVoice) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                {...getHoverHandlers({
                  onEnter: (e) => {
                    if (voiceRecorded && !uploadingVoice) {
                      e.currentTarget.style.background = '#16a34a';
                    }
                  },
                  onLeave: (e) => {
                    if (voiceRecorded && !uploadingVoice) {
                      e.currentTarget.style.background = '#22c55e';
                    }
                  },
                })}
              >
                <CheckCircle size={16} />
                Save & Done
              </button>
            </div>

            {/* Photo Section - PHASE 7.4: Grows to fill, buttons pinned to bottom */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
              />
              {/* Photo header + buttons - PHASE 7.4: Pinned to bottom */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto', flexShrink: 0 }}>
                {/* Photo icon and status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '4rem',
                    height: '4rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    <Camera size={24} style={{ color: 'white' }} />
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
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    background: uploadingPhoto ? '#e5e7eb' : '#667eea',
                    color: uploadingPhoto ? '#9ca3af' : 'white',
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
                  {...getHoverHandlers({
                    onEnter: (e) => {
                      if (!uploadingPhoto) e.currentTarget.style.background = '#5568d3';
                    },
                    onLeave: (e) => {
                      if (!uploadingPhoto) e.currentTarget.style.background = '#667eea';
                    },
                  })}
                >
                  <Upload size={16} />
                  {uploadingPhoto ? 'Uploading...' : 'Add Photo'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/media')}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    background: 'white',
                    color: '#667eea',
                    border: '1px solid #667eea',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  {...getHoverHandlers({
                    onEnter: (e) => {
                      e.currentTarget.style.background = '#667eea';
                      e.currentTarget.style.color = 'white';
                    },
                    onLeave: (e) => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.color = '#667eea';
                    },
                  })}
                >
                  <ImageIcon size={16} />
                  Select from Media Library
                </button>
                <button
                  type="button"
                  onClick={() => alert('Photo saved successfully!')}
                  disabled={!photoUploaded || uploadingPhoto}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    background: '#22c55e',
                    color: 'white',
                    opacity: (!photoUploaded || uploadingPhoto) ? 0.6 : 1,
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: (!photoUploaded || uploadingPhoto) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  {...getHoverHandlers({
                    onEnter: (e) => {
                      if (photoUploaded && !uploadingPhoto) {
                        e.currentTarget.style.background = '#16a34a';
                      }
                    },
                    onLeave: (e) => {
                      if (photoUploaded && !uploadingPhoto) {
                        e.currentTarget.style.background = '#22c55e';
                      }
                    },
                  })}
                >
                  <CheckCircle size={16} />
                  Save & Done
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Recipients & Occasions - PHASE 7: Height from parent, internal scroll */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0  /* Allow flex shrinking */
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: isNarrow ? '0.75rem' : '1.5rem',
            border: '2px solid var(--border)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',   /* Match parent height */
            minHeight: 0      /* Allow flex shrinking below content */
          }}>
            <div style={{ display: 'flex', flexDirection: isPortrait ? 'column' : 'row', alignItems: isPortrait ? 'stretch' : 'center', justifyContent: 'space-between', gap: isPortrait ? '0.75rem' : '0', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--border)' }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0
              }}>Recipients & Occasions</h2>
              {!isPortrait && (
                <button
                  onClick={() => navigate('/dashboard/contacts', { state: { openAddRecipient: true } })}
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
              )}
            </div>

            {/* View Toggle */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              background: 'var(--gray-100)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.25rem',
            }}>
              <button
                onClick={() => setViewMode('recipients')}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  background: viewMode === 'recipients' ? 'white' : 'transparent',
                  color: viewMode === 'recipients' ? '#667eea' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  boxShadow: viewMode === 'recipients' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                }}
              >
                By Recipient
              </button>
              <button
                onClick={() => setViewMode('occasions')}
                style={{
                  flex: 1,
                  padding: '0.5rem 1rem',
                  background: viewMode === 'occasions' ? 'white' : 'transparent',
                  color: viewMode === 'occasions' ? '#667eea' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  boxShadow: viewMode === 'occasions' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                }}
              >
                By Occasion
              </button>
            </div>

            {/* Search Bar */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
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
                placeholder={viewMode === 'recipients' ? 'Search recipients...' : 'Search occasions...'}
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

            {/* Contact List - By Recipient - PHASE 3: Internal scroll container */}
            {viewMode === 'recipients' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              flex: 1,
              minHeight: 0,
              maxHeight: 'min(480px, 50dvh)',
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              background: 'var(--gray-100)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: isNarrow ? '8px' : '12px'
            }}>
              {contacts.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👥</div>
                  <p style={{ fontSize: '0.9rem', margin: '0 0 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    No recipients yet
                  </p>
                  <p style={{ fontSize: '0.8125rem', margin: '0 0 1rem', lineHeight: 1.5 }}>
                    Add your first recipient to start sending personalized Greet-Me greetings automatically for every occasion. You can also send a Greet-Me anytime.
                  </p>
                  <button
                    onClick={() => navigate('/dashboard/contacts', { state: { openAddRecipient: true } })}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Add Recipient
                  </button>
                </div>
              ) : filteredContacts.length === 0 && searchTerm ? (
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
                    gap: isNarrow ? '0.5rem' : '1rem',
                    padding: isNarrow ? '0.5rem' : '0.75rem',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => navigate('/dashboard/contacts', { state: { openEditRecipientId: contact.id } })}
                  {...getHoverHandlers({
                    onEnter: (e) => { e.currentTarget.style.background = 'var(--gray-50)'; },
                    onLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
                  })}
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
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '0.25rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={contact.name}>{contact.name}</div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={contact.relationship}>
                      {contact.relationship}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: isNarrow ? '0.25rem' : '0.75rem', alignItems: 'center' }}>
                    {/* Gift Indicator */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: contact.giftSelected
                          ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                          : 'var(--gray-100)',
                        border: contact.giftSelected ? 'none' : '2px dashed var(--gray-300)',
                        boxShadow: contact.giftSelected ? '0 2px 4px rgba(34, 197, 94, 0.3)' : 'none'
                      }}
                      title={contact.giftSelected ? 'Gift selected' : 'No gift selected'}
                    >
                      <Gift size={14} style={{ color: contact.giftSelected ? 'white' : 'var(--gray-400)' }} />
                    </div>
                    {/* Occasion Icons */}
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      {(contact.occasions || []).slice(0, isPortrait ? 2 : 3).map((occasion, idx) => {
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
                      {contact.occasions && contact.occasions.length > (isPortrait ? 2 : 3) && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-tertiary)',
                          fontWeight: 500
                        }}>
                          +{contact.occasions.length - (isPortrait ? 2 : 3)}
                        </span>
                      )}
                    </div>
                    {/* Quick Send button — preselects this recipient in the send flow */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dashboard/send?contactId=${contact.id}`);
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
                      title={`Send a Greet-Me to ${contact.name}`}
                      aria-label={`Send a Greet-Me to ${contact.name}`}
                    >
                      <Send size={16} />
                    </button>
                    {/* Settings Icon */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/dashboard/contacts', { state: { openEditRecipientId: contact.id } });
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
            )}

            {/* Occasions List - By Occasion - PHASE 3: Internal scroll container */}
            {viewMode === 'occasions' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              flex: 1,
              minHeight: 0,
              maxHeight: 'min(480px, 50dvh)',
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              background: 'var(--gray-100)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px'
            }}>
              {(() => {
                // Gather all unique occasions from contacts
                const occasionMap = {};
                contacts.forEach(contact => {
                  (contact.occasions || []).forEach(occ => {
                    const occasionType = typeof occ === 'object' ? occ.type : occ;
                    if (!occasionMap[occasionType]) {
                      occasionMap[occasionType] = [];
                    }
                    occasionMap[occasionType].push(contact);
                  });
                });

                const occasionTypes = Object.keys(occasionMap).filter(type =>
                  type.toLowerCase().includes(searchTerm.toLowerCase())
                );

                if (occasionTypes.length === 0 && searchTerm) {
                  return (
                    <div style={{
                      textAlign: 'center',
                      padding: '2rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.875rem'
                    }}>
                      No occasions match "{searchTerm}"
                    </div>
                  );
                }

                return occasionTypes.map((occasionType) => (
                  <div
                    key={occasionType}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--gray-50)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => navigate('/dashboard/contacts')}
                    {...getHoverHandlers({
                      onEnter: (e) => { e.currentTarget.style.background = 'var(--gray-100)'; },
                      onLeave: (e) => { e.currentTarget.style.background = 'var(--gray-50)'; },
                    })}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>{getOccasionIcon(occasionType)}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.9375rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}>{occasionType}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {occasionMap[occasionType].length} recipient{occasionMap[occasionType].length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginLeft: '2.25rem' }}>
                      {occasionMap[occasionType].slice(0, 4).map((contact, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: 'white',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {contact.name}
                        </span>
                      ))}
                      {occasionMap[occasionType].length > 4 && (
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-tertiary)',
                        }}>
                          +{occasionMap[occasionType].length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
            )}

            {/* Add Recipient button at bottom */}
            <button
              onClick={() => navigate('/dashboard/contacts', { state: { openAddRecipient: true } })}
              style={{
                width: '100%',
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              {...getHoverHandlers({
                onEnter: (e) => { e.currentTarget.style.background = '#5568d3'; },
                onLeave: (e) => { e.currentTarget.style.background = '#667eea'; },
              })}
            >
              <Plus size={16} />
              Add Recipient
            </button>
          </div>
        </div>
      </div>

      {/* Coming Up Section */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        maxHeight: isNarrow ? '70dvh' : '600px',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: isPortrait ? 'column' : 'row',
          alignItems: isPortrait ? 'stretch' : 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          gap: isNarrow ? '0.75rem' : '0',
          ...(isPortrait && {
            position: 'sticky',
            top: 0,
            background: 'var(--bg-primary)',
            zIndex: 2,
          }),
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0
          }}>Upcoming Occasions <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>from your contacts</span></h2>
          {/* Desktop: inline button in header */}
          {!isPortrait && (
            <button
              onClick={() => navigate('/dashboard/contacts', { state: { openAddRecipient: true } })}
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
          )}
          {/* Mobile: full-width button under title */}
          {isPortrait && (
            <button
              onClick={() => navigate('/dashboard/contacts', { state: { openAddRecipient: true } })}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
            >
              <Plus size={16} />
              Add Recipient
            </button>
          )}
        </div>

        {/* Empty state — real upcoming-occasions data wiring deferred to a future slice */}
        <div style={{
          padding: '3rem 1.5rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '0.9375rem',
          lineHeight: 1.6
        }}>
          Upcoming occasions will appear here as you add recipients.
        </div>
      </div>

      {/* Mobile App QR Code - Subtle placement */}
      <div style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: isNarrow ? '1rem' : '1rem 1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        flexDirection: isPortrait ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: isPortrait ? 'center' : 'space-between',
        gap: isNarrow ? '1rem' : '0',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: isPortrait ? 'center' : 'left' }}>
          <div style={{
            width: isNarrow ? '2.5rem' : '3rem',
            height: isNarrow ? '2.5rem' : '3rem',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
          }}>
            <Smartphone size={isNarrow ? 16 : 20} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.25rem'
            }}>Download Greet-Me™ Mobile App</h3>
            <p style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              margin: 0
            }}>Send Greet-Me messages on the go - scan QR code to download</p>
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
        onClick={() => navigate('/app')}
        {...getHoverHandlers({
          onEnter: (e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
          },
          onLeave: (e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'none';
          },
        })}
        title="Scan to install Greet-Me mobile app"
        >
          {appQrUrl
            ? <img src={appQrUrl} alt="Scan to install Greet-Me" style={{ width: '70%', height: '70%' }} />
            : <QrCode size={40} style={{ color: '#667eea', opacity: 0.3 }} />
          }
        </div>
      </div>

      {/* Past Greetings Section */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        border: '2px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        marginTop: '2rem',
        maxHeight: isNarrow ? '70dvh' : '600px',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        <div style={{
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid var(--border)',
          ...(isPortrait && {
            position: 'sticky',
            top: 0,
            background: 'var(--bg-primary)',
            zIndex: 2,
          }),
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0
          }}>Past Sends <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(Last 30 Days)</span></h2>
        </div>

        {/* Table Header */}
        {!isPortrait && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '0.5fr 0.5fr 2fr 1fr 2fr 1fr',
          padding: '0.75rem 1rem',
          borderBottom: '2px solid var(--border)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-primary)',
          zIndex: 1
        }}>
          <div style={{ textAlign: 'center' }}>STATUS</div>
          <div style={{ textAlign: 'center' }}>CASH</div>
          <div>RECIPIENT</div>
          <div>ICONS</div>
          <div>OCCASIONS</div>
          <div style={{ textAlign: 'right' }}>SENT DATE</div>
        </div>
        )}

        {/* Table Rows — outer card handles scroll; sticky header keeps columns visible */}
        <div>
          {(() => {
            // Combine sent greetings and QR Cash gifts
            const allItems = [
              ...sentGreetings.map(g => ({
                ...g,
                type: 'greeting',
                qrCash: qrCashGifts.find(qr => qr.recipientEmail === g.recipientEmail || qr.recipientName === g.recipient)
              })),
              ...qrCashGifts.filter(qr => !sentGreetings.some(g => g.recipientEmail === qr.recipientEmail || g.recipient === qr.recipientName))
                .map(qr => ({
                  id: qr.id,
                  recipient: qr.recipientName,
                  relationship: 'QR Cash Gift',
                  icons: ['💵'],
                  occasions: ['QR Cash'],
                  date: new Date(qr.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  sent: true,
                  type: 'qrcash',
                  qrCash: qr
                }))
            ];

            if (allItems.length === 0) {
              return (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>💌</div>
                  <p style={{ fontSize: '1rem', margin: '0 0 0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    No Greet-Me sends yet
                  </p>
                  <p style={{ fontSize: '0.875rem', margin: '0 0 1rem', lineHeight: 1.5 }}>
                    Once you add contacts and occasions, Greet-Me™ will handle the rest!
                  </p>
                  <button
                    onClick={() => navigate('/dashboard/send')}
                    style={{
                      padding: '0.625rem 1.5rem',
                      background: '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Send Your First Greet-Me
                  </button>
                </div>
              );
            }

            return allItems.map((item, index, array) => (
              <div
                key={item.id}
                style={{
                  display: isPortrait ? 'flex' : 'grid',
                  flexDirection: isPortrait ? 'column' : undefined,
                  gridTemplateColumns: isPortrait ? undefined : '0.5fr 0.5fr 2fr 1fr 2fr 1fr',
                  padding: isNarrow ? '0.75rem' : '1rem',
                  gap: isNarrow ? '0.5rem' : undefined,
                  borderBottom: index < array.length - 1 ? '1px solid var(--border)' : 'none',
                  alignItems: isPortrait ? 'flex-start' : 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                {...getHoverHandlers({
                  onEnter: (e) => { e.currentTarget.style.background = 'var(--gray-50)'; },
                  onLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
                })}
              >
                {!isPortrait && (
                <div style={{ textAlign: 'center' }}>
                  <CheckCircle
                    size={24}
                    style={{
                      color: '#22c55e',
                      fill: '#22c55e',
                      strokeWidth: 2
                    }}
                  />
                </div>
                )}
                {/* QR Cash Status Icon */}
                {!isPortrait && (
                <div style={{ textAlign: 'center' }}>
                  {item.qrCash ? (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: item.qrCash.redeemed ? '#dcfce7' : '#fef2f2',
                        border: `2px solid ${item.qrCash.redeemed ? '#22c55e' : '#ef4444'}`
                      }}
                      title={item.qrCash.redeemed ? `$${item.qrCash.amount} Received` : `$${item.qrCash.amount} Pending`}
                    >
                      <DollarSign
                        size={16}
                        style={{
                          color: item.qrCash.redeemed ? '#22c55e' : '#ef4444',
                          strokeWidth: 2.5
                        }}
                      />
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>—</span>
                  )}
                </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: isPortrait ? '100%' : 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isPortrait && (
                      <CheckCircle
                        size={18}
                        style={{
                          color: '#22c55e',
                          fill: '#22c55e',
                          strokeWidth: 2
                        }}
                      />
                    )}
                    <div style={{
                      width: isNarrow ? '2rem' : '2.5rem',
                      height: isNarrow ? '2rem' : '2.5rem',
                      borderRadius: '50%',
                      background: 'var(--gray-200)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isNarrow ? '1rem' : '1.25rem'
                    }}>
                      👤
                    </div>
                    <div>
                      <div style={{
                        fontSize: isNarrow ? '0.875rem' : '0.9375rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                      }}>{item.recipient}</div>
                      <div style={{
                        fontSize: isNarrow ? '0.75rem' : '0.8125rem',
                        color: 'var(--text-secondary)'
                      }}>{item.relationship}</div>
                    </div>
                  </div>
                  {isPortrait && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      {item.date}
                    </div>
                  )}
                </div>
                {!isPortrait && (
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {(item.icons || []).map((icon, idx) => (
                    <span key={idx} style={{ fontSize: '1.25rem' }}>{icon}</span>
                  ))}
                </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {(item.occasions || []).map((occasion, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '0.25rem 0.625rem',
                        background: 'rgba(34, 197, 94, 0.1)',
                        color: '#22c55e',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.75rem',
                        fontWeight: 500
                      }}
                    >
                      {occasion}
                    </span>
                  ))}
                  {item.qrCash && (
                    <span
                      style={{
                        padding: '0.25rem 0.625rem',
                        background: item.qrCash.redeemed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: item.qrCash.redeemed ? '#22c55e' : '#ef4444',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.75rem',
                        fontWeight: 500
                      }}
                    >
                      💵 ${item.qrCash.amount}
                    </span>
                  )}
                </div>
                {!isPortrait && (
                <div style={{
                  textAlign: 'right',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)'
                }}>
                  {item.date}
                </div>
                )}
              </div>
            ));
          })()}
        </div>
      </div>
      </div>
      {/* End Background Frame */}

      {/* QR Cash Gift Modal */}
      <QRCashGiftModal
        isOpen={showQRCashModal}
        onClose={() => setShowQRCashModal(false)}
      />

      {/* How QR Cash Works Modal */}
      {showHowItWorksModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowHowItWorksModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
              backdropFilter: 'blur(4px)'
            }}
          />

          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              borderTopLeftRadius: 'var(--radius-xl)',
              borderTopRightRadius: 'var(--radius-xl)',
              color: 'white',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  margin: 0,
                  marginBottom: '0.25rem'
                }}>How QR Cash Works</h2>
                <p style={{
                  fontSize: '0.875rem',
                  opacity: 0.9,
                  margin: 0
                }}>Send · Scan · Spend</p>
              </div>
              <button
                onClick={() => setShowHowItWorksModal(false)}
                style={{
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  border: '2px solid white',
                  borderRadius: '9999px',
                  padding: '0.5rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: 'white',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                  flexShrink: 0,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  fontFamily: 'inherit'
                }}
                {...getHoverHandlers({
                  onEnter: (e) => { e.currentTarget.style.transform = 'scale(1.05)'; },
                  onLeave: (e) => { e.currentTarget.style.transform = 'scale(1)'; },
                })}
                title="Close"
              >
                <X size={16} strokeWidth={3} />
                Close
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '2rem' }}>
              {/* Introduction */}
              <p style={{
                fontSize: '1rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                marginBottom: '2rem',
                textAlign: 'center'
              }}>
                QR Cash lets you send real money as a gift that recipients can spend anywhere. It's simple, personal, and universally appreciated.
              </p>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Step 1 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(251, 191, 36, 0.2)'
                }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)'
                  }}>
                    <Send size={20} style={{ color: 'white' }} />
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>1. Create & Send</h3>
                    <p style={{
                      fontSize: '0.9375rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      margin: 0
                    }}>
                      Choose an amount ($5, $10, $25, or custom), add a personal message, and enter the recipient's name and email. We'll generate a unique QR code and send it automatically, or you can print/share it yourself.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.05) 100%)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(102, 126, 234, 0.2)'
                }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                  }}>
                    <QrCode size={20} style={{ color: 'white' }} />
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>2. Recipient Scans</h3>
                    <p style={{
                      fontSize: '0.9375rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      margin: 0
                    }}>
                      The recipient receives the QR Cash via email or as a printed gift. They simply scan the QR code with their phone camera to open the redemption page and claim their cash gift.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.05) 100%)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(34, 197, 94, 0.2)'
                }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                  }}>
                    <CreditCard size={20} style={{ color: 'white' }} />
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>3. Spend Anywhere</h3>
                    <p style={{
                      fontSize: '0.9375rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      margin: 0
                    }}>
                      Once redeemed, the cash is transferred to their preferred payment method (bank account, PayPal, Venmo, etc.). They can spend it anywhere they like—no restrictions!
                    </p>
                  </div>
                </div>
              </div>

              {/* Tracking Info */}
              <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                textAlign: 'center'
              }}>
                <Gift size={24} style={{ color: '#f59e0b', marginBottom: '0.5rem' }} />
                <p style={{
                  fontSize: '0.9375rem',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.6
                }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Track Your Gifts:</strong> You'll see a red dollar sign for pending gifts and a green dollar sign when they've been received in your Past Greetings dashboard.
                </p>
              </div>

              {/* CTA Button */}
              <button
                onClick={() => {
                  setShowHowItWorksModal(false);
                  setShowQRCashModal(true);
                }}
                style={{
                  width: '100%',
                  marginTop: '2rem',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                {...getHoverHandlers({
                  onEnter: (e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.4)';
                  },
                  onLeave: (e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.3)';
                  },
                })}
              >
                <DollarSign size={20} />
                Send QR Cash Now
              </button>
            </div>
          </div>
        </>
      )}

      {/* Greet One, Give One Modal */}
      {showG1G1Modal && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowG1G1Modal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
              backdropFilter: 'blur(4px)'
            }}
          />

          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: '1rem',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            width: '90%',
            maxWidth: '550px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowG1G1Modal(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                zIndex: 10
              }}
              {...getHoverHandlers({
                onEnter: (e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'; },
                onLeave: (e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; },
              })}
            >
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', lineHeight: 1 }}>×</span>
            </button>

            {/* Header */}
            <div style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                fontSize: '2rem'
              }}>
                🎁
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                marginBottom: '0.5rem'
              }}>
                Greet One, Give One™
              </h2>
              <p style={{
                fontSize: '0.9375rem',
                opacity: 0.95
              }}>
                Share the joy of connection
              </p>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {/* How It Works */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.75rem'
                }}>
                  How It Works
                </h3>
                <p style={{
                  fontSize: '0.9375rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: '0.75rem'
                }}>
                  Every Greet-Me™ subscription includes <strong>two subscriptions</strong> — one for you and one to gift to someone you care about. It's our way of spreading meaningful connections.
                </p>
                <ul style={{
                  fontSize: '0.9375rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.8,
                  paddingLeft: '1.25rem',
                  margin: 0
                }}>
                  <li>Your gift subscription has the <strong>same value</strong> as yours</li>
                  <li>Recipient gets <strong>full access</strong> to all features <strong>free for one year</strong></li>
                  <li>Gift link never expires — send it when you're ready</li>
                  <li>At checkout, <strong>designate a recipient</strong> or <strong>receive the gift link via email</strong> — however you prefer</li>
                </ul>
              </div>

              {/* Limitations */}
              <div style={{
                background: '#fef3c7',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem',
                marginBottom: '1.5rem',
                border: '1px solid #fcd34d'
              }}>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#92400e',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1rem' }}>⚠️</span>
                  <span><strong>Note:</strong> Greet One, Give One is available for individual subscriptions only and does not apply to corporate bundles or Hero Program purchases.</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowG1G1Modal(false)}
                  style={{
                    flex: 1,
                    padding: '0.875rem 1.5rem',
                    background: 'white',
                    color: 'var(--text-primary)',
                    border: '2px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit'
                  }}
                >
                  Got It
                </button>
                <button
                  onClick={() => {
                    setShowG1G1Modal(false);
                    navigate('/pricing');
                  }}
                  style={{
                    flex: 1,
                    padding: '0.875rem 1.5rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  View Plans
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
