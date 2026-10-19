// src/utils/dashboardOccasions.js
//
// The dashboard's occasion choices, taken from the Recipients page's EXISTING occasion list (utils/helpers.js
// occasionTypes) and laid out the way the Recipients form groups them (ContactForm: Personal Occasions, Secular
// Holidays; FaithBasedOccasionSelector: Christianity, Judaism, Islam). Identifiers, dates and scheduling are the
// scheduler's own; nothing here defines a new occasion. Added beside them, unchanged: the send page's own occasions
// (Thank You, Congratulations, Just Because) and Season's Greetings, the generic "Happy Holidays" greeting
// (backend key 'holiday'; it never becomes Christmas or any specific holiday). Those four are Send Now only: the
// Occasion Scheduler has no such occasions.
import { occasionTypes } from './helpers.js';

const byCategory = (cat) => occasionTypes.filter((o) => o.category === cat);

// The Recipients form lists Personal Occasions without Get Well (ContactForm: personal.filter(o => o.value !== 'getwell')).
export const RECIPIENT_OCCASIONS = Object.freeze(occasionTypes.filter((o) => o.value !== 'getwell'));

export const SEASONS_GREETINGS = "Season's Greetings";
export const SEND_ONLY_OCCASIONS = Object.freeze(['Thank You', 'Congratulations', 'Just Because']);

/** Chips shown directly: the Recipients form's Personal Occasions, then the send page's own occasions. */
export const OCCASION_CHIPS = Object.freeze([
  ...byCategory('personal').filter((o) => o.value !== 'getwell').map((o) => o.label),
  ...SEND_ONLY_OCCASIONS,
]);

/** Menus, grouped exactly as the Recipients form groups its holidays. */
export const OCCASION_MENUS = Object.freeze([
  { key: 'holidays', label: 'Holidays', groups: [
    { title: 'Secular holidays', items: byCategory('secular').map((o) => o.label) },
    { title: 'Any holiday', items: [SEASONS_GREETINGS] },
  ] },
  { key: 'faith', label: 'Faith holidays', groups: [
    { title: 'Christianity', items: byCategory('christian').map((o) => o.label) },
    { title: 'Judaism', items: byCategory('jewish').map((o) => o.label) },
    { title: 'Islam', items: byCategory('muslim').map((o) => o.label) },
  ] },
]);

/** The scheduler identifier for a Recipients-list label ('' for Send Now-only occasions). */
export const recipientOccasionValue = (label) => (RECIPIENT_OCCASIONS.find((o) => o.label === label) || {}).value || '';
