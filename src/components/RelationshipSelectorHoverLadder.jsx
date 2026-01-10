// src/components/RelationshipSelectorHoverLadder.jsx
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

const relationshipData = {
  family: {
    label: 'Family',
    icon: '👨‍👩‍👧‍👦',
    roles: {
      mother: { label: 'Mother', icon: '👩' },
      father: { label: 'Father', icon: '👨' },
      sister: { label: 'Sister', icon: '👧' },
      brother: { label: 'Brother', icon: '👦' },
      daughter: { label: 'Daughter', icon: '👧' },
      son: { label: 'Son', icon: '👦' },
      grandmother: { label: 'Grandmother', icon: '👵' },
      grandfather: { label: 'Grandfather', icon: '👴' },
      aunt: { label: 'Aunt', icon: '👩' },
      uncle: { label: 'Uncle', icon: '👨' },
      cousin: { label: 'Cousin', icon: '🙂' },
      niece: { label: 'Niece', icon: '👧' },
      nephew: { label: 'Nephew', icon: '👦' }
    }
  },
  friend: {
    label: 'Friend',
    icon: '🤝',
    roles: {
      bestie: { label: 'Best Friend', icon: '💛' },
      close_friend: { label: 'Close Friend', icon: '😊' },
      friend: { label: 'Friend', icon: '🙂' },
      acquaintance: { label: 'Acquaintance', icon: '👋' },
      neighbor: { label: 'Neighbor', icon: '🏠' },
      roommate: { label: 'Roommate', icon: '🚪' }
    }
  },
  professional: {
    label: 'Professional',
    icon: '💼',
    roles: {
      boss: { label: 'Boss/Manager', icon: '👔' },
      coworker: { label: 'Coworker', icon: '🤝' },
      employee: { label: 'Employee', icon: '👤' },
      client: { label: 'Client', icon: '🤝' },
      mentor: { label: 'Mentor', icon: '🎓' },
      colleague: { label: 'Colleague', icon: '💼' }
    }
  },
  romantic: {
    label: 'Romantic',
    icon: '❤️',
    roles: {
      spouse: { label: 'Spouse', icon: '💍' },
      partner: { label: 'Partner', icon: '❤️' },
      girlfriend: { label: 'Girlfriend', icon: '💕' },
      boyfriend: { label: 'Boyfriend', icon: '💕' },
      fiance: { label: 'Fiancé(e)', icon: '💍' }
    }
  }
};

const closenessLevels = {
  inner_circle: { label: 'Inner Circle', description: 'Closest relationships, most personal', icon: '⭐' },
  close: { label: 'Close', description: 'Very close but not innermost', icon: '💚' },
  friendly: { label: 'Friendly', description: 'Warm but measured', icon: '🙂' },
  formal: { label: 'Formal', description: 'Professional and polite', icon: '🤝' },
  casual: { label: 'Casual', description: 'Relaxed and informal', icon: '👋' }
};

export default function RelationshipSelectorHoverLadder({ value, onChange, className = '' }) {
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const [hoveredRole, setHoveredRole] = useState(null);
  const [showCloseness, setShowCloseness] = useState(false);

  const handleGroupHover = (group) => {
    setHoveredGroup(group);
    setHoveredRole(null);
    setShowCloseness(false);
  };

  const handleRoleHover = (role) => {
    setHoveredRole(role);
    setShowCloseness(true);
  };

  const handleClosenessSelect = (closeness) => {
    if (hoveredGroup && hoveredRole) {
      const selected = {
        group: hoveredGroup,
        groupLabel: relationshipData[hoveredGroup].label,
        role: hoveredRole,
        roleLabel: relationshipData[hoveredGroup].roles[hoveredRole].label,
        closeness: closeness,
        closenessLabel: closenessLevels[closeness].label
      };
      onChange(selected);
      // Reset hover states
      setHoveredGroup(null);
      setHoveredRole(null);
      setShowCloseness(false);
    }
  };

  const getDisplayText = () => {
    if (!value) return 'Select relationship...';
    return `${value.roleLabel} - ${value.closenessLabel}`;
  };

  return (
    <div className={className}>
      {/* Display Selected Value */}
      <div style={{
        padding: '0.75rem',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '0.5rem',
        background: value ? 'var(--gray-50)' : 'white',
        color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
        fontSize: '0.9375rem',
        fontWeight: value ? 600 : 400
      }}>
        {getDisplayText()}
      </div>

      {/* Hover Ladder Menu */}
      <div style={{
        position: 'relative',
        display: 'flex',
        gap: '0.5rem',
        minHeight: '300px'
      }}>
        {/* Level 1: Groups */}
        <div style={{
          flex: '1',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '0.75rem',
            borderBottom: '1px solid var(--border)',
            background: 'var(--gray-50)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Category
          </div>
          {Object.entries(relationshipData).map(([key, data]) => (
            <div
              key={key}
              onMouseEnter={() => handleGroupHover(key)}
              style={{
                padding: '0.875rem 1rem',
                cursor: 'pointer',
                background: hoveredGroup === key ? 'var(--gray-100)' : 'transparent',
                borderLeft: hoveredGroup === key ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.9375rem',
                fontWeight: hoveredGroup === key ? 600 : 500,
                color: hoveredGroup === key ? 'var(--primary)' : 'var(--text-primary)'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{data.icon}</span>
              <span style={{ flex: 1 }}>{data.label}</span>
              <ChevronRight size={16} style={{ opacity: hoveredGroup === key ? 1 : 0.3 }} />
            </div>
          ))}
        </div>

        {/* Level 2: Roles */}
        {hoveredGroup && (
          <div style={{
            flex: '1',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '0.75rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--gray-50)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Relationship
            </div>
            {Object.entries(relationshipData[hoveredGroup].roles).map(([key, data]) => (
              <div
                key={key}
                onMouseEnter={() => handleRoleHover(key)}
                style={{
                  padding: '0.875rem 1rem',
                  cursor: 'pointer',
                  background: hoveredRole === key ? 'var(--gray-100)' : 'transparent',
                  borderLeft: hoveredRole === key ? '3px solid var(--primary)' : '3px solid transparent',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontSize: '0.9375rem',
                  fontWeight: hoveredRole === key ? 600 : 500,
                  color: hoveredRole === key ? 'var(--primary)' : 'var(--text-primary)'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{data.icon}</span>
                <span style={{ flex: 1 }}>{data.label}</span>
                <ChevronRight size={16} style={{ opacity: hoveredRole === key ? 1 : 0.3 }} />
              </div>
            ))}
          </div>
        )}

        {/* Level 3: Closeness */}
        {showCloseness && hoveredRole && (
          <div style={{
            flex: '1',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '0.75rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--gray-50)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Closeness
            </div>
            {Object.entries(closenessLevels).map(([key, data]) => (
              <div
                key={key}
                onClick={() => handleClosenessSelect(key)}
                style={{
                  padding: '0.875rem 1rem',
                  cursor: 'pointer',
                  background: 'transparent',
                  transition: 'all 0.15s',
                  borderLeft: '3px solid transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--gray-100)';
                  e.currentTarget.style.borderLeft = '3px solid var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderLeft = '3px solid transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>{data.icon}</span>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {data.label}
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', paddingLeft: '2rem' }}>
                  {data.description}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Helper Text */}
      <p style={{
        fontSize: '0.8125rem',
        color: 'var(--text-tertiary)',
        marginTop: '0.75rem'
      }}>
        Hover over categories to explore relationships, then select closeness level
      </p>
    </div>
  );
}
