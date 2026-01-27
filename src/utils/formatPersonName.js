/**
 * formatPersonName.js
 * CANONICAL: Name capitalization lock for display
 *
 * Rules:
 * - Trim whitespace
 * - If empty, return ""
 * - Convert to Title Case (first letter uppercase each word)
 * - Preserve internal apostrophes/hyphens
 */

/**
 * Format a person's name to Title Case
 * @param {string} name - The name to format
 * @returns {string} - Title Case formatted name
 */
export function formatPersonName(name) {
  if (!name) return '';

  // Strip leading dashes, underscores, and whitespace
  const trimmed = String(name).trim().replace(/^[-_\s]+/, '');
  if (!trimmed) return '';

  // Title Case: capitalize first letter of each word
  // Preserve hyphens and apostrophes
  return trimmed
    .toLowerCase()
    .split(/(\s+)/) // Split on whitespace, keep delimiters
    .map(part => {
      if (/^\s+$/.test(part)) return part; // Keep whitespace as-is

      // Handle hyphenated names (e.g., "mary-jane" -> "Mary-Jane")
      if (part.includes('-')) {
        return part
          .split('-')
          .map(segment => capitalizeFirst(segment))
          .join('-');
      }

      // Handle apostrophes (e.g., "o'brien" -> "O'Brien")
      if (part.includes("'")) {
        return part
          .split("'")
          .map(segment => capitalizeFirst(segment))
          .join("'");
      }

      return capitalizeFirst(part);
    })
    .join('');
}

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default formatPersonName;
