// src/pages/Merch.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Briefcase, Users, Check, ArrowLeft } from 'lucide-react';
import cartService from '../services/cartService';
import AddToCartModal from '../components/AddToCartModal';
import QRCashGiftModal from '../components/QRCashGiftModal';
import api from '../api/api';
import greetmeFlags from '../assets/greetme-flags.jpg';

// GIFTS-CP1 — the launch merchandise categories.
//
// `id` is a MACHINE IDENTIFIER and is the only thing that routes or is ever stored on a product;
// `label` is display copy. They are deliberately different in form (snake_case vs Title Case) so
// a copy edit can never change what a control selects.
const GREET_ME_CATEGORIES = [
  { id: 'gift_cards', label: 'Gift Cards' },
  { id: 'gift_baskets', label: 'Gift Baskets' },
  { id: 'flowers', label: 'Flowers' },
  { id: 'americana', label: 'Americana' },
  { id: 'faith_and_inspiration', label: 'Faith & Inspiration' },
  { id: 'tech', label: 'Tech' },
];

// `apparel` is a VALID category a product may carry, but it renders NO top-level control at
// launch. Listing it here documents that the omission is a deliberate launch decision rather
// than an oversight, and keeps the post-launch exposure to a one-line change.
const POST_LAUNCH_CATEGORY_IDS = ['apparel'];

// VIEW ALL is a UTILITY CONTROL, not a category. It is never stored on a product and is never a
// member of GREET_ME_CATEGORIES; it is rendered separately and styled distinctly below.
const VIEW_ALL = 'view_all';

