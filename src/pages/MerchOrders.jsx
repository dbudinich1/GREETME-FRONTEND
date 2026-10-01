// src/pages/MerchOrders.jsx
// Phase 3C Stage 5 — Customer merch order list.
//
// Minimal scope per founder directive: no filters, no pagination UI, no
// expanded detail modal, no animations beyond existing dashboard standards.
// Calm/premium tone. Tracking links open in a new tab with rel="noopener
// noreferrer" — no iframe, no redirect proxy.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Truck, ArrowLeft, ExternalLink, Flower2, Gift } from "lucide-react";
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

// W42 — provider-neutral gift orders (GET /api/orders/history, source "gift": QR Cash, gift box,
// gift card, curated). Merch and Flower rows keep their own sections above/below, so they are
// never duplicated here. The backend owns status meaning; this layer only refuses to INVENT one.
const GIFT_CATEGORY_LABEL = {
  qrcash: "QR Cash",
  gift_box: "Gift box",
  gift_cards: "Gift card",
  curated: "Curated gift",
};

/**
 * Status text for a gift-order row. "Delivered" is shown ONLY when the backend sent kind
 * "delivered" (it does so only with a proven deliveredAt). A label that claims delivery under any
 * other kind is not trusted and falls back to a neutral label.
 */
// eslint-disable-next-line react-refresh/only-export-components -- pure helper exported for unit testing
export function giftOrderStatusLabel(status) {
  const kind = typeof status?.kind === "string" ? status.kind : "";
  const label = typeof status?.label === "string" ? status.label.trim() : "";
  if (kind === "delivered") return label || "Delivered";
  if (!label || /\bdeliver(ed|y)\b/i.test(label)) return "Processing";
  return label;
}

