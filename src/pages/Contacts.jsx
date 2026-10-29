// src/pages/Contacts.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
// SLICE E6 — the Personal / Business view. One page, TWO endpoints: the personal list keeps its
// own fail-closed scope predicate and the corporate roster is read through the corporate client.
// Neither query learns about the other.
import {
  VIEW_SCOPE, canUseBusinessView, effectiveScope, businessOrganizations,
  BUSINESS_READ_ONLY_NOTICE, contactsFromCorporateResponse,
} from './contactScopeView.js';
import { createCorporateCampaignsClient } from '../api/corporateCampaigns.js';
// SLICE E7 — single-record writes live on a DIFFERENT router (/api/corporate-contacts) behind a
// DIFFERENT dormancy flag than the campaign reads, so they get their own client rather than a
// method bolted onto one whose base path is only correct for half the calls.
import { createCorporateContactsClient, campaignsContainingContact, deleteWarningLine } from '../api/corporateContacts.js';
import { useNavigate, useLocation } from 'react-router-dom';
import api from "../api/api";
import RecipientsPracticeView from '../components/RecipientsPracticeView';
import { readPracticeView, clearSampleWorkspace } from '../import/sampleWorkspace.js';
import { showManualToast } from '../utils/notify';
import { COMMS_CATEGORIES } from '../utils/commsCatalog';
import Modal from '../components/Modal';
import ContactForm from '../components/ContactForm';
import CSVImport from '../components/CSVImport';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { autoAddRecipientPhotosToLibrary } from '../utils/mediaLibrary';
import { getErrorMessage } from '../utils/errorMessages';
import { autoGiftScheduledOccasions } from '../utils/scheduledPhysicalGift';
import { useAuth } from '../context/AuthContext';
import { resolveRecipientLimit, recipientLimitMessage, isAtRecipientCap } from '../utils/sendGating';
import CelebrationsWorkspace from '../components/celebrations/CelebrationsWorkspace';
import { launcherChoicesForOccasion, businessCelebrationContacts } from '../utils/celebrationsModel';
import { saveLauncherState } from '../utils/dashboardLauncherState';
import { readAddRecipientReturn, sendReturnPath, noteAddedRecipientForDashboard, safeRecipientId } from '../utils/addRecipientEntry';

// Session storage key (must match ContactForm.jsx)
const FORM_DRAFT_KEY = 'greetme_contact_form_draft';

// Walkthrough 2026-10-24: the old Business two-column layout (and its panel/avatar/occasion-tile helpers) is gone;
// both contexts render the Celebrations workspace.

