// src/components/OnboardingTour.jsx
import { useState, useEffect } from 'react';
import { X, ChevronRight, Mic, Camera, UserPlus } from 'lucide-react';
import { useAccountState } from '../hooks/useAccountState';
import { shouldShowOnboarding } from '../utils/accountState';

export default function OnboardingTour() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasOptedOut, setHasOptedOut] = useState(false);
  // Phase 3D Batch D Slice 5 — account-state gate (subscription wins).
  const state = useAccountState();

  const ONBOARDING_KEY = 'greetme_onboarding_completed';

  useEffect(() => {
    // Check if user has already completed or opted out of onboarding
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // Show onboarding after a short delay for better UX
      setTimeout(() => {
        setIsVisible(true);
      }, 1000);
    }
  }, []);

  const steps = [
    {
      title: 'Welcome to Greet-Me™!',
      description: 'Let\'s get you started with a quick tour. You can skip this at any time.',
      icon: '👋',
      action: null
    },
    {
      title: 'Record Your Voice',
      description: 'Start by recording your voice message. This is what your recipients will hear in their greetings.',
      icon: <Mic size={32} />,
      action: 'Go to Personalization section and click "Use Microphone" or "Upload File"'
    },
    {
      title: 'Upload Your Photo',
      description: 'Add a photo that will appear in your greetings. Make it personal!',
      icon: <Camera size={32} />,
      action: 'In the same section, click "Upload Photo" to add your picture'
    },
    {
      title: 'Add Your First Contact',
      description: 'Add the people you want to send greetings and gifts to. You can add occasions for each contact, pre-select a gift (including QR Cash™), or let Greet-Me™ curate one automatically within your budget.',
      icon: <UserPlus size={32} />,
      action: 'Click "Add Recipient" button to create your first contact',
      helperText: "You'll get a reminder 10 days before the occasion to confirm or change your gift selection."
    }
  ];

  const handleClose = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsVisible(false);
    setHasOptedOut(true);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  if (!isVisible || hasOptedOut) return null;
  if (!shouldShowOnboarding(state)) return null;

  const step = steps[currentStep];

  return (
    <>
      {/* Backdrop overlay */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        zIndex: 9998,
        backdropFilter: 'blur(2px)'
      }} onClick={handleSkip} />

      {/* Onboarding modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        maxWidth: '500px',
        width: 'calc(100% - 2rem)',
        padding: '2rem',
        animation: 'slideIn 0.3s ease-out'
      }}>
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            color: 'var(--text-tertiary)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--gray-100)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-tertiary)';
          }}
          title="Close tour"
        >
          <X size={20} />
        </button>

        {/* Step indicator */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          justifyContent: 'center'
        }}>
          {steps.map((_, index) => (
            <div
              key={index}
              style={{
                width: index === currentStep ? '2rem' : '0.5rem',
                height: '0.5rem',
                borderRadius: '9999px',
                background: index === currentStep ? '#667eea' : 'var(--gray-300)',
                transition: 'all 0.3s'
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            width: '5rem',
            height: '5rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            color: 'white',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)'
          }}>
            {step.icon}
          </div>
        </div>

        {/* Content */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.75rem'
          }}>{step.title}</h2>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: step.action ? '1rem' : 0
          }}>{step.description}</p>
          {step.helperText && (
            <p style={{
              fontSize: '0.8125rem',
              color: 'var(--text-tertiary)',
              marginBottom: '1rem',
              fontStyle: 'italic'
            }}>
              {step.helperText}
            </p>
          )}
          {step.action && (
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #f0f4ff 100%)',
              border: '2px solid #bfdbfe',
              borderRadius: 'var(--radius-lg)',
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              color: '#1e40af',
              fontWeight: 500,
              textAlign: 'left'
            }}>
              💡 <strong>Next step:</strong> {step.action}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'space-between'
        }}>
          <button
            onClick={handleSkip}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
              color: 'var(--text-secondary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--gray-50)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Skip Tour
          </button>
          <button
            onClick={handleNext}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            }}
          >
            {currentStep < steps.length - 1 ? (
              <>
                Next
                <ChevronRight size={20} />
              </>
            ) : (
              'Get Started'
            )}
          </button>
        </div>

        {/* Step counter */}
        <div style={{
          textAlign: 'center',
          marginTop: '1rem',
          fontSize: '0.8125rem',
          color: 'var(--text-tertiary)'
        }}>
          Step {currentStep + 1} of {steps.length}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -45%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  );
}
