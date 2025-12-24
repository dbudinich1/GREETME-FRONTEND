import { useEffect, useMemo, useState } from "react";

/**
 * Generate a stable anonymous userId and store it in localStorage.
 * This gives us "user expansion" without login.
 */
function getOrCreateUserId() {
  const KEY = "greetme_user_id";
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;

  // Prefer crypto.randomUUID if available
  let id = "";
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    id = crypto.randomUUID();
  } else {
    // Fallback: reasonably-unique ID
    id = `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  localStorage.setItem(KEY, id);
  return id;
}

export default function App() {
  const API_BASE = import.meta.env.VITE_API_BASE;

  const userId = useMemo(() => {
    try {
      return getOrCreateUserId();
    } catch {
      // If localStorage is blocked, still allow app to run
      return "anon_no_storage";
    }
  }, []);

  const [status, setStatus] = useState("Loading...");
  const [error, setError] = useState("");

  const [occasions, setOccasions] = useState([]);
  

  const [occasionKey, setOccasionKey] = useState("");
  

  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [greetingText, setGreetingText] = useState("");

  // For now: URL-based photo (fastest path). Uploads come later.
  const [photoUrl, setPhotoUrl] = useState(
    "https://raw.githubusercontent.com/danielgatis/rembg/main/examples/person.jpg"
  );

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Load occasions + tones on page load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError("");
        setStatus("Loading occasions + tones...");

        if (!API_BASE) {
          setStatus("❌ Missing VITE_API_BASE");
          setError("Set VITE_API_BASE in your frontend .env file.");
          return;
        }

        const [occRes, toneRes] = await Promise.all([
          fetch(`${API_BASE}/api/occasions`),
          
        ]);

        const occJson = await occRes.json().catch(() => ({}));
        const toneJson = await toneRes.json().catch(() => ({}));

        if (!occRes.ok) throw new Error(occJson?.error || "Failed to load occasions");
        if (!toneRes.ok) throw new Error(toneJson?.error || "Failed to load tones");

        const occList = Array.isArray(occJson.occasions) ? occJson.occasions : [];
        const toneList = Array.isArray(toneJson.tones) ? toneJson.tones : [];

        if (cancelled) return;

        setOccasions(occList);
        setTones(toneList);

        // Set defaults once (avoid empty selects)
        if (occList.length > 0) setOccasionKey((prev) => prev || occList[0].key);
        if (toneList.length > 0) setToneKey((prev) => prev || toneList[0]);

        setStatus("Loaded successfully ✅");
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setError(String(e?.message || e));
        setStatus("❌ Fetch failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [API_BASE]);

  async function onSubmit(e) {
    e.preventDefault();
    setResult(null);
    setError("");

    if (!occasionKey) return setError("Please choose an occasion.");
    if (!toneKey) return setError("Please choose a tone.");
    if (!recipientName.trim()) return setError("Please enter recipient name.");
    if (!recipientEmail.trim()) return setError("Please enter recipient email.");
    if (!photoUrl.trim()) return setError("Please enter a photo URL (HTTPS).");

    try {
      setSubmitting(true);
      setStatus("Sending job to API...");

      const payload = {
        userId, // ✅ NEW: anonymous user identifier
        recipientEmail: recipientEmail.trim(),
        recipientName: recipientName.trim(),
        occasionKey,
        tone: toneKey, // ✅ IMPORTANT: send as `tone` (backend-friendly)
        greetingText: greetingText || "",
        photoUrl: photoUrl.trim(),
        voiceId: null,
      };

      console.log("🚀 Sending payload:", payload);

      const res = await fetch(`${API_BASE}/api/jobs/send-greeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Send greeting failed");

      setResult(data);
      setStatus("✅ Job submitted!");
    } catch (e) {
      console.error(e);
      setError(String(e?.message || e));
      setStatus("❌ Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "system-ui, Arial, sans-serif" }}>
      <h1 style={{ marginBottom: 10 }}>Greet-Me.com</h1>

      <div style={{ marginBottom: 16, color: "#555" }}>
        <div><b>Frontend:</b> Vite / React</div>
        <div><b>API Base:</b> {API_BASE || "(missing)"}</div>
        <div><b>User ID:</b> <code>{userId}</code></div>
        <div><b>Status:</b> {status}</div>
      </div>

      {error ? (
        <div
          style={{
            background: "#ffecec",
            border: "1px solid #ffb3b3",
            padding: 12,
            marginBottom: 16,
            borderRadius: 8,
            maxWidth: 700,
          }}
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} style={{ maxWidth: 700 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <label>
            Occasion:&nbsp;
            <select value={occasionKey} onChange={(e) => setOccasionKey(e.target.value)}>
              <option value="">Select occasion</option>
              {occasions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            Tone:&nbsp;
            <select value={toneKey} onChange={(e) => setToneKey(e.target.value)}>
              <option value="">Select tone</option>
              {tones.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <input
            placeholder="Recipient name"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />

          <input
            placeholder="Recipient email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
          />

          <textarea
            placeholder="Greeting text (optional — leave blank for AI later)"
            value={greetingText}
            onChange={(e) => setGreetingText(e.target.value)}
            rows={3}
          />

          <input
            placeholder="Photo URL (HTTPS)"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />

          <button type="submit" disabled={submitting}>
            {submitting ? "Sending..." : "Send Greeting"}
          </button>
        </div>
      </form>

      {result ? (
        <div style={{ marginTop: 20 }}>
          <h3>Result</h3>
          <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
