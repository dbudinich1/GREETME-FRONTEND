/**
 * VideoPlayer.jsx
 */

import React, { useRef, useState } from 'react';

export default function VideoPlayer({ videoUrl }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  const togglePlay = (e) => {
    e.stopPropagation();
    
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => setHasError(true));
    }
    setIsPlaying(!isPlaying);
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
          onEnded={() => setIsPlaying(false)}
          onError={() => setHasError(true)}
        />
        
        {!isPlaying && (
          <div className="gc-video-play-overlay">
            <div className="gc-play-button">
              <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
