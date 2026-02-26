// src/pages/Settings.jsx
import React, { useState } from 'react';
import { Bell, Lock, CreditCard, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { getErrorMessage } from '../utils/errorMessages';

const TIER_DISPLAY = {
  free: 'Free',
  basic: 'Basic',
  close_circle: 'Close Circle',
  pro: 'Pro',
  premium: 'Premium',
  unlimited: 'Unlimited',
};

export default function Settings() {
  const { user } = useAuth();
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState(null);

  const tierLabel = TIER_DISPLAY[user?.tier] || TIER_DISPLAY[user?.plan] || user?.tier || 'Free';

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
            {billingError && (
              <p className="text-sm text-red-600">{billingError}</p>
            )}
            {user?.tier && user.tier !== 'free' && (
              <button
                onClick={handleManageBilling}
                disabled={billingLoading}
                className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
              >
                {billingLoading ? 'Opening...' : 'Manage Billing'}
              </button>
            )}
          </div>
        </div>

        {/* Data */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Database className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Data & Privacy</h2>
          </div>
          <div className="space-y-3">
            <button className="text-blue-600 hover:text-blue-700 font-medium">
              Download My Data
            </button>
            <br />
            <button className="text-red-600 hover:text-red-700 font-medium">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
