// src/utils/senderPhoto.js
// W03: a REAL profile photo URL (https://...) is required before a send. Not a data URL or a placeholder domain. One rule
// for the send page's check (SendGreeting.jsx validate / senderPhotoMissing) and Home's photo status (founder 2026-10-28:
// Home must not say "Your photo is ready" for a photo the send page will refuse).
const PLACEHOLDER_HOSTS = ['placeholder.com', 'placehold.co', 'placekitten.com', 'dummyimage.com'];

/** true when this profile photo URL can be sent with a Greet-Me */
export function senderPhotoUsable(photoUrl) {
  const url = typeof photoUrl === 'string' ? photoUrl : '';
  if (!url || url.startsWith('data:')) return false;
  return !PLACEHOLDER_HOSTS.some((h) => url.includes(h));
}
