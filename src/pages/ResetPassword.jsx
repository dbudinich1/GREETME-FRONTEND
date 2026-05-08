// src/pages/ResetPassword.jsx
// Reset-password landing flow — handles email-link target /#/reset-password?token=X&email=Y
// Backend endpoint: POST /api/auth/reset-password { token, email, newPassword }

import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import GreetMeLogo from '../components/GreetMeLogo';
import api from '../api/api';

// Must match backend PASSWORD_REGEX (authRoutes.js:16):
// ^(?=.*[A-Z])(?=.*\d).{8,}$ — 8+ chars, >=1 uppercase, >=1 digit
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const tokenInvalid = !token || !email;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      setError('Password must be at least 8 characters and include an uppercase letter and a number.');
      return;
    }

    setLoading(true);
    try {
      await api.request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, email, newPassword: password }),
      });
      setSuccess(true);
    } catch (err) {
      if (err?.code === 'INVALID_TOKEN' || err?.message?.toLowerCase?.().includes('expired')) {
        setError('This reset link has expired or is invalid. Please request a new one.');
      } else if (err?.code === 'WEAK_PASSWORD') {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError(err?.message || 'Could not reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <GreetMeLogo size="large" clickable={false} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
          {!tokenInvalid && !success && (
            <p className="text-gray-600">Enter a new password for your account.</p>
          )}
        </div>

        {tokenInvalid ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            This reset link is invalid. Please request a new one.
          </div>
        ) : success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
            Your password has been reset. You can now sign in with your new password.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                autoComplete="new-password"
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-500">At least 8 characters with an uppercase letter and a number</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-gray-600">
          {tokenInvalid ? (
            <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 font-medium">
              Request a new reset link
            </Link>
          ) : success ? (
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          ) : (
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Back to Sign In
            </Link>
          )}
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
