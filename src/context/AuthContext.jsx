// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { getErrorMessage } from '../utils/errorMessages';

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
      const updatedUser = { ...currentUser, photoUrl, voiceId, voiceUrl, plan, tier, entitlements, subscriptionStatus, paymentLocked };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err) {
      // Silent fail: do not break login flow
    }
  };

  // Force re-hydrate profile from backend (call after photo/voice upload)
  const refreshProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;
    await fetchAndHydrateProfile(token, user);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData && userData !== 'undefined') {
      try {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        // Hydrate profile (photoUrl) from backend
        fetchAndHydrateProfile(token, parsed);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      // Clear stale media from previous session to prevent cross-account bleed
      localStorage.removeItem('greetme_voice_file');
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
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      // Clear stale onboarding state so new registration always gets fresh onboarding
      localStorage.removeItem('greetme_setup_state');
      // Clear account-specific cached media from any previous account
      localStorage.removeItem('greetme_media_library');
      localStorage.removeItem('greetme_voice_file');
      localStorage.removeItem('greetme_recipients');
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Clear account-specific cached media to prevent bleed-through on next login
    localStorage.removeItem('greetme_media_library');
    localStorage.removeItem('greetme_voice_file');
    localStorage.removeItem('greetme_recipients');
    localStorage.removeItem('greetme_cart');
    localStorage.removeItem('greetme_drafts');
    setUser(null);
  };

  const updateUser = (updates) => {
    if (!user) return;

    const updatedUser = { ...user, ...updates };
    localStorage.setItem('user', JSON.stringify(updatedUser));

    try {
      const rehydrated = JSON.parse(localStorage.getItem('user'));
      setUser(rehydrated);
    } catch (e) {
      setUser(updatedUser);
    }
  };

  const getToken = () => localStorage.getItem('token');

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
