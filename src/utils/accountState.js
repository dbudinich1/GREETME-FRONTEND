// src/utils/accountState.js
//
// Phase 3D Batch D Slice 1 — pure account-state derivation.
//
// No React. No mutations. Read-only access to localStorage is wrapped in
// try/catch for Safari private-mode safety, matching the pattern already
// used in AuthContext.jsx.
//
// Consumers in subsequent Batch D slices (D2-D6) will import the named
// gates and identity helpers from this module. Slice 1 ships with zero
// consumers and zero behavioral changes.

function safeLocalGet(key) {
  try {
    return typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(key)
      : null;
  } catch {
    return null;
  }
}

// Subscription is "active" when either Stripe reports an active/trialing
// status, or the backend has set paymentLocked. Either signal alone is
// sufficient.
function computeIsSubscribed(user) {
  if (!user) return false;
  if (user.paymentLocked === true) return true;
  return user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';
}

function computeIsPaidTier(user) {
  if (!user || !user.tier) return false;
  return user.tier !== 'free';
}

// Onboarding is considered complete when ANY of:
// - the user is subscribed (founder D5 rule: subscription wins)
// - the backend reports entitlements.profileComplete
// - both legacy onboarding flag stacks have completed
// - the GuidedSetupFlow state is dismissed/completed/satisfied
function computeIsOnboardingComplete(user, isSubscribed) {
  if (isSubscribed) return true;
  if (user?.entitlements?.profileComplete === true) return true;
  const tour = safeLocalGet('greetme_onboarding_completed') === 'true';
  const coach = safeLocalGet('greetme_onboarding_v1_completed') === 'true';
  if (tour && coach) return true;
  try {
    const raw = safeLocalGet('greetme_setup_state');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.onboardingCompleted === true || s.onboardingDismissed === true) {
        return true;
      }
      if (s.voiceDone && s.photoDone && s.firstGreetingSent) return true;
    }
  } catch {
    // ignore parse errors
  }
  return false;
}

export function deriveAccountState({ user, isAuthenticated, sessionMode } = {}) {
  const isAuthed = !!isAuthenticated;
  const isRecipientMode = sessionMode === 'recipient';
  const isSubscribed = computeIsSubscribed(user);
  return {
    userId: user?.id || null,
    isAuthenticated: isAuthed,
    isRecipientMode,
    isGuest: !isAuthed && isRecipientMode,
    isAnonymous: !isAuthed && !isRecipientMode,
    isSubscribed,
    isPaidTier: computeIsPaidTier(user),
    isOnboardingComplete: computeIsOnboardingComplete(user, isSubscribed),
  };
}

// ---- Identity helpers ----

export function isSenderViewingOwnCredit({ credit, userId } = {}) {
  return !!(userId && credit?.senderUserId && credit.senderUserId === userId);
}

export function isSenderViewingOwnGift({ gift, userId } = {}) {
  return !!(userId && gift?.senderUserId && gift.senderUserId === userId);
}

export function isSenderViewingOwnGreeting({ greeting, userId } = {}) {
  return !!(userId && greeting?.senderUserId && greeting.senderUserId === userId);
}

// ---- Gates ----

export function shouldShowFirstTimeCTA(state) {
  if (!state) return false;
  return !state.isAuthenticated && !state.isRecipientMode;
}

// Suppresses a "claim" CTA when:
// - already claimed or already consumed by server-side ledger
// - the viewer is the original sender (owner self-encounter)
// - the viewer is already subscribed AND this is not an onboarding test send
//   (onboarding test sends are part of the demo flow and must remain claimable)
export function shouldShowClaimCTA(state, credit) {
  if (!state || !credit) return false;
  if (credit.claimed === true) return false;
  if (credit.consumed === true) return false;
  if (isSenderViewingOwnCredit({ credit, userId: state.userId })) return false;
  if (state.isSubscribed && credit.isOnboardingTestSend !== true) return false;
  return true;
}

// Founder D5 rule: subscription/payment state wins. A paying user never
// re-enters onboarding even if localStorage flags are wiped.
export function shouldShowOnboarding(state) {
  if (!state) return false;
  return state.isAuthenticated && !state.isOnboardingComplete && !state.isSubscribed;
}
