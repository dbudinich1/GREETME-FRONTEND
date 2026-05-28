// src/utils/hoverable.js
//
// Hover-state guard for touch devices. Pass cosmetic mouse handlers into
// `getHoverHandlers({ onEnter, onLeave, onDown, onUp })` and spread the
// result onto the target element. On devices that report
// `(hover: hover) and (pointer: fine)` (mice/trackpads), the handlers
// fire normally. On touch-primary devices (iPhone, Android, iPad in
// touch mode), the handlers are stripped — preventing the sticky-hover
// state that occurs when iOS Safari fires `mouseenter` on tap but
// does not reliably fire `mouseleave` when the touch ends.
//
// Use ONLY for cosmetic styling effects (e.currentTarget.style.* mutations).
// Functional handlers (state changes, navigation, analytics) must remain
// on the element directly.

const canHover = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function getHoverHandlers({ onEnter, onLeave, onDown, onUp } = {}) {
  if (!canHover()) return {};
  const h = {};
  if (onEnter) h.onMouseEnter = onEnter;
  if (onLeave) h.onMouseLeave = onLeave;
  if (onDown)  h.onMouseDown  = onDown;
  if (onUp)    h.onMouseUp    = onUp;
  return h;
}
