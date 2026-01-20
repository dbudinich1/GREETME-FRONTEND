// src/pages/Contacts.jsx
import { useState, useEffect, useRef } from 'react';
import { Plus, Upload, Search, Edit, Trash2, ArrowLeft, Users, Calendar, Gift, Clock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from "../api/api";
import Modal from '../components/Modal';
import ContactForm from '../components/ContactForm';
import CSVImport from '../components/CSVImport';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { getOccasionIcon, getOccasionLabel } from '../utils/helpers';
import { autoAddRecipientPhotosToLibrary } from '../utils/mediaLibrary';

// Session storage key (must match ContactForm.jsx)
const FORM_DRAFT_KEY = 'greetme_contact_form_draft';

export default function Recipients() {
  const navigate = useNavigate();
  const location = useLocation();
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [alert, setAlert] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewMode, setViewMode] = useState('recipients');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const hasAutoOpenedRef = useRef(false);

  // Handle resize for responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
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
      }
    }
  }, [recipients, location.state, navigate, location.pathname]);

  const fetchRecipients = async () => {
    try {
      setLoading(true);
      const response = await api.getContacts();

      if (response && response.ok === false && response.status === 401) {
        console.warn('API authentication failed, using local storage');
        const stored = localStorage.getItem('greetme_recipients');
        setRecipients(stored ? JSON.parse(stored) : []);
      } else {
        setRecipients(response.data || []);
      }
    } catch (error) {
      console.warn('API error, using local storage fallback:', error);
      const stored = localStorage.getItem('greetme_recipients');
      setRecipients(stored ? JSON.parse(stored) : []);
    } finally {
      setLoading(false);
    }
  };

  const showAlertMessage = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleAddRecipient = async (contactData) => {
    try {
      const response = await api.createContact(contactData);

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
    } catch (error) {
      console.error('Add recipient error:', error);

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
      setShowAddModal(false);
    }
  };

  const handleEditRecipient = async (contactData) => {
    try {
      await api.updateContact(editingContact.id, contactData);

      // Auto-add any new recipient photos to media library
      autoAddRecipientPhotosToLibrary(contactData);

      showAlertMessage('success', 'Recipient updated successfully');
      setShowEditModal(false);
      setEditingContact(null);
      fetchRecipients();
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteRecipient = async (contactId) => {
    try {
      await api.deleteContact(contactId);
      showAlertMessage('success', 'Recipient deleted successfully');
      setDeleteConfirm(null);
      fetchRecipients();
    } catch (error) {
      showAlertMessage('error', 'Failed to delete recipient');
    }
  };

  const handleImportRecipients = async (contactsToImport) => {
    try {
      const promises = contactsToImport.map(contact => api.createContact(contact));
      await Promise.all(promises);
      showAlertMessage('success', `${contactsToImport.length} recipients imported successfully`);
      setShowImportModal(false);
      fetchRecipients();
    } catch (error) {
      throw new Error('Failed to import recipients');
    }
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setShowEditModal(true);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const filteredRecipients = recipients.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner text="Loading recipients..." />;
  }

  // Example placeholder data for empty state
  const placeholderRecipients = [
    { name: 'Mom', relationship: 'Parent', occasions: [{ type: 'birthday' }], hasGift: true },
    { name: 'Best Friend', relationship: 'Friend', occasions: [{ type: 'birthday' }, { type: 'christmas' }], hasGift: false },
    { name: 'Partner', relationship: 'Partner', occasions: [{ type: 'birthday' }, { type: 'anniversary' }], hasGift: true }
  ];

  // Flatten occasions for occasions view
  const allOccasions = recipients.flatMap(contact =>
    (contact.occasions || []).map(occasion => ({
      ...occasion,
      recipientName: contact.name,
      recipientRelationship: contact.relationship,
      contactId: contact.id
    }))
  ).filter(occ =>
    !searchTerm ||
    occ.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    occ.recipientName?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    const dateA = new Date(a.date || '9999-12-31');
    const dateB = new Date(b.date || '9999-12-31');
    return dateA - dateB;
  });

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: isMobile ? '24px 20px' : '32px',
        marginBottom: '24px',
        boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)'
      }}>
        {/* Title Row with Back Arrow on Left, Recipients Centered */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          marginBottom: '12px'
        }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              fontFamily: 'inherit',
              position: 'absolute',
              left: 0
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{
            fontSize: isMobile ? '1.5rem' : '1.75rem',
            fontWeight: 700,
            color: 'white',
            margin: 0,
            lineHeight: 1.2,
            width: '100%',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            Recipients
            <span style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.25)',
              padding: '2px 10px',
              borderRadius: '9999px',
              minWidth: '24px',
              textAlign: 'center'
            }}>{recipients.length}</span>
          </h1>
        </div>

        {/* Subtitle - Centered on desktop, justified on mobile */}
        <div style={{ textAlign: isMobile ? 'justify' : 'center' }}>
          <p style={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: isMobile ? '0.8125rem' : '0.9375rem',
            lineHeight: 1.5,
            marginBottom: '12px'
          }}>Personalize how you greet each recipient — birthdays, holidays, or "just because".</p>
          <p style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: isMobile ? '0.6875rem' : '0.75rem',
            lineHeight: 1.4,
            marginBottom: '0'
          }}>Gifts are optional and never auto-sent unless you enable Auto-Gift for a specific occasion.</p>
        </div>

        {/* Centered Action Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '8px',
          justifyContent: 'center',
          marginTop: '16px'
        }}>
          <button
            onClick={() => {
              try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
              setShowAddModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
            }}
          >
            Add Recipient
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            Import Contacts
          </button>
        </div>
      </div>

      {/* Gift Reminder Banner - Phase 8.2: Actionable CTA, matches ContactForm banner */}
      <div style={{
        marginTop: '1.5rem',
        marginBottom: '1.5rem',
        padding: '0.875rem 1rem',
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #fbbf24',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Gift size={20} style={{ color: '#d97706', flexShrink: 0 }} />
          <div>
            <p style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#78350f',
              margin: 0
            }}>
              Don't forget to add a gift
            </p>
            <p style={{
              fontSize: '0.75rem',
              color: '#92400e',
              margin: '0.125rem 0 0 0'
            }}>
              Make the moment complete.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/gifts')}
          style={{
            padding: '0.5rem 1rem',
            background: '#d97706',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          Add Gift
        </button>
      </div>

      {/* Alert */}
      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {/* View Toggle and Search - only when recipients exist */}
      {recipients.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          {/* View Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{
              display: 'inline-flex',
              background: 'var(--gray-100)',
              borderRadius: 'var(--radius-lg)',
              padding: '4px'
            }}>
              <button
                onClick={() => setViewMode('recipients')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  background: viewMode === 'recipients' ? 'white' : 'transparent',
                  color: viewMode === 'recipients' ? '#667eea' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  boxShadow: viewMode === 'recipients' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <Users size={16} />
                Recipients
              </button>
              <button
                onClick={() => setViewMode('occasions')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  background: viewMode === 'occasions' ? 'white' : 'transparent',
                  color: viewMode === 'occasions' ? '#667eea' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  boxShadow: viewMode === 'occasions' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <Calendar size={16} />
                Occasions
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)'
              }}
            />
            <input
              type="text"
              placeholder={viewMode === 'recipients' ? "Search recipients..." : "Search occasions..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px 12px 44px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>
      )}

      {/* Empty State with Placeholder Cards */}
      {recipients.length === 0 ? (
        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}>
          {/* Placeholder Cards */}
          <p style={{
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            marginBottom: '16px',
            fontStyle: 'italic'
          }}>Examples — your recipients will appear here</p>

          {placeholderRecipients.map((preview, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                marginBottom: '12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                background: '#fff',
                opacity: 0.5,
                pointerEvents: 'none',
                gap: isMobile ? '12px' : '0'
              }}
            >
              {/* Left: Avatar + Name + Relationship */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '1rem'
                }}>
                  {preview.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                    {preview.name}
                  </div>
                  <span style={{
                    background: 'linear-gradient(135deg, #ddd6fe 0%, #c7d2fe 100%)',
                    color: '#5b21b6',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '0.6875rem',
                    fontWeight: 600
                  }}>
                    {preview.relationship}
                  </span>
                </div>
              </div>

              {/* Middle: Occasions */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {preview.occasions.map((occ, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      background: 'var(--gray-100)',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <span>{getOccasionIcon(occ.type)}</span>
                    <span>{getOccasionLabel(occ.type)}</span>
                  </span>
                ))}
                {preview.hasGift && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    background: 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    color: '#92400e',
                    fontWeight: 600
                  }}>
                    🎁 Gift
                  </span>
                )}
              </div>

              {/* Right: Actions placeholder */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{
                  padding: '6px 12px',
                  background: 'var(--gray-100)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)'
                }}>Edit</span>
              </div>
            </div>
          ))}

          {/* CTA */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}>
              <Users size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '8px'
            }}>Add your first recipient</h3>
            <p style={{
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              marginBottom: '24px',
              maxWidth: '400px',
              margin: '0 auto 24px'
            }}>
              Start building your greeting list. Add loved ones manually or import from a CSV file.
            </p>
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: isMobile ? '14px 24px' : '10px 16px',
                  background: 'var(--gray-100)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: isMobile ? '0.9375rem' : '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                <Upload size={isMobile ? 18 : 16} />
                Import CSV
              </button>
              <button
                onClick={() => {
                  try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
                  setShowAddModal(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: isMobile ? '14px 24px' : '10px 16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: isMobile ? '0.9375rem' : '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  width: isMobile ? '100%' : 'auto',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                <Plus size={isMobile ? 18 : 16} />
                Add Recipient
              </button>
            </div>
          </div>
        </div>
      ) : viewMode === 'recipients' ? (
        /* Recipients Card List */
        <div>
          {filteredRecipients.length === 0 && searchTerm ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border)'
            }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                No recipients match "{searchTerm}"
              </p>
            </div>
          ) : (
            filteredRecipients.map((contact) => (
              <div
                key={contact.id}
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  marginBottom: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  background: '#fff',
                  transition: 'all 0.2s',
                  gap: isMobile ? '12px' : '16px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  e.currentTarget.style.borderColor = '#667eea';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                {/* Left: Avatar + Name + Relationship */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: isMobile ? 'none' : '0 0 200px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: contact.avatar ? `url(${contact.avatar}) center/cover` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '1.125rem',
                    flexShrink: 0
                  }}>
                    {!contact.avatar && contact.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem', marginBottom: '2px' }}>
                      {contact.name}
                    </div>
                    <span style={{
                      background: 'linear-gradient(135deg, #ddd6fe 0%, #c7d2fe 100%)',
                      color: '#5b21b6',
                      padding: '2px 10px',
                      borderRadius: '9999px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      textTransform: 'capitalize'
                    }}>
                      {contact.relationship || 'Not set'}
                    </span>
                  </div>
                </div>

                {/* Middle: Occasions + Gift */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                  {contact.occasions?.length > 0 ? (
                    contact.occasions.slice(0, 4).map((occasion, idx) => (
                      <span
                        key={idx}
                        title={getOccasionLabel(occasion.type)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          background: 'var(--gray-100)',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        <span style={{ fontSize: '0.875rem' }}>{getOccasionIcon(occasion.type)}</span>
                        {!isMobile && <span>{getOccasionLabel(occasion.type)}</span>}
                      </span>
                    ))
                  ) : (
                    <span style={{
                      padding: '4px 10px',
                      background: 'var(--gray-50)',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)'
                    }}>
                      No occasions
                    </span>
                  )}
                  {contact.occasions?.length > 4 && (
                    <span style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)'
                    }}>
                      +{contact.occasions.length - 4} more
                    </span>
                  )}

                  {/* Gift status */}
                  {contact.giftSelected ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      background: 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      color: '#92400e',
                      fontWeight: 600
                    }}>
                      🎁 Gift
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      background: 'var(--gray-50)',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      border: '1px dashed var(--gray-300)'
                    }}>
                      <Gift size={12} />
                      No gift
                    </span>
                  )}
                </div>

                {/* Right: Actions */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  justifyContent: isMobile ? 'flex-end' : 'flex-start',
                  flexShrink: 0
                }}>
                  <button
                    onClick={() => openEditModal(contact)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <Edit size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(contact)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      background: 'var(--gray-100)',
                      color: 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fee2e2';
                      e.currentTarget.style.color = '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--gray-100)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Upcoming Occasions Section */}
          <div style={{
            marginTop: '24px',
            padding: '20px',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <Clock size={18} style={{ color: '#667eea', flexShrink: 0 }} />
              <h3 style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0
              }}>Upcoming Occasions</h3>
            </div>

            {allOccasions.filter(occ => occ.date).slice(0, 5).length === 0 ? (
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                margin: 0,
                textAlign: 'center',
                padding: '12px 0'
              }}>No upcoming occasions yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allOccasions.filter(occ => occ.date).slice(0, 5).map((occ, idx) => (
                  <div
                    key={`upcoming-${occ.contactId}-${occ.type}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'white',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--gray-200)'
                    }}
                  >
                    <span style={{
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem'
                    }}>{occ.recipientName}</span>
                    <span style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.8125rem'
                    }}>{getOccasionLabel(occ.type)}</span>
                    <span style={{
                      color: 'var(--text-tertiary)',
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}>{new Date(occ.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Occasions Card List */
        <div>
          {allOccasions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border)'
            }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                {searchTerm ? `No occasions match "${searchTerm}"` : 'No occasions scheduled'}
              </p>
            </div>
          ) : (
            allOccasions.map((occasion, index) => (
              <div
                key={`${occasion.contactId}-${occasion.type}-${index}`}
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  marginBottom: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  background: '#fff',
                  transition: 'all 0.2s',
                  gap: isMobile ? '12px' : '16px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  e.currentTarget.style.borderColor = '#667eea';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                {/* Left: Occasion icon + label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: isMobile ? 'none' : '0 0 180px' }}>
                  <span style={{ fontSize: '1.75rem' }}>{getOccasionIcon(occasion.type)}</span>
                  <div style={{
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    fontSize: '0.9375rem',
                    textTransform: 'capitalize'
                  }}>
                    {getOccasionLabel(occasion.type)}
                  </div>
                </div>

                {/* Date */}
                <div style={{
                  padding: '6px 12px',
                  background: 'var(--gray-100)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 500
                }}>
                  {occasion.date ? new Date(occasion.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  }) : 'Not set'}
                </div>

                {/* Recipient info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                    {occasion.recipientName}
                  </span>
                  <span style={{
                    background: 'linear-gradient(135deg, #ddd6fe 0%, #c7d2fe 100%)',
                    color: '#5b21b6',
                    padding: '2px 10px',
                    borderRadius: '9999px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textTransform: 'capitalize'
                  }}>
                    {occasion.recipientRelationship || '-'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Recipient Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
        }}
        title="Add New Recipient"
        size="lg"
      >
        <ContactForm
          onSubmit={handleAddRecipient}
          onCancel={() => {
            setShowAddModal(false);
            try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch (e) {}
          }}
        />
      </Modal>

      {/* Edit Recipient Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingContact(null);
        }}
        title="Edit Recipient"
        size="lg"
      >
        <ContactForm
          contact={editingContact}
          onSubmit={handleEditRecipient}
          onCancel={() => {
            setShowEditModal(false);
            setEditingContact(null);
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
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9375rem' }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
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
