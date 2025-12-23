const API_BASE = import.meta.env.VITE_API_BASE;

export async function fetchOccasions() {
  const res = await fetch(`${API_BASE}/occasions`);
  if (!res.ok) throw new Error("Failed to load occasions");
  return res.json();
}

export async function fetchTones() {
  const res = await fetch(`${API_BASE}/tones`);
  if (!res.ok) throw new Error("Failed to load tones");
  return res.json();
}

export async function sendGreeting(formData) {
  const res = await fetch(`${API_BASE}/api/jobs/send-greeting`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Send greeting failed");
  return data;
}
