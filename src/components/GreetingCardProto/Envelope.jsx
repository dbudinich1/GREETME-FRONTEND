/**
 * Envelope.jsx
 * Interactive 3D envelope with 360° spin on drag
 * Click wax seal to open
 */

import { useState, useRef } from 'react';
import envelopeFrontImg from '../../assets/card/envelope-front.jpeg';
import envelopeBackImg from '../../assets/card/envelope-back.jpeg';

// Audio: Wax seal crack sound
// TODO: Final audio asset pending - currently using placeholder
const WAX_CRACKLE_SRC = '/assets/sounds/wax-crackle.mp3';

// Capitalize first letter of name
const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Play audio with error handling (fail-silent)
// Canon: wax-crackle volume = 0.20, max duration = 200ms
const playSound = (src, volume = 0.20, maxDuration = 200) => {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {
      // Fail silently - audio may be blocked by browser
    });
    // Hard-stop at maxDuration (canon restraint)
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, maxDuration);
  } catch {
    // Fail silently
  }
};

export default function Envelope({ recipientName, onSealClick }) {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Get coordinates from mouse or touch event
  const getEventCoords = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handleDragStart = (e) => {
    if (e.target.closest('.gc-wax-seal')) return;
    setIsDragging(true);
    lastPos.current = getEventCoords(e);
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;

    // Prevent page scroll while dragging envelope
    if (e.cancelable) e.preventDefault();

    const coords = getEventCoords(e);
    const deltaX = coords.x - lastPos.current.x;
    const deltaY = coords.y - lastPos.current.y;

    setRotation(prev => ({
      x: prev.x - deltaY * 0.5,
      y: prev.y + deltaX * 0.5
    }));

    lastPos.current = coords;
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleSealClick = (e) => {
    e.stopPropagation();
    // Play wax seal crack sound (canon: volume 0.20, max 200ms)
    playSound(WAX_CRACKLE_SRC);
    onSealClick();
  };

  // Determine which side is showing
  const normalizedY = ((rotation.y % 360) + 360) % 360;
  const showingBack = normalizedY > 90 && normalizedY < 270;

  return (
    <div
      className="gc-envelope-wrapper"
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
      onTouchCancel={handleDragEnd}
    >
      <div
        className="gc-envelope"
        style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        {/* Front */}
        <div
          className="gc-envelope-face gc-envelope-front"
          style={{ backgroundImage: `url(${envelopeFrontImg})` }}
        >
          <span className="gc-recipient-name">{capitalize((recipientName || 'Friend').split(' ')[0])}</span>
        </div>

        {/* Back */}
        <div 
          className="gc-envelope-face gc-envelope-back"
          style={{ backgroundImage: `url(${envelopeBackImg})` }}
        >
          <button
            className="gc-wax-seal"
            onClick={handleSealClick}
            aria-label="Break seal to open"
          >
            
          </button>
        </div>
      </div>
      
      <p className="gc-hint">
        {showingBack ? 'Click the seal to open' : 'Drag to flip'}
      </p>
    </div>
  );
}
