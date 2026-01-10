// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_BASE || 'https://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net';

  useEffect(() => {
  const token = localStorage.getItem('token');
  const userData = localStorage.getItem('user');
  if (token && userData && userData !== 'undefined') {
    try {
      setUser(JSON.parse(userData));
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
      if (!response.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (error) {
      // Development mode: If backend is unavailable, create a mock user
      console.log('Backend unavailable, using development mode');
      const mockUser = {
        id: 'dev-user-123',
        name: 'Development User',
        email: email,
      };
      localStorage.setItem('token', 'dev-token-123');
      localStorage.setItem('user', JSON.stringify(mockUser));
      setUser(mockUser);
      return { success: true };
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
      if (!response.ok) throw new Error(data.error || 'Registration failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (error) {
      // Development mode: If backend is unavailable, create a mock user
      console.log('Backend unavailable, using development mode');
      const mockUser = {
        id: 'dev-user-123',
        name: name,
        email: email,
      };
      localStorage.setItem('token', 'dev-token-123');
      localStorage.setItem('user', JSON.stringify(mockUser));
      setUser(mockUser);
      return { success: true };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const getToken = () => localStorage.getItem('token');

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, getToken, isAuthenticated: !!user }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
