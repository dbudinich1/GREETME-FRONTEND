// src/pages/Gifts.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Heart, Check } from 'lucide-react';
import cartService from '../services/cartService';

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
  const [addedItems, setAddedItems] = useState(new Set());
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 420);

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
      setTimeout(() => {
        setAddedItems(prev => {
          const next = new Set(prev);
          next.delete(gift.id);
          return next;
        });
      }, 2000);

      // Trigger cart count update
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add item to cart');
    }
  };

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem'
        }}>
          Gift Add-Ons
        </h1>
        <p style={{
          fontSize: '1rem',
          color: 'var(--text-secondary)'
        }}>
          Add a thoughtful gift from our 🇺🇸 American-Made Marketplace
        </p>
      </div>

      {/* Digital Cash Gift Option - Featured */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '2rem',
        marginBottom: '3rem',
        color: 'white',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '2rem',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: '0.75rem'
          }}>
            QR Cash™ — Send · Scan · Spend
          </h2>
          <p style={{
            fontSize: '1.125rem',
            opacity: 0.95,
            marginBottom: '1.5rem'
          }}>
            Add real cash to any greeting you send.
          </p>
          <button style={{
            padding: '0.875rem 2rem',
            background: 'white',
            color: '#667eea',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            Set Up Digital Cash
          </button>
        </div>
        <div style={{
          width: '8rem',
          height: '8rem',
          background: 'white',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '4rem'
        }}>
          💸
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
    </div>
  );
}
