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
import Checkout from "./pages/Checkout";
import Merch from "./pages/Merch";
import HeroProgram from "./pages/HeroProgram";
import AnimationBank from "./pages/AnimationBank";
import Invitations from "./pages/Invitations";
import RedeemQRCash from "./pages/RedeemQRCash";
import ForBusiness from "./pages/ForBusiness";
import Rewards from "./pages/Rewards";
import Notifications from "./pages/Notifications";
import RecipientGreeting from "./pages/RecipientGreeting";
import PublicGreetingCard from "./pages/PublicGreetingCard";
import GiftClaim from "./pages/GiftClaim";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCanceled from "./pages/PaymentCanceled";
import Support from "./pages/Support";
import Legal from "./Legal";
import VerifyEmail from "./pages/VerifyEmail";

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
          <Route path="/redeem/qr-cash/:id" element={<RedeemQRCash />} />
          <Route path="/greeting/:greetingId" element={<RecipientGreeting />} />
          <Route path="/g/:jobId" element={<PublicGreetingCard />} />
          <Route path="/gift/:claimToken" element={<GiftClaim />} />

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
            <Route path="checkout" element={<Checkout />} />
            <Route path="merch" element={<Merch />} />
            <Route path="gifts" element={<Gifts />} />
            <Route path="hero" element={<HeroProgram />} />
            <Route path="animations" element={<AnimationBank />} />
            <Route path="invitations" element={<Invitations />} />
            <Route path="rewards" element={<Rewards />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>

          {/* Public Landing and Pricing */}
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/pricing" element={<DashboardLayout><Pricing /></DashboardLayout>} />
          <Route path="/business" element={<DashboardLayout><ForBusiness /></DashboardLayout>} />

          {/* Email Verification (Public) */}
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Payment Routes (Public) */}
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/canceled" element={<PaymentCanceled />} />

          {/* Support & Legal (Public) */}
          <Route path="/support" element={<Support />} />
          <Route path="/legal" element={<Legal />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
