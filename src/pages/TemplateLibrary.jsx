// src/pages/TemplateLibrary.jsx
//
// TEAM UX POLISH — browse every currently-supported Import Wizard category's template and practice
// sample in one place. Renders as a plain nested route under /dashboard (DashboardLayout supplies the
// header/nav/footer via <Outlet/> already — this page adds none of its own). Read-only: every action
// on this page is a local file download via TemplateLibraryCard; nothing here writes a contact,
// starts a campaign, or calls the backend.

import { Link } from "react-router-dom";
import { TEMPLATE_KINDS, isBusinessTemplateKind } from "../import/templateModel.js";
import TemplateLibraryCard from "../components/importWizard/TemplateLibraryCard.jsx";

const card = { background: "#fff", border: "1px solid rgba(27,24,48,.1)", borderRadius: 14, padding: 18 };

export default function TemplateLibrary() {
  const personalKinds = TEMPLATE_KINDS.filter((k) => !isBusinessTemplateKind(k));
  const businessKinds = TEMPLATE_KINDS.filter((k) => isBusinessTemplateKind(k));

  return (
    <div data-testid="template-library-page" style={{ maxWidth: 980, margin: "0 auto", padding: "8px 4px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontFamily: "Georgia,serif", fontSize: "1.4rem", margin: 0 }}>Template Library</h1>
        <Link to="/dashboard/import-wizard" data-testid="template-library-back-link" style={{ fontSize: ".82rem", color: "#4a3fb0", fontWeight: 700, textDecoration: "none" }}>
          ← Back to Import Wizard
        </Link>
      </div>
      <p style={{ color: "#5b5570", fontSize: ".9rem", margin: "0 0 24px" }}>
        Grab a blank template or a fictional practice sample for any contact category — the same files
        available inside the Import Wizard, gathered in one place. Downloading a file never saves,
        sends, or imports anything.
      </p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", margin: "0 0 12px" }}>Personal</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {personalKinds.map((kind) => (
            <TemplateLibraryCard key={kind} kind={kind} />
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", margin: "0 0 12px" }}>Business</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {businessKinds.map((kind) => (
            <TemplateLibraryCard key={kind} kind={kind} />
          ))}
        </div>
      </section>

      <div style={{ ...card, marginTop: 28, textAlign: "center" }}>
        <Link to="/dashboard/import-wizard" data-testid="template-library-bottom-back-link" style={{ fontSize: ".85rem", color: "#4a3fb0", fontWeight: 700, textDecoration: "none" }}>
          ← Back to Import Wizard
        </Link>
      </div>
    </div>
  );
}
