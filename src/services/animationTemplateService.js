// Animation Template Service
// Manages reusable animated greeting templates
// ONE animation creation = MANY sends (no additional credits)

class AnimationTemplateService {
  constructor() {
    this.STORAGE_KEY = 'greetme_animation_templates';
  }

  /**
   * Get all saved templates
   */
  getTemplates() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Save a new animated greeting as a reusable template
   * This is when the animation credit is consumed
   */
  saveAsTemplate(templateData) {
    const templates = this.getTemplates();

    const newTemplate = {
      id: Date.now(),
      name: templateData.name || 'Untitled Template',
      occasionType: templateData.occasionType,
      script: templateData.script,
      voiceId: templateData.voiceId,
      photoUrl: templateData.photoUrl,
      animationStyle: templateData.animationStyle || 'default',
      createdAt: new Date().toISOString(),
      usageCount: 0, // Track how many times it's been sent
      lastUsedAt: null
    };

    templates.push(newTemplate);
    this.saveTemplates(templates);

    return newTemplate;
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(templateId) {
    const templates = this.getTemplates();
    return templates.find(t => t.id === templateId);
  }

  /**
   * Record template usage (no credit consumed)
   * Track how many times template has been reused
   */
  recordTemplateUsage(templateId, recipientName) {
    const templates = this.getTemplates();
    const template = templates.find(t => t.id === templateId);

    if (template) {
      template.usageCount = (template.usageCount || 0) + 1;
      template.lastUsedAt = new Date().toISOString();
      this.saveTemplates(templates);
    }

    return template;
  }

  /**
   * Update template content (editing)
   * This WILL consume a new animation credit
   */
  updateTemplate(templateId, updates) {
    const templates = this.getTemplates();
    const template = templates.find(t => t.id === templateId);

    if (!template) return null;

    // Check if this is a content edit (consumes credit)
    const isContentEdit =
      updates.script !== template.script ||
      updates.voiceId !== template.voiceId ||
      updates.photoUrl !== template.photoUrl ||
      updates.animationStyle !== template.animationStyle;

    // Update template
    Object.assign(template, updates, {
      updatedAt: new Date().toISOString()
    });

    this.saveTemplates(templates);

    return {
      template,
      creditConsumed: isContentEdit
    };
  }

  /**
   * Delete a template
   */
  deleteTemplate(templateId) {
    const templates = this.getTemplates();
    const filtered = templates.filter(t => t.id !== templateId);
    this.saveTemplates(filtered);
  }

  /**
   * Get templates by occasion type
   */
  getTemplatesByOccasion(occasionType) {
    const templates = this.getTemplates();
    return templates.filter(t => t.occasionType === occasionType);
  }

  /**
   * Get template usage statistics
   */
  getTemplateStats(templateId) {
    const template = this.getTemplate(templateId);
    if (!template) return null;

    return {
      name: template.name,
      occasionType: template.occasionType,
      usageCount: template.usageCount || 0,
      createdAt: template.createdAt,
      lastUsedAt: template.lastUsedAt,
      creditsSaved: Math.max(0, (template.usageCount || 0) - 1) // First use consumed credit
    };
  }

  /**
   * Get total credits saved across all templates
   */
  getTotalCreditsSaved() {
    const templates = this.getTemplates();
    return templates.reduce((total, template) => {
      return total + Math.max(0, (template.usageCount || 0) - 1);
    }, 0);
  }

  /**
   * Save templates to localStorage
   */
  saveTemplates(templates) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
  }

  /**
   * Check if content changes require new credit
   */
  isContentEdit(original, updates) {
    return (
      updates.script !== original.script ||
      updates.voiceId !== original.voiceId ||
      updates.photoUrl !== original.photoUrl ||
      updates.animationStyle !== original.animationStyle
    );
  }

  /**
   * Non-credit changes (metadata only)
   */
  isMetadataEdit(updates) {
    const metadataFields = ['name', 'occasionType'];
    const updateKeys = Object.keys(updates);
    return updateKeys.every(key => metadataFields.includes(key));
  }
}

export default new AnimationTemplateService();
