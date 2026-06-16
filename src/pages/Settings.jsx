// src/pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { Bell, Lock, CreditCard, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { getErrorMessage } from '../utils/errorMessages';

const TIER_DISPLAY = {
  free: 'Free',
  basic: 'Basic',
  close_circle: 'Close Circle',
  social_butterfly: 'Social Butterfly',
  unforgettable: 'Unlimited Unforgettable', // real backend key — NOT unlimited_unforgettable
  pro: 'Pro',
  premium: 'Premium',
  unlimited: 'Unlimited',
  small_business: 'Small Business',
  medium_business: 'Medium Business',
  enterprise: 'Enterprise',
  founder: 'Founder',
};
const STATUS_DISPLAY = { active: 'Active', past_due: 'Payment Issue', canceled: 'Canceled', refunded: 'Refunded' };
function g1g1Label(g) {
  if (!g) return 'Not Included';
  if (g.status === 'paused') return 'Not Included';
  if (g.status === 'failed') return 'Ready to Gift';
  if (g.status === 'created') return g.giftSent ? 'Gift Shared' : 'Ready to Gift';
  return 'Not Included';
}

export default function Settings() {
  const { user } = useAuth();
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState(null);
  const [g1g1, setG1g1] = useState(undefined);

  const planKey = user?.tier || user?.plan || 'free';
  const tierLabel = TIER_DISPLAY[planKey] || (planKey === 'free' ? 'Free' : 'Active Plan');
  const statusLabel = STATUS_DISPLAY[user?.subscriptionStatus] || (planKey === 'free' ? 'Free' : 'Active');

  useEffect(() => {
    let alive = true;
    api.get('/api/payments/g1g1-status')
      .then((res) => { if (alive) setG1g1(res?.g1g1 ?? null); })
      .catch(() => { if (alive) setG1g1(null); });
    return () => { alive = false; };
  }, []);

  const handleManageBilling = async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const data = await api.post('/api/payments/portal-session');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setBillingError('Unable to open billing portal. Please try again.');
      }
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setBillingLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Notifications */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Bell className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
          </div>
          <div className="space-y-3">
            <label className="flex items-center">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
              <span className="ml-3 text-gray-700">Email me when greetings are sent</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
              <span className="ml-3 text-gray-700">Remind me 7 days before upcoming occasions</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
              <span className="ml-3 text-gray-700">Send me monthly summary reports</span>
            </label>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Lock className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Security</h2>
          </div>
          <div className="space-y-3">
            <button className="text-blue-600 hover:text-blue-700 font-medium">
              Change Password
            </button>
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <CreditCard className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Billing</h2>
          </div>
          <div className="space-y-3">
            <p className="text-gray-600">Current Plan: <strong>{tierLabel}</strong></p>
            <p className="text-gray-600">Status: <strong>{statusLabel}</strong></p>
            {g1g1 !== undefined && (
              <p className="text-gray-600">Gift Benefit: <strong>{g1g1Label(g1g1)}</strong></p>
            )}
            {billingError && (
              <p className="text-sm text-red-600">{billingError}</p>
            )}
            {(() => {
              const hasBillingRelationship =
                ['active', 'past_due', 'canceled', 'trialing'].includes(user?.subscriptionStatus) ||
                user?.paymentLocked === true;
              return hasBillingRelationship ? (
                <button
                  onClick={handleManageBilling}
                  disabled={billingLoading}
                  className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                >
                  {billingLoading ? 'Opening...' : 'Manage Billing'}
                </button>
              ) : (
                <button
                  onClick={() => window.location.href = '/pricing'}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  View Plans
                </button>
              );
            })()}
          </div>
        </div>

        {/* Data */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Database className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Data & Privacy</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            To request a copy of your data or to delete your account, email us at the
            address below. We process all requests within 30 days, as described in our{' '}
            <a href="/#/legal" className="text-blue-600 hover:underline">privacy policy</a>.
          </p>
          <div className="space-y-3">
            <a
              href="mailto:support@greet-me.com?subject=Data%20Export%20Request"
              className="block text-blue-600 hover:text-blue-700 font-medium"
            >
              Request a copy of my data — support@greet-me.com
            </a>
            <a
              href="mailto:support@greet-me.com?subject=Account%20Deletion%20Request"
              className="block text-red-600 hover:text-red-700 font-medium"
            >
              Request account deletion — support@greet-me.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
