// src/components/DashboardWidgets.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Mail, Calendar, TrendingUp, Pencil } from 'lucide-react';
import { getDaysUntil, formatDate, getOccasionIcon, getOccasionLabel, getTimeAgo } from '../utils/helpers';

export function StatsWidget({ stats }) {
  const statItems = [
    {
      label: 'Total Recipients',
      value: stats?.totalContacts || 0,
      icon: <Users className="text-blue-600" size={24} />,
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Greet-Me Sends',
      value: stats?.greetingsSent || 0,
      icon: <Mail className="text-green-600" size={24} />,
      bgColor: 'bg-green-50',
    },
    {
      label: 'This Month',
      value: stats?.thisMonth || 0,
      icon: <Calendar className="text-purple-600" size={24} />,
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Success Rate',
      value: `${stats?.successRate || 100}%`,
      icon: <TrendingUp className="text-orange-600" size={24} />,
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {statItems.map((item, index) => (
        <div
          key={index}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{item.label}</p>
              <p className="text-2xl font-bold text-gray-900">{item.value}</p>
            </div>
            <div className={`${item.bgColor} p-3 rounded-lg`}>
              {item.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function UpcomingOccasionsWidget({ occasions }) {
  const navigate = useNavigate();

  const handleEditRecipient = (contactId) => {
    if (contactId) {
      navigate('/dashboard/contacts', { state: { openEditRecipientId: contactId } });
    }
  };

  if (!occasions || occasions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Occasions</h3>
        <div className="text-center py-8">
          <p className="text-6xl mb-2">📅</p>
          <p className="text-gray-500">No upcoming occasions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Occasions</h3>
      <div className="space-y-3">
        {occasions.map((occasion, index) => {
          const daysUntil = getDaysUntil(occasion.date);
          const isToday = daysUntil === 0;
          const isTomorrow = daysUntil === 1;

          return (
            <div
              key={index}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isToday
                  ? 'bg-red-50 border-red-200'
                  : isTomorrow
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getOccasionIcon(occasion.type)}</span>
                <div>
                  <p className="font-medium text-gray-900">{occasion.contactName}</p>
                  <p className="text-sm text-gray-600">{getOccasionLabel(occasion.type)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(occasion.date)}
                  </p>
                  <p className={`text-xs ${
                    isToday ? 'text-red-600 font-semibold' :
                    isTomorrow ? 'text-yellow-600 font-semibold' :
                    'text-gray-500'
                  }`}>
                    {isToday ? 'Today!' : isTomorrow ? 'Tomorrow' : `in ${daysUntil} days`}
                  </p>
                </div>
                <button
                  onClick={() => handleEditRecipient(occasion.contactId)}
                  title="Edit recipient"
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  <Pencil size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RecentGreetingsWidget({ greetings }) {
  if (!greetings || greetings.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sends</h3>
        <div className="text-center py-8">
          <p className="text-6xl mb-2">📬</p>
          <p className="text-gray-500">No Greet-Me sends yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sends</h3>
      <div className="space-y-3">
        {greetings.map((greeting, index) => {
          const statusConfig = {
            completed: { color: 'text-green-600', bg: 'bg-green-50', label: 'Sent' },
            failed: { color: 'text-gray-600', bg: 'bg-gray-50', label: 'Not sent' },
            processing: { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Creating' },
            queued: { color: 'text-gray-600', bg: 'bg-gray-50', label: 'Preparing' },
          };

          const status = statusConfig[greeting.status] || statusConfig.queued;

          return (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200"
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getOccasionIcon(greeting.occasionType)}</span>
                <div>
                  <p className="font-medium text-gray-900">{greeting.recipientName}</p>
                  <p className="text-sm text-gray-600">{getOccasionLabel(greeting.occasionType)}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
                <p className="text-xs text-gray-500 mt-1">{getTimeAgo(greeting.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function QuickActionsWidget({ onAction }) {
  const actions = [
    {
      label: 'Add Recipient',
      icon: '👥',
      action: 'addRecipient',
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      label: 'Send Greet-Me',
      icon: '✉️',
      action: 'sendGreeting',
      color: 'bg-purple-600 hover:bg-purple-700',
      tooltip: 'Send a greeting to a recipient.',
    },
    {
      label: 'Browse Gifts',
      icon: '🎁',
      action: 'viewGifts',
      color: 'bg-green-600 hover:bg-green-700',
    },
    {
      label: 'View Merch',
      icon: '🛍️',
      action: 'viewMerch',
      color: 'bg-pink-600 hover:bg-pink-700',
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((item) => (
          <button
            key={item.action}
            onClick={() => onAction(item.action)}
            className={`${item.color} text-white p-4 rounded-lg font-medium transition flex flex-col items-center space-y-2`}
            title={item.tooltip || ''}
          >
            <span className="text-3xl">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
