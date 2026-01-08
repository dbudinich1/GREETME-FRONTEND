// src/components/ContactForm.jsx
import { useState, useEffect } from 'react';
import { validateEmail, getOccasionsByCategory, relationshipTypes, closenessLevels } from '../utils/helpers';
import Alert from './Alert';
import { Heart, User, Mail, Info } from 'lucide-react';

export default function ContactForm({ contact, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    relationship: '',
    relationshipCloseness: '',
    relationshipContext: '',
    occasions: [],
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const occasionCategories = getOccasionsByCategory();

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        email: contact.email || '',
        relationship: contact.relationship || '',
        relationshipCloseness: contact.relationshipCloseness || '',
        relationshipContext: contact.relationshipContext || '',
        occasions: contact.occasions || [],
      });
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
        // If occasion has fixed date (like Christmas 12-25), pre-fill it
        const currentYear = new Date().getFullYear();
        const dateValue = fixedDate ? `${currentYear}-${fixedDate}` : '';

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

    if (!formData.relationship) {
      newErrors.relationship = 'Please select a relationship type';
    }

    if (!formData.relationshipCloseness) {
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
      </div>

      {/* Relationship Information */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Heart size={20} className="text-pink-500" fill="currentColor" />
          <span>Relationship</span>
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Relationship Type <span className="text-red-500">*</span>
          </label>
          <select
            name="relationship"
            value={formData.relationship}
            onChange={handleChange}
            className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 transition-all ${
              errors.relationship ? 'border-red-500' : 'border-gray-200'
            }`}
          >
            <option value="">Select relationship...</option>
            {relationshipTypes.map((rel) => (
              <option key={rel.value} value={rel.value}>
                {rel.label}
              </option>
            ))}
          </select>
          {errors.relationship && <p className="mt-1 text-sm text-red-500">{errors.relationship}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Relationship Closeness <span className="text-red-500">*</span>
          </label>
          <select
            name="relationshipCloseness"
            value={formData.relationshipCloseness}
            onChange={handleChange}
            className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-purple-500 transition-all ${
              errors.relationshipCloseness ? 'border-red-500' : 'border-gray-200'
            }`}
          >
            <option value="">Select closeness level...</option>
            {closenessLevels.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
          {errors.relationshipCloseness && <p className="mt-1 text-sm text-red-500">{errors.relationshipCloseness}</p>}
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

      {/* Occasions */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Special Occasions</h3>

        {/* Personal Occasions */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Personal Occasions</h4>
          <div className="space-y-3">
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

        {/* Faith-Based Occasions */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Christian Holidays</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {occasionCategories.christian.map((occasion) => {
              const isSelected = selectedOccasions.includes(occasion.value);
              const occasionData = formData.occasions?.find(o => o.type === occasion.value);

              return (
                <div key={occasion.value} className="border border-gray-200 rounded-xl p-3 hover:border-purple-200 transition-colors">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`occasion-${occasion.value}`}
                      checked={isSelected}
                      onChange={() => handleOccasionToggle(occasion.value, occasion.fixedDate)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label
                      htmlFor={`occasion-${occasion.value}`}
                      className="ml-2 text-sm font-medium text-gray-900 flex items-center cursor-pointer"
                    >
                      <span className="mr-1">{occasion.icon}</span>
                      {occasion.label}
                    </label>
                  </div>

                  {isSelected && !occasion.fixedDate && (
                    <div className="mt-2 ml-6">
                      <input
                        type="date"
                        value={occasionData?.date || ''}
                        onChange={(e) => handleOccasionDateChange(occasion.value, e.target.value)}
                        className="w-full px-2 py-1 text-xs border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Jewish Holidays</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {occasionCategories.jewish.map((occasion) => {
              const isSelected = selectedOccasions.includes(occasion.value);
              const occasionData = formData.occasions?.find(o => o.type === occasion.value);

              return (
                <div key={occasion.value} className="border border-gray-200 rounded-xl p-3 hover:border-purple-200 transition-colors">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`occasion-${occasion.value}`}
                      checked={isSelected}
                      onChange={() => handleOccasionToggle(occasion.value, occasion.fixedDate)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label
                      htmlFor={`occasion-${occasion.value}`}
                      className="ml-2 text-sm font-medium text-gray-900 flex items-center cursor-pointer"
                    >
                      <span className="mr-1">{occasion.icon}</span>
                      {occasion.label}
                    </label>
                  </div>

                  {isSelected && (
                    <div className="mt-2 ml-6">
                      <input
                        type="date"
                        value={occasionData?.date || ''}
                        onChange={(e) => handleOccasionDateChange(occasion.value, e.target.value)}
                        className="w-full px-2 py-1 text-xs border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Muslim Holidays</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {occasionCategories.muslim.map((occasion) => {
              const isSelected = selectedOccasions.includes(occasion.value);
              const occasionData = formData.occasions?.find(o => o.type === occasion.value);

              return (
                <div key={occasion.value} className="border border-gray-200 rounded-xl p-3 hover:border-purple-200 transition-colors">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`occasion-${occasion.value}`}
                      checked={isSelected}
                      onChange={() => handleOccasionToggle(occasion.value, occasion.fixedDate)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label
                      htmlFor={`occasion-${occasion.value}`}
                      className="ml-2 text-sm font-medium text-gray-900 flex items-center cursor-pointer"
                    >
                      <span className="mr-1">{occasion.icon}</span>
                      {occasion.label}
                    </label>
                  </div>

                  {isSelected && (
                    <div className="mt-2 ml-6">
                      <input
                        type="date"
                        value={occasionData?.date || ''}
                        onChange={(e) => handleOccasionDateChange(occasion.value, e.target.value)}
                        className="w-full px-2 py-1 text-xs border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Secular Holidays</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {occasionCategories.secular.map((occasion) => {
              const isSelected = selectedOccasions.includes(occasion.value);
              const occasionData = formData.occasions?.find(o => o.type === occasion.value);

              return (
                <div key={occasion.value} className="border border-gray-200 rounded-xl p-3 hover:border-purple-200 transition-colors">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`occasion-${occasion.value}`}
                      checked={isSelected}
                      onChange={() => handleOccasionToggle(occasion.value, occasion.fixedDate)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label
                      htmlFor={`occasion-${occasion.value}`}
                      className="ml-2 text-sm font-medium text-gray-900 flex items-center cursor-pointer"
                    >
                      <span className="mr-1">{occasion.icon}</span>
                      {occasion.label}
                    </label>
                  </div>

                  {isSelected && !occasion.fixedDate && (
                    <div className="mt-2 ml-6">
                      <input
                        type="date"
                        value={occasionData?.date || ''}
                        onChange={(e) => handleOccasionDateChange(occasion.value, e.target.value)}
                        className="w-full px-2 py-1 text-xs border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {errors.occasions && <p className="mt-2 text-sm text-red-500">{errors.occasions}</p>}
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
          {submitting ? 'Saving...' : contact ? 'Update Contact' : 'Add Contact'}
        </button>
      </div>
    </form>
  );
}
