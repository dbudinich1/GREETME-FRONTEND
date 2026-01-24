/**
 * Envelope.jsx
 * Interactive 3D envelope with 360° spin on drag
 * Click wax seal to open
 */

import React, { useState, useRef } from 'react';
import envelopeFrontImg from '../../assets/card/envelope-front.jpeg';
import envelopeBackImg from '../../assets/card/envelope-back.jpeg';

// Capitalize first letter of name
const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export default function Envelope({ recipientName, onSealClick }) {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (e.target.closest('.gc-wax-seal')) return;
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastPos.current.x;
    const deltaY = e.clientY - lastPos.current.y;
    
    setRotation(prev => ({
      x: prev.x - deltaY * 0.5,
      y: prev.y + deltaX * 0.5
    }));
    
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleSealClick = (e) => {
    e.stopPropagation();
    onSealClick();
  };

  // Determine which side is showing
  const normalizedY = ((rotation.y % 360) + 360) % 360;
  const showingBack = normalizedY > 90 && normalizedY < 270;

  return (
    <div 
      className="gc-envelope-wrapper"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="gc-envelope"
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Front */}
        <div
          className="gc-envelope-face gc-envelope-front"
          style={{ backgroundImage: `url(${envelopeFrontImg})` }}
        >
          <span className="gc-recipient-name">{capitalize(recipientName) || 'Friend'}</span>
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
