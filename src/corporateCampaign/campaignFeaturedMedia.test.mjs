// LANE 3 — a campaign's explicit featured-media choice in its existing storage. No org default.
// Run (Node 20.x): node --test src/corporateCampaign/campaignFeaturedMedia.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectionFromCampaignConfig, campaignSaveSupport, campaignFeaturedSpreadBody, usesRetiredOrganizationDefault,
  savedChoiceLabel, CAMPAIGN_MESSAGE_NOTE,
} from "./campaignFeaturedMedia.js";
import { emptySelection } from "../components/personalization/featuredMediaModel.js";
import { defaultFeaturedSpreadConfig } from "./featuredSpreadModel.js";

const ORG_DEFAULT = defaultFeaturedSpreadConfig(); // animation on + organization_default (the retired default)

test("no inheritance: an organization-default config reads as No featured media", () => {
  assert.equal(ORG_DEFAULT.animationImageSource, "organization_default");
  assert.equal(selectionFromCampaignConfig(ORG_DEFAULT).mode, "none");
  assert.equal(selectionFromCampaignConfig(ORG_DEFAULT).photo, null, "no organization/owner photo is pulled in");
  assert.equal(selectionFromCampaignConfig(null).mode, "none");
  assert.equal(selectionFromCampaignConfig({}).mode, "none");
  assert.equal(usesRetiredOrganizationDefault(ORG_DEFAULT), true);
  assert.equal(savedChoiceLabel(ORG_DEFAULT), "No featured media");
  // campaign_override WITHOUT the campaign's own image is not featured media either.
  assert.equal(selectionFromCampaignConfig({ animatedMessageEnabled: true, animationImageSource: "campaign_override", animationImageRef: null }).mode, "none");
});

test("a campaign's own explicit animated photo is read back as its choice", () => {
  const s = selectionFromCampaignConfig({ animatedMessageEnabled: true, animationImageSource: "campaign_override", animationImageRef: "https://x/c.jpg" });
  assert.equal(s.mode, "animate"); assert.equal(s.photo.url, "https://x/c.jpg");
  assert.equal(s.voice, null, "no campaign voice is stored, so none is invented");
});

test("save support matches what the existing storage can hold", () => {
  assert.equal(campaignSaveSupport({ ...emptySelection(), mode: "none" }).savable, true);
  for (const mode of ["animate", "static", "video"]) {
    const r = campaignSaveSupport({ ...emptySelection(), mode });
    assert.equal(r.savable, false, mode);
    assert.match(r.reason, /can be previewed here but not saved/);
  }
  assert.deepEqual(campaignSaveSupport({ ...emptySelection(), message: "Hi" }).notes, [CAMPAIGN_MESSAGE_NOTE]);
});

test("saving No featured media sends { featuredSpreadConfig } and deletes nothing stored", () => {
  const prev = { ...ORG_DEFAULT, animationImageRef: "https://x/old.jpg", additionalImagesEnabled: true, additionalImageRefs: ["https://x/i1.jpg"] };
  const built = campaignFeaturedSpreadBody(emptySelection(), prev);
  assert.equal(built.ok, true);
  assert.deepEqual(Object.keys(built.body), ["featuredSpreadConfig"], "the shape the server reads");
  const c = built.body.featuredSpreadConfig;
  assert.equal(c.animatedMessageEnabled, false);
  assert.equal(c.corporateVideoEnabled, false); assert.equal(c.corporateVideoRef, null);
  assert.equal(c.animationImageRef, "https://x/old.jpg", "stored ref kept");
  assert.equal(c.animationImageSource, "organization_default", "stored value kept, not migrated");
  assert.deepEqual(c.additionalImageRefs, ["https://x/i1.jpg"]);
  assert.equal(c.additionalImagesEnabled, true);
  // and the input object was not mutated
  assert.equal(prev.animatedMessageEnabled, true);
});

test("save/reload round trip: the saved config reads back as the same explicit choice", () => {
  const { body } = campaignFeaturedSpreadBody(emptySelection(), ORG_DEFAULT);
  assert.equal(selectionFromCampaignConfig(body.featuredSpreadConfig).mode, "none");
  assert.equal(usesRetiredOrganizationDefault(body.featuredSpreadConfig), false);
});

test("an unsavable choice builds no body", () => {
  assert.equal(campaignFeaturedSpreadBody({ ...emptySelection(), mode: "video", video: { url: "blob:v" } }, ORG_DEFAULT).ok, false);
});
