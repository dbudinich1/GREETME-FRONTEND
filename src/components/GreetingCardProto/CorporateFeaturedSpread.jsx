/**
 * CorporateFeaturedSpread.jsx
 *
 * TEAM C — Phase A5: the corporate Campaign Featured Spread rendered on screen 4 of the
 * recipient card. Chosen by GreetingCard ONLY when greeting.corporate === true; the personal
 * FeaturedSpread path is otherwise unchanged.
 *
 * Rendering sources (never Corporate Video):
 *   • Animated-message OUTPUT → the greeting's existing videoUrl, played through the SAME
 *     VideoPlayer as the personal path (the valid animation output path).
 *   • Additional campaign images → fetched, in approved order, through the scoped resolver
 *     URLs (each mints a fresh short-lived read-only SAS server-side). A broken/missing asset
 *     shows a safe "unavailable" tile — never an arbitrary fallback image.
 *
 * Combinations (from facts): animation-only, images-only, animation+images. When every
 * Featured Spread element is disabled the FEATURED screen is omitted upstream (resolveScreenOrder),
 * so this component is not rendered for Intro-and-Finale-Only.
 */

import { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import cardInteriorImg from '../../assets/card/card-interior.png';
import './corporateFeaturedSpread.css';

function CorporateImage({ src }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="gc-corp-image gc-corp-image-unavailable" role="img" aria-label="Image unavailable">
        <span className="gc-corp-unavailable-text">Image unavailable</span>
      </div>
    );
  }
  return (
    <img
      className="gc-corp-image"
      src={src}
      alt="Campaign moment"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function CorporateFeaturedSpread({ facts, onClick, videoHasEnded, onVideoEnd }) {
  const [showVideo, setShowVideo] = useState(false);
  // The completed animation is served through the scoped resolver (durable artifact), never
  // the raw videoUrl. If no animation artifact resolved, the animation panel is simply omitted.
  const animationUrl = facts?.animationUrl || null;
  const showAnimation = !!facts?.showAnimation && !!animationUrl;
  const showImages = !!facts?.showImages;
  const imageUrls = Array.isArray(facts?.imageUrls) ? facts.imageUrls : [];

  // Match the personal FeaturedSpread's brief pause before the video fades in.
  useEffect(() => {
    if (!showAnimation) return undefined;
    const timer = setTimeout(() => setShowVideo(true), 700);
    return () => clearTimeout(timer);
  }, [showAnimation]);

  return (
    <div
      className="gc-spread-wrapper"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Click to continue"
      onKeyDown={(e) => e.key === 'Enter' && onClick && onClick()}
    >
      <div
        className="gc-spread gc-featured-spread gc-corporate-featured-spread"
        style={{ backgroundImage: `url(${cardInteriorImg})` }}
      >
        {showAnimation && (
          <div className="gc-page gc-page-left gc-video-page" onClick={(e) => e.stopPropagation()}>
            <div className={`gc-video-container ${showVideo ? 'gc-video-visible' : ''}`}>
              <VideoPlayer videoUrl={animationUrl} onEnded={onVideoEnd} hasEnded={videoHasEnded} />
            </div>
          </div>
        )}

        {showImages && (
          <div
            className={`gc-page gc-page-right gc-album-page ${showAnimation ? '' : 'gc-corp-images-full'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="gc-album-title">Featured Moments</h3>
            <div className="gc-corp-image-grid">
              {imageUrls.map((src, i) => (
                <CorporateImage key={i} src={src} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}