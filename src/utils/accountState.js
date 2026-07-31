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
  // Convergence: Cosmos-authoritative signal that voice + photo are persisted.
  // Derived server-side on each /api/profile fetch.
  if (user?.personalizationComplete === true) return true;
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
  const isRegisteredViaRecipientFlow = safeLocalGet('greetme_origin_recipient') === 'true';
  return {
    userId: user?.id || null,
    isAuthenticated: isAuthed,
    isRecipientMode,
    isRegisteredViaRecipientFlow,
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

// Founder-role predicate. Mirrors the backend resolveFundraiserActor gate
// exactly: user.plan === 'founder' || user.tier === 'founder'. There is no
// dedicated role field in the system; plan/tier (hydrated from /api/profile)
// is the source of truth. Null-safe — undefined user, missing plan, and
// missing tier all return false.
export function isFounder(user) {
  if (!user) return false;
  return user.plan === 'founder' || user.tier === 'founder';
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
  // Recipient-origin users should not receive sender onboarding overlays immediately after claim/thank-you flows.
  if (state.isRegisteredViaRecipientFlow) return false;
  return state.isAuthenticated && !state.isOnboardingComplete && !state.isSubscribed;
}

// Warm "already personalized" dashboard re-entry gate. Mounts WarmReentryWelcome
// for recipient-origin users who have finished personalization but haven't yet
// added their own recipients. Structurally disjoint from shouldShowOnboarding —
// both gates require opposing values of isOnboardingComplete and
// isRegisteredViaRecipientFlow, so they cannot both return true. contactsCount
// is null while the dashboard's contacts fetch is in flight; the gate returns
// false during that window to avoid a flash before settled state.
export function shouldShowWarmReentry(state, contactsCount) {
  if (!state) return false;
  if (!state.isAuthenticated) return false;
  if (state.isSubscribed) return false;
  if (!state.isOnboardingComplete) return false;
  if (!state.isRegisteredViaRecipientFlow) return false;
  if (typeof contactsCount !== 'number') return false;
  if (contactsCount > 0) return false;
  return true;
}
