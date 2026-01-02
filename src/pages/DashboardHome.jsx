// src/pages/DashboardHome.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const DashboardHome = () => {
  const { user, getToken } = useAuth();
  const [stats, setStats] = useState({ totalContacts: 0, upcomingOccasions: 0, greetingsSent: 0 });
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'https://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net';

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.data || { totalContacts: 0, upcomingOccasions: 0, greetingsSent: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Contacts', value: stats.totalContacts, icon: '👥', color: 'blue' },
    { label: 'Upcoming Occasions', value: stats.upcomingOccasions, icon: '📅', color: 'purple' },
    { label: 'Greetings Sent', value: stats.greetingsSent, icon: '✉️', color: 'green' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name}!</h1>
        <p className="text-gray-600 mt-2">Here's what's happening with your greetings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`text-4xl bg-${stat.color}-50 w-16 h-16 rounded-full flex items-center justify-center`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/contacts"
            className="flex items-center space-x-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
          >
            <span className="text-3xl">➕</span>
            <div>
              <h3 className="font-semibold text-gray-900">Add Contact</h3>
              <p className="text-sm text-gray-600">Add someone to send greetings to</p>
            </div>
          </Link>

          <Link
            to="/profile"
            className="flex items-center space-x-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
          >
            <span className="text-3xl">🎙️</span>
            <div>
              <h3 className="font-semibold text-gray-900">Setup Profile</h3>
              <p className="text-sm text-gray-600">Record your voice and upload photo</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
