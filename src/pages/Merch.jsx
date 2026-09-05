// src/pages/Merch.jsx
import { Fragment, useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Briefcase, Users, Check, ArrowLeft } from 'lucide-react';
import cartService from '../services/cartService';
import AddToCartModal from '../components/AddToCartModal';
import QRCashGiftModal from '../components/QRCashGiftModal';
import api from '../api/api';
import greetmeFlags from '../assets/greetme-flags.jpg';
// GIFTS — the selector vocabulary and the ONE selection rule live in a plain module so the
// partition they produce is executable and testable. See src/pages/merchSelection.js.
import {
  BRANDABLE,
  BRANDABLE_TAGLINE,
  DEFAULT_SELECTION,
  SELECTOR_ROW,
  filterByPrice,
  priceBounds,
  selectProducts,
  selectionLabel,
} from './merchSelection';
import PriceRangeFilter from '../components/PriceRangeFilter';

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
  // GIFTS — the marketplace opens on Brandable Goods, the leading selector.
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_SELECTION);

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

  // GIFTS — the ONE selection behind the ONE shared product area. Every selector, including
  // Brandable Goods, resolves through the same rule, so no two surfaces can disagree about what
  // is on screen and no product can render twice.
  const selectedProducts = useMemo(
    () => selectProducts(products, selectedCategory),
    [products, selectedCategory]
  );

  // GIFTS — price range. Bounds come from the WHOLE loaded catalog, never from the current
  // selection, so the control keeps one scale and the handles do not jump when the category
  // changes.
  const bounds = useMemo(() => priceBounds(products), [products]);

  // `null` means "the shopper has not chosen a range", which resolves to the full bounds below.
  // Holding it this way rather than seeding state from an effect means the default is always the
  // complete range even before products arrive, a deliberate choice SURVIVES every category
  // switch, and Reset is simply a return to null.
  const [priceRange, setPriceRange] = useState(null);
  const minCents = priceRange ? priceRange.min : bounds?.floor;
  const maxCents = priceRange ? priceRange.max : bounds?.ceiling;

  // The pipeline, in order: selection, then price, then the one shared card map.
  const visibleProducts = useMemo(
    () => filterByPrice(selectedProducts, minCents, maxCents),
    [selectedProducts, minCents, maxCents]
  );

  // Distinguishes the two empty states: a category nothing has been curated into yet is
  // "Coming Soon", while a category that HAS products none of which match the range is a price
  // result. Conflating them would tell a shopper a collection does not exist when it does.
  const hiddenByPrice = selectedProducts.length > 0 && visibleProducts.length === 0;

  const selectedCategoryLabel = selectionLabel(selectedCategory);

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

      {/* GIFTS — UNIFIED SELECTOR ROW, directly beneath QR Cash.
          ONE row, EIGHT controls, Brandable Goods first and selected by default.

          Brandable Goods is a COLLECTION rather than a stored category (see merchSelection.js):
          membership is the server's `brandable` boolean and no product ever carries this id. It
          is emphasised more strongly than the six categories, but it is a control in THIS SAME
          ROW — it opens no second surface and renders no second grid. Everything it shows comes
          from the one shared product area below.

          View All follows a separator because it is a UTILITY control and never a stored
          category, exactly as before.

          Responsive: one clear horizontal row wherever the width allows, and the same single row
          becomes horizontally scrollable below that. No selector is stacked into its own panel,
          none is hidden, and the row cannot widen the page. */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        maxWidth: '100%',
        padding: '0 0 0.75rem',
        marginBottom: '1rem'
      }}>
        {SELECTOR_ROW.map((sel) => {
          const isSelected = selectedCategory === sel.id;
          const isCollection = sel.kind === 'collection';
          const isUtility = sel.kind === 'utility';
          return (
            <Fragment key={sel.id}>
              {/* Visual separation so View All never reads as a merchandise category. */}
              {isUtility && (
                <span aria-hidden="true" style={{
                  flexShrink: 0,
                  width: '1px',
                  alignSelf: 'stretch',
                  background: 'var(--border)',
                  margin: '0 0.25rem'
                }} />
              )}
              <button
                onClick={() => setSelectedCategory(sel.id)}
                aria-pressed={isSelected}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.5rem 1rem',
                  borderRadius: isUtility ? 'var(--radius-md)' : '9999px',
                  border: isUtility
                    ? (isSelected ? '1px solid var(--primary)' : '1px dashed var(--border)')
                    : (isCollection ? '1px solid var(--primary)' : '1px solid var(--border)'),
                  background: isSelected
                    ? (isCollection
                        ? 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)'
                        : (isUtility ? 'transparent' : 'var(--primary)'))
                    : (isUtility ? 'transparent' : 'var(--bg-primary)'),
                  color: isSelected
                    ? (isUtility ? 'var(--primary)' : 'white')
                    : (isCollection
                        ? 'var(--primary)'
                        : (isUtility ? 'var(--text-tertiary)' : 'var(--text-secondary)')),
                  fontSize: '0.8125rem',
                  fontWeight: (isCollection || isUtility) ? 700 : 600,
                  letterSpacing: isUtility ? '0.02em' : 'normal',
                  textTransform: isUtility ? 'uppercase' : 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap'
                }}
              >
                {isCollection && <Briefcase size={14} />}
                {sel.label}
              </button>
            </Fragment>
          );
        })}
      </div>

      {/* GIFTS — PRICE RANGE, directly beneath the selector row and above everything it filters.
          One compact control, not a panel and not a second surface. It is hidden for Gift Cards,
          whose panel is deliberately non-purchasable — offering to price-filter a paused card
          would imply it can be bought. */}
      {selectedCategory !== 'gift_cards' && bounds && (
        <PriceRangeFilter
          floor={bounds.floor}
          ceiling={bounds.ceiling}
          minCents={minCents}
          maxCents={maxCents}
          onChange={(min, max) => setPriceRange({ min, max })}
          onReset={() => setPriceRange(null)}
          isNarrow={isNarrow}
        />
      )}

      {/* GIFTS — Brandable Goods header: the approved copy and the Brand for My Company action,
          and nothing else. The products themselves render in the ONE shared area below, through
          the same grid and the same cart as every other selection. This is a header, not a
          product surface. */}
      {selectedCategory === BRANDABLE && (
        <div style={{
          display: 'flex',
          alignItems: isNarrow ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          flexDirection: isNarrow ? 'column' : 'row',
          gap: '0.75rem',
          padding: isNarrow ? '0.875rem 1rem' : '1rem 1.25rem',
          marginBottom: '1rem',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)',
          color: 'white',
          boxShadow: '0 4px 12px rgba(30, 58, 138, 0.25)'
        }}>
          <p style={{
            fontSize: isNarrow ? '0.875rem' : '0.9375rem',
            fontWeight: 600,
            margin: 0,
            lineHeight: 1.4
          }}>
            {BRANDABLE_TAGLINE}
          </p>
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
      )}

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
      ) : hiddenByPrice && !loading && !error ? (
        /* The collection EXISTS — the chosen price range simply excludes all of it. Distinct from
           Coming Soon, and recoverable without hunting for the control that caused it. */
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-xl)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>&#128181;</div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
            No products in this price range.
          </h3>
          <button
            type="button"
            onClick={() => setPriceRange(null)}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--primary)',
              background: 'transparent',
              color: 'var(--primary)',
              fontSize: '0.875rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer'
            }}
          >
            Clear price filter
          </button>
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
