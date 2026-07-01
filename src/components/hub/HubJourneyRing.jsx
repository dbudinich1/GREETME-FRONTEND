// src/components/hub/HubJourneyRing.jsx
// UX-HUB-3 Batch 4/5 — premium circular Journey progress ring. Presentational + STATELESS:
// driven ONLY by the four real Journey facts via props (reachedCount out of total=4). Renders
// the arc filled to reachedCount/total with a centered "N / 4" label — NEVER a percentage,
// mission model, or fabricated reward. Batch 5 polish: larger diameter (~200px desktop),
// thicker stroke, gradient stroke, tabular-nums label, smoother easing. The fill animates via
// a CSS keyframe in hub.css (from empty to the target offset using CSS custom properties), and
// snaps under prefers-reduced-motion. Accessible as a progressbar. LOGIC UNCHANGED.

export default function HubJourneyRing({ reachedCount = 0, total = 4, size = 200 }) {
  const max = Math.max(1, Number(total) || 4);
  const n = Math.max(0, Math.min(max, Number(reachedCount) || 0));
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - n / max);
  const center = size / 2;

  return (
    <div
      className="hub-ring"
      role="progressbar"
      aria-valuenow={n}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${n} of ${max} journey steps reached`}
    >
      <svg className="hub-ring__svg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="hub-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="55%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#be185d" />
          </linearGradient>
        </defs>
        <circle
          className="hub-ring__track"
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          className="hub-ring__progress"
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="url(#hub-ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ '--hub-ring-c': c, '--hub-ring-offset': offset, strokeDasharray: c }}
        />
        <text
          className="hub-ring__label"
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {n} / {max}
        </text>
      </svg>
    </div>
  );
}
