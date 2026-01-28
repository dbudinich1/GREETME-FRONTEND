/**
 * PhotoAlbum.jsx
 */

import React, { useState, useRef } from 'react';

function getPhotoSrc(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') return photo;
  if (typeof photo === 'object') {
    return photo.url || photo.src || photo.photoUrl || photo.uri || null;
  }
  return null;
}

export default function PhotoAlbum({ photos, disabled = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const isTransitioning = useRef(false);

  const validPhotos = (photos || []).map(getPhotoSrc).filter(Boolean);
  const hasPhotos = validPhotos.length > 0;
  const photoCount = validPhotos.length;

  const changePhoto = (getNewIndex, e) => {
    // Stop all event propagation
    if (e) {
      e.stopPropagation();
      e.preventDefault();
      e.nativeEvent?.stopImmediatePropagation?.();
    }

    // Block if disabled or already transitioning
    if (disabled || isTransitioning.current) {
      return;
    }

    isTransitioning.current = true;
    setIsFading(true);

    setTimeout(() => {
      setCurrentIndex(prev => {
        const newIdx = getNewIndex(prev);
        return newIdx;
      });
      setIsFading(false);
      isTransitioning.current = false;
    }, 300);
  };

  const handleNext = (e) => {
    changePhoto(prev => (prev + 1) % photoCount, e);
  };

  const handlePrev = (e) => {
    changePhoto(prev => (prev - 1 + photoCount) % photoCount, e);
  };

  const handleDotClick = (index, e) => {
    if (index === currentIndex) {
      e?.stopPropagation();
      return;
    }
    changePhoto(() => index, e);
  };

  // Prevent clicks from bubbling up to advance page
  const handleAlbumClick = (e) => {
    e.stopPropagation();
  };

  if (!hasPhotos) {
    return (
      <div className="gc-photo-album" onClick={handleAlbumClick}>
        <div className="gc-album-stack">
          <div className="gc-album-frame gc-album-stack-1 gc-album-placeholder">
            <div className="gc-album-placeholder-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
            </div>
            <p className="gc-album-placeholder-title">Cherished Moments</p>
            <p className="gc-album-placeholder-sub">No memories added yet.</p>
            <p className="gc-album-placeholder-cta">Add photos in Contacts → Memories</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`gc-photo-album ${disabled ? 'gc-album-disabled' : ''}`}
      onClick={handleAlbumClick}
    >
      {/* Stacked photo effect - decorative frames peeking behind */}
      <div className="gc-album-stack">
        {photoCount > 2 && (
          <div className="gc-album-frame gc-album-stack-3" />
        )}
        {photoCount > 1 && (
          <div className="gc-album-frame gc-album-stack-2" />
        )}
        <div className={`gc-album-frame gc-album-stack-1 ${isFading ? 'gc-album-fading' : ''}`}>
          <img
            src={validPhotos[currentIndex]}
            alt={`Memory ${currentIndex + 1}`}
            className="gc-album-photo"
            draggable={false}
            onError={(e) => { e.target.style.display = 'none'; }}
          />

          {/* Navigation arrows - inside frame */}
          {photoCount > 1 && (
            <>
              <button
                type="button"
                className="gc-album-nav gc-album-prev"
                onClick={handlePrev}
                disabled={disabled}
                aria-label="Previous photo"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
              </button>
              <button
                type="button"
                className="gc-album-nav gc-album-next"
                onClick={handleNext}
                disabled={disabled}
                aria-label="Next photo"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {photoCount > 1 && (
        <div className="gc-album-dots">
          {validPhotos.map((_, index) => (
            <button
              type="button"
              key={index}
              className={`gc-album-dot ${index === currentIndex ? 'active' : ''}`}
              onClick={(e) => handleDotClick(index, e)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
