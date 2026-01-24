/**
 * FeaturedSpread.jsx
 * Screen 4: Video + Photo Album
 */

import React from 'react';
import VideoPlayer from './VideoPlayer';
import PhotoAlbum from './PhotoAlbum';
import cardInteriorImg from '../../assets/card/card-interior.png';

export default function FeaturedSpread({ videoUrl, photos, onClick }) {
  return (
    <div 
      className="gc-spread-wrapper"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Click to continue"
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="gc-spread gc-featured-spread">
        {/* Left Page - Video (Navy background) */}
        <div className="gc-page gc-page-left gc-video-page">
          <VideoPlayer videoUrl={videoUrl} />
          <p className="gc-video-caption">
            <em>From the heart, with love</em>
          </p>
        </div>

        {/* Right Page - Photo Album (Paper background) */}
        <div 
          className="gc-page gc-page-right gc-album-page"
          style={{ backgroundImage: `url(${cardInteriorImg})` }}
        >
          <PhotoAlbum photos={photos} />
        </div>
      </div>
    </div>
  );
}
