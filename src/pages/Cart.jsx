// src/pages/Cart.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, ArrowLeft, CreditCard, ShoppingBag, Package, Gift, Mail, Check } from 'lucide-react';
import cartService from '../services/cartService';

export default function Cart() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 768);

  // G1G1 Gift Subscription State
  const [g1g1RecipientName, setG1G1RecipientName] = useState('');
  const [g1g1RecipientEmail, setG1G1RecipientEmail] = useState('');
  const [receiveGiftLinkViaEmail, setReceiveGiftLinkViaEmail] = useState(false);

  // Check if cart has a subscription (eligible for G1G1)
  const hasSubscription = cartItems.some(item => item.type === 'subscription');

  // Referral credit disqualifies G1G1
  const hasReferralCredit = !!(localStorage.getItem('greetme_referral_code'));
  const g1g1Eligible = hasSubscription && !hasReferralCredit;

  useEffect(() => {
    loadCart();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadCart = () => {
    const items = cartService.getCart();
    setCartItems(items);
    setTotal(cartService.getTotal());
  };

  const handleRemoveItem = (itemId) => {
    cartService.removeItem(itemId);
    loadCart();
    window.dispatchEvent(new Event('cartUpdated'));
  };

  const handleClearCart = () => {
    if (window.confirm('Are you sure you want to clear your cart?')) {
      cartService.clear();
      loadCart();
      window.dispatchEvent(new Event('cartUpdated'));
    }
  };

  const handleCheckout = () => {
    navigate('/dashboard/checkout');
  };

  // Empty cart state
  if (cartItems.length === 0) {
    return (
      <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: isNarrow ? '1.5rem' : '2rem',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          <ShoppingCart size={48} style={{ color: 'white', marginBottom: '1rem' }} />
          <h1 style={{
            fontSize: isNarrow ? '1.5rem' : '2rem',
            fontWeight: 700,
            color: 'white',
            margin: 0,
            marginBottom: '0.5rem'
          }}>Your Shopping Cart</h1>
          <p style={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '1rem'
          }}>is currently empty</p>
        </div>

        {/* Empty State Card */}
        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-xl)',
          padding: isNarrow ? '2rem 1.5rem' : '3rem',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <Package size={64} style={{ color: 'var(--text-tertiary)', marginBottom: '1.5rem' }} />
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '0.75rem'
          }}>No items in your cart yet</h2>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            maxWidth: '400px',
            margin: '0 auto 2rem'
          }}>
            Browse our curated selection of gifts and merchandise to find the perfect items for your loved ones.
          </p>
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => navigate('/dashboard/gifts')}
              style={{
                padding: '0.875rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
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
              <ShoppingBag size={18} />
              Browse Gifts
            </button>
            <button
              onClick={() => navigate('/dashboard/merch')}
              style={{
                padding: '0.875rem 1.5rem',
                background: 'white',
                color: '#667eea',
                border: '2px solid #667eea',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f5f3ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
              }}
            >
              Shop Merch
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Cart with items
  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden', padding: '0 1rem' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShoppingCart size={24} style={{ color: 'white' }} />
          <div>
            <h1 style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: 'white',
              margin: 0
            }}>Shopping Cart</h1>
            <p style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '0.75rem',
              margin: 0
            }}>{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} ready for checkout</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/dashboard/gifts')}
          style={{
            padding: '0.375rem 0.75rem',
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          <ArrowLeft size={12} />
          Continue Shopping
        </button>
      </div>

      {/* Main Content - Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? '1fr' : '1fr 170px',
        gap: '0.5rem'
      }}>
        {/* Cart Items Column */}
        <div>
          {/* Items Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem'
          }}>
            <h2 style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0
            }}>Your Items</h2>
            <button
              onClick={handleClearCart}
              style={{
                padding: '0.25rem 0.5rem',
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.6875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fef2f2';
                e.currentTarget.style.borderColor = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = '#fecaca';
              }}
            >
              Clear All
            </button>
          </div>

          {/* Items List */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)',
            overflow: 'hidden'
          }}>
            {cartItems.map((item, index) => (
              <div
                key={item.id}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderBottom: (index < cartItems.length - 1 || hasSubscription) ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {/* Item Icon */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  flexShrink: 0
                }}>
                  {item.icon || '🎁'}
                </div>

                {/* Item Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>{item.name || 'Gift Item'}</h3>
                  {item.category && (
                    <span style={{
                      fontSize: '0.5625rem',
                      fontWeight: 500,
                      color: 'var(--text-tertiary)'
                    }}>{item.category}</span>
                  )}
                </div>

                {/* Price & Remove */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  flexShrink: 0
                }}>
                  <div style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: '#667eea'
                  }}>
                    ${typeof item.price === 'number' ? item.price.toFixed(2) : '0.00'}
                  </div>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    style={{
                      padding: '0.125rem',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fef2f2';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-tertiary)';
                    }}
                    title="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* G1G1 Free Gift Subscription Item - shows when cart has a subscription */}
            {hasSubscription && hasReferralCredit && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(156, 163, 175, 0.08)'
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  flexShrink: 0,
                  opacity: 0.5
                }}>
                  🎁
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#6b7280',
                    marginBottom: '0',
                  }}>Greet One, Give One&trade;</h3>
                  <span style={{
                    fontSize: '0.5625rem',
                    fontWeight: 500,
                    color: '#9ca3af'
                  }}>Not included with discounted purchases</span>
                </div>
              </div>
            )}
            {g1g1Eligible && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%)'
                }}
              >
                {/* Gift Icon */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  flexShrink: 0
                }}>
                  🎁
                </div>

                {/* Item Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#059669',
                    marginBottom: '0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>G1G1 Gift Subscription</h3>
                  <span style={{
                    fontSize: '0.5625rem',
                    fontWeight: 500,
                    color: '#10b981'
                  }}>1-Year Gift for Someone Special</span>
                </div>

                {/* Price - FREE */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  flexShrink: 0
                }}>
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    color: 'var(--text-tertiary)',
                    textDecoration: 'line-through'
                  }}>
                    ${cartItems.find(item => item.type === 'subscription')?.price?.toFixed(2) || '19.99'}
                  </span>
                  <div style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.15)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    FREE
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* G1G1 Gift Subscription Section - Only show if cart has a subscription */}
          {hasSubscription && hasReferralCredit && (
            <div style={{
              marginTop: '1rem',
              background: 'rgba(156, 163, 175, 0.06)',
              borderRadius: 'var(--radius-xl)',
              border: '2px solid var(--border)',
              overflow: 'hidden',
              padding: '1rem',
              textAlign: 'center',
            }}>
              <Gift size={18} style={{ color: '#9ca3af', marginBottom: '0.5rem' }} />
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#6b7280', margin: '0 0 0.375rem' }}>
                Greet One, Give One&trade;
              </h3>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>
                Greet One, Give One&trade; is awarded with full memberships and is not included with discounted purchases.
              </p>
            </div>
          )}
          {g1g1Eligible && (
            <div style={{
              marginTop: '1rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)',
              borderRadius: 'var(--radius-xl)',
              border: '2px solid #10b981',
              overflow: 'hidden'
            }}>
              {/* G1G1 Header */}
              <div style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Gift size={18} style={{ color: 'white' }} />
                <div>
                  <h3 style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: 'white',
                    margin: 0
                  }}>Greet One, Give One&trade;</h3>
                  <p style={{
                    fontSize: '0.6875rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    margin: 0
                  }}>Your subscription includes a free gift subscription!</p>
                </div>
              </div>

              {/* G1G1 Content */}
              <div style={{ padding: '1rem' }}>
                {/* Checkbox for receiving link via email */}
                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  background: receiveGiftLinkViaEmail ? 'rgba(102, 126, 234, 0.1)' : 'white',
                  borderRadius: 'var(--radius-lg)',
                  border: receiveGiftLinkViaEmail ? '2px solid #667eea' : '2px solid var(--border)',
                  transition: 'all 0.2s'
                }}>
                  <div style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    borderRadius: '4px',
                    border: receiveGiftLinkViaEmail ? '2px solid #667eea' : '2px solid var(--border)',
                    background: receiveGiftLinkViaEmail ? '#667eea' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                    transition: 'all 0.2s'
                  }}>
                    {receiveGiftLinkViaEmail && <Check size={14} style={{ color: 'white' }} />}
                  </div>
                  <input
                    type="checkbox"
                    checked={receiveGiftLinkViaEmail}
                    onChange={(e) => setReceiveGiftLinkViaEmail(e.target.checked)}
                    style={{ display: 'none' }}
                  />
                  <div>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '0.125rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem'
                    }}>
                      <Mail size={14} />
                      Receive gift link via email
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      We'll send you a shareable link to give whenever you're ready
                    </div>
                  </div>
                </label>

                {/* Recipient Fields - disabled when checkbox is checked */}
                <div style={{
                  opacity: receiveGiftLinkViaEmail ? 0.5 : 1,
                  pointerEvents: receiveGiftLinkViaEmail ? 'none' : 'auto',
                  transition: 'opacity 0.2s'
                }}>
                  <p style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem'
                  }}>
                    <Gift size={14} style={{ color: '#10b981' }} />
                    Or designate a recipient now:
                  </p>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: isNarrow ? 'wrap' : 'nowrap' }}>
                    <div style={{ flex: 1, minWidth: isNarrow ? '100%' : '150px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginBottom: '0.25rem'
                      }}>
                        Recipient's Name
                      </label>
                      <input
                        type="text"
                        value={g1g1RecipientName}
                        onChange={(e) => setG1G1RecipientName(e.target.value)}
                        placeholder="Enter their name"
                        disabled={receiveGiftLinkViaEmail}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          border: '2px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.8125rem',
                          fontFamily: 'inherit',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          boxSizing: 'border-box',
                          background: receiveGiftLinkViaEmail ? 'var(--gray-100)' : 'white'
                        }}
                        onFocus={(e) => !receiveGiftLinkViaEmail && (e.target.style.borderColor = '#10b981')}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: isNarrow ? '100%' : '200px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginBottom: '0.25rem'
                      }}>
                        Recipient's Email
                      </label>
                      <input
                        type="email"
                        value={g1g1RecipientEmail}
                        onChange={(e) => setG1G1RecipientEmail(e.target.value)}
                        placeholder="Enter their email"
                        disabled={receiveGiftLinkViaEmail}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          border: '2px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.8125rem',
                          fontFamily: 'inherit',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          boxSizing: 'border-box',
                          background: receiveGiftLinkViaEmail ? 'var(--gray-100)' : 'white'
                        }}
                        onFocus={(e) => !receiveGiftLinkViaEmail && (e.target.style.borderColor = '#10b981')}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary Column */}
        <div>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            position: isNarrow ? 'static' : 'sticky',
            top: '1rem'
          }}>
            {/* Summary Header */}
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              padding: '0.375rem 0.5rem',
              borderBottom: '1px solid var(--border)'
            }}>
              <h2 style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0
              }}>Summary</h2>
            </div>

            {/* Summary Content — normalized pricing structure */}
            <div style={{ padding: '0.375rem' }}>
              {(() => {
                const subscriptionItem = cartItems.find(item => item.type === 'subscription');
                const planPrice = subscriptionItem?.price || total;
                // Only referral credits create actual Stripe coupons — courtesy credits are informational
                const rawCredit = hasReferralCredit ? 10 : 0;
                const creditEligible = subscriptionItem?.planTier !== 'close_circle';
                const creditAmt = creditEligible ? rawCredit : 0;
                const techFee = 4.99;

                return (
                  <div style={{ marginBottom: '0.25rem' }}>
                    {/* Plan */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.125rem', fontSize: '0.5625rem', color: 'var(--text-secondary)' }}>
                      <span>{subscriptionItem?.name || 'Subscription'}</span>
                      <span>${planPrice.toFixed(2)}</span>
                    </div>

                    {/* G1G1 Gift Subscription (full value) */}
                    {g1g1Eligible && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.125rem', fontSize: '0.5625rem', color: 'var(--text-secondary)' }}>
                        <span>G1G1 Gift Subscription</span>
                        <span>${planPrice.toFixed(2)}</span>
                      </div>
                    )}

                    {/* G1G1 Discount (negative) */}
                    {g1g1Eligible && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.125rem', fontSize: '0.5625rem', color: '#22c55e', fontWeight: 600 }}>
                        <span>G1G1 Discount</span>
                        <span>&ndash;${planPrice.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Referral Credit (Stripe coupon — real deduction) */}
                    {rawCredit > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.125rem', fontSize: '0.5625rem', color: creditEligible ? '#22c55e' : '#9ca3af', fontWeight: 600, fontStyle: creditEligible ? 'normal' : 'italic' }}>
                        <span>Referral Credit</span>
                        <span>{creditEligible ? `\u2013$${rawCredit.toFixed(2)}` : 'Not eligible for this plan'}</span>
                      </div>
                    )}

                    {/* One-Time Technology Fee */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.125rem', fontSize: '0.5625rem', color: 'var(--text-secondary)' }}>
                      <span>One-Time Technology Fee</span>
                      <span>${techFee.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Total */}
              {(() => {
                const subscriptionItem = cartItems.find(item => item.type === 'subscription');
                const planPrice = subscriptionItem?.price || total;
                // Only referral credits create Stripe coupons
                const rawCredit = hasReferralCredit ? 10 : 0;
                const creditEligible = subscriptionItem?.planTier !== 'close_circle';
                const creditAmt = creditEligible ? rawCredit : 0;
                const finalTotal = Math.max(0, planPrice + 4.99 - creditAmt);
                return (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.25rem', marginBottom: '0.375rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#667eea' }}>${finalTotal.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                style={{
                  width: '100%',
                  padding: '0.375rem',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 6px rgba(34, 197, 94, 0.3)',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 10px rgba(34, 197, 94, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(34, 197, 94, 0.3)';
                }}
              >
                <CreditCard size={12} />
                Checkout
              </button>
            </div>
          </div>

          {/* Continue Shopping Link - Mobile */}
          {isNarrow && (
            <button
              onClick={() => navigate('/dashboard/gifts')}
              style={{
                width: '100%',
                marginTop: '1rem',
                padding: '0.875rem',
                background: 'white',
                color: '#667eea',
                border: '2px solid #667eea',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <ShoppingBag size={18} />
              Continue Shopping
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
