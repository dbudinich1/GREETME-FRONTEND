// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { getErrorMessage } from '../utils/errorMessages';

// Safari private browsing throws SecurityError on localStorage access.
// These helpers prevent that from crashing the app.
function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, val) { try { localStorage.setItem(key, val); } catch {} }
function safeRemove(key) { try { localStorage.removeItem(key); } catch {} }

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_BASE || '';
  if (!API_URL) console.error("VITE_API_BASE is missing — API calls will fail");

  // Fetch profile to hydrate photoUrl (safe: does not block login if fails)
  const fetchAndHydrateProfile = async (token, currentUser) => {
    try {
      const res = await fetch(`${API_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const photoUrl = data.profile?.photoUrl || null;
      const voiceId = data.profile?.voiceId || null;
      const voiceUrl = data.profile?.voiceUrl || null;
      const plan = data.profile?.plan || currentUser.plan || 'free';
      const tier = data.profile?.tier || currentUser.tier || 'free';
      const entitlements = data.profile?.entitlements || currentUser.entitlements || null;
      const subscriptionStatus = data.profile?.subscriptionStatus || null;
      const paymentLocked = data.profile?.paymentLocked || false;
      const emailVerified = data.profile?.emailVerified === true;
      const voiceIdStaleAt = data.profile?.voiceIdStaleAt || null;
      const voiceIdStaleReason = data.profile?.voiceIdStaleReason || null;
      const updatedUser = { ...currentUser, photoUrl, voiceId, voiceUrl, plan, tier, entitlements, subscriptionStatus, paymentLocked, emailVerified, voiceIdStaleAt, voiceIdStaleReason };
      safeSet('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err) {
      // Silent fail: do not break login flow
    }
  };

  // Force re-hydrate profile from backend (call after photo/voice upload)
  const refreshProfile = async () => {
    const token = safeGet('token');
    if (!token || !user) return;
    await fetchAndHydrateProfile(token, user);
  };

  useEffect(() => {
    // Recipient mode: skip hydration, stay as guest
    if (sessionStorage.getItem('greetme_session_mode') === 'recipient') {
      setLoading(false);
      return;
    }
    const token = safeGet('token');
    const userData = safeGet('user');
    if (token && userData && userData !== 'undefined') {
      try {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        // Hydrate profile (photoUrl) from backend
        fetchAndHydrateProfile(token, parsed);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        safeRemove('token');
        safeRemove('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        const err = new Error(data.error || 'Login failed');
        err.code = data.code;
        err.status = response.status;
        throw err;
      }
      safeSet('token', data.token);
      safeSet('user', JSON.stringify(data.user));
      // Clear stale media from previous session to prevent cross-account bleed
      safeRemove('greetme_voice_file');
      setUser(data.user);
      // Hydrate photoUrl from backend profile (fire-and-forget)
      fetchAndHydrateProfile(data.token, data.user);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: getErrorMessage(error), code: error.code, status: error.status };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        const err = new Error(data.error || 'Registration failed');
        err.code = data.code;
        err.status = response.status;
        throw err;
      }
      safeSet('token', data.token);
      safeSet('user', JSON.stringify(data.user));
      // Clear stale onboarding state so new registration always gets fresh onboarding
      safeRemove('greetme_setup_state');
      // Clear account-specific cached media from any previous account
      safeRemove('greetme_media_library');
      safeRemove('greetme_voice_file');
      safeRemove('greetme_recipients');
      setUser(data.user);
      // Hydrate photoUrl from backend profile (fire-and-forget)
      fetchAndHydrateProfile(data.token, data.user);
      return { success: true };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: getErrorMessage(error), code: error.code, status: error.status };
    }
  };

  const logout = () => {
    safeRemove('token');
    safeRemove('user');
    // Clear account-specific cached media to prevent bleed-through on next login
    safeRemove('greetme_media_library');
    safeRemove('greetme_voice_file');
    safeRemove('greetme_recipients');
    safeRemove('greetme_cart');
    safeRemove('greetme_drafts');
    setUser(null);
  };

  const updateUser = (updates) => {
    if (!user) return;

    const updatedUser = { ...user, ...updates };
    safeSet('user', JSON.stringify(updatedUser));

    try {
      const rehydrated = JSON.parse(safeGet('user'));
      setUser(rehydrated);
    } catch (e) {
      setUser(updatedUser);
    }
  };

  const getToken = () => safeGet('token');

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, getToken, refreshProfile, isAuthenticated: !!user }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
