// src/pages/Merch.jsx
import { useState, useEffect } from 'react';
import { ShoppingCart, Briefcase, Users } from 'lucide-react';

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
  const [showCorporateModal, setShowCorporateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 420);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 420);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter items by category
  const filteredItems = selectedCategory === 'All'
    ? merchItems
    : merchItems.filter(item => item.category === selectedCategory);

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
          Greet-Me Merchandise
        </h1>
        <p style={{
          fontSize: '1rem',
          color: 'var(--text-secondary)'
        }}>
          Show your love for staying connected with branded merch
        </p>
      </div>

      {/* Corporate White Label Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '2rem',
        marginBottom: '3rem',
        color: 'white'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '2rem',
          alignItems: 'center'
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}>
              <Briefcase size={32} />
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                margin: 0
              }}>
                Corporate White Label Program
              </h2>
            </div>
            <p style={{
              fontSize: '1.125rem',
              opacity: 0.95,
              marginBottom: '1rem',
              lineHeight: 1.6
            }}>
              Strengthen client relationships and boost employee morale with custom-branded Greet-Me merchandise.
              Add your company logo to any white-label eligible item.
            </p>
            <ul style={{
              fontSize: '1rem',
              opacity: 0.9,
              marginBottom: '1.5rem',
              paddingLeft: '1.5rem'
            }}>
              <li>Minimum order: 25 units per item</li>
              <li>Custom logo embroidery or printing included</li>
              <li>Bulk pricing available for 100+ units</li>
              <li>Perfect for client gifts and employee appreciation</li>
            </ul>
            <button
              onClick={() => setShowCorporateModal(true)}
              style={{
                padding: '0.875rem 2rem',
                background: 'white',
                color: '#1e3a8a',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Users size={20} />
              Request Corporate Quote
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
            🏢
          </div>
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
                  style={{
                    padding: isNarrow ? '0.375rem 0.75rem' : '0.5rem 1.25rem',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    fontSize: isNarrow ? '0.75rem' : '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <ShoppingCart size={isNarrow ? 14 : 18} />
                  {isNarrow ? 'Add' : 'Add to Cart'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

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
    </div>
  );
}
