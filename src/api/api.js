// src/api/api.js

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net";

class ApiService {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem("token");

    const headers = {
      ...(options.headers || {}),
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle auth / missing endpoints cleanly
    if (res.status === 401) return { ok: false, status: 401 };
    if (res.status === 404) return { ok: false, status: 404 };

    let data = {};
    try {
      data = await res.json();
    } catch {
      /* no body */
    }

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return data;
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
    return this.request("/api/contacts", {
      method: "POST",
      body: JSON.stringify(contactData),
    });
  }

  updateContact(contactId, contactData) {
    return this.request(`/api/contacts/${contactId}`, {
      method: "PUT",
      body: JSON.stringify(contactData),
    });
  }

  deleteContact(contactId) {
    return this.request(`/api/contacts/${contactId}`, {
      method: "DELETE",
    });
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
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_BASE}/api/profile/photo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (res.status === 401) return { ok: false, status: 401 };
    if (res.status === 404) return { ok: false, status: 404 };

    let data = {};
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    return data;
  }

  async uploadVoice(formData) {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_BASE}/api/profile/voice`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (res.status === 401) return { ok: false, status: 401 };
    if (res.status === 404) return { ok: false, status: 404 };

    let data = {};
    try {
      data = await res.json();
    } catch {}

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

  getJobStatus(jobId) {
    return this.request(`/api/jobs/${jobId}`);
  }
}

const api = new ApiService();
export default api;
