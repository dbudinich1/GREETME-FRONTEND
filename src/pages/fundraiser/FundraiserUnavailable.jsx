// src/pages/fundraiser/FundraiserUnavailable.jsx
// TEAM B — truthful "not available" screen shown when the frontend fundraising gate is false.
import React from "react";
import { pageWrap, h } from "./FundraiserUI.jsx";
import { StateView } from "./FundraiserUI.jsx";

export default function FundraiserUnavailable() {
  return <div style={pageWrap}><h1 style={h}>Fundraising</h1><StateView state="dormant" /></div>;
}
