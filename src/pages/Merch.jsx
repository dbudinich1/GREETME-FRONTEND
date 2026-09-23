// src/pages/Merch.jsx
import { Fragment, useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Briefcase, Users, Check, ArrowLeft, Settings } from 'lucide-react';
import cartService from '../services/cartService';
import AddToCartModal from '../components/AddToCartModal';
import QRCashGiftModal from '../components/QRCashGiftModal';
import api from '../api/api';
import greetmeFlags from '../assets/greetme-flags.jpg';
// Founder-approved production artwork, supplied 2026-09-23 for the Greet-Me Smart eGift Card —
// used AS-IS (never cropped, stretched, recolored, or substituted) for every denomination tile
// below. Vendor-neutral name deliberately: this page must never name a vendor in executable code.
import smartEGiftCardArt from '../assets/gifts/smart-egift-card.png';
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
// CHECKPOINT 2 — founder-only catalog management. The drawer opens OVER this page; the customer
// marketplace below is untouched. Visibility is cosmetic — the backend 403s a non-founder.
import { useAuth } from '../context/AuthContext';
import { isFounder } from '../utils/accountState';
import ManageCatalogDrawer from '../components/founderCatalog/ManageCatalogDrawer';
// GIFT PLACE — ONE product area for every category, provider-fulfilled or not.
//
// Flowers used to be a separate surface: a button that opened a modal that loaded its own list, with
// its own card, its own price format and its own action in its own place. A shopper switching from
// Americana to Flowers found the page had changed shape. Now every category projects into the same
// view model and renders through the same card and the same grid — a provider is a projector, never
// a second grid.
import { GiftProductGrid } from '../components/giftPlace/GiftProductCard';
import {
  actionLabelFor, fromCatalogProduct, fromProviderProduct, giftTypeForSelector, projectGiftCards,
} from './giftPlaceViewModel';
// The posture gate and the four proven catalogue states, in a hook so they stay assertable by
// MOUNTING rather than by scraping this file. A dormant provider is never asked for products.
import { useProviderCatalogue } from '../components/giftPlace/useProviderCatalogue';
// THE EXISTING PROVIDER CHECKOUT, REUSED AS-IS. Not a second checkout, not a flower-shaped copy of
// one: the same component Send Greet-Me opens, mounted here with its greeting arguments left off.
// Omitting `contactId` is what makes the order unattachable to any greeting, and omitting
// `onAccepted` is what selects its own standalone terminal confirmation instead of a handoff.
import ProviderCheckoutModal from '../components/providerCheckout/ProviderCheckoutModal';

