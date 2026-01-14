// src/pages/ForBusiness.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Building2, Users, Mail, Phone, MessageSquare, CreditCard, Check, Play } from 'lucide-react';
import GreetMeLogo from '../components/GreetMeLogo';

export default function ForBusiness() {
  const navigate = useNavigate();
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactFormData, setContactFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    employeeCount: '',
    message: ''
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Animation Pack modal state
  const [showAnimationModal, setShowAnimationModal] = useState(false);
  const [selectedAnimationPack, setSelectedAnimationPack] = useState(null);
  const [animationCheckoutStep, setAnimationCheckoutStep] = useState('select'); // 'select', 'payment', 'success'
  const [animationPaymentInfo, setAnimationPaymentInfo] = useState({
    cardNumber: '',
    expiry: '',
    cvv: '',
    name: ''
  });

  const animationPacks = [
    { id: 1, animations: 5, price: 9.99, perAnimation: '2.00', popular: false },
    { id: 2, animations: 12, price: 19.99, perAnimation: '1.67', popular: true },
    { id: 3, animations: 25, price: 34.99, perAnimation: '1.40', popular: false, bestValue: true }
  ];

  const handleAnimationPurchase = () => {
    if (animationCheckoutStep === 'select' && selectedAnimationPack) {
      setAnimationCheckoutStep('payment');
    } else if (animationCheckoutStep === 'payment') {
      // Simulate payment processing
      setAnimationCheckoutStep('success');
    }
  };

  const resetAnimationModal = () => {
    setShowAnimationModal(false);
    setSelectedAnimationPack(null);
    setAnimationCheckoutStep('select');
    setAnimationPaymentInfo({ cardNumber: '', expiry: '', cvv: '', name: '' });
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    // Simulate form submission
    console.log('Contact form submitted:', contactFormData);
    setFormSubmitted(true);
    setTimeout(() => {
      setShowContactForm(false);
      setFormSubmitted(false);
      setContactFormData({
        companyName: '',
        contactName: '',
        email: '',
        phone: '',
        employeeCount: '',
        message: ''
      });
    }, 2000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%)'
    }}>
      {/* Back Button */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '1.5rem 2rem 0'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            background: 'white',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--gray-50)';
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.borderColor = 'var(--gray-300)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          <ArrowLeft size={18} />
          Back
        </button>
      </div>

      {/* Hero Section */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '4rem 2rem',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <GreetMeLogo size="large" clickable={true} />
        </div>
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
          onClick={() => setShowContactForm(true)}
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
        {/* 1. Branded Merchandise */}
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

        {/* 2. Value Add Bundled Subscriptions */}
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
            Value Add Bundled Subscriptions
          </h3>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            margin: 0
          }}>
            Bundle Greet-Me subscriptions with your products or services. Enhance customer value, boost retention, and create meaningful touchpoints that differentiate your brand.
          </p>
        </div>

        {/* 3. Curated Gifts from our American Marketplace */}
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
            Curated Gifts from our American Marketplace
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

        {/* 5. Anytime Animation Packs - Clickable with Checkout */}
        <div
          onClick={() => setShowAnimationModal(true)}
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
      </section>

      {/* Hero™ Secondary Mention - Centered */}
      <section style={{
        maxWidth: '800px',
        margin: '2rem auto 4rem',
        padding: '3rem 2rem',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(139, 105, 20, 0.05) 100%)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid rgba(212, 175, 55, 0.2)'
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
          GREETME - HERO
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
          onClick={() => setShowContactForm(true)}
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

      {/* Contact Sales Form Modal */}
      {showContactForm && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowContactForm(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
              backdropFilter: 'blur(4px)'
            }}
          />

          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderTopLeftRadius: 'var(--radius-xl)',
              borderTopRightRadius: 'var(--radius-xl)',
              color: 'white'
            }}>
              <div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  margin: 0,
                  marginBottom: '0.25rem'
                }}>Contact Sales</h2>
                <p style={{
                  fontSize: '0.875rem',
                  opacity: 0.9,
                  margin: 0
                }}>Let's create your corporate gifting program</p>
              </div>
              <button
                onClick={() => setShowContactForm(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '50%',
                  width: '2.5rem',
                  height: '2.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              {formSubmitted ? (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem 0'
                }}>
                  <div style={{
                    width: '4rem',
                    height: '4rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    fontSize: '2rem'
                  }}>
                    ✓
                  </div>
                  <h3 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.75rem'
                  }}>Thank You!</h3>
                  <p style={{
                    fontSize: '1rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6
                  }}>
                    Our sales team will be in touch within 24 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit}>
                  {/* Company Name */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>
                      <Building2 size={14} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={contactFormData.companyName}
                      onChange={(e) => setContactFormData({ ...contactFormData, companyName: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                      placeholder="Your company name"
                    />
                  </div>

                  {/* Contact Name */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>
                      <Users size={14} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={contactFormData.contactName}
                      onChange={(e) => setContactFormData({ ...contactFormData, contactName: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                      placeholder="Your full name"
                    />
                  </div>

                  {/* Email */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>
                      <Mail size={14} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={contactFormData.email}
                      onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                      placeholder="you@company.com"
                    />
                  </div>

                  {/* Phone */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>
                      <Phone size={14} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={contactFormData.phone}
                      onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  {/* Employee Count */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>
                      Number of Employees
                    </label>
                    <select
                      value={contactFormData.employeeCount}
                      onChange={(e) => setContactFormData({ ...contactFormData, employeeCount: e.target.value })}
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
                      <option value="">Select range...</option>
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="201-500">201-500</option>
                      <option value="500+">500+</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem'
                    }}>
                      <MessageSquare size={14} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                      How can we help?
                    </label>
                    <textarea
                      value={contactFormData.message}
                      onChange={(e) => setContactFormData({ ...contactFormData, message: e.target.value })}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                      placeholder="Tell us about your gifting needs..."
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    style={{
                      width: '100%',
                      padding: '1rem',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '1rem',
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
                    Submit Request
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}

      {/* Anytime Animation Packs Modal */}
      {showAnimationModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={resetAnimationModal}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
              backdropFilter: 'blur(4px)'
            }}
          />

          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              borderTopLeftRadius: 'var(--radius-xl)',
              borderTopRightRadius: 'var(--radius-xl)',
              color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Play size={24} />
                <div>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    margin: 0
                  }}>
                    {animationCheckoutStep === 'success' ? 'Purchase Complete!' : 'Anytime Animation Packs'}
                  </h2>
                  <p style={{
                    fontSize: '0.875rem',
                    opacity: 0.9,
                    margin: 0
                  }}>
                    {animationCheckoutStep === 'select' && 'Buy animation credits for your greetings'}
                    {animationCheckoutStep === 'payment' && 'Complete your purchase'}
                    {animationCheckoutStep === 'success' && 'Your animations have been added'}
                  </p>
                </div>
              </div>
              <button
                onClick={resetAnimationModal}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '50%',
                  width: '2.5rem',
                  height: '2.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              {/* Step 1: Select Package */}
              {animationCheckoutStep === 'select' && (
                <>
                  <p style={{
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.5rem',
                    fontSize: '0.9375rem'
                  }}>
                    Choose a pack to add animation credits to your account
                  </p>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    {animationPacks.map((pkg) => (
                      <div
                        key={pkg.id}
                        onClick={() => setSelectedAnimationPack(pkg)}
                        style={{
                          padding: '1.25rem',
                          border: selectedAnimationPack?.id === pkg.id ? '2px solid #8b5cf6' : '2px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          background: selectedAnimationPack?.id === pkg.id ? 'rgba(139, 92, 246, 0.05)' : 'white',
                          position: 'relative'
                        }}
                      >
                        {pkg.popular && (
                          <span style={{
                            position: 'absolute',
                            top: '-0.5rem',
                            right: '1rem',
                            background: '#f59e0b',
                            color: 'white',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            padding: '0.25rem 0.75rem',
                            borderRadius: 'var(--radius-md)'
                          }}>
                            POPULAR
                          </span>
                        )}
                        {pkg.bestValue && (
                          <span style={{
                            position: 'absolute',
                            top: '-0.5rem',
                            right: '1rem',
                            background: '#22c55e',
                            color: 'white',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            padding: '0.25rem 0.75rem',
                            borderRadius: 'var(--radius-md)'
                          }}>
                            BEST VALUE
                          </span>
                        )}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                              width: '3rem',
                              height: '3rem',
                              borderRadius: '50%',
                              background: selectedAnimationPack?.id === pkg.id
                                ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                                : 'var(--gray-100)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}>
                              <Play size={20} style={{
                                color: selectedAnimationPack?.id === pkg.id ? 'white' : 'var(--text-secondary)'
                              }} />
                            </div>
                            <div>
                              <div style={{
                                fontSize: '1.125rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)'
                              }}>
                                {pkg.animations} Animations
                              </div>
                              <div style={{
                                fontSize: '0.8125rem',
                                color: 'var(--text-secondary)'
                              }}>
                                ${pkg.perAnimation} per animation
                              </div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: selectedAnimationPack?.id === pkg.id ? '#8b5cf6' : 'var(--text-primary)'
                          }}>
                            ${pkg.price}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleAnimationPurchase}
                    disabled={!selectedAnimationPack}
                    style={{
                      width: '100%',
                      marginTop: '1.5rem',
                      padding: '1rem',
                      background: selectedAnimationPack
                        ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                        : 'var(--gray-200)',
                      color: selectedAnimationPack ? 'white' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: selectedAnimationPack ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit'
                    }}
                  >
                    Continue to Payment
                  </button>
                </>
              )}

              {/* Step 2: Payment */}
              {animationCheckoutStep === 'payment' && (
                <>
                  {/* Selected Package Summary */}
                  <div style={{
                    background: 'rgba(139, 92, 246, 0.05)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Play size={20} style={{ color: '#8b5cf6' }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {selectedAnimationPack?.animations} Animations
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#8b5cf6', fontSize: '1.25rem' }}>
                      ${selectedAnimationPack?.price}
                    </span>
                  </div>

                  {/* Payment Form */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem'
                      }}>
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        value={animationPaymentInfo.name}
                        onChange={(e) => setAnimationPaymentInfo({ ...animationPaymentInfo, name: e.target.value })}
                        placeholder="John Doe"
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
                      }}>
                        <CreditCard size={14} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                        Card Number
                      </label>
                      <input
                        type="text"
                        value={animationPaymentInfo.cardNumber}
                        onChange={(e) => setAnimationPaymentInfo({ ...animationPaymentInfo, cardNumber: e.target.value })}
                        placeholder="1234 5678 9012 3456"
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

                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: '0.5rem'
                        }}>
                          Expiry
                        </label>
                        <input
                          type="text"
                          value={animationPaymentInfo.expiry}
                          onChange={(e) => setAnimationPaymentInfo({ ...animationPaymentInfo, expiry: e.target.value })}
                          placeholder="MM/YY"
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
                      <div style={{ flex: 1 }}>
                        <label style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: '0.5rem'
                        }}>
                          CVV
                        </label>
                        <input
                          type="text"
                          value={animationPaymentInfo.cvv}
                          onChange={(e) => setAnimationPaymentInfo({ ...animationPaymentInfo, cvv: e.target.value })}
                          placeholder="123"
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
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <button
                      onClick={() => setAnimationCheckoutStep('select')}
                      style={{
                        flex: 1,
                        padding: '1rem',
                        background: 'white',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleAnimationPurchase}
                      style={{
                        flex: 2,
                        padding: '1rem',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-lg)',
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <CreditCard size={18} />
                      Pay ${selectedAnimationPack?.price}
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Success */}
              {animationCheckoutStep === 'success' && (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{
                    width: '5rem',
                    height: '5rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem'
                  }}>
                    <Check size={40} style={{ color: 'white' }} />
                  </div>
                  <h3 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.75rem'
                  }}>
                    Thank You!
                  </h3>
                  <p style={{
                    fontSize: '1rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.5rem',
                    lineHeight: 1.6
                  }}>
                    Your {selectedAnimationPack?.animations} animation credits have been added to your account.
                  </p>
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.5rem'
                  }}>
                    You can now use them in any greeting!
                  </p>
                  <button
                    onClick={resetAnimationModal}
                    style={{
                      padding: '0.875rem 2rem',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
