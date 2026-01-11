// Animation Bank Service
// Manages animation credits for the user
// Language: "Animated Moments" not "quota" or "usage"

class AnimationBankService {
  constructor() {
    this.STORAGE_KEY = 'greetme_animation_bank';
  }

  /**
   * Get current animation bank status
   * Returns breakdown of all animation sources
   */
  getAnimationBank() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }

    // Default state for new users
    return {
      monthlyAllowance: 2, // From $19.99/year plan
      monthlyUsed: 0,
      monthlyRemaining: 2,
      purchasedPacks: 0, // Credits from purchased packs (never expire)
      holidayBonus: 0, // Temporary holiday bonuses
      earnedBonus: 0, // Milestone/retention bonuses
      totalAvailable: 2,
      lastMonthlyReset: new Date().toISOString(),
      history: [] // Track usage history
    };
  }

  /**
   * Calculate total available animations
   */
  getTotalAvailable() {
    const bank = this.getAnimationBank();
    return bank.monthlyRemaining + bank.purchasedPacks + bank.holidayBonus + bank.earnedBonus;
  }

  /**
   * Use one animation credit (for creating NEW animated content)
   * Templates reuse existing animations = NO credit consumed
   * Returns true if successful, false if insufficient credits
   */
  useAnimation(recipientName, occasionType, isTemplate = false) {
    const bank = this.getAnimationBank();
    const total = this.getTotalAvailable();

    // If using existing template, no credit consumed
    if (isTemplate) {
      bank.history.push({
        date: new Date().toISOString(),
        recipientName,
        occasionType,
        type: 'template_reuse',
        creditConsumed: false
      });
      this.saveAnimationBank(bank);
      return { success: true, remaining: bank.totalAvailable, creditUsed: false };
    }

    // Creating new animation requires credit
    if (total <= 0) {
      return { success: false, message: 'No Animated Moments available' };
    }

    // Deduct in priority order: monthly → holiday → earned → purchased
    if (bank.monthlyRemaining > 0) {
      bank.monthlyUsed++;
      bank.monthlyRemaining--;
    } else if (bank.holidayBonus > 0) {
      bank.holidayBonus--;
    } else if (bank.earnedBonus > 0) {
      bank.earnedBonus--;
    } else if (bank.purchasedPacks > 0) {
      bank.purchasedPacks--;
    }

    // Record usage
    bank.history.push({
      date: new Date().toISOString(),
      recipientName,
      occasionType,
      type: 'created_new',
      creditConsumed: true
    });

    bank.totalAvailable = this.calculateTotal(bank);
    this.saveAnimationBank(bank);

    return { success: true, remaining: bank.totalAvailable, creditUsed: true };
  }

  /**
   * Add animation pack purchase
   */
  addPurchasedPack(packSize, packName) {
    const bank = this.getAnimationBank();
    bank.purchasedPacks += packSize;
    bank.totalAvailable = this.calculateTotal(bank);

    bank.history.push({
      date: new Date().toISOString(),
      type: 'purchase',
      packName,
      amount: packSize
    });

    this.saveAnimationBank(bank);
    return bank;
  }

  /**
   * Add holiday bonus
   */
  addHolidayBonus(amount, holidayName) {
    const bank = this.getAnimationBank();
    bank.holidayBonus += amount;
    bank.totalAvailable = this.calculateTotal(bank);

    bank.history.push({
      date: new Date().toISOString(),
      type: 'holiday_bonus',
      holidayName,
      amount
    });

    this.saveAnimationBank(bank);
    return bank;
  }

  /**
   * Add earned bonus (milestones, retention, etc.)
   */
  addEarnedBonus(amount, reason) {
    const bank = this.getAnimationBank();
    bank.earnedBonus += amount;
    bank.totalAvailable = this.calculateTotal(bank);

    bank.history.push({
      date: new Date().toISOString(),
      type: 'earned_bonus',
      reason,
      amount
    });

    this.saveAnimationBank(bank);
    return bank;
  }

  /**
   * Reset monthly allowance (should run on 1st of each month)
   */
  resetMonthlyAllowance() {
    const bank = this.getAnimationBank();
    const now = new Date();
    const lastReset = new Date(bank.lastMonthlyReset);

    // Check if a month has passed
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      bank.monthlyUsed = 0;
      bank.monthlyRemaining = bank.monthlyAllowance;
      bank.lastMonthlyReset = now.toISOString();
      bank.totalAvailable = this.calculateTotal(bank);

      bank.history.push({
        date: now.toISOString(),
        type: 'monthly_reset',
        amount: bank.monthlyAllowance
      });

      this.saveAnimationBank(bank);
    }

    return bank;
  }

  /**
   * Check if user should get December holiday boost
   */
  checkHolidayBoost() {
    const now = new Date();
    const bank = this.getAnimationBank();

    // December boost: +4 animations
    if (now.getMonth() === 11) { // December is month 11
      const lastBoost = bank.history.find(h =>
        h.type === 'holiday_bonus' &&
        h.holidayName === 'December Holiday Boost' &&
        new Date(h.date).getFullYear() === now.getFullYear()
      );

      if (!lastBoost) {
        this.addHolidayBonus(4, 'December Holiday Boost');
      }
    }
  }

  /**
   * Calculate total from all sources
   */
  calculateTotal(bank) {
    return bank.monthlyRemaining + bank.purchasedPacks + bank.holidayBonus + bank.earnedBonus;
  }

  /**
   * Save animation bank to localStorage
   */
  saveAnimationBank(bank) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bank));
  }

  /**
   * Get breakdown for display
   */
  getBreakdown() {
    const bank = this.getAnimationBank();
    const breakdown = [];

    if (bank.monthlyRemaining > 0) {
      breakdown.push({
        label: 'Monthly Plan',
        amount: bank.monthlyRemaining,
        icon: '📅',
        color: '#667eea'
      });
    }

    if (bank.purchasedPacks > 0) {
      breakdown.push({
        label: 'Purchased Packs',
        amount: bank.purchasedPacks,
        icon: '🎁',
        color: '#10b981'
      });
    }

    if (bank.holidayBonus > 0) {
      breakdown.push({
        label: 'Holiday Bonus',
        amount: bank.holidayBonus,
        icon: '🎄',
        color: '#f59e0b'
      });
    }

    if (bank.earnedBonus > 0) {
      breakdown.push({
        label: 'Earned Bonuses',
        amount: bank.earnedBonus,
        icon: '⭐',
        color: '#ec4899'
      });
    }

    return {
      total: this.getTotalAvailable(),
      breakdown
    };
  }
}

export default new AnimationBankService();
