import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import api from '../api/api';
import { getErrorMessage } from '../utils/errorMessages';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token found.');
      return;
    }

    api.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified!');
        setTimeout(() => navigate('/dashboard'), 3000);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(getErrorMessage(err));
      });
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        padding: 48,
        maxWidth: 440,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        {status === 'verifying' && (
          <>
            <Loader size={48} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
            <h2 style={{ marginTop: 16, color: '#222' }}>Verifying your email...</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={48} color="#22c55e" />
            <h2 style={{ marginTop: 16, color: '#222' }}>{message}</h2>
            <p style={{ color: '#666', marginTop: 8 }}>Redirecting to dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} color="#ef4444" />
            <h2 style={{ marginTop: 16, color: '#222' }}>Verification Failed</h2>
            <p style={{ color: '#666', marginTop: 8 }}>{message}</p>
            <button
              onClick={() => navigate('/login')}
              style={{
                marginTop: 24,
                padding: '10px 24px',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Go to Login
            </button>
          </>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
