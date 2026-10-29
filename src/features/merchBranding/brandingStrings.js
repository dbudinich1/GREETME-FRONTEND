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
  close: 'Close',
});
