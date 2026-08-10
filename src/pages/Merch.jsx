// src/pages/Merch.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Briefcase, Users, Check, ArrowLeft } from 'lucide-react';
import cartService from '../services/cartService';
import AddToCartModal from '../components/AddToCartModal';
import QRCashGiftModal from '../components/QRCashGiftModal';
import api from '../api/api';
import greetmeFlags from '../assets/greetme-flags.jpg';
import { readToken } from './fundraiser/attributionCarrier';
import { giftCtaState } from './fundraiser/giftCtaModel';

// AGP-01 — American Gift Place category layer. Only 'merch' is live/purchasable.
const AGP_CATEGORIES = [
  { key: 'merch', label: 'Greet-Me Merch', live: true },
  { key: 'maker_gifts', label: 'Maker Gifts', live: true }, // VENDOR-GIFTS-B1 (display-only)
  { key: 'americana', label: 'Americana', live: false },
  { key: 'gift_cards', label: 'Gift Cards', live: false },
  { key: 'gift_baskets', label: 'Gift Baskets', live: false },
  { key: 'flowers', label: 'Flowers', live: false },
  { key: 'faith', label: 'Faith & Inspiration', live: false },
];

// VENDOR-GIFTS-B1 — show "Made by <vendor>" maker attribution on catalog cards (configurable).
const SHOW_MAKER_ATTRIBUTION = true;

