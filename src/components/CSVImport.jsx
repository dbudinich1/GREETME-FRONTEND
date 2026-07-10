// src/components/CSVImport.jsx
import React, { useState, useEffect } from 'react';
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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Responsive layout (matches the app's single-breakpoint convention)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // ---- Inline style tokens (premium, matches app conventions) ----
  const selectStyle = {
    flex: 1,
    width: isMobile ? '100%' : 'auto',
    padding: '10px 12px',
    border: '1px solid #d8dbe3',
    borderRadius: '10px',
    fontSize: '0.875rem',
    color: '#111827',
    background: '#ffffff',
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };
  const focusRing = (e) => {
    e.currentTarget.style.borderColor = '#667eea';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.15)';
  };
  const blurRing = (e) => {
    e.currentTarget.style.borderColor = '#d8dbe3';
    e.currentTarget.style.boxShadow = 'none';
  };
  const mapRowLabel = {
    width: isMobile ? 'auto' : '8rem',
    flexShrink: 0,
    fontSize: '0.875rem',
    color: '#374151',
    fontWeight: 500,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
          {/* Premium upload surface */}
          <div style={{
            border: '2px dashed rgba(102, 126, 234, 0.35)',
            borderRadius: '18px',
            padding: isMobile ? '2rem 1.25rem' : '2.75rem 2rem',
            textAlign: 'center',
            background: 'linear-gradient(180deg, #fbfaff 0%, #f3f1fc 100%)',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.125rem',
              boxShadow: '0 10px 24px rgba(102, 126, 234, 0.32)',
            }}>
              <Upload size={28} color="#ffffff" />
            </div>
            <label style={{ cursor: 'pointer', display: 'inline-block' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '11px 24px',
                  background: '#ffffff',
                  color: '#667eea',
                  border: '1px solid rgba(102, 126, 234, 0.45)',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.16)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f3ff';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.24)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.16)';
                }}
              >
                Choose CSV file
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.875rem', margin: '0.875rem 0 0 0' }}>
              or drag and drop
            </p>
          </div>

          {/* Tertiary action — visually subordinate */}
          <button
            onClick={downloadTemplate}
            style={{
              marginTop: '1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: '#667eea',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 4px',
              fontFamily: 'inherit',
            }}
          >
            <Download size={16} />
            Download CSV Template
          </button>
        </div>
      )}

      {/* Field Mapping */}
      {parsedData && !importing && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <FileText size={20} color="#10b981" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
              {parsedData.data.length} rows found
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>
                Map CSV columns to contact fields:
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Name */}
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: isMobile ? '6px' : '16px',
                }}>
                  <span style={mapRowLabel}>Name <span style={{ color: '#ef4444' }}>*</span></span>
                  <select
                    value={fieldMapping.name}
                    onChange={(e) => handleFieldMappingChange('name', e.target.value)}
                    onFocus={focusRing}
                    onBlur={blurRing}
                    style={selectStyle}
                  >
                    <option value="">-- Select Column --</option>
                    {parsedData.meta.fields?.map(field => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </div>

                {/* Email */}
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: isMobile ? '6px' : '16px',
                }}>
                  <span style={mapRowLabel}>Email <span style={{ color: '#ef4444' }}>*</span></span>
                  <select
                    value={fieldMapping.email}
                    onChange={(e) => handleFieldMappingChange('email', e.target.value)}
                    onFocus={focusRing}
                    onBlur={blurRing}
                    style={selectStyle}
                  >
                    <option value="">-- Select Column --</option>
                    {parsedData.meta.fields?.map(field => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </div>

                {/* Relationship */}
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: isMobile ? '6px' : '16px',
                }}>
                  <span style={mapRowLabel}>Relationship</span>
                  <select
                    value={fieldMapping.relationship}
                    onChange={(e) => handleFieldMappingChange('relationship', e.target.value)}
                    onFocus={focusRing}
                    onBlur={blurRing}
                    style={selectStyle}
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
            <div style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #faf9fc 100%)',
              border: '1px solid rgba(15, 23, 42, 0.06)',
              borderRadius: '14px',
              padding: '1rem',
              maxHeight: '16rem',
              overflow: 'auto',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            }}>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', margin: '0 0 0.75rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Preview
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #eceef3', whiteSpace: 'nowrap' }}>Name</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #eceef3', whiteSpace: 'nowrap' }}>Email</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #eceef3', whiteSpace: 'nowrap' }}>Relationship</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.data.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '8px 12px', color: '#111827', borderTop: '1px solid #f1f2f6' }}>{row[fieldMapping.name] || '-'}</td>
                        <td style={{ padding: '8px 12px', color: '#111827', borderTop: '1px solid #f1f2f6' }}>{row[fieldMapping.email] || '-'}</td>
                        <td style={{ padding: '8px 12px', color: '#111827', borderTop: '1px solid #f1f2f6' }}>{row[fieldMapping.relationship] || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions — clear hierarchy: Import (primary) vs Cancel (neutral) */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        paddingTop: '1.25rem',
        borderTop: '1px solid #eceef3',
      }}>
        <button
          onClick={onCancel}
          disabled={importing}
          style={{
            padding: '11px 24px',
            color: '#374151',
            background: '#f3f4f6',
            border: '1px solid transparent',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: importing ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: importing ? 0.6 : 1,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { if (!importing) e.currentTarget.style.background = '#e5e7eb'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
        >
          Cancel
        </button>
        {parsedData && (
          <button
            onClick={handleImport}
            disabled={importing}
            style={{
              padding: '11px 24px',
              color: '#ffffff',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '12px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: importing ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: importing ? 0.5 : 1,
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.28)',
              transition: 'box-shadow 0.15s, transform 0.15s',
            }}
            onMouseEnter={(e) => { if (!importing) { e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.38)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.28)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {importing ? 'Importing...' : `Import ${parsedData.data.length} Contacts`}
          </button>
        )}
      </div>
    </div>
  );
}
