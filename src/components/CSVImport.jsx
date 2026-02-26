// src/components/CSVImport.jsx
import React, { useState } from 'react';
import { Upload, Download, FileText } from 'lucide-react';
import Papa from 'papaparse';
import { validateEmail } from '../utils/helpers';
import { getErrorMessage } from '../utils/errorMessages';
import Alert from './Alert';

export default function CSVImport({ onImport, onCancel }) {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [fieldMapping, setFieldMapping] = useState({
    name: '',
    email: '',
    relationship: '',
  });
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setErrors(['Please select a CSV file']);
      return;
    }

    setFile(selectedFile);
    setErrors([]);

    Papa.parse(selectedFile, {
      complete: (results) => {
        setParsedData(results);
      },
      header: true,
      skipEmptyLines: true,
    });
  };

  const handleFieldMappingChange = (field, column) => {
    setFieldMapping(prev => ({ ...prev, [field]: column }));
  };

  const validateImport = () => {
    const newErrors = [];

    if (!fieldMapping.name) {
      newErrors.push('Please map the Name field');
    }
    if (!fieldMapping.email) {
      newErrors.push('Please map the Email field');
    }

    if (parsedData?.data) {
      const invalidEmails = parsedData.data.filter(row => {
        const email = row[fieldMapping.email];
        return email && !validateEmail(email);
      });

      if (invalidEmails.length > 0) {
        newErrors.push(`${invalidEmails.length} invalid email(s) found`);
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleImport = async () => {
    if (!validateImport()) return;

    setImporting(true);
    try {
      const contacts = parsedData.data.map(row => ({
        name: row[fieldMapping.name] || '',
        email: row[fieldMapping.email] || '',
        relationship: row[fieldMapping.relationship] || '',
      })).filter(contact => contact.name && contact.email);

      await onImport(contacts);
    } catch (error) {
      setErrors([getErrorMessage(error)]);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'Name,Email,Relationship\nJohn Doe,john@example.com,Friend\nJane Smith,jane@example.com,Family';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      {errors.length > 0 && (
        <Alert 
          type="error" 
          message={errors.join(', ')} 
          onClose={() => setErrors([])}
        />
      )}

      {/* File Upload */}
      {!parsedData && (
        <div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="mx-auto text-gray-400 mb-4" size={48} />
            <label className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 font-medium">
                Choose CSV file
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-sm text-gray-500 mt-2">or drag and drop</p>
          </div>

          <button
            onClick={downloadTemplate}
            className="mt-4 flex items-center text-sm text-blue-600 hover:text-blue-700"
          >
            <Download size={16} className="mr-2" />
            Download CSV Template
          </button>
        </div>
      )}

      {/* Field Mapping */}
      {parsedData && !importing && (
        <div>
          <div className="flex items-center mb-4">
            <FileText className="text-green-500 mr-2" size={20} />
            <span className="text-sm font-medium text-gray-900">
              {parsedData.data.length} rows found
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Map CSV columns to contact fields:
              </label>

              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  <span className="w-32 text-sm text-gray-700">Name <span className="text-red-500">*</span></span>
                  <select
                    value={fieldMapping.name}
                    onChange={(e) => handleFieldMappingChange('name', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Column --</option>
                    {parsedData.meta.fields?.map(field => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-4">
                  <span className="w-32 text-sm text-gray-700">Email <span className="text-red-500">*</span></span>
                  <select
                    value={fieldMapping.email}
                    onChange={(e) => handleFieldMappingChange('email', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Column --</option>
                    {parsedData.meta.fields?.map(field => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-4">
                  <span className="w-32 text-sm text-gray-700">Relationship</span>
                  <select
                    value={fieldMapping.relationship}
                    onChange={(e) => handleFieldMappingChange('relationship', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Column (Optional) --</option>
                    {parsedData.meta.fields?.map(field => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-auto">
              <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Relationship</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.data.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="border-t border-gray-200">
                      <td className="px-3 py-2">{row[fieldMapping.name] || '-'}</td>
                      <td className="px-3 py-2">{row[fieldMapping.email] || '-'}</td>
                      <td className="px-3 py-2">{row[fieldMapping.relationship] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
          disabled={importing}
        >
          Cancel
        </button>
        {parsedData && (
          <button
            onClick={handleImport}
            className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            disabled={importing}
          >
            {importing ? 'Importing...' : `Import ${parsedData.data.length} Contacts`}
          </button>
        )}
      </div>
    </div>
  );
}
