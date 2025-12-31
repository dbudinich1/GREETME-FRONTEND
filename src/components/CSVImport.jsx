// components/CSVImport.jsx
// CSV import component with field mapping and preview

import React, { useState, useRef } from 'react';

export const CSVImport = ({ onClose, onImportComplete }) => {
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [fieldMapping, setFieldMapping] = useState({
    name: '',
    email: '',
    relationship: '',
  });
  const [errors, setErrors] = useState([]);
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Preview
  const fileInputRef = useRef(null);

  const sampleCSV = `name,email,relationship
John Doe,john@example.com,Friend
Jane Smith,jane@example.com,Family
Bob Johnson,bob@example.com,Colleague`;

  const downloadSampleCSV = () => {
    const blob = new Blob([sampleCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index] || '';
        return obj;
      }, {});
    });
    return { headers, rows };
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setErrors(['Please upload a CSV file']);
      return;
    }

    setFile(selectedFile);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const { headers, rows } = parseCSV(event.target.result);
        setCsvData({ headers, rows });
        
        // Auto-detect common column names
        const autoMapping = {};
        headers.forEach(header => {
          const lower = header.toLowerCase();
          if (lower.includes('name')) autoMapping.name = header;
          if (lower.includes('email') || lower.includes('mail')) autoMapping.email = header;
          if (lower.includes('relationship') || lower.includes('relation')) autoMapping.relationship = header;
        });
        setFieldMapping(autoMapping);
        
        setStep(2);
      } catch (error) {
        setErrors(['Failed to parse CSV file. Please check the format.']);
      }
    };
    reader.readAsText(selectedFile);
  };

  const validateMapping = () => {
    const newErrors = [];
    
    if (!fieldMapping.name) {
      newErrors.push('Name field is required');
    }
    if (!fieldMapping.email) {
      newErrors.push('Email field is required');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handlePreview = () => {
    if (validateMapping()) {
      setStep(3);
    }
  };

  const validateContacts = () => {
    const newErrors = [];
    const contacts = csvData.rows.map((row, index) => {
      const contact = {
        name: row[fieldMapping.name] || '',
        email: row[fieldMapping.email] || '',
        relationship: row[fieldMapping.relationship] || '',
      };

      if (!contact.name) {
        newErrors.push(`Row ${index + 2}: Name is required`);
      }
      if (!contact.email) {
        newErrors.push(`Row ${index + 2}: Email is required`);
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        newErrors.push(`Row ${index + 2}: Invalid email format (${contact.email})`);
      }

      return contact;
    });

    setErrors(newErrors);
    return { contacts, valid: newErrors.length === 0 };
  };

  const handleImport = () => {
    const { contacts, valid } = validateContacts();
    
    if (valid) {
      onImportComplete(contacts);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 max-w-4xl w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Import Contacts from CSV</h2>
            <p className="text-gray-600 mt-1">
              Step {step} of 3: {step === 1 ? 'Upload' : step === 2 ? 'Map Fields' : 'Preview & Import'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error messages */}
        {errors.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-red-900 mb-2">
              {errors.length} {errors.length === 1 ? 'Error' : 'Errors'} Found:
            </h4>
            <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
              {errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-6">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition-all"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {file ? file.name : 'Click to upload CSV file'}
              </h3>
              <p className="text-gray-600 mb-4">
                or drag and drop your file here
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">CSV Format Requirements</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• First row must contain column headers</li>
                    <li>• Required columns: name, email</li>
                    <li>• Optional columns: relationship</li>
                  </ul>
                  <button
                    onClick={downloadSampleCSV}
                    className="mt-3 text-sm font-medium text-blue-700 hover:text-blue-800 underline"
                  >
                    Download sample CSV template
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Map Fields */}
        {step === 2 && csvData && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-800">
                Found <strong>{csvData.rows.length}</strong> contacts in your CSV.
                Please map the CSV columns to contact fields.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name Column *
                </label>
                <select
                  value={fieldMapping.name}
                  onChange={(e) => setFieldMapping(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">-- Select Column --</option>
                  {csvData.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Column *
                </label>
                <select
                  value={fieldMapping.email}
                  onChange={(e) => setFieldMapping(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">-- Select Column --</option>
                  {csvData.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relationship Column (Optional)
                </label>
                <select
                  value={fieldMapping.relationship}
                  onChange={(e) => setFieldMapping(prev => ({ ...prev, relationship: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">-- Select Column --</option>
                  {csvData.headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && csvData && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-800">
                Preview of <strong>{csvData.rows.length}</strong> contacts to be imported
              </p>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Relationship</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {csvData.rows.slice(0, 50).map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{row[fieldMapping.name]}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row[fieldMapping.email]}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row[fieldMapping.relationship] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvData.rows.length > 50 && (
                <div className="p-3 bg-gray-50 text-center text-sm text-gray-600">
                  Showing first 50 of {csvData.rows.length} contacts
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
            >
              Back
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          {step < 3 ? (
            <button
              onClick={() => step === 1 ? null : handlePreview()}
              disabled={step === 1 || !csvData}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleImport}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Import {csvData.rows.length} Contacts
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
