// src/services/cartService.js
const CART_KEY = 'greetme_cart';

class CartService {
  getCart() {
    try {
      const stored = localStorage.getItem(CART_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading cart:', error);
      return [];
    }
  }

  addItem(item) {
    try {
      const cart = this.getCart();
      const newItem = {
        ...item,
        id: Date.now(),
        addedAt: new Date().toISOString()
      };
      cart.push(newItem);
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      return newItem;
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  }

  removeItem(itemId) {
    try {
      const cart = this.getCart().filter(i => i.id !== itemId);
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      return cart;
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  }

  updateItem(itemId, updates) {
    try {
      const cart = this.getCart().map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      );
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      return cart;
    } catch (error) {
      console.error('Error updating cart item:', error);
      throw error;
    }
  }

  getTotal() {
    return this.getCart().reduce((sum, item) => {
      const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
      return sum + price;
    }, 0);
  }

  getCount() {
    return this.getCart().length;
  }

  clear() {
    try {
      localStorage.removeItem(CART_KEY);
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  }

  hasItem(giftId) {
    return this.getCart().some(item => item.giftId === giftId);
  }
}

export default new CartService();
