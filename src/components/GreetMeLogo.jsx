// src/components/GreetMeLogo.jsx
import { useNavigate } from 'react-router-dom';

export default function GreetMeLogo({ size = 'medium', clickable = true, variant = 'default' }) {
  const navigate = useNavigate();

  const sizes = {
    small: { width: 100, height: 32, fontSize: '1rem', tagline: '0.5rem' },
    medium: { width: 140, height: 44, fontSize: '1.375rem', tagline: '0.625rem' },
    large: { width: 180, height: 56, fontSize: '1.75rem', tagline: '0.75rem' }
  };

  const s = sizes[size] || sizes.medium;
  const isLight = variant === 'light'; // For use on dark/gradient backgrounds

  const handleClick = () => {
    if (clickable) {
      navigate('/dashboard');
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        cursor: clickable ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transition: 'transform 0.2s ease'
      }}
      onMouseEnter={(e) => {
        if (clickable) e.currentTarget.style.transform = 'scale(1.02)';
      }}
      onMouseLeave={(e) => {
        if (clickable) e.currentTarget.style.transform = 'scale(1)';
      }}
      title={clickable ? 'Go to Dashboard' : undefined}
    >
      {/* Main Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem'
      }}>
        {/* G Icon with gradient */}
        <div style={{
          width: s.height * 0.8,
          height: s.height * 0.8,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isLight ? 'none' : '0 2px 8px rgba(102, 126, 234, 0.3)'
        }}>
          <span style={{
            fontSize: s.fontSize,
            fontWeight: 800,
            color: 'white',
            fontFamily: 'Georgia, serif',
            textShadow: isLight ? 'none' : '0 1px 2px rgba(0,0,0,0.2)'
          }}>G</span>
        </div>

        {/* Text Logo */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          marginLeft: '0.25rem'
        }}>
          <span style={{
            fontSize: s.fontSize,
            fontWeight: 800,
            ...(isLight ? {
              color: 'white'
            } : {
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }),
            letterSpacing: '-0.5px',
            lineHeight: 1
          }}>
            Greet-Me
          </span>
          <span
            className="tagline"
            style={{
              fontSize: s.tagline,
              color: isLight ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)',
              fontWeight: 500,
              fontStyle: 'italic',
              letterSpacing: '0.5px',
              marginTop: '-2px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              textShadow: 'none'
            }}
          >
            {/* Forget-me-not flower */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '10px',
              height: '10px',
              position: 'relative',
              flexShrink: 0
            }}>
              {[0, 72, 144, 216, 288].map((rotation, i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    background: '#60a5fa',
                    borderRadius: '50%',
                    transform: `rotate(${rotation}deg) translateY(-3px)`,
                    transformOrigin: 'center center'
                  }}
                />
              ))}
              <span style={{
                position: 'absolute',
                width: '3px',
                height: '3px',
                background: '#fbbf24',
                borderRadius: '50%',
                zIndex: 1
              }} />
            </span>
            Forget Them Not!
          </span>
        </div>
      </div>
    </div>
  );
}
