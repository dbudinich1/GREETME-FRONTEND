// Greet-Me Pro Tip™ Component
// Educational, non-blocking tips to help users maximize value
// Language: Positive, generous, helpful (never restrictive)

import { useState } from 'react';
import { Lightbulb, X, Sparkles } from 'lucide-react';

export default function ProTip({
  tipKey,
  title = "Greet-Me Pro Tip",
  message,
  icon = "lightbulb",
  variant = "default",
  onDismiss
}) {
  const [dismissed, setDismissed] = useState(() => {
    // Check if user has already dismissed this tip
    const dismissedTips = JSON.parse(localStorage.getItem('greetme_dismissed_tips') || '[]');
    return dismissedTips.includes(tipKey);
  });

  const handleDismiss = () => {
    // Save dismissal to localStorage
    const dismissedTips = JSON.parse(localStorage.getItem('greetme_dismissed_tips') || '[]');
    if (!dismissedTips.includes(tipKey)) {
      dismissedTips.push(tipKey);
      localStorage.setItem('greetme_dismissed_tips', JSON.stringify(dismissedTips));
    }

    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  if (dismissed) return null;

  const variants = {
    default: {
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      border: '#fbbf24',
      iconColor: '#d97706',
      textColor: '#78350f'
    },
    purple: {
      background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
      border: '#a855f7',
      iconColor: '#7c3aed',
      textColor: '#581c87'
    },
    blue: {
      background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
      border: '#3b82f6',
      iconColor: '#2563eb',
      textColor: '#1e3a8a'
    },
    green: {
      background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
      border: '#10b981',
      iconColor: '#059669',
      textColor: '#064e3b'
    }
  };

  const style = variants[variant] || variants.default;
  const IconComponent = icon === 'sparkles' ? Sparkles : Lightbulb;

  return (
    <div style={{
      background: style.background,
      borderRadius: 'var(--radius-lg)',
      border: `2px solid ${style.border}`,
      padding: 'var(--space-md)',
      marginBottom: 'var(--space-md)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      animation: 'slideDown 0.3s ease-out'
    }}>
      <div style={{
        width: '2.5rem',
        height: '2.5rem',
        borderRadius: '50%',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <IconComponent size={20} style={{ color: style.iconColor }} />
      </div>

      <div style={{ flex: 1 }}>
        <h4 style={{
          fontSize: '0.9375rem',
          fontWeight: 700,
          color: style.textColor,
          marginBottom: '0.25rem'
        }}>
          {title}
        </h4>
        <p style={{
          fontSize: '0.875rem',
          color: style.textColor,
          lineHeight: 1.5,
          margin: 0,
          opacity: 0.9
        }}>
          {message}
        </p>
      </div>

      <button
        onClick={handleDismiss}
        style={{
          width: '1.75rem',
          height: '1.75rem',
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'white';
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.7)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Dismiss tip"
      >
        <X size={14} style={{ color: style.iconColor }} />
      </button>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// Predefined Pro Tips for common scenarios
export const PRO_TIPS = {
  TEMPLATE_REUSE: {
    tipKey: 'template_reuse',
    title: '💡 Greet-Me Pro Tip',
    message: 'Creating one animated message and saving it as a template lets you send it to multiple recipients — using just one animated moment.',
    variant: 'purple',
    icon: 'lightbulb'
  },

  HOLIDAY_BULK: {
    tipKey: 'holiday_bulk',
    title: '🎄 Holiday Pro Tip',
    message: 'Save time and animated moments! Create one holiday greeting, save it as a template, and send it to everyone on your list.',
    variant: 'green',
    icon: 'sparkles'
  },

  MULTIPLE_RECIPIENTS: {
    tipKey: 'multiple_recipients',
    title: '✨ Smart Sending Tip',
    message: 'Sending to multiple people? Create your animated greeting once, save as a template, then reuse it for everyone — no extra animated moments needed.',
    variant: 'blue',
    icon: 'sparkles'
  },

  LOW_CREDITS: {
    tipKey: 'low_credits',
    title: '💡 Maximize Your Moments',
    message: 'Make your animated moments go further by saving greetings as templates. One creation can be sent to unlimited recipients!',
    variant: 'default',
    icon: 'lightbulb'
  },

  HERO_TEMPLATES: {
    tipKey: 'hero_templates',
    title: '🥇 Hero™ Pro Tip',
    message: 'As a Hero™ member, use templates to send animated greetings to your entire network without consuming extra animated moments.',
    variant: 'purple',
    icon: 'sparkles'
  }
};
