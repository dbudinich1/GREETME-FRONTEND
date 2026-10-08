/**
 * VideoPlayer.jsx
 *
 * Release 2b: the public greeting response carries `videoStatus` (backend utils/mediaAccess.js resolvePublicMedia):
 *   ready        videoUrl plays (signed private copy, or a still-valid D-ID link while a background repair runs)
 *   preparing    videoUrl null; the private copy is being made right now, try again shortly
 *   unavailable  videoUrl null; the video was erased by the provider and can no longer be shown
 *   none         text-only / no video
 * Only `preparing` and `unavailable` change what is shown. `none`, a missing field (a backend that predates
 * videoStatus) and corporate (null) keep the generic placeholder exactly as before.
 */

import React, { useRef, useState } from 'react';

export const VIDEO_PREPARING_TEXT = 'Your video is being prepared. Please try again shortly.';
export const VIDEO_UNAVAILABLE_TEXT = 'The video for this greeting is no longer available. The rest of your greeting is still here.';

export default function VideoPlayer({ videoUrl, onEnded, hasEnded, videoStatus = null, onRetry = null }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const togglePlay = (e) => {
    e.stopPropagation();

    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // If replaying after ended, reset to start
      if (hasEnded) {
        videoRef.current.currentTime = 0;
      }
      videoRef.current.playbackRate = 0.88; // Slow down tempo
      // Audio fade-in: start silent, ramp to full volume over ~600ms
      videoRef.current.volume = 0;
      videoRef.current.play().catch(() => setHasError(true));
      const fadeStep = 0.05;
      const fadeIntervalMs = 30;
      const fadeInterval = setInterval(() => {
        if (!videoRef.current) { clearInterval(fadeInterval); return; }
        const next = Math.min(1, videoRef.current.volume + fadeStep);
        videoRef.current.volume = next;
        if (next >= 1) clearInterval(fadeInterval);
      }, fadeIntervalMs);
    }
    setIsPlaying(!isPlaying);
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    onEnded?.();
  };

  if (!videoUrl && (videoStatus === 'preparing' || videoStatus === 'unavailable')) {
    const preparing = videoStatus === 'preparing';
    const retry = async (e) => {
      e.stopPropagation();
      if (retrying || typeof onRetry !== 'function') return;
      setRetrying(true);
      try { await onRetry(); } catch { /* the message stays; the person can try again */ }
      setRetrying(false);
    };
    return (
      <div className="gc-video-player">
        <div className="gc-video-frame gc-video-placeholder" data-video-status={videoStatus}>
          <p className="gc-video-placeholder-text" role="status" data-testid="gc-video-status-text">
            {preparing ? VIDEO_PREPARING_TEXT : VIDEO_UNAVAILABLE_TEXT}
          </p>
          {preparing && typeof onRetry === 'function' ? (
            <button
              type="button"
              data-testid="gc-video-retry"
              onClick={retry}
              disabled={retrying}
              style={{
                marginTop: '0.75rem',
                padding: '8px 18px',
                minHeight: '44px',
                borderRadius: '8px',
                border: '1px solid currentColor',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                cursor: retrying ? 'default' : 'pointer',
              }}
            >
              {retrying ? 'Checking…' : 'Try again'}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!videoUrl || hasError) {
    return (
      <div className="gc-video-player">
        <div className="gc-video-frame gc-video-placeholder">
          <div className="gc-video-placeholder-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <p className="gc-video-placeholder-text">Video greeting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gc-video-player">
      <div className="gc-video-frame" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={videoUrl}
          className="gc-video"
          playsInline
          preload="auto"
          onEnded={handleVideoEnd}
          onError={() => setHasError(true)}
        />
        
        {/* Show play overlay only before first play, not after video ends */}
        {!isPlaying && !hasEnded && (
          <div className="gc-video-play-overlay">
            <div className="gc-play-button">
              <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        )}
        {/* Subtle replay indicator after video ends */}
        {hasEnded && (
          <div className="gc-video-replay-overlay">
            <div className="gc-replay-button">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
