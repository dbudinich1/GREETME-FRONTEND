/**
 * PhotoAlbum.jsx
 */

import React, { useState } from 'react';

function getPhotoSrc(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') return photo;
  if (typeof photo === 'object') {
    return photo.url || photo.src || photo.photoUrl || photo.uri || null;
  }
  return null;
}

export default function PhotoAlbum({ photos }) {
   console.log('Photos received:', photos);
  const [currentIndex, setCurrentIndex] = useState(0);

  const validPhotos = (photos || []).map(getPhotoSrc).filter(Boolean);
  const hasPhotos = validPhotos.length > 0;

  const goToPhoto = (index, e) => {
    e?.stopPropagation();
    setCurrentIndex(index);
  };

  const nextPhoto = (e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % validPhotos.length);
  };

  const prevPhoto = (e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + validPhotos.length) % validPhotos.length);
  };

  if (!hasPhotos) {
    return (
      <div className="gc-photo-album">
        <div className="gc-album-frame gc-album-placeholder">
          <div className="gc-album-placeholder-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
          </div>
          <p className="gc-album-placeholder-text">Photo Album</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gc-photo-album">
      <div className="gc-album-frame">
        <img
          src={validPhotos[currentIndex]}
          alt={`Memory ${currentIndex + 1}`}
          className="gc-album-photo"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        
        {validPhotos.length > 1 && (
          <>
            <button className="gc-album-nav gc-album-prev" onClick={prevPhoto}>‹</button>
            <button className="gc-album-nav gc-album-next" onClick={nextPhoto}>›</button>
          </>
        )}
      </div>

      {validPhotos.length > 1 && (
        <div className="gc-album-dots">
          {validPhotos.map((_, index) => (
            <button
              key={index}
              className={`gc-album-dot ${index === currentIndex ? 'active' : ''}`}
              onClick={(e) => goToPhoto(index, e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
