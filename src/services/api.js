// src/services/api.js
const API_URL = import.meta.env.VITE_API_URL || 
  'https://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net';

class ApiService {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Contacts
  async getContacts() {
    return this.request('/api/contacts');
  }

  async createContact(contactData) {
    return this.request('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(contactData),
    });
  }

  async updateContact(contactId, contactData) {
    return this.request(`/api/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(contactData),
    });
  }

  async deleteContact(contactId) {
    return this.request(`/api/contacts/${contactId}`, {
      method: 'DELETE',
    });
  }

  // Profile
  async getProfile() {
    return this.request('/api/profile');
  }

  async updateProfile(profileData) {
    return this.request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // GET profile (fixed)
async getProfile() {
  const token = localStorage.getItem('token');
  return fetch(`${API_URL}/api/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).then(res => res.json());
}
  }

  async uploadPhoto(formData) {
    const token = localStorage.getItem('token');
    return fetch(`${API_URL}/api/profile/photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    }).then(res => res.json());
  }

  // Dashboard
  async getDashboardStats() {
    return this.request('/api/dashboard/stats');
  }

  async getUpcomingOccasions() {
    return this.request('/api/dashboard/upcoming');
  }

  async getRecentGreetings() {
    return this.request('/api/dashboard/recent');
  }

  // Greetings
  async sendGreeting(greetingData) {
    return this.request('/api/jobs/send-greeting', {
      method: 'POST',
      body: JSON.stringify(greetingData),
    });
  }

  async getJobStatus(jobId) {
    return this.request(`/api/jobs/${jobId}`);
  }
}

const api = new ApiService();
export default api;
