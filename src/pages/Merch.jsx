// src/pages/Merch.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Briefcase, Users, Check, ArrowLeft } from 'lucide-react';
import cartService from '../services/cartService';
import AddToCartModal from '../components/AddToCartModal';
import greetmeFlags from '../assets/greetme-flags.jpg';

const merchItems = [
  {
    id: 1,
    name: 'Greet-Me Premium T-Shirt',
    price: 29.99,
    description: 'Soft cotton tee with signature logo',
    category: 'Apparel',
    colors: ['Black', 'White', 'Navy'],
    whiteLabel: true
  },
  {
    id: 2,
    name: 'Stainless Steel Travel Mug',
    price: 24.99,
    description: 'Insulated 16oz mug keeps drinks hot or cold',
    category: 'Drinkware',
    colors: ['Silver', 'Black', 'Rose Gold'],
    whiteLabel: true
  },
  {
    id: 3,
    name: 'Premium Notebook Set',
    price: 19.99,
    description: 'Set of 3 quality notebooks with branded covers',
    category: 'Stationery',
    colors: ['Assorted'],
    whiteLabel: true
  },
  {
    id: 4,
    name: 'Classic Baseball Cap',
    price: 22.99,
    description: 'Adjustable cotton cap with embroidered logo',
    category: 'Apparel',
    colors: ['Black', 'Navy', 'Khaki'],
    whiteLabel: true
  },
  {
    id: 5,
    name: 'Cozy Hoodie',
    price: 49.99,
    description: 'Premium fleece hoodie with front pocket',
    category: 'Apparel',
    colors: ['Gray', 'Black', 'Navy'],
    whiteLabel: true
  },
  {
    id: 6,
    name: 'Sticker Pack',
    price: 9.99,
    description: 'Set of 10 premium die-cut stickers',
    category: 'Accessories',
    colors: ['Multi-color'],
    whiteLabel: false
  },
  {
    id: 7,
    name: 'Wireless Phone Charger',
    price: 34.99,
    description: 'Fast-charging pad with LED indicator',
    category: 'Tech',
    colors: ['Black', 'White'],
    whiteLabel: true
  },
  {
    id: 8,
    name: 'Canvas Tote Bag',
    price: 16.99,
    description: 'Eco-friendly canvas bag with reinforced handles',
    category: 'Accessories',
    colors: ['Natural', 'Black'],
    whiteLabel: true
  },
  {
    id: 9,
    name: 'Desk Organizer',
    price: 27.99,
    description: 'Bamboo desk organizer with multiple compartments',
    category: 'Office',
    colors: ['Natural Wood'],
    whiteLabel: true
  },
  {
    id: 10,
    name: 'Premium Pen Set',
    price: 39.99,
    description: 'Set of 2 luxury ballpoint pens in gift box',
    category: 'Stationery',
    colors: ['Black', 'Silver'],
    whiteLabel: true
  }
];

// Get unique categories from merch items
const merchCategories = ['All', ...new Set(merchItems.map(item => item.category))];

