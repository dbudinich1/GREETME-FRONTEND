// src/pages/Pricing.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

const personalPlans = {
  founders: [
    {
      id: 'founders-close-circle',
      name: 'Close Circle',
      price: 9.99,
      period: 'year',
      description: 'Perfect for immediate family',
      features: [
        'Up to 5 recipients',
        'Greet One, Gift One™ included',
        '🇺🇸 American-Made Gift Marketplace',
        'Voice + Photo greetings',
        'Automated scheduled occasions',
        'Just Because greetings',
        'Email delivery'
      ]
    },
    {
      id: 'founders-social-butterfly',
      name: 'Social Butterfly',
      price: 19.99,
      period: 'year',
      description: 'For friends and extended family',
      features: [
        'Up to 25 recipients',
        'Greet One, Gift One™ included',
        '🇺🇸 American-Made Gift Marketplace',
        'Voice + Photo greetings',
        'Automated scheduled occasions',
        'Just Because greetings',
        'Priority email delivery',
        'Premium templates'
      ]
    },
    {
      id: 'founders-unlimited',
      name: 'Unlimited Unforgettable',
      price: 39.99,
      period: 'year',
      description: 'For the ultimate connector',
      features: [
        'Unlimited recipients',
        'Greet One, Gift One™ included',
        '🇺🇸 American-Made Gift Marketplace',
        'Voice + Photo greetings',
        'Automated scheduled occasions',
        'Just Because greetings',
        'Priority support',
        'Advanced AI personalization',
        'Video greetings',
        'Gift add-ons available'
      ],
      highlight: true
    }
  ],
  standard: [
    {
      id: 'standard-close-circle',
      name: 'Close Circle',
      price: 19.99,
      period: 'year',
      description: 'Perfect for immediate family',
      features: [
        'Up to 5 recipients',
        'Greet One, Gift One™ included',
        '🇺🇸 American-Made Gift Marketplace',
        'Voice + Photo greetings',
        'Automated scheduled occasions',
        'Just Because greetings',
        'Email delivery'
      ]
    },
    {
      id: 'standard-social-butterfly',
      name: 'Social Butterfly',
      price: 39.99,
      period: 'year',
      description: 'For friends and extended family',
      features: [
        'Up to 25 recipients',
        'Greet One, Gift One™ included',
        '🇺🇸 American-Made Gift Marketplace',
        'Voice + Photo greetings',
        'Automated scheduled occasions',
        'Just Because greetings',
        'Priority email delivery',
        'Premium templates'
      ]
    },
    {
      id: 'standard-unlimited',
      name: 'Unlimited Unforgettable',
      price: 79.99,
      period: 'year',
      description: 'For the ultimate connector',
      features: [
        'Unlimited recipients',
        'Greet One, Gift One™ included',
        '🇺🇸 American-Made Gift Marketplace',
        'Voice + Photo greetings',
        'Automated scheduled occasions',
        'Just Because greetings',
        'Priority support',
        'Advanced AI personalization',
        'Video greetings',
        'Gift add-ons available'
      ],
      highlight: true
    }
  ]
};

const businessPlans = [
  {
    id: 'client-appreciation',
    name: 'Client Appreciation',
    price: 199,
    period: 'year',
    description: 'Up to 25 gifted subscriptions',
    features: [
      'Client gifting bundles',
      'Branding + templates',
      'Hero impact reporting (coming soon)',
      '🇺🇸 American-Made Gift Marketplace',
      'Bulk greeting sending',
      'Email support'
    ]
  },
  {
    id: 'growth-partner',
    name: 'Growth Partner',
    price: 499,
    period: 'year',
    description: 'Up to 100 gifted subscriptions',
    features: [
      'Everything in Client Appreciation',
      'Advanced branding options',
      'Hero impact reporting (coming soon)',
      '🇺🇸 American-Made Gift Marketplace',
      'Analytics & reporting',
      'Priority support',
      'Team collaboration tools'
    ],
    highlight: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise / White Label',
    price: 'Custom',
    period: 'contact us',
    description: 'Custom enterprise solution',
    features: [
      'Everything in Growth Partner',
      'White-label platform option',
      'Custom integrations',
      'Hero impact reporting (coming soon)',
      '🇺🇸 American-Made Gift Marketplace',
      'Dedicated account manager',
      'API access',
      'Custom SLA agreements'
    ]
  }
];

const faqs = [
  {
    question: 'What is Greet One, Gift One™?',
    answer: 'Every subscription includes one additional subscription you can gift — or donate through Greet-Me Hero™.'
  },
  {
    question: 'What is a Just Because greeting?',
    answer: 'A manual greeting you send anytime, outside of scheduled occasions.'
  },
  {
    question: 'Are gifts really American-made?',
    answer: 'Yes — gifts are curated from our 🇺🇸 American-Made Gift Marketplace.'
  },
  {
    question: 'Can I change plans at any time?',
    answer: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate any charges.'
  },
  {
    question: 'What happens to my Founders Pricing?',
    answer: 'Founders Pricing is locked in for life as long as you maintain an active subscription. If you cancel and return later, standard pricing applies.'
  },
  {
    question: 'Do you offer refunds?',
    answer: 'We offer a 30-day money-back guarantee on all paid plans. If you\'re not satisfied, contact us for a full refund.'
  }
];

