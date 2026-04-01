// src/pages/Checkout.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreditCard, Lock, ArrowLeft, CheckCircle, ShoppingBag, Truck, Shield } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import cartService from '../services/cartService';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { getErrorMessage } from '../utils/errorMessages';
import { getCurrentPriceMap } from '../config/plans';

// TODO: VITE_STRIPE_PUBLISHABLE_KEY must be set in .env before Stripe checkout is functional
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);

  // Referral credit from URL or localStorage
  const referralCode = new URLSearchParams(location.search).get('referral')
    || localStorage.getItem('greetme_referral_code')
    || null;

  // Credit amount for display (referral = up to $10, courtesy = $5)
  const courtesyCredit = (() => {
    try {
      const stored = localStorage.getItem('greetme_courtesy_credit');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  })();
  const creditAmount = referralCode ? 10 : (courtesyCredit?.amount || 0);

  const [total, setTotal] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 768);

  // Form state
  const [formData, setFormData] = useState({
    email: user?.email || '',
    firstName: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    nameOnCard: ''
  });

  const [errors, setErrors] = useState({});

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
    if (items.length === 0) {
      navigate('/dashboard/cart');
      return;
    }
    setCartItems(items);
    setTotal(cartService.getTotal());
  };

  // Stripe Checkout — redirect to Stripe hosted checkout page
  const handleStripeCheckout = async () => {
    // Refresh stale cart priceIds against current plan definitions
    const priceMap = getCurrentPriceMap();
    const validatedItems = cartItems.map(item => {
      const current = priceMap[item.planId];
      if (current && item.priceId !== current.priceId) {
        console.warn(`CART_STALE: item "${item.planId}" had priceId "${item.priceId}", updated to "${current.priceId}"`);
        return { ...item, ...current };
      }
      return item;
    });

    const item = validatedItems.find(i => i.priceId);
    if (!item) {
      console.error('Cart items missing priceId:', validatedItems.map(i => ({ name: i.name, type: i.type, price: i.price, priceId: i.priceId })));
      setErrors({ submit: 'Payment configuration incomplete. No Stripe price ID found.' });
      return;
    }

    setIsProcessing(true);
    setErrors({});
    try {
      const data = await api.post('/api/payments/create-checkout', {
        priceId: item.priceId,
        purchaseType: item.purchaseType || 'subscription',
        quantity: item.quantity || 1,
        planTier: item.planTier,
        billingPeriod: item.billingPeriod || item.period,
        ...(referralCode && { referralCode }),
      });
      window.location.href = data.url;
    } catch (error) {
      console.error('Stripe checkout error:', error);
      setErrors({ submit: getErrorMessage(error) });
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    // Format card number with spaces
    if (name === 'cardNumber') {
      formattedValue = value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19);
    }

    // Format expiry date
    if (name === 'expiryDate') {
      formattedValue = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 5);
    }

    // Format CVV
    if (name === 'cvv') {
      formattedValue = value.replace(/\D/g, '').slice(0, 4);
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.address) newErrors.address = 'Address is required';
    if (!formData.city) newErrors.city = 'City is required';
    if (!formData.state) newErrors.state = 'State is required';
    if (!formData.zipCode) newErrors.zipCode = 'ZIP code is required';
    if (!formData.cardNumber || formData.cardNumber.replace(/\s/g, '').length < 16) {
      newErrors.cardNumber = 'Valid card number is required';
    }
    if (!formData.expiryDate || formData.expiryDate.length < 5) {
      newErrors.expiryDate = 'Valid expiry date is required';
    }
    if (!formData.cvv || formData.cvv.length < 3) {
      newErrors.cvv = 'Valid CVV is required';
    }
    if (!formData.nameOnCard) newErrors.nameOnCard = 'Name on card is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsProcessing(true);

    // Simulated payment processing (dev-only when Stripe is not configured)
    if (!import.meta.env.DEV || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
      setErrors({ submit: getErrorMessage({ code: 'SERVICE_UNAVAILABLE' }) });
      setIsProcessing(false);
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate order ID
      const newOrderId = `GM-${Date.now().toString(36).toUpperCase()}`;
      setOrderId(newOrderId);

      // Save order summary to localStorage (slim version - no large data)
      // In production, full order details would go to backend
      const orderSummary = {
        id: newOrderId,
        itemCount: cartItems.length,
        itemNames: cartItems.map(i => i.name).slice(0, 5), // Max 5 names
        total: total,
        email: formData.email,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };

      try {
        const existingOrders = JSON.parse(localStorage.getItem('greetme_orders') || '[]');
        existingOrders.push(orderSummary);
        // Keep only last 10 orders to prevent storage bloat
        const trimmedOrders = existingOrders.slice(-10);
        localStorage.setItem('greetme_orders', JSON.stringify(trimmedOrders));
      } catch (e) {
        // If storage fails, continue silently - order is still confirmed
        console.warn('Could not save order to localStorage:', e);
      }

      // Clear cart
      cartService.clear();
      window.dispatchEvent(new Event('cartUpdated'));

      setOrderComplete(true);
    } catch (error) {
      setErrors({ submit: 'Payment failed. Please try again.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Order confirmation screen
  if (orderComplete) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1rem', textAlign: 'center' }}>
        <div style={{
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          borderRadius: '50%',
          width: '80px',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem'
        }}>
          <CheckCircle size={40} style={{ color: 'white' }} />
        </div>

        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem'
        }}>Order Confirmed!</h1>

        <p style={{
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem'
        }}>Thank you for your purchase</p>

        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem'
          }}>Order Number</p>
          <p style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#667eea',
            fontFamily: 'monospace'
          }}>{orderId}</p>
        </div>

        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          marginBottom: '2rem'
        }}>
          A confirmation email has been sent to <strong>{formData.email}</strong>
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '0.875rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate('/dashboard/gifts')}
            style={{
              padding: '0.875rem 1.5rem',
              background: 'white',
              color: '#667eea',
              border: '2px solid #667eea',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '0.375rem'
  };

  const errorStyle = {
    fontSize: '0.6875rem',
    color: '#ef4444',
    marginTop: '0.25rem'
  };

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <button
          onClick={() => navigate('/dashboard/cart')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          <ArrowLeft size={16} />
          Back to Cart
        </button>
      </div>

      <h1 style={{
        fontSize: isNarrow ? '1.5rem' : '1.75rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '0.5rem'
      }}>Checkout</h1>
      <p style={{
        color: 'var(--text-secondary)',
        marginBottom: '2rem'
      }}>Complete your purchase securely</p>

      {/* Trust badges */}
      <div style={{
        display: 'flex',
        gap: '1.5rem',
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
          <Lock size={14} style={{ color: '#22c55e' }} />
          <span>Secure Checkout</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
          <Truck size={14} style={{ color: '#22c55e' }} />
          <span>Free Shipping</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
          <Shield size={14} style={{ color: '#22c55e' }} />
          <span>Money-Back Guarantee</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isNarrow ? '1fr' : '1fr 350px',
          gap: '2rem'
        }}>
          {/* Left Column - Form */}
          <div>
            {/* Contact Information */}
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '1rem'
              }}>Contact Information</h2>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  style={{ ...inputStyle, borderColor: errors.email ? '#ef4444' : 'var(--border)' }}
                  placeholder="your@email.com"
                />
                {errors.email && <p style={errorStyle}>{errors.email}</p>}
              </div>
            </div>

            {/* Shipping Address */}
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '1rem'
              }}>Shipping Address</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    style={{ ...inputStyle, borderColor: errors.firstName ? '#ef4444' : 'var(--border)' }}
                  />
                  {errors.firstName && <p style={errorStyle}>{errors.firstName}</p>}
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    style={{ ...inputStyle, borderColor: errors.lastName ? '#ef4444' : 'var(--border)' }}
                  />
                  {errors.lastName && <p style={errorStyle}>{errors.lastName}</p>}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  style={{ ...inputStyle, borderColor: errors.address ? '#ef4444' : 'var(--border)' }}
                  placeholder="123 Main Street"
                />
                {errors.address && <p style={errorStyle}>{errors.address}</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    style={{ ...inputStyle, borderColor: errors.city ? '#ef4444' : 'var(--border)' }}
                  />
                  {errors.city && <p style={errorStyle}>{errors.city}</p>}
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    style={{ ...inputStyle, borderColor: errors.state ? '#ef4444' : 'var(--border)' }}
                    placeholder="CA"
                  />
                  {errors.state && <p style={errorStyle}>{errors.state}</p>}
                </div>
                <div>
                  <label style={labelStyle}>ZIP Code</label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleInputChange}
                    style={{ ...inputStyle, borderColor: errors.zipCode ? '#ef4444' : 'var(--border)' }}
                  />
                  {errors.zipCode && <p style={errorStyle}>{errors.zipCode}</p>}
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <CreditCard size={18} style={{ color: '#667eea' }} />
                <h2 style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0
                }}>Payment Information</h2>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Card Number</label>
                <input
                  type="text"
                  name="cardNumber"
                  value={formData.cardNumber}
                  onChange={handleInputChange}
                  style={{ ...inputStyle, borderColor: errors.cardNumber ? '#ef4444' : 'var(--border)' }}
                  placeholder="1234 5678 9012 3456"
                />
                {errors.cardNumber && <p style={errorStyle}>{errors.cardNumber}</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Expiry Date</label>
                  <input
                    type="text"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleInputChange}
                    style={{ ...inputStyle, borderColor: errors.expiryDate ? '#ef4444' : 'var(--border)' }}
                    placeholder="MM/YY"
                  />
                  {errors.expiryDate && <p style={errorStyle}>{errors.expiryDate}</p>}
                </div>
                <div>
                  <label style={labelStyle}>CVV</label>
                  <input
                    type="text"
                    name="cvv"
                    value={formData.cvv}
                    onChange={handleInputChange}
                    style={{ ...inputStyle, borderColor: errors.cvv ? '#ef4444' : 'var(--border)' }}
                    placeholder="123"
                  />
                  {errors.cvv && <p style={errorStyle}>{errors.cvv}</p>}
                </div>
                <div></div>
              </div>

              <div>
                <label style={labelStyle}>Name on Card</label>
                <input
                  type="text"
                  name="nameOnCard"
                  value={formData.nameOnCard}
                  onChange={handleInputChange}
                  style={{ ...inputStyle, borderColor: errors.nameOnCard ? '#ef4444' : 'var(--border)' }}
                />
                {errors.nameOnCard && <p style={errorStyle}>{errors.nameOnCard}</p>}
              </div>
            </div>

            {errors.submit && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                color: '#ef4444',
                fontSize: '0.875rem'
              }}>
                {errors.submit}
              </div>
            )}
          </div>

          {/* Right Column - Order Summary */}
          <div>
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              position: isNarrow ? 'static' : 'sticky',
              top: '1rem'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '1rem 1.25rem',
                color: 'white'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingBag size={18} />
                  <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Order Summary</h2>
                </div>
              </div>

              <div style={{ padding: '1.25rem' }}>
                {/* Items */}
                <div style={{ marginBottom: '1rem' }}>
                  {cartItems.map((item, index) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingBottom: index < cartItems.length - 1 ? '0.75rem' : 0,
                        marginBottom: index < cartItems.length - 1 ? '0.75rem' : 0,
                        borderBottom: index < cartItems.length - 1 ? '1px solid var(--border)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>{item.icon || '🎁'}</span>
                        <div>
                          <p style={{
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            margin: 0
                          }}>{item.name}</p>
                          {item.category && (
                            <p style={{
                              fontSize: '0.6875rem',
                              color: 'var(--text-tertiary)',
                              margin: 0
                            }}>{item.category}</p>
                          )}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                      }}>${item.price?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '1rem'
                }}>
                  {/* Subtotal */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <span>Subtotal</span>
                    <span>${total.toFixed(2)}</span>
                  </div>

                  {/* Processing & Delivery Fee — included in plan price */}
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)'
                    }}>
                      <span>Processing &amp; Delivery</span>
                      <span style={{ color: '#22c55e', fontWeight: 500 }}>Included</span>
                    </div>
                    <p style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-tertiary)',
                      margin: '0.125rem 0 0',
                      fontStyle: 'italic',
                    }}>
                      Delivery for both you and your gift recipient is included in your plan
                    </p>
                  </div>

                  {/* Shipping */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <span>Shipping</span>
                    <span style={{ color: '#22c55e', fontWeight: 500 }}>FREE</span>
                  </div>

                  {/* Tax */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <span>Tax</span>
                    <span>$0.00</span>
                  </div>

                  {/* Greet-Me Credit (if any) */}
                  {creditAmount > 0 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      color: '#22c55e',
                      fontWeight: 500,
                    }}>
                      <span>Greet-Me Credit</span>
                      <span>&ndash;${creditAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Total — matches actual Stripe charge (plan price minus credit) */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border)',
                    fontSize: '1.125rem',
                    fontWeight: 700
                  }}>
                    <span>Total</span>
                    <span style={{ color: '#667eea' }}>
                      ${Math.max(0, total - creditAmount).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Submit Button — calls Stripe Checkout (not form submit) */}
                <button
                  type="button"
                  onClick={handleStripeCheckout}
                  disabled={isProcessing}
                  style={{
                    width: '100%',
                    marginTop: '1.5rem',
                    padding: '1rem',
                    background: isProcessing
                      ? '#e5e7eb'
                      : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    color: isProcessing ? '#9ca3af' : 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    boxShadow: isProcessing ? 'none' : '0 4px 12px rgba(34, 197, 94, 0.3)',
                    fontFamily: 'inherit'
                  }}
                >
                  {isProcessing ? (
                    <>
                      <div style={{
                        width: '18px',
                        height: '18px',
                        border: '2px solid #9ca3af',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lock size={18} />
                      Complete Order
                    </>
                  )}
                </button>

                <p style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                  marginTop: '1rem'
                }}>
                  Your payment information is encrypted and secure
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
