// src/pages/DashboardHome.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function DashboardHome() {
  const { user, getToken } = useAuth();
  const [stats, setStats] = useState({
    totalContacts: 0,
    upcomingOccasions: 0,
    greetingsSent: 0,
  });
  const [loading, setLoading] = useState(true);

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net";

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStats = async () => {
    try {
      const token = getToken?.();
      const response = await fetch(`${API_URL}/api/dashboard/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setStats(
          data?.data || {
            totalContacts: 0,
            upcomingOccasions: 0,
            greetingsSent: 0,
          }
        );
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statStyles = {
    blue: "bg-blue-50",
    purple: "bg-purple-50",
    green: "bg-green-50",
  };

  const statCards = [
    { label: "Total Contacts", value: stats.totalContacts, icon: "👥", color: "blue" },
    { label: "Upcoming Occasions", value: stats.upcomingOccasions, icon: "📅", color: "purple" },
    { label: "Greetings Sent", value: stats.greetingsSent, icon: "✉️", color: "green" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">
            Welcome back{user?.name ? `, ${user.name}` : ""}!
          </h1>
          <p className="text-gray-600 mt-2">Here’s what’s happening with your greetings</p>
        </div>

        <div className="text-xs font-semibold px-3 py-2 rounded-full border border-gray-200 bg-white shadow-sm">
          {loading ? "Loading…" : "Updated ✓"}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">{stat.label}</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-2">
                  {loading ? "—" : stat.value}
                </p>
              </div>

              <div
                className={[
                  "text-3xl w-14 h-14 rounded-full flex items-center justify-center",
                  statStyles[stat.color] || "bg-gray-50",
                ].join(" ")}
              >
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-extrabold text-gray-900 mb-4">Quick Actions</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/contacts"
            className="flex items-center space-x-4 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition"
          >
            <span className="text-3xl">➕</span>
            <div>
              <h3 className="font-semibold text-gray-900">Add Contact</h3>
              <p className="text-sm text-gray-600">Add someone to send greetings to</p>
            </div>
          </Link>

          <Link
            to="/profile"
            className="flex items-center space-x-4 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition"
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
}
