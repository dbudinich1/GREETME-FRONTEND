// src/components/personalization/libraryPhotos.js
//
// LANE 3 — which Media Library photos may be offered as a sender's FEATURED photo.
//
// Reuses the existing Media Library store (utils/mediaLibrary.js) read-only. Photos that came from a
// recipient (their avatar or their memory photos) are never offered here: a recipient's photos stay
// linked to that recipient, and the Media Library keeps them with their association untouched.

import { getMediaLibraryItems } from "../../utils/mediaLibrary.js";

const RECIPIENT_SOURCES = new Set(["recipient", "recipient-avatar", "recipient-memory"]);

export function isRecipientLinkedItem(item) {
  return !!item && RECIPIENT_SOURCES.has(item.source);
}

export function senderLibraryPhotos(items) {
  const list = Array.isArray(items) ? items : [];
  return list
    .filter((it) => it && it.type === "photo" && typeof it.url === "string" && it.url && !isRecipientLinkedItem(it))
    .map((it) => ({ id: it.id || it.url, url: it.url, source: it.source || "library" }));
}

export function readSenderLibraryPhotos() {
  try { return senderLibraryPhotos(getMediaLibraryItems()); } catch { return []; }
}
