// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {

  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Where the visitor was going travels with the redirect; Login honours it only for the pages that ask for it
  // (utils/paymentMethod loginReturnPath), so every other route still lands on the dashboard after signing in.
  return isAuthenticated ? children : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search || ''}` }} />;
};
