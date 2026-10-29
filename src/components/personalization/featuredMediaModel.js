// src/components/personalization/featuredMediaModel.js
//
// LANE 3 — SHARED PERSONALIZATION CONTROLS. Pure model (no React, no network) behind the one
// featured-media choice a sender makes, in any flow that shows the card's Featured Spread:
//
//   Animate a photo   photo + REQUIRED voice
//   Static photo      photo + OPTIONAL voice playing over the image
//   Personal video    an uploaded greeting video, played as is (no animation)
//   No featured media nothing on the Featured Spread
//
// Each flow keeps its OWN selection in its OWN saved context (an individual send, a campaign).
// There is no default and no inheritance: an empty selection is "No featured media".
//
// It also holds the card presentation rules the choice feeds into the EXISTING card renderer:
//   featured media + memory photos -> greeting first, then the memory photos with music
//   featured media alone           -> the full Featured Spread for that media
//   memory photos alone            -> full-spread memory photos with music
//   neither                        -> the Featured Spread is omitted (Intro and Final remain)

export const MEDIA_MODES = Object.freeze({
  ANIMATE: "animate",
  STATIC: "static",
  VIDEO: "video",
  NONE: "none",
});

const MODE_VALUES = Object.values(MEDIA_MODES);

// Founder copy (2026-10-29, verbatim). The three main choices; "No featured media" stays available as a quieter option
// (quiet: true — the chooser shows it below the three, smaller).
export const FEATURED_SPREAD_TITLE = "Featured Spread";
export const FEATURED_SPREAD_INTRO = "Make it unmistakably yours. Bring your photo to life with your voice, share a favorite image or upload a personal video. Add cherished memories and a heartfelt message to make their Greet-Me even more meaningful.";
export const MEDIA_CHOICES = Object.freeze([
  { value: MEDIA_MODES.ANIMATE, label: "Greet-Me Animation", note: "Bring your photo to life with your voice." },
  { value: MEDIA_MODES.STATIC, label: "Still Photo", note: "Let a meaningful image speak\u2014or add your voice." },
  { value: MEDIA_MODES.VIDEO, label: "Personal Video", note: "Share a greeting recorded your way." },
  { value: MEDIA_MODES.NONE, label: "No featured media", note: "The card keeps its Intro and Final pages.", quiet: true },
]);

// Which controls each choice reveals. Nothing else is shown.
const CONTROLS = Object.freeze({
  [MEDIA_MODES.ANIMATE]: [{ key: "photo", required: true }, { key: "voice", required: true }],
  [MEDIA_MODES.STATIC]: [{ key: "photo", required: true }, { key: "voice", required: false }],
  [MEDIA_MODES.VIDEO]: [{ key: "video", required: true }],
  [MEDIA_MODES.NONE]: [],
});

export const CONTROL_INSTRUCTIONS = Object.freeze({
  [MEDIA_MODES.ANIMATE]: {
    photo: "Choose a clear, front-facing photo.",
    voice: "Record your voice. It is required to animate the photo.",
  },
  [MEDIA_MODES.STATIC]: {
    photo: "Choose the photo to show.",
    voice: "Optional: record a short voice message to play over the photo.",
  },
  [MEDIA_MODES.VIDEO]: {
    video: "Upload your greeting video (MP4, MOV or WebM, up to 100MB).",
  },
});

export const MESSAGE_MAX = 280; // the individual composer's existing personal-message cap

export function normalizeMode(mode) {
  return MODE_VALUES.includes(mode) ? mode : MEDIA_MODES.NONE;
}

export function controlsFor(mode) {
  return (CONTROLS[normalizeMode(mode)] || []).map((c) => ({ ...c }));
}

export function emptySelection() {
  return { mode: MEDIA_MODES.NONE, photo: null, voice: null, video: null, message: "" };
}

// An asset is { url, source, name?, durable? }. `durable` is true only for a reference the server
// already stores (never a blob:/data: URL captured in this browser session).
export function hasAsset(a) {
  return !!a && typeof a === "object" && typeof a.url === "string" && a.url.length > 0;
}

export function isDurableRef(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url) && !/[?&]sig=/i.test(url);
}

export function setMode(selection, mode) {
  // Assets picked for another choice are kept in the unsaved draft, so switching back and forth
  // does not lose them; only the controls for the current choice are shown and used.
  return { ...(selection || emptySelection()), mode: normalizeMode(mode) };
}

export function setAsset(selection, key, asset) {
  if (!["photo", "voice", "video"].includes(key)) return selection;
  return { ...(selection || emptySelection()), [key]: hasAsset(asset) ? { ...asset } : null };
}

export function setMessage(selection, message) {
  return { ...(selection || emptySelection()), message: String(message == null ? "" : message).slice(0, MESSAGE_MAX) };
}

export const VALIDATION_TEXT = Object.freeze({
  photo_required: "Choose a photo.",
  voice_required: "Record your voice to animate the photo.",
  video_required: "Upload your greeting video.",
  message_too_long: `Keep the message to ${MESSAGE_MAX} characters.`,
});

