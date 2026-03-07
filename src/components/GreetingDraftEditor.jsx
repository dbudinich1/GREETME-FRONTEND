// src/components/GreetingDraftEditor.jsx
// Multi-page greeting draft editor with animated and slideshow page support

import { useState, useEffect } from 'react';
import { getPhotoSrc } from '../utils/getPhotoSrc';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Play, Image, Music,
  Mic, Type, Sparkles, Save, Send, X, Star, Camera
} from 'lucide-react';
import {
  PageType, CardStyle, ToneOptions,
  createAnimatedPage, createSlideshowPage, validateDraft
} from '../models/greetingDraft';
import draftService from '../services/draftService';
import Alert from './Alert';
import { normalizeOccasionKey } from '../utils/normalizeOccasionKey';

export default function GreetingDraftEditor({
  contactId,
  occasionType,
  contact,
  userProfile,
  onSave,
  onCancel,
  onSend
}) {
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);

  // Load or create draft on mount
  useEffect(() => {
    const existingDraft = draftService.getOrCreateDraft(contactId, occasionType, {
      pages: [createAnimatedPage({
        useDefaultVoice: true
      })]
    });
    setDraft(existingDraft);
  }, [contactId, occasionType]);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleDraftChange = (field, value) => {
    setDraft(prev => ({
      ...prev,
      [field]: value,
      lastEditedAt: new Date().toISOString()
    }));
  };

  const addPage = (pageType) => {
    const newPage = pageType === PageType.ANIMATED
      ? createAnimatedPage({ useDefaultVoice: true })
      : createSlideshowPage();

    setDraft(prev => ({
      ...prev,
      pages: [...prev.pages, newPage],
      lastEditedAt: new Date().toISOString()
    }));

    setSelectedPageIndex(draft.pages.length);
  };

  const updatePage = (pageIndex, updates) => {
    setDraft(prev => ({
      ...prev,
      pages: prev.pages.map((page, idx) =>
        idx === pageIndex ? { ...page, ...updates } : page
      ),
      lastEditedAt: new Date().toISOString()
    }));
  };

  const deletePage = (pageIndex) => {
    if (draft.pages.length === 1) {
      showAlert('error', 'Cannot delete the last page. At least one page is required.');
      return;
    }

    setDraft(prev => ({
      ...prev,
      pages: prev.pages.filter((_, idx) => idx !== pageIndex),
      lastEditedAt: new Date().toISOString()
    }));

    if (selectedPageIndex >= pageIndex && selectedPageIndex > 0) {
      setSelectedPageIndex(selectedPageIndex - 1);
    }
  };

  const movePage = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= draft.pages.length) return;

    const newPages = [...draft.pages];
    const [movedPage] = newPages.splice(fromIndex, 1);
    newPages.splice(toIndex, 0, movedPage);

    setDraft(prev => ({
      ...prev,
      pages: newPages,
      lastEditedAt: new Date().toISOString()
    }));

    setSelectedPageIndex(toIndex);
  };

  // Generate seed script for D-ID animation when user leaves scriptText empty
  const generateSeedScript = (occasionKey, recipientName, sentiment) => {
    const name = recipientName?.trim() || 'Friend';
    const occ = normalizeOccasionKey(occasionKey) || String(occasionKey || '').toLowerCase().trim();

    // Base line by occasion (using normalized key)
    let base;
    if (occ === 'birthday') {
      base = `Hi ${name}. Happy Birthday. I'm thinking of you and sending love.`;
    } else if (occ === 'anniversary') {
      base = `Hi ${name}. Happy Anniversary. I'm thinking of you and sending love.`;
    } else if (occ === 'congrats' || occ === 'graduation' || occ === 'wedding') {
      base = `Hi ${name}. Congratulations. I'm so proud of you and happy for you.`;
    } else if (occ === 'thankyou') {
      base = `Hi ${name}. Thank you so much. I really appreciate you.`;
    } else if (occ === 'getwell' || occ === 'get_well') {
      base = `Hi ${name}. I heard you're not feeling well. I'm thinking of you and wishing you a speedy recovery.`;
    } else if (occ.includes('just') || occ.includes('because')) {
      base = `Hi ${name}. Just because—thinking of you today.`;
    } else {
      base = `Hi ${name}. Thinking of you and sending warm wishes.`;
    }

    // Append personal sentiment if provided
    const trimmedSentiment = sentiment?.trim();
    if (trimmedSentiment) {
      return `${base} ${trimmedSentiment}`;
    }
    return base;
  };

  // Ensure all animated pages have scriptText before validation
  const ensureAnimatedScripts = () => {
    const sentiment = draft.personalSentiment || draft.customMessage || '';
    let updated = false;

    const updatedPages = draft.pages.map(page => {
      if (page.type === PageType.ANIMATED && !page.scriptText?.trim()) {
        updated = true;
        return {
          ...page,
          scriptText: generateSeedScript(draft.occasionType, contact?.name, sentiment)
        };
      }
      return page;
    });

    if (updated) {
      setDraft(prev => ({ ...prev, pages: updatedPages }));
      return { ...draft, pages: updatedPages };
    }
    return draft;
  };

  const handleSave = async () => {
    const preparedDraft = ensureAnimatedScripts();
    const validation = validateDraft(preparedDraft);
    if (!validation.valid) {
      setErrors({ validation: validation.errors.join(', ') });
      showAlert('error', 'Please fix validation errors before saving');
      return;
    }

    try {
      setSaving(true);
      const savedDraft = draftService.saveDraft(preparedDraft);
      showAlert('success', 'Draft saved successfully');
      if (onSave) onSave(savedDraft);
    } catch (error) {
      showAlert('error', 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    const preparedDraft = ensureAnimatedScripts();
    const validation = validateDraft(preparedDraft);
    if (!validation.valid) {
      setErrors({ validation: validation.errors.join(', ') });
      showAlert('error', 'Please fix validation errors before sending');
      return;
    }

    // Save draft before sending
    draftService.saveDraft(preparedDraft);

    if (onSend) onSend(preparedDraft);
  };

  const addPhotoToSlideshowPage = (pageIndex, photoUrl, photoSource) => {
    const page = draft.pages[pageIndex];
    if (page.type !== PageType.SLIDESHOW) return;

    const newPhotos = [...(page.photos || []), { url: photoUrl, source: photoSource }];
    updatePage(pageIndex, { photos: newPhotos });
  };

  const removePhotoFromSlideshowPage = (pageIndex, photoIndex) => {
    const page = draft.pages[pageIndex];
    if (page.type !== PageType.SLIDESHOW) return;

    const newPhotos = page.photos.filter((_, idx) => idx !== photoIndex);
    updatePage(pageIndex, { photos: newPhotos });
  };

  if (!draft) {
    return <div className="text-center py-8">Loading draft...</div>;
  }

  const selectedPage = draft.pages[selectedPageIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <Sparkles className="text-purple-600" size={28} />
            <span>Greeting Card Editor</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Create a multi-page greeting for {contact?.name || 'this contact'}
          </p>
        </div>
      </div>

      {alert && (
        <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
      )}

      {errors.validation && (
        <Alert type="error" message={errors.validation} onClose={() => setErrors({})} />
      )}

      {/* Card Settings */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Card Settings</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Card Style</label>
            <select
              value={draft.cardStyle}
              onChange={(e) => handleDraftChange('cardStyle', e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
            >
              {Object.entries(CardStyle).map(([key, value]) => (
                <option key={value} value={value}>
                  {key.charAt(0) + key.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
            <select
              value={draft.tone}
              onChange={(e) => handleDraftChange('tone', e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
            >
              {Object.entries(ToneOptions).map(([key, value]) => (
                <option key={value} value={value}>
                  {key.charAt(0) + key.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Personal Message (Optional)
          </label>
          <textarea
            value={draft.customMessage}
            onChange={(e) => handleDraftChange('customMessage', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
            placeholder="Add a personal touch to your greeting..."
          />
        </div>
      </div>

      {/* Pages Editor */}
      <div className="grid grid-cols-3 gap-6">
        {/* Page List Sidebar */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Pages ({draft.pages.length})</h3>
            <div className="flex space-x-1">
              <button
                onClick={() => addPage(PageType.ANIMATED)}
                className="p-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                title="Add Animated Page"
              >
                <Play size={14} />
              </button>
              <button
                onClick={() => addPage(PageType.SLIDESHOW)}
                className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                title="Add Slideshow Page"
              >
                <Image size={14} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {draft.pages.map((page, index) => (
              <div
                key={page.id}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedPageIndex === index
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedPageIndex(index)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {page.type === PageType.ANIMATED ? (
                      <Play size={14} className="text-purple-600" />
                    ) : (
                      <Image size={14} className="text-blue-600" />
                    )}
                    <span className="text-xs font-medium text-gray-700">
                      Page {index + 1}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        movePage(index, index - 1);
                      }}
                      disabled={index === 0}
                      className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        movePage(index, index + 1);
                      }}
                      disabled={index === draft.pages.length - 1}
                      className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePage(index);
                      }}
                      className="p-1 hover:bg-red-100 text-red-600 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {page.type === PageType.ANIMATED ? 'Animated' : 'Slideshow'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Page Editor */}
        <div className="col-span-2 card space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Edit Page {selectedPageIndex + 1}
          </h3>

          {selectedPage.type === PageType.ANIMATED ? (
            /* Animated Page Editor */
            <div className="space-y-4">
              {/* Photo Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                  <Camera className="text-blue-600" size={16} />
                  <span>Photo</span>
                </label>
                <div className="space-y-3">
                  {/* Photo Source Options */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updatePage(selectedPageIndex, {
                        photoUrl: userProfile?.photoUrl || '',
                        photoSource: 'user_default'
                      })}
                      className={`p-3 border-2 rounded-lg text-sm font-medium transition-all ${
                        selectedPage.photoSource === 'user_default'
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Star size={14} className="text-yellow-500" fill="currentColor" />
                        <span>My Default Photo</span>
                      </div>
                    </button>
                    <button
                      onClick={() => updatePage(selectedPageIndex, {
                        photoUrl: contact?.avatar || '',
                        photoSource: 'contact_avatar'
                      })}
                      className={`p-3 border-2 rounded-lg text-sm font-medium transition-all ${
                        selectedPage.photoSource === 'contact_avatar'
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      disabled={!contact?.avatar}
                    >
                      Contact Avatar
                    </button>
                  </div>

                  {/* Contact Memory Photos Grid */}
                  {contact?.memoryPhotos?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Or choose from memory photos:</p>
                      <div className="grid grid-cols-4 gap-2">
                        {contact.memoryPhotos.map((photo, idx) => (
                          <div
                            key={idx}
                            className={`relative aspect-square rounded-lg border-2 cursor-pointer transition-all ${
                              selectedPage.photoUrl === photo
                                ? 'border-purple-500 ring-2 ring-purple-200'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => updatePage(selectedPageIndex, {
                              photoUrl: photo,
                              photoSource: 'contact_memory'
                            })}
                          >
                            <img
                              src={getPhotoSrc(photo)}
                              alt={`Memory ${idx + 1}`}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Voice Selection */}
              <div>
                <label className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedPage.useDefaultVoice}
                    onChange={(e) => updatePage(selectedPageIndex, {
                      useDefaultVoice: e.target.checked
                    })}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <Mic className="text-purple-600" size={16} />
                  <span className="text-sm font-medium text-gray-700">Use My Default Voice</span>
                </label>
              </div>

              {/* Script Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                  <Type className="text-gray-600" size={16} />
                  <span>Script / Message</span>
                </label>
                <textarea
                  value={selectedPage.scriptText}
                  onChange={(e) => updatePage(selectedPageIndex, {
                    scriptText: e.target.value
                  })}
                  rows={4}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter the message that will be spoken with this photo..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  AI will generate this if left blank, based on your relationship and occasion
                </p>
              </div>
            </div>
          ) : (
            /* Slideshow Page Editor */
            <div className="space-y-4">
              {/* Photos Grid */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                  <Image className="text-blue-600" size={16} />
                  <span>Photos ({selectedPage.photos?.length || 0})</span>
                </label>

                {selectedPage.photos?.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {selectedPage.photos.map((photo, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg border-2 border-gray-200 group">
                        <img
                          src={photo.url}
                          alt={`Slide ${idx + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removePhotoFromSlideshowPage(selectedPageIndex, idx)}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Photos from Contact Memories */}
                {contact?.memoryPhotos?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">Add from memory photos:</p>
                    <div className="grid grid-cols-6 gap-2">
                      {contact.memoryPhotos.map((photo, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-square rounded-lg border-2 border-gray-200 cursor-pointer hover:border-blue-400 transition-all"
                          onClick={() => addPhotoToSlideshowPage(selectedPageIndex, photo, 'contact_memory')}
                        >
                          <img
                            src={getPhotoSrc(photo)}
                            alt={`Memory ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                            <Plus className="text-white opacity-0 hover:opacity-100" size={20} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Music Track */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                  <Music className="text-green-600" size={16} />
                  <span>Background Music</span>
                </label>
                <select
                  value={selectedPage.musicTrack || ''}
                  onChange={(e) => updatePage(selectedPageIndex, {
                    musicTrack: e.target.value
                  })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No music</option>
                  <option value="upbeat">Upbeat & Happy</option>
                  <option value="calm">Calm & Peaceful</option>
                  <option value="romantic">Romantic</option>
                  <option value="celebration">Celebration</option>
                </select>
              </div>

              {/* Transition Style */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Transition Style</label>
                <select
                  value={selectedPage.transitionStyle}
                  onChange={(e) => updatePage(selectedPageIndex, {
                    transitionStyle: e.target.value
                  })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                >
                  <option value="fade">Fade</option>
                  <option value="slide">Slide</option>
                  <option value="zoom">Zoom</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          onClick={onCancel}
          className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 font-medium transition-all flex items-center space-x-2"
        >
          <Save size={18} />
          <span>{saving ? 'Saving...' : 'Save Draft'}</span>
        </button>
        <button
          onClick={handleSend}
          className="btn-primary px-8 py-3 font-semibold flex items-center space-x-2"
        >
          <Send size={18} />
          <span>Send Greeting</span>
        </button>
      </div>
    </div>
  );
}
