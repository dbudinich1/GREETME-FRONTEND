// src/pages/MerchOrders.jsx
// Phase 3C Stage 5 — Customer merch order list.
//
// Minimal scope per founder directive: no filters, no pagination UI, no
// expanded detail modal, no animations beyond existing dashboard standards.
// Calm/premium tone. Tracking links open in a new tab with rel="noopener
// noreferrer" — no iframe, no redirect proxy.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Truck, ArrowLeft, ExternalLink } from "lucide-react";
import api from "../api/api";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function formatPrice(cents) {
  const n = typeof cents === "number" ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
}

function statusBadgeStyle(kind) {
  switch (kind) {
    case "shipped":
      return { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" };
    case "issue":
      return { background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" };
    case "canceled":
      return { background: "#f3f4f6", color: "#4b5563", borderColor: "#d1d5db" };
    case "processing":
    default:
      return { background: "#eef2ff", color: "#4338ca", borderColor: "#c7d2fe" };
  }
}

export default function MerchOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 640);

  useEffect(() => {
    window.scrollTo(0, 0);
    const handleResize = () => setIsNarrow(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getMerchOrders();
        if (cancelled) return;
        setOrders(res?.orders || []);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: "100%", overflowX: "hidden" }}>
      {/* Header banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "var(--radius-xl)",
          padding: isNarrow ? "1.5rem" : "2rem",
          marginBottom: "1.5rem",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <Package size={isNarrow ? 24 : 28} />
          <h1
            style={{
              fontSize: isNarrow ? "1.375rem" : "1.75rem",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Your Orders
          </h1>
        </div>
        <p
          style={{
            margin: 0,
            color: "rgba(255, 255, 255, 0.85)",
            fontSize: isNarrow ? "0.875rem" : "1rem",
          }}
        >
          Status and shipment tracking for your Greet-Me merch.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{
            padding: "3rem 1.5rem",
            textAlign: "center",
            color: "var(--text-secondary)",
            fontStyle: "italic",
            fontSize: "0.9375rem",
          }}
        >
          Loading your orders…
        </div>
      ) : error ? (
        <div
          style={{
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            padding: isNarrow ? "1.5rem" : "2rem",
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          We couldn&rsquo;t load your orders just now. Please try again shortly.
        </div>
      ) : orders.length === 0 ? (
        <div
          style={{
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            padding: isNarrow ? "2rem 1.5rem" : "3rem",
            textAlign: "center",
          }}
        >
          <Package size={56} style={{ color: "var(--text-tertiary)", marginBottom: "1.25rem" }} />
          <h2
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "0.5rem",
            }}
          >
            No orders yet
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.9375rem",
              maxWidth: "420px",
              margin: "0 auto 1.5rem",
              lineHeight: 1.6,
            }}
          >
            When you place a merch order, it will appear here with shipment tracking.
          </p>
          <button
            onClick={() => navigate("/dashboard/merch")}
            style={{
              padding: "0.75rem 1.5rem",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-lg)",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
            }}
          >
            Browse Merch
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {orders.map((o) => {
            const badge = statusBadgeStyle(o.statusKind);
            const hasTracking = Array.isArray(o.packages) && o.packages.some((p) => p.trackingUrl);
            return (
              <div
                key={o.id}
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-xl)",
                  padding: isNarrow ? "1.25rem" : "1.5rem",
                }}
              >
                {/* Header row: status badge + date */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    marginBottom: "0.875rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "9999px",
                      border: `1px solid ${badge.borderColor}`,
                      background: badge.background,
                      color: badge.color,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {/* The backend owns customer-facing status meaning. This
                        fallback is a minimal backward-compatibility guard for a
                        response that predates the labelled projection — it can
                        never override a label the backend supplied, and it
                        deliberately does NOT mirror the backend state machine. */}
                    {o.statusLabel || "Processing"}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {formatDate(o.paidAt)}
                  </div>
                </div>

                {/* Body: items + total */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.9375rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {o.itemSummary || "Greet-Me merch"}
                    </p>
                    <p
                      style={{
                        margin: "0.25rem 0 0",
                        fontSize: "0.75rem",
                        color: "var(--text-tertiary)",
                        fontFamily: "monospace",
                      }}
                    >
                      Order {o.id.slice(0, 8)}
                    </p>
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatPrice(o.totalCents)}
                  </div>
                </div>

                {/* Tracking links (only when shipped + packages have trackingUrl) */}
                {hasTracking && (
                  <div
                    style={{
                      marginTop: "1rem",
                      paddingTop: "1rem",
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    {o.packages
                      .filter((p) => p.trackingUrl)
                      .map((p, idx) => (
                        <a
                          key={idx}
                          href={p.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color: "#4338ca",
                            textDecoration: "none",
                          }}
                        >
                          <Truck size={16} />
                          Track {p.carrier ? `with ${p.carrier}` : "shipment"}
                          <ExternalLink size={14} />
                        </a>
                      ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Back link */}
          <div style={{ marginTop: "0.5rem" }}>
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.625rem 1rem",
                background: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <ArrowLeft size={14} />
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
