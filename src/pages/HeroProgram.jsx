// src/pages/HeroProgram.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Heart, Gift, Building2, ShoppingCart, X, Check, Image, ArrowRight } from 'lucide-react';
import cartService from '../services/cartService';

export default function HeroProgram() {
  const navigate = useNavigate();

  // Image Bank Modal State
  const [showImageBankModal, setShowImageBankModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [imageBankStep, setImageBankStep] = useState('selection'); // 'selection' | 'confirmation'
  const [lastAddedImagePackage, setLastAddedImagePackage] = useState(null);

  const imageBankPackages = [
    { id: 1, images: 3, price: 5, perImage: '1.67', popular: false },
    { id: 2, images: 5, price: 10, perImage: '2.00', popular: true },
    { id: 3, images: 10, price: 15, perImage: '1.50', popular: false, bestValue: true }
  ];

  const handleAddImageToCart = (pkg) => {
    const cartItem = {
      type: 'image-credits',
      name: `Image Credits - ${pkg.images} Images`,
      price: pkg.price,
      quantity: 1,
      images: pkg.images,
      packageId: pkg.id,
      icon: '🖼️'
    };

    // Use cartService
    cartService.addItem(cartItem);

    // Trigger cart badge update
    window.dispatchEvent(new Event('cartUpdated'));

    // Store the added package and transition to confirmation state
    setLastAddedImagePackage(pkg);
    setImageBankStep('confirmation');
  };

  const resetImageBankModal = () => {
    setShowImageBankModal(false);
    setSelectedPackage(null);
    setImageBankStep('selection');
    setLastAddedImagePackage(null);
  };

  // Hero Hearts Modal State
  const [showHeroHeartsModal, setShowHeroHeartsModal] = useState(false);
  const [selectedHeroBundle, setSelectedHeroBundle] = useState(null);
  const [heroHeartsStep, setHeroHeartsStep] = useState('selection'); // 'selection' | 'confirmation'
  const [lastAddedHeroBundle, setLastAddedHeroBundle] = useState(null);

  // Hero Hearts Bundles - price tiers with bonus hearts
  const HERO_HEARTS_BUNDLES = [
    {
      id: 'bundle-100',
      name: 'Starter Bundle',
      price: 100,
      hearts: 1000,
      bonusHearts: 200,
      totalHearts: 1200,
      perDollar: 12,
      popular: false,
      description: 'Perfect for getting started with Hero Hearts'
    },
    {
      id: 'bundle-250',
      name: 'Growth Bundle',
      price: 250,
      hearts: 2500,
      bonusHearts: 750,
      totalHearts: 3250,
      perDollar: 13,
      popular: true,
      description: 'Most popular choice - best value for regular gifters'
    },
    {
      id: 'bundle-500',
      name: 'Hero Bundle',
      price: 500,
      hearts: 5000,
      bonusHearts: 2000,
      totalHearts: 7000,
      perDollar: 14,
      popular: false,
      bestValue: true,
      description: 'Maximum impact - double your rewards balance'
    }
  ];

  const handleAddToCart = (bundle) => {
    const cartItem = {
      type: 'hero-hearts',
      name: `Hero Hearts - ${bundle.name}`,
      price: bundle.price,
      quantity: 1,
      hearts: bundle.totalHearts,
      bundleId: bundle.id,
      icon: '❤️'
    };

    // Use cartService instead of direct localStorage
    cartService.addItem(cartItem);

    // Trigger cart badge update in DashboardLayout
    window.dispatchEvent(new Event('cartUpdated'));

    // Store the added bundle and transition to confirmation state
    setLastAddedHeroBundle(bundle);
    setHeroHeartsStep('confirmation');
  };

  // Reset Hero Hearts modal to initial state
  const resetHeroHeartsModal = () => {
    setShowHeroHeartsModal(false);
    setSelectedHeroBundle(null);
    setHeroHeartsStep('selection');
    setLastAddedHeroBundle(null);
  };

  // Mock leaderboard data - Top 5 for preview
  const topHeroes = [
    { rank: 1, name: 'TechCorp Solutions', type: 'Company', totalGifted: 450, isHallOfHeroes: true },
    { rank: 2, name: 'Sarah Johnson', type: 'Individual', totalGifted: 380, isHallOfHeroes: true },
    { rank: 3, name: 'Blue Sky Enterprises', type: 'Company', totalGifted: 320, isHallOfHeroes: true },
    { rank: 4, name: 'Michael Rodriguez', type: 'Individual', totalGifted: 275, isHallOfHeroes: true },
    { rank: 5, name: 'GreenLeaf Industries', type: 'Company', totalGifted: 240, isHallOfHeroes: true }
  ];

  return (
    <div>
      {/* Hero Header Card */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem 2rem',
        marginBottom: '1.5rem',
        color: '#000000',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(0, 0, 0, 0.1)',
            padding: '0.375rem 0.75rem',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#000000'
          }}>
            🏅 10% donated
          </div>

          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            color: '#000000'
          }}>
            Greet-Me Hero™
          </h1>

          <p style={{
            fontSize: '0.9375rem',
            marginBottom: '0.75rem',
            lineHeight: 1.5,
            color: '#000000'
          }}>
            Our B2B program for meaningful connections at scale—with 10% of proceeds supporting veterans and first responders.
          </p>

          {/* Jump link */}
          <button
            onClick={() => document.getElementById('many-ways-to-be-a-greet-me-hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#000000',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'underline',
              marginBottom: '0.75rem',
              fontFamily: 'inherit'
            }}
          >
            Many Ways to Be a Greet-Me Hero
          </button>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* Shop Merch Store - Yellow */}
            <button
              onClick={() => navigate('/dashboard/merch')}
              style={{
                padding: '0.625rem 1.5rem',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                color: '#000000',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
              }}
            >
              <Gift size={18} />
              Visit Gift Shop
            </button>
            {/* View Hall of Heroes - Yellow */}
            <button
              onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
              style={{
                padding: '0.625rem 1.5rem',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                color: '#000000',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
              }}
            >
              View Hall of Heroes
            </button>
            {/* Be a Hero - Yellow */}
            {/* Phase 8.4: Replaced alert() with scroll to "Many Ways" section */}
            <button
              onClick={() => document.getElementById('many-ways-to-be-a-greet-me-hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              style={{
                padding: '0.625rem 1.5rem',
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                color: '#000000',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
              }}
            >
              Be a Hero
            </button>
          </div>
        </div>
      </div>

      {/* Many Ways to Be a Greet-Me Hero Section */}
      <div id="many-ways-to-be-a-greet-me-hero" style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>Many Ways to Be a Greet-Me Hero</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* Card 1: Recognition & Impact */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Heart size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Recognition & Impact</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              10% of qualifying corporate program proceeds support veterans and first responders. Track your impact with leaderboard rankings and earn permanent Hall of Heroes recognition.
            </p>
          </div>

          {/* Card 2: Hero™ Marketplace Partners */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Building2 size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Hero™ Marketplace Partners</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Curated vendors who stand with Greet-Me to honor our heroes. Shop from partners committed to quality and purpose-driven giving.
            </p>
          </div>

          {/* Card 3: White Label Services */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Award size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>White Label Services</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Full-service concierge support for enterprise clients. We handle everything from curation to delivery.
            </p>
          </div>

          {/* Card 4: American Merch 🇺🇸 */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.75rem'
            }}>
              <ShoppingCart size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>American Merch</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Custom apparel, drinkware, and accessories with your branding. Build your brand while showing appreciation.
            </p>
          </div>

          {/* Card 5: Value-Add Giveaway Bundles */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Gift size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Value-Add Giveaway Bundles</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Pre-packaged gift bundles perfect for events, promotions, and client appreciation. Ready to give, easy to customize.
            </p>
          </div>

          {/* Card 6: Subscription Bundles */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Gift size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Subscription Bundles</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Curated subscription collections combining the best of Greet-Me. Perfect for bulk purchases and corporate gifting programs.
            </p>
          </div>

          {/* Card 7: Subscriptions */}
          <div
            onClick={() => setShowImageBankModal(true)}
            style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xl)',
              padding: '2rem',
              border: '2px solid var(--border)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#667eea';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Image size={28} style={{ color: 'white' }} />
            </div>
            {/* Phase 8.4: Renamed from "Subscriptions" to match actual product */}
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Image Credits</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              flex: 1
            }}>
              Purchase credits to unlock premium greeting card images. Click to view packages and pricing.
            </p>
            <div style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              display: 'inline-block'
            }}>
              Buy Credits →
            </div>
          </div>

          {/* Card 8: Hearts For Sale */}
          <div
            onClick={() => setShowHeroHeartsModal(true)}
            style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xl)',
              padding: '2rem',
              border: '2px solid var(--border)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#ec4899';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.2)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.75rem'
            }}>
              <Heart size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Greet-Me Hero Hearts™</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              flex: 1
            }}>
              All Rewards Bundle purchases Double the Users Greet-Me Rewards balance and support our heros.
            </p>
            <div style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              display: 'inline-block'
            }}>
              Buy Hero Hearts →
            </div>
          </div>
        </div>
      </div>

      {/* Impact Snapshot */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>Impact Snapshot</h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2rem',
            textAlign: 'center'
          }}>
            <div>
              <div style={{
                fontSize: '3rem',
                fontWeight: 700,
                color: '#667eea',
                marginBottom: '0.5rem'
              }}>1,250</div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>Subscriptions Gifted</div>
            </div>
            <div>
              <div style={{
                fontSize: '3rem',
                fontWeight: 700,
                color: '#f093fb',
                marginBottom: '0.5rem'
              }}>$18,750</div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>Total Donated (10%)</div>
            </div>
            <div>
              <div style={{
                fontSize: '3rem',
                fontWeight: 700,
                color: '#4facfe',
                marginBottom: '0.5rem'
              }}>340</div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>Active Hero Sponsors</div>
            </div>
          </div>
        </div>
      </div>

      {/* Hall of Honor Preview */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>Hall of Honor - Top 5</h2>
        <p style={{
          textAlign: 'center',
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem',
          fontSize: '0.875rem'
        }}>
          Recognizing our top sponsors by total gifted subscriptions
        </p>

        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden'
        }}>
          {topHeroes.map((hero, index) => (
            <div
              key={hero.rank}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 1.5rem',
                borderBottom: index < topHeroes.length - 1 ? '1px solid var(--border)' : 'none',
                background: hero.rank <= 3 ? 'rgba(102, 126, 234, 0.05)' : 'transparent'
              }}
            >
              {/* Rank */}
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                background: hero.rank === 1 ? '#fbbf24' : hero.rank === 2 ? '#94a3b8' : hero.rank === 3 ? '#cd7f32' : 'var(--gray-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1rem',
                color: hero.rank <= 3 ? 'white' : 'var(--text-primary)'
              }}>
                {hero.rank}
              </div>

              {/* Name and Type */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {hero.name}
                  {hero.isHallOfHeroes && (
                    <span style={{
                      fontSize: '0.75rem',
                      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                      color: 'white',
                      padding: '0.125rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600
                    }}>
                      🏆 Hall of Heroes
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)'
                }}>
                  {hero.type}
                </div>
              </div>

              {/* Total Gifted */}
              <div style={{
                textAlign: 'right'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#667eea'
                }}>
                  {hero.totalGifted}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)'
                }}>
                  gifted
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={() => alert('Full leaderboard - Integration coming soon')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              color: '#000000',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
            }}
          >
            View Full Hall of Honor →
          </button>
        </div>
      </div>

      {/* Hall of Heroes vs Leaderboard Section */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          color: '#000000',
          textAlign: 'center'
        }}>
          <div style={{
            width: '5rem',
            height: '5rem',
            margin: '0 auto 1rem',
            fontSize: '4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            🏆
          </div>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 700,
            marginBottom: '1rem',
            color: '#000000'
          }}>Hall of Heroes™</h2>
          {/* Phase 8.4: Clarified eligibility - enterprise-credible, no invented thresholds */}
          <p style={{
            fontSize: '1.125rem',
            marginBottom: '1rem',
            lineHeight: 1.6,
            color: '#000000'
          }}>
            Permanent, invite-only recognition reserved for top-tier corporate sponsors.
          </p>
          <p style={{
            fontSize: '1rem',
            marginBottom: '1.5rem',
            color: '#000000'
          }}>
            Hall of Heroes status is <strong>permanent</strong> — once earned, you keep it forever. Not every sponsor qualifies. Eligibility is based on gifted subscription volume and corporate impact milestones. We'll notify you when you qualify.
          </p>
          <div style={{
            background: 'rgba(0, 0, 0, 0.1)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            marginBottom: '1rem',
            color: '#000000'
          }}>
            <strong>Hall of Honor Leaderboard:</strong> Dynamic rankings updated in real-time based on total subscriptions distributed. Compete for recognition and visibility.
          </div>
          <div style={{
            background: 'rgba(0, 0, 0, 0.08)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            color: '#000000'
          }}>
            <strong>Hall of Heroes:</strong> Invitation-only permanent recognition for high-impact sponsors. Your badge is displayed across your profile and marketing materials.
          </div>
        </div>
      </div>

      {/* Image Bank Modal */}
      {showImageBankModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={resetImageBankModal}
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
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderTopLeftRadius: 'var(--radius-xl)',
              borderTopRightRadius: 'var(--radius-xl)',
              color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Image size={24} />
                <div>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    margin: 0
                  }}>
                    {imageBankStep === 'confirmation' ? 'Added to Cart!' : 'Image Bank'}
                  </h2>
                  <p style={{
                    fontSize: '0.875rem',
                    opacity: 0.9,
                    margin: 0
                  }}>
                    {imageBankStep === 'selection' && 'Buy image credits for greeting cards'}
                    {imageBankStep === 'confirmation' && 'Your item has been added'}
                  </p>
                </div>
              </div>
              <button
                onClick={resetImageBankModal}
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
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', lineHeight: 1 }}>×</span>
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              {/* STATE 1: Selection */}
              {imageBankStep === 'selection' && (
                <>
                  <p style={{
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.5rem',
                    fontSize: '0.9375rem'
                  }}>
                    Choose a package to add image credits to your account
                  </p>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    {imageBankPackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        onClick={() => setSelectedPackage(pkg)}
                        style={{
                          padding: '1.25rem',
                          border: selectedPackage?.id === pkg.id ? '2px solid #667eea' : '2px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          background: selectedPackage?.id === pkg.id ? 'rgba(102, 126, 234, 0.05)' : 'white',
                          position: 'relative'
                        }}
                      >
                        {pkg.popular && (
                          <span style={{
                            position: 'absolute',
                            top: '-0.5rem',
                            right: '1rem',
                            background: '#f59e0b',
                            color: 'white',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            padding: '0.25rem 0.75rem',
                            borderRadius: 'var(--radius-md)'
                          }}>
                            POPULAR
                          </span>
                        )}
                        {pkg.bestValue && (
                          <span style={{
                            position: 'absolute',
                            top: '-0.5rem',
                            right: '1rem',
                            background: '#22c55e',
                            color: 'white',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            padding: '0.25rem 0.75rem',
                            borderRadius: 'var(--radius-md)'
                          }}>
                            BEST VALUE
                          </span>
                        )}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                              width: '3rem',
                              height: '3rem',
                              borderRadius: '50%',
                              background: selectedPackage?.id === pkg.id
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : 'var(--gray-100)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}>
                              <Image size={20} style={{
                                color: selectedPackage?.id === pkg.id ? 'white' : 'var(--text-secondary)'
                              }} />
                            </div>
                            <div>
                              <div style={{
                                fontSize: '1.125rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)'
                              }}>
                                {pkg.images} Images
                              </div>
                              <div style={{
                                fontSize: '0.8125rem',
                                color: 'var(--text-secondary)'
                              }}>
                                ${pkg.perImage} per image
                              </div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: selectedPackage?.id === pkg.id ? '#667eea' : 'var(--text-primary)'
                          }}>
                            ${pkg.price}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Selection State Buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    justifyContent: 'space-between',
                    marginTop: '1.5rem'
                  }}>
                    {/* Cancel - Secondary (outline) - LEFT */}
                    <button
                      onClick={resetImageBankModal}
                      style={{
                        padding: '0.875rem 1.5rem',
                        background: 'white',
                        color: 'var(--text-primary)',
                        border: '2px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: 'inherit'
                      }}
                    >
                      Cancel
                    </button>

                    {/* Add to Cart - Primary (solid) - RIGHT */}
                    <button
                      onClick={() => {
                        if (selectedPackage) {
                          handleAddImageToCart(selectedPackage);
                        }
                      }}
                      disabled={!selectedPackage}
                      style={{
                        padding: '0.875rem 2rem',
                        background: selectedPackage
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : 'var(--gray-200)',
                        color: selectedPackage ? 'white' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: 'var(--radius-lg)',
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        cursor: selectedPackage ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s',
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: selectedPackage ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
                      }}
                    >
                      <ShoppingCart size={18} />
                      Add to Cart
                    </button>
                  </div>
                </>
              )}

              {/* STATE 2: Confirmation */}
              {imageBankStep === 'confirmation' && lastAddedImagePackage && (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  {/* Success Icon */}
                  <div style={{
                    width: '5rem',
                    height: '5rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                  }}>
                    <Check size={40} style={{ color: 'white' }} />
                  </div>

                  {/* Confirmation Message */}
                  <h3 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem'
                  }}>
                    Added to Cart!
                  </h3>

                  <p style={{
                    fontSize: '1rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.5rem'
                  }}>
                    {lastAddedImagePackage.images} Image Credits
                  </p>

                  {/* Item Summary */}
                  <div style={{
                    background: 'var(--gray-50)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem',
                    marginBottom: '0.75rem',
                    maxWidth: '320px',
                    margin: '0 auto 1.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{lastAddedImagePackage.images} Images</span>
                      <span style={{ fontWeight: 600, color: '#667eea' }}>${lastAddedImagePackage.price}</span>
                    </div>
                    <div style={{
                      borderTop: '1px solid var(--border)',
                      paddingTop: '0.5rem',
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {cartService.getCount()} {cartService.getCount() === 1 ? 'item' : 'items'} in cart
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    justifyContent: 'center',
                    maxWidth: '400px',
                    margin: '0 auto'
                  }}>
                    {/* Continue Shopping - Secondary (outline) */}
                    <button
                      onClick={resetImageBankModal}
                      style={{
                        flex: 1,
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
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <ShoppingCart size={18} />
                      Continue Shopping
                    </button>

                    {/* Checkout - Primary (solid) */}
                    <button
                      onClick={() => {
                        resetImageBankModal();
                        navigate('/dashboard/cart');
                      }}
                      style={{
                        flex: 1,
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
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      Checkout
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Hero Hearts Pricing Modal */}
      {showHeroHeartsModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={resetHeroHeartsModal}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000
            }}
          />
          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: '1rem',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            zIndex: 1001,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Close Button - Fixed to modal frame */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetHeroHeartsModal();
              }}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                zIndex: 9999,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
              }}
            >
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#374151', lineHeight: 1 }}>×</span>
            </button>

            {/* Scrollable Content */}
            <div style={{ padding: '2rem', paddingTop: '3rem', overflowY: 'auto', flex: 1 }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Heart size={28} style={{ color: 'white' }} />
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem'
              }}>
                Greet-Me Hero Hearts™
              </h2>
              <p style={{
                fontSize: '0.9375rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}>
                Double your Rewards balance and support veterans & first responders
              </p>
              <div style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #D4AF37 0%, #8B6914 100%)',
                color: 'white',
                padding: '0.375rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.75rem',
                fontWeight: 600,
                marginTop: '0.75rem'
              }}>
                🏅 10% of proceeds donated
              </div>
            </div>

            {/* STATE 1: Selection */}
            {heroHeartsStep === 'selection' && (
              <>
                {/* Pricing Cards Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  {HERO_HEARTS_BUNDLES.map((bundle) => (
                    <div
                      key={bundle.id}
                      onClick={() => setSelectedHeroBundle(bundle.id)}
                      style={{
                        position: 'relative',
                        background: selectedHeroBundle === bundle.id
                          ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(190, 24, 93, 0.05) 100%)'
                          : 'white',
                        border: selectedHeroBundle === bundle.id
                          ? '2px solid #ec4899'
                          : bundle.popular
                            ? '2px solid #ec4899'
                            : '2px solid var(--border)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '1.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        transform: selectedHeroBundle === bundle.id ? 'scale(1.02)' : 'scale(1)'
                      }}
                    >
                      {/* Popular Badge */}
                      {bundle.popular && (
                        <div style={{
                          position: 'absolute',
                          top: '-0.75rem',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Most Popular
                        </div>
                      )}

                      {/* Best Value Badge */}
                      {bundle.bestValue && (
                        <div style={{
                          position: 'absolute',
                          top: '-0.75rem',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'linear-gradient(135deg, #D4AF37 0%, #8B6914 100%)',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Best Value
                        </div>
                      )}

                      {/* Selection Indicator */}
                      <div style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        width: '1.5rem',
                        height: '1.5rem',
                        borderRadius: '50%',
                        border: selectedHeroBundle === bundle.id ? '2px solid #ec4899' : '2px solid var(--border)',
                        background: selectedHeroBundle === bundle.id ? '#ec4899' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}>
                        {selectedHeroBundle === bundle.id && (
                          <Check size={14} style={{ color: 'white' }} />
                        )}
                      </div>

                      {/* Bundle Name */}
                      <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem',
                        paddingRight: '2rem'
                      }}>
                        {bundle.name}
                      </h3>

                      {/* Price */}
                      <div style={{
                        fontSize: '2rem',
                        fontWeight: 800,
                        color: '#ec4899',
                        marginBottom: '0.5rem'
                      }}>
                        ${bundle.price}
                      </div>

                      {/* Hearts Breakdown */}
                      <div style={{
                        background: 'var(--gray-50)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '0.75rem',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8125rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '0.25rem'
                        }}>
                          <span>Base Hearts:</span>
                          <span>{bundle.hearts.toLocaleString()} ❤️</span>
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8125rem',
                          color: '#22c55e',
                          fontWeight: 600,
                          marginBottom: '0.25rem'
                        }}>
                          <span>Bonus Hearts:</span>
                          <span>+{bundle.bonusHearts.toLocaleString()} ❤️</span>
                        </div>
                        <div style={{
                          borderTop: '1px solid var(--border)',
                          paddingTop: '0.5rem',
                          marginTop: '0.25rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.9375rem',
                          fontWeight: 700,
                          color: '#ec4899'
                        }}>
                          <span>Total:</span>
                          <span>{bundle.totalHearts.toLocaleString()} ❤️</span>
                        </div>
                      </div>

                      {/* Per Dollar Value */}
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                        marginBottom: '0.75rem'
                      }}>
                        {bundle.perDollar} Hearts per dollar
                      </div>

                      {/* Description */}
                      <p style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        textAlign: 'center'
                      }}>
                        {bundle.description}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Selection State Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'space-between'
                }}>
                  {/* Cancel - Secondary (outline) - LEFT */}
                  <button
                    onClick={resetHeroHeartsModal}
                    style={{
                      padding: '0.875rem 1.5rem',
                      background: 'white',
                      color: 'var(--text-primary)',
                      border: '2px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit'
                    }}
                  >
                    Cancel
                  </button>

                  {/* Add to Cart - Primary (solid) - RIGHT */}
                  <button
                    onClick={() => {
                      const bundle = HERO_HEARTS_BUNDLES.find(b => b.id === selectedHeroBundle);
                      if (bundle) {
                        handleAddToCart(bundle);
                      }
                    }}
                    disabled={!selectedHeroBundle}
                    style={{
                      padding: '0.875rem 2rem',
                      background: selectedHeroBundle
                        ? 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)'
                        : 'var(--gray-200)',
                      color: selectedHeroBundle ? 'white' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      cursor: selectedHeroBundle ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: selectedHeroBundle ? '0 4px 12px rgba(236, 72, 153, 0.3)' : 'none'
                    }}
                  >
                    <ShoppingCart size={18} />
                    Add to Cart
                  </button>
                </div>

                {/* Info Note */}
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  marginTop: '1rem',
                  fontStyle: 'italic'
                }}>
                  Hearts are added to your Rewards balance immediately after purchase. 10% of all Hero Hearts purchases support veterans and first responders.
                </p>
              </>
            )}

            {/* STATE 2: Confirmation */}
            {heroHeartsStep === 'confirmation' && lastAddedHeroBundle && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                {/* Success Icon */}
                <div style={{
                  width: '5rem',
                  height: '5rem',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                }}>
                  <Check size={40} style={{ color: 'white' }} />
                </div>

                {/* Confirmation Message */}
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  Added to Cart!
                </h3>

                <p style={{
                  fontSize: '1rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1.5rem'
                }}>
                  {lastAddedHeroBundle.name} ({lastAddedHeroBundle.totalHearts.toLocaleString()} ❤️)
                </p>

                {/* Item Summary */}
                <div style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem',
                  marginBottom: '0.75rem',
                  maxWidth: '320px',
                  margin: '0 auto 1.5rem'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Hero Hearts - {lastAddedHeroBundle.name}</span>
                    <span style={{ fontWeight: 600, color: '#ec4899' }}>${lastAddedHeroBundle.price}</span>
                  </div>
                  <div style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)'
                  }}>
                    {cartService.getCount()} {cartService.getCount() === 1 ? 'item' : 'items'} in cart
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'center',
                  maxWidth: '400px',
                  margin: '0 auto'
                }}>
                  {/* Continue Shopping - Secondary (outline) */}
                  <button
                    onClick={resetHeroHeartsModal}
                    style={{
                      flex: 1,
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
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <ShoppingCart size={18} />
                    Continue Shopping
                  </button>

                  {/* Checkout - Primary (solid) */}
                  <button
                    onClick={() => {
                      resetHeroHeartsModal();
                      navigate('/dashboard/cart');
                    }}
                    style={{
                      flex: 1,
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
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    Checkout
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
