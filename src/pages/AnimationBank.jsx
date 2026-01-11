// Animation Bank Page
// Shows user's animation credits with positive, asset-focused language
import { useState, useEffect } from 'react';
import { Film, Plus, Gift, Calendar, Star, Sparkles, Repeat } from 'lucide-react';
import animationBankService from '../services/animationBankService';
import animationTemplateService from '../services/animationTemplateService';

export default function AnimationBank() {
  const [bank, setBank] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [showPacksModal, setShowPacksModal] = useState(false);
  const [creditsSaved, setCreditsSaved] = useState(0);

  useEffect(() => {
    loadAnimationBank();
  }, []);

  const loadAnimationBank = () => {
    // Check for monthly reset
    animationBankService.resetMonthlyAllowance();
    // Check for holiday boost
    animationBankService.checkHolidayBoost();

    const bankData = animationBankService.getAnimationBank();
    const breakdownData = animationBankService.getBreakdown();

    // Get credits saved through template reuse
    const saved = animationTemplateService.getTotalCreditsSaved();

    setBank(bankData);
    setBreakdown(breakdownData);
    setCreditsSaved(saved);
  };

  const handlePurchasePack = (packSize, packName, price) => {
    // In production, this would integrate with payment processor
    animationBankService.addPurchasedPack(packSize, packName);
    loadAnimationBank();
    setShowPacksModal(false);
    alert(`${packName} added! You now have ${animationBankService.getTotalAvailable()} Animated Moments.`);
  };

  if (!bank || !breakdown) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <Sparkles size={48} style={{ color: '#667eea', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading Animation Bank...</p>
        </div>
      </div>
    );
  }

  const packs = [
    { name: 'Starter', size: 3, price: 9.99, icon: '✨', color: '#667eea' },
    { name: 'Celebration', size: 10, price: 24.99, icon: '🎉', color: '#10b981' },
    { name: 'Holiday', size: 25, price: 49.99, icon: '🎄', color: '#f59e0b' }
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header with Gradient */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '1rem',
        padding: '2.5rem',
        marginBottom: '2rem',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)',
        color: 'white',
        textAlign: 'center'
      }}>
        <Film size={48} style={{ margin: '0 auto 1rem' }} />
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 700,
          marginBottom: '0.5rem'
        }}>
          Animation Bank
        </h1>
        <p style={{
          fontSize: '1.125rem',
          color: 'rgba(255, 255, 255, 0.9)'
        }}>
          Your collection of Animated Moments
        </p>
      </div>

      {/* Total Available - Hero Card */}
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '2px solid #667eea',
        textAlign: 'center'
      }}>
        <p style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#667eea',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem'
        }}>
          Total Available
        </p>
        <div style={{
          fontSize: '5rem',
          fontWeight: 700,
          color: '#667eea',
          lineHeight: 1,
          marginBottom: '0.5rem'
        }}>
          {breakdown.total}
        </div>
        <p style={{
          fontSize: '1.25rem',
          color: 'var(--text-secondary)',
          fontWeight: 500
        }}>
          Animated Moments Ready to Send
        </p>
        <button
          onClick={() => setShowPacksModal(true)}
          style={{
            marginTop: '1.5rem',
            padding: '0.75rem 2rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            transition: 'all 0.2s'
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
          <Plus size={20} />
          Add More
        </button>
      </div>

      {/* Breakdown Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {/* Credits Saved Card - Always show first */}
        {creditsSaved > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '2px solid #10b98120'
          }}>
            <div style={{
              fontSize: '2rem',
              marginBottom: '0.5rem'
            }}>
              <Repeat size={32} style={{ color: '#10b981' }} />
            </div>
            <p style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#10b981',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.5rem'
            }}>
              Credits Saved
            </p>
            <p style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.25rem'
            }}>
              {creditsSaved}
            </p>
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)'
            }}>
              Through template reuse
            </p>
          </div>
        )}

        {/* Existing breakdown cards */}
        {breakdown.breakdown.map((item, index) => (
          <div key={index} style={{
            background: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: `2px solid ${item.color}20`
          }}>
            <div style={{
              fontSize: '2rem',
              marginBottom: '0.5rem'
            }}>
              {item.icon}
            </div>
            <p style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: item.color,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.5rem'
            }}>
              {item.label}
            </p>
            <p style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--text-primary)'
            }}>
              {item.amount}
            </p>
          </div>
        ))}
      </div>

      {/* How It Works */}
      <div style={{
        background: '#faf5ff',
        borderRadius: '1rem',
        padding: '2rem',
        marginBottom: '2rem',
        border: '1px solid #e9d5ff'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1.5rem'
        }}>
          How Animated Moments Work
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem'
        }}>
          <div>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Calendar size={20} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Monthly Refresh
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              Your plan includes {bank.monthlyAllowance} animated greetings per month. They refresh automatically!
            </p>
          </div>
          <div>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Gift size={20} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Never Expire
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              Purchased packs, holiday bonuses, and earned credits never expire. They're yours to use whenever!
            </p>
          </div>
          <div>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Star size={20} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Earn Bonuses
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              We add bonus animations for holidays, milestones, and special moments throughout the year!
            </p>
          </div>
        </div>
      </div>

      {/* Packs Modal */}
      {showPacksModal && (
        <>
          <div
            onClick={() => setShowPacksModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1000
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            zIndex: 1001,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              Animation Packs
            </h2>
            <p style={{
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              Add more Animated Moments to your bank. Credits never expire!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {packs.map(pack => (
                <div key={pack.name} style={{
                  border: `2px solid ${pack.color}`,
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: `${pack.color}08`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      fontSize: '2.5rem'
                    }}>
                      {pack.icon}
                    </div>
                    <div>
                      <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '0.25rem'
                      }}>
                        {pack.name} Pack
                      </h3>
                      <p style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                      }}>
                        {pack.size} Animated Moments • ${pack.price}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePurchasePack(pack.size, `${pack.name} Pack`, pack.price)}
                    style={{
                      padding: '0.625rem 1.25rem',
                      background: pack.color,
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    Add Pack
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowPacksModal(false)}
              style={{
                marginTop: '2rem',
                width: '100%',
                padding: '0.75rem',
                background: 'var(--gray-100)',
                color: 'var(--text-primary)',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}
