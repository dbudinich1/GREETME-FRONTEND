// src/components/GreetMeLogo.jsx
import { useNavigate } from 'react-router-dom';

export default function GreetMeLogo({ size = 'medium', clickable = true }) {
  const navigate = useNavigate();

  const sizes = {
    small: { width: 100, height: 32, fontSize: '1rem', tagline: '0.5rem' },
    medium: { width: 140, height: 44, fontSize: '1.375rem', tagline: '0.625rem' },
    large: { width: 180, height: 56, fontSize: '1.75rem', tagline: '0.75rem' }
  };

  const s = sizes[size] || sizes.medium;

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
          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
        }}>
          <span style={{
            fontSize: s.fontSize,
            fontWeight: 800,
            color: 'white',
            fontFamily: 'Georgia, serif',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)'
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.5px',
            lineHeight: 1
          }}>
            Greet-Me
          </span>
          <span style={{
            fontSize: s.tagline,
            color: 'var(--text-secondary)',
            fontWeight: 500,
            fontStyle: 'italic',
            letterSpacing: '0.5px',
            marginTop: '-2px'
          }}>
            Forget Them Not!
          </span>
        </div>
      </div>
    </div>
  );
}
