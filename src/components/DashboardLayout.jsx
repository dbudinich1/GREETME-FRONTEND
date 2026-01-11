// src/components/DashboardLayout.jsx
import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Gift, ShoppingBag, Settings as SettingsIcon, LogOut, User, ShoppingCart, Film } from 'lucide-react';

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
    { name: 'Home', path: '/', icon: Home },
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'Plans & Pricing', path: '/pricing', icon: null },
    { name: 'Shopping Cart', path: '/dashboard/cart', icon: ShoppingCart },
    { name: 'Merch', path: '/dashboard/merch', icon: ShoppingBag },
    { name: 'American-Made Marketplace', path: '/dashboard/gifts', icon: Gift },
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
          height: '4rem'
        }}>
          {/* Empty left space */}
          <div style={{ width: '150px' }}></div>

          {/* Centered Title */}
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0
            }}>Dashboard</h1>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              margin: 0
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
