// src/components/ContactForm.jsx
import React, { useState, useEffect } from 'react';
import { validateEmail, occasionTypes } from '../utils/helpers';
import Alert from './Alert';

export default function ContactForm({ contact, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    relationship: '',
    occasions: [],
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        email: contact.email || '',
        relationship: contact.relationship || '',
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

  const handleOccasionToggle = (occasionValue) => {
    setFormData(prev => {
      const occasions = prev.occasions || [];
      const exists = occasions.find(o => o.type === occasionValue);
      
      if (exists) {
        return {
          ...prev,
          occasions: occasions.filter(o => o.type !== occasionValue),
        };
      } else {
        return {
          ...prev,
          occasions: [...occasions, { type: occasionValue, date: '', autoSend: true }],
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

      {/* Basic Info */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="John Doe"
        />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="john@example.com"
        />
        {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Relationship
        </label>
        <select
          name="relationship"
          value={formData.relationship}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select relationship...</option>
          <option value="family">Family</option>
          <option value="friend">Friend</option>
          <option value="colleague">Colleague</option>
          <option value="client">Client</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Occasions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Occasions
        </label>
        <div className="space-y-3">
          {occasionTypes.map((occasion) => {
            const isSelected = selectedOccasions.includes(occasion.value);
            const occasionData = formData.occasions?.find(o => o.type === occasion.value);

            return (
              <div key={occasion.value} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`occasion-${occasion.value}`}
                    checked={isSelected}
                    onChange={() => handleOccasionToggle(occasion.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor={`occasion-${occasion.value}`}
                    className="ml-3 text-sm font-medium text-gray-900 flex items-center"
                  >
                    <span className="mr-2">{occasion.icon}</span>
                    {occasion.label}
                  </label>
                </div>

                {isSelected && (
                  <div className="mt-3 ml-7">
                    <label className="block text-xs text-gray-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={occasionData?.date || ''}
                      onChange={(e) => handleOccasionDateChange(occasion.value, e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? 'Saving...' : contact ? 'Update Contact' : 'Add Contact'}
        </button>
      </div>
    </form>
  );
}
