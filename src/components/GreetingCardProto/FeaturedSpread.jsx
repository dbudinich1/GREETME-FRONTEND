/**
 * FeaturedSpread.jsx
 * Screen 4: Video + Photo Album
 * GS-04: 2-second pause before video fades in
 * GS-05: Video inset layout with centered ribbon
 */

import React, { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import PhotoAlbum from './PhotoAlbum';
import cardInteriorImg from '../../assets/card/card-interior.png';

export default function FeaturedSpread({ videoUrl, photos, onClick }) {
  const [showVideo, setShowVideo] = useState(false);

  // GS-04: 2-second pause before video fades in
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowVideo(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="gc-spread-wrapper"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Click to continue"
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div
        className="gc-spread gc-featured-spread"
        style={{ backgroundImage: `url(${cardInteriorImg})` }}
      >
        {/* Left Page - Video */}
        <div className="gc-page gc-page-left gc-video-page">
          <div className={`gc-video-container ${showVideo ? 'gc-video-visible' : ''}`}>
            {showVideo && (
              <>
                <VideoPlayer videoUrl={videoUrl} />
                <p className="gc-video-caption">
                  <em>From the heart, with love</em>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Right Page - Photo Album */}
        <div className="gc-page gc-page-right gc-album-page">
          <h3 className="gc-album-title">Cherished Moments</h3>
          <PhotoAlbum photos={photos} />
        </div>
      </div>
    </div>
  );
}
