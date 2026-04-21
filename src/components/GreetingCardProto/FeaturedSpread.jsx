/**
 * FeaturedSpread.jsx
 * Screen 4: Video + Photo Album
 * GS-04: 2-second pause before video fades in
 * GS-05: Video inset layout with centered ribbon
 */

import React, { useState, useEffect, useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import PhotoAlbum from './PhotoAlbum';
import cardInteriorImg from '../../assets/card/card-interior.png';

export default function FeaturedSpread({ videoUrl, photos, onClick, videoHasEnded, onVideoEnd, posterUrl }) {
  const [showVideo, setShowVideo] = useState(false);
  const [showSwipeCue, setShowSwipeCue] = useState(false);
  const [albumUnlocking, setAlbumUnlocking] = useState(false);
  const prevVideoEnded = useRef(videoHasEnded);

  // GS-04: 2-second pause before video fades in
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowVideo(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Show swipe cue after video ends or 5s timeout (whichever first)
  useEffect(() => {
    if (showSwipeCue) return;
    const timer = setTimeout(() => setShowSwipeCue(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (videoHasEnded) setShowSwipeCue(true);
  }, [videoHasEnded]);

  // E6: Brief unlock pulse when album becomes interactive
  useEffect(() => {
    if (videoHasEnded && !prevVideoEnded.current) {
      setAlbumUnlocking(true);
      const timer = setTimeout(() => setAlbumUnlocking(false), 800);
      return () => clearTimeout(timer);
    }
    prevVideoEnded.current = videoHasEnded;
  }, [videoHasEnded]);

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
        <div
          className="gc-page gc-page-left gc-video-page"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`gc-video-container ${showVideo ? 'gc-video-visible' : ''}`}>
            {showVideo && (
              <>
                <VideoPlayer videoUrl={videoUrl} onEnded={onVideoEnd} hasEnded={videoHasEnded} posterUrl={posterUrl} />
                <p className="gc-video-caption">
                  <em>From the heart, with love</em>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Right Page - Photo Album */}
        <div
          className="gc-page gc-page-right gc-album-page"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="gc-album-title">Cherished Moments</h3>
          <PhotoAlbum photos={photos} disabled={!videoHasEnded} unlocking={albumUnlocking} />
        </div>

        {showSwipeCue && (
          <div className="gc-swipe-cue" aria-hidden="true">
            <span className="gc-swipe-cue-chevron" />
            <span className="gc-swipe-cue-chevron" />
          </div>
        )}
      </div>
    </div>
  );
}
