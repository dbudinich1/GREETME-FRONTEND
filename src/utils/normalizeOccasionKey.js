// src/utils/normalizeOccasionKey.js
// Maps free-form occasion input to canonical keys used by Cover titles and seed generation

/**
 * Normalize free-form occasion input to canonical key
 * @param {string} input - Free-form occasion text (e.g., "bday", "Congrats on the job")
 * @returns {string} Canonical key or empty string if no match
 */
export function normalizeOccasionKey(input) {
  if (!input) return '';

  const normalized = String(input).toLowerCase().trim();
  if (!normalized) return '';

  // Birthday variations
  if (normalized.includes('birthday') || normalized.includes('bday') || normalized.includes('b-day')) {
    return 'birthday';
  }

  // Anniversary
  if (normalized.includes('anniversary') || normalized.includes('anni')) {
    return 'anniversary';
  }

  // Thank you
  if (normalized.includes('thank')) {
    return 'thankyou';
  }

  // Get well
  if (normalized.includes('get well') || normalized.includes('feel better')) {
    return 'getwell';
  }

  // Graduation
  if (normalized.includes('graduation') || normalized.includes('grad')) {
    return 'graduation';
  }

  // Wedding
  if (normalized.includes('wedding') || normalized.includes('marriage')) {
    return 'wedding';
  }

  // Baby
  if (normalized.includes('new baby') || normalized.includes('baby shower') ||
      normalized.includes("it's a boy") || normalized.includes("it's a girl")) {
    return 'baby';
  }

  // Congratulations (new canonical key)
  if (normalized.includes('congrats') || normalized.includes('congratulations')) {
    return 'congrats';
  }

  // Holiday-specific (exact or partial matches)
  if (normalized.includes('christmas') || normalized.includes('xmas')) {
    return 'christmas';
  }
  if (normalized.includes('new year')) {
    return 'newyear';
  }
  if (normalized.includes('thanksgiving')) {
    return 'thanksgiving';
  }
  if (normalized.includes('valentine')) {
    return 'valentine';
  }
  if (normalized.includes('mother') && normalized.includes('day')) {
    return 'mothersday';
  }
  if (normalized.includes('father') && normalized.includes('day')) {
    return 'fathersday';
  }
  if (normalized.includes('holiday')) {
    return 'holiday';
  }

  // Just Because
  if (normalized.includes('just because') || normalized === 'just_because') {
    return 'just_because';
  }

  // No match - return general fallback
  return 'general';
}

export default normalizeOccasionKey;
