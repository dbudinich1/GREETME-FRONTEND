// src/components/RelationshipSelector.jsx
import { useState } from 'react';
import { relationshipCategories } from '../utils/helpers';
import { ChevronDown, Check } from 'lucide-react';

export default function RelationshipSelector({ value, closeness, onRelationshipChange, onClosenessChange }) {
  const [expandedCategory, setExpandedCategory] = useState(null);

  const handleCategoryClick = (categoryKey) => {
    setExpandedCategory(expandedCategory === categoryKey ? null : categoryKey);
  };

  const handleMemberSelect = (categoryKey, memberValue) => {
    onRelationshipChange(memberValue);
    // Auto-select category if it's family (they can then check "super close")
    if (categoryKey === 'family') {
      // Don't close, let them select closeness
    } else {
      setExpandedCategory(null);
    }
  };

  const handleClosenessToggle = (closenessValue) => {
    // Toggle on/off
    onClosenessChange(closeness === closenessValue ? '' : closenessValue);
  };

  const getSelectedCategory = () => {
    if (!value) return null;

    for (const [key, category] of Object.entries(relationshipCategories)) {
      if (key === 'family' && category.members.find(m => m.value === value)) {
        return 'family';
      }
      if (key === 'friends' && category.levels.find(l => l.value === value)) {
        return 'friends';
      }
      if (key === 'professional' && category.roles.find(r => r.value === value)) {
        return 'professional';
      }
    }
    return null;
  };

  const getSelectedLabel = () => {
    if (!value) return 'Select relationship...';

    const category = getSelectedCategory();
    if (!category) return 'Select relationship...';

    const cat = relationshipCategories[category];
    if (category === 'family') {
      const member = cat.members.find(m => m.value === value);
      return member ? `${member.icon} ${member.label}` : value;
    }
    if (category === 'friends') {
      const level = cat.levels.find(l => l.value === value);
      return level ? level.label : value;
    }
    if (category === 'professional') {
      const role = cat.roles.find(r => r.value === value);
      return role ? role.label : value;
    }
    return value;
  };

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-md)'
      }}>
        {Object.entries(relationshipCategories).map(([key, category]) => {
          const isExpanded = expandedCategory === key;
          const isSelected = getSelectedCategory() === key;

          return (
            <div
              key={key}
              style={{
                border: '1px solid',
                borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                borderRadius: 'var(--radius-lg)',
                background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-primary)',
                overflow: 'hidden',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Category Header */}
              <button
                type="button"
                onClick={() => handleCategoryClick(key)}
                style={{
                  width: '100%',
                  padding: 'var(--space-md)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'inherit'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span style={{ fontSize: '1.5rem' }}>{category.icon}</span>
                  <span style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}>
                    {category.label}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  style={{
                    color: 'var(--text-tertiary)',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}
                />
              </button>

              {/* Expanded Options */}
              {isExpanded && (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  padding: 'var(--space-sm)',
                  background: 'var(--gray-50)'
                }}>
                  {/* Family Members */}
                  {key === 'family' && (
                    <>
                      <div style={{
                        display: 'grid',
                        gap: 'var(--space-xs)'
                      }}>
                        {category.members.map(member => (
                          <button
                            key={member.value}
                            type="button"
                            onClick={() => handleMemberSelect(key, member.value)}
                            style={{
                              padding: 'var(--space-sm)',
                              background: value === member.value ? 'var(--primary)' : 'var(--bg-primary)',
                              color: value === member.value ? 'white' : 'var(--text-primary)',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-sm)',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              transition: 'all 0.15s ease',
                              fontFamily: 'inherit'
                            }}
                            onMouseEnter={(e) => {
                              if (value !== member.value) {
                                e.currentTarget.style.background = 'var(--gray-100)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (value !== member.value) {
                                e.currentTarget.style.background = 'var(--bg-primary)';
                              }
                            }}
                          >
                            <span>{member.icon}</span>
                            <span>{member.label}</span>
                            {value === member.value && <Check size={14} style={{ marginLeft: 'auto' }} />}
                          </button>
                        ))}
                      </div>

                      {/* Super Close Option */}
                      {value && getSelectedCategory() === 'family' && (
                        <div style={{
                          marginTop: 'var(--space-md)',
                          padding: 'var(--space-sm)',
                          background: 'rgba(236, 72, 153, 0.1)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(236, 72, 153, 0.2)'
                        }}>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-sm)',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: 'var(--accent)'
                          }}>
                            <input
                              type="checkbox"
                              checked={closeness === category.closenessOption.value}
                              onChange={() => handleClosenessToggle(category.closenessOption.value)}
                              style={{
                                width: '1rem',
                                height: '1rem',
                                cursor: 'pointer',
                                accentColor: 'var(--accent)'
                              }}
                            />
                            <span>💖 {category.closenessOption.label}</span>
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  {/* Friends Levels */}
                  {key === 'friends' && (
                    <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
                      {category.levels.map(level => (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() => {
                            handleMemberSelect(key, level.value);
                            onClosenessChange(level.value);
                          }}
                          style={{
                            padding: 'var(--space-sm)',
                            background: value === level.value ? 'var(--primary)' : 'var(--bg-primary)',
                            color: value === level.value ? 'white' : 'var(--text-primary)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                            fontFamily: 'inherit',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => {
                            if (value !== level.value) {
                              e.currentTarget.style.background = 'var(--gray-100)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (value !== level.value) {
                              e.currentTarget.style.background = 'var(--bg-primary)';
                            }
                          }}
                        >
                          {level.label}
                          {value === level.value && <Check size={14} style={{ marginLeft: 'auto' }} />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Professional */}
                  {key === 'professional' && (
                    <>
                      <p style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-tertiary)',
                        marginBottom: 'var(--space-sm)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Role
                      </p>
                      <div style={{ display: 'grid', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
                        {category.roles.map(role => (
                          <button
                            key={role.value}
                            type="button"
                            onClick={() => handleMemberSelect(key, role.value)}
                            style={{
                              padding: 'var(--space-sm)',
                              background: value === role.value ? 'var(--primary)' : 'var(--bg-primary)',
                              color: value === role.value ? 'white' : 'var(--text-primary)',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              textAlign: 'left',
                              transition: 'all 0.15s ease',
                              fontFamily: 'inherit',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => {
                              if (value !== role.value) {
                                e.currentTarget.style.background = 'var(--gray-100)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (value !== role.value) {
                                e.currentTarget.style.background = 'var(--bg-primary)';
                              }
                            }}
                          >
                            {role.label}
                            {value === role.value && <Check size={14} style={{ marginLeft: 'auto' }} />}
                          </button>
                        ))}
                      </div>

                      {/* Tone Selection */}
                      {value && getSelectedCategory() === 'professional' && (
                        <>
                          <p style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-tertiary)',
                            marginBottom: 'var(--space-sm)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Tone
                          </p>
                          <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
                            {category.tones.map(tone => (
                              <button
                                key={tone.value}
                                type="button"
                                onClick={() => onClosenessChange(tone.value)}
                                style={{
                                  padding: 'var(--space-sm)',
                                  background: closeness === tone.value ? 'var(--info)' : 'var(--bg-primary)',
                                  color: closeness === tone.value ? 'white' : 'var(--text-primary)',
                                  border: 'none',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'pointer',
                                  fontSize: '0.8125rem',
                                  fontWeight: 500,
                                  textAlign: 'left',
                                  transition: 'all 0.15s ease',
                                  fontFamily: 'inherit',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                onMouseEnter={(e) => {
                                  if (closeness !== tone.value) {
                                    e.currentTarget.style.background = 'var(--gray-100)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (closeness !== tone.value) {
                                    e.currentTarget.style.background = 'var(--bg-primary)';
                                  }
                                }}
                              >
                                {tone.label}
                                {closeness === tone.value && <Check size={14} style={{ marginLeft: 'auto' }} />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Display */}
      {value && (
        <div style={{
          marginTop: 'var(--space-md)',
          padding: 'var(--space-md)',
          background: 'var(--gray-50)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)'
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>Selected:</strong> {getSelectedLabel()}
          {closeness && (
            <span style={{ marginLeft: 'var(--space-sm)', color: 'var(--primary)', fontWeight: 600 }}>
              • {closenessLevels.find(l => l.value === closeness)?.label || closeness}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const closenessLevels = [
  { value: 'super_close_loved_one', label: 'Super Close Loved One' },
  { value: 'casual_acquaintance', label: 'Casual Acquaintance' },
  { value: 'fav', label: 'Fav' },
  { value: 'bestie', label: 'Bestie' },
  { value: 'like_family', label: 'Like Family to Me' },
  { value: 'keep_professional', label: 'Keep it Professional' },
  { value: 'professional_friendly', label: 'Professional but Friendly' },
  { value: 'good_like_that', label: "We're Good Like That!" },
];
