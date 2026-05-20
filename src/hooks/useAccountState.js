// src/hooks/useAccountState.js
//
// Phase 3D Batch D Slice 1 — thin React composition over useAuth() and
// sessionStorage. Reads current state at render time and returns the
// derived AccountState. No new context. No AuthContext expansion. No
// side effects.

import { useAuth } from '../context/AuthContext';
import { deriveAccountState } from '../utils/accountState';

function safeSessionGet(key) {
  try {
    return typeof window !== 'undefined' && window.sessionStorage
      ? window.sessionStorage.getItem(key)
      : null;
  } catch {
    return null;
  }
}

export function useAccountState() {
  const { user, isAuthenticated } = useAuth();
  const sessionMode = safeSessionGet('greetme_session_mode');
  return deriveAccountState({ user, isAuthenticated, sessionMode });
}
