// src/components/FaithBasedOccasionSelector.jsx
import { useState } from 'react';
import { Info } from 'lucide-react';
import { getOccasionsByCategory } from '../utils/helpers';

const faithPackages = [
  {
    id: 'secular',
    name: 'Secular Holidays',
    icon: '🎉',
    description: 'Widely celebrated non-religious holidays',
    occasions: null
  },
  {
    id: 'christian',
    name: 'Christianity',
    icon: '✝️',
    description: 'Major Christian holidays',
    occasions: null // will be populated from helpers
  },
  {
    id: 'jewish',
    name: 'Judaism',
    icon: '✡️',
    description: 'Major Jewish holidays',
    occasions: null
  },
  {
    id: 'muslim',
    name: 'Islam',
    icon: '☪️',
    description: 'Major Islamic holidays',
    occasions: null
  }
];

export default function FaithBasedOccasionSelector({ selectedFaiths = [], onChange }) {
  const [hoveredFaith, setHoveredFaith] = useState(null);
  const [expandedFaith, setExpandedFaith] = useState(null);

  // Populate occasions from helpers
  const occasionsByCategory = getOccasionsByCategory();
  const faithsWithOccasions = faithPackages.map(faith => ({
    ...faith,
    occasions: occasionsByCategory[faith.id] || []
  }));

  const handleToggleFaith = (faithId) => {
    const newSelection = selectedFaiths.includes(faithId)
      ? selectedFaiths.filter(id => id !== faithId)
      : [...selectedFaiths, faithId];

    onChange(newSelection);
  };

  const toggleExpand = (faithId) => {
    setExpandedFaith(expandedFaith === faithId ? null : faithId);
  };

  return (
    <div>
      <div style={{
        marginBottom: 'var(--space-lg)'
      }}>
        <h3 style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-xs)'
        }}>
          Faith Traditions
        </h3>
        <p style={{
          fontSize: '0.75rem',
          color: 'var(--text-tertiary)',
          margin: 0
        }}>
          Select the faith traditions you want to track. Click to expand and see included holidays.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'var(--space-md)'
      }}>
        {faithsWithOccasions.map(faith => {
          const isSelected = selectedFaiths.includes(faith.id);
          const isExpanded = expandedFaith === faith.id;
          const isHovered = hoveredFaith === faith.id;

          return (
            <div
              key={faith.id}
              style={{
                border: '1px solid',
                borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                borderRadius: 'var(--radius-lg)',
                background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-primary)',
                transition: 'all 0.15s ease',
                overflow: 'hidden'
              }}
            >
              {/* Checkbox Header */}
              <div
                style={{
                  padding: 'var(--space-md)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-md)',
                  cursor: 'pointer'
                }}
                onMouseEnter={() => setHoveredFaith(faith.id)}
                onMouseLeave={() => setHoveredFaith(null)}
              >
                {/* Checkbox */}
                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-md)',
                  cursor: 'pointer',
                  flex: 1
                }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleFaith(faith.id)}
                    style={{
                      width: '1.125rem',
                      height: '1.125rem',
                      marginTop: '0.125rem',
                      cursor: 'pointer',
                      accentColor: 'var(--primary)'
                    }}
                  />

                  {/* Faith Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-sm)',
                      marginBottom: 'var(--space-xs)'
                    }}>
                      <span style={{ fontSize: '1.25rem' }}>{faith.icon}</span>
                      <span style={{
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                      }}>
                        {faith.name}
                      </span>
                      {faith.occasions.length > 0 && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-tertiary)',
                          background: 'var(--gray-100)',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                          fontWeight: 500
                        }}>
                          {faith.occasions.length} {faith.occasions.length === 1 ? 'holiday' : 'holidays'}
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      margin: 0
                    }}>
                      {faith.description}
                    </p>
                  </div>
                </label>

                {/* Expand Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(faith.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 'var(--space-xs)',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--gray-100)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-tertiary)';
                  }}
                >
                  <Info size={16} />
                </button>
              </div>

              {/* Expanded Occasions List */}
              {isExpanded && faith.occasions.length > 0 && (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  padding: 'var(--space-md)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.02)' : 'var(--gray-50)'
                }}>
                  <p style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--space-sm)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Included Holidays
                  </p>
                  <div style={{
                    display: 'grid',
                    gap: 'var(--space-xs)'
                  }}>
                    {faith.occasions.map(occasion => (
                      <div
                        key={occasion.value}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-sm)',
                          padding: 'var(--space-sm)',
                          background: 'var(--bg-primary)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8125rem'
                        }}
                      >
                        <span style={{ fontSize: '1rem' }}>{occasion.icon}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {occasion.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
