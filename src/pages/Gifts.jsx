// src/pages/Gifts.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Heart, Check, ArrowLeft, DollarSign, X } from 'lucide-react';
import cartService from '../services/cartService';
import QRCashGiftModal from '../components/QRCashGiftModal';

const giftProducts = [
  {
    id: 1,
    name: 'Premium Steak Gift Box',
    partner: 'Omaha Steaks',
    price: 149.99,
    description: 'Finest cuts of USDA Prime beef, perfectly aged',
    category: 'Food & Gourmet'
  },
  {
    id: 2,
    name: 'Luxury Flower Bouquet',
    partner: '1-800-Flowers',
    price: 79.99,
    description: 'Stunning arrangement of premium roses and lilies',
    category: 'Flowers'
  },
  {
    id: 3,
    name: 'Artisan Chocolate Collection',
    partner: 'Godiva',
    price: 64.99,
    description: 'Hand-crafted Belgian chocolates in elegant packaging',
    category: 'Food & Gourmet'
  },
  {
    id: 4,
    name: 'Spa Gift Basket',
    partner: 'Sephora',
    price: 129.99,
    description: 'Luxury bath and body products for ultimate relaxation',
    category: 'Wellness'
  },
  {
    id: 5,
    name: 'Gourmet Wine & Cheese Set',
    partner: 'Wine.com',
    price: 99.99,
    description: 'Curated selection of fine wines and artisan cheeses',
    category: 'Food & Gourmet'
  },
  {
    id: 6,
    name: 'Personalized Photo Album',
    partner: 'Shutterfly',
    price: 49.99,
    description: 'Custom photo book to capture precious memories',
    category: 'Personalized'
  },
  {
    id: 7,
    name: 'Premium Coffee Sampler',
    partner: 'Starbucks Reserve',
    price: 54.99,
    description: 'Exclusive single-origin coffee beans from around the world',
    category: 'Food & Gourmet'
  },
  {
    id: 8,
    name: 'Luxury Candle Set',
    partner: 'Yankee Candle',
    price: 44.99,
    description: 'Premium scented candles in elegant glass holders',
    category: 'Home'
  },
  {
    id: 9,
    name: 'Gourmet Cookie Tower',
    partner: 'Mrs. Fields',
    price: 69.99,
    description: 'Multi-tier gift tower filled with freshly baked cookies',
    category: 'Food & Gourmet'
  },
  {
    id: 10,
    name: 'Succulent Garden Kit',
    partner: 'The Sill',
    price: 39.99,
    description: 'Live succulent plants in decorative ceramic pots',
    category: 'Plants'
  }
];

// Get unique categories from gift products
const giftCategories = ['All', ...new Set(giftProducts.map(gift => gift.category))];

