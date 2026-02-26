// src/components/OnboardingCoach.jsx
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Copy, CheckCircle } from 'lucide-react';


const ONBOARDING_KEYS = {
  DISMISSED: 'greetme_onboarding_v1_dismissed',
  COMPLETED: 'greetme_onboarding_v1_completed',
  CONFETTI_FIRED: 'greetme_onboarding_v1_confetti_fired'
};

export default function OnboardingCoach({ voiceDone, photoDone, recipientDone }) {
  const [isVisible, setIsVisible] = useState(false);
  const [showScripts, setShowScripts] = useState(false);
  const [copiedScript, setCopiedScript] = useState(null);

  useEffect(() => {
    // Check if onboarding should be shown
    const dismissed = localStorage.getItem(ONBOARDING_KEYS.DISMISSED);
    const completed = localStorage.getItem(ONBOARDING_KEYS.COMPLETED);

    if (!dismissed && !completed) {
      setIsVisible(true);
    }
  }, []);

  useEffect(() => {
    // Check if all tasks are complete
    if (voiceDone && photoDone && recipientDone && isVisible) {
      const confettiFired = localStorage.getItem(ONBOARDING_KEYS.CONFETTI_FIRED);

      if (!confettiFired) {
        // Fire confetti once
        
        localStorage.setItem(ONBOARDING_KEYS.CONFETTI_FIRED, "true");
        
        (async () => {
          const confetti = (await import("canvas-confetti")).default;
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        })();

        localStorage.setItem(ONBOARDING_KEYS.CONFETTI_FIRED, 'true');
      }

      // Mark as completed
      localStorage.setItem(ONBOARDING_KEYS.COMPLETED, 'true');
    }
  }, [voiceDone, photoDone, recipientDone, isVisible]);

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEYS.DISMISSED, 'true');
    setIsVisible(false);
  };

  const handleCopyScript = (script, index) => {
    navigator.clipboard.writeText(script);
    setCopiedScript(index);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  if (!isVisible) return null;

  const allComplete = voiceDone && photoDone && recipientDone;

  const sampleScripts = [
    "Hi! This is [Your Name]. I'm sending you a personal greeting to let you know I'm thinking of you. Have a wonderful day!",
    "Hey there! Just wanted to brighten your day with a quick hello. Hope everything is going great for you!",
    "Hello! Sending you warm wishes and good vibes. Looking forward to catching up soon!"
  ];

  return (
    <div style={{
      background: allComplete
        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: 'var(--radius-xl)',
      padding: '1.5rem',
      marginBottom: '2rem',
      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      color: 'white'
    }}>
      {allComplete ? (
        // Completion state
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            marginBottom: '0.5rem'
          }}>
            <CheckCircle size={32} style={{ color: 'white' }} />
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              margin: 0
            }}>You're all set!</h2>
          </div>
          <p style={{
            fontSize: '0.9375rem',
            opacity: 0.95,
            marginBottom: '1rem'
          }}>
            Your Greet-Me™ profile is ready. You can now send personalized Greet-Me messages!
          </p>
          <button
            onClick={() => setIsVisible(false)}
            style={{
              padding: '0.625rem 1.5rem',
              background: 'white',
              color: '#10b981',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
            }}
          >
            Got it!
          </button>
        </div>
      ) : (
        // Onboarding in-progress state
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem'
          }}>
            <div>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                margin: 0,
                marginBottom: '0.25rem'
              }}>You're in the right place</h2>
              <p style={{
                fontSize: '0.875rem',
                opacity: 0.9,
                margin: 0
              }}>This takes under 2 minutes. Complete these 3 quick steps:</p>
            </div>
            <button
              onClick={handleSkip}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              Skip for now
            </button>
          </div>

          {/* Checklist */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            {/* Voice */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: voiceDone ? 'white' : 'transparent',
                  border: voiceDone ? 'none' : '2px solid rgba(255, 255, 255, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: '#667eea'
                }}>
                  {voiceDone && '✓'}
                </div>
                <span style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600
                }}>Record voice</span>
              </div>
              <p style={{
                fontSize: '0.75rem',
                opacity: 0.85,
                margin: 0
              }}>Use the microphone or upload a voice file</p>
            </div>

            {/* Photo */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: photoDone ? 'white' : 'transparent',
                  border: photoDone ? 'none' : '2px solid rgba(255, 255, 255, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: '#667eea'
                }}>
                  {photoDone && '✓'}
                </div>
                <span style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600
                }}>Upload photo</span>
              </div>
              <p style={{
                fontSize: '0.75rem',
                opacity: 0.85,
                margin: 0
              }}>Add your photo from files or library</p>
            </div>

            {/* Recipient */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: recipientDone ? 'white' : 'transparent',
                  border: recipientDone ? 'none' : '2px solid rgba(255, 255, 255, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: '#667eea'
                }}>
                  {recipientDone && '✓'}
                </div>
                <span style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600
                }}>Add recipient</span>
              </div>
              <p style={{
                fontSize: '0.75rem',
                opacity: 0.85,
                margin: 0
              }}>Click "Add Recipient" to create your first contact</p>
            </div>
          </div>

          {/* Sample scripts section */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <button
              onClick={() => setShowScripts(!showScripts)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'inherit'
              }}
            >
              <span>Need a fun script?</span>
              {showScripts ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showScripts && (
              <div style={{ marginTop: '1rem' }}>
                {sampleScripts.map((script, index) => (
                  <div
                    key={index}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem',
                      marginBottom: index < sampleScripts.length - 1 ? '0.5rem' : 0,
                      fontSize: '0.8125rem',
                      lineHeight: 1.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.75rem'
                    }}
                  >
                    <span style={{ flex: 1 }}>{script}</span>
                    <button
                      onClick={() => handleCopyScript(script, index)}
                      style={{
                        background: copiedScript === index ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.375rem 0.625rem',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        transition: 'all 0.2s',
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        if (copiedScript !== index) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (copiedScript !== index) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                        }
                      }}
                    >
                      <Copy size={12} />
                      {copiedScript === index ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
