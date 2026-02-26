// src/components/PhotoUpload.jsx
import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { validateFile } from '../utils/helpers';
import { getErrorMessage } from '../utils/errorMessages';
import Alert from './Alert';

export default function PhotoUpload({ onUpload, existingPhoto }) {
  const [preview, setPreview] = useState(existingPhoto || null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    const validation = validateFile(file);
    
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setSelectedFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', selectedFile);
      await onUpload(formData);
      setSelectedFile(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Upload Guidelines */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Photo Guidelines:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Use a clear, front-facing photo</li>
          <li>• Good lighting recommended</li>
          <li>• Max file size: 10MB</li>
          <li>• Formats: JPG, JPEG, PNG</li>
        </ul>
      </div>

      {/* Upload Area */}
      {!preview ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <ImageIcon className="mx-auto text-gray-400 mb-4" size={64} />
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Choose a photo
          </button>
          <p className="text-sm text-gray-500 mt-2">or drag and drop</p>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB</p>
        </div>
      ) : (
        /* Preview Area */
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="relative inline-block">
            <img
              src={preview}
              alt="Preview"
              className="w-64 h-64 object-cover rounded-lg"
            />
            {selectedFile && (
              <button
                onClick={handleRemove}
                className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {selectedFile && (
            <div className="mt-4 flex space-x-3">
              <button
                onClick={handleRemove}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center"
              >
                <Upload size={18} className="mr-2" />
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </button>
            </div>
          )}

          {!selectedFile && existingPhoto && (
            <div className="mt-4">
              <p className="text-sm text-green-600 mb-2">✓ Photo configured</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 font-medium"
              >
                Change Photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
