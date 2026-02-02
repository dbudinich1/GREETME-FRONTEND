// Image Credits Service
// Manages image credits for greeting cards

const STORAGE_KEY = 'greetme_image_credits';

class ImageCreditsService {
  getCredits() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        return data.credits || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error reading image credits:', error);
      return 0;
    }
  }

  addCredits(amount) {
    try {
      const current = this.getCredits();
      const newTotal = current + amount;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        credits: newTotal,
        lastUpdated: new Date().toISOString()
      }));
      return newTotal;
    } catch (error) {
      console.error('Error adding image credits:', error);
      throw error;
    }
  }

  useCredit() {
    try {
      const current = this.getCredits();
      if (current <= 0) {
        return { success: false, message: 'No image credits available' };
      }
      const newTotal = current - 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        credits: newTotal,
        lastUpdated: new Date().toISOString()
      }));
      return { success: true, remaining: newTotal };
    } catch (error) {
      console.error('Error using image credit:', error);
      throw error;
    }
  }

  getCount() {
    return this.getCredits();
  }
}

export default new ImageCreditsService();
