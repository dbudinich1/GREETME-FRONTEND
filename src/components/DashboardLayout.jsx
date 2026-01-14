// src/components/DashboardLayout.jsx
import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Gift, ShoppingBag, Settings as SettingsIcon, LogOut, User, ShoppingCart, Film, Image } from 'lucide-react';
import GreetMeLogo from './GreetMeLogo';
import NotificationBell from './NotificationBell';

// TEMP STUB — services layer intentionally disabled for V1 build safety
const animationBankService = {
  getCount: () => 0,
  hasAccess: () => false,
};

const cartService = {
  getCount: () => 0,
};


export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [animationCount, setAnimationCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);



  useEffect(() => {
    // Update cart count on mount and when window regains focus
    const updateCartCount = () => {
      setCartCount(cartService.getCount());
    };

    // Update animation count
    const updateAnimationCount = () => {
      setAnimationCount(animationBankService.getCount());
    };

    updateCartCount();
    updateAnimationCount();
    window.addEventListener('focus', updateCartCount);

    // Custom event for cart updates
    window.addEventListener('cartUpdated', updateCartCount);

    return () => {
      window.removeEventListener('focus', updateCartCount);
      window.removeEventListener('cartUpdated', updateCartCount);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Home', path: '/', icon: null },
    { name: 'Dashboard', path: '/dashboard', icon: null },
    { name: 'Media Library', path: '/dashboard/media', icon: Image },
    { name: 'Plans & Pricing', path: '/pricing', icon: null },
    { name: 'For Business', path: '/business', icon: null },
    { name: 'Merch', path: '/dashboard/merch', icon: ShoppingBag },
    { name: 'American Marketplace', path: '/dashboard/gifts', icon: Gift },
    { name: '❤️ Rewards', path: '/dashboard/rewards', icon: null },
    { name: '🥇 Greet-Me Hero™', path: '/dashboard/hero', icon: null },
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
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '7rem'
        }}>
          {/* G1G1 Gold Foil Seal with Star-Point Edge */}
        <div style={{ width: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

            {/* Main seal button */}
            <button
              onClick={() => navigate('/dashboard/hero')}
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
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                padding: 0,
                fontFamily: 'inherit',
                zIndex: 10
              }}
              onMouseEnter={(e) => {
                e.currentTarget.parentElement.style.transform = 'scale(1.05) rotate(2deg)';
                e.currentTarget.style.boxShadow =
                  '0 8px 24px rgba(0,0,0,0.3),' +
                  '0 16px 48px rgba(139,105,20,0.4),' +
                  'inset 0 2px 4px rgba(255,255,255,0.5),' +
                  'inset 0 -2px 4px rgba(0,0,0,0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.parentElement.style.transform = 'scale(1) rotate(0deg)';
                e.currentTarget.style.boxShadow =
                  '0 6px 16px rgba(0,0,0,0.25),' +
                  '0 12px 32px rgba(139,105,20,0.3),' +
                  'inset 0 2px 4px rgba(255,255,255,0.4),' +
                  'inset 0 -2px 4px rgba(0,0,0,0.2)';
              }}
              title="Greet-Me Hero™"
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
            </button>
          </div>
        </div>

          {/* Centered Logo and Title */}
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <GreetMeLogo size="medium" clickable={true} />
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              margin: '0.5rem 0 0 0'
            }}>Welcome back, {user?.name?.split(' ')[0] || 'User'}!</p>
          </div>

          {/* Right side - Animation Bank, Cart, Settings and User icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '200px', justifyContent: 'flex-end' }}>
            {/* Animation Bank - Film icon with count */}
            <button
              onClick={() => navigate('/dashboard/animations')}
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                border: 'none',
                background: '#8b5cf6',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                position: 'relative',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#7c3aed';
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#8b5cf6';
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
              }}
              title="Animation Bank"
            >
              <Film size={20} style={{ color: '#FFD700' }} />
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                background: '#10b981',
                color: 'white',
                fontSize: '0.625rem',
                fontWeight: 700,
                width: '1.125rem',
                height: '1.125rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                {animationCount > 9 ? '9+' : animationCount}
              </span>
            </button>

            {/* Cart Icon - Gold in Blue Bubble */}
            <button
              onClick={() => navigate('/dashboard/cart')}
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                border: 'none',
                background: '#667eea',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                position: 'relative',
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#5568d3';
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#667eea';
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
              }}
              title="Shopping Cart"
            >
              <ShoppingCart
                size={22}
                style={{
                  color: '#FFD700',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                  strokeWidth: 2.5
                }}
              />
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  width: '1.125rem',
                  height: '1.125rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Settings Cog */}
            <button
              onClick={() => navigate('/dashboard/settings')}
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--gray-100)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              title="Settings"
            >
              <SettingsIcon size={20} style={{ color: 'var(--text-secondary)' }} />
            </button>

            {/* User Icon with Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '1rem'
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
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/dashboard/profile');
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.625rem 0.75rem',
                        fontSize: '0.875rem',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        marginBottom: '0.25rem'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--gray-100)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <User size={16} />
                      <span>Profile</span>
                    </button>
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

      {/* Horizontal Navigation Bar */}
      <nav style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        padding: '0 2rem'
      }}>
        <div style={{
          maxWidth: '1400px',
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
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.2s',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                position: 'relative'
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

      {/* Main Content */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
