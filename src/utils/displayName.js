// src/utils/displayName.js
// Walkthrough revision 2026-10-24 (founder): the displayed first name starts with a capital letter. Only the first
// letter changes; the remaining letters are kept exactly as the user typed them ("mcKenna" -> "McKenna", "DJ" -> "DJ").
export function capitalizeFirst(value) {
  const s = typeof value === 'string' ? value : '';
  if (!s) return '';
  const i = s.search(/\S/);
  if (i < 0) return s;
  return s.slice(0, i) + s.charAt(i).toLocaleUpperCase() + s.slice(i + 1);
}

/** The first word of a display name, first letter capitalised ('' when there is none). */
export function displayFirstName(name) {
  const word = String(name || '').trim().split(/\s+/)[0] || '';
  return capitalizeFirst(word);
}