/** Only an https tracking URL is ever linked, and only when the backend marks tracking available. */
// eslint-disable-next-line react-refresh/only-export-components -- pure helper exported for unit testing
export function giftOrderTrackingHref(tracking) {
  if (!tracking || tracking.available !== true) return null;
  try {
    const u = new URL(String(tracking.trackingUrl || ""));
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function statusBadgeStyle(kind) {
  switch (kind) {
    case "shipped":
    case "delivered":
    case "completed":
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

  // Flower order visibility (Team 2) — fetched and rendered independently of the branded-goods
  // list above: a flower-orders failure must never affect the existing merch order list, and the
  // existing merch order list must never affect this one.
  const [flowerOrders, setFlowerOrders] = useState([]);
  const [flowerLoading, setFlowerLoading] = useState(true);
  const [flowerError, setFlowerError] = useState(null);

  // Gift orders (W42) — fetched independently from the combined history endpoint; a failure here
  // never affects the merch or flower sections, and vice versa.
  const [giftOrders, setGiftOrders] = useState([]);
  const [giftLoading, setGiftLoading] = useState(true);
  const [giftError, setGiftError] = useState(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getFlowerOrders();
        if (cancelled) return;
        setFlowerOrders(res?.orders || []);
        setFlowerError(null);
      } catch (e) {
        if (!cancelled) setFlowerError(e);
      } finally {
        if (!cancelled) setFlowerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getOrderHistory();
        if (cancelled) return;
        if (!res || res.ok !== true || !Array.isArray(res.orders)) throw new Error("order history unavailable");
        setGiftOrders(res.orders.filter((o) => o && o.source === "gift"));
        setGiftError(null);
      } catch (e) {
        if (!cancelled) setGiftError(e);
      } finally {
        if (!cancelled) setGiftLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasGiftOrders = !giftLoading && !giftError && giftOrders.length > 0;

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
          Status and shipment tracking for your American Gift Place orders.
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
      ) : orders.length === 0 && hasGiftOrders ? null : orders.length === 0 ? (
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
            When you place an order, it will appear here with shipment tracking.
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
            Browse the American Gift Place
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
                      {o.itemSummary || "Greet-Me gift order"}
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

      {/* Gift Orders (W42) — QR Cash, gift boxes, gift cards and curated gifts from the combined
          history endpoint. Status text is the backend's; "Delivered" appears only with backend
          proof. Tracking is shown only when the backend supplies it. */}
      {!giftLoading && giftError && (
        <div style={{ marginTop: "1.5rem", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
          We couldn&rsquo;t load your gift orders just now. Please try again shortly.
        </div>
      )}
      {hasGiftOrders && (
        <div data-testid="gift-orders-section" style={{ marginTop: "1.5rem" }}>
          <h2
            style={{
              fontSize: "1.0625rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: "0 0 0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Gift size={20} />
            Gift Orders
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {giftOrders.map((o) => {
              const kind = o.status?.kind;
              const badge = statusBadgeStyle(kind);
              const trackHref = giftOrderTrackingHref(o.tracking);
              const showCarrier = o.tracking?.available === true && (o.tracking.carrier || o.tracking.trackingNumber);
              return (
                <div
                  key={o.orderRef}
                  data-testid="gift-order-row"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-xl)",
                    padding: isNarrow ? "1.25rem" : "1.5rem",
                  }}
                >
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
                      data-testid="gift-order-status"
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
                      {giftOrderStatusLabel(o.status)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                      {GIFT_CATEGORY_LABEL[o.category] ? `${GIFT_CATEGORY_LABEL[o.category]} · ` : ""}
                      {formatDate(o.createdAt)}
                    </div>
                  </div>

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
                      <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.5 }}>
                        {o.itemSummary || "Greet-Me gift"}
                        {o.recipientName ? ` for ${o.recipientName}` : ""}
                      </p>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                        Order {String(o.orderRef || "").slice(-8)}
                      </p>
                    </div>
                    {typeof o.amountCents === "number" && (
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                        {formatPrice(o.amountCents)}
                      </div>
                    )}
                  </div>

                  {(trackHref || showCarrier || o.support) && (
                    <div
                      style={{
                        marginTop: "1rem",
                        paddingTop: "1rem",
                        borderTop: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                      }}
                    >
                      {trackHref ? (
                        <a
                          href={trackHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#4338ca", textDecoration: "none" }}
                        >
                          <Truck size={16} />
                          Track {o.tracking.carrier ? `with ${o.tracking.carrier}` : "shipment"}
                          <ExternalLink size={14} />
                        </a>
                      ) : showCarrier ? (
                        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                          {[o.tracking.carrier, o.tracking.trackingNumber].filter(Boolean).join(" ")}
                        </p>
                      ) : (
                        <span />
                      )}
                      {o.support && (
                        <a
                          href={`mailto:support@greet-me.com?subject=${encodeURIComponent(`Gift order ${String(o.orderRef || "").slice(-8)}`)}`}
                          style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#4338ca", textDecoration: "none", whiteSpace: "nowrap" }}
                        >
                          Get Help with This Order
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Flower Orders (Team 2, honest visibility correction) — rendered independently of the
          branded-goods list above, so it appears even for a purchaser with no merch orders at
          all. No tracking action is ever shown: this provider does not supply shipment tracking,
          and this section never claims otherwise. */}
      {!flowerLoading && flowerError && (
        <div style={{ marginTop: "1.5rem", fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
          We couldn&rsquo;t load your flower orders just now. Please try again shortly.
        </div>
      )}
      {!flowerLoading && !flowerError && flowerOrders.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h2
            style={{
              fontSize: "1.0625rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: "0 0 0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Flower2 size={20} />
            Flower Orders
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {flowerOrders.map((o) => (
              <div
                key={o.id}
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-xl)",
                  padding: isNarrow ? "1.25rem" : "1.5rem",
                }}
              >
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
                      border: "1px solid #c7d2fe",
                      background: "#eef2ff",
                      color: "#4338ca",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {o.status?.label || "Flower order submitted"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                    {formatDate(o.submittedAt)}
                  </div>
                </div>

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
                      {o.itemSummary || "Flowers"}
                      {o.recipientName ? ` for ${o.recipientName}` : ""}
                    </p>
                    <p
                      style={{
                        margin: "0.25rem 0 0",
                        fontSize: "0.75rem",
                        color: "var(--text-tertiary)",
                        fontFamily: "monospace",
                      }}
                    >
                      {o.orderReference ? `Order Reference ${o.orderReference}` : `Order ${o.id.slice(0, 8)}`}
                    </p>
                  </div>
                  {typeof o.amountCents === "number" && (
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatPrice(o.amountCents)}
                    </div>
                  )}
                </div>

                {/* Honest delivery/tracking copy — no tracking action is ever offered here. */}
                <div
                  style={{
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                    {o.requestedDeliveryDate
                      ? `Requested delivery: ${formatDate(o.requestedDeliveryDate)}. `
                      : ""}
                    Shipment tracking is not available.
                  </p>
                  <a
                    href={`mailto:support@greet-me.com?subject=${encodeURIComponent(
                      `Flower order${o.orderReference ? ` ${o.orderReference}` : ""}`,
                    )}`}
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#4338ca",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Get Help with This Order
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
