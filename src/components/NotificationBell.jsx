// src/components/NotificationBell.jsx
// Notification bell icon with badge and dropdown preview

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, X, ExternalLink } from 'lucide-react';
import { getNotifications, getUnreadCount, markRead, markAllRead, subscribeToNotifications } from '../utils/notify';
import { COMMS_CATEGORIES } from '../utils/commsCatalog';

/**
 * Get category color for notification
 */
function getCategoryStyle(category) {
  switch (category) {
    case COMMS_CATEGORIES.GREETING:
      return { bg: '#dcfce7', color: '#22c55e', icon: '✉️' };
    case COMMS_CATEGORIES.QRCASH:
      return { bg: '#fef3c7', color: '#f59e0b', icon: '💵' };
    case COMMS_CATEGORIES.BILLING:
      return { bg: '#e0e7ff', color: '#667eea', icon: '💳' };
    case COMMS_CATEGORIES.REWARDS:
      return { bg: '#fce7f3', color: '#ec4899', icon: '❤️' };
    case COMMS_CATEGORIES.PROFILE:
      return { bg: '#ede9fe', color: '#8b5cf6', icon: '👤' };
    case COMMS_CATEGORIES.ACCOUNT:
      return { bg: '#dbeafe', color: '#3b82f6', icon: '🎉' };
    case COMMS_CATEGORIES.PROMO:
      return { bg: '#fef9c3', color: '#eab308', icon: '🎁' };
    default:
      return { bg: '#f3f4f6', color: '#6b7280', icon: '📢' };
  }
}

/**
 * Format relative time
 */
function formatTimeAgo(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Subscribe to notification updates
    const unsubscribe = subscribeToNotifications((notifs, count) => {
      setNotifications(notifs);
      setUnreadCount(count);
    });

    // Click outside to close
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNotificationClick = (notification) => {
    markRead(notification.id);
    if (notification.ctaHref) {
      navigate(notification.ctaHref);
    }
    setIsOpen(false);
  };

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    markAllRead();
  };

  const handleViewAll = () => {
    setIsOpen(false);
    navigate('/dashboard/notifications');
  };

  // Show only the 5 most recent in dropdown
  const recentNotifications = notifications.slice(0, 5);

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '50%',
          border: 'none',
          background: isOpen ? 'var(--gray-100)' : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          position: 'relative'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = 'var(--gray-100)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
        title="Notifications"
      >
        <Bell size={20} style={{ color: 'var(--text-secondary)' }} />

        {/* Badge */}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0',
            right: '0',
            background: '#ef4444',
            color: 'white',
            fontSize: '0.625rem',
            fontWeight: 700,
            minWidth: '1.125rem',
            height: '1.125rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          marginTop: '0.5rem',
          width: '360px',
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--border)',
          zIndex: 100,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{
                  marginLeft: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--text-tertiary)'
                }}>
                  ({unreadCount} unread)
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#667eea',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontFamily: 'inherit'
                }}
              >
                <Check size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {recentNotifications.length === 0 ? (
              <div style={{
                padding: '3rem 1rem',
                textAlign: 'center',
                color: 'var(--text-secondary)'
              }}>
                <Bell size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                <p style={{ fontSize: '0.875rem', margin: 0 }}>No notifications yet</p>
              </div>
            ) : (
              recentNotifications.map((notification) => {
                const style = getCategoryStyle(notification.category);
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      padding: '0.875rem 1rem',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: notification.read ? 'transparent' : 'rgba(102, 126, 234, 0.03)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem'
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
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '50%',
                      background: style.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '0.875rem'
                    }}>
                      {style.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '0.5rem'
                      }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: notification.read ? 500 : 600,
                          color: 'var(--text-primary)',
                          lineHeight: 1.4
                        }}>
                          {notification.title}
                        </div>
                        {!notification.read && (
                          <div style={{
                            width: '0.5rem',
                            height: '0.5rem',
                            borderRadius: '50%',
                            background: '#667eea',
                            flexShrink: 0,
                            marginTop: '0.375rem'
                          }} />
                        )}
                      </div>
                      <div style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.4,
                        marginTop: '0.25rem'
                      }}>
                        {notification.body}
                      </div>
                      <div style={{
                        fontSize: '0.6875rem',
                        color: 'var(--text-tertiary)',
                        marginTop: '0.375rem'
                      }}>
                        {formatTimeAgo(notification.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--border)',
              textAlign: 'center'
            }}>
              <button
                onClick={handleViewAll}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#667eea',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontFamily: 'inherit'
                }}
              >
                View all notifications
                <ExternalLink size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
