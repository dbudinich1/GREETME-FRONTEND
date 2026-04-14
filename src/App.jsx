// src/App.jsx
import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

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
// BINARY SEARCH ROUND 2 — B1 uncommented, B2 still commented
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
// BINARY SEARCH ROUND 3 — B2a uncommented, B2b still commented
import CourtesyCredit from "./pages/CourtesyCredit";
import CreditClaim from "./pages/CreditClaim";
import G1G1Claim from "./pages/G1G1Claim";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCanceled from "./pages/PaymentCanceled";
import FounderDashboard from "./pages/FounderDashboard";
// BINARY SEARCH ROUND 6 — QAInspector commented, Support active
// import QAInspector from "./pages/QAInspector";
import Support from "./pages/Support";
// import Legal from "./Legal";
// import VerifyEmail from "./pages/VerifyEmail";
// import AppInstall from "./pages/AppInstall";

export default function App() {
  // TEMPORARY DIAGNOSTIC — remove after confirming App-level imports don't crash
  return (
    <div style={{ padding: '4rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#10b981' }}>App.jsx Boot Test</h1>
      <p>If you see this, all 48 imports resolved and App renders.</p>
      <p>The crash is inside AuthProvider, HashRouter, or Routes.</p>
    </div>
  );
}
