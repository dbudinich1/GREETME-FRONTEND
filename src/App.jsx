import { useEffect, useState } from "react";

export default function App() {
  const API_BASE = import.meta.env.VITE_API_BASE;

  const [status, setStatus] = useState("Loading...");
  const [error, setError] = useState("");

  const [occasions, setOccasions] = useState([]);
  const [tones, setTones] = useState([]);

  const [occasion, setOccasion] = useState("");
  const [tone, setTone] = useState("");

  const [toName, setToName] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [photoFile, setPhotoFile] = useState(null);
  const [voiceFile, setVoiceFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Load occasions + tones on page load
  useEffect(() => {
    (async () => {
      try {
        setError("");
        setStatus("Loading occasions + tones...");

        const [occRes, toneRes] = await Promise.all([
          fetch(`${API_BASE}/occasions`),
          fetch(`${API_BASE}/tones`),
        ]);

        // If backend returns HTML (like an error page), this will throw — good.
        const occJson = await occRes.json();
        const toneJson = await toneRes.json();

        if (!occRes.ok) throw new Error(occJson?.error || "Failed to load occasions");
        if (!toneRes.ok) throw new Error(toneJson?.error || "Failed to load tones");

        setOccasions(Array.isArray(occJson.occasions) ? occJson.occasions : []);
        setTones(Array.isArray(toneJson.tones) ? toneJson.tones : []);
        setStatus("Loaded successfully ✅");
      } catch (e) {
        console.error(e);
        setError(String(e?.message || e));
        setStatus("❌ Fetch failed");
      }
    })();
  }, [API_BASE]);

  async function onSubmit(e) {
    e.preventDefault();
    setResult(null);
    setError("");

    if (!occasion) return setError("Please choose an occasion.");
    if (!tone) return setError("Please choose a tone.");
    if (!toName.trim()) return setError("Please enter recipient name.");
    if (!toEmail.trim()) return setError("Please enter recipient email.");
    if (!photoFile) return setError("Please choose a photo file.");
    if (!voiceFile) return setError("Please choose a voice file.");

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append("occasion", occasion);
      formData.append("tone", tone);
      formData.append("toName", toName);
      formData.append("toEmail", toEmail);
      formData.append("notes", notes);
      formData.append("photo", photoFile);
      formData.append("voice", voiceFile);

      const res = await fetch(`${API_BASE}/api/jobs/send-greeting`, {
        method: "POST",
        body: formData,
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
            <select value={occasion} onChange={(e) => setOccasion(e.target.value)}>
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
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
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
            value={toName}
            onChange={(e) => setToName(e.target.value)}
          />

          <input
            placeholder="Recipient email"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
          />

          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />

          <label>
            Photo:
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            />
          </label>

          <label>
            Voice:
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setVoiceFile(e.target.files?.[0] || null)}
            />
          </label>

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