export default function Merch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showQRCashModal, setShowQRCashModal] = useState(false); // AGP-02
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 420);
  const [addedItems, setAddedItems] = useState(new Set());
  const [showCartModal, setShowCartModal] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState(null);
  const [pickerProduct, setPickerProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // VENDOR-GIFTS-B1 — read-only Collective catalog (display-only). Empty while dormant.
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('merch'); // AGP-01: default live category
  // TEAM D — Shopify gift CTA money-path. The fundraiser attribution token (if any) gates the CTA;
  // without it, Maker-Gift cards stay display-only ("Available soon"). Dormant-safe: the server
  // returns 503 while fundraiserEnabled=false, which giftCheckout maps to a fail-closed CTA state.
  const fundraiserToken = readToken();
  const [giftBusyId, setGiftBusyId] = useState(null);
  const [giftErrorId, setGiftErrorId] = useState(null);

  async function handleGiftCheckout(item) {
    const { showCta, variantId } = giftCtaState({ token: fundraiserToken, item });
    if (!showCta) return;
    setGiftErrorId(null);
    setGiftBusyId(item.id);
    try {
      const r = await api.giftCheckout({ token: fundraiserToken, variantId, quantity: 1 });
      if (r && r.ok === true && r.checkoutUrl) {
        window.location.href = r.checkoutUrl; // hand off to the Shopify-hosted cart
        return;
      }
      setGiftErrorId(item.id);
    } catch {
      setGiftErrorId(item.id);
    } finally {
      setGiftBusyId(null);
    }
  }

  // Session context: recipient gift flow vs SendGreeting Just-Because flow
  const returnRecipientId = searchParams.get('returnRecipientId');
  const returnTo = searchParams.get('returnTo');
  const cameFromSendGreeting = returnTo === 'send';

  // Fetch curated products from /api/merch/products on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.request('/api/merch/products');
        if (!cancelled) {
          setProducts(res?.products || []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // VENDOR-GIFTS-B1 — fetch the read-only Collective catalog on mount (returns empty while
  // the vendorGiftsEnabled flag is off). Display-only; no cart/checkout.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getGiftCatalog();
        if (!cancelled) setCatalogProducts(Array.isArray(res?.products) ? res.products : []);
      } catch {
        if (!cancelled) setCatalogProducts([]);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 420);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleAddToCart = (product, e) => {
    e.stopPropagation();

    // Mixed-cart block (founder refinement #9): merch ↔ subscription/G1G1
    if (cartService.hasNonMerch()) {
      alert(
        'Your cart already contains a subscription or other item. ' +
        'Please complete that purchase or clear your cart before adding merch.'
      );
      return;
    }

    if (!Array.isArray(product.variants) || product.variants.length === 0) {
      console.warn('Merch product missing variants', product);
      return;
    }

    if (product.variants.length === 1) {
      addVariantToCart(product, product.variants[0]);
    } else {
      setPickerProduct(product);
      setLastAddedItem(null);
      setShowCartModal(true);
    }
  };

  const addVariantToCart = (product, variant) => {
    try {
      cartService.addItem({
        printfulSyncProductId: product.syncProductId,
        printfulSyncVariantId: variant.syncVariantId,
        variantLabel: variant.label,
        name: `${product.name} — ${variant.label}`,
        price: variant.priceCents / 100,
        priceCents: variant.priceCents,
        category: 'Merch',
        icon: '🛍️',
      });
      setAddedItems((prev) => new Set(prev).add(product.syncProductId));
      window.dispatchEvent(new Event('cartUpdated'));
      setPickerProduct(null);
      setLastAddedItem({
        syncProductId: product.syncProductId,
        name: `${product.name} — ${variant.label}`,
        price: variant.priceCents / 100,
      });
      setShowCartModal(true);
    } catch (err) {
      console.error('Error adding to cart:', err);
    }
  };

  const handleVariantSelected = (variant) => {
    if (pickerProduct) addVariantToCart(pickerProduct, variant);
  };

  const handleContinueShopping = () => {
    setShowCartModal(false);
    setPickerProduct(null);
    if (lastAddedItem) {
      setAddedItems(prev => {
        const next = new Set(prev);
        next.delete(lastAddedItem.syncProductId);
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
      navigate('/dashboard/contacts', { state: { openEditRecipientId: returnRecipientId } });
    } else {
      navigate('/dashboard/contacts');
    }
  };

  const handleReturnToGreeting = () => {
    setShowCartModal(false);
    navigate('/dashboard/send?returnTo=send&giftType=merch');
  };

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
          padding: isNarrow ? '1.5rem 1.25rem' : '2rem 1.5rem',
          marginBottom: '1rem',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}>
          {/* AGP-04 — flag hero emblem (top of tile) */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}>
            <img
              src={greetmeFlags}
              alt="Greet-Me™ American Made"
              style={{
                height: isNarrow ? '100px' : '120px',
                width: 'auto',
                objectFit: 'contain'
              }}
            />
          </div>
          <h1 style={{
            fontSize: isNarrow ? '1.5rem' : '1.875rem',
            fontWeight: 700,
            margin: '0 0 0.5rem'
          }}>
            American Gift Place™
          </h1>
          <p style={{
            fontSize: isNarrow ? '0.9375rem' : '1rem',
            color: 'white',
            opacity: 1,
            fontWeight: 500,
            lineHeight: 1.5,
            margin: '0 auto',
            maxWidth: '520px',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.15)'
          }}>
            Supporting American businesses, veterans, and first responders through meaningful giving.
          </p>
        </div>

      {/* AGP-02 — QR Cash™ featured tile (mirrors dashboard QR Cash card) */}
      <div style={{
        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: isNarrow ? '1.5rem 1.25rem' : '2rem 1.5rem',
        color: 'white',
        boxShadow: '0 4px 12px rgba(251, 191, 36, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: isNarrow ? '1rem' : '1.125rem', fontWeight: 700, margin: 0 }}>QR Cash™</h3>
            <p style={{ fontSize: isNarrow ? '0.6875rem' : '0.75rem', opacity: 0.9, margin: '0.125rem 0 0', letterSpacing: '0.025em' }}>Send • Spend • Gift</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: isNarrow ? '1.25rem' : '1.5rem', fontWeight: 700, margin: 0 }}>$0.00</p>
          </div>
        </div>
        <button
          onClick={() => setShowQRCashModal(true)}
          style={{
            marginTop: '0.75rem',
            width: '100%',
            padding: '0.5rem 0.75rem',
            background: 'white',
            color: '#f59e0b',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: isNarrow ? '0.8125rem' : '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          Send QR Cash™
        </button>
      </div>

      {/* AGP-01 — Category selector (American Gift Place) */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '0 0 0.75rem',
        marginBottom: '1rem'
      }}>
        {AGP_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            style={{
              flexShrink: 0,
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              border: '1px solid var(--border)',
              background: selectedCategory === cat.key ? 'var(--primary)' : 'var(--bg-primary)',
              color: selectedCategory === cat.key ? 'white' : 'var(--text-secondary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {selectedCategory === 'maker_gifts' ? (
        /* VENDOR-GIFTS-B1 — Collective gifts: DISPLAY-ONLY (no cart/checkout/CTA), Greet-Me-native. */
        catalogLoading ? (
          <div style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.9375rem',
            fontStyle: 'italic'
          }}>
            Loading…
          </div>
        ) : catalogProducts.length === 0 ? (
          <div style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-xl)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>&#127873;</div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
              Maker Gifts &mdash; Coming Soon
            </h3>
            <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
              We&rsquo;re curating this collection. Check back soon.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: isNarrow ? '0.75rem' : '1.5rem',
            maxWidth: '100%',
            overflowX: 'hidden'
          }}>
            {catalogProducts.map((item) => {
              const img = (Array.isArray(item.images) && item.images[0]?.url) ? item.images[0].url : null;
              const dollars = item.priceCents != null
                ? `$${(item.priceCents / 100).toFixed(item.priceCents % 100 === 0 ? 0 : 2)}`
                : '';
              return (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                >
                  {/* Product image — Greet-Me blob (re-hosted) URL with gradient fallback. No Shopify domain. */}
                  <div style={{
                    width: '100%',
                    height: isNarrow ? '120px' : '200px',
                    background: img ? `url(${img}) center/cover no-repeat` : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isNarrow ? '2.5rem' : '4rem'
                  }}>
                    {!img && '🎁'}
                  </div>
                  <div style={{ padding: isNarrow ? '0.75rem' : '1.5rem' }}>
                    <h3 style={{
                      fontSize: isNarrow ? '0.875rem' : '1.125rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '0.25rem'
                    }}>
                      {item.title}
                    </h3>
                    {SHOW_MAKER_ATTRIBUTION && item.vendor ? (
                      <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                        fontStyle: 'italic',
                        marginBottom: '0.5rem'
                      }}>
                        Made by {item.vendor}
                      </p>
                    ) : null}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: isNarrow ? '0.5rem' : '1rem',
                      borderTop: isNarrow ? 'none' : '1px solid var(--border)',
                      gap: '0.5rem'
                    }}>
                      <span style={{
                        fontSize: isNarrow ? '1rem' : '1.5rem',
                        fontWeight: 700,
                        color: 'var(--primary)'
                      }}>
                        {dollars}
                      </span>
                      {/* TEAM D — Shopify gift CTA: shown ONLY with a fundraiser attribution token
                          AND a giftable variant; otherwise stays display-only ("Available soon"). */}
                      {giftCtaState({ token: fundraiserToken, item }).showCta ? (
                        <button
                          type="button"
                          onClick={() => handleGiftCheckout(item)}
                          disabled={giftBusyId === item.id}
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            color: '#fffdf8',
                            background: giftBusyId === item.id ? 'var(--gray-400)' : 'var(--primary)',
                            padding: '0.375rem 0.875rem',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            whiteSpace: 'nowrap',
                            cursor: giftBusyId === item.id ? 'default' : 'pointer'
                          }}
                        >
                          {giftBusyId === item.id ? 'Opening…' : (giftErrorId === item.id ? 'Try again' : 'Send this gift')}
                        </button>
                      ) : (
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          background: 'var(--gray-100)',
                          padding: '0.25rem 0.625rem',
                          borderRadius: 'var(--radius-md)',
                          whiteSpace: 'nowrap'
                        }}>
                          Available soon
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : selectedCategory !== 'merch' ? (
        /* AGP-01 — Coming Soon: non-purchasable placeholder (no products, no add-to-cart) */
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-xl)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>&#10024;</div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
            {AGP_CATEGORIES.find((c) => c.key === selectedCategory)?.label} &mdash; Coming Soon
          </h3>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
            We&rsquo;re curating this collection. Check back soon.
          </p>
        </div>
      ) : (
      <>
      {/* Merch Grid — loading / error / empty / products */}
      {loading ? (
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '0.9375rem',
          fontStyle: 'italic'
        }}>
          Loading…
        </div>
      ) : error ? (
        <div style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '0.9375rem',
          lineHeight: 1.6
        }}>
          We&rsquo;re having trouble loading our merchandise right now. Please try again shortly.
        </div>
      ) : products.length === 0 ? (
        <div style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '0.9375rem',
          lineHeight: 1.6
        }}>
          Our curated collection is being refreshed. Please check back soon.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isNarrow
            ? '1fr 1fr'
            : 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: isNarrow ? '0.75rem' : '1.5rem',
          maxWidth: '100%',
          overflowX: 'hidden'
        }}>
          {products.map((item) => {
            const minDollars = (item.priceCentsMin / 100).toFixed(item.priceCentsMin % 100 === 0 ? 0 : 2);
            const maxDollars = (item.priceCentsMax / 100).toFixed(item.priceCentsMax % 100 === 0 ? 0 : 2);
            const displayPrice = item.priceCentsMin === item.priceCentsMax
              ? `$${minDollars}`
              : `$${minDollars} – $${maxDollars}`;
            const hasMultipleOptions = item.variantCount > 1;
            return (
              <div
                key={item.syncProductId}
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
                {/* Product image — Printful CDN URL with gradient/emoji fallback */}
                <div style={{
                  width: '100%',
                  height: isNarrow ? '120px' : '200px',
                  background: item.imageUrl
                    ? `url(${item.imageUrl}) center/cover no-repeat`
                    : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isNarrow ? '2.5rem' : '4rem'
                }}>
                  {!item.imageUrl && '🛍️'}
                </div>

                {/* Content */}
                <div style={{ padding: isNarrow ? '0.75rem' : '1.5rem' }}>
                  <h3 style={{
                    fontSize: isNarrow ? '0.875rem' : '1.125rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0.25rem'
                  }}>
                    {item.name}
                  </h3>

                  {hasMultipleOptions && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      fontStyle: 'italic',
                      marginBottom: '0.75rem'
                    }}>
                      Additional sizes/models available
                    </p>
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
                        {displayPrice}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleAddToCart(item, e)}
                      style={{
                        padding: isNarrow ? '0.375rem 0.75rem' : '0.5rem 1.25rem',
                        background: addedItems.has(item.syncProductId) ? '#22c55e' : 'var(--primary)',
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
                      {addedItems.has(item.syncProductId) ? (
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
            );
          })}
        </div>
      )}
      </>
      )}
      </div>
      {/* End Background Frame */}

      {/* AGP-02 — QR Cash™ gift modal (mirrors dashboard usage) */}
      <QRCashGiftModal
        isOpen={showQRCashModal}
        onClose={() => setShowQRCashModal(false)}
      />


      {/* Add to Cart Confirmation Modal — picker mode when pickerProduct is set */}
      <AddToCartModal
        isOpen={showCartModal}
        onClose={handleContinueShopping}
        item={lastAddedItem}
        variants={pickerProduct ? pickerProduct.variants : null}
        productName={pickerProduct ? pickerProduct.name : null}
        onVariantSelected={handleVariantSelected}
        onContinueShopping={handleContinueShopping}
        onGoToCheckout={handleGoToCheckout}
        onReturnToRecipient={returnRecipientId ? handleReturnToRecipient : (cameFromSendGreeting ? handleReturnToGreeting : null)}
        showReturnToRecipient={!!returnRecipientId || cameFromSendGreeting}
        returnToLabel={cameFromSendGreeting && !returnRecipientId ? "Return to Greeting" : "Return to Recipient Settings"}
        // Phase 3D Batch A — A2.1: defensive suppression for any residual
        // send-flow URL that lands here. Per A2.6 Merch is removed from the
        // gift chooser, but this guards stale links / deep links.
        showGoToCheckout={!cameFromSendGreeting}
      />
    </div>
  );
}
