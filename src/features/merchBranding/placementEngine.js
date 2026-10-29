// src/features/merchBranding/placementEngine.js
// REPORT 153 — frontend MIRROR of merch-be services/merchBranding/placementEngine.js.
//
// The server's computed position is authoritative: it is what the mockup, the approval and the order
// carry. This mirror exists only so the local placement proposal can be drawn (and tested) without a
// round trip; both repos test their engine against the SAME golden file (placementGolden.json), so the
// two cannot silently drift.

export function computePlacement(spec, logo) {
  const W = spec?.area?.widthPx, H = spec?.area?.heightPx, dpi = spec?.area?.dpi;
  if (!(W > 0 && H > 0 && dpi > 0) || !spec.box) return { ok: false, position: null, problemCodes: ['SPEC_MISSING'] };
  const lw = Number(logo?.widthPx), lh = Number(logo?.heightPx);
  if (!(lw > 0 && lh > 0)) return { ok: false, position: null, problemCodes: ['LOGO_SIZE_UNKNOWN'] };
  const boxLeft = Math.round(spec.box.left * W);
  const boxTop = Math.round(spec.box.top * H);
  const boxW = Math.floor(spec.box.width * W);
  const boxH = Math.floor(spec.box.height * H);
  let width, height;
  if (boxW / lw <= boxH / lh) {
    width = boxW;
    height = Math.max(1, Math.min(boxH, Math.round((lh * boxW) / lw)));
  } else {
    height = boxH;
    width = Math.max(1, Math.min(boxW, Math.round((lw * boxH) / lh)));
  }
  const left = boxLeft + Math.floor((boxW - width) / 2);
  const top = boxTop + Math.floor((boxH - height) / 2);
  const position = { area_width: W, area_height: H, width, height, top, left, limit_to_print_area: true };
  const required = Number(spec.requiredDpi) || dpi;
  const effectiveDpi = logo.vector ? null : Math.floor((lw * dpi) / width);
  const minLogoPx = logo.vector ? null : { width: Math.ceil((width * required) / dpi), height: Math.ceil((height * required) / dpi) };
  const problemCodes = effectiveDpi != null && effectiveDpi < required ? ['RESOLUTION_TOO_LOW'] : [];
  return {
    ok: problemCodes.length === 0,
    position,
    printedInches: { width: Math.round((width / dpi) * 100) / 100, height: Math.round((height / dpi) * 100) / 100 },
    effectiveDpi,
    minLogoPx,
    problemCodes,
  };
}