export function validateSelection(selection) {
  const s = selection || emptySelection();
  const errors = [];
  for (const c of controlsFor(s.mode)) {
    if (c.required && !hasAsset(s[c.key])) errors.push(`${c.key}_required`);
  }
  if (typeof s.message === "string" && s.message.length > MESSAGE_MAX) errors.push("message_too_long");
  return { valid: errors.length === 0, errors };
}

// The assets that the CURRENT choice actually uses (an inactive choice's leftovers never leak
// into the card or into a save).
export function activeAssets(selection) {
  const s = selection || emptySelection();
  const out = { photo: null, voice: null, video: null };
  for (const c of controlsFor(s.mode)) out[c.key] = hasAsset(s[c.key]) ? s[c.key] : null;
  return out;
}

export function hasFeaturedMedia(selection) {
  const s = selection || emptySelection();
  if (normalizeMode(s.mode) === MEDIA_MODES.NONE) return false;
  return validateSelection({ ...s, message: "" }).valid;
}

// ── Memory photos: optional, and always the SELECTED recipient's own ─────────────────────────
function photoUrl(p) {
  if (!p) return null;
  if (typeof p === "string") return p;
  if (typeof p === "object") return p.url || p.src || p.photoUrl || null;
  return null;
}

export function memoryPhotosForRecipient(recipient, { excluded = [] } = {}) {
  if (!recipient || !Array.isArray(recipient.memoryPhotos)) return [];
  const skip = new Set(excluded || []);
  const seen = new Set();
  const out = [];
  for (const p of recipient.memoryPhotos) {
    const url = photoUrl(p);
    if (!url || skip.has(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

// ── Presentation rules ──────────────────────────────────────────────────────────────────────
export const PRESENTATION_LAYOUTS = Object.freeze({
  MEDIA_THEN_MEMORIES: "media_then_memories",
  MEDIA_FULL: "media_full",
  MEMORIES_FULL: "memories_full",
});

export function presentationFor({ selection, memoryPhotos = [] } = {}) {
  const media = hasFeaturedMedia(selection);
  const photos = Array.isArray(memoryPhotos) ? memoryPhotos.filter(Boolean) : [];
  const memories = photos.length > 0;
  let layout = null;
  if (media && memories) layout = PRESENTATION_LAYOUTS.MEDIA_THEN_MEMORIES;
  else if (media) layout = PRESENTATION_LAYOUTS.MEDIA_FULL;
  else if (memories) layout = PRESENTATION_LAYOUTS.MEMORIES_FULL;
  return {
    featuredPresent: layout !== null,
    layout,
    music: memories, // the existing album music plays whenever memory photos are shown
    memoryPhotos: memories ? photos : [],
  };
}

// Personal message. With animation it keeps today's behavior (it shapes the spoken greeting; the
// Intro page is unchanged).
// Without animation it is added to the Intro Spread, after the greeting's own words.
export function introMessageFor({ writtenIntroText = "", message = "", mode } = {}) {
  const base = String(writtenIntroText || "").trim();
  const extra = String(message || "").trim();
  if (!extra || normalizeMode(mode) === MEDIA_MODES.ANIMATE) return base;
  return base ? `${base}\n\n${extra}` : extra;
}

export const PREVIEW_SAMPLE_INTRO =
  "Wishing you a wonderful day. This sample text stands in for the greeting written for this recipient when the card is sent.";

// The greeting object the EXISTING GreetingCard renders, built only from the current (unsaved)
// selection and the selected recipient. No network, no ids that could address a real greeting.
export function buildPreviewGreeting({
  selection,
  recipient = null,
  memoryPhotos,
  senderName = "",
  occasionKey = "general",
  writtenIntroText = PREVIEW_SAMPLE_INTRO,
  poemText = "",
  finaleText = "",
} = {}) {
  const s = selection || emptySelection();
  const photos = Array.isArray(memoryPhotos) ? memoryPhotos : memoryPhotosForRecipient(recipient);
  const p = presentationFor({ selection: s, memoryPhotos: photos });
  const a = activeAssets(s);
  const mode = hasFeaturedMedia(s) ? normalizeMode(s.mode) : MEDIA_MODES.NONE;
  return {
    preview: true,
    jobId: null,
    recipientName: (recipient && (recipient.name || recipient.firstName)) || "Friend",
    senderName: senderName || "You",
    occasionKey: occasionKey || "general",
    writtenIntroText: introMessageFor({ writtenIntroText, message: s.message, mode }),
    poemText,
    finaleText,
    videoUrl: null,
    photos: p.memoryPhotos,
    hasGift: false,
    gift: null,
    personalization: {
      featuredPresent: p.featuredPresent,
      layout: p.layout,
      music: p.music,
      memoryPhotos: p.memoryPhotos,
      media: {
        mode,
        photoUrl: a.photo ? a.photo.url : null,
        voiceUrl: a.voice ? a.voice.url : null,
        videoUrl: a.video ? a.video.url : null,
        // The animation itself is created when the card is sent; a preview never requests it.
        animationUrl: null,
      },
    },
  };
}

// Two selections are the same choice (used for dirty checks).
export function selectionKey(selection) {
  const s = selection || emptySelection();
  const a = activeAssets(s);
  return JSON.stringify([normalizeMode(s.mode), a.photo && a.photo.url, a.voice && a.voice.url, a.video && a.video.url, s.message || ""]);
}
