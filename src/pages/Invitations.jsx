// src/pages/Invitations.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Calendar, Users, Sparkles, ArrowRight, Gift, Image, Mic, ArrowLeft } from 'lucide-react';

export default function Invitations() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Mail size={32} />,
      title: 'Beautiful Templates',
      description: 'Choose from dozens of professionally designed invitation templates for every occasion'
    },
    {
      icon: <Mic size={32} />,
      title: 'Voice Messages',
      description: 'Add your personal voice to make invitations truly special and memorable'
    },
    {
      icon: <Image size={32} />,
      title: 'Custom Media',
      description: 'Include photos, videos, and animations to create stunning digital invitations'
    },
    {
      icon: <Calendar size={32} />,
      title: 'RSVP Tracking',
      description: 'Manage guest responses and track attendance all in one place'
    },
    {
      icon: <Users size={32} />,
      title: 'Guest Management',
      description: 'Easily organize and communicate with your entire guest list'
    },
    {
      icon: <Gift size={32} />,
      title: 'Gift Registry',
      description: 'Link to your registry or wishlists from the American-Made Marketplace'
    }
  ];

  const occasions = [
    { emoji: '🎂', label: 'Birthday Parties' },
    { emoji: '💍', label: 'Weddings' },
    { emoji: '🎓', label: 'Graduations' },
    { emoji: '👶', label: 'Baby Showers' },
    { emoji: '🏠', label: 'Housewarming' },
    { emoji: '🎉', label: 'Celebrations' }
  ];

  return (
    <div style={{ padding: '2rem' }}>
      {/* Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
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

      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '4rem 3rem',
        marginBottom: '3rem',
        textAlign: 'center',
        color: 'white',
        boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative Elements */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          fontSize: '3rem',
          opacity: 0.2
        }}>✨</div>
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          fontSize: '3rem',
          opacity: 0.2
        }}>🎉</div>

        <Sparkles size={48} style={{ margin: '0 auto 1rem', opacity: 0.9 }} />
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 800,
          marginBottom: '1rem',
          textShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}>
          Invitations
        </h1>
        <p style={{
          fontSize: '1.5rem',
          marginBottom: '0.5rem',
          opacity: 0.95,
          maxWidth: '700px',
          margin: '0 auto 2rem'
        }}>
          Create stunning digital invitations with your voice
        </p>
        <div style={{
          display: 'inline-block',
          padding: '1rem 2rem',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 'var(--radius-lg)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          backdropFilter: 'blur(10px)',
          fontSize: '1.25rem',
          fontWeight: 700
        }}>
          Coming Soon!
        </div>
      </div>

      {/* What You'll Be Able To Do */}
      <div style={{
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: '2.5rem',
        marginBottom: '3rem',
        border: '2px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
      }}>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
          textAlign: 'center'
        }}>
          What You'll Be Able To Do
        </h2>
        <p style={{
          fontSize: '1rem',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginBottom: '3rem'
        }}>
          Send beautiful, personalized invitations for any occasion
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem'
        }}>
          {features.map((feature, index) => (
            <div
              key={index}
              style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                width: '4rem',
                height: '4rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                marginBottom: '1rem'
              }}>
                {feature.icon}
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem'
              }}>
                {feature.title}
              </h3>
              <p style={{
                fontSize: '0.9375rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6
              }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Perfect For Section */}
      <div style={{
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: '2.5rem',
        marginBottom: '3rem',
        border: '2px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
      }}>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
          textAlign: 'center'
        }}>
          Perfect For Every Occasion
        </h2>
        <p style={{
          fontSize: '1rem',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          From intimate gatherings to grand celebrations
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1.5rem'
        }}>
          {occasions.map((occasion, index) => (
            <div
              key={index}
              style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #f0f4ff 0%, #e6eeff 100%)',
                borderRadius: 'var(--radius-lg)',
                border: '2px solid #bfdbfe',
                textAlign: 'center',
                transition: 'all 0.2s',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.borderColor = '#667eea';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = '#bfdbfe';
              }}
            >
              <div style={{
                fontSize: '3rem',
                marginBottom: '0.75rem'
              }}>
                {occasion.emoji}
              </div>
              <div style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#1e40af'
              }}>
                {occasion.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Call to Action */}
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '3rem 2rem',
        textAlign: 'center',
        color: 'white',
        boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)',
        marginBottom: '2rem'
      }}>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 800,
          marginBottom: '1rem'
        }}>
          Get Notified When Invitations Launch
        </h2>
        <p style={{
          fontSize: '1.125rem',
          opacity: 0.95,
          marginBottom: '2rem',
          maxWidth: '600px',
          margin: '0 auto 2rem'
        }}>
          Be the first to create stunning voice-powered invitations for your next celebration
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '1rem 2.5rem',
            background: 'white',
            color: '#10b981',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: '1.0625rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.75rem',
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
          Return to Dashboard
          <ArrowRight size={20} />
        </button>
      </div>

      {/* Why Choose Greet-Me Section */}
      <div style={{
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: '2.5rem',
        border: '2px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
      }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>
          Why Choose Greet-Me™ Invitations?
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '2rem'
        }}>
          <div>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#667eea',
              marginBottom: '0.5rem'
            }}>
              🎙️ Voice-Powered
            </h3>
            <p style={{
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Add your personal voice to invitations, making them more meaningful and memorable than any paper card.
            </p>
          </div>
          <div>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#667eea',
              marginBottom: '0.5rem'
            }}>
              🌍 Eco-Friendly
            </h3>
            <p style={{
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              100% digital means zero paper waste, no printing costs, and instant delivery anywhere in the world.
            </p>
          </div>
          <div>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#667eea',
              marginBottom: '0.5rem'
            }}>
              💝 Integrated Gifting
            </h3>
            <p style={{
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Link directly to your gift registry in our American-Made Marketplace - all in one beautiful invitation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
