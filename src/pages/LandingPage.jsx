// src/pages/LandingPage.jsx
import { useNavigate } from 'react-router-dom';
import { Heart, Calendar, Zap, Smartphone } from 'lucide-react';
import GreetMeLogo from '../components/GreetMeLogo';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{
        padding: '1.5rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <GreetMeLogo size="medium" clickable={false} />

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/pricing')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Pricing
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '0.75rem 2rem',
              background: 'transparent',
              border: '2px solid white',
              borderRadius: 'var(--radius-lg)',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/register')}
            style={{
              padding: '0.75rem 2rem',
              background: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              color: '#667eea',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            }}
          >
            Register
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '56rem' }}>
          <h1 style={{
            fontSize: 'clamp(3rem, 8vw, 6rem)',
            fontWeight: 800,
            color: 'white',
            marginBottom: '1.5rem',
            lineHeight: 1.1,
            fontStyle: 'italic',
            transform: 'skewX(-12deg)',
            display: 'inline-block'
          }}>
            Forget Them Not!
          </h1>

          <p style={{
            fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '3rem',
            lineHeight: 1.6
          }}>
            Never miss another special moment. AI-powered greetings that show you care, automatically.
          </p>

          <button
            onClick={() => navigate('/register')}
            style={{
              padding: '1.25rem 3rem',
              background: 'white',
              border: 'none',
              borderRadius: 'var(--radius-xl)',
              color: '#667eea',
              fontSize: '1.25rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.3s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.2)';
            }}
          >
            Get Started Free
            <Sparkles size={24} />
          </button>

          {/* Feature Highlights */}
          <div style={{
            marginTop: '5rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2rem',
            maxWidth: '48rem',
            margin: '5rem auto 0'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Heart size={32} style={{ color: 'white' }} />
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'white',
                marginBottom: '0.5rem'
              }}>Personal & Meaningful</h3>
              <p style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>AI crafts greetings based on your relationships</p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Calendar size={32} style={{ color: 'white' }} />
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'white',
                marginBottom: '0.5rem'
              }}>Never Miss a Date</h3>
              <p style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>Automatic reminders for birthdays & holidays</p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Zap size={32} style={{ color: 'white' }} />
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'white',
                marginBottom: '0.5rem'
              }}>One-Click Send</h3>
              <p style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>Review, customize, and send in seconds</p>
            </div>
          </div>
        </div>
      </main>

      {/* QR Code Download Section */}
      <section style={{
        padding: '3rem 2rem',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{
          maxWidth: '48rem',
          margin: '0 auto',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            <Smartphone size={32} style={{ color: 'white' }} />
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: 'white',
              margin: 0
            }}>Get the Mobile App</h2>
          </div>

          <p style={{
            fontSize: '1.125rem',
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '2rem'
          }}>
            Scan the QR code to download Greet-Me on your phone
          </p>

          {/* QR Code Placeholder */}
          <div style={{
            display: 'inline-block',
            padding: '2rem',
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              width: '200px',
              height: '200px',
              background: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%, #f0f0f0), linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%, #f0f0f0)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 10px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-lg)',
              border: '3px solid #667eea',
              position: 'relative'
            }}>
              <div style={{
                textAlign: 'center',
                color: '#667eea',
                fontWeight: 600
              }}>
                <Smartphone size={48} style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '0.875rem' }}>QR Code</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Coming Soon</div>
              </div>
            </div>
          </div>

          <p style={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.7)',
            marginTop: '1.5rem'
          }}>
            Available on iOS and Android
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '0.875rem'
      }}>
        <p>&copy; 2025 Greet-Me. Never forget the ones you love.</p>
      </footer>
    </div>
  );
}
