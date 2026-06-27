// src/api/api.js

const API_BASE = import.meta.env.VITE_API_BASE || '';
if (!API_BASE) console.error("VITE_API_BASE is missing — API calls will fail");

/**
 * Sanitize memoryPhotos to prevent oversized payloads (Cosmos 413/500)
 * - Only keeps entries with valid http/https URLs
 * - Drops any entry containing base64, data:, or blob: URLs
 * - Strips to safe keys only: url, thumbnailUrl, createdAt, label, isDefault, id
 * @param {Array} photos - The memoryPhotos array
 * @returns {{ sanitized: Array, hadUnsafe: boolean }}
 */
function sanitizeMemoryPhotos(photos) {
  if (!Array.isArray(photos)) {
    return { sanitized: [], hadUnsafe: false };
  }

  const SAFE_KEYS = ['url', 'thumbnailUrl', 'createdAt', 'label', 'isDefault', 'id'];
  const UNSAFE_PATTERNS = ['data:image', 'data:application', 'base64', 'blob:'];

  let hadUnsafe = false;
  const sanitized = [];

  for (const photo of photos) {
    // Allow string URLs (backend can return SAS URLs as strings)
    if (typeof photo === "string") {
      const s = photo.trim();
      if (s.startsWith("http://") || s.startsWith("https://")) {
        // Normalize to object shape so downstream code stays consistent
        sanitized.push({ url: s });
        continue;
      }
      hadUnsafe = true;
      continue;
    }

    // Skip non-objects
    if (!photo || typeof photo !== 'object') {
      hadUnsafe = true;
      continue;
    }

    // Check if url is a valid http/https URL
    const url = photo.url;
    if (!url || typeof url !== 'string') {
      hadUnsafe = true;
      continue;
    }

    // Must be http/https URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      hadUnsafe = true;
      continue;
    }

    // Check all string fields for unsafe patterns
    let isUnsafe = false;
    for (const [key, value] of Object.entries(photo)) {
      if (typeof value === 'string') {
        for (const pattern of UNSAFE_PATTERNS) {
          if (value.includes(pattern)) {
            isUnsafe = true;
            break;
          }
        }
      }
      if (isUnsafe) break;
    }

    if (isUnsafe) {
      hadUnsafe = true;
      continue;
    }

    // Strip to safe keys only
    const cleanPhoto = {};
    for (const key of SAFE_KEYS) {
      if (photo[key] !== undefined) {
        cleanPhoto[key] = photo[key];
      }
    }

    // Only add if we have a valid url
    if (cleanPhoto.url) {
      sanitized.push(cleanPhoto);
    }
  }

  return { sanitized, hadUnsafe };
}

/**
 * Sanitize contact data before sending to backend
 * - Sanitizes memoryPhotos to URL-only metadata
 * - Sanitizes avatar to URL-only (drops base64/blob)
 * - If sanitization empties memoryPhotos, removes it from payload to preserve server data
 * @param {Object} contactData
 * @returns {Object} sanitized contact data
 */
function sanitizeContactData(contactData) {
  if (!contactData) return contactData;

  const sanitized = { ...contactData };

  // Sanitize avatar - must be http/https URL
  if (sanitized.avatar) {
    if (typeof sanitized.avatar === 'string') {
      if (!sanitized.avatar.startsWith('http://') && !sanitized.avatar.startsWith('https://')) {
        // Remove unsafe avatar (base64, blob, etc)
        delete sanitized.avatar;
      }
    } else {
      delete sanitized.avatar;
    }
  }

  // Sanitize memoryPhotos
  if (sanitized.memoryPhotos !== undefined) {
    const { sanitized: cleanPhotos, hadUnsafe } = sanitizeMemoryPhotos(sanitized.memoryPhotos);

    if (cleanPhotos.length === 0 && hadUnsafe) {
      // Had photos but all were unsafe - remove from payload to preserve server data
      delete sanitized.memoryPhotos;
      console.warn('[Sanitize] memoryPhotos removed from payload - all entries were unsafe (base64/blob)');
    } else if (cleanPhotos.length === 0 && sanitized.memoryPhotos.length === 0) {
      // Explicitly empty array - keep it to clear photos
      sanitized.memoryPhotos = [];
    } else {
      sanitized.memoryPhotos = cleanPhotos;
    }
  }

  return sanitized;
}

