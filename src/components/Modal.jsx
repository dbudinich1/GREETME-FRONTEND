// src/components/Modal.jsx
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const scrollContainerRef = useRef(null);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Scroll modal to top when it opens
  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: '28rem',
    md: '42rem',
    lg: '56rem',
    xl: '72rem',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      overflowY: 'auto'
    }}>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998
        }}
        onClick={onClose}
      />

      {/* Modal positioning wrapper */}
      <div style={{
        position: 'relative',
        minHeight: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '1rem',
        paddingTop: '5rem',
        zIndex: 9999
      }}>
        {/* Modal */}
        <div
          style={{
            position: 'relative',
            zIndex: 10000,
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: sizeStyles[size] || sizeStyles.md,
            maxHeight: 'calc(100vh - 6rem)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#111827',
              margin: 0
            }}>{title}</h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <div
            ref={scrollContainerRef}
            style={{
              padding: '1rem',
              overflowY: 'auto',
              flex: 1
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
