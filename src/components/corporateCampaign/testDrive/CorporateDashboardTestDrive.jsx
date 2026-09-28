// src/components/corporateCampaign/testDrive/CorporateDashboardTestDrive.jsx
//
// TEAM UX — Corporate Dashboard Test Drive. Renders the REAL, unmodified
// <GreetingAutomationCampaigns /> with a fake client/cardClient/stripeOverride injected through its
// EXISTING test-only seam (see the comment at the top of GreetingAutomationCampaigns.jsx: "client is
// an optional injection seam used ONLY by tests... App usage renders <GreetingAutomationCampaigns />
// with no props -> identical behavior"). GreetingAutomationCampaigns.jsx itself is NOT edited by this
// feature — production behavior at /dashboard/campaigns (no props) is untouched.
//
// Practice contacts come from the SAME session-scoped workspace the Import Wizard already owns
// (corporateTestDriveWorkspace.js -> sampleWorkspace.js). Nothing here ever calls fetch, ever reaches
// a real backend, or ever survives Exit / logout / session expiry.

import { useCallback, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import GreetingAutomationCampaigns from "../GreetingAutomationCampaigns.jsx";
import PracticeContactPanel from "./PracticeContactPanel.jsx";
import { createCorporateTestDriveClient, createCorporateTestDrivePaymentsClient, testDriveStripeOverride, makeDemoCampaign } from "./corporateTestDriveClient.js";
import { computeWarnings } from "./practiceReadiness.js";
import {
  readCorporatePracticeWorkspace, editPracticeContact, addPracticeContact, clearSampleWorkspace,
} from "./corporateTestDriveWorkspace.js";
import { RECIPIENT_TYPE_OPTIONS } from "../../../import/recipientTypeModel.js";

const AMBER = "#8a5410";
const btn = (bg, fg = "#fff") => ({ background: bg, color: fg, border: bg === "transparent" ? "1px solid rgba(214,145,16,.5)" : "none", borderRadius: 11, padding: "10px 18px", fontWeight: 700, fontSize: ".85rem", cursor: "pointer" });

function categoryLabelFor(kind) {
  return (RECIPIENT_TYPE_OPTIONS.find((o) => o.value === kind) || {}).label || "contact";
}

export default function CorporateDashboardTestDrive() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(() => readCorporatePracticeWorkspace());

  const exit = useCallback(() => { clearSampleWorkspace(); navigate("/dashboard/campaigns"); }, [navigate]);
  const returnToWizard = useCallback(() => { navigate("/dashboard/import-wizard"); }, [navigate]);

  // Session end -> leave Test Drive immediately, same pattern as RecipientsPracticeView.jsx.
  useEffect(() => {
    const onExpire = () => exit();
    if (typeof window !== "undefined") window.addEventListener("auth:session-expired", onExpire);
    return () => { if (typeof window !== "undefined") window.removeEventListener("auth:session-expired", onExpire); };
  }, [exit]);

  // A new client instance (with a fresh, closed-over `getContacts`) each time the practice contact
  // list changes. GreetingAutomationCampaigns re-fetches whenever the `client` prop's identity
  // changes (its own loadContacts effect is keyed on [client]), so this is what makes an add/edit in
  // PracticeContactPanel show up in the real dashboard without any extra plumbing.
  const demoCampaign = useMemo(() => makeDemoCampaign(), []);
  const client = useMemo(
    () => createCorporateTestDriveClient({ getContacts: () => workspace.contacts, initialCampaign: demoCampaign }),
    [workspace.contacts, demoCampaign],
  );
  const cardClient = useMemo(() => createCorporateTestDrivePaymentsClient(), []);
  const stripeOverride = useMemo(() => testDriveStripeOverride(), []);
  const dashboardNavigate = useCallback((path) => { try { window.location.hash = `#${path}`; } catch { /* non-browser host */ } }, []);

  const categoryLabel = categoryLabelFor(workspace.kind);
  const warnings = useMemo(() => computeWarnings(workspace.contacts, demoCampaign), [workspace.contacts, demoCampaign]);

  if (workspace.status !== "active") {
    return (
      <div style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
        <div style={{ background: "#fff4e0", border: "2px solid rgba(214,145,16,.5)", borderRadius: 16, padding: 22 }} data-testid="practice-dashboard-empty">
          <b style={{ fontFamily: "Georgia,serif", fontSize: "1.2rem", color: "#5a3a08" }}>No Test Drive practice contacts</b>
          <p style={{ color: "#6b4a12", marginTop: 8 }}>Start a Test Drive in the Import Wizard to preview contacts here.</p>
          <button type="button" style={btn("#6b3a2a")} onClick={returnToWizard}>Return to Import Wizard</button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="corporate-test-drive-root">
      <section role="region" aria-label="Test Drive practice contacts notice" data-testid="practice-banner"
        style={{ position: "sticky", top: 0, zIndex: 20, background: "linear-gradient(135deg,#fff4e0,#fde9d4)", border: "2px solid rgba(214,145,16,.5)", borderRadius: 16, padding: "16px 22px", margin: "16px", boxShadow: "0 10px 26px -16px rgba(160,110,20,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-block", background: "rgba(214,145,16,.14)", color: AMBER, border: "1px solid rgba(214,145,16,.4)", borderRadius: 9999, padding: "2px 10px", fontSize: ".6875rem", fontWeight: 700 }}>Test Drive</span>
          <h2 style={{ margin: 0, fontFamily: "Georgia,serif", fontSize: "1.2rem", color: "#5a3a08" }}>Test Drive — Practice Contacts</h2>
        </div>
        <p style={{ margin: "8px 0 0", color: "#6b4a12", fontSize: ".9rem", lineHeight: 1.5 }} data-testid="practice-primary-copy">
          These are fictional {categoryLabel.toLowerCase()} contacts. They exist only in this Test Drive, have not been added to your organization, and cannot trigger a real campaign, gift, schedule, notification, or charge.
        </p>
        <p style={{ margin: "6px 0 0", color: "#7a5a22", fontSize: ".84rem" }} data-testid="practice-cleanup-copy">
          They will be automatically removed when you exit Test Drive, log out, or your session ends.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" data-testid="practice-exit" style={btn("#6b3a2a")} onClick={exit}>Exit Test Drive</button>
          <button type="button" data-testid="practice-return-wizard" style={btn("transparent", "#6b4a12")} onClick={returnToWizard}>Return to Import Wizard</button>
        </div>
      </section>

      <div style={{ margin: "0 16px" }}>
        <PracticeContactPanel
          contacts={workspace.contacts}
          warnings={warnings}
          categoryLabel={categoryLabel}
          onAdd={(vals) => setWorkspace(addPracticeContact(vals))}
          onEdit={(id, vals) => setWorkspace((w) => ({ ...w, contacts: editPracticeContact(id, vals) }))}
        />
      </div>

      <GreetingAutomationCampaigns client={client} cardClient={cardClient} stripeOverride={stripeOverride} navigate={dashboardNavigate} />
    </div>
  );
}