export default function Merch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showCorporateModal, setShowCorporateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 420);
  const [addedItems, setAddedItems] = useState(new Set());
  const [showCartModal, setShowCartModal] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState(null);

  // Check if user came from recipient form (has category param or returnRecipientId)
  const returnRecipientId = searchParams.get('returnRecipientId');
  const cameFromRecipientForm = searchParams.has('category') || !!returnRecipientId;

  // Check if user came from SendGreeting page (Just Because)
  const returnTo = searchParams.get('returnTo');
  const giftType = searchParams.get('giftType');
  const cameFromSendGreeting = returnTo === 'send';

  // Handle category from URL query param
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      const categoryMap = {
        'merch': 'All',
        'apparel': 'Apparel',
        'drinkware': 'Drinkware',
        'accessories': 'Accessories',
        'stationery': 'Stationery'
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

  const handleAddToCart = (item, e) => {
    e.stopPropagation();
    try {
      cartService.addItem({
        merchId: item.id,
        name: item.name,
        price: item.price,
        description: item.description,
        category: item.category,
        icon: '🛍️'
      });

      // Show feedback
      setAddedItems(prev => new Set(prev).add(item.id));

      // Trigger cart count update
      window.dispatchEvent(new Event('cartUpdated'));

      // Store the added item and show the modal
      setLastAddedItem(item);
      setShowCartModal(true);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const handleContinueShopping = () => {
    setShowCartModal(false);
    // Remove the "Added" state after closing
    if (lastAddedItem) {
      setAddedItems(prev => {
        const next = new Set(prev);
        next.delete(lastAddedItem.id);
        return next;
      });
    }
    setLastAddedItem(null);
  };

  const handleGoToCheckout = () => {
    setShowCartModal(false);
    navigate('/dashboard/cart');
  };

  const handleReturnToRecipient = () => {
    setShowCartModal(false);
    if (returnRecipientId) {
      // Navigate to contacts with state to auto-open the edit modal
      navigate('/dashboard/contacts', { state: { openEditRecipientId: returnRecipientId } });
    } else {
      // Fallback: just go to contacts page
      navigate('/dashboard/contacts');
    }
  };

  const handleReturnToGreeting = () => {
    setShowCartModal(false);
    // Navigate back to SendGreeting page with params to reopen gift modal
    navigate('/dashboard/send?returnTo=send&giftType=merch');
  };

  // Filter items by category
  const filteredItems = selectedCategory === 'All'
    ? merchItems
    : merchItems.filter(item => item.category === selectedCategory);

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Recipient Gift Session Header - show when in recipient context */}
      {returnRecipientId && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(102, 126, 234, 0.05) 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(102, 126, 234, 0.2)',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>🎁</span>
            <span style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#667eea'
            }}>
              Shopping for Recipient
            </span>
          </div>
          <button
            onClick={handleReturnToRecipient}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s'
            }}
          >
            <ArrowLeft size={14} />
            Return to Recipient Settings
          </button>
        </div>
      )}

      {/* SendGreeting Session Header - show when coming from Just Because page */}
      {cameFromSendGreeting && !returnRecipientId && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(236, 72, 153, 0.2)',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>💝</span>
            <span style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#ec4899'
            }}>
              Shopping for Your Greeting
            </span>
          </div>
          <button
            onClick={handleReturnToGreeting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s'
            }}
          >
            <ArrowLeft size={14} />
            Return to Greeting
          </button>
        </div>
      )}

      {/* Background Frame for Page Body */}
      <div style={{
        background: '#f8fafc',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid #e2e8f0',
        padding: '2rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Banner Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem 1.5rem',
          marginBottom: '1.5rem',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}>
          <h1 style={{
            fontSize: isNarrow ? '1.25rem' : '1.5rem',
            fontWeight: 700,
            margin: 0,
            marginBottom: '0.375rem'
          }}>
            Greet-Me Merchandise
          </h1>
          <p style={{
            fontSize: '0.8125rem',
            opacity: 0.9,
            fontStyle: 'italic',
            margin: 0,
            marginBottom: '0.75rem'
          }}>
            Show your love for staying connected with branded merch while supporting American providers
          </p>
          {/* Crossed flags icon - above toggle inside banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <img
              src={greetmeFlags}
              alt="Greet-Me American Made"
              style={{
                height: isNarrow ? '50px' : '60px',
                width: 'auto',
                objectFit: 'contain'
              }}
            />
          </div>
          {/* Toggle centered - inside banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'center'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '9999px',
              padding: '0.25rem'
            }}>
              <button
                onClick={() => {
                  // Preserve returnRecipientId when toggling to Gifts
                  const giftsUrl = returnRecipientId
                    ? `/dashboard/gifts?returnRecipientId=${returnRecipientId}`
                    : '/dashboard/gifts';
                  navigate(giftsUrl);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  color: 'rgba(255, 255, 255, 0.8)',
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
                style={{
                  padding: '0.5rem 1rem',
                  background: 'white',
                  color: '#667eea',
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
        </div>

      {/* Corporate White Label Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem 1.5rem',
        marginBottom: '1.5rem',
        color: 'white',
        textAlign: 'center',
        boxShadow: '0 4px 12px rgba(30, 58, 138, 0.3)'
      }}>
        {/* Centered 10% donated badge */}
        <div style={{
          display: 'inline-block',
          background: 'rgba(0, 0, 0, 0.15)',
          padding: '0.375rem 0.75rem',
          borderRadius: 'var(--radius-lg)',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'white',
          marginBottom: '0.75rem'
        }}>
          🏅 10% donated
        </div>
        <h2 style={{
          fontSize: isNarrow ? '1.25rem' : '1.5rem',
          fontWeight: 700,
          margin: 0,
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <Briefcase size={isNarrow ? 20 : 24} />
          White Label Services
        </h2>
        <p style={{
          fontSize: '0.9375rem',
          opacity: 0.9,
          fontStyle: 'italic',
          margin: 0,
          marginBottom: '1rem'
        }}>
          Mission-driven, branded gifting for clients and teams
        </p>
        <button
          onClick={() => setShowCorporateModal(true)}
          style={{
            padding: '0.5rem 1.5rem',
            background: 'white',
            color: '#1e3a8a',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Users size={16} />
          Request Corporate Quote
        </button>
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
        {merchCategories.map((category) => (
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

      {/* Merch Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isNarrow
          ? '1fr 1fr'
          : 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: isNarrow ? '0.75rem' : '1.5rem',
        maxWidth: '100%',
        overflowX: 'hidden'
      }}>
        {filteredItems.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              position: 'relative'
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
            {/* White Label Badge */}
            {item.whiteLabel && (
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(30, 58, 138, 0.9)',
                color: 'white',
                padding: '0.375rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <Briefcase size={12} />
                White Label
              </div>
            )}

            {/* Image Placeholder */}
            <div style={{
              width: '100%',
              height: isNarrow ? '120px' : '200px',
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isNarrow ? '2.5rem' : '4rem'
            }}>
              🛍️
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
                  {item.category}
                </div>
              )}

              <h3 style={{
                fontSize: isNarrow ? '0.875rem' : '1.125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.25rem'
              }}>
                {item.name}
              </h3>

              {!isNarrow && (
                <p style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.75rem',
                  lineHeight: 1.5
                }}>
                  {item.description}
                </p>
              )}

              {/* Colors - hide on narrow */}
              {!isNarrow && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    marginBottom: '0.5rem'
                  }}>
                    Available Colors:
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {item.colors.map((color) => (
                      <span
                        key={color}
                        style={{
                          padding: '0.25rem 0.625rem',
                          background: 'var(--gray-100)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        {color}
                      </span>
                    ))}
                  </div>
                </div>
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
                    ${item.price}
                  </span>
                </div>
                <button
                  onClick={(e) => handleAddToCart(item, e)}
                  style={{
                    padding: isNarrow ? '0.375rem 0.75rem' : '0.5rem 1.25rem',
                    background: addedItems.has(item.id) ? '#22c55e' : 'var(--primary)',
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
                  {addedItems.has(item.id) ? (
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
        ))}
      </div>
      </div>
      {/* End Background Frame */}

      {/* Corporate Quote Modal */}
      {showCorporateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem'
          }}
          onClick={() => setShowCorporateModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xl)',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '1rem'
            }}>
              Request Corporate Quote
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem'
            }}>
              Fill out this form and our team will contact you within 24 hours with a custom quote for your white-label merchandise needs.
            </p>

            <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="text"
                placeholder="Company Name"
                style={{
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
              <input
                type="email"
                placeholder="Email Address"
                style={{
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
              <input
                type="tel"
                placeholder="Phone Number"
                style={{
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
              <select
                style={{
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  color: 'var(--text-primary)'
                }}
              >
                <option>Estimated Quantity...</option>
                <option>25-50 units</option>
                <option>50-100 units</option>
                <option>100-250 units</option>
                <option>250-500 units</option>
                <option>500+ units</option>
              </select>
              <textarea
                placeholder="Items of interest and any special requirements..."
                rows={4}
                style={{
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCorporateModal(false)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'var(--gray-100)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add to Cart Confirmation Modal */}
      <AddToCartModal
        isOpen={showCartModal}
        onClose={handleContinueShopping}
        item={lastAddedItem}
        onContinueShopping={handleContinueShopping}
        onGoToCheckout={handleGoToCheckout}
        onReturnToRecipient={returnRecipientId ? handleReturnToRecipient : (cameFromSendGreeting ? handleReturnToGreeting : null)}
        showReturnToRecipient={!!returnRecipientId || cameFromSendGreeting}
        returnToLabel={cameFromSendGreeting && !returnRecipientId ? "Return to Greeting" : "Return to Recipient Settings"}
      />
    </div>
  );
}
