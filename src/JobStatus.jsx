import { useEffect, useState } from "react";
import { getErrorMessage } from "./utils/errorMessages";

export default function JobStatus({ jobId, apiBase, onComplete }) {
  const [status, setStatus] = useState("queued");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobId) return;

    const MAX_POLL_DURATION = 5 * 60 * 1000; // 5 minutes
    const POLL_INTERVAL = 3000;
    const pollStart = Date.now();
    let cancelled = false;

    const interval = setInterval(async () => {
      if (Date.now() - pollStart > MAX_POLL_DURATION) {
        clearInterval(interval);
        setStatus("timeout");
        setError("Your greeting is still being processed. You will receive an email when it is ready. You can close this page.");
        return;
      }

      try {
        const res = await fetch(`${apiBase}/api/jobs/${jobId}`);
        const data = await res.json();

        if (cancelled) return;

        setStatus(data.status || "queued");

        if (data.status === "completed") {
          clearInterval(interval);
          onComplete?.();
        }

        if (data.status === "failed") {
          clearInterval(interval);
          setError("Job failed");
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err));
          clearInterval(interval);
        }
      }
    }, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId, apiBase, onComplete]);

  if (error) {
    return (
      <div style={{ padding: 20, background: "#ffecec", borderRadius: 8 }}>
        <h3>❌ Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div style={{ padding: 20, background: "#e8f5e9", borderRadius: 8 }}>
        <h3>✅ Greeting Sent!</h3>
        <p>Your greeting has been sent successfully.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, background: "#f5f5f5", borderRadius: 8 }}>
      <h3>🔄 Processing...</h3>
      <p>Status: {status}</p>
      <div style={{ marginTop: 10 }}>
        <div style={{ 
          width: "100%", 
          height: 4, 
          background: "#ddd", 
          borderRadius: 2,
          overflow: "hidden"
        }}>
          <div style={{ 
            width: "60%", 
            height: "100%", 
            background: "#2196F3",
            animation: "pulse 1.5s ease-in-out infinite"
          }}></div>
        </div>
      </div>
    </div>
  );
}