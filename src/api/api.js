const API_BASE = import.meta.env.VITE_API_BASE || 'https://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net';
/**
 * Fetch available occasions
 * GET /api/occasions
 */
export async function fetchOccasions() {
  const res = await fetch(`${API_BASE}/api/occasions`);
  if (!res.ok) throw new Error("Failed to load occasions");
  return res.json(); // { occasions: [...] }
}

/**
 * Fetch available tones
 * GET /api/tones
 */
export async function fetchTones() {
  const res = await fetch(`${API_BASE}/api/tones`);
  if (!res.ok) throw new Error("Failed to load tones");
  return res.json(); // { tones: [...] }
}

/**
 * Submit greeting job
 * POST /api/jobs/send-greeting
 */
export async function sendGreeting(payload) {
  const res = await fetch(`${API_BASE}/api/jobs/send-greeting`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || "Send greeting failed");
  }

  // { ok: true, jobId: "..." }
  return data;
}