// BRANDABLE GOODS is a COLLECTION, not a category — it has no category id and no chip in the
// category bar. Membership is the `brandable` boolean the server sends on each merch product.
const BRANDABLE_TAGLINE = 'See it with our brand. Make it yours.';

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
  // GIFTS-CP1 — the marketplace opens on View All, the utility control, so every purchasable
  // product is visible on arrival rather than only one category's worth.
  const [selectedCategory, setSelectedCategory] = useState(VIEW_ALL);

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

  // GIFTS-CP1 — Brandable Goods: the Greet-Me-branded products, shown with our own branding on
  // them. Membership is the server's `brandable` boolean; it is never inferred from a category.
  const brandableProducts = useMemo(
    () => products.filter((p) => p.brandable === true),
    [products]
  );

  // GIFTS-CP1 — category filtering. View All shows everything purchasable. A product with an
  // empty greetMeCategories array is not yet assigned to a launch category; it stays reachable
  // through View All and Brandable Goods rather than being silently unreachable.
  const visibleProducts = useMemo(() => {
    if (selectedCategory === VIEW_ALL) return products;
    return products.filter((p) => Array.isArray(p.greetMeCategories) && p.greetMeCategories.includes(selectedCategory));
  }, [products, selectedCategory]);

  const selectedCategoryLabel = GREET_ME_CATEGORIES.find((c) => c.id === selectedCategory)?.label || '';

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
        // GIFTING-INTEGRITY: the same opaque tag Gifts.jsx already stamps.
        // Its PRESENCE is what makes an item attachable to the Greet-Me being
        // composed; SendGreeting filters the cart on exactly this value. A
        // storefront visit never sets cameFromSendGreeting, so standalone
        // merchandise stays untagged and independent.
        ...(cameFromSendGreeting && { sendContext: 'greeting-flow' }),
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

      {/* GIFTS-CP1 — BRANDABLE GOODS: the prominent collection, ABOVE the category controls.
          It is a collection, not a category: it has no id in GREET_ME_CATEGORIES and no chip in
          the bar below. Its products are the existing curated Printful merchandise, rendered by
          the SAME card and added through the SAME cart as every other product on this page. */}
      {brandableProducts.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: isNarrow ? '1.25rem 1rem' : '1.75rem 1.5rem',
          marginBottom: '1rem',
          color: 'white',
          boxShadow: '0 4px 12px rgba(30, 58, 138, 0.25)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: isNarrow ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexDirection: isNarrow ? 'column' : 'row',
            marginBottom: '1rem'
          }}>
            <div>
              <h2 style={{ fontSize: isNarrow ? '1.125rem' : '1.375rem', fontWeight: 700, margin: 0 }}>
                Brandable Goods
              </h2>
              <p style={{
                fontSize: isNarrow ? '0.875rem' : '0.9375rem',
                margin: '0.25rem 0 0',
                opacity: 0.92,
                fontWeight: 500
              }}>
                {BRANDABLE_TAGLINE}
              </p>
            </div>
            <button
              onClick={() => navigate('/business?contact=sales')}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: 'white',
                color: '#1e3a8a',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              <Briefcase size={14} />
              Brand for My Company
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: isNarrow ? '0.75rem' : '1rem'
          }}>
            {brandableProducts.map((item) => {
              const minDollars = (item.priceCentsMin / 100).toFixed(item.priceCentsMin % 100 === 0 ? 0 : 2);
              const maxDollars = (item.priceCentsMax / 100).toFixed(item.priceCentsMax % 100 === 0 ? 0 : 2);
              const displayPrice = item.priceCentsMin === item.priceCentsMax
                ? `$${minDollars}`
                : `$${minDollars} – $${maxDollars}`;
              return (
                <div
                  key={`brandable-${item.syncProductId}`}
                  style={{
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    color: 'var(--text-primary)'
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: isNarrow ? '96px' : '140px',
                    background: item.imageUrl
                      ? `url(${item.imageUrl}) center/cover no-repeat`
                      : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isNarrow ? '2rem' : '2.5rem'
                  }}>
                    {!item.imageUrl && '🛍️'}
                  </div>
                  <div style={{ padding: isNarrow ? '0.625rem' : '0.875rem' }}>
                    <h3 style={{
                      fontSize: isNarrow ? '0.8125rem' : '0.9375rem',
                      fontWeight: 600,
                      margin: '0 0 0.5rem',
                      lineHeight: 1.3
                    }}>
                      {item.name}
                    </h3>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ fontSize: isNarrow ? '0.875rem' : '1rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {displayPrice}
                      </span>
                      {/* SAME handler, SAME cart, SAME checkout as the category grid below. */}
                      <button
                        onClick={(e) => handleAddToCart(item, e)}
                        style={{
                          padding: '0.375rem 0.75rem',
                          background: addedItems.has(item.syncProductId) ? '#22c55e' : 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem'
                        }}
                      >
                        {addedItems.has(item.syncProductId) ? (
                          <><Check size={14} />{isNarrow ? '✓' : 'Added!'}</>
                        ) : (
                          <><ShoppingCart size={14} />{isNarrow ? 'Add' : 'Add to Cart'}</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GIFTS-CP1 — Category controls. Six merchandise categories, then View All rendered
          separately and styled distinctly because it is a UTILITY control, not a category. */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '0 0 0.75rem',
        marginBottom: '1rem'
      }}>
        {GREET_ME_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              flexShrink: 0,
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              border: '1px solid var(--border)',
              background: selectedCategory === cat.id ? 'var(--primary)' : 'var(--bg-primary)',
              color: selectedCategory === cat.id ? 'white' : 'var(--text-secondary)',
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

        {/* Visual separation so View All never reads as a seventh merchandise category. */}
        <span aria-hidden="true" style={{
          flexShrink: 0,
          width: '1px',
          alignSelf: 'stretch',
          background: 'var(--border)',
          margin: '0 0.25rem'
        }} />
        <button
          onClick={() => setSelectedCategory(VIEW_ALL)}
          style={{
            flexShrink: 0,
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: selectedCategory === VIEW_ALL ? '1px solid var(--primary)' : '1px dashed var(--border)',
            background: 'transparent',
            color: selectedCategory === VIEW_ALL ? 'var(--primary)' : 'var(--text-tertiary)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap'
          }}
        >
          View All
        </button>
      </div>

      {selectedCategory === 'gift_cards' ? (
        /* GIFTS-CP1 — GIFT CARDS, DORMANT PRESENTATION.
           The control renders so the category is discoverable, but the Greet-Me Smart eGift Card
           is presented as unavailable: no denomination selector, no Add to Cart, no checkout
           action, nothing that could begin a purchase. Prezzee is NOT activated and this is NOT
           a Prezzee browser — there is exactly one card described here and no product list. */
        <div style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-xl)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>&#127873;</div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
            Greet-Me Smart eGift Card
          </h3>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, margin: '0 0 1rem', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            One smart card the recipient can spend at the retailer they choose.
          </p>
          <span style={{
            display: 'inline-block',
            padding: '0.375rem 0.875rem',
            borderRadius: '9999px',
            background: 'var(--bg-secondary, #f1f5f9)',
            color: 'var(--text-tertiary)',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            Coming later — not yet available
          </span>
        </div>
      ) : visibleProducts.length === 0 && !loading && !error ? (
        /* A category with nothing curated into it yet. Non-purchasable placeholder. */
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-xl)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>&#10024;</div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
            {selectedCategoryLabel} &mdash; Coming Soon
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
          {visibleProducts.map((item) => {
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
