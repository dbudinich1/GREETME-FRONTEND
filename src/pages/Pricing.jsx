// src/pages/Pricing.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CreditCard, Lock, CheckCircle } from 'lucide-react';
import GreetMeLogo from '../components/GreetMeLogo';
import { useAuth } from '../context/AuthContext';

// Phase 8.3: Features grouped into sections for scannability
const personalPlans = {
  founders: [
    {
      id: 'founders-close-circle',
      name: 'Close Circle',
      price: 9.99,
      period: 'year',
      description: 'Perfect for immediate family',
      featureGroups: [
        { section: 'Core', features: ['Up to 5 recipients', 'Greet One, Give One™ included', 'American Marketplace'] },
        { section: 'Greetings', features: ['Voice + Photo greetings', 'Automated scheduled occasions', 'Just Because greetings'] },
        { section: 'Delivery', features: ['Email delivery'] }
      ]
    },
    {
      id: 'founders-social-butterfly',
      name: 'Social Butterfly',
      price: 19.99,
      period: 'year',
      description: 'For friends and extended family',
      featureGroups: [
        { section: 'Core', features: ['Up to 25 recipients', 'Greet One, Give One™ included', 'American Marketplace'] },
        { section: 'Greetings', features: ['Voice + Photo greetings', 'Automated scheduled occasions', 'Just Because greetings', 'Premium templates'] },
        { section: 'Delivery', features: ['Priority email delivery'] }
      ]
    },
    {
      id: 'founders-unlimited',
      name: 'Unlimited Unforgettable',
      price: 39.99,
      period: 'year',
      description: 'For the ultimate connector',
      featureGroups: [
        { section: 'Core', features: ['Unlimited recipients', 'Greet One, Give One™ included', 'American Marketplace'] },
        { section: 'Greetings', features: ['Voice + Photo greetings', 'Video greetings', 'Automated scheduled occasions', 'Just Because greetings', 'Advanced AI personalization'] },
        { section: 'Delivery & Support', features: ['Priority support', 'Gift add-ons available'] }
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
      featureGroups: [
        { section: 'Core', features: ['Up to 5 recipients', 'Greet One, Give One™ included', 'American Marketplace'] },
        { section: 'Greetings', features: ['Voice + Photo greetings', 'Automated scheduled occasions', 'Just Because greetings'] },
        { section: 'Delivery', features: ['Email delivery'] }
      ]
    },
    {
      id: 'standard-social-butterfly',
      name: 'Social Butterfly',
      price: 39.99,
      period: 'year',
      description: 'For friends and extended family',
      featureGroups: [
        { section: 'Core', features: ['Up to 25 recipients', 'Greet One, Give One™ included', 'American Marketplace'] },
        { section: 'Greetings', features: ['Voice + Photo greetings', 'Automated scheduled occasions', 'Just Because greetings', 'Premium templates'] },
        { section: 'Delivery', features: ['Priority email delivery'] }
      ]
    },
    {
      id: 'standard-unlimited',
      name: 'Unlimited Unforgettable',
      price: 79.99,
      period: 'year',
      description: 'For the ultimate connector',
      featureGroups: [
        { section: 'Core', features: ['Unlimited recipients', 'Greet One, Give One™ included', 'American Marketplace'] },
        { section: 'Greetings', features: ['Voice + Photo greetings', 'Video greetings', 'Automated scheduled occasions', 'Just Because greetings', 'Advanced AI personalization'] },
        { section: 'Delivery & Support', features: ['Priority support', 'Gift add-ons available'] }
      ],
      highlight: true
    }
  ]
};

// Phase 8.3: Business plans with grouped features for scannability
const businessPlans = {
  founders: [
    {
      id: 'business-small-founders',
      name: 'Small Business',
      price: 99,
      period: 'year',
      description: 'Up to 25 Employees',
      featureGroups: [
        { section: 'Core', features: ['Up to 25 employee recipients', 'American Marketplace', 'Team dashboard'] },
        { section: 'Branding', features: ['Branding + templates', 'Bulk greeting sending'] },
        { section: 'Support & Reporting', features: ['Email support', 'Hero impact reporting (coming soon)'] }
      ]
    },
    {
      id: 'business-medium-founders',
      name: 'Medium Business',
      price: 149,
      period: 'year',
      description: 'Up to 50 Employees',
      featureGroups: [
        { section: 'Core', features: ['Up to 50 employee recipients', 'American Marketplace', 'Team collaboration tools'] },
        { section: 'Branding', features: ['Advanced branding options', 'Analytics & reporting'] },
        { section: 'Support & Reporting', features: ['Priority support', 'Hero impact reporting (coming soon)'] }
      ],
      highlight: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Contact Sales',
      period: '',
      description: 'Custom enterprise solution',
      featureGroups: [
        { section: 'Core', features: ['Unlimited employees', 'American Marketplace', 'API access'] },
        { section: 'Customization', features: ['White-label platform option', 'Custom integrations', 'Custom SLA agreements'] },
        { section: 'Support & Reporting', features: ['Dedicated account manager', 'Hero impact reporting (coming soon)'] }
      ]
    }
  ],
  standard: [
    {
      id: 'business-small-standard',
      name: 'Small Business',
      price: 149,
      period: 'year',
      description: 'Up to 25 Employees',
      featureGroups: [
        { section: 'Core', features: ['Up to 25 employee recipients', 'American Marketplace', 'Team dashboard'] },
        { section: 'Branding', features: ['Branding + templates', 'Bulk greeting sending'] },
        { section: 'Support & Reporting', features: ['Email support', 'Hero impact reporting (coming soon)'] }
      ]
    },
    {
      id: 'business-medium-standard',
      name: 'Medium Business',
      price: 299,
      period: 'year',
      description: 'Up to 50 Employees',
      featureGroups: [
        { section: 'Core', features: ['Up to 50 employee recipients', 'American Marketplace', 'Team collaboration tools'] },
        { section: 'Branding', features: ['Advanced branding options', 'Analytics & reporting'] },
        { section: 'Support & Reporting', features: ['Priority support', 'Hero impact reporting (coming soon)'] }
      ],
      highlight: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Contact Sales',
      period: '',
      description: 'Custom enterprise solution',
      featureGroups: [
        { section: 'Core', features: ['Unlimited employees', 'American Marketplace', 'API access'] },
        { section: 'Customization', features: ['White-label platform option', 'Custom integrations', 'Custom SLA agreements'] },
        { section: 'Support & Reporting', features: ['Dedicated account manager', 'Hero impact reporting (coming soon)'] }
      ]
    }
  ]
};

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState('personal'); // 'personal' or 'business'
  const [pricingMode, setPricingMode] = useState('founders'); // 'founders' or 'standard' (for personal)
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 768);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [showEnterpriseForm, setShowEnterpriseForm] = useState(false);
  const [enterpriseFormData, setEnterpriseFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    employeeCount: '',
    message: ''
  });
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState('summary'); // 'summary', 'payment', 'complete'
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    expiry: '',
    cvc: '',
    name: ''
  });
  const [processing, setProcessing] = useState(false);

  const handlePlanSelect = (plan) => {
    if (plan.id.includes('enterprise')) {
      setShowEnterpriseForm(true);
    } else {
      setSelectedPlan(plan);
      setCheckoutStep('summary');
      setShowCheckout(true);
    }
  };

  const handleEnterpriseSubmit = (e) => {
    e.preventDefault();
    alert('Thank you! Our sales team will contact you within 24 hours.');
    setShowEnterpriseForm(false);
    setEnterpriseFormData({
      companyName: '',
      contactName: '',
      email: '',
      phone: '',
      employeeCount: '',
      message: ''
    });
  };

  const handleCheckout = (e) => {
    e.preventDefault();
    // If user is not logged in, proceed to payment step first
    if (!user) {
      setCheckoutStep('payment');
    } else {
      // User is already logged in, proceed to payment
      setCheckoutStep('payment');
    }
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    setProcessing(true);

    // Simulate payment processing
    setTimeout(() => {
      setProcessing(false);
      setCheckoutStep('complete');

      // After 2 seconds, redirect to dashboard or registration
      setTimeout(() => {
        setShowCheckout(false);
        if (user) {
          navigate('/dashboard');
        } else {
          navigate('/register', { state: { plan: selectedPlan } });
        }
      }, 2000);
    }, 2000);
  };

  const closeCheckout = () => {
    setShowCheckout(false);
    setCheckoutStep('summary');
    setPaymentData({ cardNumber: '', expiry: '', cvc: '', name: '' });
    setProcessing(false);
  };

  const currentPlans = viewMode === 'personal'
    ? personalPlans[pricingMode]
    : businessPlans[pricingMode];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      {/* Top Band - Logo and Back Button */}
      <div style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        padding: isNarrow ? '1rem' : '1.25rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: isNarrow ? '0.5rem 0.875rem' : '0.625rem 1.25rem',
            background: 'var(--gray-100)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            fontSize: isNarrow ? '0.8125rem' : '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--gray-200)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--gray-100)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          ← Back
        </button>

        {/* Centered Logo */}
        <div style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)'
        }}>
          <GreetMeLogo size={isNarrow ? 'small' : 'medium'} clickable={true} />
        </div>

        {/* Spacer for layout balance */}
        <div style={{ width: isNarrow ? '70px' : '100px' }} />
      </div>

      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: isNarrow ? '2rem 1rem' : '3rem 2rem',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
          fontWeight: 800,
          color: 'white',
          marginBottom: '0.5rem'
        }}>
          Choose Your Plan
        </h1>
        <p style={{
          fontSize: 'clamp(0.9375rem, 1.5vw, 1.125rem)',
          color: 'rgba(255, 255, 255, 0.9)',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          Never forget the ones you love. Start with Founders Pricing or explore business options.
        </p>
      </div>

      {/* View Mode Toggle - Separate section with breathing room */}
      <div style={{
        background: 'var(--bg-secondary)',
        padding: isNarrow ? '1.5rem 1rem 1rem' : '2rem 2rem 1rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{
          display: 'inline-flex',
          background: 'rgba(102, 126, 234, 0.1)',
          borderRadius: '9999px',
          padding: '0.25rem',
          border: '1px solid rgba(102, 126, 234, 0.2)'
        }}>
          <button
            onClick={() => setViewMode('personal')}
            style={{
              padding: isNarrow ? '0.5rem 1rem' : '0.5rem 1.5rem',
              borderRadius: '9999px',
              background: viewMode === 'personal' ? 'white' : 'transparent',
              color: viewMode === 'personal' ? '#667eea' : 'var(--text-secondary)',
              border: 'none',
              fontWeight: 600,
              fontSize: isNarrow ? '0.875rem' : '1rem',
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
              padding: isNarrow ? '0.5rem 1rem' : '0.5rem 1.5rem',
              borderRadius: '9999px',
              background: viewMode === 'business' ? 'white' : 'transparent',
              color: viewMode === 'business' ? '#667eea' : 'var(--text-secondary)',
              border: 'none',
              fontWeight: 600,
              fontSize: isNarrow ? '0.875rem' : '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit'
            }}
          >
            {isNarrow ? 'Business' : 'Business / Corporate'}
          </button>
        </div>
      </div>

      {/* Founders Banner - Show for both Personal and Business */}
      {(
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto 2rem',
          padding: isNarrow ? '0 1rem' : '0 2rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            borderRadius: 'var(--radius-xl)',
            padding: isNarrow ? '1.5rem 1rem' : '2rem',
            textAlign: 'center',
            color: 'white',
            boxShadow: '0 10px 30px rgba(251, 191, 36, 0.3)'
          }}>
            <h2 style={{
              fontSize: isNarrow ? '1.25rem' : '1.75rem',
              fontWeight: 700,
              marginBottom: '0.5rem'
            }}>
              🎉 {isNarrow ? 'Founders Offer' : 'Founders Offer: Lock in Founders Pricing for a limited time'}
            </h2>
            <p style={{
              fontSize: isNarrow ? '0.9375rem' : '1.125rem',
              opacity: 0.95,
              marginBottom: '1.5rem'
            }}>
              {isNarrow ? 'Lock in lifetime discounted pricing!' : 'Founders get the same features at a lifetime discounted rate.'}
            </p>
            {/* Phase 8.3: Founders pricing explanation - neutral, factual */}
            {/* Phase 8.3B: Added lineHeight for mobile readability */}
            <p style={{
              fontSize: isNarrow ? '0.8125rem' : '0.875rem',
              opacity: 0.9,
              marginBottom: '1rem',
              fontStyle: 'italic',
              lineHeight: 1.4
            }}>
              Founders pricing is early-access pricing, locked for the lifetime of your subscription.
            </p>

            <div style={{
              display: 'flex',
              flexDirection: isNarrow ? 'column' : 'row',
              justifyContent: 'center',
              gap: isNarrow ? '0.75rem' : '1rem'
            }}>
              <button
                onClick={() => setPricingMode('founders')}
                style={{
                  padding: isNarrow ? '0.75rem 1.5rem' : '0.875rem 2rem',
                  background: pricingMode === 'founders' ? 'white' : 'rgba(255, 255, 255, 0.3)',
                  color: pricingMode === 'founders' ? '#f59e0b' : 'white',
                  border: pricingMode === 'founders' ? 'none' : '2px solid white',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: isNarrow ? '0.9375rem' : '1rem',
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
                    padding: isNarrow ? '0.75rem 1.5rem' : '0.875rem 2rem',
                    background: 'rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    border: '2px solid white',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: isNarrow ? '0.9375rem' : '1rem',
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
        </div>
      )}

      {/* Plans Grid */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto 4rem',
        padding: isNarrow ? '0 1rem' : '0 2rem'
      }}>
        {/* Phase 8.3B: alignItems: 'stretch' for equal card heights */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isNarrow ? '1fr' : 'repeat(3, 1fr)',
          gap: isNarrow ? '1.5rem' : '2rem',
          alignItems: 'stretch'
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
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}
              >
                {/* Phase 8.3: Enhanced featured tier badge with value sub-label */}
                {/* Phase 8.3B: Adjusted top offset for sub-label breathing room */}
                {plan.highlight && (
                  <div style={{
                    position: 'absolute',
                    top: '-1rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <div style={{
                      background: 'var(--primary)',
                      color: 'white',
                      padding: '0.25rem 1rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}>
                      MOST POPULAR
                    </div>
                    <div style={{
                      fontSize: '0.6875rem',
                      color: 'var(--primary)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}>
                      Best value for most users
                    </div>
                  </div>
                )}

                {/* G1G1™ Gold Foil Seal - Top Right (Personal plans only) */}
                {viewMode === 'personal' && (
                  <div style={{
                    position: 'absolute',
                    top: plan.highlight ? '1.5rem' : '1rem',
                    right: '1rem',
                    width: plan.highlight ? '40px' : '45px',
                    height: plan.highlight ? '40px' : '45px',
                    opacity: 0.9
                  }}>
                    {/* Star-point notched edge layer */}
                    {[...Array(16)].map((_, i) => {
                      const angle = (i * 22.5) - 90;
                      const radius = plan.highlight ? 20 : 22.5;
                      const x = (plan.highlight ? 20 : 22.5) + radius * Math.cos(angle * Math.PI / 180);
                      const y = (plan.highlight ? 20 : 22.5) + radius * Math.sin(angle * Math.PI / 180);
                      return (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            left: `${x}px`,
                            top: `${y}px`,
                            width: '3px',
                            height: '3px',
                            background: '#D4AF37',
                            transform: 'translate(-50%, -50%) rotate(45deg)',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                            pointerEvents: 'none'
                          }}
                        />
                      );
                    })}

                    {/* Main seal */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: plan.highlight ? '36px' : '40px',
                      height: plan.highlight ? '36px' : '40px',
                      borderRadius: '9999px',
                      border: '1px solid #8B6914',
                      background:
                        'radial-gradient(circle at 35% 35%, rgba(255,245,220,1) 0%, rgba(255,240,200,0.8) 15%, transparent 40%),' +
                        'radial-gradient(circle at 65% 65%, rgba(0,0,0,0.15) 0%, transparent 30%),' +
                        'repeating-conic-gradient(from 0deg, #E8D7A3 0deg 9deg, #C9A961 9deg 18deg, #F5E6C8 18deg 27deg, #D4AF37 27deg 36deg)',
                      boxShadow:
                        '0 2px 6px rgba(0,0,0,0.12),' +
                        '0 4px 12px rgba(139,105,20,0.15),' +
                        'inset 0 1px 2px rgba(255,255,255,0.4),' +
                        'inset 0 -1px 2px rgba(0,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      padding: 0
                    }}>
                      {/* Faint G watermark */}
                      <div style={{
                        position: 'absolute',
                        fontSize: plan.highlight ? '1.25rem' : '1.5rem',
                        fontWeight: 900,
                        color: 'rgba(139,105,20,0.12)',
                        fontFamily: 'Georgia, serif',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        zIndex: 0
                      }}>G</div>

                      {/* Star decorations */}
                      <span style={{
                        position: 'absolute',
                        top: '2px',
                        fontSize: '5px',
                        color: '#8B6914',
                        opacity: 0.8,
                        textShadow: '0 0 1px rgba(255,235,205,0.5)',
                        pointerEvents: 'none',
                        zIndex: 2
                      }}>★</span>
                      <span style={{
                        position: 'absolute',
                        bottom: '2px',
                        fontSize: '5px',
                        color: '#8B6914',
                        opacity: 0.8,
                        textShadow: '0 0 1px rgba(255,235,205,0.5)',
                        pointerEvents: 'none',
                        zIndex: 2
                      }}>★</span>

                      {/* Main content */}
                      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                        <div style={{
                          fontSize: plan.highlight ? '0.5rem' : '0.5625rem',
                          fontWeight: 900,
                          color: '#3D2F0F',
                          letterSpacing: '0.3px',
                          textShadow: '0 0.5px 1px rgba(255,255,255,0.5)',
                          marginBottom: '0.5px'
                        }}>G1G1™</div>
                        <div style={{
                          fontSize: plan.highlight ? '0.25rem' : '0.28rem',
                          fontWeight: 800,
                          color: '#4D3A12',
                          textShadow: '0 0.5px 1px rgba(255,255,255,0.3)',
                          lineHeight: 1.1
                        }}>
                          <div>Greet One</div>
                          <div>Give One™</div>
                        </div>
                      </div>
                    </div>
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
                  color: 'var(--text-primary)',
                  textAlign: 'center'
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
                  onClick={() => handlePlanSelect(plan)}
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
                  {plan.price === 'Contact Sales' ? 'Contact Sales' : 'Get Started'}
                </button>

                {/* Features - Phase 8.3: Grouped into sections for scannability */}
                <div style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '1.5rem',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <p style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '1rem'
                  }}>
                    What's included:
                  </p>
                  <div style={{ flex: 1 }}>
                    {plan.featureGroups.map((group, groupIndex) => (
                      <div key={groupIndex} style={{ marginBottom: groupIndex < plan.featureGroups.length - 1 ? '1rem' : 0 }}>
                        {/* Section header */}
                        <p style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--text-tertiary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.025em',
                          marginBottom: '0.5rem'
                        }}>
                          {group.section}
                        </p>
                        {/* Features in this section */}
                        <ul style={{
                          listStyle: 'none',
                          padding: 0,
                          margin: 0
                        }}>
                          {group.features.map((feature, featureIndex) => (
                            <li
                              key={featureIndex}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.75rem',
                                marginBottom: '0.5rem',
                                fontSize: '0.875rem',
                                color: 'var(--text-secondary)'
                              }}
                            >
                              <Check size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '0.125rem' }} />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enterprise Contact Form Modal */}
      {showEnterpriseForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0
              }}>Contact Sales</h2>
              <button
                onClick={() => setShowEnterpriseForm(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >×</button>
            </div>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem'
            }}>
              Tell us about your business and we'll create a custom enterprise solution for you.
            </p>
            <form onSubmit={handleEnterpriseSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={enterpriseFormData.companyName}
                  onChange={(e) => setEnterpriseFormData({...enterpriseFormData, companyName: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Contact Name *
                </label>
                <input
                  type="text"
                  required
                  value={enterpriseFormData.contactName}
                  onChange={(e) => setEnterpriseFormData({...enterpriseFormData, contactName: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={enterpriseFormData.email}
                  onChange={(e) => setEnterpriseFormData({...enterpriseFormData, email: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={enterpriseFormData.phone}
                  onChange={(e) => setEnterpriseFormData({...enterpriseFormData, phone: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Number of Employees *
                </label>
                <select
                  required
                  value={enterpriseFormData.employeeCount}
                  onChange={(e) => setEnterpriseFormData({...enterpriseFormData, employeeCount: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    background: 'white'
                  }}
                >
                  <option value="">Select...</option>
                  <option value="51-100">51-100</option>
                  <option value="101-250">101-250</option>
                  <option value="251-500">251-500</option>
                  <option value="501-1000">501-1000</option>
                  <option value="1000+">1000+</option>
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Tell us about your needs
                </label>
                <textarea
                  value={enterpriseFormData.message}
                  onChange={(e) => setEnterpriseFormData({...enterpriseFormData, message: e.target.value})}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  placeholder="What features are most important? Any specific integrations needed?"
                />
              </div>
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && selectedPlan && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            maxWidth: '450px',
            width: '100%',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0
              }}>
                {checkoutStep === 'summary' && 'Checkout'}
                {checkoutStep === 'payment' && 'Payment Details'}
                {checkoutStep === 'complete' && 'Success!'}
              </h2>
              {checkoutStep !== 'complete' && (
                <button
                  onClick={closeCheckout}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)'
                  }}
                >×</button>
              )}
            </div>

            {/* Step: Order Summary */}
            {checkoutStep === 'summary' && (
              <>
                <div style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.5rem',
                  marginBottom: '1.5rem'
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '1rem'
                  }}>Order Summary</h3>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{selectedPlan.name}</span>
                    <span style={{ fontWeight: 600 }}>${selectedPlan.price}/{selectedPlan.period}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border)',
                    marginTop: '0.75rem'
                  }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                    <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary)' }}>${selectedPlan.price}</span>
                  </div>
                  {pricingMode === 'founders' && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem',
                      background: 'rgba(251, 191, 36, 0.1)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.75rem',
                      color: '#b45309',
                      textAlign: 'center',
                      fontWeight: 500
                    }}>
                      🎉 Founders pricing locked for life!
                    </div>
                  )}
                </div>

                {user && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#dcfce7',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <CheckCircle size={16} />
                    Signed in as {user.email}
                  </div>
                )}

                <form onSubmit={handleCheckout}>
                  <button
                    type="submit"
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      marginBottom: '1rem'
                    }}
                  >
                    Continue to Payment
                  </button>
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    textAlign: 'center',
                    margin: 0
                  }}>
                    Secure checkout powered by Stripe. Cancel anytime.
                  </p>
                </form>
              </>
            )}

            {/* Step: Payment Form */}
            {checkoutStep === 'payment' && (
              <form onSubmit={handlePaymentSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem'
                  }}>
                    <CreditCard size={14} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    Card Number
                  </label>
                  <input
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    value={paymentData.cardNumber}
                    onChange={(e) => setPaymentData({ ...paymentData, cardNumber: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>Expiry Date</label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={paymentData.expiry}
                      onChange={(e) => setPaymentData({ ...paymentData, expiry: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>CVC</label>
                    <input
                      type="text"
                      placeholder="123"
                      value={paymentData.cvc}
                      onChange={(e) => setPaymentData({ ...paymentData, cvc: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem'
                  }}>Name on Card</label>
                  <input
                    type="text"
                    placeholder="John Smith"
                    value={paymentData.name}
                    onChange={(e) => setPaymentData({ ...paymentData, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <div style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Total</span>
                  <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--primary)' }}>${selectedPlan.price}</span>
                </div>

                <button
                  type="submit"
                  disabled={processing}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: processing ? 'var(--gray-300)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: processing ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {processing ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Lock size={16} />
                      Pay ${selectedPlan.price}
                    </>
                  )}
                </button>

                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem'
                }}>
                  <Lock size={12} />
                  Secure 256-bit SSL encryption
                </p>
              </form>
            )}

            {/* Step: Complete */}
            {checkoutStep === 'complete' && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{
                  width: '4rem',
                  height: '4rem',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                }}>
                  <CheckCircle size={32} style={{ color: 'white' }} />
                </div>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.75rem'
                }}>Payment Successful!</h3>
                <p style={{
                  fontSize: '1rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.5rem',
                  lineHeight: 1.6
                }}>
                  Thank you for choosing {selectedPlan.name}!
                </p>
                <p style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-tertiary)'
                }}>
                  Redirecting you to your dashboard...
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
