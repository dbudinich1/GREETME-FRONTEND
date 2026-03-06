// src/components/DashboardLayout.jsx
import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Gift, ShoppingBag, Settings as SettingsIcon, LogOut, User, ShoppingCart, Film, X, Image as ImageIcon, QrCode } from 'lucide-react';
import GreetMeLogo from './GreetMeLogo';
import NotificationBell from './NotificationBell';
import cartService from '../services/cartService';
import imageCreditsService from '../services/imageCreditsService';
import GuidedSetupFlow, { shouldShowGuidedSetup } from './GuidedSetupFlow';

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 768);

  const [imageCredits, setImageCredits] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowGuidedSetup());

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Update cart count on mount and when window regains focus
    const updateCartCount = () => {
      setCartCount(cartService.getCount());
    };

    // Update image credits count
    const updateImageCredits = () => {
      setImageCredits(imageCreditsService.getCount());
    };

    updateCartCount();
    updateImageCredits();
    window.addEventListener('focus', updateCartCount);
    window.addEventListener('focus', updateImageCredits);

    // Custom events for updates
    window.addEventListener('cartUpdated', updateCartCount);
    window.addEventListener('imageCreditsUpdated', updateImageCredits);

    return () => {
      window.removeEventListener('focus', updateCartCount);
      window.removeEventListener('focus', updateImageCredits);
      window.removeEventListener('cartUpdated', updateCartCount);
      window.removeEventListener('imageCreditsUpdated', updateImageCredits);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Home', path: '/dashboard', icon: null },
    { name: 'Media Library', path: '/dashboard/media', icon: ImageIcon },
    { name: 'Plans & Pricing', path: '/pricing', icon: null },
    { name: 'For Business', path: '/business', icon: null },
    { name: 'Merch', path: '/dashboard/merch', icon: ShoppingBag },
    { name: 'American Marketplace', path: '/dashboard/gifts', icon: Gift },
    { name: '❤️ Rewards', path: '/dashboard/rewards', icon: null },
    { name: '🥇 Greet-Me™ Hero™', path: '/dashboard/hero', icon: null },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: isNarrow ? '0 1rem' : '0 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: isNarrow ? '4rem' : '7rem',
          gap: isNarrow ? '0.5rem' : '1rem'
        }}>
          {/* Hamburger Menu Button - Mobile Only */}
          {isNarrow && (
            <div style={{ minWidth: '2rem', flexShrink: 0 }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: mobileMenuOpen ? 'var(--gray-200)' : 'var(--gray-100)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
                padding: 0
              }}
            >
              {mobileMenuOpen ? (
                <X size={18} style={{ color: '#111827' }} />
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <span style={{ width: '14px', height: '2px', background: '#111827', borderRadius: '1px' }} />
                  <span style={{ width: '14px', height: '2px', background: '#111827', borderRadius: '1px' }} />
                  <span style={{ width: '14px', height: '2px', background: '#111827', borderRadius: '1px' }} />
                </div>
              )}
            </button>
            </div>
          )}

          {/* G1G1 Gold Foil Seal with Star-Point Edge - Static Decorative (Hide on mobile) */}
          {!isNarrow && (
        <div style={{ width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ position: 'relative', width: '90px', height: '90px' }}>
            {/* Star-point notched edge layer - 24 points around the circle */}
            {[...Array(24)].map((_, i) => {
              const angle = (i * 15) - 90; // 24 points = 15 degrees apart
              const radius = 45; // Distance from center
              const x = 45 + radius * Math.cos(angle * Math.PI / 180);
              const y = 45 + radius * Math.sin(angle * Math.PI / 180);
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`,
                    width: '6px',
                    height: '6px',
                    background: '#D4AF37',
                    transform: 'translate(-50%, -50%) rotate(45deg)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    pointerEvents: 'none'
                  }}
                />
              );
            })}

            {/* Main seal - Static decorative (no click) */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80px',
                height: '80px',
                borderRadius: '9999px',
                border: '2px solid #8B6914',
                background:
                  'radial-gradient(circle at 35% 35%, rgba(255,245,220,1) 0%, rgba(255,240,200,0.8) 15%, transparent 40%),' +
                  'radial-gradient(circle at 65% 65%, rgba(0,0,0,0.15) 0%, transparent 30%),' +
                  'repeating-conic-gradient(from 0deg, #E8D7A3 0deg 9deg, #C9A961 9deg 18deg, #F5E6C8 18deg 27deg, #D4AF37 27deg 36deg)',
                boxShadow:
                  '0 6px 16px rgba(0,0,0,0.25),' +
                  '0 12px 32px rgba(139,105,20,0.3),' +
                  'inset 0 2px 4px rgba(255,255,255,0.4),' +
                  'inset 0 -2px 4px rgba(0,0,0,0.2)',
                cursor: 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                padding: 0,
                fontFamily: 'inherit',
                zIndex: 10
              }}
            >
              {/* Faint G watermark - more visible */}
              <div style={{
                position: 'absolute',
                fontSize: '3rem',
                fontWeight: 900,
                color: 'rgba(139,105,20,0.15)',
                fontFamily: 'Georgia, serif',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 0
              }}>G</div>

              {/* Star decorations at cardinal points */}
              <span style={{
                position: 'absolute',
                top: '4px',
                fontSize: '10px',
                color: '#8B6914',
                opacity: 0.8,
                textShadow: '0 0 2px rgba(255,235,205,0.5)',
                pointerEvents: 'none',
                zIndex: 2
              }}>★</span>
              <span style={{
                position: 'absolute',
                bottom: '4px',
                fontSize: '10px',
                color: '#8B6914',
                opacity: 0.8,
                textShadow: '0 0 2px rgba(255,235,205,0.5)',
                pointerEvents: 'none',
                zIndex: 2
              }}>★</span>
              <span style={{
                position: 'absolute',
                left: '4px',
                fontSize: '8px',
                color: '#8B6914',
                opacity: 0.7,
                textShadow: '0 0 2px rgba(255,235,205,0.5)',
                pointerEvents: 'none',
                zIndex: 2
              }}>★</span>
              <span style={{
                position: 'absolute',
                right: '4px',
                fontSize: '8px',
                color: '#8B6914',
                opacity: 0.7,
                textShadow: '0 0 2px rgba(255,235,205,0.5)',
                pointerEvents: 'none',
                zIndex: 2
              }}>★</span>

              {/* Main content */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: 900,
                  color: '#3D2F0F',
                  letterSpacing: '1px',
                  textShadow: '0 1px 2px rgba(255,255,255,0.5)',
                  marginBottom: '2px'
                }}>G1G1™</div>
                <div style={{
                  fontSize: '0.5625rem',
                  fontWeight: 800,
                  color: '#4D3A12',
                  textShadow: '0 1px 1px rgba(255,255,255,0.3)',
                  lineHeight: 1.2
                }}>
                  <div>Greet One</div>
                  <div>Give One™</div>
                </div>
              </div>
            </div>
          </div>
        </div>
          )}

          {/* Centered Logo and Tagline */}
          <div style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
            minWidth: 0
          }}>
            <GreetMeLogo size={isNarrow ? 'small' : 'xlarge'} clickable={true} />
          </div>

          {/* Right side - Image Bank, Cart, User icon (equal spacing) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isNarrow ? '0.5rem' : '1rem', justifyContent: 'flex-end', flexShrink: 0, minWidth: isNarrow ? '6rem' : '120px' }}>
            {/* Image Bank - for tracking images */}
            <button
              onClick={() => navigate('/dashboard/animations')}
              style={{
                width: isNarrow ? '2rem' : '2.5rem',
                height: isNarrow ? '2rem' : '2.5rem',
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                position: 'relative',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--gray-100)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              title="Image Bank"
            >
              {/* Custom Bank Icon with $ */}
              <svg
                width={isNarrow ? 16 : 20}
                height={isNarrow ? 16 : 20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-secondary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Roof/Triangle */}
                <path d="M3 21h18" />
                <path d="M3 10h18" />
                <path d="M5 6l7-3 7 3" />
                {/* Pillars */}
                <path d="M4 10v11" />
                <path d="M20 10v11" />
                <path d="M8 10v11" />
                <path d="M16 10v11" />
                {/* Dollar sign in center */}
                <path d="M12 12v6" />
                <path d="M10 14h4c.5 0 1 .5 1 1s-.5 1-1 1h-2c-.5 0-1 .5-1 1s.5 1 1 1h4" style={{ strokeWidth: 1.5 }} />
              </svg>
              {imageCredits > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  background: '#22c55e',
                  color: 'white',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  minWidth: '1rem',
                  height: '1rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--bg-primary)'
                }}>
                  {imageCredits > 9 ? '9+' : imageCredits}
                </span>
              )}
            </button>

            {/* Shopping Cart Icon */}
            <button
              onClick={() => navigate('/dashboard/cart')}
              style={{
                width: isNarrow ? '2rem' : '2.5rem',
                height: isNarrow ? '2rem' : '2.5rem',
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                position: 'relative',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--gray-100)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              title="Shopping Cart"
            >
              <ShoppingCart size={isNarrow ? 16 : 20} style={{ color: 'var(--text-secondary)' }} />
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  minWidth: '1rem',
                  height: '1rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--bg-primary)'
                }}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>

            {/* User Icon with Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  width: isNarrow ? '2rem' : '2.5rem',
                  height: isNarrow ? '2rem' : '2.5rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: isNarrow ? '0.875rem' : '1rem',
                  padding: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title={user?.name || 'User'}
              >
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 10
                    }}
                    onClick={() => setUserMenuOpen(false)}
                  ></div>
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    marginTop: '0.5rem',
                    width: '12rem',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                    border: '1px solid var(--border)',
                    padding: '0.5rem',
                    zIndex: 20
                  }}>
                    <div style={{
                      padding: '0.75rem',
                      borderBottom: '1px solid var(--border)',
                      marginBottom: '0.5rem'
                    }}>
                      <p style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: 0
                      }}>{user?.name || 'User'}</p>
                      <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>{user?.email || 'user@example.com'}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.625rem 0.75rem',
                        fontSize: '0.875rem',
                        color: 'var(--error)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fef2f2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Slide-out Menu */}
      {isNarrow && mobileMenuOpen && (
        <>
          {/* Overlay */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 40
            }}
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Slide-out Menu */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '280px',
            background: 'var(--bg-primary)',
            zIndex: 50,
            boxShadow: '4px 0 20px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Menu Header */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <GreetMeLogo size="small" clickable={false} />
              <button
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* User Info */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--gray-50)'
            }}>
              <p style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0
              }}>Welcome, {user?.name?.split(' ')[0] || 'User'}!</p>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
                margin: '0.25rem 0 0 0'
              }}>{user?.email || ''}</p>
            </div>

            {/* Navigation Links */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {navigation.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.875rem 1rem',
                    textDecoration: 'none',
                    fontSize: '0.9375rem',
                    fontWeight: isActive ? 600 : 500,
                    borderRadius: 'var(--radius-md)',
                    background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-primary)',
                    marginBottom: '0.25rem'
                  })}
                >
                  {item.icon && <item.icon size={18} />}
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>

            {/* Menu Footer */}
            <div style={{
              padding: '1rem',
              borderTop: '1px solid var(--border)'
            }}>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  color: 'var(--error)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
              <a
                href="#/support"
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  marginTop: '0.25rem'
                }}
              >
                Support
              </a>
            </div>
          </div>
        </>
      )}

      {/* Horizontal Navigation Bar - Desktop Only */}
      {!isNarrow && (
      <nav style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        padding: '0 2rem',
        overflowX: 'visible',
        WebkitOverflowScrolling: 'touch',
        position: 'sticky',
        top: '7rem',
        zIndex: 49
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-evenly',
          alignItems: 'center'
        }}>
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem 1.25rem',
                textDecoration: 'none',
                fontSize: '1rem',
                fontWeight: 500,
                transition: 'all 0.2s',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                position: 'relative',
                whiteSpace: 'nowrap',
                flexShrink: 0
              })}
              onMouseEnter={(e) => {
                if (!e.currentTarget.getAttribute('aria-current')) {
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.getAttribute('aria-current')) {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              {({ isActive }) => (
                <>
                  {item.icon && (
                    <item.icon
                      size={16}
                      style={{ color: isActive ? 'var(--primary)' : 'currentColor' }}
                    />
                  )}
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, padding: isNarrow ? '1rem' : '2rem', overflowY: 'auto', background: 'var(--bg-secondary)', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Page-level Welcome greeting - only show on home page */}
          {location.pathname === '/dashboard' && (
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-tertiary)',
              margin: '0 0 1.5rem 0',
              fontWeight: 500
            }}>
              Welcome back, {user?.name?.split(' ')[0] || 'User'}!
            </p>
          )}
          {children || <Outlet />}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: isNarrow ? '1rem' : '1.25rem 2rem',
        textAlign: 'center',
        fontSize: '0.8125rem',
        color: 'var(--text-tertiary)',
      }}>
        <span>&copy; 2026 Greet-Me&trade;</span>
        <span style={{ margin: '0 0.5rem' }}>&middot;</span>
        <a href="#/legal" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms &amp; Privacy</a>
        <span style={{ margin: '0 0.5rem' }}>&middot;</span>
        <a href="#/support" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Support</a>
      </footer>

      {/* Guided Setup Flow — rendered outside <main> to escape its stacking context */}
      {showOnboarding && (
        <GuidedSetupFlow
          onComplete={() => setShowOnboarding(false)}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

    </div>
  );
}
