// src/utils/safeStorage.js
// Safari private mode throws SecurityError on storage access.
// These helpers silently catch to prevent app crashes.

// localStorage
export function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
export function safeSet(key, val) { try { localStorage.setItem(key, val); } catch {} }
export function safeRemove(key) { try { localStorage.removeItem(key); } catch {} }

// sessionStorage
export function safeSessionGet(key) { try { return sessionStorage.getItem(key); } catch { return null; } }
export function safeSessionSet(key, val) { try { sessionStorage.setItem(key, val); } catch {} }
export function safeSessionRemove(key) { try { sessionStorage.removeItem(key); } catch {} }
