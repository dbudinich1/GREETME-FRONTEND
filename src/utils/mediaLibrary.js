// src/utils/mediaLibrary.js
// Utility functions for Media Library auto-add functionality

const MEDIA_LIBRARY_KEY = 'greetme_media_library';

/**
 * Get all items from the media library
 * @returns {Array<{id: string, url: string, type: string, source: string, addedAt: string}>}
 */
export function getMediaLibraryItems() {
  try {
    const stored = localStorage.getItem(MEDIA_LIBRARY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error reading media library:', e);
    return [];
  }
}

/**
 * Add a photo to the media library (with de-duplication)
 * @param {string} photoUrl - The photo URL (can be base64 data URL or blob URL)
 * @param {string} source - Where the photo came from ('recipient-avatar' | 'recipient-memory' | 'user-default')
 * @returns {boolean} - True if added, false if already exists
 */
export function addToMediaLibrary(photoUrl, source = 'recipient') {
  if (!photoUrl || typeof photoUrl !== 'string') return false;

  try {
    const items = getMediaLibraryItems();

    // De-dupe: Check if this exact URL already exists
    const exists = items.some(item => item.url === photoUrl);
    if (exists) {
      console.log('Photo already in media library, skipping');
      return false;
    }

    // Create new media item
    const newItem = {
      id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: photoUrl,
      type: 'photo',
      source,
      addedAt: new Date().toISOString()
    };

    items.push(newItem);
    localStorage.setItem(MEDIA_LIBRARY_KEY, JSON.stringify(items));
    console.log('Photo added to media library:', source);
    return true;
  } catch (e) {
    console.error('Error adding to media library:', e);
    return false;
  }
}

/**
 * Add multiple photos to the media library
 * @param {string[]} photoUrls - Array of photo URLs
 * @param {string} source - Where the photos came from
 * @returns {number} - Number of photos actually added (excludes duplicates)
 */
export function addMultipleToMediaLibrary(photoUrls, source = 'recipient') {
  if (!Array.isArray(photoUrls)) return 0;

  let addedCount = 0;
  for (const url of photoUrls) {
    if (addToMediaLibrary(url, source)) {
      addedCount++;
    }
  }
  return addedCount;
}

/**
 * Auto-add recipient photos to media library
 * Call this when a recipient is saved (created or updated)
 * @param {Object} contactData - The contact data with avatar and memoryPhotos
 */
export function autoAddRecipientPhotosToLibrary(contactData) {
  if (!contactData) return;

  // Add avatar if present
  if (contactData.avatar) {
    addToMediaLibrary(contactData.avatar, 'recipient-avatar');
  }

  // Add memory photos if present
  if (contactData.memoryPhotos && Array.isArray(contactData.memoryPhotos)) {
    addMultipleToMediaLibrary(contactData.memoryPhotos, 'recipient-memory');
  }
}

/**
 * Remove a photo from the media library
 * @param {string} id - The media item ID
 * @returns {boolean} - True if removed
 */
export function removeFromMediaLibrary(id) {
  try {
    const items = getMediaLibraryItems();
    const filtered = items.filter(item => item.id !== id);

    if (filtered.length < items.length) {
      localStorage.setItem(MEDIA_LIBRARY_KEY, JSON.stringify(filtered));
      return true;
    }
    return false;
  } catch (e) {
    console.error('Error removing from media library:', e);
    return false;
  }
}

/**
 * Clear all items from the media library
 */
export function clearMediaLibrary() {
  localStorage.removeItem(MEDIA_LIBRARY_KEY);
}