export default function Gifts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [addedItems, setAddedItems] = useState(new Set());
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 420);
  const [showQRCashModal, setShowQRCashModal] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);

  // Handle category from URL query param (e.g., /gifts?category=merch)
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      // Map query param values to display categories
      const categoryMap = {
        'merch': 'All', // Show all for merch since we don't have a specific merch category
        'subscription': 'All', // Placeholder for subscription category
        'food': 'Food & Gourmet',
        'flowers': 'Flowers',
        'wellness': 'Wellness',
        'home': 'Home',
        'plants': 'Plants',
        'personalized': 'Personalized'
      };
      const mappedCategory = categoryMap[categoryParam.toLowerCase()] || 'All';
      setSelectedCategory(mappedCategory);
    }
  }, [searchParams]);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 420);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter items by category
  const filteredGifts = selectedCategory === 'All'
    ? giftProducts
    : giftProducts.filter(gift => gift.category === selectedCategory);

  // Check if user came from recipient form (has category param)
  const cameFromRecipientForm = searchParams.has('category');

  const handleAddToCart = (gift, e) => {
    e.stopPropagation();
    try {
      cartService.addItem({
        giftId: gift.id,
        name: gift.name,
        price: gift.price,
        description: gift.description,
        category: gift.category,
        partner: gift.partner,
        icon: '🎁'
      });

      // Show feedback
      setAddedItems(prev => new Set(prev).add(gift.id));

      // Trigger cart count update
      window.dispatchEvent(new Event('cartUpdated'));

      // If came from recipient form, redirect back to contacts page after brief delay
      if (cameFromRecipientForm) {
        setTimeout(() => {
          navigate('/dashboard/contacts');
        }, 500);
      } else {
        // Normal behavior - remove "Added" state after 2 seconds
        setTimeout(() => {
          setAddedItems(prev => {
            const next = new Set(prev);
            next.delete(gift.id);
            return next;
          });
        }, 2000);
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add item to cart');
    }
  };

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Back Button - only show when came from recipient form */}
      {cameFromRecipientForm && (
        <button
          onClick={() => navigate('/dashboard/contacts')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2rem',
            height: '2rem',
            padding: 0,
            background: 'var(--gray-100)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            marginBottom: '1rem',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--gray-200)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--gray-100)';
          }}
          title="Back"
        >
          <ArrowLeft size={18} />
        </button>
      )}

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0
          }}>
            Gift Add-Ons
          </h1>
          {/* Gifts / Merch Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--gray-100)',
            borderRadius: '9999px',
            padding: '0.25rem'
          }}>
            <button
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              Gifts
            </button>
            <button
              onClick={() => navigate('/dashboard/merch')}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              Merch
            </button>
          </div>
        </div>
        <p style={{
          fontSize: '1rem',
          color: 'var(--text-secondary)'
        }}>
          {cameFromRecipientForm
            ? 'Select a gift for your recipient'
            : 'Add a thoughtful gift from the 🇺🇸 American Marketplace'}
        </p>
      </div>

      {/* Digital Cash Gift Option - Featured */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: isNarrow ? '1.25rem' : '2rem',
        marginBottom: isNarrow ? '1.5rem' : '3rem',
        color: 'white',
        textAlign: isNarrow ? 'center' : 'left'
      }}>
        <h2 style={{
          fontSize: isNarrow ? '1.125rem' : '1.75rem',
          fontWeight: 700,
          marginBottom: isNarrow ? '0.5rem' : '0.75rem'
        }}>
          QR Cash™ — Send · Scan · Spend
        </h2>
        <p style={{
          fontSize: isNarrow ? '0.875rem' : '1.125rem',
          opacity: 0.95,
          marginBottom: isNarrow ? '1rem' : '1.5rem'
        }}>
          Add real cash to any greeting.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: isNarrow ? 'center' : 'flex-start' }}>
          <button
            onClick={() => setShowQRCashModal(true)}
            style={{
              padding: isNarrow ? '0.5rem 1rem' : '0.625rem 1.25rem',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: isNarrow ? '0.8125rem' : '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}>
            Send
          </button>
          <button
            onClick={() => setShowHowItWorksModal(true)}
            style={{
              padding: isNarrow ? '0.5rem 1rem' : '0.625rem 1.25rem',
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: isNarrow ? '0.8125rem' : '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}>
            How?
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        maxWidth: '100%',
        overflowX: 'hidden'
      }}>
        {giftCategories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            style={{
              padding: '0.5rem 1rem',
              background: selectedCategory === category ? 'var(--primary)' : 'var(--gray-100)',
              color: selectedCategory === category ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s'
            }}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Gift Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isNarrow
          ? '1fr 1fr'
          : 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: isNarrow ? '0.75rem' : '1.5rem',
        maxWidth: '100%',
        overflowX: 'hidden'
      }}>
        {filteredGifts.map((gift) => (
          <div
            key={gift.id}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Image Placeholder */}
            <div style={{
              width: '100%',
              height: isNarrow ? '120px' : '200px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isNarrow ? '2.5rem' : '4rem'
            }}>
              🎁
            </div>

            {/* Content */}
            <div style={{ padding: isNarrow ? '0.75rem' : '1.5rem' }}>
              {/* Category Badge */}
              {!isNarrow && (
                <div style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  background: 'var(--gray-100)',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  marginBottom: '0.75rem'
                }}>
                  {gift.category}
                </div>
              )}

              <h3 style={{
                fontSize: isNarrow ? '0.875rem' : '1.125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.25rem'
              }}>
                {gift.name}
              </h3>

              {!isNarrow && (
                <>
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-tertiary)',
                    marginBottom: '0.5rem'
                  }}>
                    by {gift.partner}
                  </p>

                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1rem',
                    lineHeight: 1.5
                  }}>
                    {gift.description}
                  </p>
                </>
              )}

              {/* Price and Actions */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: isNarrow ? '0.5rem' : '1rem',
                borderTop: isNarrow ? 'none' : '1px solid var(--border)',
                flexWrap: isNarrow ? 'wrap' : 'nowrap',
                gap: '0.5rem'
              }}>
                <div>
                  <span style={{
                    fontSize: isNarrow ? '1rem' : '1.5rem',
                    fontWeight: 700,
                    color: 'var(--primary)'
                  }}>
                    ${gift.price}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!isNarrow && (
                    <button
                      style={{
                        padding: '0.5rem',
                        background: 'var(--gray-100)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--gray-200)';
                        e.currentTarget.style.color = 'var(--accent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--gray-100)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      <Heart size={20} />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleAddToCart(gift, e)}
                    style={{
                      padding: isNarrow ? '0.375rem 0.75rem' : '0.5rem 1.25rem',
                      background: addedItems.has(gift.id) ? '#22c55e' : 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: 600,
                      fontSize: isNarrow ? '0.75rem' : '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    {addedItems.has(gift.id) ? (
                      <>
                        <Check size={isNarrow ? 14 : 18} />
                        {isNarrow ? '✓' : 'Added!'}
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={isNarrow ? 14 : 18} />
                        {isNarrow ? 'Add' : 'Add to Cart'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QR Cash Gift Modal */}
      <QRCashGiftModal
        isOpen={showQRCashModal}
        onClose={() => setShowQRCashModal(false)}
      />

      {/* How QR Cash Works Modal */}
      {showHowItWorksModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowHowItWorksModal(false)}
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
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto',
            zIndex: 1000,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              padding: '1.5rem',
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  margin: 0,
                  marginBottom: '0.25rem',
                  color: 'white'
                }}>How QR Cash Works</h2>
                <p style={{
                  fontSize: '0.875rem',
                  opacity: 0.9,
                  margin: 0,
                  color: 'white'
                }}>Send · Scan · Spend</p>
              </div>
              <button
                onClick={() => setShowHowItWorksModal(false)}
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
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              <p style={{
                fontSize: '1rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                marginBottom: '2rem',
                textAlign: 'center'
              }}>
                QR Cash lets you send real money as a gift that recipients can spend anywhere. It's simple, personal, and universally appreciated.
              </p>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Step 1 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(251, 191, 36, 0.2)'
                }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    flexShrink: 0
                  }}>
                    1
                  </div>
                  <div>
                    <h4 style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.25rem'
                    }}>Send</h4>
                    <p style={{
                      fontSize: '0.9375rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      margin: 0
                    }}>
                      Choose an amount to gift and add it to any greeting. A unique QR code is generated for your recipient.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.05) 100%)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(102, 126, 234, 0.2)'
                }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    flexShrink: 0
                  }}>
                    2
                  </div>
                  <div>
                    <h4 style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.25rem'
                    }}>Scan</h4>
                    <p style={{
                      fontSize: '0.9375rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      margin: 0
                    }}>
                      The recipient receives the QR Cash via email or as a printed gift. They simply scan the QR code with their phone camera to open the redemption page and claim their cash gift.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.05) 100%)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(34, 197, 94, 0.2)'
                }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    flexShrink: 0
                  }}>
                    3
                  </div>
                  <div>
                    <h4 style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.25rem'
                    }}>Spend</h4>
                    <p style={{
                      fontSize: '0.9375rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      margin: 0
                    }}>
                      The cash is instantly available to spend anywhere. No restrictions, no gift cards - just real money they can use however they'd like.
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => {
                  setShowHowItWorksModal(false);
                  setShowQRCashModal(true);
                }}
                style={{
                  width: '100%',
                  marginTop: '2rem',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
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
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.3)';
                }}
              >
                <DollarSign size={20} />
                Send QR Cash Now
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
