// src/pages/HeroProgram.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Heart, Gift, Building2, ShoppingCart, X, CreditCard, Check, Image, ArrowLeft } from 'lucide-react';

export default function HeroProgram() {
  const navigate = useNavigate();
  const [showImageBankModal, setShowImageBankModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState('select'); // 'select', 'payment', 'success'
  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: '',
    expiry: '',
    cvv: '',
    name: ''
  });

  const imageBankPackages = [
    { id: 1, images: 3, price: 5, perImage: '1.67', popular: false },
    { id: 2, images: 5, price: 10, perImage: '2.00', popular: true },
    { id: 3, images: 10, price: 15, perImage: '1.50', popular: false, bestValue: true }
  ];

  const handlePurchase = () => {
    if (checkoutStep === 'select' && selectedPackage) {
      setCheckoutStep('payment');
    } else if (checkoutStep === 'payment') {
      // Simulate payment processing
      setCheckoutStep('success');
    }
  };

  const resetModal = () => {
    setShowImageBankModal(false);
    setSelectedPackage(null);
    setCheckoutStep('select');
    setPaymentInfo({ cardNumber: '', expiry: '', cvv: '', name: '' });
  };

  // Mock leaderboard data - Top 5 for preview
  const topHeroes = [
    { rank: 1, name: 'TechCorp Solutions', type: 'Company', totalGifted: 450, isHallOfHeroes: true },
    { rank: 2, name: 'Sarah Johnson', type: 'Individual', totalGifted: 380, isHallOfHeroes: true },
    { rank: 3, name: 'Blue Sky Enterprises', type: 'Company', totalGifted: 320, isHallOfHeroes: true },
    { rank: 4, name: 'Michael Rodriguez', type: 'Individual', totalGifted: 275, isHallOfHeroes: true },
    { rank: 5, name: 'GreenLeaf Industries', type: 'Company', totalGifted: 240, isHallOfHeroes: true }
  ];

  return (
    <div>
      {/* Back Button */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--gray-100)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      {/* Hero Header Card */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '3rem 2rem',
        marginBottom: '2rem',
        color: '#000000',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(0, 0, 0, 0.1)',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#000000'
          }}>
            🏅 10% donated
          </div>

          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            marginBottom: '1rem',
            color: '#000000'
          }}>
            Greet-Me Hero™
          </h1>

          <p style={{
            fontSize: '1.25rem',
            marginBottom: '1rem',
            lineHeight: 1.6,
            color: '#000000'
          }}>
            Greet-Me Hero™ is our B2B program for companies who purchase bulk subscription bundles or use our white label services. Whether you're including subscriptions as an added value for your existing client base OR recognizing valued clients or employees, you get meaningful connections at scale.
          </p>
          <p style={{
            fontSize: '1.125rem',
            marginBottom: '1rem',
            lineHeight: 1.6,
            color: '#000000'
          }}>
            The Greet-Me Hero program gives <strong>10% of proceeds</strong> to veterans, law enforcement, and EMS causes. Now that's a gift worth giving!
          </p>
          <p style={{
            fontSize: '1rem',
            marginBottom: '2rem',
            lineHeight: 1.6,
            color: '#000000'
          }}>
            All participants automatically earn ranked placement in the <strong>Greet-Me Hall of Honor</strong>. Enterprise level participants earn a permanent place in the <strong>Greet-Me Hall of Heroes</strong> and will be ranked according to level of participation.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* Shop Merch Store - Yellow */}
            <button
              onClick={() => navigate('/dashboard/merch')}
              style={{
                padding: '0.875rem 2rem',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                color: '#000000',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
              }}
            >
              <Gift size={20} />
              Visit Gift Shop
            </button>
            {/* View Hall of Heroes - Yellow */}
            <button
              onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
              style={{
                padding: '0.875rem 2rem',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                color: '#000000',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
              }}
            >
              View Hall of Heroes
            </button>
            {/* Be a Hero - Yellow */}
            <button
              onClick={() => alert('Become a Hero Sponsor form - Integration coming soon')}
              style={{
                padding: '0.875rem 2rem',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                color: '#000000',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
              }}
            >
              Be a Hero
            </button>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>How It Works</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* Card 1: Recognition & Impact (FIRST) */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Heart size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Recognition & Impact</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              10% of qualifying corporate program proceeds support veterans and first responders. Track your impact with leaderboard rankings and earn permanent Hall of Heroes recognition.
            </p>
          </div>

          {/* Card 2: Hero™ Marketplace Partners */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Building2 size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Hero™ Marketplace Partners</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Curated vendors who stand with Greet-Me to honor our heroes. Shop from partners committed to quality and purpose-driven giving.
            </p>
          </div>

          {/* Card 3: Branded Merch */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.75rem'
            }}>
              <ShoppingCart size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Branded Merch</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Custom apparel, drinkware, and accessories with your branding. Build your brand while showing appreciation.
            </p>
          </div>

          {/* Card 4: Give-Away Value-Add Bundles */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Gift size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Give-Away Value-Add Bundles</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Pre-packaged gift bundles perfect for events, promotions, and client appreciation. Ready to give, easy to customize.
            </p>
          </div>

          {/* Card 5: White Glove Service */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Award size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>White Glove Service</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Full-service concierge support for enterprise clients. We handle everything from curation to delivery.
            </p>
          </div>

          {/* Card 6: Subscriptions */}
          <div
            onClick={() => setShowImageBankModal(true)}
            style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xl)',
              padding: '2rem',
              border: '2px solid var(--border)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#667eea';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Image size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Subscriptions</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Purchase image credits to send premium greeting cards. Click to view packages and pricing.
            </p>
            <div style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              display: 'inline-block'
            }}>
              Buy Credits →
            </div>
          </div>

          {/* Card 7: Bundles (LAST) */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Gift size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Bundles</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Curated gift collections combining the best of Greet-Me. Perfect for bulk purchases and corporate gifting programs.
            </p>
          </div>
        </div>
      </div>

      {/* Impact Snapshot */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>Impact Snapshot</h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2rem',
            textAlign: 'center'
          }}>
            <div>
              <div style={{
                fontSize: '3rem',
                fontWeight: 700,
                color: '#667eea',
                marginBottom: '0.5rem'
              }}>1,250</div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>Subscriptions Gifted</div>
            </div>
            <div>
              <div style={{
                fontSize: '3rem',
                fontWeight: 700,
                color: '#f093fb',
                marginBottom: '0.5rem'
              }}>$18,750</div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>Total Donated (10%)</div>
            </div>
            <div>
              <div style={{
                fontSize: '3rem',
                fontWeight: 700,
                color: '#4facfe',
                marginBottom: '0.5rem'
              }}>340</div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>Active Hero Sponsors</div>
            </div>
          </div>
        </div>
      </div>

      {/* Hall of Honor Preview */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>Hall of Honor - Top 5</h2>
        <p style={{
          textAlign: 'center',
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem',
          fontSize: '0.875rem'
        }}>
          Recognizing our top sponsors by total gifted subscriptions
        </p>

        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden'
        }}>
          {topHeroes.map((hero, index) => (
            <div
              key={hero.rank}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 1.5rem',
                borderBottom: index < topHeroes.length - 1 ? '1px solid var(--border)' : 'none',
                background: hero.rank <= 3 ? 'rgba(102, 126, 234, 0.05)' : 'transparent'
              }}
            >
              {/* Rank */}
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                background: hero.rank === 1 ? '#fbbf24' : hero.rank === 2 ? '#94a3b8' : hero.rank === 3 ? '#cd7f32' : 'var(--gray-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1rem',
                color: hero.rank <= 3 ? 'white' : 'var(--text-primary)'
              }}>
                {hero.rank}
              </div>

              {/* Name and Type */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {hero.name}
                  {hero.isHallOfHeroes && (
                    <span style={{
                      fontSize: '0.75rem',
                      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                      color: 'white',
                      padding: '0.125rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600
                    }}>
                      🏆 Hall of Heroes
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)'
                }}>
                  {hero.type}
                </div>
              </div>

              {/* Total Gifted */}
              <div style={{
                textAlign: 'right'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#667eea'
                }}>
                  {hero.totalGifted}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)'
                }}>
                  gifted
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={() => alert('Full leaderboard - Integration coming soon')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              color: '#000000',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
            }}
          >
            View Full Hall of Honor →
          </button>
        </div>
      </div>

      {/* Hall of Heroes vs Leaderboard Section */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          color: '#000000',
          textAlign: 'center'
        }}>
          <div style={{
            width: '5rem',
            height: '5rem',
            margin: '0 auto 1rem',
            fontSize: '4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            🏆
          </div>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 700,
            marginBottom: '1rem',
            color: '#000000'
          }}>Hall of Heroes™</h2>
          <p style={{
            fontSize: '1.125rem',
            marginBottom: '1rem',
            lineHeight: 1.6,
            color: '#000000'
          }}>
            Permanent, invite-only recognition for corporate sponsors who achieve benchmark impact milestones.
          </p>
          <p style={{
            fontSize: '1rem',
            marginBottom: '1.5rem',
            color: '#000000'
          }}>
            Hall of Heroes status is <strong>permanent and badge-worthy</strong> — once earned, you keep it forever. This is separate from the dynamic leaderboard rankings.
          </p>
          <div style={{
            background: 'rgba(0, 0, 0, 0.1)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            marginBottom: '1rem',
            color: '#000000'
          }}>
            <strong>Hall of Honor Leaderboard:</strong> Dynamic rankings updated in real-time based on total subscriptions distributed. Compete for recognition and visibility.
          </div>
          <div style={{
            background: 'rgba(0, 0, 0, 0.08)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            color: '#000000'
          }}>
            <strong>Hall of Heroes:</strong> Benchmark-based permanent recognition. Invitation only. Badge displayed forever across your profile and marketing materials.
          </div>
        </div>
      </div>

      {/* Image Bank Modal */}
      {showImageBankModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={resetModal}
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
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderTopLeftRadius: 'var(--radius-xl)',
              borderTopRightRadius: 'var(--radius-xl)',
              color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Image size={24} />
                <div>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    margin: 0
                  }}>
                    {checkoutStep === 'success' ? 'Purchase Complete!' : 'Image Bank'}
                  </h2>
                  <p style={{
                    fontSize: '0.875rem',
                    opacity: 0.9,
                    margin: 0
                  }}>
                    {checkoutStep === 'select' && 'Buy image credits for greeting cards'}
                    {checkoutStep === 'payment' && 'Complete your purchase'}
                    {checkoutStep === 'success' && 'Your credits have been added'}
                  </p>
                </div>
              </div>
              <button
                onClick={resetModal}
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
              {checkoutStep === 'select' && (
                <>
                  <p style={{
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.5rem',
                    fontSize: '0.9375rem'
                  }}>
                    Choose a package to add image credits to your account
                  </p>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    {imageBankPackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        onClick={() => setSelectedPackage(pkg)}
                        style={{
                          padding: '1.25rem',
                          border: selectedPackage?.id === pkg.id ? '2px solid #667eea' : '2px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          background: selectedPackage?.id === pkg.id ? 'rgba(102, 126, 234, 0.05)' : 'white',
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
                              background: selectedPackage?.id === pkg.id
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : 'var(--gray-100)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}>
                              <Image size={20} style={{
                                color: selectedPackage?.id === pkg.id ? 'white' : 'var(--text-secondary)'
                              }} />
                            </div>
                            <div>
                              <div style={{
                                fontSize: '1.125rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)'
                              }}>
                                {pkg.images} Images
                              </div>
                              <div style={{
                                fontSize: '0.8125rem',
                                color: 'var(--text-secondary)'
                              }}>
                                ${pkg.perImage} per image
                              </div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: selectedPackage?.id === pkg.id ? '#667eea' : 'var(--text-primary)'
                          }}>
                            ${pkg.price}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handlePurchase}
                    disabled={!selectedPackage}
                    style={{
                      width: '100%',
                      marginTop: '1.5rem',
                      padding: '1rem',
                      background: selectedPackage
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'var(--gray-200)',
                      color: selectedPackage ? 'white' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: selectedPackage ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit'
                    }}
                  >
                    Continue to Payment →
                  </button>
                </>
              )}

              {/* Step 2: Payment */}
              {checkoutStep === 'payment' && selectedPackage && (
                <>
                  {/* Order Summary */}
                  <div style={{
                    background: 'var(--gray-50)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {selectedPackage.images} Image Credits
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        ${selectedPackage.price}.00
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)'
                    }}>
                      Use for premium greeting card images
                    </div>
                  </div>

                  {/* Payment Form */}
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
                      value={paymentInfo.cardNumber}
                      onChange={(e) => setPaymentInfo({ ...paymentInfo, cardNumber: e.target.value })}
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
                      }}>
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        value={paymentInfo.expiry}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, expiry: e.target.value })}
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
                        CVV
                      </label>
                      <input
                        type="text"
                        placeholder="123"
                        value={paymentInfo.cvv}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, cvv: e.target.value })}
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
                    }}>
                      Name on Card
                    </label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={paymentInfo.name}
                      onChange={(e) => setPaymentInfo({ ...paymentInfo, name: e.target.value })}
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
                    <button
                      onClick={() => setCheckoutStep('select')}
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
                      ← Back
                    </button>
                    <button
                      onClick={handlePurchase}
                      style={{
                        flex: 2,
                        padding: '1rem',
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
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
                      Pay ${selectedPackage.price}.00
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Success */}
              {checkoutStep === 'success' && selectedPackage && (
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
                    marginBottom: '1.5rem',
                    lineHeight: 1.6
                  }}>
                    <strong>{selectedPackage.images} image credits</strong> have been added to your account.<br />
                    You can now use them when creating greeting cards.
                  </p>
                  <div style={{
                    background: 'var(--gray-50)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Order Total:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>${selectedPackage.price}.00</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Credits Added:</span>
                      <span style={{ fontWeight: 600, color: '#22c55e' }}>{selectedPackage.images} Images</span>
                    </div>
                  </div>
                  <button
                    onClick={resetModal}
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
