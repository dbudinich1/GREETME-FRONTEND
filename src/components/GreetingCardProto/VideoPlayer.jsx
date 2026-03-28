/**
 * VideoPlayer.jsx
 */

import React, { useRef, useState } from 'react';

export default function VideoPlayer({ videoUrl, onEnded, hasEnded, posterUrl }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

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
      videoRef.current.play().catch(() => setHasError(true));
    }
    setIsPlaying(!isPlaying);
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    onEnded?.();
  };

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
          preload="metadata"
          poster={posterUrl || undefined}
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