export default function Merch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // CHECKPOINT 2 — founder drawer state. Nothing about the customer surface depends on this.
  const { user } = useAuth();
  const founder = isFounder(user);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [showQRCashModal, setShowQRCashModal] = useState(false); // AGP-02
  // GIFT CARDS — Manage Catalog Publish/Unpublish is the checkout authority (Team C, 2026-09-22).
  // "Coming later" is the honest DEFAULT, not a hardcoded permanent state: this asks the server —
  // the same GET the standalone Smart Card page itself asks — and only replaces the placeholder
  // once the server actually reports the card as available. A read-only, unauthenticated-safe
  // call: it costs nothing while the record stays a draft, which is the real, current posture.
  // DIRECT DENOMINATION DISPLAY (Team C, 2026-09-23): holds the server's own tile list
  // ({id, displayAmount, amountCents}) once available, `null` while unknown/dormant/unpublished —
  // the fail-closed default that keeps the "coming later" placeholder in place. No intermediate
  // "View Smart Card options" step: each tile IS the entry point once tiles are present.
  const [giftCardTiles, setGiftCardTiles] = useState(null);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 420);
  const [showCartModal, setShowCartModal] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState(null);
  const [pickerProduct, setPickerProduct] = useState(null);
  // A STANDALONE ARRANGEMENT AWAITING ITS CHECKOUT. Set only when a flower is chosen outside a
  // greeting; it holds the PROVIDER's own product record, which is what the checkout needs to start at
  // its details step. Cleared whenever a cart item takes the confirmation over, so "Go to Checkout"
  // can never route a merch confirmation into the provider's checkout.
  const [standaloneFlower, setStandaloneFlower] = useState(null);
  const [isFlowersCheckoutOpen, setIsFlowersCheckoutOpen] = useState(false);
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

  // THE CATALOGUE LOADS ON SELECTION. Clicking the category IS the request to see what is in it, so
  // there is no button between the two and nothing navigates.
  const providerGiftType = giftTypeForSelector(selectedCategory);
  const {
    products: providerProducts,
    state: providerState,
    retry: retryProviderCatalogue,
  } = useProviderCatalogue(providerGiftType);

  // GIFT CARDS availability — asked fresh every time this category is selected, from the SAME
  // endpoint (GET .../prezzee-card/tiles) the standalone Smart Card page itself uses, gated
  // server-side by prezzeeCardCheckoutBlocked() (pauseGiftCards AND Manage Catalog Publish). A
  // fail-closed default: any error, a dormant 503, or simply not having answered yet all leave
  // the placeholder in place — this must never optimistically show a purchase path.
  useEffect(() => {
    if (selectedCategory !== 'gift_cards') return undefined;
    let cancelled = false;
    setGiftCardTiles(null);
    (async () => {
      try {
        // Vendor-neutral entry point — see api.js's own note on getSmartCardTiles(). This page
        // must never name a vendor in its executable code.
        const res = await api.getSmartCardTiles();
        if (!cancelled) {
          setGiftCardTiles(res?.ok === true && Array.isArray(res.tiles) && res.tiles.length > 0 ? res.tiles : null);
        }
      } catch {
        if (!cancelled) setGiftCardTiles(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCategory]);

  // GIFTS — the ONE selection behind the ONE shared product area. Every selector, including
  // Brandable Goods, resolves through the same rule, so no two surfaces can disagree about what
  // is on screen and no product can render twice.
  const selectedProducts = useMemo(
    () => selectProducts(products, selectedCategory),
    [products, selectedCategory]
  );

  // PROVIDER PRODUCTS, PRICED IN THE SHARED VOCABULARY.
  //
  // A provider product states its price as `priceMinor`; the shared price helpers read
  // `priceCentsMin`/`priceCentsMax`. They are the same number in the same units under two names,
  // and reconciling them here — additively, leaving every original field intact — is what lets
  // one price control serve every category instead of one control that silently ignores half of
  // them.
  const pricedProviderProducts = useMemo(() => (
    (providerProducts || []).map((p) => (
      Number.isFinite(p?.priceMinor)
        ? { ...p, priceCentsMin: p.priceMinor, priceCentsMax: p.priceMinor }
        : p
    ))
  ), [providerProducts]);

  // GIFTS — price range.
  //
  // THE BOUNDS DESCRIBE WHAT IS ON SCREEN. They used to come from the merch catalog alone, which
  // was true while merch was the whole catalog and quietly wrong once provider categories joined
  // the page: on 2026-09-21 the bar read $14–$59 (the merch range) while Flowers held a $79.95
  // arrangement, so the scale could not describe the thing it sat above. A scale that cannot
  // reach a product on the page is worse than no scale.
  //
  // For a provider category the source is the provider's own set; for merch it is the whole loaded
  // catalog exactly as before, so the handles still do not jump between merch selectors.
  const boundsSource = providerGiftType ? pricedProviderProducts : products;
  const bounds = useMemo(() => priceBounds(boundsSource), [boundsSource]);

  // `null` means "the shopper has not chosen a range", which resolves to the full bounds below.
  // Holding it this way rather than seeding state from an effect means the default is always the
  // complete range even before products arrive — so a product that loads ABOVE the previous
  // maximum is visible by default rather than filtered out by a range chosen before it existed.
  // Reset is simply a return to null.
  const [priceRange, setPriceRange] = useState(null);
  const minCents = priceRange ? priceRange.min : bounds?.floor;
  const maxCents = priceRange ? priceRange.max : bounds?.ceiling;

  // THE GRID'S SOURCE, whichever it is. Both paths now go through the same price filter: a control
  // that renders above a category it does not filter is a promise the page does not keep, and
  // "Any price" appearing to do nothing is exactly how that looked.
  const gridSource = providerGiftType ? pricedProviderProducts : selectedProducts;

  // The pipeline, in order: selection, then price, then the one shared card map.
  const visibleProducts = useMemo(
    () => filterByPrice(gridSource, minCents, maxCents),
    [gridSource, minCents, maxCents]
  );

  // Distinguishes the two empty states: a category nothing has been curated into yet is
  // "Coming Soon", while a category that HAS products none of which match the range is a price
  // result. Conflating them would tell a shopper a collection does not exist when it does.
  const hiddenByPrice = gridSource.length > 0 && visibleProducts.length === 0;

  const selectedCategoryLabel = selectionLabel(selectedCategory);

  // THE ONE PROJECTION. Whatever supplied the products, the grid below receives the same six fields
  // in the same shape. This is the line that makes Flowers and Americana the same page.
  const cards = useMemo(() => (
    providerGiftType
      ? projectGiftCards(visibleProducts, fromProviderProduct)
      : projectGiftCards(visibleProducts, fromCatalogProduct)
  ), [providerGiftType, visibleProducts]);

  // The grid's state, from whichever source is feeding it.
  const gridState = providerGiftType
    ? providerState
    : (loading ? 'loading' : error ? 'failed' : 'ready');

  // THE ACTION LABEL IS DECIDED BY CONTEXT, NOT BY PRODUCT TYPE. Shopping for a greeting attaches
  // one gift to it; a direct store visit adds to a cart. The card's structure and the button's
  // position are identical either way — only the words change.
  // The gift type refines the STORE case only: a provider category bought outside a greeting says what
  // it actually does ("Order Flowers"), because such a product never reaches the cart. Shopping for a
  // greeting is "Select Gift" for every category, exactly as before.
  const giftActionLabel = actionLabelFor(cameFromSendGreeting ? 'greeting' : 'store', providerGiftType);

  /**
   * SELECTING A PROVIDER ARRANGEMENT FOR A GREETING.
   *
   * It attaches the arrangement and returns. It does NOT price, tokenize, pay or order: checkout
   * belongs to Send Greet-Me, after the sender has pressed Continue on a greeting they can still see.
   *
   * The draft travels through the EXISTING return-to-greeting mechanism — the same sessionStorage
   * blob GiftSelectorModal writes and SendGreeting already restores — with the chosen arrangement
   * added to the giftSettings it already carries. No second preservation path is introduced.
   *
   * IT NO LONGER NAVIGATES. Selecting a flower used to jump straight back to the greeting, which made
   * flowers the one category that behaved differently and threw away where the shopper was — their
   * category, their price filter, their scroll position. It now opens the SAME "Added to Cart!"
   * confirmation every other category opens, and the shopper decides: Continue Shopping stays exactly
   * here, Return to Greeting goes back. The attachment is written before either choice, so the flower
   * is held from the moment it is picked.
   */
  const selectProviderGiftForGreeting = (card) => {
    const chosen = providerProducts.find((p) => String(p.providerProductId) === String(card.id));
    if (!chosen) return;
    let saved = {};
    try {
      saved = JSON.parse(sessionStorage.getItem('sendGreetingState') || '{}');
    } catch {
      saved = {};
    }
    try {
      sessionStorage.setItem('sendGreetingState', JSON.stringify({
        ...saved,
        giftSettings: {
          ...(saved.giftSettings || {}),
          type: 'flowers',
          flowersProduct: chosen,
        },
      }));
    } catch {
      // A storage failure must not strand the shopper here with a silent no-op.
      alert('We could not hold on to your greeting. Please go back and try again.');
      return;
    }
    // THE SAME CONFIRMATION, not a navigation. `price` is passed as a NUMBER so the shared surface
    // formats it exactly as it formats a merch price — the shopper sees one money format, not two.
    setPickerProduct(null);
    setLastAddedItem({
      providerProductId: chosen.providerProductId,
      name: chosen.name,
      price: Number.isFinite(Number(chosen.priceMinor)) ? Number(chosen.priceMinor) / 100 : card.priceLabel,
      imageUrl: chosen.imageUrl || card.imageUrl || null,
      giftType: 'flowers',
    });
    setShowCartModal(true);
  };

  /**
   * SELECTING A PROVIDER ARRANGEMENT FOR ITSELF — a standalone purchase, with no greeting anywhere.
   *
   * This is the path that used to not exist. The button fired and the handler returned, because the
   * only checkout the Gift Place knew about was the cart's, and a flower cannot ride that: the cart and
   * Checkout.jsx are Printful-specific. So the guard was correct and the missing piece was a checkout,
   * not a cart entry.
   *
   * WHAT IT DELIBERATELY DOES NOT DO, and each absence is asserted:
   *   * no sessionStorage write — there is no greeting draft to attach anything to;
   *   * no cartService call — a flower never becomes a cart line;
   *   * no navigation — the shopper stays exactly where they are;
   *   * no checkout yet. The confirmation opens FIRST, which is the founder's uniform selection rule:
   *     every category confirms the same way before anything else happens.
   *
   * The confirmation it opens is the same one merch opens, with the same fields in the same shape, so
   * the surface cannot tell a flower from a mug — which is the whole point.
   */
  const selectProviderGiftStandalone = (card) => {
    const chosen = providerProducts.find((p) => String(p.providerProductId) === String(card.id));
    if (!chosen) return;
    setPickerProduct(null);
    // Held for the checkout the shopper may or may not go on to open. Choosing a different
    // arrangement replaces it, exactly as a second merch selection replaces the first.
    setStandaloneFlower(chosen);
    setLastAddedItem({
      providerProductId: chosen.providerProductId,
      name: chosen.name,
      // A NUMBER, like every merch price, so the shared surface formats one money format and not two.
      price: Number.isFinite(Number(chosen.priceMinor)) ? Number(chosen.priceMinor) / 100 : card.priceLabel,
      imageUrl: chosen.imageUrl || card.imageUrl || null,
      giftType: 'flowers',
    });
    setShowCartModal(true);
  };

  // AN ARRANGEMENT THAT BELONGS TO A GREETING, as opposed to one bought on its own. The confirmation's
  // return affordances key on this rather than on the flower itself: outside a greeting there is
  // nothing to return to, so offering "Return to Greeting" would strand the shopper.
  const flowerForGreeting = lastAddedItem?.giftType === 'flowers' && cameFromSendGreeting;

  /** One entry point for the one card action, whichever source the card came from. */
  const handleGiftCardAction = (card) => {
    if (providerGiftType) {
      // ONE CATEGORY, TWO SITUATIONS. Inside a greeting the arrangement is attached to it; outside
      // one it is simply bought. Both open the same confirmation first, and neither starts a checkout
      // from this click.
      if (cameFromSendGreeting) {
        selectProviderGiftForGreeting(card);
        return;
      }
      selectProviderGiftStandalone(card);
      return;
    }
    const product = visibleProducts.find((p) => String(p.syncProductId) === String(card.id));
    if (product) handleAddToCart(product, { stopPropagation() {} });
  };

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
      window.dispatchEvent(new Event('cartUpdated'));
      setPickerProduct(null);
      // A CART ITEM NOW OWNS THE CONFIRMATION. Any arrangement held from an earlier selection is
      // released here, so this confirmation's "Go to Checkout" cannot reach the provider's checkout.
      setStandaloneFlower(null);
      setLastAddedItem({
        syncProductId: product.syncProductId,
        name: `${product.name} — ${variant.label}`,
        price: variant.priceCents / 100,
        // The same picture the card was shown with. The confirmation renders it when it is there, so
        // every category confirms the same way.
        imageUrl: product.imageUrl || null,
        // Which return this confirmation belongs to. Merch returns to the greeting as merch.
        giftType: 'merch',
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
    // The per-card "Added!" flag went with the hand-written card it belonged to. The shared card has
    // one action in one state, and the confirmation modal is what tells the shopper the item landed.
    setLastAddedItem(null);
  };

  const handleGoToCheckout = () => {
    setShowCartModal(false);
    // A STANDALONE ARRANGEMENT GOES TO THE PROVIDER'S OWN CHECKOUT, NEVER TO THE CART.
    //
    // The cart and Checkout.jsx are Printful-specific — they key on `printfulSyncVariantId` — so
    // sending a flower there would produce a checkout that cannot describe, price or place it. The
    // provider's checkout is the one that can, and it already exists.
    //
    // Guarded on all three facts rather than on the flower alone: a held arrangement, a confirmation
    // that is actually showing one, and no greeting context. Any merch confirmation therefore keeps the
    // cart route it has always had, byte for byte.
    if (standaloneFlower && lastAddedItem?.giftType === 'flowers' && !cameFromSendGreeting) {
      setIsFlowersCheckoutOpen(true);
      return;
    }
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
    // WHICHEVER CATEGORY THIS CONFIRMATION IS FOR. SendGreeting restores the attachment from the
    // giftType it is handed, so a flower must come back as `flowers` and merch as `merch`. Defaulting
    // to merch keeps every pre-existing return byte-identical.
    const giftType = lastAddedItem?.giftType === 'flowers' ? 'flowers' : 'merch';
    navigate(`/dashboard/send?returnTo=send&giftType=${giftType}`);
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

      {/* CHECKPOINT 2 — founder-only entry point. A non-founder never renders this control, and
          the backend refuses them regardless. */}
      {founder && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <button
            type="button"
            data-testid="manage-catalog-button"
            onClick={() => setCatalogOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', background: 'var(--bg-primary)',
              color: 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Settings size={14} />
            Manage Catalog
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
                onClick={() => {
                  // A RANGE BELONGS TO THE CATALOG IT WAS CHOSEN OVER. Carrying $20–$30 from a
                  // merch selector into Flowers would hide every arrangement and say "no products
                  // match", which is a statement about the filter dressed up as one about the
                  // catalog. Switching category returns to the full range of whatever is next.
                  setPriceRange(null);
                  setSelectedCategory(sel.id);
                }}
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

      {/* THE SEPARATE FLOWER SURFACE IS GONE. Provider-fulfilled categories now render through
          the SAME grid as every other category, from the same projection, with the action in the
          same place. There is no button between the category and its products, no picker modal,
          and no second catalogue anywhere. */}

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
        /* DIRECT DENOMINATION DISPLAY (Team C, 2026-09-23) — GIFT CARDS, SERVER-DECIDED
           PRESENTATION, NO INTERMEDIATE STEP.
           `giftCardTiles` is the fail-closed DEFAULT (`null`, showing "coming later") until the
           server's own tile list (the SAME GET .../prezzee-card/tiles the standalone purchase
           page itself calls) actually reports tiles — which requires BOTH pauseGiftCards to be
           false AND the founder to have PUBLISHED the Manage Catalog record
           (prezzeeCardCheckoutBlocked(), routes/giftRoutes.js) — never a client-side guess. Each
           tile is its own product-style card; selecting one navigates straight to the existing
           purchase flow with that exact tile preselected via router state — no picker screen, no
           "View Smart Card options" button, no separate navigation step in between. */
        giftCardTiles ? (
          <div data-testid="gift-cards-available">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
              Greet-Me Smart eGift Card
            </h3>
            <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
              One smart card the recipient can spend at the retailer they choose. Choose an amount:
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '1rem',
            }}>
              {giftCardTiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  data-testid={`gift-card-denomination-${tile.id}`}
                  // BUG FIX (found in production, 2026-09-22): "gifts/smart-card" is registered in
                  // App.jsx as a NESTED child route under "/dashboard" (relative, not absolute),
                  // so its real, effective path is /dashboard/gifts/smart-card.
                  onClick={() => navigate('/dashboard/gifts/smart-card', { state: { presetTileId: tile.id } })}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    background: 'white',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ position: 'relative', width: '100%' }}>
                    {/* Approved production artwork, used as-is: no crop, stretch, recolor, or
                        substitution — its own natural aspect ratio (469:289) is preserved via
                        width:100%/height:auto. */}
                    <img
                      src={smartEGiftCardArt}
                      alt="Greet-Me Smart eGift Card"
                      style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 'var(--radius-md)' }}
                    />
                    <span style={{
                      position: 'absolute', bottom: '0.5rem', right: '0.5rem',
                      background: 'rgba(0,0,0,0.72)', color: 'white',
                      fontSize: '1.0625rem', fontWeight: 800,
                      padding: '0.25rem 0.625rem', borderRadius: '9999px',
                    }}>
                      {tile.displayAmount}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div data-testid="gift-cards-coming-later" style={{
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
        )
      ) : hiddenByPrice && !loading && !error && !providerGiftType ? (
        /* The collection EXISTS — the chosen price range simply excludes all of it. Distinct from
           Coming Soon, and recoverable without hunting for the control that caused it. Price
           filtering applies to the catalogue only; a provider prices its own goods at quote. */
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
      ) : (
        /* THE ONE SHARED PRODUCT AREA. Every category arrives here — Brandable Goods, Americana,
           Tech, Flowers — through the same projection, the same card and the same grid, with
           loading, failed and empty each saying only what is true. Flowers has no surface of its
           own any more, which is the whole point: switching category changes the products, never
           the shape of the page. */
        <GiftProductGrid
          cards={cards}
          state={gridState}
          actionLabel={giftActionLabel}
          onAction={handleGiftCardAction}
          onRetry={providerGiftType ? retryProviderCatalogue : null}
          isNarrow={isNarrow}
          emptyLabel={selectedCategoryLabel}
        />
      )}
      </div>
      {/* End Background Frame */}

      {/* AGP-02 — QR Cash™ gift modal (mirrors dashboard usage) */}
      <QRCashGiftModal
        isOpen={showQRCashModal}
        onClose={() => setShowQRCashModal(false)}
      />


      {/* A FLOWER RETURNS TO A GREETING ONLY WHEN THERE IS ONE.
             The three return-affordance rules below previously keyed on the flower alone, which was
             sound while a flower could only ever be chosen from inside a send. Now that one can be
             bought on its own, "Return to Greeting" must not be offered to a shopper who never came
             from a greeting — there is nothing to return to. The greeting-attached path keeps its
             behaviour exactly, because in that path this is true whenever the old clause was. */}
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
        // A FLOWER ALWAYS RETURNS TO THE GREETING. An arrangement is attached to the greeting being
        // composed, so even when a recipient-settings round trip is also in play the return for a
        // flower is the greeting — anything else would strand the attachment. Every other category
        // keeps the routing it already had, byte for byte.
        onReturnToRecipient={
          flowerForGreeting
            ? handleReturnToGreeting
            : (returnRecipientId ? handleReturnToRecipient : (cameFromSendGreeting ? handleReturnToGreeting : null))
        }
        showReturnToRecipient={flowerForGreeting || !!returnRecipientId || cameFromSendGreeting}
        returnToLabel={
          flowerForGreeting || (cameFromSendGreeting && !returnRecipientId)
            ? "Return to Greeting"
            : "Return to Recipient Settings"
        }
        // Phase 3D Batch A — A2.1: defensive suppression for any residual
        // send-flow URL that lands here. Per A2.6 Merch is removed from the
        // gift chooser, but this guards stale links / deep links.
        showGoToCheckout={!cameFromSendGreeting}
      />

      {/* THE STANDALONE FLOWER CHECKOUT — the EXISTING provider checkout, with its greeting arguments
             left off.
             `contactId` is omitted, which is precisely what makes the resulting order unattachable to
             any greeting: the backend stores it as null and the send-time binding refuses a gift whose
             contactId is absent. `onAccepted` is omitted, which is what makes this checkout show its
             own terminal confirmation — the provider's order number and Done — instead of handing off
             to a greeting dispatch. No greeting is created, queued or sent from this page. */}
      {isFlowersCheckoutOpen && standaloneFlower && (
        <ProviderCheckoutModal
          isOpen={isFlowersCheckoutOpen}
          onClose={() => setIsFlowersCheckoutOpen(false)}
          giftType="flowers"
          product={standaloneFlower}
          customer={user}
        />
      )}

      {/* CHECKPOINT 2 — the drawer renders OVER this page. No route change, no second page. */}
      {founder && (
        <ManageCatalogDrawer open={catalogOpen} onClose={() => setCatalogOpen(false)} />
      )}
    </div>
  );
}
