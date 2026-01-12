// src/pages/ForBusiness.jsx
import { useNavigate } from 'react-router-dom';

export default function ForBusiness() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)'
    }}>
      {/* Hero Section */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '4rem 2rem',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1.5rem',
          lineHeight: 1.2
        }}>
          Create branded gifts to acknowledge your clients and employees.
        </h1>
        <p style={{
          fontSize: '1.5rem',
          color: 'var(--text-secondary)',
          marginBottom: '2.5rem',
          lineHeight: 1.6,
          maxWidth: '900px',
          margin: '0 auto 2.5rem'
        }}>
          From branded merchandise to curated American-made gifts and QR Cash, deliver meaningful moments at scale.
        </p>
        <button
          onClick={() => window.location.href = 'mailto:sales@greetme.com'}
          style={{
            padding: '1rem 2.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: '1.125rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            fontFamily: 'inherit'
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
          Contact Sales
        </button>
      </section>

      {/* Three Capability Sections */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '4rem 2rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2rem'
      }}>
        {/* Branded Merchandise */}
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--border)',
          transition: 'all 0.2s'
        }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
            fontSize: '1.75rem'
          }}>
            👕
          </div>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '1rem'
          }}>
            Branded Merchandise
          </h3>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            margin: 0
          }}>
            Custom apparel, drinkware, tech accessories, and more. Build your brand while showing appreciation to your team and clients.
          </p>
        </div>

        {/* Curated American-Made Gifts */}
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--border)',
          transition: 'all 0.2s'
        }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
            fontSize: '1.75rem'
          }}>
            🇺🇸
          </div>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '1rem'
          }}>
            Curated American-Made Gifts
          </h3>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            margin: 0
          }}>
            Thoughtfully selected gifts from American makers. Support local craftsmanship while delivering quality gifts that resonate.
          </p>
        </div>

        {/* Cash-Inclusive Gifting */}
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--border)',
          transition: 'all 0.2s'
        }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
            fontSize: '1.75rem'
          }}>
            💰
          </div>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '1rem'
          }}>
            Cash-Inclusive Gifting
          </h3>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            margin: 0
          }}>
            Add real cash to any corporate gift via QR Cash. Simple, personal, and universally appreciated—perfect for bonuses, incentives, and recognition.
          </p>
        </div>
      </section>

      {/* Hero™ Secondary Mention */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem 2rem',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(139, 105, 20, 0.05) 100%)',
        borderRadius: 'var(--radius-xl)',
        marginTop: '2rem',
        marginBottom: '4rem',
        marginLeft: '2rem',
        marginRight: '2rem'
      }}>
        <h3 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem'
        }}>
          Looking for larger-scale social impact?
        </h3>
        <p style={{
          fontSize: '1.125rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem',
          lineHeight: 1.6
        }}>
          Through Greet-Me Hero™, we automatically match corporate gifts with donations to veteran support organizations.
        </p>
        <button
          onClick={() => navigate('/dashboard/hero')}
          style={{
            padding: '0.875rem 2rem',
            background: 'linear-gradient(135deg, #D4AF37 0%, #8B6914 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(212, 175, 55, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(212, 175, 55, 0.3)';
          }}
        >
          Learn About Hero™
        </button>
      </section>

      {/* Final CTA */}
      <section style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '4rem 2rem 6rem',
        textAlign: 'center'
      }}>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem'
        }}>
          Ready to get started?
        </h2>
        <p style={{
          fontSize: '1.125rem',
          color: 'var(--text-secondary)',
          marginBottom: '2rem',
          lineHeight: 1.6
        }}>
          Our team will help you create a gifting program that reflects your brand and values.
        </p>
        <button
          onClick={() => window.location.href = 'mailto:sales@greetme.com'}
          style={{
            padding: '1rem 2.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: '1.125rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            fontFamily: 'inherit'
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
          Contact Sales
        </button>
      </section>
    </div>
  );
}