export default function Recipients() {
  const navigate = useNavigate();
  const location = useLocation();
  // Opened from the dashboard to edit (or add) a recipient: after saving or closing, go back there, where the
  // dashboard restores the sender's in-progress choices (utils/dashboardLauncherState.js). Read once on arrival —
  // the deep-link effects below clear location.state.
  // Lane 1 (2026-10-28): or opened from the send editor ('send') to add a recipient — after saving or closing, back to
  // that greeting, kept in sendGreetingState (utils/addRecipientEntry.js). One ref holds where to go back to, or null.
  const returnToDashboardRef = useRef(readAddRecipientReturn(location.state));
  // Report 135: the dashboard's Celebration Manager opens an occasion here ({ celebrations: { path, occasion } }), read once.
  const celebrationsEntryRef = useRef({ path: location.state?.celebrations?.path === 'occasions' ? 'occasions' : 'recipients', occasion: /^[a-z_]{1,40}$/.test(location.state?.celebrations?.occasion || '') ? location.state.celebrations.occasion : 'birthday' });
  // `addedId`: the recipient this visit created (server id). The composition that sent the sender here gets it back
  // selected: Home through its kept launcher snapshot, the send editor through its return URL.
  const backToDashboard = (savedMessage, addedId = null) => {
    const target = returnToDashboardRef.current;
    if (!target) return false;
    returnToDashboardRef.current = false;
    if (savedMessage) { try { showManualToast('Saved ✓', savedMessage, COMMS_CATEGORIES.PROFILE); } catch { /* ignore */ } }
    if (target === 'send') { navigate(sendReturnPath(addedId), { replace: true }); return true; }
    if (addedId) noteAddedRecipientForDashboard(window.sessionStorage, user && user.id, addedId);
    navigate('/dashboard');
    return true;
  };
  // A path that stays on this page (the recipient wasn't found, the plan's recipient limit, a local-only save):
  // nothing from the dashboard is pending any more, so a later, unrelated close must not jump there (Team 5 F-C1).
  const stayOnRecipients = () => { returnToDashboardRef.current = false; };
  // Recipients PRACTICE VIEW (fail-closed): render session-scoped Test Drive contacts in the normal
  // layout ONLY when the explicit marker is present AND a valid current-session workspace exists.
  const practiceMarker = new URLSearchParams(location.search || '').get('practice') === '1';
  const practiceView = useMemo(() => (practiceMarker ? readPracticeView() : { status: 'none', contacts: [] }), [practiceMarker]);
  const practiceActive = practiceMarker && (practiceView.status === 'active' || practiceView.status === 'empty');
  const exitPractice = () => {
    clearSampleWorkspace();                                   // deterministic cleanup; never a production delete
    try { showManualToast('Test Drive ended', 'Test Drive ended. Practice contacts were removed. Your real recipients were not changed.', COMMS_CATEGORIES.PROFILE); } catch { /* ignore */ }
    navigate('/dashboard/contacts', { replace: true });      // drop the practice=1 marker; Back cannot restore cleared data
  };
  const returnToWizardFromPractice = () => navigate('/dashboard/import-wizard');
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  // LANE E2 (2026-10-10) — recipient cap stated up front. The count is trusted ONLY when it came
  // from the server list (never from the local-storage fallback); the limit comes from the server's
  // RECIPIENT_LIMIT_REACHED `limit`, then profile entitlements, then the plan config.
  const { user } = useAuth();
  const [serverRecipientCount, setServerRecipientCount] = useState(null);
  const [recipientCapLimit, setRecipientCapLimit] = useState(null);

  // ── SLICE E6 — Personal / Business ─────────────────────────────────────────────────────────
  const [requestedScope, setRequestedScope] = useState(VIEW_SCOPE.PERSONAL);
  const [membershipResult, setMembershipResult] = useState(null);
  const [businessContacts, setBusinessContacts] = useState([]);
  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessError, setBusinessError] = useState(null);
  const corporateClient = useMemo(() => createCorporateCampaignsClient(), []);
  const corporateWrites = useMemo(() => createCorporateContactsClient(), []);
  // Campaigns are loaded in the Business view for ONE reason: to warn, before a delete, that
  // someone is still addressed by a campaign. Nothing here blocks the delete.
  const [businessCampaigns, setBusinessCampaigns] = useState([]);

  // Membership decides whether the Business view exists at all. NOT subscription: billing state
  // moves for reasons unrelated to data ownership, and a declined card must never re-interpret a
  // roster. A failure here simply leaves the toggle hidden.
  useEffect(() => {
    let cancelled = false;
    corporateClient.listMemberships()
      .then((res) => { if (!cancelled) setMembershipResult(res); })
      .catch(() => { if (!cancelled) setMembershipResult({ ok: false }); });
    return () => { cancelled = true; };
  }, [corporateClient]);

  const businessAvailable = canUseBusinessView(membershipResult);
  const scope = effectiveScope(requestedScope, membershipResult);
  const businessOrgId = businessAvailable
    ? businessOrganizations(membershipResult)[0].corporateOrganizationId
    : null;

  // The corporate roster, fetched only when it is actually being looked at.
  useEffect(() => {
    if (scope !== VIEW_SCOPE.BUSINESS || !businessOrgId) return undefined;
    let cancelled = false;
    setBusinessLoading(true); setBusinessError(null);
    corporateClient.listCampaigns(businessOrgId)
      .then((r) => { if (!cancelled) setBusinessCampaigns((r && r.ok && r.data && r.data.campaigns) || []); })
      .catch(() => { if (!cancelled) setBusinessCampaigns([]); });
    corporateClient.listOrgContacts(businessOrgId)
      .then((res) => {
        if (cancelled) return;
        if (!res || res.ok !== true) {
          setBusinessContacts([]);
          setBusinessError(res && res.dormant
            ? 'Business contacts aren\u2019t available yet.'
            : 'That list didn\u2019t load. Please try again.');
          return;
        }
        setBusinessContacts(contactsFromCorporateResponse(res));
      })
      .catch(() => { if (!cancelled) { setBusinessContacts([]); setBusinessError('That list didn\u2019t load. Please try again.'); } })
      .finally(() => { if (!cancelled) setBusinessLoading(false); });
    return () => { cancelled = true; };
  }, [scope, businessOrgId, corporateClient]);

  const isBusiness = scope === VIEW_SCOPE.BUSINESS;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  // Deep link from the "Review your Auto-Gift" / 10-day reminder emails: #/dashboard/contacts?contactId=<id>&occasion=<type>.
  const [focusOccasion, setFocusOccasion] = useState(null);
  // Celebrations (Report 135): opened from the Occasions path for someone who doesn't hold the occasion yet.
  const [addFocusOccasion, setAddFocusOccasion] = useState(false);
  // Saved dates' real statuses and the real send history, for Upcoming | Past. Read-only; failures leave them empty.
  const [upcomingRows, setUpcomingRows] = useState([]);
  const [sentGreetings, setSentGreetings] = useState([]);
  const [alert, setAlert] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewMode, setViewMode] = useState('recipients');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const hasAutoOpenedRef = useRef(false);
  const hasAutoOpenedAddRef = useRef(false);

  // Handle resize for responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (practiceActive) return;               // Practice View never fetches production recipients
    fetchRecipients();

    // Check if there's a saved form draft
    try {
      const saved = sessionStorage.getItem(FORM_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.timestamp && Date.now() - draft.timestamp < 30 * 60 * 1000 && !draft.isEditing) {
          setShowAddModal(true);
          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 150);
        }
      }
    } catch (e) {
      console.warn('Could not check form draft:', e);
    }
  }, []);

  // Handle deep link from Dashboard to auto-open Edit Recipient modal
  useEffect(() => {
    const editId = location.state?.openEditRecipientId;
    if (editId && recipients.length > 0 && !hasAutoOpenedRef.current) {
      const target = recipients.find(r => r.id === editId);
      if (target) {
        hasAutoOpenedRef.current = true;
        setEditingContact(target);
        setShowEditModal(true);
        // Clear the state so refresh doesn't re-open
        navigate(location.pathname, { replace: true, state: {} });
      } else {
        stayOnRecipients();
      }
    } else if (editId && !loading && recipients.length === 0) {
      stayOnRecipients();
    }
  }, [recipients, location.state, navigate, location.pathname, loading]);

  // Deep link from the emails: ?contactId=<id>&occasion=<type> (read from the HashRouter search params) opens that recipient's edit form
  // at that occasion, once. The params are consumed (replace) so a refresh or Back does not reopen it. An unknown or missing id, or a
  // list that fails to load, degrades to the plain list with no error; a missing or unknown occasion just opens the form.
  const hasOpenedDeepLinkRef = useRef(false);
  useEffect(() => {
    if (hasOpenedDeepLinkRef.current || practiceActive || isBusiness || loading) return;
    const params = new URLSearchParams(location.search || '');
    const contactId = (params.get('contactId') || '').trim();
    if (!contactId) return;
    hasOpenedDeepLinkRef.current = true;
    const occasion = (params.get('occasion') || '').trim();
    const target = recipients.find((r) => r && (String(r.id) === contactId || String(r._id) === contactId));
    if (target) {
      setEditingContact(target);
      setFocusOccasion(/^[a-z0-9_]{1,40}$/.test(occasion) ? occasion : null);
      setShowEditModal(true);
    } else {
      stayOnRecipients();
    }
    navigate(location.pathname, { replace: true, state: {} });   // consume the params either way
  }, [loading, recipients, location.search, location.pathname, navigate, practiceActive, isBusiness]);

  // Handle deep link from Dashboard to auto-open Add Recipient modal
  useEffect(() => {
    if (location.state?.openAddRecipient && !hasAutoOpenedAddRef.current) {
      hasAutoOpenedAddRef.current = true;
      try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
      setShowAddModal(true);
      // Clear the state so refresh doesn't re-open
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  const fetchCelebrationStatus = async () => {
    try { const r = await api.getUpcomingOccasions(366); if (r && r.ok !== false && Array.isArray(r.data)) setUpcomingRows(r.data); } catch { /* statuses fall back to the saved record */ }
    try { const r = await api.getSentGreetings(); if (r && Array.isArray(r.greetings)) setSentGreetings(r.greetings); } catch { /* Past shows no sends */ }
  };
  const fetchRecipients = async ({ silent = false } = {}) => {
    fetchCelebrationStatus();
    try {
      if (!silent) setLoading(true);
      const response = await api.getContacts();

      if (response && response.ok === false && response.status === 401) {
        console.warn('API authentication failed, using local storage');
        const stored = localStorage.getItem('greetme_recipients');
        setRecipients(stored ? JSON.parse(stored) : []);
      } else if (response && response.networkError) {
        // LIVE-1 — the request never reached the server: keep the list already on screen instead of
        // replacing it with an empty one.
        console.warn('Recipients refresh did not reach the server; keeping the current list');
      } else {
        setRecipients(response.data || []);
        setServerRecipientCount(Array.isArray(response?.data) ? response.data.length : null);
        setRecipientCapLimit(null); // re-derived from the fresh count
      }
    } catch (error) {
      console.warn('API error, using local storage fallback:', error);
      const stored = localStorage.getItem('greetme_recipients');
      setRecipients(stored ? JSON.parse(stored) : []);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ── SLICE E7 — business contact writes ─────────────────────────────────────────────────────
  // Separate handlers from the personal ones on purpose: they call a different router, and the
  // roster they refresh is a different list. Sharing a handler would have meant one function that
  // guesses which store it is talking to.
  const reloadBusinessContacts = async () => {
    if (!businessOrgId) return;
    const res = await corporateClient.listOrgContacts(businessOrgId);
    setBusinessContacts(contactsFromCorporateResponse(res));
  };

  const businessWriteFailed = (res) => {
    if (res && res.notFound) return 'That contact no longer exists. The list has been refreshed.';
    if (res && res.conflict) return 'Someone with that email is already here.';
    if (res && res.dormant) return 'Business contacts aren\u2019t available yet.';
    if (res && res.unauthorized) return 'You don\u2019t have access to change business contacts.';
    if (res && res.error === 'valid_email_required') return 'That email doesn\u2019t look right.';
    if (res && res.error === 'name_required') return 'A name is required.';
    return 'That didn\u2019t go through. Please try again.';
  };

  const handleCreateBusinessContact = async (contactData) => {
    const res = await corporateWrites.createContact(businessOrgId, contactData);
    if (!res || res.ok !== true) { showAlertMessage('error', businessWriteFailed(res)); return false; }
    await reloadBusinessContacts();
    showAlertMessage('success', 'Contact added.');
    return true;
  };

  const handleUpdateBusinessContact = async (contactId, patch) => {
    const res = await corporateWrites.updateContact(businessOrgId, contactId, patch);
    if (!res || res.ok !== true) {
      showAlertMessage('error', businessWriteFailed(res));
      if (res && res.notFound) await reloadBusinessContacts();
      return false;
    }
    await reloadBusinessContacts();
    showAlertMessage('success', 'Contact updated.');
    return true;
  };

  const handleDeleteBusinessContact = async (contactId) => {
    const res = await corporateWrites.deleteContact(businessOrgId, contactId);
    // Already gone is the outcome that was asked for; refresh rather than report a failure.
    if (!res || (res.ok !== true && !res.notFound)) { showAlertMessage('error', businessWriteFailed(res)); return false; }
    await reloadBusinessContacts();
    showAlertMessage('success', 'Contact removed.');
    return true;
  };

  // LANE E2 — personal view only (the Business roster has its own, separate limits).
  const knownRecipientLimit = resolveRecipientLimit({ user });
  const atRecipientCap = !isBusiness && isAtRecipientCap({ limit: knownRecipientLimit, count: serverRecipientCount });
  const showRecipientCapNotice = !isBusiness && (atRecipientCap || recipientCapLimit !== null);
  const capNoticeLimit = recipientCapLimit || knownRecipientLimit;
  const openAddRecipient = () => {
    if (atRecipientCap) { setRecipientCapLimit(knownRecipientLimit); return; } // say so BEFORE the form
    try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
    setShowAddModal(true);
  };

  const showAlertMessage = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // LIVE-1 — api.request() RETURNS (does not throw) { ok:false, status:0, networkError:true } when a
  // request never reaches the server, and { ok:false, status:401|404 } for those statuses. A recipient
  // save is only a save when the server accepted it; anything else becomes a thrown failure so
  // ContactForm's own error path (errors.submit / the Auto-Gift modal's submitError) shows it, the
  // form stays open, and no success alert or "Saved ✓" toast fires.
  const throwIfSaveNotAccepted = (response) => {
    if (!response || response.ok !== false) return;
    const error = new Error(response.networkError
      ? 'We couldn’t save — check your connection and try again.'
      : (response.error || response.message || 'We couldn’t save that recipient. Please try again.'));
    error.status = response.status;
    error.saveNotAccepted = true;
    if (response.networkError) error.networkError = true;
    throw error;
  };

  const handleAddRecipient = async (contactData) => {
    // SLICE E7 — the Business roster is a different store on a different router. One decision,
    // taken here, rather than a handler that guesses which list it is writing to.
    if (isBusiness) {
      const done = await handleCreateBusinessContact(contactData);
      if (done) setShowAddModal(false);
      return;
    }
    try {
      const response = await api.createContact(contactData);
      throwIfSaveNotAccepted(response);

      const newRecipient = {
        id: response?.data?.id || Date.now(),
        ...contactData,
        createdAt: new Date().toISOString()
      };

      setRecipients(prev => {
        const updated = [...prev, newRecipient];
        localStorage.setItem('greetme_recipients', JSON.stringify(updated));
        return updated;
      });

      // Auto-add recipient photos to media library
      autoAddRecipientPhotosToLibrary(contactData);

      showAlertMessage('success', 'Recipient added successfully');
      setShowAddModal(false);

      if (response && response.data) {
        fetchRecipients();
      }
      backToDashboard('Recipient added.', safeRecipientId(response?.data?.id));
    } catch (error) {
      console.error('Add recipient error:', error);

      // LIVE-1 — not accepted by the server (e.g. never reached it): not "stored locally", not a
      // success. Hand it back to the form, which shows the message and stays open for a retry.
      if (error?.saveNotAccepted) throw error;

      // Lane 1 (2026-10-28) — the server already holds a recipient with this email (409 EMAIL_EXISTS). It used to fall
      // through to the "stored locally" path below and add a second, local-only copy. Now nothing is added: the form
      // stays open and says why, so the sender can use the existing recipient or change the email.
      if (error?.status === 409 || error?.code === 'EMAIL_EXISTS') {
        const dup = new Error('Someone with this email is already in your recipients. Choose them from your list, or use a different email.');
        dup.saveNotAccepted = true;
        dup.status = 409;
        throw dup;
      }

      // SUB-RECIPIENT-CAPS — do NOT fall back to local/offline storage when the plan cap is hit.
      if (error?.code === 'RECIPIENT_LIMIT_REACHED') {
        // LANE E2 — state the number and show the Upgrade link on the page (the form cannot succeed
        // on this plan; its draft stays in sessionStorage).
        setRecipientCapLimit(resolveRecipientLimit({ errorData: error?.data, user }) || 0);
        setShowAddModal(false);
        stayOnRecipients();
        showAlertMessage('error', getErrorMessage(error));
        return;
      }

      // W07 — a save that carries Auto-Gift consents is never "stored locally": a refused or failed consent must be seen, not hidden.
      if (Array.isArray(contactData?.occasionGiftConsents) && contactData.occasionGiftConsents.length > 0) {
        stayOnRecipients();
        showAlertMessage('error', getErrorMessage(error));
        return;
      }

      const newRecipient = {
        id: Date.now(),
        ...contactData,
        createdAt: new Date().toISOString()
      };

      setRecipients(prev => {
        const updated = [...prev, newRecipient];
        localStorage.setItem('greetme_recipients', JSON.stringify(updated));
        return updated;
      });

      // Auto-add recipient photos to media library (even in offline mode)
      autoAddRecipientPhotosToLibrary(contactData);

      showAlertMessage('success', 'Recipient added (stored locally - backend unavailable)');
      stayOnRecipients();
      setShowAddModal(false);
    }
  };

  const handleEditRecipient = async (contactData) => {
    if (isBusiness) {
      const done = await handleUpdateBusinessContact(editingContact && editingContact.id, contactData);
      if (done) { setShowEditModal(false); setEditingContact(null); }
      return;
    }
    try {
      const response = await api.updateContact(editingContact.id, contactData);
      throwIfSaveNotAccepted(response);

      // Auto-add any new recipient photos to media library
      autoAddRecipientPhotosToLibrary(contactData);

      // S4: when the save carries a scheduled physical gift on Auto-Gift, the scheduler shows the approved "Confirmed! ..."
      // message itself, so this banner would be a duplicate. Every other update keeps it.
      if (!autoGiftScheduledOccasions(contactData && contactData.occasionGiftSettings).length) showAlertMessage('success', 'Recipient updated successfully');
      setShowEditModal(false);
      setEditingContact(null);
      fetchRecipients();
      backToDashboard('Recipient updated.');
    } catch (error) {
      // LANE E2 — PUT can now return RECIPIENT_LIMIT_REACHED too (email changed to a new recipient).
      if (error?.code === 'RECIPIENT_LIMIT_REACHED') {
        setRecipientCapLimit(resolveRecipientLimit({ errorData: error?.data, user }) || 0);
      }
      throw error;
    }
  };

  const handleDeleteRecipient = async (contactId) => {
    if (isBusiness) {
      await handleDeleteBusinessContact(contactId);
      setDeleteConfirm(null);
      return;
    }
    try {
      await api.deleteContact(contactId);
      showAlertMessage('success', 'Recipient deleted successfully');
      setDeleteConfirm(null);
      fetchRecipients();
    } catch (error) {
      showAlertMessage('error', getErrorMessage(error));
    }
  };

  const handleImportRecipients = async (contactsToImport) => {
    let outcome;
    try {
      // One atomic-intent bulk call — whole-batch limit reject + dedup + per-row results.
      const res = await api.importContacts(contactsToImport);
      const { imported = 0, failed = 0, errors = [] } = (res && res.data) || {};
      const rows = (errors || []).map((e) => ({
        name: e?.contact?.name || '',
        email: e?.contact?.email || '',
        reason:
          e?.error === 'Email already exists' ? 'Duplicate — already in your recipients'
          : e?.error === 'Missing name or email' ? 'Missing name or email'
          : 'Could not be added',
      }));
      if (failed === 0) {
        outcome = { kind: 'full', imported, failed, rows: [], message: `${imported} recipient${imported === 1 ? '' : 's'} imported successfully.` };
      } else {
        outcome = { kind: 'partial', imported, failed, rows, message: `${imported} recipient${imported === 1 ? '' : 's'} imported. ${failed} could not be added.` };
      }
    } catch (error) {
      if (error && (error.code === 'RECIPIENT_LIMIT_REACHED' || error.status === 403)) {
        const m = /\((\d+)\)/.exec(error.message || '');
        const limit = resolveRecipientLimit({ errorData: error.data }) || (m ? m[1] : '3');
        outcome = { kind: 'limit', imported: 0, failed: contactsToImport.length, rows: [], message: `You've reached your plan's recipient limit of ${limit}. Upgrade your plan to add more recipients.` };
      } else {
        outcome = { kind: 'error', imported: 0, failed: contactsToImport.length, rows: [], message: getErrorMessage(error) };
      }
    }
    // Always refresh so any imported rows appear without a manual reload.
    // Silent: never toggle page-level loading, or the modal subtree would unmount
    // and lose the per-row result panel before the user can read it.
    await fetchRecipients({ silent: true });
    showAlertMessage(
      outcome.kind === 'full' ? 'success' : outcome.kind === 'partial' ? 'warning' : 'error',
      outcome.message,
    );
    // Close only on full success; otherwise keep the modal open for the user.
    if (outcome.kind === 'full') setShowImportModal(false);
    return outcome;
  };

  const openEditModal = (contact) => {
    setFocusOccasion(null);
    setEditingContact(contact);
    setShowEditModal(true);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  // Celebrations (Report 135): both entry paths open the SAME Occasion Scheduler (ContactForm) for one person; from an
  // occasion it opens at that occasion and, for someone who doesn't hold it yet, adds it there (nothing saved until Save).
  const openScheduler = (contact, occasionType = null, addIfMissing = false) => {
    setFocusOccasion(occasionType || null);
    setAddFocusOccasion(Boolean(occasionType && addIfMissing));
    setEditingContact(contact);
    setShowEditModal(true);
  };
  // Several people from one occasion: the dashboard's own Dates & gifts resolver, through its one-round-trip launcher state.
  const scheduleGroupFromOccasion = (label, ids) => {
    const kept = saveLauncherState(window.sessionStorage, user && user.id, launcherChoicesForOccasion(label, ids));
    if (kept === 'none') { showAlertMessage('error', 'We couldn’t open Dates & gifts on this device. Open each person’s scheduler instead.'); return; }
    navigate('/dashboard');
  };
  const openImport = () => {
    if (import.meta.env.VITE_IMPORT_WIZARD_ENTRY === 'true') navigate('/dashboard/import-wizard');
    else setShowImportModal(true);
  };

  // SLICE E6 — the list follows the scope. The two sources are chosen between, never combined:
  // `recipients` came from the personal endpoint with its own fail-closed scope predicate, and
  // `businessContacts` from the corporate one. Search applies to whichever is in view.
  // Walkthrough 2026-10-24: the Business categories (All / Employees / Clients / Vendors) are shown and filtered inside
  // the Celebrations workspace (same filterByCorporateType, same counts). Actions always get the stored roster record.
  const businessRecord = (c) => businessContacts.find((b) => b && c && b.id === c.id) || c;

  // PRACTICE VIEW — render the session-scoped Test Drive contacts in the normal layout, in place of the
  // ordinary Recipients page. Genuine recipients are never fetched or shown here (fail-closed above).
  if (practiceActive) {
    return <RecipientsPracticeView status={practiceView.status} contacts={practiceView.contacts} onExit={exitPractice} onReturnToWizard={returnToWizardFromPractice} isMobile={isMobile} />;
  }

  if (loading) {
    return <LoadingSpinner text="Loading recipients..." />;
  }

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Walkthrough revision 2026-10-24 (founder): Personal and Business use the same approved Celebrations design.
          Switching context changes the data and the categories, never the page. ONE PAGE, TWO ENDPOINTS still: the
          workspace is handed whichever roster is in view (recipients from the personal endpoint, businessContacts from
          the corporate one), never both. The business roster is shown through businessCelebrationContacts (display
          only: its dates are month-day), and every action receives the ORIGINAL roster record (businessRecord).
          Business keeps exactly its previous actions: Edit opens the same editor the old Business view opened
          (openEditModal), never at a particular occasion; Send, Delete and Add go through the same handlers, which
          branch on the scope. Dates & gifts (personal recipients only) is not offered for Business. */}
      {/* LANE E2 — recipient cap, with the number and an Upgrade link, before any form is filled (personal only). */}
      {showRecipientCapNotice && (
        <div
          id="recipient-cap-notice"
          data-testid="recipient-cap-notice"
          role="status"
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1rem',
            padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: '0.625rem',
            border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e', fontSize: '0.875rem',
          }}
        >
          <span style={{ flex: '1 1 16rem' }}>{recipientLimitMessage(capNoticeLimit)}</span>
          <button
            type="button"
            data-testid="recipient-cap-upgrade"
            onClick={() => navigate('/pricing')}
            style={{
              padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', background: '#b45309',
              color: '#fff', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Upgrade
          </button>
        </div>
      )}

      {/* Alert */}
      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <CelebrationsWorkspace
        context={isBusiness ? 'business' : 'personal'}
        contacts={isBusiness ? businessCelebrationContacts(businessContacts) : recipients}
        upcomingRows={isBusiness ? [] : upcomingRows}
        sent={isBusiness ? [] : sentGreetings}
        listNote={isBusiness && businessLoading ? { testid: 'business-loading', text: 'Loading business contacts\u2026' }
          : isBusiness && businessError ? { testid: 'business-error', text: businessError } : null}
        scopeToggle={(
          businessAvailable ? (
            <div data-testid="scope-toggle" role="tablist" aria-label="Which contacts to show" className="seg small scope">
              {[{ key: VIEW_SCOPE.PERSONAL, label: 'Personal' }, { key: VIEW_SCOPE.BUSINESS, label: 'Business' }].map((t) => {
                const on = scope === t.key;
                return (
                  <button key={t.key} type="button" role="tab" aria-selected={on}
                    data-testid={`scope-${t.key}`}
                    onClick={() => setRequestedScope(t.key)}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          ) : null
        )}
        onOpenScheduler={isBusiness ? (c) => openEditModal(businessRecord(c)) : openScheduler}
        onSend={(c) => navigate(`/dashboard/send?contactId=${c._id || c.id}`)}
        onDelete={(c) => setDeleteConfirm(isBusiness ? businessRecord(c) : c)}
        onAddRecipient={openAddRecipient}
        onImport={isBusiness ? () => navigate(BUSINESS_READ_ONLY_NOTICE.actionPath) : openImport}
        onAddGift={(slide) => navigate(slide === 'qrcash' ? '/dashboard/gifts?tab=qrcash' : '/dashboard/gifts')}
        initialPath={celebrationsEntryRef.current.path}
        initialOccasion={celebrationsEntryRef.current.occasion}
        onScheduleGroup={isBusiness ? null : scheduleGroupFromOccasion}
      />

      {/* Add Recipient Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
          backToDashboard();
        }}
        title="Add New Recipient"
        size="lg"
      >
        <ContactForm
          onSubmit={handleAddRecipient}
          onCancel={() => {
            setShowAddModal(false);
            try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
            backToDashboard();
          }}
        />
      </Modal>

      {/* Edit Recipient Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingContact(null);
          setFocusOccasion(null);
          setAddFocusOccasion(false);
          backToDashboard();
        }}
        title="Edit Recipient"
        size="lg"
      >
        <ContactForm
          contact={editingContact}
          focusOccasion={focusOccasion}
          addFocusOccasion={addFocusOccasion}
          onSubmit={handleEditRecipient}
          onCancel={() => {
            setShowEditModal(false);
            setEditingContact(null);
            setFocusOccasion(null);
            setAddFocusOccasion(false);
            backToDashboard();
          }}
        />
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Recipients from CSV"
        size="lg"
      >
        <CSVImport
          onImport={handleImportRecipients}
          onCancel={() => setShowImportModal(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Recipient"
          size="sm"
        >
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: isBusiness ? '12px' : '24px', fontSize: '0.9375rem' }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone. Records of gifts and orders already placed are kept.
            </p>
            {/* SLICE E7 — WARN, never block. Removing someone who is in a campaign is a
                legitimate thing to want; being surprised by it afterwards is not. The campaigns
                are named so the decision is informed, and then the button does what it says.
                Nothing cascades: the scheduler re-reads the contact and skips a vanished one, so
                a stale reference is already harmless. */}
            {isBusiness && deleteWarningLine(deleteConfirm.name, campaignsContainingContact(businessCampaigns, deleteConfirm.id)) ? (
              <p data-testid="delete-campaign-warning" style={{
                marginBottom: '24px', padding: '10px 12px', borderRadius: '10px',
                background: 'rgba(214,145,16,.07)', border: '1px solid rgba(214,145,16,.26)',
                color: 'var(--text-secondary)', fontSize: '0.83rem', lineHeight: 1.45,
              }}>
                {deleteWarningLine(deleteConfirm.name, campaignsContainingContact(businessCampaigns, deleteConfirm.id))}
                {' '}Those campaigns will simply skip them from now on.
              </p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '10px 24px',
                  background: 'var(--gray-100)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRecipient(deleteConfirm.id)}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
