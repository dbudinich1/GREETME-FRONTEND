// src/services/draftService.js
// Local-first draft persistence using localStorage

import { createGreetingDraft, generateDraftId, validateDraft } from '../models/greetingDraft';

const STORAGE_KEY = 'greetme_drafts';

/**
 * Draft Service - Manages greeting draft persistence
 * Uses localStorage for local-first development
 */
class DraftService {
  /**
   * Get all drafts from localStorage
   * @returns {Object} Map of draftId -> draft
   */
  getAllDrafts() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to load drafts from localStorage:', error);
      return {};
    }
  }

  /**
   * Get a specific draft by contact and occasion
   * @param {string} contactId - Contact ID
   * @param {string} occasionType - Occasion type
   * @returns {Object|null} Draft or null if not found
   */
  getDraft(contactId, occasionType) {
    const draftId = generateDraftId(contactId, occasionType);
    const drafts = this.getAllDrafts();
    return drafts[draftId] || null;
  }

  /**
   * Get all drafts for a specific contact
   * @param {string} contactId - Contact ID
   * @returns {Array} Array of drafts
   */
  getDraftsByContact(contactId) {
    const drafts = this.getAllDrafts();
    return Object.values(drafts).filter(draft => draft.contactId === contactId);
  }

  /**
   * Get drafts by occasion type
   * @param {string} occasionType - Occasion type
   * @returns {Array} Array of drafts
   */
  getDraftsByOccasion(occasionType) {
    const drafts = this.getAllDrafts();
    return Object.values(drafts).filter(draft => draft.occasionType === occasionType);
  }

  /**
   * Get drafts that need to be sent (scheduled for today or past)
   * @returns {Array} Array of drafts ready to send
   */
  getDraftsReadyToSend() {
    const drafts = this.getAllDrafts();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Object.values(drafts).filter(draft => {
      if (!draft.scheduledSendDate || !draft.autoSend) return false;
      const sendDate = new Date(draft.scheduledSendDate);
      sendDate.setHours(0, 0, 0, 0);
      return sendDate <= today && draft.status === 'draft';
    });
  }

  /**
   * Save or update a draft
   * @param {Object} draft - Draft to save
   * @returns {Object} Saved draft with updated timestamp
   */
  saveDraft(draft) {
    const drafts = this.getAllDrafts();
    const draftId = draft.id || generateDraftId(draft.contactId, draft.occasionType);

    const updatedDraft = {
      ...draft,
      id: draftId,
      updatedAt: new Date().toISOString(),
      lastEditedAt: new Date().toISOString()
    };

    drafts[draftId] = updatedDraft;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
      return updatedDraft;
    } catch (error) {
      console.error('Failed to save draft to localStorage:', error);
      throw new Error('Failed to save draft');
    }
  }

  /**
   * Create a new draft
   * @param {Object} draftData - Initial draft data
   * @returns {Object} Created draft
   */
  createDraft(draftData) {
    const draft = createGreetingDraft(draftData);
    return this.saveDraft(draft);
  }

  /**
   * Update an existing draft
   * @param {string} contactId - Contact ID
   * @param {string} occasionType - Occasion type
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated draft
   */
  updateDraft(contactId, occasionType, updates) {
    const existingDraft = this.getDraft(contactId, occasionType);
    if (!existingDraft) {
      throw new Error('Draft not found');
    }

    const updatedDraft = {
      ...existingDraft,
      ...updates,
      id: existingDraft.id, // Preserve ID
      contactId: existingDraft.contactId, // Preserve contact
      occasionType: existingDraft.occasionType, // Preserve occasion
      createdAt: existingDraft.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString(),
      lastEditedAt: new Date().toISOString()
    };

    return this.saveDraft(updatedDraft);
  }

  /**
   * Delete a draft
   * @param {string} contactId - Contact ID
   * @param {string} occasionType - Occasion type
   * @returns {boolean} True if deleted
   */
  deleteDraft(contactId, occasionType) {
    const draftId = generateDraftId(contactId, occasionType);
    const drafts = this.getAllDrafts();

    if (!drafts[draftId]) {
      return false;
    }

    delete drafts[draftId];

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
      return true;
    } catch (error) {
      console.error('Failed to delete draft from localStorage:', error);
      throw new Error('Failed to delete draft');
    }
  }

  /**
   * Mark a draft as sent
   * @param {string} contactId - Contact ID
   * @param {string} occasionType - Occasion type
   * @returns {Object} Updated draft
   */
  markDraftAsSent(contactId, occasionType) {
    return this.updateDraft(contactId, occasionType, {
      status: 'sent',
      sentAt: new Date().toISOString()
    });
  }

  /**
   * Mark a draft as scheduled
   * @param {string} contactId - Contact ID
   * @param {string} occasionType - Occasion type
   * @param {string} scheduledDate - ISO date string
   * @returns {Object} Updated draft
   */
  scheduleDraft(contactId, occasionType, scheduledDate) {
    return this.updateDraft(contactId, occasionType, {
      status: 'scheduled',
      scheduledSendDate: scheduledDate,
      autoSend: true
    });
  }

  /**
   * Get or create a draft
   * If draft exists, return it. Otherwise create a new one.
   * @param {string} contactId - Contact ID
   * @param {string} occasionType - Occasion type
   * @param {Object} defaultData - Default data if creating new draft
   * @returns {Object} Draft
   */
  getOrCreateDraft(contactId, occasionType, defaultData = {}) {
    const existing = this.getDraft(contactId, occasionType);
    if (existing) {
      return existing;
    }

    return this.createDraft({
      contactId,
      occasionType,
      ...defaultData
    });
  }

  /**
   * Validate a draft
   * @param {Object} draft - Draft to validate
   * @returns {Object} Validation result
   */
  validate(draft) {
    return validateDraft(draft);
  }

  /**
   * Export all drafts (for backup)
   * @returns {string} JSON string of all drafts
   */
  exportDrafts() {
    const drafts = this.getAllDrafts();
    return JSON.stringify(drafts, null, 2);
  }

  /**
   * Import drafts from JSON (for restore)
   * @param {string} jsonString - JSON string of drafts
   * @param {boolean} merge - If true, merge with existing. If false, replace.
   * @returns {number} Number of drafts imported
   */
  importDrafts(jsonString, merge = true) {
    try {
      const importedDrafts = JSON.parse(jsonString);
      const currentDrafts = merge ? this.getAllDrafts() : {};

      const merged = {
        ...currentDrafts,
        ...importedDrafts
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return Object.keys(importedDrafts).length;
    } catch (error) {
      console.error('Failed to import drafts:', error);
      throw new Error('Failed to import drafts');
    }
  }

  /**
   * Clear all drafts (use with caution)
   */
  clearAllDrafts() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Get draft statistics
   * @returns {Object} Statistics about drafts
   */
  getStatistics() {
    const drafts = Object.values(this.getAllDrafts());
    return {
      total: drafts.length,
      byStatus: {
        draft: drafts.filter(d => d.status === 'draft').length,
        scheduled: drafts.filter(d => d.status === 'scheduled').length,
        sent: drafts.filter(d => d.status === 'sent').length
      },
      readyToSend: this.getDraftsReadyToSend().length,
      withGifts: drafts.filter(d => d.includeGift).length,
      multiPage: drafts.filter(d => d.pages && d.pages.length > 1).length
    };
  }
}

// Export singleton instance
const draftService = new DraftService();
export default draftService;
