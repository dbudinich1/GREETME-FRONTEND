// src/pages/founder/FounderCentralCommand.jsx — TEAM 5 (2026-09-29).
//
// A single founder-only entry point that SURFACES and LINKS TO the existing canonical management
// surfaces (Fundraising, Salespeople, Catalog Management) plus a new read-only Operational Alerts
// summary for unresolved QR Cash payouts. This does not rewrite, duplicate, or take over any of
// those surfaces — every "Open ___" action below routes to the real, unchanged page. Existing
// routes, permissions, and backend authorization are untouched; this is a navigation/composition
// layer on top of what already exists.
//
// Founder-only, matching the established pattern elsewhere in this codebase (e.g.
// SalespersonControlCenter.jsx): the client-side isFounder() check here is COSMETIC — it hides a
// door it does not lock. The real authorization is server-side: every summary this page reads
// (founderCommandApi, fundraiserApi.founder, salesAdminApi, founderCatalogApi) is independently
// requireAuth + requireFounder-gated on the backend, and a non-founder gets 403 from each one
// regardless of what this page renders.

import { useEffect, useState } from "react";
import { isFounder } from "../../utils/accountState.js";
import { founderCommandApi } from "../../api/founderCommand.js";
import { fundraiserApi } from "../../api/fundraiserApi.js";
import { salesAdminApi, salesAdminErrorMessage } from "../../api/salesAdmin.js";
import { founderCatalogApi } from "../../api/founderCatalog.js";

function readUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

