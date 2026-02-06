# LOCK STATE — Interior Spread Layout (DO NOT CHANGE WITHOUT EXPLICIT AUTHORIZATION)

Status: LOCKED
Date: 2026-02-06

## Scope locked
- Interior spread layout model
- Left page (salutation/occasion/message/signature): NO CHANGES
- Right page (poem + "With Warmest Wishes"): layout model is stable and must not be re-architected

## Single source of truth
- Responsive values MUST come from: `lockTokens.css`
- `greetingCard.css` may consume tokens and define structure only (no new responsive overrides)

## What is considered a violation
- Changing layout model (flex/grid/position strategy) for interior spread pages
- Adding new `!important` rules for interior spread
- Adding new responsive overrides for interior spread in `greetingCard.css` instead of tokens

## Allowed changes (polish-only)
- Token tuning ONLY: font sizes, line-heights, small spacing adjustments
- Must be done one viewport at a time with proof screenshots

## Last known good
- Visual containment: no clipping, drifting, overlap, or smashed text across target viewports
- Right page poem stack visible and contained
- Tablet portrait no longer collapses/thumbnail
