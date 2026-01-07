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
    if (res.status === 401) {
      return { ok: false, status: 401 };
    }

    if (res.status === 404) {
      return { ok: false, status: 404 };
    }

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
}

const api = new ApiService();
export default api;
