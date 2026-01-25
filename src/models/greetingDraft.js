// src/models/greetingDraft.js
// Multi-page greeting draft data model with relationship-scoped media support

/**
 * Page Types for Multi-Page Greeting Cards
 */
export const PageType = {
  ANIMATED: 'animated',  // Single photo + voice + script text
  SLIDESHOW: 'slideshow' // Multiple photos + music track
};

/**
 * Card Style Options
 */
export const CardStyle = {
  CLASSIC: 'classic',
  MODERN: 'modern',
  ELEGANT: 'elegant',
  PLAYFUL: 'playful',
  MINIMALIST: 'minimalist'
};

/**
 * Tone Options for AI-generated content
 */
export const ToneOptions = {
  WARM: 'warm',
  FUNNY: 'funny',
  HEARTFELT: 'heartfelt',
  PROFESSIONAL: 'professional',
  CASUAL: 'casual'
};

/**
 * Create a new animated page
 * @param {Object} options - Page configuration
 * @returns {Object} Animated page object
 */
export const createAnimatedPage = ({
  photoUrl = null,        // Photo URL (from contact memory album or user default)
  photoSource = null,     // 'contact_avatar', 'contact_memory', 'user_default', 'contact_cover'
  voiceId = null,         // Voice ID (user default or custom)
  scriptText = '',        // AI-generated or custom script
  useDefaultVoice = true, // Whether to use user's default voice
  duration = 10           // Duration in seconds
} = {}) => ({
  type: PageType.ANIMATED,
  photoUrl,
  photoSource,
  voiceId,
  scriptText,
  useDefaultVoice,
  duration,
  id: generatePageId()
});

/**
 * Create a new slideshow page
 * @param {Object} options - Page configuration
 * @returns {Object} Slideshow page object
 */
export const createSlideshowPage = ({
  photos = [],           // Array of {url, source} objects from contact memory photos
  musicTrack = null,     // Music track URL or ID
  transitionStyle = 'fade', // 'fade', 'slide', 'zoom'
  duration = 20          // Duration in seconds
} = {}) => ({
  type: PageType.SLIDESHOW,
  photos,
  musicTrack,
  transitionStyle,
  duration,
  id: generatePageId()
});

/**
 * Create a new greeting draft
 * @param {Object} options - Draft configuration
 * @returns {Object} Greeting draft object
 */
export const createGreetingDraft = ({
  contactId,
  occasionType,
  // Card-level properties
  cardStyle = CardStyle.CLASSIC,
  tone = ToneOptions.WARM,

  // Pages stack (multi-page support)
  pages = [],

  // Media defaults
  useContactAvatar = true,
  useContactMemories = true,
  useUserDefaultVoice = true,
  useUserDefaultPhoto = false,

  // Gift configuration (optional)
  includeGift = false,
  giftType = null,        // 'physical', 'digital_cash', 'marketplace'
  giftDetails = null,

  // Metadata
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString(),
  lastEditedAt = new Date().toISOString(),

  // Send configuration
  scheduledSendDate = null,
  autoSend = true,

  // Custom message/sentiment
  customMessage = '',
  personalSentiment = ''
} = {}) => ({
  // Identity
  id: generateDraftId(contactId, occasionType),
  contactId,
  occasionType,

  // Card configuration
  cardStyle,
  tone,

  // Multi-page content
  pages,

  // Media preferences
  useContactAvatar,
  useContactMemories,
  useUserDefaultVoice,
  useUserDefaultPhoto,

  // Gift addon
  includeGift,
  giftType,
  giftDetails,

  // Timestamps
  createdAt,
  updatedAt,
  lastEditedAt,

  // Send settings
  scheduledSendDate,
  autoSend,

  // Custom content
  customMessage,
  personalSentiment,

  // Status
  status: 'draft' // 'draft', 'scheduled', 'sent'
});

/**
 * Generate a unique draft ID based on contact and occasion
 * This ensures one draft per contact-occasion pair
 */
export const generateDraftId = (contactId, occasionType) => {
  return `draft_${contactId}_${occasionType}`;
};

/**
 * Generate a unique page ID
 */
