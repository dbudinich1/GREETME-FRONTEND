import { useEffect, useState } from "react";

export default function App() {
  const API_BASE = import.meta.env.VITE_API_BASE;

  const [status, setStatus] = useState("Loading...");
  const [error, setError] = useState("");

  const [occasions, setOccasions] = useState([]);
  const [tones, setTones] = useState([]);

  const [occasionKey, setOccasionKey] = useState("");
  const [toneKey, setToneKey] = useState("");

  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [greetingText, setGreetingText] = useState("");

  // For now: URL-based photo (fastest path). Uploads come later.
  const [photoUrl, setPhotoUrl] = useState(
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2"
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
          fetch(`${API_BASE}/api/tones`),
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

        // ✅ Defaults so keys are never empty (prevents “non-empty string” backend errors)
        const defaultOccasion = occList[0]?.key || "";
        const defaultTone = toneList[0] || "";

        setOccasionKey((prev) => prev || defaultOccasion);
        setToneKey((prev) => prev || defaultTone);

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

    const cleanOccasionKey = (occasionKey || "").trim();
    const cleanToneKey = (toneKey || "").trim();
    const cleanRecipientName = (recipientName || "").trim();
    const cleanRecipientEmail = (recipientEmail || "").trim();
    const cleanPhotoUrl = (photoUrl || "").trim();

    if (!cleanOccasionKey) return setError("Please choose an occasion.");
    if (!cleanToneKey) return setError("Please choose a tone.");
    if (!cleanRecipientName) return setError("Please enter recipient name.");
    if (!cleanRecipientEmail) return setError("Please enter recipient email.");
    if (!cleanPhotoUrl) return setError("Please enter a photo URL (HTTPS).");

    try {
      setSubmitting(true);
      setStatus("Sending job to API...");

      const payload = {
        recipientEmail: cleanRecipientEmail,
        recipientName: cleanRecipientName,
        occasionKey: cleanOccasionKey,
        tone: cleanToneKey, // 🔥 THIS IS THE FIX
        greetingText: greetingText || "",
        photoUrl: cleanPhotoUrl,
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
        <div><b>API Base:</b> {API_BASE}</div>
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
            placeholder="Greeting text (optional)"
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
