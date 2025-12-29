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

// D6 VALIDATION HELPERS
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

const validateUrl = (url) => {
  try {
    const urlObj = new URL(url.trim());
    return urlObj.protocol === "https:";
  } catch {
    return false;
  }
};

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

  // D6: Field validation tracking
  const [fieldTouched, setFieldTouched] = useState({
    occasionKey: false,
    recipientName: false,
    recipientEmail: false,
    photoUrl: false,
  });

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

  // D6: Get field-specific errors
  const getFieldError = (fieldName) => {
    if (!fieldTouched[fieldName]) return "";

    switch (fieldName) {
      case "occasionKey":
        return !occasionKey ? "Please select an occasion" : "";
      case "recipientName":
        return !recipientName.trim() ? "Recipient name is required" : "";
      case "recipientEmail":
        if (!recipientEmail.trim()) return "Recipient email is required";
        if (!validateEmail(recipientEmail)) return "Please enter a valid email address";
        return "";
      case "photoUrl":
        if (!photoUrl.trim()) return "Photo URL is required";
        if (!validateUrl(photoUrl)) return "Please enter a valid HTTPS URL";
        return "";
      default:
        return "";
    }
  };

  // D6: Mark field as touched
  const handleFieldBlur = (fieldName) => {
    setFieldTouched((prev) => ({ ...prev, [fieldName]: true }));
  };

  function validateBeforeSubmit() {
    // Mark all fields as touched
    setFieldTouched({
      occasionKey: true,
      recipientName: true,
      recipientEmail: true,
      photoUrl: true,
    });
    setConsentTouched(true);

    if (!occasionKey) return "Please choose an occasion.";
    if (!recipientName.trim()) return "Please enter recipient name.";
    if (!recipientEmail.trim()) return "Please enter recipient email.";
    if (!validateEmail(recipientEmail)) return "Please enter a valid email address.";
    if (!photoUrl.trim()) return "Please enter a photo URL (HTTPS).";
    if (!validateUrl(photoUrl)) return "Please enter a valid HTTPS URL.";
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

  // D6: Check if form is valid
  const isFormValid = 
    occasionKey &&
    recipientName.trim() &&
    validateEmail(recipientEmail) &&
    validateUrl(photoUrl) &&
    hasConsent;

  // D7: RESPONSIVE HANDLING
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: isMobile ? "10px" : "20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    }}>
      <div style={{
        maxWidth: "800px",
        margin: "0 auto",
        background: "white",
        borderRadius: "16px",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        overflow: "hidden",
      }}>
        
        {/* HEADER */}
        <div style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: isMobile ? "30px 20px" : "40px 30px",
          color: "white",
          textAlign: "center",
        }}>
          <h1 style={{
            margin: 0,
            fontSize: isMobile ? "1.8rem" : "2.5rem",
            fontWeight: 700,
            letterSpacing: "-0.5px",
          }}>Greet-Me</h1>
          <p style={{
            margin: "10px 0 0 0",
            fontSize: "1rem",
            opacity: 0.9,
            fontWeight: 400,
          }}>Send personalized AI-powered video greetings</p>
        </div>

        {/* CONTENT */}
        <div style={{ padding: isMobile ? "24px 20px" : "40px 30px" }}>
          
          {/* DEBUG INFO */}
          <div style={{
            background: "#f8f9fa",
            border: "1px solid #e9ecef",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "24px",
            fontSize: "0.875rem",
            color: "#495057",
          }}>
            <div style={{ marginBottom: 8 }}>
              <b>Frontend:</b> Vite / React
            </div>
            <div style={{ marginBottom: 8 }}>
              <b>API Base:</b> {API_BASE || "(missing)"}
            </div>
            <div style={{ marginBottom: 8 }}>
              <b>User ID:</b> <code>{userId}</code>
            </div>
            <div>
              <b>Status:</b> {status}
            </div>
          </div>

          {/* ERROR BOX */}
          {error ? (
            <div style={{
              background: "#fff5f5",
              border: "1px solid #feb2b2",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "24px",
              color: "#c53030",
            }}>
              ⚠️ {error}
            </div>
          ) : null}

          {/* FORM */}
          <form onSubmit={onSubmit}>
            <div style={{ display: "grid", gap: "24px" }}>
              
              {/* OCCASION */}
              <div>
                <label style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "#2d3748",
                }}>
                  Occasion <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <select
                  value={occasionKey}
                  onChange={(e) => setOccasionKey(e.target.value)}
                  onBlur={() => handleFieldBlur("occasionKey")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    border: getFieldError("occasionKey") ? "2px solid #fc8181" : "2px solid #e2e8f0",
                    transition: "all 0.2s ease",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    cursor: "pointer",
                    background: getFieldError("occasionKey") ? "#fff5f5" : "white",
                  }}
                >
                  <option value="">Select occasion</option>
                  {occasions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.title}
                    </option>
                  ))}
                </select>
                {getFieldError("occasionKey") && (
                  <div style={{ color: "#e53e3e", fontSize: "0.875rem", marginTop: 6 }}>
                    ⚠️ {getFieldError("occasionKey")}
                  </div>
                )}
              </div>

              {/* RECIPIENT NAME */}
              <div>
                <label style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "#2d3748",
                }}>
                  Recipient Name <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <input
                  placeholder="e.g., John Smith"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  onBlur={() => handleFieldBlur("recipientName")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    border: getFieldError("recipientName") ? "2px solid #fc8181" : "2px solid #e2e8f0",
                    transition: "all 0.2s ease",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    background: getFieldError("recipientName") ? "#fff5f5" : "white",
                  }}
                />
                {getFieldError("recipientName") && (
                  <div style={{ color: "#e53e3e", fontSize: "0.875rem", marginTop: 6 }}>
                    ⚠️ {getFieldError("recipientName")}
                  </div>
                )}
              </div>

              {/* RECIPIENT EMAIL */}
              <div>
                <label style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "#2d3748",
                }}>
                  Recipient Email <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g., john@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  onBlur={() => handleFieldBlur("recipientEmail")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    border: getFieldError("recipientEmail") ? "2px solid #fc8181" : "2px solid #e2e8f0",
                    transition: "all 0.2s ease",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    background: getFieldError("recipientEmail") ? "#fff5f5" : "white",
                  }}
                />
                {getFieldError("recipientEmail") && (
                  <div style={{ color: "#e53e3e", fontSize: "0.875rem", marginTop: 6 }}>
                    ⚠️ {getFieldError("recipientEmail")}
                  </div>
                )}
              </div>

              {/* GREETING TEXT */}
              <div>
                <label style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "#2d3748",
                }}>
                  Greeting Text <span style={{ color: "#718096", fontWeight: 400 }}>(Optional)</span>
                </label>
                <textarea
                  placeholder="Leave blank for AI-generated greeting, or write your own message..."
                  value={greetingText}
                  onChange={(e) => setGreetingText(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    border: "2px solid #e2e8f0",
                    transition: "all 0.2s ease",
                    fontFamily: "inherit",
                    resize: "vertical",
                    minHeight: "100px",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: "0.875rem", color: "#718096", marginTop: 6 }}>
                  💡 Our AI will generate a personalized message if left blank
                </div>
              </div>

              {/* PHOTO URL */}
              <div>
                <label style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "#2d3748",
                }}>
                  Photo URL <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <input
                  placeholder="https://example.com/photo.jpg"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  onBlur={() => handleFieldBlur("photoUrl")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    border: getFieldError("photoUrl") ? "2px solid #fc8181" : "2px solid #e2e8f0",
                    transition: "all 0.2s ease",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    background: getFieldError("photoUrl") ? "#fff5f5" : "white",
                  }}
                />
                {getFieldError("photoUrl") && (
                  <div style={{ color: "#e53e3e", fontSize: "0.875rem", marginTop: 6 }}>
                    ⚠️ {getFieldError("photoUrl")}
                  </div>
                )}
                <div style={{ fontSize: "0.875rem", color: "#718096", marginTop: 6 }}>
                  🔒 Must be a valid HTTPS URL
                </div>
              </div>

              {/* CONSENT CHECKBOX */}
              <div style={{
                marginTop: 6,
                padding: "20px",
                borderRadius: "12px",
                border: consentError ? "2px solid #fc8181" : "2px solid #e2e8f0",
                background: consentError ? "#fff5f5" : "#f7fafc",
                transition: "all 0.2s ease",
              }}>
                <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={hasConsent}
                    onChange={(e) => setHasConsent(e.target.checked)}
                    onBlur={() => setConsentTouched(true)}
                    required
                    style={{
                      marginTop: 3,
                      cursor: "pointer",
                      width: "18px",
                      height: "18px",
                      accentColor: "#667eea",
                    }}
                  />
                  <span style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "#2d3748" }}>
                    I confirm that I own or have obtained all necessary rights and permissions to use
                    this photo and voice, and that I consent to their use for creating and sending a
                    personalized greeting. <span style={{ color: "#e53e3e" }}>*</span>
                  </span>
                </label>

                <div style={{ fontSize: "0.8rem", color: "#718096", marginTop: 12, lineHeight: 1.5, paddingLeft: 30 }}>
                  By continuing, you acknowledge that uploaded content may be processed by automated
                  systems to generate audio and video greetings, in accordance with Greet-Me's Terms of
                  Service and Privacy Policy.
                </div>

                {consentError && (
                  <div style={{ marginTop: 8, fontSize: "0.875rem", color: "#e53e3e", paddingLeft: 30 }}>
                    ⚠️ You must confirm you have permission to use this content before sending.
                  </div>
                )}
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={submitting || !isFormValid}
                style={{
                  width: "100%",
                  padding: "16px 32px",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  borderRadius: "10px",
                  border: "none",
                  cursor: submitting || !isFormValid ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: submitting || !isFormValid ? "none" : "0 4px 14px rgba(0, 0, 0, 0.1)",
                  background: submitting || !isFormValid ? "#cbd5e0" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: submitting || !isFormValid ? "#a0aec0" : "white",
                }}
                onMouseOver={(e) => {
                  if (!submitting && isFormValid) {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.15)";
                  }
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.1)";
                }}
              >
                {submitting ? "🚀 Sending..." : "✨ Send Greeting"}
              </button>
            </div>
          </form>

          {/* JOB STATUS */}
          {result?.jobId ? (
            <div style={{ marginTop: 32 }}>
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
          <div style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: "1px solid #e2e8f0",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "#718096",
          }}>
            <a href="/#/legal" style={{
              color: "#667eea",
              textDecoration: "none",
              fontWeight: 500,
              transition: "color 0.2s ease",
            }}>Terms of Service</a>
            {" | "}
            <a href="/#/legal" style={{
              color: "#667eea",
              textDecoration: "none",
              fontWeight: 500,
              transition: "color 0.2s ease",
            }}>Privacy Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
}