export const generatePageId = () => {
  return `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate a greeting draft
 * @param {Object} draft - Draft to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateDraft = (draft) => {
  const errors = [];

  if (!draft.contactId) {
    errors.push('Contact ID is required');
  }

  if (!draft.occasionType) {
    errors.push('Occasion type is required');
  }

  if (!draft.pages || draft.pages.length === 0) {
    errors.push('At least one page is required');
  }

  // Validate each page
  draft.pages?.forEach((page, index) => {
    if (page.type === PageType.ANIMATED) {
      if (!page.photoUrl && !draft.useUserDefaultPhoto) {
        errors.push(`Page ${index + 1}: Photo is required for animated page`);
      }
      if (!page.scriptText) {
        errors.push(`Page ${index + 1}: Script text is required for animated page`);
      }
    } else if (page.type === PageType.SLIDESHOW) {
      if (!page.photos || page.photos.length === 0) {
        errors.push(`Page ${index + 1}: At least one photo is required for slideshow page`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Convert legacy single-page greeting to multi-page draft
 * Provides backward compatibility
 * @param {Object} legacyGreeting - Old greeting format
 * @returns {Object} Multi-page draft
 */
export const convertLegacyGreeting = (legacyGreeting) => {
  const animatedPage = createAnimatedPage({
    photoUrl: legacyGreeting.photoUrl,
    photoSource: 'user_default',
    voiceId: legacyGreeting.voiceId,
    scriptText: legacyGreeting.greetingText || legacyGreeting.personalSentiment || '',
    useDefaultVoice: true
  });

  return createGreetingDraft({
    contactId: legacyGreeting.contactId || legacyGreeting.recipientEmail,
    occasionType: legacyGreeting.occasionKey || 'birthday',
    pages: [animatedPage],
    customMessage: legacyGreeting.greetingText || '',
    personalSentiment: legacyGreeting.personalSentiment || '',
    scheduledSendDate: legacyGreeting.scheduledSendDate
  });
};

/**
 * Convert multi-page draft to send-ready format
 * This is called when user clicks Send
 * @param {Object} draft - Multi-page draft
 * @param {Object} contact - Contact object with memory photos
 * @param {Object} userProfile - User profile with default media
 * @returns {Object} Send-ready greeting data
 */
export const convertDraftToSendFormat = (draft, contact, userProfile) => {
  // For backward compatibility, if single animated page, convert to legacy format
  if (draft.pages.length === 1 && draft.pages[0].type === PageType.ANIMATED) {
    const page = draft.pages[0];
    return {
      userId: userProfile?.id || userProfile?.email || '',
      recipientName: contact.name,
      recipientEmail: contact.email,
      greetingText: page.scriptText || draft.customMessage || '',
      voiceId: page.useDefaultVoice ? (userProfile?.voiceId || '') : (page.voiceId || ''),
      photoUrl: page.photoUrl || userProfile?.photoUrl || '',
      occasionKey: draft.occasionType,
      relationshipKey: contact.relationship || 'friend',
      relationshipNote: contact.relationshipContext || '',
      personalSentiment: draft.personalSentiment || draft.customMessage || '',
      photos: (contact.memoryPhotos || []).map(p => typeof p === 'string' ? p : p?.url).filter(Boolean),

      // New fields for multi-page support
      cardStyle: draft.cardStyle,
      tone: draft.tone,
      includeGift: draft.includeGift,
      giftType: draft.giftType,
      giftDetails: draft.giftDetails
    };
  }

  // Multi-page format (for future API support)
  return {
    userId: userProfile?.id || userProfile?.email || '',
    recipientName: contact.name,
    recipientEmail: contact.email,
    occasionKey: draft.occasionType,
    relationshipKey: contact.relationship || 'friend',
    relationshipNote: contact.relationshipContext || '',

    // Multi-page content
    cardStyle: draft.cardStyle,
    tone: draft.tone,
    pages: draft.pages,

    // Gift configuration
    includeGift: draft.includeGift,
    giftType: draft.giftType,
    giftDetails: draft.giftDetails,

    // Custom content
    customMessage: draft.customMessage,
    personalSentiment: draft.personalSentiment,
    photos: (contact.memoryPhotos || []).map(p => typeof p === 'string' ? p : p?.url).filter(Boolean)
  };
};

export default {
  PageType,
  CardStyle,
  ToneOptions,
  createAnimatedPage,
  createSlideshowPage,
  createGreetingDraft,
  generateDraftId,
  generatePageId,
  validateDraft,
  convertLegacyGreeting,
  convertDraftToSendFormat
};
