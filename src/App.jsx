// src/App.jsx
import React from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";

import Register from "./pages/Register";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
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
import ReferralCredit from "./pages/ReferralCredit";
import ThankYouFlow from "./pages/ThankYouFlow";
// RecipientThankYouWizard decommissioned — redirect below
function RecipientThankYouRedirect() {
  const location = useLocation();
  return <Navigate to={`/thank-you${location.search || ''}`} replace />;
}
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught rendering error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ maxWidth: '400px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', margin: '0 0 0.75rem' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '1rem', color: '#6b7280', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
              We hit a small hiccup. Let&rsquo;s get you back.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 2rem', background: '#4F2D7F', color: '#fff',
                border: 'none', borderRadius: '0.5rem', fontSize: '1rem',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import CourtesyCredit from "./pages/CourtesyCredit";
import CreditClaim from "./pages/CreditClaim";
import G1G1Claim from "./pages/G1G1Claim";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCanceled from "./pages/PaymentCanceled";
import FounderDashboard from "./pages/FounderDashboard";
import QAInspector from "./pages/QAInspector";
import Support from "./pages/Support";
import Legal from "./Legal";
import VerifyEmail from "./pages/VerifyEmail";
import AppInstall from "./pages/AppInstall";

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <ErrorBoundary>
        <Routes>
          {/* Default route: landing page for guests, redirects auth users to dashboard */}
          <Route path="/" element={<Landing />} />

          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/redeem/qr-cash/:id" element={<RedeemQRCash />} />
          <Route path="/greeting/:greetingId" element={<RecipientGreeting />} />
          <Route path="/g/:jobId" element={<PublicGreetingCard />} />
          <Route path="/gift/g1g1/:giftCode" element={<G1G1Claim />} />
          <Route path="/gift/:claimToken" element={<GiftClaim />} />
          <Route path="/credit/:referralCode" element={<ReferralCredit />} />
          <Route path="/thank-you" element={<ThankYouFlow />} />
          <Route path="/recipient-thankyou" element={<RecipientThankYouRedirect />} />
          <Route path="/courtesy-credit" element={<CourtesyCredit />} />
          <Route path="/claim-credit/:creditCode" element={<CreditClaim />} />

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

          {/* Founder Dashboard (admin key protected at API level) */}
          <Route path="/admin" element={<FounderDashboard />} />
          <Route path="/qa" element={<QAInspector />} />
          <Route path="/app" element={<AppInstall />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </HashRouter>
    </AuthProvider>
  );
}
