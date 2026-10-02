// Surface 2 (PROPOSED) W04/W06: cadence label from the existing `recurring` flag on occasionTypes.
// Lives in its own module so helpers.js (not owned by Team 1A) is untouched.
import { occasionTypes } from './helpers';
export const getOccasionCadenceLabel = (occasionType) => {
  const o = occasionTypes.find(x => x.value === occasionType);
  if (!o) return null;
  return o.recurring === false ? 'One-time' : 'Repeats yearly';
};
