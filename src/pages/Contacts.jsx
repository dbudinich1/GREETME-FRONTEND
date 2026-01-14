// src/pages/Contacts.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Upload, Search, Edit, Trash2, ArrowLeft, Users, Calendar, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from "../api/api";
import Modal from '../components/Modal';
import ContactForm from '../components/ContactForm';
import CSVImport from '../components/CSVImport';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import Alert from '../components/Alert';
import { getOccasionIcon, getOccasionLabel } from '../utils/helpers';

export default function Recipients() {
  const navigate = useNavigate();
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [alert, setAlert] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewMode, setViewMode] = useState('recipients'); // 'recipients' or 'occasions'

  useEffect(() => {
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    try {
      setLoading(true);
      const response = await api.getContacts();

      // If API returns 401, use localStorage as fallback
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

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleAddRecipient = async (contactData) => {
    try {
      const response = await api.createContact(contactData);

      // Create recipient object with ID
      const newRecipient = {
        id: response?.data?.id || Date.now(),
        ...contactData,
        createdAt: new Date().toISOString()
      };

      // Immediately append to state for instant feedback
      setRecipients(prev => {
        const updated = [...prev, newRecipient];
        // Save to localStorage as fallback
        localStorage.setItem('greetme_recipients', JSON.stringify(updated));
        return updated;
      });

      showAlert('success', 'Recipient added successfully');
      setShowAddModal(false);

      // Also refetch to ensure sync with server if API is working
      if (response && response.data) {
        fetchRecipients();
      }
    } catch (error) {
      console.error('Add recipient error:', error);

      // If API fails, still save locally
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

      showAlert('success', 'Recipient added (stored locally - backend unavailable)');
      setShowAddModal(false);
    }
  };

  const handleEditRecipient = async (contactData) => {
    try {
      await api.updateContact(editingContact.id, contactData);
      showAlert('success', 'Recipient updated successfully');
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
      showAlert('success', 'Recipient deleted successfully');
      setDeleteConfirm(null);
      fetchRecipients();
    } catch (error) {
      showAlert('error', 'Failed to delete recipient');
    }
  };

  const handleImportRecipients = async (contactsToImport) => {
    try {
      const promises = contactsToImport.map(contact => api.createContact(contact));
      await Promise.all(promises);
      showAlert('success', `${contactsToImport.length} recipients imported successfully`);
      setShowImportModal(false);
      fetchRecipients();
    } catch (error) {
      throw new Error('Failed to import recipients');
    }
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setShowEditModal(true);
  };

  const filteredRecipients = recipients.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner text="Loading recipients..." />;
  }

  return (
    <div>
      {/* Header with Gradient Background */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '1rem',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)'
      }}>
        <div className="flex items-center justify-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.5rem',
                height: '2.5rem',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 style={{
                fontSize: '2rem',
                fontWeight: 700,
                color: 'white',
                marginBottom: '0.5rem'
              }}>Recipients</h1>
              <p style={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '1rem'
              }}>Manage your contacts and their special occasions</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem 1.25rem',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '0.75rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              <Upload size={18} className="mr-2" />
              Import CSV
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem 1.25rem',
                background: 'white',
                color: '#667eea',
                border: 'none',
                borderRadius: '0.75rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
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
              <Plus size={18} className="mr-2" />
              Add Recipient
            </button>
          </div>
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {/* View Toggle and Search */}
      {recipients.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          {/* View Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <div style={{
              display: 'inline-flex',
              background: 'var(--gray-100)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.25rem'
            }}>
              <button
                onClick={() => setViewMode('recipients')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1rem',
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
                  gap: '0.5rem',
                  padding: '0.625rem 1rem',
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={viewMode === 'recipients' ? "Search recipients..." : "Search occasions..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Empty State */}
      {recipients.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No recipients yet"
          description="Start by adding your first recipient or import from CSV"
          action={
            <div className="flex space-x-3 justify-center">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-6 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 font-medium"
              >
                Import CSV
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium"
              >
                Add Your First Recipient
              </button>
            </div>
          }
        />
      ) : viewMode === 'recipients' ? (
        /* Recipients Table */
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-purple-100">
          <table className="w-full">
            <thead style={{
              background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
              borderBottom: '2px solid #d1d5db'
            }}>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wide">Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wide">Email</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wide">Relationship</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-purple-700 uppercase tracking-wide">Gift</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wide">Occasions</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-purple-700 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecipients.map((contact, index) => (
                <tr
                  key={contact.id}
                  style={{
                    background: index % 2 === 0 ? 'white' : '#faf5ff',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f3e8ff';
                    e.currentTarget.style.transform = 'scale(1.01)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#faf5ff';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <td className="px-6 py-4">
                    <span style={{
                      fontWeight: 600,
                      color: '#1f2937',
                      fontSize: '0.9375rem'
                    }}>{contact.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span style={{
                      color: '#4b5563',
                      fontSize: '0.875rem',
                      fontFamily: 'monospace',
                      background: '#f3f4f6',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.375rem'
                    }}>{contact.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span style={{
                      background: 'linear-gradient(135deg, #ddd6fe 0%, #c7d2fe 100%)',
                      color: '#5b21b6',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      display: 'inline-block'
                    }}>
                      {contact.relationship || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {contact.giftSelected ? (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                          boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)'
                        }}
                        title="Gift selected"
                      >
                        <Gift size={16} style={{ color: 'white' }} />
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--gray-100)',
                          border: '2px dashed var(--gray-300)'
                        }}
                        title="No gift selected"
                      >
                        <Gift size={16} style={{ color: 'var(--gray-400)' }} />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {contact.occasions?.length > 0 ? (
                      <div className="flex space-x-1">
                        {contact.occasions.slice(0, 3).map((occasion, idx) => (
                          <span
                            key={idx}
                            title={getOccasionLabel(occasion.type)}
                            className="text-lg"
                          >
                            {getOccasionIcon(occasion.type)}
                          </span>
                        ))}
                        {contact.occasions.length > 3 && (
                          <span className="text-gray-400 text-xs">+{contact.occasions.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <button
                      onClick={() => openEditModal(contact)}
                      style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: 'white',
                        padding: '0.5rem 0.875rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        marginRight: '0.75rem',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
                      }}
                    >
                      <Edit size={14} className="mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(contact)}
                      style={{
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: 'white',
                        padding: '0.5rem 0.875rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)';
                      }}
                    >
                      <Trash2 size={14} className="mr-1" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRecipients.length === 0 && searchTerm && (
            <div className="text-center py-12">
              <p className="text-gray-500">No recipients match "{searchTerm}"</p>
            </div>
          )}
        </div>
      ) : (
        /* Occasions View */
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-purple-100">
          <table className="w-full">
            <thead style={{
              background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
              borderBottom: '2px solid #d1d5db'
            }}>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wide">Occasion</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wide">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wide">Recipient</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wide">Relationship</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                // Flatten all occasions from all recipients
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
                  // Sort by upcoming date
                  const dateA = new Date(a.date || '9999-12-31');
                  const dateB = new Date(b.date || '9999-12-31');
                  return dateA - dateB;
                });

                if (allOccasions.length === 0) {
                  return (
                    <tr>
                      <td colSpan={4} className="text-center py-12">
                        <p className="text-gray-500">
                          {searchTerm ? `No occasions match "${searchTerm}"` : 'No occasions scheduled'}
                        </p>
                      </td>
                    </tr>
                  );
                }

                return allOccasions.map((occasion, index) => (
                  <tr
                    key={`${occasion.contactId}-${occasion.type}-${index}`}
                    style={{
                      background: index % 2 === 0 ? 'white' : '#faf5ff',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3e8ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#faf5ff';
                    }}
                  >
                    <td className="px-6 py-4">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>{getOccasionIcon(occasion.type)}</span>
                        <span style={{
                          fontWeight: 600,
                          color: '#1f2937',
                          fontSize: '0.9375rem',
                          textTransform: 'capitalize'
                        }}>{getOccasionLabel(occasion.type)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span style={{
                        color: '#4b5563',
                        fontSize: '0.875rem',
                        background: '#f3f4f6',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem'
                      }}>
                        {occasion.date ? new Date(occasion.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : 'Not set'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span style={{
                        fontWeight: 600,
                        color: '#1f2937',
                        fontSize: '0.9375rem'
                      }}>{occasion.recipientName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span style={{
                        background: 'linear-gradient(135deg, #ddd6fe 0%, #c7d2fe 100%)',
                        color: '#5b21b6',
                        padding: '0.375rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        display: 'inline-block'
                      }}>
                        {occasion.recipientRelationship || '-'}
                      </span>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Recipient Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Recipient"
        size="lg"
      >
        <ContactForm
          onSubmit={handleAddRecipient}
          onCancel={() => setShowAddModal(false)}
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
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRecipient(deleteConfirm.id)}
                className="px-6 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 font-medium"
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
