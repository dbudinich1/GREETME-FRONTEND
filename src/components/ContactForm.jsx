// src/components/ContactForm.jsx
// Implement relationship-scoped media albums, multi-page greeting drafts, and reminder-based edit flows without altering existing navigation or breaking the current send-greeting pipeline.
import { useState, useEffect } from 'react';
import { validateEmail, getOccasionsByCategory, calculateVaryingOccasionDate, relationshipTypes, closenessLevels } from '../utils/helpers';
import Alert from './Alert';
import FaithBasedOccasionSelector from './FaithBasedOccasionSelector';
import RelationshipSelector from './RelationshipSelector';
import RelationshipSelectorHoverLadder from './RelationshipSelectorHoverLadder';
import { Heart, User, Mail, Info, Plus, Camera, Upload, X, Star, Gift, ChevronDown, ChevronUp } from 'lucide-react';

export default function ContactForm({ contact, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    gender: '',
    relationship: '',
    relationshipCloseness: '',
    relationshipContext: '',
    relationshipProfile: null, // New hover ladder format: {group, groupLabel, role, roleLabel, closeness, closenessLabel}
    occasions: [],
    avatar: '',
    memoryPhotos: [],
    coverPhoto: '',
    culturalContext: {
      heritage: [],
      faith: null,
      preferCulturalGifts: false,
    },
    giftPreferences: {
      enabled: false,
      budgetCap: '',
      giftingMode: 'always', // 'always', 'occasions_only', 'never'
    },
  });
  const [selectedFaiths, setSelectedFaiths] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [culturalSectionExpanded, setCulturalSectionExpanded] = useState(false);
  const [giftSectionExpanded, setGiftSectionExpanded] = useState(false);

  const occasionCategories = getOccasionsByCategory();

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        email: contact.email || '',
        gender: contact.gender || '',
        relationship: contact.relationship || '',
        relationshipCloseness: contact.relationshipCloseness || '',
        relationshipContext: contact.relationshipContext || '',
        relationshipProfile: contact.relationshipProfile || null,
        occasions: contact.occasions || [],
        avatar: contact.avatar || '',
        memoryPhotos: contact.memoryPhotos || [],
        coverPhoto: contact.coverPhoto || '',
        culturalContext: contact.culturalContext || {
          heritage: [],
          faith: null,
          preferCulturalGifts: false,
        },
        giftPreferences: contact.giftPreferences || {
          enabled: false,
          budgetCap: '',
          giftingMode: 'always',
        },
      });

      // Extract selected faiths from occasions
      const occasions = contact.occasions || [];
      const faiths = new Set();
      occasions.forEach(occ => {
        const occasion = [...occasionCategories.christian, ...occasionCategories.jewish, ...occasionCategories.muslim, ...occasionCategories.secular].find(o => o.value === occ.type);
        if (occasion && ['christian', 'jewish', 'muslim', 'secular'].includes(occasion.category)) {
          faiths.add(occasion.category);
        }
      });
      setSelectedFaiths(Array.from(faiths));
    }
  }, [contact]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleOccasionToggle = (occasionValue, fixedDate) => {
    setFormData(prev => {
      const occasions = prev.occasions || [];
      const exists = occasions.find(o => o.type === occasionValue);

      if (exists) {
        return {
          ...prev,
          occasions: occasions.filter(o => o.type !== occasionValue),
        };
      } else {
        const currentYear = new Date().getFullYear();
        let dateValue = '';

        // If occasion has fixed date (like Christmas 12-25), pre-fill it
        if (fixedDate) {
          dateValue = `${currentYear}-${fixedDate}`;
        } else {
          // Try to calculate varying date (Mother's Day, Thanksgiving, etc.)
          const calculatedDate = calculateVaryingOccasionDate(occasionValue, currentYear);
          if (calculatedDate) {
            dateValue = calculatedDate;
          }
        }

        return {
          ...prev,
          occasions: [...occasions, { type: occasionValue, date: dateValue, autoSend: true }],
        };
      }
    });
  };

  const handleOccasionDateChange = (occasionValue, date) => {
    setFormData(prev => ({
      ...prev,
      occasions: prev.occasions.map(o =>
        o.type === occasionValue ? { ...o, date } : o
      ),
    }));
  };

  const handleFaithSelectionChange = (newSelectedFaiths) => {
    setSelectedFaiths(newSelectedFaiths);

    // Update occasions based on faith selection
    setFormData(prev => {
      const currentOccasions = prev.occasions || [];

      // Keep personal occasions
      const personalOccasions = currentOccasions.filter(occ => {
        const occasion = occasionCategories.personal.find(o => o.value === occ.type);
        return !!occasion;
      });

      // Add/remove faith-based occasions based on selected faiths
      const faithOccasions = [];
      newSelectedFaiths.forEach(faithId => {
        const occasions = occasionCategories[faithId] || [];
        occasions.forEach(occasion => {
          // Check if this occasion already exists in current occasions (preserve date if exists)
          const existing = currentOccasions.find(o => o.type === occasion.value);
          const currentYear = new Date().getFullYear();
          const dateValue = existing?.date || (occasion.fixedDate ? `${currentYear}-${occasion.fixedDate}` : '');

          faithOccasions.push({
            type: occasion.value,
            date: dateValue,
            autoSend: true
          });
        });
      });

      return {
        ...prev,
        occasions: [...personalOccasions, ...faithOccasions]
      };
    });
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Check for relationship using new hover ladder format OR old separate fields
    if (!formData.relationshipProfile && !formData.relationship) {
      newErrors.relationship = 'Please select a relationship';
    }

    if (!formData.relationshipProfile && !formData.relationshipCloseness) {
      newErrors.relationshipCloseness = 'Please select relationship closeness';
    }

    // Validate that all selected occasions have dates
    if (formData.occasions && formData.occasions.length > 0) {
      const occasionsWithoutDates = formData.occasions.filter(occ => !occ.date || occ.date.trim() === '');
      if (occasionsWithoutDates.length > 0) {
        newErrors.occasions = `Please provide dates for all selected occasions`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOccasions = formData.occasions?.map(o => o.type) || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.submit && <Alert type="error" message={errors.submit} />}

      {/* Contact Information */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <User size={20} className="text-purple-600" />
          <span>Contact Information</span>
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 transition-all ${
              errors.name ? 'border-red-500' : 'border-gray-200'
            }`}
            placeholder="John Doe"
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="text-gray-400" size={20} />
            </div>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 transition-all ${
                errors.email ? 'border-red-500' : 'border-gray-200'
              }`}
              placeholder="john@example.com"
            />
          </div>
          {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gender
          </label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 transition-all bg-white"
          >
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Helps us filter relevant occasions (e.g., hide Mother's Day for males)
          </p>
        </div>
      </div>

      {/* Relationship Information */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Heart size={20} className="text-pink-500" fill="currentColor" />
          <span>Relationship</span>
        </h3>

        {/* New Hover Ladder Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Relationship <span className="text-red-500">*</span>
          </label>
          <RelationshipSelectorHoverLadder
            value={formData.relationshipProfile}
            onChange={(profile) => {
              setFormData(prev => ({
                ...prev,
                relationshipProfile: profile,
                // Also populate old fields for backward compatibility
                relationship: profile.role,
                relationshipCloseness: profile.closeness
              }));
            }}
            className=""
          />
          {(errors.relationship || errors.relationshipCloseness) && (
            <p className="mt-1 text-sm text-red-500">
              {errors.relationship || errors.relationshipCloseness}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
            <span>Relationship Context</span>
            <Info size={16} className="text-gray-400" />
          </label>
          <textarea
            name="relationshipContext"
            value={formData.relationshipContext}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 transition-all"
            placeholder="Describe your relationship with this person... How did you meet? What memories do you share? This helps AI personalize the greeting message."
            maxLength={500}
          />
          <p className="mt-1 text-xs text-gray-500">
            {formData.relationshipContext?.length || 0}/500 characters - Helps personalize greetings
          </p>
        </div>
      </div>

      {/* Cultural & Personal Context - Collapsible Section */}
      <div style={{
        marginTop: 'var(--space-lg)',
        border: '2px solid #8b5cf6',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden'
      }}>
        {/* Header - Always Visible */}
        <button
          type="button"
          onClick={() => setCulturalSectionExpanded(!culturalSectionExpanded)}
          style={{
            width: '100%',
            padding: 'var(--space-md)',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Heart size={20} style={{ color: 'white' }} />
            <div style={{ textAlign: 'left' }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'white',
                margin: 0
              }}>
                Cultural & Personal Context
              </h3>
              <p style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.9)',
                margin: 0
              }}>
                Helps personalize messages and gift suggestions more thoughtfully
              </p>
            </div>
          </div>
          {culturalSectionExpanded ? (
            <ChevronUp size={20} style={{ color: 'white' }} />
          ) : (
            <ChevronDown size={20} style={{ color: 'white' }} />
          )}
        </button>

        {/* Collapsible Content */}
        {culturalSectionExpanded && (
          <div style={{
            padding: 'var(--space-lg)',
            background: 'var(--bg-primary)',
            borderTop: '1px solid rgba(139, 92, 246, 0.2)'
          }}>
            {/* Cultural / Heritage */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-xs)'
              }}>
                Cultural / Heritage (Optional)
              </label>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-sm)'
              }}>
                Select cultural backgrounds that are meaningful to this person
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['Italian', 'Jewish', 'Hispanic', 'Indian', 'Chinese', 'Irish', 'German', 'African', 'Korean', 'Japanese', 'Polish', 'Greek', 'Vietnamese', 'Filipino', 'Other'].map(heritage => {
                  const isSelected = formData.culturalContext?.heritage?.includes(heritage);
                  return (
                    <button
                      key={heritage}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          culturalContext: {
                            ...prev.culturalContext,
                            heritage: isSelected
                              ? prev.culturalContext.heritage.filter(h => h !== heritage)
                              : [...prev.culturalContext.heritage, heritage]
                          }
                        }));
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '9999px',
                        border: isSelected ? '2px solid #8b5cf6' : '2px solid #e5e7eb',
                        background: isSelected ? '#f3e8ff' : 'white',
                        color: isSelected ? '#7c3aed' : '#6b7280',
                        fontSize: '0.875rem',
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = '#d1d5db';
                          e.currentTarget.style.background = '#f9fafb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.background = 'white';
                        }
                      }}
                    >
                      {heritage}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Faith / Observance */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-xs)'
              }}>
                Faith / Observance (Optional)
              </label>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-sm)'
              }}>
                Helps us respect traditions and suggest appropriate occasions
              </p>
              <select
                value={formData.culturalContext?.faith || ''}
                onChange={(e) => {
                  setFormData(prev => ({
                    ...prev,
                    culturalContext: {
                      ...prev.culturalContext,
                      faith: e.target.value || null
                    }
                  }));
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  fontSize: '0.9375rem',
                  border: '2px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'white',
                  fontFamily: 'inherit'
                }}
              >
                <option value="">Prefer not to say</option>
                <option value="christian">Christian</option>
                <option value="jewish">Jewish</option>
                <option value="muslim">Muslim</option>
                <option value="hindu">Hindu</option>
                <option value="buddhist">Buddhist</option>
                <option value="secular">Secular / Non-religious</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Prefer Culturally-Inspired Gifts */}
            <div style={{
              padding: 'var(--space-md)',
              background: '#faf5ff',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #e9d5ff'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                gap: '0.75rem'
              }}>
                <input
                  type="checkbox"
                  checked={formData.culturalContext?.preferCulturalGifts || false}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      culturalContext: {
                        ...prev.culturalContext,
                        preferCulturalGifts: e.target.checked
                      }
                    }));
                  }}
                  style={{
                    width: '1.125rem',
                    height: '1.125rem',
                    accentColor: '#8b5cf6',
                    cursor: 'pointer'
                  }}
                />
                <div>
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}>
                    Prefer culturally-inspired gifts when available
                  </span>
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    margin: '0.25rem 0 0 0'
                  }}>
                    We'll prioritize gifts that honor their cultural background
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Memory Album - Side by Side Layout */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Camera size={20} className="text-blue-600" />
          <span>Memory Album</span>
        </h3>
        <p className="text-sm text-gray-600">
          Add photos that represent memories with this person. These will be available when creating personalized greetings.
        </p>

        {/* Side-by-Side Layout: Default Photo | Memory Photos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* LEFT: Default Photo Pane */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label className="block text-sm font-medium text-gray-700 flex items-center space-x-2">
              <Star size={16} className="text-yellow-500" fill="currentColor" />
              <span>Default Photo</span>
            </label>
            <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
              {formData.avatar ? (
                <div className="relative">
                  <img
                    src={formData.avatar}
                    alt="Default Photo"
                    className="w-32 h-32 mx-auto rounded-lg object-cover border-2 border-purple-200 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      // TODO: Open lightbox/modal for full view
                      window.open(formData.avatar, '_blank');
                    }}
                    title="Click to enlarge"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, avatar: '' }))}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="w-32 h-32 mx-auto rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                  <User size={48} className="text-gray-300" />
                </div>
              )}
              <label className="cursor-pointer block mt-3">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      // Validate size
                      if (file.size > 5 * 1024 * 1024) {
                        alert('Image must be less than 5MB');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormData(prev => ({ ...prev, avatar: reader.result }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div className="w-full px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium text-sm flex items-center justify-center space-x-2">
                  <Upload size={16} />
                  <span>{formData.avatar ? 'Change Photo' : 'Upload Photo'}</span>
                </div>
              </label>
              <p className="text-xs text-gray-500 mt-2 text-center">Max 5MB • Click image to enlarge</p>
            </div>
          </div>

          {/* RIGHT: Memory Album Pane */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label className="block text-sm font-medium text-gray-700 flex items-center space-x-2">
              <Camera size={16} className="text-blue-600" />
              <span>Memory Photos</span>
            </label>
            <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50 min-h-[200px]">
              {/* Photo Grid - Smaller Thumbnails */}
              {formData.memoryPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {formData.memoryPhotos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={photo}
                        alt={`Memory ${index + 1}`}
                        className="w-full aspect-square rounded-lg object-cover border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          // TODO: Open lightbox/modal for full view
                          window.open(photo, '_blank');
                        }}
                        title="Click to enlarge"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            memoryPhotos: prev.memoryPhotos.filter((_, i) => i !== index)
                          }));
                        }}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    files.forEach(file => {
                      // Validate size
                      if (file.size > 5 * 1024 * 1024) {
                        alert('Each image must be less than 5MB');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormData(prev => ({
                          ...prev,
                          memoryPhotos: [...prev.memoryPhotos, reader.result]
                        }));
                      };
                      reader.readAsDataURL(file);
                    });
                  }}
                />
                <div className="w-full px-3 py-2 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center space-x-2 text-gray-600 hover:text-blue-700">
                  <Plus size={18} />
                  <span className="font-medium text-sm">Add Photos</span>
                </div>
              </label>

              {formData.memoryPhotos.length > 0 && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {formData.memoryPhotos.length} photo{formData.memoryPhotos.length !== 1 ? 's' : ''} • Click to enlarge
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Occasions */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Special Occasions</h3>

        {/* Personal Occasions */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Personal Occasions</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {occasionCategories.personal.map((occasion) => {
              const isSelected = selectedOccasions.includes(occasion.value);
              const occasionData = formData.occasions?.find(o => o.type === occasion.value);

              return (
                <div key={occasion.value} className="border border-gray-200 rounded-xl p-4 hover:border-purple-200 transition-colors">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`occasion-${occasion.value}`}
                      checked={isSelected}
                      onChange={() => handleOccasionToggle(occasion.value, occasion.fixedDate)}
                      className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label
                      htmlFor={`occasion-${occasion.value}`}
                      className="ml-3 text-sm font-medium text-gray-900 flex items-center cursor-pointer"
                    >
                      <span className="text-2xl mr-2">{occasion.icon}</span>
                      {occasion.label}
                    </label>
                  </div>

                  {isSelected && (
                    <div className="mt-3 ml-8">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                      <input
                        type="date"
                        value={occasionData?.date || ''}
                        onChange={(e) => handleOccasionDateChange(occasion.value, e.target.value)}
                        className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Secular Occasions - Gender Filtered */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Holiday Occasions</h4>
          <p className="text-xs text-gray-500 mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Info size={14} className="inline mr-1" />
            Dates for holidays like Mother's Day and Thanksgiving vary each year. We'll automatically track and update these dates annually.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {occasionCategories.secular.filter(occasion => {
              // Gender-based filtering
              const gender = formData.gender?.toLowerCase();

              // Hide Mother's Day for males
              if (occasion.value === 'mothers_day' && gender === 'male') {
                return false;
              }

              // Hide Father's Day for females
              if (occasion.value === 'fathers_day' && gender === 'female') {
                return false;
              }

              // Show all other occasions
              return true;
            }).map((occasion) => {
              const isSelected = selectedOccasions.includes(occasion.value);
              const occasionData = formData.occasions?.find(o => o.type === occasion.value);

              return (
                <div key={occasion.value} className="border border-gray-200 rounded-xl p-4 hover:border-purple-200 transition-colors">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`occasion-${occasion.value}`}
                      checked={isSelected}
                      onChange={() => handleOccasionToggle(occasion.value, occasion.fixedDate)}
                      className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label
                      htmlFor={`occasion-${occasion.value}`}
                      className="ml-3 text-sm font-medium text-gray-900 flex items-center cursor-pointer"
                    >
                      <span className="text-2xl mr-2">{occasion.icon}</span>
                      {occasion.label}
                    </label>
                  </div>

                  {isSelected && (
                    <div className="mt-3 ml-8">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Date * {!occasion.fixedDate && <span className="text-gray-500 font-normal">(varies each year)</span>}
                      </label>
                      <input
                        type="date"
                        value={occasionData?.date || ''}
                        onChange={(e) => handleOccasionDateChange(occasion.value, e.target.value)}
                        className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Faith-Based Occasions - New Clean Interface */}
        <div>
          <FaithBasedOccasionSelector
            selectedFaiths={selectedFaiths}
            onChange={handleFaithSelectionChange}
          />
        </div>

        {/* Date entry for faith-based occasions that need dates */}
        {selectedFaiths.length > 0 && (
          <div style={{
            marginTop: 'var(--space-lg)',
            padding: 'var(--space-lg)',
            background: 'var(--gray-50)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)'
          }}>
            <h4 style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-md)'
            }}>
              Holiday Dates
            </h4>
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              marginBottom: 'var(--space-md)'
            }}>
              Enter dates for holidays that vary each year. Fixed-date holidays (like Christmas) are pre-filled.
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 'var(--space-md)'
            }}>
              {formData.occasions?.filter(occ => {
                const occasion = [...occasionCategories.christian, ...occasionCategories.jewish, ...occasionCategories.muslim, ...occasionCategories.secular].find(o => o.value === occ.type);
                return occasion && ['christian', 'jewish', 'muslim', 'secular'].includes(occasion.category);
              }).map(occ => {
                const occasion = [...occasionCategories.christian, ...occasionCategories.jewish, ...occasionCategories.muslim, ...occasionCategories.secular].find(o => o.value === occ.type);
                if (!occasion) return null;

                return (
                  <div key={occ.type} style={{
                    padding: 'var(--space-sm)',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: 'var(--space-xs)'
                    }}>
                      <span style={{ marginRight: 'var(--space-xs)' }}>{occasion.icon}</span>
                      {occasion.label}
                    </label>
                    <input
                      type="date"
                      value={occ.date || ''}
                      onChange={(e) => handleOccasionDateChange(occ.type, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'inherit'
                      }}
                      required
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {errors.occasions && <p className="mt-2 text-sm text-red-500">{errors.occasions}</p>}
      </div>

      {/* Gift Reminder Nudge */}
      <div style={{
        marginTop: 'var(--space-lg)',
        marginBottom: 'var(--space-md)',
        padding: 'var(--space-md)',
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        borderRadius: 'var(--radius-lg)',
        border: '2px solid #fbbf24',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Gift size={24} style={{ color: '#d97706' }} />
          <div>
            <p style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: '#78350f',
              margin: 0
            }}>
              Don't forget to add a gift
            </p>
            <p style={{
              fontSize: '0.75rem',
              color: '#92400e',
              margin: '0.25rem 0 0 0'
            }}>
              Make occasions even more special with thoughtful gifts
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setGiftSectionExpanded(true);
            // Scroll to gift section
            setTimeout(() => {
              const giftSection = document.getElementById('gift-preferences-section');
              if (giftSection) {
                giftSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
          }}
          style={{
            padding: '0.625rem 1.25rem',
            background: '#d97706',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(217, 119, 6, 0.3)',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#b45309';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(217, 119, 6, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#d97706';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(217, 119, 6, 0.3)';
          }}
        >
          Add Gift
        </button>
      </div>

      {/* Gift Preferences - Collapsible Section */}
      <div id="gift-preferences-section" style={{
        marginTop: 'var(--space-lg)',
        border: '2px solid #10b981',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden'
      }}>
        {/* Header - Always Visible */}
        <button
          type="button"
          onClick={() => setGiftSectionExpanded(!giftSectionExpanded)}
          style={{
            width: '100%',
            padding: 'var(--space-md)',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Gift size={20} style={{ color: 'white' }} />
            <div style={{ textAlign: 'left' }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'white',
                margin: 0
              }}>
                Gift Preferences
              </h3>
              <p style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.9)',
                margin: 0
              }}>
                {formData.giftPreferences?.enabled
                  ? `Enabled • Budget: $${formData.giftPreferences.budgetCap || 'No limit'}`
                  : 'Click to configure gift settings'}
              </p>
            </div>
          </div>
          {giftSectionExpanded ? (
            <ChevronUp size={20} style={{ color: 'white' }} />
          ) : (
            <ChevronDown size={20} style={{ color: 'white' }} />
          )}
        </button>

        {/* Collapsible Content */}
        {giftSectionExpanded && (
          <div style={{
            padding: 'var(--space-lg)',
            background: 'var(--bg-primary)',
            borderTop: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            {/* Enable Toggle */}
            <div style={{
              marginBottom: 'var(--space-lg)',
              padding: 'var(--space-md)',
              background: '#f0fdf4',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #bbf7d0'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                gap: '0.75rem'
              }}>
                <input
                  type="checkbox"
                  checked={formData.giftPreferences?.enabled || false}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      giftPreferences: {
                        ...prev.giftPreferences,
                        enabled: e.target.checked
                      }
                    }));
                  }}
                  style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    accentColor: '#10b981',
                    cursor: 'pointer'
                  }}
                />
                <div>
                  <span style={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}>
                    Enable gift recommendations for this recipient
                  </span>
                  <p style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    margin: '0.25rem 0 0 0'
                  }}>
                    We'll suggest thoughtful gifts from our American-Made Marketplace
                  </p>
                </div>
              </label>
            </div>

            {/* Budget Cap - Only show when enabled */}
            {formData.giftPreferences?.enabled && (
              <>
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--space-xs)'
                  }}>
                    Budget Cap (Optional)
                  </label>
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--space-sm)'
                  }}>
                    Maximum amount you'd like to spend on gifts for this recipient
                  </p>
                  <div style={{ position: 'relative', maxWidth: '300px' }}>
                    <span style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)'
                    }}>$</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      placeholder="No limit"
                      value={formData.giftPreferences?.budgetCap || ''}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          giftPreferences: {
                            ...prev.giftPreferences,
                            budgetCap: e.target.value
                          }
                        }));
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem 0.75rem 2rem',
                        fontSize: '0.9375rem',
                        border: '2px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>

                {/* Gifting Mode */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--space-xs)'
                  }}>
                    How would you like to send gifts?
                  </label>
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--space-sm)'
                  }}>
                    Choose your preferred gifting method
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      { value: 'auto_curated', label: 'Let Greet-Me curate gifts within your budget automatically', desc: 'We\'ll select and send thoughtful gifts based on your budget and recipient preferences' },
                      { value: 'qr_cash', label: 'Add QR Cash — Send · Scan · Spend', desc: 'It prints inside the card so the recipient can deposit it like cash' },
                      { value: 'curated_suggestions', label: 'Select a gift from Greet-Me curated suggestions', desc: 'Choose from our personalized gift recommendations for this recipient' },
                      { value: 'marketplace', label: 'Select your own gift from our American-Made Marketplace', desc: 'Browse and choose from our full catalog of Made in America products' }
                    ].map(option => (
                      <label
                        key={option.value}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          padding: 'var(--space-md)',
                          border: formData.giftPreferences?.giftingMode === option.value
                            ? '2px solid #10b981'
                            : '2px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          background: formData.giftPreferences?.giftingMode === option.value
                            ? '#f0fdf4'
                            : 'var(--bg-primary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="radio"
                          name="giftingMode"
                          value={option.value}
                          checked={formData.giftPreferences?.giftingMode === option.value}
                          onChange={(e) => {
                            setFormData(prev => ({
                              ...prev,
                              giftPreferences: {
                                ...prev.giftPreferences,
                                giftingMode: e.target.value
                              }
                            }));
                          }}
                          style={{
                            width: '1.125rem',
                            height: '1.125rem',
                            marginTop: '0.125rem',
                            marginRight: '0.75rem',
                            accentColor: '#10b981',
                            cursor: 'pointer'
                          }}
                        />
                        <div>
                          <div style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            marginBottom: '0.25rem'
                          }}>
                            {option.label}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)'
                          }}>
                            {option.desc}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary px-8 py-3 font-semibold disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? 'Saving...' : contact ? 'Update Recipient' : 'Add Recipient'}
        </button>
      </div>
    </form>
  );
}
