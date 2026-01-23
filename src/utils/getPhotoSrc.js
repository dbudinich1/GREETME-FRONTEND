// src/utils/getPhotoSrc.js
// Single source of truth for photo URL normalization
// Handles various photo object shapes from Azure Blob, localStorage, and API responses

/**
 * Normalize photo to URL string (supports various object shapes)
 * @param {string|Object|null} photo - Photo URL string or object with url/sasUrl/src
 * @returns {string} - Normalized URL string or empty string if invalid
 */
export const getPhotoSrc = (photo) => {
  if (!photo) return '';
  if (typeof photo === 'string') return photo;
  if (typeof photo === 'object') {
    // Priority: sasUrl (Azure SAS token) > url > src
    return photo.sasUrl || photo.url || photo.src || '';
  }
  return '';
};

/**
 * Check if a photo source is valid and displayable
 * @param {string} src - Photo URL to validate
 * @returns {boolean} - True if valid displayable URL
 */
export const isValidPhotoSrc = (src) => {
  if (!src || typeof src !== 'string') return false;
  // Accept http/https URLs and data URLs
  return src.startsWith('http://') ||
         src.startsWith('https://') ||
         src.startsWith('data:image/');
};

export default getPhotoSrc;