export default function Pricing() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('personal'); // 'personal' or 'business'
  const [pricingMode, setPricingMode] = useState('founders'); // 'founders' or 'standard' (for personal)
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handlePlanSelect = (planId) => {
    if (planId.includes('enterprise') || planId.includes('appreciation') || planId.includes('growth')) {
      alert('Contact sales form - Integration coming soon');
    } else {
      navigate('/register');
    }
  };

  const currentPlans = viewMode === 'personal'
    ? personalPlans[pricingMode]
    : businessPlans;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '4rem 2rem',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 800,
          color: 'white',
          marginBottom: '1rem'
        }}>
          Choose Your Plan
        </h1>
        <p style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
          color: 'rgba(255, 255, 255, 0.9)',
          maxWidth: '600px',
          margin: '0 auto 2rem'
        }}>
          Never forget the ones you love. Start with Founders Pricing or explore business options.
        </p>

        {/* View Mode Toggle */}
        <div style={{
          display: 'inline-flex',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '9999px',
          padding: '0.25rem',
          marginBottom: '1.5rem'
        }}>
          <button
            onClick={() => setViewMode('personal')}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '9999px',
              background: viewMode === 'personal' ? 'white' : 'transparent',
              color: viewMode === 'personal' ? '#667eea' : 'white',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit'
            }}
          >
            Personal
          </button>
          <button
            onClick={() => setViewMode('business')}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '9999px',
              background: viewMode === 'business' ? 'white' : 'transparent',
              color: viewMode === 'business' ? '#667eea' : 'white',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit'
            }}
          >
            Business / Corporate
          </button>
        </div>
      </div>

      {/* Founders Banner - Only show for Personal view */}
      {viewMode === 'personal' && (
        <div style={{
          maxWidth: '1200px',
          margin: '-2rem auto 2rem',
          padding: '0 2rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            textAlign: 'center',
            color: 'white',
            boxShadow: '0 10px 30px rgba(251, 191, 36, 0.3)'
          }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              marginBottom: '0.5rem'
            }}>
              🎉 Founders Offer: Lock in Founders Pricing for a limited time
            </h2>
            <p style={{
              fontSize: '1.125rem',
              opacity: 0.95,
              marginBottom: '1.5rem'
            }}>
              Founders get the same features at a lifetime discounted rate.
            </p>
            <button
              onClick={() => setPricingMode('founders')}
              style={{
                padding: '0.875rem 2rem',
                background: pricingMode === 'founders' ? 'white' : 'rgba(255, 255, 255, 0.3)',
                color: pricingMode === 'founders' ? '#f59e0b' : 'white',
                border: pricingMode === 'founders' ? 'none' : '2px solid white',
                borderRadius: 'var(--radius-lg)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s'
              }}
            >
              {pricingMode === 'founders' ? '✓ Viewing Founders Pricing' : 'Get Founders Pricing'}
            </button>
            {pricingMode === 'founders' && (
              <button
                onClick={() => setPricingMode('standard')}
                style={{
                  marginLeft: '1rem',
                  padding: '0.875rem 2rem',
                  background: 'rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  border: '2px solid white',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s'
                }}
              >
                View Standard Pricing
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto 4rem',
        padding: '0 2rem'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem'
        }}>
          {currentPlans.map((plan) => {
            return (
              <div
                key={plan.id}
                style={{
                  background: 'white',
                  borderRadius: 'var(--radius-xl)',
                  padding: '2rem',
                  boxShadow: plan.highlight ? '0 20px 50px rgba(0, 0, 0, 0.15)' : 'var(--shadow-md)',
                  border: plan.highlight ? '2px solid var(--primary)' : '1px solid var(--border)',
                  position: 'relative',
                  transform: plan.highlight ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all 0.2s ease'
                }}
              >
                {plan.highlight && (
                  <div style={{
                    position: 'absolute',
                    top: '-0.75rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--primary)',
                    color: 'white',
                    padding: '0.25rem 1rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    MOST POPULAR
                  </div>
                )}

                {/* Plan Name */}
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  {plan.name}
                </h3>

                {/* Description */}
                <p style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1.5rem'
                }}>
                  {plan.description}
                </p>

                {/* Price */}
                <div style={{
                  marginBottom: '2rem',
                  color: 'var(--text-primary)'
                }}>
                  {plan.price === 'Custom' ? (
                    <div>
                      <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>Custom</span>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Contact us for pricing
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>${plan.price}</span>
                      <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/{plan.period}</span>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handlePlanSelect(plan.id)}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: plan.highlight ? 'var(--primary)' : 'var(--gray-100)',
                    color: plan.highlight ? 'white' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    marginBottom: '2rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
                </button>

                {/* Features */}
                <div style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '1.5rem'
                }}>
                  <p style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '1rem'
                  }}>
                    What's included:
                  </p>
                  <ul style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0
                  }}>
                    {plan.features.map((feature, index) => (
                      <li
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                          marginBottom: '0.75rem',
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        <Check size={18} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '0.125rem' }} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ Section */}
      <div style={{
        maxWidth: '800px',
        margin: '0 auto 4rem',
        padding: '0 2rem'
      }}>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '2rem',
          color: 'var(--text-primary)'
        }}>
          Frequently Asked Questions
        </h2>
        <div style={{
          background: 'white',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}>
          {faqs.map((faq, index) => (
            <div
              key={index}
              style={{
                borderBottom: index < faqs.length - 1 ? '1px solid var(--border)' : 'none'
              }}
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                style={{
                  width: '100%',
                  padding: '1.5rem',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}>
                  {faq.question}
                </span>
                <span style={{
                  fontSize: '1.5rem',
                  color: 'var(--text-tertiary)',
                  transition: 'transform 0.2s ease',
                  transform: expandedFaq === index ? 'rotate(45deg)' : 'rotate(0deg)'
                }}>
                  +
                </span>
              </button>
              {expandedFaq === index && (
                <div style={{
                  padding: '0 1.5rem 1.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6
                }}>
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Back to Home */}
      <div style={{
        textAlign: 'center',
        padding: '2rem'
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
