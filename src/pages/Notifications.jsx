// src/pages/Notifications.jsx
// Full notifications page with grouped history

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Check, Trash2, X } from 'lucide-react';
import {
  getNotifications,
  markRead,
  markAllRead,
  clearAll,
  deleteNotification,
  subscribeToNotifications
} from '../utils/notify';
import { COMMS_CATEGORIES } from '../utils/commsCatalog';

/**
 * Get category color for notification
 */
function getCategoryStyle(category) {
  switch (category) {
    case COMMS_CATEGORIES.GREETING:
      return { bg: '#dcfce7', color: '#22c55e', icon: '✉️', label: 'Greeting' };
    case COMMS_CATEGORIES.QRCASH:
      return { bg: '#fef3c7', color: '#f59e0b', icon: '💵', label: 'QR Cash' };
    case COMMS_CATEGORIES.BILLING:
      return { bg: '#e0e7ff', color: '#667eea', icon: '💳', label: 'Billing' };
    case COMMS_CATEGORIES.REWARDS:
      return { bg: '#fce7f3', color: '#ec4899', icon: '❤️', label: 'Rewards' };
    case COMMS_CATEGORIES.PROFILE:
      return { bg: '#ede9fe', color: '#8b5cf6', icon: '👤', label: 'Profile' };
    case COMMS_CATEGORIES.ACCOUNT:
      return { bg: '#dbeafe', color: '#3b82f6', icon: '🎉', label: 'Account' };
    case COMMS_CATEGORIES.PROMO:
      return { bg: '#fef9c3', color: '#eab308', icon: '🎁', label: 'Promo' };
    default:
      return { bg: '#f3f4f6', color: '#6b7280', icon: '📢', label: 'System' };
  }
}

/**
 * Format date for grouping
 */
function formatDateGroup(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const notifDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (notifDate.getTime() === today.getTime()) return 'Today';
  if (notifDate.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format time
 */
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Group notifications by date
 */
function groupByDate(notifications) {
  const groups = {};

  notifications.forEach(notification => {
    const group = formatDateGroup(notification.createdAt);
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(notification);
  });

  return groups;
}

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((notifs, count) => {
      setNotifications(notifs);
      setUnreadCount(count);
    });

    return unsubscribe;
  }, []);

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markRead(notification.id);
    }
    if (notification.ctaHref) {
      navigate(notification.ctaHref);
    }
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    deleteNotification(id);
  };

  const handleClearAll = () => {
    clearAll();
    setShowClearConfirm(false);
  };

  const groupedNotifications = groupByDate(notifications);
  const dateGroups = Object.keys(groupedNotifications);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--gray-100)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <ArrowLeft size={24} style={{ color: 'var(--text-primary)' }} />
          </button>
          <div>
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Bell size={28} /> Notifications
            </h1>
            <p style={{
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              margin: 0
            }}>
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up!'
              }
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              style={{
                padding: '0.625rem 1rem',
                background: 'transparent',
                color: '#667eea',
                border: '1px solid #667eea',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#667eea';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#667eea';
              }}
            >
              <Check size={16} />
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              style={{
                padding: '0.625rem 1rem',
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ef4444';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#ef4444';
              }}
            >
              <Trash2 size={16} />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-xl)',
          padding: '4rem 2rem',
          textAlign: 'center',
          border: '1px solid var(--border)'
        }}>
          <Bell size={64} style={{ color: 'var(--gray-300)', marginBottom: '1.5rem' }} />
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem'
          }}>
            No notifications yet
          </h2>
          <p style={{
            fontSize: '0.9375rem',
            color: 'var(--text-secondary)',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            When you send greetings, receive QR Cash, or earn Hearts, you'll see notifications here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {dateGroups.map(dateGroup => (
            <div key={dateGroup}>
              {/* Date Header */}
              <div style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
                paddingLeft: '0.5rem'
              }}>
                {dateGroup}
              </div>

              {/* Notifications in this group */}
              <div style={{
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border)',
                overflow: 'hidden'
              }}>
                {groupedNotifications[dateGroup].map((notification, index, arr) => {
                  const style = getCategoryStyle(notification.category);
                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      style={{
                        padding: '1rem 1.25rem',
                        borderBottom: index < arr.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: notification.ctaHref ? 'pointer' : 'default',
                        transition: 'all 0.15s',
                        background: notification.read ? 'transparent' : 'rgba(102, 126, 234, 0.03)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '1rem'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--gray-50)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = notification.read
                          ? 'transparent'
                          : 'rgba(102, 126, 234, 0.03)';
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '50%',
                        background: style.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: '1.125rem'
                      }}>
                        {style.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          marginBottom: '0.25rem'
                        }}>
                          <div style={{
                            fontSize: '0.9375rem',
                            fontWeight: notification.read ? 500 : 600,
                            color: 'var(--text-primary)',
                            lineHeight: 1.4
                          }}>
                            {notification.title}
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexShrink: 0
                          }}>
                            {!notification.read && (
                              <div style={{
                                width: '0.5rem',
                                height: '0.5rem',
                                borderRadius: '50%',
                                background: '#667eea'
                              }} />
                            )}
                            <span style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-tertiary)'
                            }}>
                              {formatTime(notification.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                          marginBottom: '0.5rem'
                        }}>
                          {notification.body}
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <span style={{
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            color: style.color,
                            background: style.bg,
                            padding: '0.25rem 0.5rem',
                            borderRadius: 'var(--radius-md)'
                          }}>
                            {style.label}
                          </span>

                          <button
                            onClick={(e) => handleDelete(e, notification.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              color: 'var(--text-tertiary)',
                              opacity: 0.5,
                              transition: 'all 0.15s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 'var(--radius-md)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '1';
                              e.currentTarget.style.color = '#ef4444';
                              e.currentTarget.style.background = '#fef2f2';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '0.5';
                              e.currentTarget.style.color = 'var(--text-tertiary)';
                              e.currentTarget.style.background = 'transparent';
                            }}
                            title="Delete notification"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {notification.ctaLabel && (
                          <button
                            style={{
                              marginTop: '0.75rem',
                              padding: '0.5rem 1rem',
                              background: '#667eea',
                              color: 'white',
                              border: 'none',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#5568d3';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#667eea';
                            }}
                          >
                            {notification.ctaLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <>
          <div
            onClick={() => setShowClearConfirm(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
              backdropFilter: 'blur(4px)'
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            width: '90%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem'
            }}>
              <Trash2 size={28} style={{ color: '#ef4444' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Clear All Notifications?
            </h3>
            <p style={{
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem'
            }}>
              This will permanently delete all {notifications.length} notifications. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'var(--gray-100)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Clear All
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
