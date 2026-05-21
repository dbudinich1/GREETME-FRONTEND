// src/pages/Login.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../utils/errorMessages";
import { Mail, Lock, QrCode, Smartphone } from "lucide-react";
import GreetMeLogo from "../components/GreetMeLogo";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 420);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 420);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);

    if (result?.success) {
      sessionStorage.removeItem('greetme_session_mode');
      const pendingG1G1 = localStorage.getItem('greetme_g1g1_gift_code');
      if (pendingG1G1) {
        localStorage.removeItem('greetme_g1g1_gift_code');
        navigate(`/gift/g1g1/${pendingG1G1}`);
      } else {
        const pendingCredit = localStorage.getItem('greetme_pending_credit');
        if (pendingCredit) {
          localStorage.removeItem('greetme_pending_credit');
          navigate(`/claim-credit/${pendingCredit}`);
        } else {
          const pendingReferral = localStorage.getItem('greetme_referral_code');
          if (pendingReferral) {
            localStorage.removeItem('greetme_referral_code');
            navigate(`/dashboard/send?referral=${pendingReferral}`);
          } else {
            navigate("/dashboard");
          }
        }
      }
    } else {
      setError(getErrorMessage(result));
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      maxWidth: '100%'
    }}>
      {/* Header */}
      <header style={{
        padding: isNarrow ? '1rem' : '1.5rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <GreetMeLogo size={isNarrow ? "small" : "medium"} clickable={false} variant="light" />

        <div style={{ display: 'flex', gap: isNarrow ? '0.5rem' : '1rem' }}>
          <Link
            to="/"
            style={{
              padding: isNarrow ? '0.5rem 0.75rem' : '0.75rem 1.5rem',
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: isNarrow ? '0.875rem' : '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'opacity 0.2s'
            }}
          >
            Home
          </Link>
          <Link
            to="/register"
            style={{
              padding: isNarrow ? '0.5rem 1rem' : '0.75rem 2rem',
              background: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              color: '#667eea',
              fontSize: isNarrow ? '0.875rem' : '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease',
              display: 'inline-block'
            }}
          >
            Register
          </Link>
        </div>
      </header>

      {/* Content Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isNarrow ? '1rem' : '2rem'
      }}>
        {/* Sign In Pane */}
        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: 'white',
          borderRadius: 'var(--radius-xl)',
          padding: isNarrow ? '1.25rem' : '2rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          boxSizing: 'border-box'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Welcome Back!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Sign in to continue spreading joy
            </p>
          </div>

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '2px solid #fecaca',
              color: '#dc2626',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '0.5rem',
                height: '0.5rem',
                background: '#dc2626',
                borderRadius: '50%'
              }}></div>
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem'
              }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '1rem',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}>
                  <Mail style={{ color: 'var(--text-tertiary)' }} size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '2.75rem',
                    paddingRight: '1rem',
                    paddingTop: '0.75rem',
                    paddingBottom: '0.75rem',
                    border: '2px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem'
              }}>Password</label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '1rem',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}>
                  <Lock style={{ color: 'var(--text-tertiary)' }} size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '2.75rem',
                    paddingRight: '1rem',
                    paddingTop: '0.75rem',
                    paddingBottom: '0.75rem',
                    border: '2px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Link
                to="/forgot-password"
                style={{
                  fontSize: '0.875rem',
                  color: '#667eea',
                  fontWeight: 500,
                  textDecoration: 'none'
                }}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: '#667eea',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            {/* SSO Buttons inside form */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: '1px',
                  background: 'var(--border)'
                }}></div>
                <div style={{
                  position: 'relative',
                  textAlign: 'center',
                  background: 'white',
                  display: 'inline-block',
                  padding: '0 1rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-tertiary)',
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}>
                  Or continue with
                </div>
              </div>

              <button
                type="button"
                onClick={() => alert('SSO Button 1 - Integration coming soon')}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'white',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: '0.75rem',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s'
                }}
              >
                SSO Button 1
              </button>

              <button
                type="button"
                onClick={() => alert('SSO Button 2 - Integration coming soon')}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'white',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s'
                }}
              >
                SSO Button 2
              </button>
            </div>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Don't have an account?{' '}
              <Link
                to="/register"
                style={{
                  color: '#667eea',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                Sign up for free
              </Link>
            </p>
          </div>

          {/* Mobile App Download QR Code */}
          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border)',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem'
            }}>
              <Smartphone size={18} style={{ color: '#667eea' }} />
              <span style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}>Get the Mobile App</span>
            </div>
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.75rem'
            }}>
              Scan to download and send greetings on the go
            </p>
            <div style={{
              display: 'inline-flex',
              padding: '0.75rem',
              background: 'white',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--border)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                <QrCode size={64} style={{ color: '#667eea' }} />
                <div style={{
                  position: 'absolute',
                  inset: '8px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gridTemplateRows: 'repeat(8, 1fr)',
                  gap: '1px',
                  pointerEvents: 'none'
                }}>
                  {[...Array(64)].map((_, i) => (
                    <div key={i} style={{
                      background: [0,1,2,5,6,7,8,15,16,23,40,47,48,55,56,57,58,61,62,63,9,14,17,22,41,46,49,54,10,13,18,21,42,45,50,53,11,12,19,20,43,44,51,52,27,28,35,36].includes(i) ? '#667eea' : 'transparent',
                      borderRadius: '1px'
                    }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
