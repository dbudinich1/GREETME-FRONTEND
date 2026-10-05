// src/pages/MerchOrders.jsx
//
// "Your Orders" (route /dashboard/merch/orders, nav label unchanged). W42 provider-neutral order history, founder-approved
// (Surface 11 review, 2026-10-05): ONE dated list, newest first, for everything the customer has ordered through Greet-Me -
// Branded Goods (Printful), Flowers (Florist One), Goody and other gift boxes, QR Cash, Prezzee gift cards (rows appear only when
// that provider is activated), curated gifts - with a type chip on every row and filters.
//
// Honesty: the backend owns status meaning and its label is shown as it is; "Delivered" appears only for kind "delivered" (proof);
// an unknown or missing status reads "Status unavailable" with Get Help; tracking is linked only when the backend marks it available
// and the link is https; flowers show their order reference, requested delivery date and Get Help and never claim tracking.
// Reads and fallback rules live in utils/myOrders.js (no endpoint is repointed or added).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Truck, ArrowLeft, ExternalLink } from "lucide-react";
import api from "../api/api";
import { giftOrderStatusLabel, giftOrderTrackingHref, giftStatusBadgeStyle } from "../utils/orderStatus";
import { categoryLabel, loadMyOrders, NOTE_TEXT } from "../utils/myOrders";

const SUPPORT_EMAIL = "support@greet-me.com";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// A plain calendar date ("2026-10-14") is shown as that date in every timezone.
function formatRequested(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!m) return "";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;
const supportHref = (r) =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${categoryLabel(r.category)} order ${r.providerReference || r.shortRef}`)}`;

const card = { background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)" };

