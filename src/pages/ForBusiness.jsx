// src/pages/ForBusiness.jsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import ContactSalesModal from '../components/ContactSalesModal';
import { FOR_BUSINESS_ENTRY } from '../utils/contactSales';

export default function ForBusiness() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Deep-link: arriving with ?contact=sales (e.g. Hero "Learn More") opens the existing
  // Contact Sales form directly on mount — no intervening modal.
  const [showContactForm, setShowContactForm] = useState(searchParams.get('contact') === 'sales');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-secondary)',
      width: '100%',
      maxWidth: '100%',
      overflowX: 'hidden',
      padding: '0.5rem'
    }}>
      {/* Background Frame for Page Body */}
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto'
      }}>
        <div style={{
          background: '#f8fafc',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid #e2e8f0',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
      {/* Hero Banner */}
      <section style={{
        maxWidth: '100%',
        margin: '0 auto',
        padding: '0'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          color: 'white',
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)'
        }}>
          <h1 style={{
            fontSize: '2.25rem',
            fontWeight: 700,
            marginBottom: '1rem',
            lineHeight: 1.2
          }}>
            Create branded gifts to acknowledge your clients and employees.
          </h1>
          <p style={{
            fontSize: '1.125rem',
            opacity: 0.95,
            lineHeight: 1.6,
            maxWidth: '800px',
            margin: '0 auto 1.5rem'
          }}>
            From Branded Goods to curated American Gift Place gifts and QR Cash, deliver meaningful moments at scale.
          </p>
          <button
            onClick={() => setShowContactForm(true)}
            style={{
              padding: '0.875rem 2rem',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }}
          >
            Contact Sales
          </button>
        </div>
      </section>

      {/* Three Capability Sections */}
      <section style={{
        maxWidth: '100%',
        margin: '0 auto',
        padding: '1.5rem 0',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        gap: '1.5rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* 1. Branded Goods */}
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
            Branded Goods
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

        {/* 2. Value Add Subscription Bundles */}
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
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
            fontSize: '1.75rem'
          }}>
            📦
          </div>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '1rem'
          }}>
            Value Add Subscription Bundles
          </h3>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            margin: 0
          }}>
            Bundle Greet-Me™ subscriptions with your products or services. Enhance customer value, boost retention, and create meaningful touchpoints that differentiate your brand.
          </p>
        </div>

        {/* 3. Curated Gifts from our American Gift Place */}
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
            Curated Gifts from our American Gift Place
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

        {/* 4. QR Cash Gift */}
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
            QR Cash Gift
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

        {/* 5. Anytime Animation Packs - reconnects to the real Animation Bank purchase flow */}
        <div
          onClick={() => navigate('/dashboard/animations')}
          style={{
            background: 'white',
            padding: '2rem',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '2px solid var(--border)',
            transition: 'all 0.2s',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#8b5cf6';
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(139, 92, 246, 0.2)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem'
          }}>
            <Play size={24} style={{ color: 'white' }} />
          </div>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '1rem'
          }}>
            Anytime Animation Packs
          </h3>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            margin: 0
          }}>
            Enhance your greetings with premium animated effects. Eye-catching animations that make every message memorable.
          </p>
          <div style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
            color: 'white',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'inline-block'
          }}>
            Buy Packs →
          </div>
        </div>

        {/* 6. Hero Status */}
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
            background: 'linear-gradient(135deg, #D4AF37 0%, #8B6914 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
            fontSize: '1.75rem'
          }}>
            🏅
          </div>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '1rem'
          }}>
            Greet-Me™ Hero™ Participation
          </h3>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            margin: 0
          }}>
            All corporate patronage is automatically Greet-Me™ Hero™ eligible. Hero participation is live; Hero Status and recognition are not live yet.
          </p>
        </div>
      </section>

      {/* Hero™ Secondary Mention - Centered */}
      <section style={{
        maxWidth: '100%',
        margin: '1rem 0 2rem',
        padding: '2.5rem 2rem',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(139, 105, 20, 0.08) 100%)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid rgba(212, 175, 55, 0.3)'
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
          Through Greet-Me™ Hero™, we reward corporate patronage with automatic 10% contributions to veteran, law enforcement and EMS organizations.
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
          GREETME - HERO
        </button>
      </section>

      {/* Final CTA Banner */}
      <section style={{
        maxWidth: '100%',
        margin: '1rem 0 0',
        padding: '0'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          color: 'white',
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)'
        }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 700,
            marginBottom: '1rem',
            lineHeight: 1.2
          }}>
            Ready to get started?
          </h2>
          <p style={{
            fontSize: '1.125rem',
            opacity: 0.95,
            marginBottom: '1.5rem',
            lineHeight: 1.6,
            maxWidth: '600px',
            margin: '0 auto 1.5rem'
          }}>
            Our team will help you create a gifting program that reflects your brand and values.
          </p>
          <button
            onClick={() => setShowContactForm(true)}
            style={{
              padding: '0.875rem 2rem',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }}
          >
            Contact Sales
          </button>
        </div>
      </section>
        </div>
      </div>
      {/* End Background Frame */}

      {/* Contact Sales Form Modal — shared component; opens in place, no navigation */}
      <ContactSalesModal isOpen={showContactForm} onClose={() => setShowContactForm(false)} {...FOR_BUSINESS_ENTRY} />
    </div>
  );
}
