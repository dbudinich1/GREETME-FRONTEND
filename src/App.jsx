import { useEffect, useMemo, useState } from "react";
import JobStatus from "./JobStatus.jsx";
import Legal from "./Legal.jsx";

/**
 * Generate a stable anonymous userId and store it in localStorage.
 * This gives us "user expansion" without login.
 */
function getOrCreateUserId() {
  const KEY = "greetme_user_id";
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;

  let id = "";
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    id = crypto.randomUUID();
  } else {
    id = `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  localStorage.setItem(KEY, id);
  return id;
}

export default function App() {
  const API_BASE = import.meta.env.VITE_API_BASE;

  // SPA hash route: /#/legal
  if (window.location.hash === "#/legal") {
    // Lazy import avoided: keep it simple and stable
    return <Legal />;
  }


  const userId = useMemo(() => {
    try {
      return getOrCreateUserId();
    } catch {
      // If localStorage is blocked, still allow app to run
      return "anon_no_storage";
    }
  }, []);

  // System status / errors
  const [status, setStatus] = useState("Loading...");
  const [error, setError] = useState("");

  // Occasion list
  const [occasions, setOccasions] = useState([]);
  const [occasionKey, setOccasionKey] = useState("");

  // Form fields
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [greetingText, setGreetingText] = useState("");

  // For now: URL-based photo (fastest path). Uploads come later.
  const [photoUrl, setPhotoUrl] = useState(
    "https://raw.githubusercontent.com/danielgatis/rembg/main/examples/person.jpg"
  );

  // Item 24: consent
  const [hasConsent, setHasConsent] = useState(false);
  const [consentTouched, setConsentTouched] = useState(false);

  // Submit result
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Load occasions on page load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError("");
        setStatus("Loading occasions...");

        if (!API_BASE) {
          setStatus("❌ Missing VITE_API_BASE");
          setError("Set VITE_API_BASE in your frontend .env file.");
          return;
        }

        const occRes = await fetch(`${API_BASE}/api/occasions`);
        const occJson = await occRes.json().catch(() => ({}));
        if (!occRes.ok) throw new Error(occJson?.error || "Failed to load occasions");

        const occList = Array.isArray(occJson.occasions) ? occJson.occasions : [];
        if (cancelled) return;

        setOccasions(occList);

        // Set default occasion once (avoid empty select)
        if (occList.length > 0) setOccasionKey((prev) => prev || occList[0].key);

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

  function validateBeforeSubmit() {
    if (!occasionKey) return "Please choose an occasion.";
    if (!recipientName.trim()) return "Please enter recipient name.";
    if (!recipientEmail.trim()) return "Please enter recipient email.";
    if (!photoUrl.trim()) return "Please enter a photo URL (HTTPS).";
    if (!hasConsent) return "You must confirm you have permission to use this photo and voice.";
    return "";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setResult(null);
    setError("");

    // Mark consent as "touched" so we can show inline error if needed
    setConsentTouched(true);

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setStatus("Sending job to API...");

      const payload = {
        userId,
        recipientEmail: recipientEmail.trim(),
        recipientName: recipientName.trim(),
        occasionKey,
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

  const consentError = consentTouched && !hasConsent;

  return (
    <div style={{ padding: 40, fontFamily: "system-ui, Arial, sans-serif" }}>
      <h1 style={{ marginBottom: 10 }}>Greet-Me.com</h1>

      <div style={{ marginBottom: 16, color: "#555" }}>
        <div>
          <b>Frontend:</b> Vite / React
        </div>
        <div>
          <b>API Base:</b> {API_BASE || "(missing)"}
        </div>
        <div>
          <b>User ID:</b> <code>{userId}</code>
        </div>
        <div>
          <b>Status:</b> {status}
        </div>
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

          {/* ITEM 24 — Consent */}
          <div
            style={{
              marginTop: 6,
              padding: 12,
              borderRadius: 8,
              border: consentError ? "1px solid #ff7a7a" : "1px solid #ddd",
              background: consentError ? "#fff3f3" : "#fafafa",
            }}
          >
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={hasConsent}
                onChange={(e) => setHasConsent(e.target.checked)}
                onBlur={() => setConsentTouched(true)}
                required
              />
              <span>
                I confirm that I own or have obtained all necessary rights and permissions to use
                this photo and voice, and that I consent to their use for creating and sending a
                personalized greeting.
              </span>
            </label>

            <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
              By continuing, you acknowledge that uploaded content may be processed by automated
              systems to generate audio and video greetings, in accordance with Greet-Me’s Terms of
              Service and Privacy Policy.
            </div>

            {consentError ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#b00020" }}>
                You must confirm you have permission to use this content before sending.
              </div>
            ) : null}
          </div>

          <button type="submit" disabled={submitting || !hasConsent}>
            {submitting ? "Sending..." : "Send Greeting"}
          </button>
        </div>
      </form>

            {result?.jobId ? (
        <div style={{ marginTop: 20 }}>
          <JobStatus
            jobId={result.jobId}
            apiBase={API_BASE}
            onComplete={() => {
              setStatus("✅ All done!");
            }}
          />
        </div>
      ) : null}

      {/* Legal footer */}
      <div style={{ marginTop: 24, fontSize: 12, color: "#555" }}>
        <a href="/#/legal">Terms of Service</a> |{" "}
        <a href="/#/legal">Privacy Policy</a>
      </div>
    </div>