export default function MerchOrders() {
  const navigate = useNavigate();
  const [state, setState] = useState({ phase: "loading", rows: [], truncated: false, notes: [] });
  const [filter, setFilter] = useState("all");
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 640);

  useEffect(() => {
    window.scrollTo(0, 0);
    const handleResize = () => setIsNarrow(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, phase: "loading" }));
    const res = await loadMyOrders(api);
    setState(res.failed
      ? { phase: "error", rows: [], truncated: false, notes: [] }
      : { phase: "ready", rows: res.rows, truncated: res.truncated, notes: res.notes });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await loadMyOrders(api);
      if (cancelled) return;
      setState(res.failed
        ? { phase: "error", rows: [], truncated: false, notes: [] }
        : { phase: "ready", rows: res.rows, truncated: res.truncated, notes: res.notes });
    })();
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(
    () => state.rows.reduce((m, r) => { const k = categoryLabel(r.category); m[k] = (m[k] || 0) + 1; return m; }, {}),
    [state.rows],
  );
  // A chosen filter that no longer has rows (after Try again) falls back to All.
  const activeFilter = filter === "all" || counts[filter] ? filter : "all";
  const shown = activeFilter === "all" ? state.rows : state.rows.filter((r) => categoryLabel(r.category) === activeFilter);

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
          <h1 style={{ fontSize: isNarrow ? "1.375rem" : "1.75rem", fontWeight: 700, margin: 0 }}>Your Orders</h1>
        </div>
        <p style={{ margin: 0, color: "rgba(255, 255, 255, 0.85)", fontSize: isNarrow ? "0.875rem" : "1rem" }}>
          Every gift and order you have placed with Greet-Me, in one place.
        </p>
      </div>

      {state.phase === "loading" && (
        <div
          data-testid="orders-loading"
          style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--text-secondary)", fontStyle: "italic", fontSize: "0.9375rem" }}
        >
          Loading your orders&hellip;
        </div>
      )}

      {state.phase === "error" && (
        <div
          data-testid="orders-error"
          role="alert"
          style={{ ...card, padding: isNarrow ? "1.5rem" : "2rem", textAlign: "center", color: "var(--text-secondary)" }}
        >
          <p style={{ margin: "0 0 0.75rem" }}>We couldn&rsquo;t load your orders just now. Please try again shortly.</p>
          <button
            type="button"
            data-testid="orders-retry"
            onClick={load}
            style={{ padding: "0.625rem 1.25rem", borderRadius: "var(--radius-lg)", border: "none", background: "#4f46e5", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Try again
          </button>
        </div>
      )}

      {state.phase === "ready" && state.notes.length > 0 && (
        <div data-testid="orders-notes" role="status" style={{ marginBottom: "1rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
          {state.notes.map((n) => (
            <p key={n} data-testid={`orders-note-${n}`} style={{ margin: "0 0 0.25rem" }}>{NOTE_TEXT[n]}</p>
          ))}
          <button
            type="button"
            data-testid="orders-retry"
            onClick={load}
            style={{ marginTop: "0.25rem", padding: "0.375rem 0.875rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "transparent", color: "#4338ca", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "0.8125rem" }}
          >
            Try again
          </button>
        </div>
      )}

      {state.phase === "ready" && state.rows.length === 0 && (
        <div data-testid="orders-empty" style={{ ...card, padding: isNarrow ? "2rem 1.5rem" : "3rem", textAlign: "center" }}>
          <Package size={56} style={{ color: "var(--text-tertiary)", marginBottom: "1.25rem" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem" }}>No orders yet</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", maxWidth: "420px", margin: "0 auto 1.5rem", lineHeight: 1.6 }}>
            Gifts, flowers and Branded Goods you order will appear here.
          </p>
          <button
            onClick={() => navigate("/dashboard/merch")}
            style={{ padding: "0.75rem 1.5rem", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white", border: "none", borderRadius: "var(--radius-lg)", fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)" }}
          >
            Browse the American Gift Place
          </button>
        </div>
      )}

      {state.phase === "ready" && state.rows.length > 0 && (
        <>
          <div role="group" aria-label="Filter orders" data-testid="orders-filters" style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "0.875rem" }}>
            {["all", ...Object.keys(counts)].map((k) => (
              <button
                key={k}
                type="button"
                data-testid={`orders-filter-${k === "all" ? "all" : k.toLowerCase().replace(/\s+/g, "-")}`}
                aria-pressed={activeFilter === k}
                onClick={() => setFilter(k)}
                style={{ padding: "0.3125rem 0.75rem", borderRadius: "9999px", border: "1px solid #c7d2fe", background: activeFilter === k ? "#e0e7ff" : "var(--bg-primary)", fontWeight: activeFilter === k ? 700 : 500, fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                {k === "all" ? `All (${state.rows.length})` : `${k} (${counts[k]})`}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {shown.map((r) => {
              const badge = giftStatusBadgeStyle(r.status && r.status.kind);
              const href = giftOrderTrackingHref(r.tracking);
              const carrierText = r.tracking && r.tracking.available === true && !href
                ? [r.tracking.carrier, r.tracking.trackingNumber].filter(Boolean).join(" ")
                : "";
              const isFlower = r.source === "flowers";
              const requested = formatRequested(r.requestedDeliveryDate);
              return (
                <div
                  key={r.key}
                  data-testid="order-row"
                  data-category={r.category}
                  data-kind={r.status && r.status.kind}
                  style={{ ...card, padding: isNarrow ? "1.25rem" : "1.5rem" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.875rem", flexWrap: "wrap" }}>
                    <div
                      data-testid="order-status"
                      style={{ display: "inline-flex", alignItems: "center", padding: "0.25rem 0.75rem", borderRadius: "9999px", border: `1px solid ${badge.borderColor}`, background: badge.background, color: badge.color, fontSize: "0.75rem", fontWeight: 600 }}
                    >
                      {giftOrderStatusLabel(r.status)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                      <b data-testid="order-type" style={{ color: "var(--text-secondary)" }}>{categoryLabel(r.category)}</b>
                      {formatDate(r.createdAt) ? ` · ${formatDate(r.createdAt)}` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.5 }}>
                        {r.itemSummary || "Greet-Me order"}
                        {r.recipientName ? ` for ${r.recipientName}` : ""}
                      </p>
                      <p data-testid="order-ref" style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                        {r.providerReference ? `Order Reference ${r.providerReference}` : `Order ${r.shortRef}`}
                      </p>
                    </div>
                    {typeof r.amountCents === "number" && (
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                        {formatPrice(r.amountCents)}
                      </div>
                    )}
                  </div>

                  {(requested || href || carrierText || isFlower || r.support) && (
                    <div
                      style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}
                    >
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                        {requested && <div data-testid="order-requested">Requested delivery: {requested}</div>}
                        {href && (
                          <a
                            data-testid="order-track"
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#4338ca", textDecoration: "none" }}
                          >
                            <Truck size={16} />
                            Track {r.tracking.carrier ? `with ${r.tracking.carrier}` : "shipment"}
                            <ExternalLink size={14} />
                          </a>
                        )}
                        {!href && carrierText && <div data-testid="order-carrier">{carrierText}</div>}
                        {isFlower && <div data-testid="order-no-tracking">Shipment tracking is not available for flower orders.</div>}
                      </div>
                      {r.support && (
                        <a
                          data-testid="order-support"
                          href={supportHref(r)}
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

          {state.truncated && (
            <p data-testid="orders-truncated" style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", marginTop: "0.75rem" }}>
              Showing your most recent orders. Older orders are not listed here yet.
            </p>
          )}
        </>
      )}

      {/* Back link */}
      {state.phase !== "loading" && (
        <div style={{ marginTop: "1.5rem" }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.625rem 1rem", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
