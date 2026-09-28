// src/components/corporateCampaign/testDrive/corporateTestDriveClient.js
//
// TEAM UX — Corporate Dashboard Test Drive. A fake, in-memory client mirroring the SHAPE of
// createCorporateCampaignsClient() (src/api/corporateCampaigns.js) and createCorporatePaymentsClient()
// (src/api/corporatePayments.js), used ONLY to inject into the real, unmodified
// <GreetingAutomationCampaigns client={...} cardClient={...} stripeOverride={...} /> for Test Drive.
//
// EVERY method here is a plain async function returning a fixed or closure-held in-memory value.
// None of them ever calls fetch, XMLHttpRequest, or any network API — there is no way for a Test
// Drive session to reach a real backend, a real Stripe endpoint, or a real campaign/contact record
// through this client. Nothing it returns is persisted anywhere beyond this closure's lifetime
// (i.e., it dies with the component that created it — a page reload or navigating away loses it,
// exactly like every other piece of Test Drive state).

const ORG_ID = "test-drive-org";

// One fictional, read-only-in-spirit campaign so the Campaigns panel and the pop-out modal have
// something real to render, and so a practice contact's missing delivery address has a concrete
// campaign to be "required by" (curated gift = physical, ties into corporateAddressStatus.js).
// Exported so the Test Drive wrapper can compute the SAME campaign's readiness warnings without
// reaching into the client's private closure state.
export function makeDemoCampaign() {
  return {
    campaignId: "test-drive-campaign",
    name: "Sample Campaign (Test Drive)",
    approvalStatus: "draft",
    lockStatus: "unlocked",
    enabled: true,
    audienceRefs: [],
    deliveryConfig: {
      scheduleMode: "campaign_date",
      status: "not_configured",
      occasionType: "holiday",
      defaultGift: { type: "curated", maxSpendCents: 3000 },
    },
  };
}

/**
 * Builds a fake corporate-campaigns client. `getContacts` is a function (not a static array) so the
 * client always reflects the Test Drive wrapper's current practice-contact list, including
 * additions/edits made without ever leaving this session.
 */
export function createCorporateTestDriveClient({ getContacts, initialCampaign }) {
  let campaign = initialCampaign || makeDemoCampaign();

  return {
    orgId: ORG_ID,
    listMemberships: async () => ({
      ok: true,
      data: { memberships: [{ corporateOrganizationId: ORG_ID, status: "active", organizationName: "Test Drive" }] },
    }),
    listCampaigns: async () => ({
      ok: true,
      data: {
        campaigns: [campaign],
        orderVersion: null,
        viewerAuthorization: { isCurrentOrganizationOwner: true },
        executionAvailability: { canAuthorizeRun: false },
      },
    }),
    listOrgContacts: async () => ({ ok: true, data: { contacts: getContacts() } }),
    readReadiness: async () => ({ ok: true, data: {} }),
    readCampaign: async () => ({ ok: true, data: campaign }),
    listGiftCatalog: async () => ({ ok: true, data: { items: [] } }),
    // Every write below only updates THIS closure's in-memory `campaign` — never a backend, never
    // anything that survives the component unmounting. Test Drive never authorizes a real run
    // (`executionAvailability.canAuthorizeRun: false` above), so schedule/activate can never fire a
    // genuine send even if clicked.
    createCampaign: async () => ({ ok: true, data: campaign }),
    updateFeaturedSpread: async () => ({ ok: true, data: {} }),
    approve: async () => { campaign = { ...campaign, approvalStatus: "approved" }; return { ok: true, data: campaign }; },
    lock: async () => { campaign = { ...campaign, lockStatus: "locked" }; return { ok: true, data: campaign }; },
    unlock: async () => { campaign = { ...campaign, lockStatus: "unlocked" }; return { ok: true, data: campaign }; },
    updateDeliveryConfig: async (_orgId, _campaignId, body) => {
      campaign = { ...campaign, deliveryConfig: { ...campaign.deliveryConfig, ...(body || {}) } };
      return { ok: true, data: campaign };
    },
    schedule: async () => ({ ok: false, dormant: true, status: 503, reason: "test_drive_no_real_send" }),
    activate: async () => ({ ok: false, dormant: true, status: 503, reason: "test_drive_no_real_send" }),
    renameCampaign: async (_orgId, _campaignId, name) => { campaign = { ...campaign, name }; return { ok: true, data: campaign }; },
    removeCampaign: async () => ({ ok: true, data: { mode: "archived" } }),
    setCampaignEnabled: async (_orgId, _campaignId, enabled) => { campaign = { ...campaign, enabled: enabled === true }; return { ok: true, data: campaign }; },
    setAudience: async (_orgId, _campaignId, audienceRefs) => {
      campaign = { ...campaign, audienceRefs: Array.isArray(audienceRefs) ? audienceRefs : [] };
      return { ok: true, data: campaign };
    },
    reorderCampaigns: async () => ({ ok: true, data: { campaigns: [campaign], orderVersion: null } }),
  };
}

/** Fake corporate-payments client — getPaymentMethod always reports "no card on file" (honest: no real
 * payment method is ever attached to a Test Drive session), and every mutating method refuses outright
 * rather than pretending to begin a real Stripe authorization. */
export function createCorporateTestDrivePaymentsClient() {
  return {
    getPaymentMethod: async () => ({ ok: true, status: 200, data: {}, paymentMethod: { ready: false } }),
    createSetupIntent: async () => ({ ok: false, status: 503, unavailable: true, error: "test_drive_payments_disabled" }),
    replacePaymentMethod: async () => ({ ok: false, status: 503, unavailable: true, error: "test_drive_payments_disabled" }),
    completeSetupIntent: async () => ({ ok: false, status: 503, unavailable: true, error: "test_drive_payments_disabled" }),
  };
}

// A Stripe.js promise that resolves to `null` — an officially supported "Stripe not loaded" shape
// for @stripe/react-stripe-js's <Elements>. This means SavedCardPanel can mount without ever
// resolving a real Stripe instance, so no card entry can reach Stripe's network at all.
export function testDriveStripeOverride() {
  return Promise.resolve(null);
}

export { ORG_ID as TEST_DRIVE_ORG_ID };
