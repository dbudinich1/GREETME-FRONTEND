// src/pages/RedeemQRCash.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gift, CheckCircle, AlertCircle } from 'lucide-react';

export default function RedeemQRCash() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [gift, setGift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [deposited, setDeposited] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is logged in by checking for auth token
    const token = localStorage.getItem('greetme_token');
    setIsLoggedIn(!!token);

    // Load gift data from localStorage
    try {
      const gifts = JSON.parse(localStorage.getItem('greetme_qrcash_gifts') || '[]');
      const foundGift = gifts.find(g => g.id === id);

      if (foundGift) {
        setGift(foundGift);
        if (foundGift.redeemed) {
          setDeposited(true);
        }
      } else {
        setError('Gift not found or invalid QR code');
      }
    } catch (err) {
      console.error('Error loading gift:', err);
      setError('Failed to load gift data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleDeposit = () => {
    if (!isLoggedIn) {
      // Redirect to login/signup with return URL
      navigate('/login', { state: { returnUrl: `/redeem/qr-cash/${id}` } });
      return;
    }

    setDepositing(true);

    // Simulate deposit process
    setTimeout(() => {
      try {
        // Mark gift as deposited in localStorage
        const gifts = JSON.parse(localStorage.getItem('greetme_qrcash_gifts') || '[]');
        const updatedGifts = gifts.map(g =>
          g.id === id ? { ...g, redeemed: true, redeemedAt: new Date().toISOString() } : g
        );
        localStorage.setItem('greetme_qrcash_gifts', JSON.stringify(updatedGifts));

        // Update user's QR Cash balance (for now, just store in localStorage)
        const currentBalance = parseFloat(localStorage.getItem('greetme_qrcash_balance') || '0');
        const newBalance = currentBalance + parseFloat(gift.amount);
        localStorage.setItem('greetme_qrcash_balance', newBalance.toString());

        setDeposited(true);
        setDepositing(false);
      } catch (err) {
        console.error('Error depositing gift:', err);
        setError('Failed to deposit gift. Please try again.');
        setDepositing(false);
      }
    }, 1500);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>Loading gift...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        padding: '2rem'
      }}>
        <div style={{
          maxWidth: '500px',
          width: '100%',
          background: 'white',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          <AlertCircle size={64} style={{ color: '#ef4444', marginBottom: '1rem' }} />
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem'
          }}>
            Oops!
          </h1>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            marginBottom: '1.5rem'
          }}>
            {error}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.3)';
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (deposited) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        padding: '2rem'
      }}>
        <div style={{
          maxWidth: '500px',
          width: '100%',
          background: 'white',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{
            width: '5rem',
            height: '5rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}>
            <CheckCircle size={48} style={{ color: 'white' }} />
          </div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem'
          }}>
            ✅ Cash Received
          </h1>
          <p style={{
            fontSize: '1.125rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.75rem'
          }}>
            Your cash has been successfully delivered.
          </p>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-tertiary)',
            marginBottom: '1.5rem'
          }}>
            The sender has been notified.
          </p>
          {gift.message && (
            <div style={{
              padding: '1rem',
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '1.5rem',
              borderLeft: '4px solid #f59e0b'
            }}>
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                margin: 0
              }}>
                "{gift.message}"
              </p>
              {gift.recipientName && gift.recipientName !== 'Anonymous' && (
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                  marginTop: '0.5rem',
                  marginBottom: 0
                }}>
                  - From the Greet-Me team
                </p>
              )}
            </div>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)',
              fontFamily: 'inherit',
              marginBottom: '0.75rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.3)';
            }}
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => navigate('/dashboard/send')}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: 'white',
              color: '#f59e0b',
              border: '2px solid #f59e0b',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f59e0b';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.color = '#f59e0b';
            }}
          >
            Send a Greeting
          </button>
        </div>
      </div>
    );
  }

  // Main redemption view
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: '2rem',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{
          width: '5rem',
          height: '5rem',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)'
        }}>
          <Gift size={48} style={{ color: 'white' }} />
        </div>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem'
        }}>
          Scan to deposit your cash
        </h1>
        <div style={{
          fontSize: '3rem',
          fontWeight: 700,
          color: '#f59e0b',
          marginBottom: '1rem'
        }}>
          ${gift.amount}
        </div>
        {gift.recipientName && gift.recipientName !== 'Anonymous' && (
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            marginBottom: '1rem'
          }}>
            For: <strong>{gift.recipientName}</strong>
          </p>
        )}
        {gift.message && (
          <div style={{
            padding: '1rem',
            background: 'var(--gray-50)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '1.5rem',
            borderLeft: '4px solid #f59e0b'
          }}>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
              margin: 0
            }}>
              "{gift.message}"
            </p>
          </div>
        )}
        <p style={{
          fontSize: '0.9375rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem',
          lineHeight: 1.6
        }}>
          {isLoggedIn
            ? 'Click below to deposit this cash to your account.'
            : 'Sign in or create a free account to deposit this gift.'}
        </p>
        <button
          onClick={handleDeposit}
          disabled={depositing}
          style={{
            width: '100%',
            padding: '0.875rem',
            background: depositing ? 'var(--gray-300)' : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: depositing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)',
            fontFamily: 'inherit',
            marginBottom: '0.75rem'
          }}
          onMouseEnter={(e) => {
            if (!depositing) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (!depositing) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.3)';
            }
          }}
        >
          {depositing ? 'Depositing...' : isLoggedIn ? 'Deposit Now' : 'Sign In to Deposit'}
        </button>
        {!isLoggedIn && (
          <p style={{
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
            margin: 0
          }}>
            Don't have an account? You'll be able to create one on the next page.
          </p>
        )}
      </div>
    </div>
  );
}