class ApiService {
  async request(endpoint, options = {}) {
    let token = null;
    try { token = localStorage.getItem("token"); } catch {}

    const headers = {
      ...(options.headers || {}),
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let res;
    try {
      res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (err) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('network:unavailable'));
        }
      } catch {}
      return { ok: false, status: 0, networkError: true };
    }

    // Handle auth / missing endpoints cleanly
    if (res.status === 401) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
        }
      } catch {}
      return { ok: false, status: 401 };
    }
    if (res.status === 404) return { ok: false, status: 404 };

    let data = {};
    try {
      data = await res.json();
    } catch {
      /* no body */
    }

    // Rate limiting
    if (res.status === 429) {
      const retryAfter =
        res.headers?.get?.('Retry-After') ||
        (typeof res.headers?.get === 'function' ? res.headers.get('Retry-After') : null) ||
        data?.retryAfter ||
        60;

      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rate-limit:active', {
            detail: { retryAfter: Number(retryAfter) }
          }));
        }
      } catch {}

      const error = new Error(data?.error || 'Rate limit exceeded');
      error.status = 429;
      error.code = data?.code || 'RATE_LIMIT_GENERAL';
      error.retryAfter = Number(retryAfter);
      throw error;
    }

    // Forbidden / cap enforcement
    if (res.status === 403) {
      const error = new Error(data?.error || 'Access denied');
      error.status = 403;
      error.code = data?.code || 'FORBIDDEN';
      throw error;
    }

    // Server errors
    if (res.status >= 500) {
      const error = new Error(data?.error || 'Server error');
      error.status = res.status;
      error.code = data?.code || 'SERVER_ERROR';
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('server-error:active'));
        }
      } catch {}
      throw error;
    }

    if (!res.ok) {
      const error = new Error(data?.error || `HTTP ${res.status}`);
      error.status = res.status;
      error.code = data?.code || undefined;
      throw error;
    }

    return data;
  }

  // HTTP convenience methods
  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  }

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  }

  post(endpoint, body) {
    return this.request(endpoint, { method: "POST", body: JSON.stringify(body) });
  }

  put(endpoint, body) {
    return this.request(endpoint, { method: "PUT", body: JSON.stringify(body) });
  }

  patch(endpoint, body) {
    return this.request(endpoint, { method: "PATCH", body: JSON.stringify(body) });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }

  // --------------------
  // Dashboard
  // --------------------
  getDashboardStats() {
    return this.request("/api/dashboard/stats");
  }

  getUpcomingOccasions() {
    return this.request("/api/dashboard/upcoming");
  }

  getRecentGreetings() {
    return this.request("/api/dashboard/recent");
  }

  // --------------------
  // Contacts
  // --------------------
  getContacts() {
    return this.request("/api/contacts");
  }

  createContact(contactData) {
    // Sanitize to prevent oversized payloads on create too
    const sanitizedData = sanitizeContactData(contactData);
    return this.request("/api/contacts", {
      method: "POST",
      body: JSON.stringify(sanitizedData),
    });
  }

  updateContact(contactId, contactData) {
    // === DIAGNOSTIC: Original payload size analysis (Phase 1A) ===
    const originalPayload = JSON.stringify(contactData);
    const originalBytes = new Blob([originalPayload]).size;

    // Analyze top fields by size (BEFORE sanitization)
    const fieldSizes = Object.entries(contactData || {}).map(([key, value]) => {
      const fieldJson = JSON.stringify(value);
      const bytes = new Blob([fieldJson]).size;
      const type = Array.isArray(value) ? 'array' : typeof value;
      return { key, bytes, type };
    }).sort((a, b) => b.bytes - a.bytes);

    console.group('%c[PUT Contact Diagnostic - ORIGINAL]', 'color: #f59e0b; font-weight: bold');
    console.log('Endpoint:', `/api/contacts/${contactId}`);
    console.log('Original payload bytes:', originalBytes.toLocaleString(), `(${(originalBytes / 1024).toFixed(2)} KB)`);
    console.log('Top 5 fields by size:');
    fieldSizes.slice(0, 5).forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.key}: ${f.bytes.toLocaleString()} bytes (${f.type})`);
    });
    if (originalBytes > 500000) {
      console.warn('%c⚠️ ORIGINAL PAYLOAD EXCEEDS 500KB', 'color: red; font-weight: bold');
    }
    console.groupEnd();

    // === SANITIZE: Remove base64/blob from memoryPhotos and avatar ===
    const sanitizedData = sanitizeContactData(contactData);
    const sanitizedPayload = JSON.stringify(sanitizedData);
    const sanitizedBytes = new Blob([sanitizedPayload]).size;

    console.group('%c[PUT Contact Diagnostic - SANITIZED]', 'color: #10b981; font-weight: bold');
    console.log('Sanitized payload bytes:', sanitizedBytes.toLocaleString(), `(${(sanitizedBytes / 1024).toFixed(2)} KB)`);
    console.log('memoryPhotos count:', sanitizedData.memoryPhotos?.length ?? 'not in payload');
    console.log('Reduction:', `${((1 - sanitizedBytes / originalBytes) * 100).toFixed(1)}%`);
    console.groupEnd();
    // === END DIAGNOSTIC ===

    return this.request(`/api/contacts/${contactId}`, {
      method: "PUT",
      body: sanitizedPayload,
    });
  }

  deleteContact(contactId) {
    return this.request(`/api/contacts/${contactId}`, {
      method: "DELETE",
    });
  }

  // --------------------
  // Contact Memory Photo Upload (FormData)
  // --------------------
  /**
   * Upload a memory photo for a contact
   * @param {string|null} contactId - Contact ID (null for new contacts)
   * @param {File} file - The image file to upload
   * @returns {Promise<{ok: boolean, url: string, blobUrl: string}>}
   */
  async uploadContactMemoryPhoto(contactId, file) {
    let token = null; try { token = localStorage.getItem("token"); } catch {}
    const formData = new FormData();
    formData.append("photo", file);

    // Use different endpoint for new vs existing contacts
    const endpoint = contactId
      ? `${API_BASE}/api/contacts/${contactId}/memory-photo`
      : `${API_BASE}/api/contacts/memory-photo`;

    let res;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
    } catch (err) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('network:unavailable'));
        }
      } catch {}
      return { ok: false, status: 0, networkError: true };
    }

    if (res.status === 401) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
        }
      } catch {}
      return { ok: false, status: 401 };
    }
    if (res.status === 404) return { ok: false, status: 404 };

    let data = {};
    try {
      data = await res.json();
    } catch {}

    if (res.status === 429) {
      const retryAfter =
        (res.headers?.get?.('Retry-After')) ||
        data?.retryAfter ||
        60;
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rate-limit:active', {
            detail: { retryAfter: Number(retryAfter) }
          }));
        }
      } catch {}
      const error = new Error(data?.error || 'Rate limit exceeded');
      error.status = 429;
      error.code = data?.code || 'RATE_LIMIT_GENERAL';
      error.retryAfter = Number(retryAfter);
      throw error;
    }

    if (res.status >= 500) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('server-error:active'));
        }
      } catch {}
      const error = new Error(data?.error || 'Server error');
      error.status = res.status;
      error.code = data?.code || 'SERVER_ERROR';
      throw error;
    }

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return data;
  }

  // --------------------
  // Profile (JSON)
  // --------------------
  getProfile() {
    return this.request("/api/profile");
  }

  updateProfile(profileData) {
    return this.request("/api/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
  }

  // --------------------
  // Profile uploads (FormData)
  // IMPORTANT: do NOT set Content-Type for FormData
  // --------------------
  async uploadPhoto(formData) {
    let token = null; try { token = localStorage.getItem("token"); } catch {}

    let res;
    try {
      res = await fetch(`${API_BASE}/api/profile/photo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
    } catch (err) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('network:unavailable'));
        }
      } catch {}
      return { ok: false, status: 0, networkError: true };
    }

    if (res.status === 401) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
        }
      } catch {}
      return { ok: false, status: 401 };
    }
    if (res.status === 404) return { ok: false, status: 404 };

    let data = {};
    try {
      data = await res.json();
    } catch {}

    if (res.status === 429) {
      const retryAfter =
        (res.headers?.get?.('Retry-After')) ||
        data?.retryAfter ||
        60;
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rate-limit:active', {
            detail: { retryAfter: Number(retryAfter) }
          }));
        }
      } catch {}
      const error = new Error(data?.error || 'Rate limit exceeded');
      error.status = 429;
      error.code = data?.code || 'RATE_LIMIT_GENERAL';
      error.retryAfter = Number(retryAfter);
      throw error;
    }

    if (res.status >= 500) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('server-error:active'));
        }
      } catch {}
      const error = new Error(data?.error || 'Server error');
      error.status = res.status;
      error.code = data?.code || 'SERVER_ERROR';
      throw error;
    }

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return data;
  }

  async uploadVoice(formData) {
    let token = null; try { token = localStorage.getItem("token"); } catch {}

    let res;
    try {
      res = await fetch(`${API_BASE}/api/profile/voice`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
    } catch (err) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('network:unavailable'));
        }
      } catch {}
      return { ok: false, status: 0, networkError: true };
    }

    if (res.status === 401) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
        }
      } catch {}
      return { ok: false, status: 401 };
    }
    if (res.status === 404) return { ok: false, status: 404 };

    let data = {};
    try {
      data = await res.json();
    } catch {}

    if (res.status === 429) {
      const retryAfter =
        (res.headers?.get?.('Retry-After')) ||
        data?.retryAfter ||
        60;
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rate-limit:active', {
            detail: { retryAfter: Number(retryAfter) }
          }));
        }
      } catch {}
      const error = new Error(data?.error || 'Rate limit exceeded');
      error.status = 429;
      error.code = data?.code || 'RATE_LIMIT_GENERAL';
      error.retryAfter = Number(retryAfter);
      throw error;
    }

    if (res.status >= 500) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('server-error:active'));
        }
      } catch {}
      const error = new Error(data?.error || 'Server error');
      error.status = res.status;
      error.code = data?.code || 'SERVER_ERROR';
      throw error;
    }

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return data;
  }

  // --------------------
  // Greetings / Jobs
  // --------------------
  sendGreeting(payload) {
    return this.request("/api/jobs/send-greeting", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // --------------------
  // Email Verification (Protected Subsystem — checkpoint flow)
  // --------------------
  resendVerificationEmail() {
    return this.request("/api/auth/resend-verification", { method: "POST" });
  }

  // --------------------
  // QR Cash™ Gifts
  // --------------------
  chargeGift(payload) {
    return this.request("/api/gifts/charge-now", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  finalizeGift(payload) {
    return this.request("/api/gifts/finalize", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  getGiftClaim(claimToken) {
    return this.request(`/api/gifts/claim/${claimToken}`);
  }

  submitGiftClaim(claimToken, payload) {
    return this.request(`/api/gifts/claim/${claimToken}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  connectOnboard(claimToken) {
    return this.request(`/api/gifts/connect/onboard/${claimToken}`, {
      method: "POST",
    });
  }

  connectComplete(claimToken) {
    return this.request(`/api/gifts/connect/complete/${claimToken}`, {
      method: "POST",
    });
  }

  // --------------------
  // G1G1 Gift Membership
  // --------------------
  getG1G1Gift(giftCode) {
    return this.request(`/api/gifts/g1g1/${giftCode}`);
  }

  claimG1G1Gift(giftCode) {
    return this.request(`/api/gifts/g1g1/${giftCode}/claim`, {
      method: "POST",
    });
  }

  // Sender-only: email the branded gift to a recipient (recipient data is transient).
  sendG1G1Gift(giftCode, body) {
    return this.request(`/api/gifts/g1g1/${giftCode}/send`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  }

  // --------------------
  // Referral (viral loop)
  // --------------------
  getReferral(referralCode) {
    return this.request(`/api/gifts/referral/${referralCode}`);
  }

  redeemReferral(referralCode, payload) {
    return this.request(`/api/gifts/referral/${referralCode}/redeem`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  getJobStatus(jobId) {
    return this.request(`/api/jobs/${jobId}`);
  }

  // --------------------
  // Growth Engine Events
  // --------------------
  trackGreetingOpened(jobId) {
    return this.request("/api/events/greeting-opened", {
      method: "POST",
      body: JSON.stringify({ jobId }),
    });
  }

  getSentGreetings() {
    return this.request("/api/greetings/sent");
  }

  // --------------------
  // Thank You Flow (Phase 1.5)
  // --------------------
  getThankyouPrefill(jobId) {
    return this.request(`/api/events/thankyou-prefill/${jobId}`);
  }

  submitThankYouGreeting(data) {
    return this.request("/api/jobs/send-greeting", {
      method: "POST",
      body: JSON.stringify({
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
        occasionKey: "thank-you",
        tone: data.tone || "warm",
        personalSentiment: data.script,
        sourceJobId: data.sourceJobId,
      }),
    });
  }

  // --------------------
  // Public Greeting View (no auth required)
  // --------------------
  getPublicGreeting(greetingId) {
    return this.request(`/api/public/greetings/${greetingId}`);
  }

  // --------------------
  // Thank You (public, no auth required)
  // --------------------
  sendThankYou(greetingId, payload) {
    return this.request(`/api/greetings/${greetingId}/thank-you`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // --------------------
  // Onboarding
  // --------------------
  completeOnboarding() {
    return this.request("/api/onboarding/complete", {
      method: "POST",
    });
  }

  // --------------------
  // Merch orders (Phase 3C Stage 5)
  // --------------------
  getMerchOrders() {
    return this.request("/api/merch/orders");
  }

  // --------------------
  // Hearts 1A — read-only server balance (GET /api/hearts/balance).
  // Consumers default to res?.balance ?? 0.
  // --------------------
  getHeartsBalance() {
    return this.request("/api/hearts/balance");
  }

  // VENDOR-GIFTS-B1 — read-only Collective gift catalog (display data; empty while dormant).
  getGiftCatalog() {
    return this.request("/api/gifts/catalog");
  }

  // H7 B5 — spend Hearts for an in-kind reward. `redemptionRequestId` is generated once per
  // redemption intent on the client and reused across retries (idempotency). Server is
  // authoritative; no localStorage is used for balance/redemption/history.
  redeemHearts(optionId, redemptionRequestId) {
    return this.request("/api/hearts/redeem", {
      method: "POST",
      body: JSON.stringify({ optionId, redemptionRequestId }),
    });
  }

  // --------------------
  // HERO MVP — read-only Hero summary (GET /api/hero/me).
  // Returns { ok, hero: { status, impact, recentActivity, history, recognition } }.
  // Dormant-safe: honest zeros/empty while heroEnabled is OFF. No writes, no money path.
  // --------------------
  getHeroMe() {
    return this.request("/api/hero/me");
  }

  // --------------------
  // HERO MVP-B4 — read-only Community Hero Leaderboard (GET /api/hero/leaderboard).
  // Returns { ok, leaderboard: { entries[], currentUser, totalParticipants, ... } }.
  // Privacy-safe display names only; dormant-safe (honest empty board when no data).
  // --------------------
  getHeroLeaderboard() {
    return this.request("/api/hero/leaderboard");
  }
}

const api = new ApiService();
export default api;
