// src/utils/mediaLibrary.js
// Utility functions for Media Library auto-add functionality

const MEDIA_LIBRARY_KEY = 'greetme_media_library';
const MAX_MEDIA_ITEMS = 50; // Prevent unbounded growth

/**
 * Check if URL is safe to store (not a huge base64 data URL)
 * @param {string} url
 * @returns {boolean}
 */
function isSafeToStore(url) {
  if (!url || typeof url !== 'string') return false;
  // Skip base64 data URLs - they're huge and cause quota issues
  // Only store blob URLs and https URLs (which are small string references)
  if (url.startsWith('data:')) return false;
  return url.startsWith('blob:') || url.startsWith('http');
}

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
  // Skip if not a safe URL (base64 data URLs are too large)
  if (!isSafeToStore(photoUrl)) {
    console.log('Skipping media library add - URL not safe to store (base64 or invalid)');
    return false;
  }

  try {
    let items = getMediaLibraryItems();

    // De-dupe: Check if this exact URL already exists
    const exists = items.some(item => item.url === photoUrl);
    if (exists) {
      console.log('Photo already in media library, skipping');
      return false;
    }

    // Create new media item
    const newItem = {
      id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      url: photoUrl,
      type: 'photo',
      source,
      addedAt: new Date().toISOString()
    };

    items.push(newItem);

    // Enforce max items limit - remove oldest if over limit
    if (items.length > MAX_MEDIA_ITEMS) {
      items = items.slice(-MAX_MEDIA_ITEMS);
    }

    localStorage.setItem(MEDIA_LIBRARY_KEY, JSON.stringify(items));
    console.log('Photo added to media library:', source);
    return true;
  } catch (e) {
    // Handle quota exceeded errors gracefully
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn('localStorage quota exceeded, clearing old media items');
      try {
        // Try to recover by keeping only recent items
        const items = getMediaLibraryItems();
        const reduced = items.slice(-10);
        localStorage.setItem(MEDIA_LIBRARY_KEY, JSON.stringify(reduced));
      } catch {
        // If still failing, clear entirely
        localStorage.removeItem(MEDIA_LIBRARY_KEY);
      }
    }
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
  // Handle both legacy string[] format and new {url: string}[] format
  if (contactData.memoryPhotos && Array.isArray(contactData.memoryPhotos)) {
    const urls = contactData.memoryPhotos.map(photo =>
      typeof photo === 'object' ? photo.url : photo
    ).filter(Boolean);
    addMultipleToMediaLibrary(urls, 'recipient-memory');
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