const card = {
  background: "#fff", border: "1px solid rgba(27,24,48,.12)", borderRadius: 16,
  padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, minHeight: 150,
};
const cardTitle = { margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1b1830" };
const statRow = { display: "flex", justifyContent: "space-between", fontSize: ".85rem", color: "#3a3552" };
const statValue = { fontWeight: 700, color: "#1b1830" };
const unavailable = { color: "#928ea8", fontStyle: "italic" };
const linkBtn = {
  marginTop: "auto", alignSelf: "flex-start", background: "#4F2D7F", color: "#fff",
  border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: ".82rem",
  textDecoration: "none", display: "inline-block",
};
const severityColor = { normal: "#3a3552", attention: "#b3261e" };

const PARTNER_LINKS_SHOWN = 5;

/** A count the server stated, or an "unavailable" marker - never a guessed 0. */
function overviewCount(section, key) {
  const n = section && section[key];
  return Number.isFinite(n) ? n : <span style={unavailable}>unavailable</span>;
}
/** { active: 2, draft: 1 } -> "Active 2 · Draft 1"; null when there is nothing to say. */
function statusPairs(byStatus) {
  if (!byStatus || typeof byStatus !== "object") return null;
  const parts = Object.entries(byStatus)
    .filter(([, n]) => Number.isFinite(n))
    .map(([k, n]) => `${String(k).replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase())} ${n}`);
  return parts.length ? parts.join(" · ") : null;
}

function money(cents) {
  if (!Number.isFinite(cents)) return null;
  return `$${(cents / 100).toFixed(2)}`;
}
function ageLabel(ms) {
  if (!Number.isFinite(ms)) return null;
  const days = Math.floor(ms / (24 * 3600 * 1000));
  if (days < 1) return "under a day";
  return `${days} day${days === 1 ? "" : "s"}`;
}

// TEAM 5 — a real, honestly-reported gap (see the completion report): no founder-authenticated
// action exists anywhere to mark a QR Cash payout resolved, only an admin-key-gated internal
// route (routes/giftRoutes.js#admin/fulfill). "Review Payouts" therefore links to the read-only
// admin/list surface via a documented path rather than a nonexistent founder-facing management
// screen — this constant makes that gap visible in one place instead of silently working around it.
const QR_CASH_MANAGEMENT_SURFACE_EXISTS = false;

// Injectable, defaulting to the real clients — the same dependency-injection shape this codebase
// already uses elsewhere (e.g. SalespersonControlCenter's `api = salesAdminApi`), so tests can
// supply fakes without esbuild inlining the real network-calling modules into a test bundle.
// Founder decision (Surface 9): the fundraising cards say PLAINLY that payouts are off. There is no backend
// flag this page can read for it, so the statement is one constant here; flip it only when payouts are
// authorized and a real flag is wired.
export const FUNDRAISER_PAYOUTS_ACTIVE = false;
const PAYOUTS_OFF_TEXT = "Payouts are OFF. Nothing is paid out to organizations or participants yet.";
function PayoutsNote({ testId }) {
  return FUNDRAISER_PAYOUTS_ACTIVE ? null : (
    <p data-testid={testId} role="note" style={{ margin: "0 0 .5rem", fontSize: ".84rem", fontWeight: 600 }}>{PAYOUTS_OFF_TEXT}</p>
  );
}

export default function FounderCentralCommand({
  user: injectedUser,
  qrCashApi = founderCommandApi,
  fundraiserOverviewApi = fundraiserApi.founder,
  salesApi = salesAdminApi,
  catalogApi = founderCatalogApi,
} = {}) {
  const user = injectedUser !== undefined ? injectedUser : readUser();
  const founder = isFounder(user);

  const [qrCash, setQrCash] = useState({ loading: true, data: null, error: null });
  const [fundraising, setFundraising] = useState({ loading: true, data: null, error: null });
  const [orgs, setOrgs] = useState({ loading: true, rows: [], error: null }); // W36 partner-portal entry links
  const [sales, setSales] = useState({ loading: true, activeCount: null, error: null });
  const [catalog, setCatalog] = useState({ loading: true, activeCount: null, totalCount: null, error: null });

  useEffect(() => {
    if (!founder) return undefined;
    let alive = true;
    (async () => {
      const res = await qrCashApi.qrCashPayoutSummary();
      if (!alive) return;
      if (res.ok && res.data && res.data.ok) setQrCash({ loading: false, data: res.data, error: null });
      else setQrCash({ loading: false, data: null, error: "Couldn't load the payout summary." });
    })();
    return () => { alive = false; };
  }, [founder, qrCashApi]);

  useEffect(() => {
    if (!founder) return undefined;
    let alive = true;
    (async () => {
      const res = await fundraiserOverviewApi.overview();
      if (!alive) return;
      if (res.ok && res.data) setFundraising({ loading: false, data: res.data, error: null });
      else setFundraising({ loading: false, data: null, error: "Couldn't load the fundraising overview." });
    })();
    return () => { alive = false; };
  }, [founder, fundraiserOverviewApi]);

  // W36 - the EXISTING founder organizations read (GET /api/fundraiser/admin/organizations), used
  // only to build links to the existing partner portal route. A founder passes
  // requirePartnerAdminFor for any organization server-side, so the portal link resolves.
  useEffect(() => {
    if (!founder) return undefined;
    let alive = true;
    (async () => {
      if (typeof fundraiserOverviewApi.organizations !== "function") {
        setOrgs({ loading: false, rows: [], error: "Couldn't load partner organizations." });
        return;
      }
      const res = await fundraiserOverviewApi.organizations();
      if (!alive) return;
      if (res && res.ok && Array.isArray(res.data)) setOrgs({ loading: false, rows: res.data, error: null });
      else setOrgs({ loading: false, rows: [], error: "Couldn't load partner organizations." });
    })();
    return () => { alive = false; };
  }, [founder, fundraiserOverviewApi]);

  useEffect(() => {
    if (!founder) return undefined;
    let alive = true;
    (async () => {
      const res = await salesApi.list();
      if (!alive) return;
      if (res.ok) {
        const rows = Array.isArray(res.data && res.data.salespeople) ? res.data.salespeople : [];
        setSales({ loading: false, activeCount: rows.filter((r) => r.status === "active").length, error: null });
      } else {
        setSales({ loading: false, activeCount: null, error: salesAdminErrorMessage(res, { context: "load" }) });
      }
    })();
    return () => { alive = false; };
  }, [founder, salesApi]);

  useEffect(() => {
    if (!founder) return undefined;
    let alive = true;
    (async () => {
      const res = await catalogApi.listProviders();
      if (!alive) return;
      if (res.ok && res.data && Array.isArray(res.data.providers)) {
        const providers = res.data.providers;
        setCatalog({
          loading: false,
          activeCount: providers.filter((p) => p.enabled).length,
          totalCount: providers.length,
          error: null,
        });
      } else {
        setCatalog({ loading: false, activeCount: null, totalCount: null, error: "Couldn't load catalog providers." });
      }
    })();
    return () => { alive = false; };
  }, [founder, catalogApi]);

  // ── ORDINARY USERS SEE NOTHING ── same pattern as SalespersonControlCenter.jsx: rendered
  // before any request is issued, so a non-founder never triggers a call that would 403 anyway.
  if (!founder) {
    return (
      <div style={{ padding: "2rem" }} data-testid="founder-command-denied">
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Not available</h1>
        <p style={{ marginTop: ".5rem", color: "#605c78" }}>This area is limited to the founder account.</p>
      </div>
    );
  }

  const qrSeverity = qrCash.data && qrCash.data.unresolvedCount > 0 ? "attention" : "normal";

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }} data-testid="founder-central-command">
      <header style={{ marginBottom: "1.25rem" }}>
        <p style={{ fontSize: ".78rem", fontWeight: 700, color: "#928ea8", textTransform: "uppercase", margin: "0 0 4px" }}>
          Founder
        </p>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", margin: 0 }}>Founder Central Command</h1>
        <p style={{ color: "#605c78", fontSize: ".85rem", margin: "6px 0 0" }}>
          One place to see what needs attention, and reach the existing management screen for it.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {/* ── OPERATIONAL ALERTS: unresolved QR Cash payouts ─────────────────────────────────── */}
        <section style={card} data-testid="fcc-card-qrcash" aria-labelledby="fcc-qrcash-title">
          <h2 id="fcc-qrcash-title" style={cardTitle}>Operational Alerts</h2>
          {qrCash.loading ? (
            <p style={unavailable}>Loading…</p>
          ) : qrCash.error ? (
            <p style={unavailable} data-testid="fcc-qrcash-error">{qrCash.error}</p>
          ) : (
            <>
              <div style={statRow}>
                <span>Unresolved QR Cash payouts</span>
                <span style={{ ...statValue, color: severityColor[qrSeverity] }} data-testid="fcc-qrcash-count">
                  {qrCash.data.unresolvedCount}
                </span>
              </div>
              <div style={statRow}>
                <span>Unresolved total</span>
                <span style={statValue} data-testid="fcc-qrcash-total">
                  {money(qrCash.data.unresolvedTotalCents) ?? <span style={unavailable}>unavailable</span>}
                </span>
              </div>
              <div style={statRow}>
                <span>Oldest unresolved</span>
                <span style={statValue} data-testid="fcc-qrcash-age">
                  {ageLabel(qrCash.data.oldestUnresolvedAgeMs) ?? <span style={unavailable}>—</span>}
                </span>
              </div>
              {qrCash.data.flaggedCount > 0 ? (
                <p style={{ ...statRow, color: severityColor.attention, fontWeight: 700 }} data-testid="fcc-qrcash-flagged">
                  {qrCash.data.flaggedCount} flagged for review
                </p>
              ) : null}
            </>
          )}
          {/* TEAM 5 — honest, not a fabricated management action: no founder-authenticated route
              exists anywhere to mark a payout resolved (see this page's header comment and the
              completion report). This links to the same read-only detail surface Team 1's
              existing admin/list endpoint backs, not a resolve action. */}
          <a href="#/dashboard/founder/qr-cash-payouts" style={linkBtn} data-testid="fcc-qrcash-review">
            Review Payouts
          </a>
          {!QR_CASH_MANAGEMENT_SURFACE_EXISTS ? (
            <p style={{ fontSize: ".72rem", color: "#928ea8", margin: 0 }} data-testid="fcc-qrcash-gap-note">
              Read-only detail for now — marking a payout resolved still requires the existing internal tool.
            </p>
          ) : null}
        </section>

        {/* ── CATALOG MANAGEMENT ──────────────────────────────────────────────────────────────── */}
        <section style={card} data-testid="fcc-card-catalog" aria-labelledby="fcc-catalog-title">
          <h2 id="fcc-catalog-title" style={cardTitle}>Catalog Management</h2>
          {catalog.loading ? (
            <p style={unavailable}>Loading…</p>
          ) : catalog.error ? (
            <p style={unavailable} data-testid="fcc-catalog-error">{catalog.error}</p>
          ) : (
            <div style={statRow}>
              <span>Active providers</span>
              <span style={statValue} data-testid="fcc-catalog-active">
                {catalog.activeCount} of {catalog.totalCount}
              </span>
            </div>
          )}
          <a href="#/dashboard/gifts" style={linkBtn} data-testid="fcc-catalog-open">Open Catalog Management</a>
        </section>

        {/* ── SALESPEOPLE ──────────────────────────────────────────────────────────────────────── */}
        <section style={card} data-testid="fcc-card-sales" aria-labelledby="fcc-sales-title">
          <h2 id="fcc-sales-title" style={cardTitle}>Salespeople</h2>
          {sales.loading ? (
            <p style={unavailable}>Loading…</p>
          ) : sales.error ? (
            <p style={unavailable} data-testid="fcc-sales-error">{sales.error}</p>
          ) : (
            <div style={statRow}>
              <span>Active salespeople</span>
              <span style={statValue} data-testid="fcc-sales-active">{sales.activeCount}</span>
            </div>
          )}
          <a href="#/dashboard/founder/salespeople" style={linkBtn} data-testid="fcc-sales-open">
            Open Salesperson Management
          </a>
        </section>

        {/* ── FUNDRAISING ──────────────────────────────────────────────────────────────────────── */}
        <section style={card} data-testid="fcc-card-fundraising" aria-labelledby="fcc-fundraising-title">
          <h2 id="fcc-fundraising-title" style={cardTitle}>Fundraising</h2>
          <PayoutsNote testId="fcc-fundraising-payouts" />
          {fundraising.loading ? (
            <p style={unavailable}>Loading…</p>
          ) : fundraising.error ? (
            <p style={unavailable} data-testid="fcc-fundraising-error">{fundraising.error}</p>
          ) : (
            <>
              <div style={statRow}>
                <span>Organizations</span>
                <span style={statValue} data-testid="fcc-fundraising-orgs">
                  {fundraising.data.organizations ? fundraising.data.organizations.total : <span style={unavailable}>unavailable</span>}
                </span>
              </div>
              <div style={statRow}>
                <span>Campaigns</span>
                <span style={statValue} data-testid="fcc-fundraising-campaigns">
                  {fundraising.data.campaigns ? fundraising.data.campaigns.total : <span style={unavailable}>unavailable</span>}
                </span>
              </div>
            </>
          )}
          <a href="#/dashboard/fundraiser/admin" style={linkBtn} data-testid="fcc-fundraising-open">
            Open Fundraising Management
          </a>
        </section>

        {/* ── W36 · ENTRY POINTS to existing fundraiser surfaces ─────────────────────
            Four separate cards: campaigns, participants, partner portal, activation state. Each
            reads ONLY the founder overview this page already loads (counts + byStatus) and links to
            an EXISTING route. No new endpoint, no mutation, no duplicate subsystem. The route and
            permission trace is in reports/closeout-sprint/lane-reports/T1C.md (W36 trace). */}
        <section style={card} data-testid="fcc-card-campaigns" aria-labelledby="fcc-campaigns-title">
          <h2 id="fcc-campaigns-title" style={cardTitle}>Fundraiser Campaigns</h2>
          {fundraising.loading ? <p style={unavailable}>Loading…</p>
            : fundraising.error ? <p style={unavailable} data-testid="fcc-campaigns-error">{fundraising.error}</p>
            : (
              <>
                <div style={statRow}>
                  <span>Campaigns</span>
                  <span style={statValue} data-testid="fcc-campaigns-total">{overviewCount(fundraising.data.campaigns, "total")}</span>
                </div>
                <p style={{ ...statRow, margin: 0 }} data-testid="fcc-campaigns-bystatus">
                  {statusPairs(fundraising.data.campaigns && fundraising.data.campaigns.byStatus) || <span style={unavailable}>No campaigns yet</span>}
                </p>
              </>
            )}
          <a href="#/dashboard/fundraiser/admin" style={linkBtn} data-testid="fcc-campaigns-open">Open Campaigns</a>
        </section>

        <section style={card} data-testid="fcc-card-participants" aria-labelledby="fcc-participants-title">
          <h2 id="fcc-participants-title" style={cardTitle}>Fundraiser Participants</h2>
          {fundraising.loading ? <p style={unavailable}>Loading…</p>
            : fundraising.error ? <p style={unavailable} data-testid="fcc-participants-error">{fundraising.error}</p>
            : (
              <>
                <div style={statRow}>
                  <span>Participants</span>
                  <span style={statValue} data-testid="fcc-participants-total">{overviewCount(fundraising.data.participants, "total")}</span>
                </div>
                <div style={statRow}>
                  <span>Active</span>
                  <span style={statValue} data-testid="fcc-participants-active">{overviewCount(fundraising.data.participants, "active")}</span>
                </div>
              </>
            )}
          <a href="#/dashboard/fundraiser/admin" style={linkBtn} data-testid="fcc-participants-open">Open Participants</a>
        </section>

        <section style={card} data-testid="fcc-card-partner" aria-labelledby="fcc-partner-title">
          <h2 id="fcc-partner-title" style={cardTitle}>Partner Portal</h2>
          {orgs.loading ? <p style={unavailable}>Loading…</p>
            : orgs.error ? <p style={unavailable} data-testid="fcc-partner-error">{orgs.error}</p>
            : orgs.rows.length === 0 ? <p style={unavailable} data-testid="fcc-partner-empty">No partner organizations yet.</p>
            : (
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: ".85rem", color: "#3a3552" }} data-testid="fcc-partner-list">
                {orgs.rows.slice(0, PARTNER_LINKS_SHOWN).map((o) => (
                  <li key={o.organizationId}>
                    <a href={`#/dashboard/fundraiser/partner/${encodeURIComponent(o.organizationId)}`}
                      data-testid={`fcc-partner-org-${o.organizationId}`}>{o.legalName || o.organizationId}</a>
                  </li>
                ))}
              </ul>
            )}
          {orgs.rows.length > PARTNER_LINKS_SHOWN ? (
            <p style={{ fontSize: ".75rem", color: "#928ea8", margin: 0 }} data-testid="fcc-partner-more">
              and {orgs.rows.length - PARTNER_LINKS_SHOWN} more in Fundraising Management
            </p>
          ) : null}
          <a href="#/dashboard/fundraiser/admin" style={linkBtn} data-testid="fcc-partner-open">Open Organizations</a>
        </section>

        <section style={card} data-testid="fcc-card-activation" aria-labelledby="fcc-activation-title">
          <h2 id="fcc-activation-title" style={cardTitle}>Activation State</h2>
          <PayoutsNote testId="fcc-activation-payouts" />
          {fundraising.loading ? <p style={unavailable}>Loading…</p>
            : fundraising.error ? <p style={unavailable} data-testid="fcc-activation-error">{fundraising.error}</p>
            : (
              <>
                <div style={statRow}>
                  <span>Organizations</span>
                  <span style={statValue} data-testid="fcc-activation-orgs">
                    {statusPairs(fundraising.data.organizations && fundraising.data.organizations.byStatus) || <span style={unavailable}>none</span>}
                  </span>
                </div>
                <div style={statRow}>
                  <span>Campaigns</span>
                  <span style={statValue} data-testid="fcc-activation-campaigns">
                    {statusPairs(fundraising.data.campaigns && fundraising.data.campaigns.byStatus) || <span style={unavailable}>none</span>}
                  </span>
                </div>
                <div style={statRow}>
                  <span>Active economics versions</span>
                  <span style={statValue} data-testid="fcc-activation-economics">
                    {overviewCount(fundraising.data.economics, "activeVersions")}
                  </span>
                </div>
              </>
            )}
          <a href="#/dashboard/fundraiser/admin" style={linkBtn} data-testid="fcc-activation-open">Review Activation</a>
        </section>
      </div>
    </div>
  );
}
