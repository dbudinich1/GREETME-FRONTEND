// src/features/merchBranding/brandingStrings.js
// REPORT 153 — every new customer-visible string, in one place for founder review.
// None renders while the feature switch is off. Q2 (rights wording) is the server's proposed text and
// is shown exactly as the server returns it.

export const BRANDING_STRINGS = Object.freeze({
  // Logo step
  stepTitle: 'Brand with your company logo',
  stepIntro: 'Upload your logo once. We’ll show it on every product that can carry it.',
  chooseFile: 'Choose a PNG or JPG file',
  fileHint: 'Up to 10 MB. A large, high-resolution file prints best.',
  applyLogo: 'Apply logo',
  uploading: 'Uploading…',
  cancel: 'Cancel',
  uploadFailed: 'We couldn’t upload your logo just now. Please try again.',
  // "Remember my logo" (approved: opt-in, with a delete control)
  rememberLogo: 'Remember my logo for next time',
  savedLogoTitle: 'Your saved logo',
  useSavedLogo: 'Use my saved logo',
  deleteSavedLogo: 'Delete my saved logo',
  orUploadNew: 'Or upload a different logo',
  // APPROVED (founder 153J C7, 2026-10-30) — temporary failures only; never shown when an order needs the logo.
  deleteSavedFailed: 'We couldn’t delete your saved logo. Please try again.',
  // 153J C7 — when an order prevents deletion. PROPOSED copy (awaiting founder approval).
  deleteSavedNeededForOrder: 'We can’t delete this logo because it’s needed for one of your orders.',

  // Nothing designated yet (153E) — PROPOSED copy
  noneEligibleTitle: 'Logo branding isn’t open yet',
  noneEligibleIntro: 'No products are open for your company logo yet. Our business team can help with a branded order in the meantime.',
  contactBusinessTeam: 'Contact our business team',

  // Signed out (153C)
  signInTitle: 'Sign in to brand with your logo',
  signInIntro: 'Your logo is kept in your Greet-Me account, so only you can see it, replace it or clear it.',
  signInExpired: 'Your sign-in has expired. Sign in again to brand products with your logo.',
  signInButton: 'Sign in',

  // Controls on the Brandable Goods row
  logoApplied: 'Your logo is applied',
  replaceLogo: 'Replace logo',
  clearBranding: 'Clear branding',

  // Card states
  cardYourLogo: 'Your logo',
  cardPreparing: 'Preparing branded preview',
  cardUnavailable: 'Preview unavailable — Try again',
  cardNeedsLarger: 'Needs a larger logo file',
  cardUnsupported: 'Not available with your logo',
  seePlacement: 'See placement',

  // Placement / approval
  placementTitle: (name) => `${name} — logo placement`,
  productPreview: 'Product preview',
  placementProposal: 'Placement proposal',
  proposalCaption: 'The print area and your logo’s exact size and position. This drawing is not a photo of the product.',
  previewPreparing: 'Your branded preview is being prepared.',
  previewUnavailable: 'The branded preview couldn’t be prepared.',
  tryAgain: 'Try again',
  printedSize: (w, h) => `Printed size: ${w} × ${h} in`,
  approveTitle: 'Approve your artwork',
  approveIntro: 'Check your logo’s size and position. This is exactly how it will be printed.',
  approveButton: 'Approve artwork and add to cart',
  backToProducts: 'Back to products',
  notOpenYet: 'Branded ordering for this product isn’t open yet. You can still see how your logo will look.',
  waitForPreview: 'Your branded preview must be ready before you can approve it.',
  approveFailed: 'We couldn’t approve your artwork just now. Please try again.',
  cartWithLogo: 'with your logo',
  close: 'Close',
});
