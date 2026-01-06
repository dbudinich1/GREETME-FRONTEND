// src/pages/DashboardHome.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  StatsWidget,
  UpcomingOccasionsWidget,
  RecentGreetingsWidget,
  QuickActionsWidget,
} from '../components/DashboardWidgets';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';

export default function DashboardHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [upcomingOccasions, setUpcomingOccasions] = useState([]);
  const [recentGreetings, setRecentGreetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
  try {
    setLoading(true);
    
    // Try to fetch each endpoint separately, gracefully handling failures
    let statsData = null;
    let upcomingData = [];
    let recentData = [];

    try {
      const statsRes = await api.getDashboardStats();
      if (statsRes?.ok === false) throw statsRes;
      statsData = statsRes.data;

    } catch (err) {
      console.log('Stats endpoint not available yet');
    }

    try {
      const upcomingRes = await api.getUpcomingOccasions();
      if (upcomingRes?.ok === false) throw upcomingRes;
      upcomingData = upcomingRes.data || [];

    } catch (err) {
      console.log('Upcoming endpoint not available yet');
    }

    try {
      const recentRes = await api.getRecentGreetings();
      if (recentRes?.ok === false) throw recentRes;
      recentData = recentRes.data || [];

    } catch (err) {
      console.log('Recent endpoint not available yet');
    }

    setStats(statsData);
    setUpcomingOccasions(upcomingData);
    setRecentGreetings(recentData);
  } catch (error) {
    console.error('Dashboard load error:', error);
  } finally {
    setLoading(false);
  }
};

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleQuickAction = (action) => {
  switch (action) {
    case 'addContact':
      navigate('/dashboard/contacts');
      break;
    case 'recordVoice':
      navigate('/dashboard/profile');
      break;
    case 'uploadPhoto':
      navigate('/dashboard/profile');
      break;
    default:
      break;
  }
};

  if (loading) {
    return <LoadingSpinner text="Loading dashboard..." />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's your overview.</p>
      </div>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Stats */}
      <StatsWidget stats={stats} />

      {/* Quick Actions */}
      <div className="mb-6">
        <QuickActionsWidget onAction={handleQuickAction} />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Occasions */}
        <UpcomingOccasionsWidget occasions={upcomingOccasions} />

        {/* Recent Greetings */}
        <RecentGreetingsWidget greetings={recentGreetings} />
      </div>

      {/* Getting Started Help */}
      {stats?.totalContacts === 0 && (
        <div className="mt-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-sm p-8 text-white">
          <h3 className="text-2xl font-bold mb-4">🎉 Get Started with Greet-Me!</h3>
          <p className="mb-6 opacity-90">
            Follow these simple steps to start sending personalized AI greetings:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <div className="text-4xl mb-2">1️⃣</div>
              <h4 className="font-bold mb-1">Add Contacts</h4>
              <p className="text-sm opacity-90">Import or add your friends and family</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <div className="text-4xl mb-2">2️⃣</div>
              <h4 className="font-bold mb-1">Setup Profile</h4>
              <p className="text-sm opacity-90">Upload your photo and record your voice</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <div className="text-4xl mb-2">3️⃣</div>
              <h4 className="font-bold mb-1">Set Occasions</h4>
              <p className="text-sm opacity-90">Choose which occasions to celebrate</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/contacts')}
            className="mt-6 bg-white text-blue-600 px-8 py-3 rounded-lg font-bold hover:bg-opacity-90 transition"
          >
            Add Your First Contact →
          </button>
        </div>
      )}
    </div>
  );
}
