// src/components/hub/HubJourneyRoadmap.jsx
// UX-HUB-3 Batch 5 — linear Journey roadmap (premium horizontal milestone tracker) shown
// directly beneath the circular ring. Presentational + STATELESS: renders exactly the real
// JOURNEY_STEPS (the same 4 facts the Hub already uses), each marked complete/incomplete from
// the real `journey` booleans only. NO invented steps, NO fabricated completion, NO rewards,
// NO percentages. If a step is not complete it shows as incomplete; at zero progress every
// step is shown honestly as not-yet. Styling/responsive (horizontal → vertical on mobile)
// lives in hub.css.

import { Check } from 'lucide-react';
import { JOURNEY_STEPS } from './hubConfig';

export default function HubJourneyRoadmap({ journey }) {
  return (
    <div className="hub-roadmap" role="list" aria-label="Your Journey roadmap">
      {JOURNEY_STEPS.map((step, i) => {
        const done = Boolean(journey && journey[step.key]);
        const prevDone = i > 0 && Boolean(journey && journey[JOURNEY_STEPS[i - 1].key]);
        return (
          <div
            key={step.key}
            role="listitem"
            aria-label={`Step ${i + 1}: ${step.label} — ${done ? 'completed' : 'not yet'}`}
            className={`hub-roadmap__step${prevDone ? ' line-done' : ''}`}
          >
            <span className={`hub-roadmap__node${done ? ' is-done' : ''}`} aria-hidden="true">
              {done ? <Check size={18} /> : i + 1}
            </span>
            <span className={`hub-roadmap__label${done ? ' is-done' : ''}`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
