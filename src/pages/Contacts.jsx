// src/pages/Contacts.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Upload, Search, Edit, Trash2 } from 'lucide-react';
import api from "../api/api";
import Modal from '../components/Modal';
import ContactForm from '../components/ContactForm';
import CSVImport from '../components/CSVImport';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import Alert from '../components/Alert';
import { getOccasionIcon, getOccasionLabel } from '../utils/helpers';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [alert, setAlert] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await api.getContacts();
      setContacts(response.data || []);
    } catch (error) {
      showAlert('error', 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleAddContact = async (contactData) => {
    try {
      await api.createContact(contactData);
      showAlert('success', 'Contact added successfully');
      setShowAddModal(false);
      fetchContacts();
    } catch (error) {
      throw error;
    }
  };

  const handleEditContact = async (contactData) => {
    try {
      await api.updateContact(editingContact.id, contactData);
      showAlert('success', 'Contact updated successfully');
      setShowEditModal(false);
      setEditingContact(null);
      fetchContacts();
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await api.deleteContact(contactId);
      showAlert('success', 'Contact deleted successfully');
      setDeleteConfirm(null);
      fetchContacts();
    } catch (error) {
      showAlert('error', 'Failed to delete contact');
    }
  };

  const handleImportContacts = async (contactsToImport) => {
    try {
      const promises = contactsToImport.map(contact => api.createContact(contact));
      await Promise.all(promises);
      showAlert('success', `${contactsToImport.length} contacts imported successfully`);
      setShowImportModal(false);
      fetchContacts();
    } catch (error) {
      throw new Error('Failed to import contacts');
    }
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setShowEditModal(true);
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner text="Loading contacts..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 font-medium"
          >
            <Upload size={18} className="mr-2" />
            Import CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium"
          >
            <Plus size={18} className="mr-2" />
            Add Contact
          </button>
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

      {/* Search */}
      {contacts.length > 0 && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Empty State */}
      {contacts.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No contacts yet"
          description="Start by adding your first contact or import from CSV"
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
                Add Your First Contact
              </button>
            </div>
          }
        />
      ) : (
        /* Contacts Table */
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Relationship</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Occasions</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{contact.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{contact.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                    {contact.relationship || '-'}
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
                      className="text-blue-600 hover:text-blue-800 mr-3 inline-flex items-center"
                    >
                      <Edit size={16} className="mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(contact)}
                      className="text-red-600 hover:text-red-800 inline-flex items-center"
                    >
                      <Trash2 size={16} className="mr-1" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredContacts.length === 0 && searchTerm && (
            <div className="text-center py-12">
              <p className="text-gray-500">No contacts match "{searchTerm}"</p>
            </div>
          )}
        </div>
      )}

      {/* Add Contact Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Contact"
        size="lg"
      >
        <ContactForm
          onSubmit={handleAddContact}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* Edit Contact Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingContact(null);
        }}
        title="Edit Contact"
        size="lg"
      >
        <ContactForm
          contact={editingContact}
          onSubmit={handleEditContact}
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
        title="Import Contacts from CSV"
        size="lg"
      >
        <CSVImport
          onImport={handleImportContacts}
          onCancel={() => setShowImportModal(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Contact"
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
                onClick={() => handleDeleteContact(deleteConfirm.id)}
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
