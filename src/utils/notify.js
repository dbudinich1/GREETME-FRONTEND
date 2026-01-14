// src/utils/notify.js
// Greet-Me In-App Notification Engine with LocalStorage persistence, dedupe, and cooldowns

import { buildMessage, COMMS_CATEGORIES } from './commsCatalog';

// Storage keys
const NOTIFICATIONS_KEY = 'greetme_notifications_v1';
const LAST_SENT_KEY = 'greetme_notifications_last_sent_v1';

// Toast categories that trigger automatic toasts
const TOAST_CATEGORIES = [
  COMMS_CATEGORIES.GREETING,
  COMMS_CATEGORIES.QRCASH,
  COMMS_CATEGORIES.BILLING,
  COMMS_CATEGORIES.REWARDS,
];

// Event listeners for notification updates
const listeners = new Set();

/**
 * Generate a unique ID for notifications
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get stored notifications
 * @returns {Array} Array of notification objects
 */
export function getNotifications() {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Get unread notification count
 * @returns {number} Count of unread notifications
 */
export function getUnreadCount() {
  return getNotifications().filter(n => !n.read).length;
}

/**
 * Get last sent timestamps for dedupe
 * @returns {Object} Map of dedupeKey -> lastSentAt timestamp
 */
function getLastSentMap() {
  try {
    const stored = localStorage.getItem(LAST_SENT_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/**
 * Save last sent timestamp for a dedupe key
 * @param {string} dedupeKey - The deduplication key
 */
function setLastSent(dedupeKey) {
  const map = getLastSentMap();
  map[dedupeKey] = Date.now();

  // Clean up old entries (older than 30 days)
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  Object.keys(map).forEach(key => {
    if (map[key] < thirtyDaysAgo) {
      delete map[key];
    }
  });

  localStorage.setItem(LAST_SENT_KEY, JSON.stringify(map));
}

/**
 * Check if message should be suppressed due to cooldown
 * @param {string} dedupeKey - The deduplication key
 * @param {number} cooldownHours - Hours to wait before allowing same message
 * @returns {boolean} True if should suppress
 */
function shouldSuppress(dedupeKey, cooldownHours) {
  if (cooldownHours <= 0) return false;

  const lastSentMap = getLastSentMap();
  const lastSent = lastSentMap[dedupeKey];

  if (!lastSent) return false;

  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  return (Date.now() - lastSent) < cooldownMs;
}

/**
 * Save notifications to storage
 * @param {Array} notifications - Array of notification objects
 */
function saveNotifications(notifications) {
  // Keep only last 100 notifications
  const trimmed = notifications.slice(0, 100);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(trimmed));

  // Notify listeners
  notifyListeners();
}

/**
 * Notify all listeners of changes
 */
function notifyListeners() {
  listeners.forEach(listener => {
    try {
      listener(getNotifications(), getUnreadCount());
    } catch (e) {
      console.error('Notification listener error:', e);
    }
  });

  // Also dispatch custom event for components not using listeners
  window.dispatchEvent(new CustomEvent('notificationsUpdated', {
    detail: { unreadCount: getUnreadCount() }
  }));
}

/**
 * Subscribe to notification updates
 * @param {Function} callback - Called with (notifications, unreadCount)
 * @returns {Function} Unsubscribe function
 */
export function subscribeToNotifications(callback) {
  listeners.add(callback);
  // Immediately call with current state
  callback(getNotifications(), getUnreadCount());

  return () => {
    listeners.delete(callback);
  };
}

/**
 * Push an in-app notification
 * @param {string} eventName - COMMS_EVENTS value
 * @param {object} payload - Data for the notification
 * @returns {object|null} The created notification or null if suppressed
 */
export function pushInApp(eventName, payload = {}) {
  const message = buildMessage(eventName, payload);

  if (!message) {
    console.warn(`[notify] No message template for event: ${eventName}`);
    return null;
  }

  // Check cooldown
  if (shouldSuppress(message.dedupeKey, message.cooldownHours)) {
    console.log(`[notify] Suppressed (cooldown): ${eventName}`);
    return null;
  }

  // Check for exact duplicate in recent notifications
  const notifications = getNotifications();
  const recentDupe = notifications.find(n =>
    n.dedupeKey === message.dedupeKey &&
    (Date.now() - new Date(n.createdAt).getTime()) < 60000 // Within 1 minute
  );

  if (recentDupe) {
    console.log(`[notify] Suppressed (duplicate): ${eventName}`);
    return null;
  }

  // Create notification
  const notification = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    title: message.title,
    body: message.body,
    category: message.category,
    read: false,
    ctaLabel: message.ctaLabel,
    ctaHref: message.ctaHref,
    dedupeKey: message.dedupeKey,
    meta: message.meta,
  };

  // Add to list (newest first)
  notifications.unshift(notification);
  saveNotifications(notifications);

  // Update last sent
  setLastSent(message.dedupeKey);

  // Show toast if applicable
  if (message.toast && TOAST_CATEGORIES.includes(message.category)) {
    showToast(notification);
  }

  console.log(`[notify] Pushed: ${eventName}`, notification.title);
  return notification;
}

/**
 * Mark a notification as read
 * @param {string} id - Notification ID
 */
export function markRead(id) {
  const notifications = getNotifications();
  const index = notifications.findIndex(n => n.id === id);

  if (index !== -1) {
    notifications[index].read = true;
    saveNotifications(notifications);
  }
}

/**
 * Mark all notifications as read
 */
export function markAllRead() {
  const notifications = getNotifications();
  notifications.forEach(n => n.read = true);
  saveNotifications(notifications);
}

/**
 * Clear all notifications
 */
export function clearAll() {
  saveNotifications([]);
}

/**
 * Delete a specific notification
 * @param {string} id - Notification ID
 */
export function deleteNotification(id) {
  const notifications = getNotifications();
  const filtered = notifications.filter(n => n.id !== id);
  saveNotifications(filtered);
}

// ============================================
// TOAST SYSTEM
// ============================================

let toastContainer = null;
let toastQueue = [];
let isShowingToast = false;

/**
 * Create toast container if it doesn't exist
 */
function ensureToastContainer() {
  if (toastContainer) return toastContainer;

  toastContainer = document.createElement('div');
  toastContainer.id = 'greetme-toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
  `;
  document.body.appendChild(toastContainer);

  return toastContainer;
}

/**
 * Get category color for toast
 */
function getCategoryColor(category) {
  switch (category) {
    case COMMS_CATEGORIES.GREETING:
      return { bg: '#22c55e', icon: '✉️' };
    case COMMS_CATEGORIES.QRCASH:
      return { bg: '#f59e0b', icon: '💵' };
    case COMMS_CATEGORIES.BILLING:
      return { bg: '#667eea', icon: '💳' };
    case COMMS_CATEGORIES.REWARDS:
      return { bg: '#ec4899', icon: '❤️' };
    case COMMS_CATEGORIES.PROFILE:
      return { bg: '#8b5cf6', icon: '👤' };
    case COMMS_CATEGORIES.ACCOUNT:
      return { bg: '#3b82f6', icon: '🎉' };
    default:
      return { bg: '#6b7280', icon: '📢' };
  }
}

/**
 * Show a toast notification
 * @param {object} notification - Notification object
 */
function showToast(notification) {
  toastQueue.push(notification);
  processToastQueue();
}

/**
 * Process toast queue
 */
function processToastQueue() {
  if (isShowingToast || toastQueue.length === 0) return;

  isShowingToast = true;
  const notification = toastQueue.shift();

  const container = ensureToastContainer();
  const { bg, icon } = getCategoryColor(notification.category);

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    padding: 1rem;
    max-width: 360px;
    pointer-events: auto;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    transform: translateX(100%);
    opacity: 0;
    transition: all 0.3s ease;
    border-left: 4px solid ${bg};
  `;

  toast.innerHTML = `
    <div style="
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: ${bg};
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 1rem;
    ">${icon}</div>
    <div style="flex: 1; min-width: 0;">
      <div style="
        font-weight: 600;
        font-size: 0.9375rem;
        color: #111827;
        margin-bottom: 0.25rem;
      ">${notification.title}</div>
      <div style="
        font-size: 0.8125rem;
        color: #6b7280;
        line-height: 1.4;
      ">${notification.body}</div>
    </div>
    <button style="
      background: transparent;
      border: none;
      cursor: pointer;
      color: #9ca3af;
      padding: 0.25rem;
      font-size: 1.25rem;
      line-height: 1;
    " onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';

    setTimeout(() => {
      toast.remove();
      isShowingToast = false;
      processToastQueue();
    }, 300);
  }, 4000);
}

/**
 * Manually show a toast (for use outside the notification system)
 * @param {string} title - Toast title
 * @param {string} body - Toast body
 * @param {string} category - Category for styling
 */
export function showManualToast(title, body, category = COMMS_CATEGORIES.SYSTEM) {
  showToast({
    title,
    body,
    category,
  });
}
