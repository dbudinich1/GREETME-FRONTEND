// src/App.jsx
import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";

import Register from "./pages/Register";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import DashboardHome from "./pages/DashboardHome";
import Profile from "./pages/Profile";
import Recipients from "./pages/Contacts";
import Settings from "./pages/Settings";
import SendGreeting from "./pages/SendGreeting";
import SentGreetings from "./pages/SentGreetings";
import MediaLibrary from "./pages/MediaLibrary";
import LandingPage from "./pages/LandingPage";
import Pricing from "./pages/Pricing";
import Gifts from "./pages/Gifts";
import Cart from "./pages/Cart";
import Merch from "./pages/Merch";
import HeroProgram from "./pages/HeroProgram";
import AnimationBank from "./pages/AnimationBank";

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Default route: keep it on a tracked page */}
          <Route path="/" element={<Login />} />

          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="contacts" element={<Recipients />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="send" element={<SendGreeting />} />
            <Route path="sent" element={<SentGreetings />} />
            <Route path="media" element={<MediaLibrary />} />
            <Route path="cart" element={<Cart />} />
            <Route path="merch" element={<Merch />} />
            <Route path="gifts" element={<Gifts />} />
            <Route path="hero" element={<HeroProgram />} />
            <Route path="animations" element={<AnimationBank />} />
          </Route>

          {/* Public Landing and Pricing */}
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
