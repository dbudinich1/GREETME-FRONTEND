// src/components/Alert.jsx
import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export default function Alert({ type = 'info', message, onClose }) {
  const config = {
    success: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      icon: <CheckCircle className="text-green-500" size={20} />,
    },
    error: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      icon: <XCircle className="text-red-500" size={20} />,
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      icon: <AlertCircle className="text-yellow-500" size={20} />,
    },
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      icon: <Info className="text-blue-500" size={20} />,
    },
  };

  const { bgColor, borderColor, textColor, icon } = config[type];

  return (
    <div className={`${bgColor} ${borderColor} border rounded-lg p-4 mb-4`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">{icon}</div>
        <div className={`ml-3 flex-1 ${textColor}`}>
          <p className="text-sm font-medium">{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`ml-3 ${textColor} hover:opacity-75`}
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
