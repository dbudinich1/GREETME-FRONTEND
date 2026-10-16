// src/components/sample/sampleGreeting.js
//
// SAMPLE GREET-ME (landing "View Sample Greet-Me"). Founder-approved visual: Report 71 rev 2. Words: Team 1
// Report 70 rev 2, Option A, verbatim from sample-greeting-package.json. Rules from that package:
//   - fed to the EXISTING GreetingCard player as a fixed object;
//   - NEVER set jobId, courtesyCreditCode, gift, hasGift=true or claimUrl (each reaches live endpoints);
//   - the finale text carries no signature (the card adds the occasion sign-off itself);
//   - the sample QR/credit reveal is sample-only and its QR encodes SAMPLE_QR_PATH, never /claim-credit/.

// The sample entry is shown only when BOTH are true:
//   1. SAMPLE_ENTRY_ENABLED: the card player supports the sample QR/reveal (the player change is a separate
//      founder authorization). Until then the sample cannot reach its finale QR and $5 reveal,
//      so it must not be offered.
//   2. the talking-photo video at SAMPLE_TALKING_PHOTO_URL actually loads (checked in the browser), so the
//      entry can never ship pointing at a missing file.
export const SAMPLE_ENTRY_ENABLED = false;

// ONE address for the talking-photo video (new blob; nothing is overwritten).
export const SAMPLE_TALKING_PHOTO_URL = 'https://greetmedanny.blob.core.windows.net/public/greetme-sample-talking-photo-v1.mp4';

// The sample QR's target on this site (Report 71 rev 2 §3, agreed with Team 2).
export const SAMPLE_QR_PATH = '/#/?sample=credit';

export const SAMPLE_GREETING = {
  recipientName: 'Theresa',
  senderName: 'Claire',
  occasionKey: 'just_because',
  relationshipKey: 'friend',
  writtenIntroText: "Just because — you've been on my mind.\n\nYour friendship means the world to me. I'm so grateful for all the laughter and support you bring to my life. Here's to many more adventures together!",
  poemText: "Some forget occasions, some forget names.\nSome mean to stop by while time passes in shame.\nSo here's to the ones that time forgot —\nthe love you intended — forget them not!",
  finaleText: "No occasion needed — just you, and all the moments we've shared. I'm so glad you're in my life.\n\nForget them not.",
  photos: [
    '/assets/onboarding/memory-1-beach-toast.jpeg',
    '/assets/onboarding/memory-2-european-walk.jpeg',
    '/assets/onboarding/memory-3-mountain-family.jpeg',
    '/assets/onboarding/memory-4-festival-night.jpeg',
    '/assets/onboarding/memory-5-thinking-of-you.jpeg',
  ],
  videoUrl: SAMPLE_TALKING_PHOTO_URL,
  videoStatus: null,
  photoUrl: null, // the saved face file is a watermarked capture; it is never shown
  hasGift: false,
};

export const SAMPLE_CHROME = {
  ctaLabel: 'View Sample Greet-Me',
  ctaSubline: 'Open a real Greet-Me, start to finish.',
  viewerLabel: 'Sample Greet-Me',
  creditReveal: {
    // Mirrors the real signed-out recipient screen, CreditClaim.jsx (anonymous view).
    eyebrow: 'A gift from Greet-Me',
    headline: 'A $5 Greet-Me Credit is waiting',
    body: 'Sign in or create your free account to claim it.',
    buttonLabel: 'Claim Your $5 Credit',
    inertNote: 'In a real Greet-Me, this is where the recipient claims their $5 credit.',
    sampleRibbon: "Sample — for demonstration only. This credit can't be claimed.",
    actions: ['Back to the card', 'Close'],
  },
};
