// src/components/EmptyState.jsx
import React from 'react';

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
      <p className="text-6xl mb-4">{icon}</p>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6">{description}</p>
      {action && action}
    </div>
  );
}
