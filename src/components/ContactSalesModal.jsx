// src/components/ContactSalesModal.jsx
// Shared Contact Sales form modal — used by ForBusiness AND the Hero page. Self-contained
// (owns its own form state) and rendered in place, so it opens OVER whatever page mounts
// it; closing / cancelling / submitting leaves the user on that same page (no navigation).
// Behavior is a faithful port of the original inline ForBusiness modal: simulated submit →
// success screen → auto-close after 2s. No backend/API/payment — submit is a client stub.
import { useState } from 'react';
import { X, Building2, Users, Mail, Phone, MessageSquare } from 'lucide-react';

const EMPTY = { companyName: '', contactName: '', email: '', phone: '', employeeCount: '', message: '' };

export default function ContactSalesModal({
  isOpen,
  onClose,
  title = 'Contact Sales',
  subtitle = "Let's create your corporate gifting program",
}) {
  const [contactFormData, setContactFormData] = useState(EMPTY);
  const [formSubmitted, setFormSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleContactSubmit = (e) => {
    e.preventDefault();
    // Simulate form submission (behavior preserved from the original ForBusiness form).
    console.log('Contact form submitted:', contactFormData);
    setFormSubmitted(true);
    setTimeout(() => {
      onClose();
      setFormSubmitted(false);
      setContactFormData(EMPTY);
    }, 2000);
  };

  const labelStyle = {
    display: 'block', fontSize: '0.875rem', fontWeight: 600,
    color: 'var(--text-primary)', marginBottom: '0.5rem',
  };
  const inputStyle = {
    width: '100%', padding: '0.75rem', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit',
  };
  const iconStyle = { display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)', zIndex: 999, backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'white', borderRadius: 'var(--radius-xl)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        zIndex: 1000, width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderTopLeftRadius: 'var(--radius-xl)', borderTopRightRadius: 'var(--radius-xl)', color: 'white',
        }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, marginBottom: '0.25rem' }}>{title}</h2>
            <p style={{ fontSize: '0.875rem', opacity: 0.9, margin: 0 }}>{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)', border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '50%', width: '2.5rem', height: '2.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s', color: 'white',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {formSubmitted ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{
                width: '4rem', height: '4rem', borderRadius: '50%',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem', fontSize: '2rem',
              }}>
                ✓
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Thank You!</h3>
              <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Our sales team will be in touch within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit}>
              {/* Company Name */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>
                  <Building2 size={14} style={iconStyle} /> Company Name *
                </label>
                <input
                  type="text" required value={contactFormData.companyName}
                  onChange={(e) => setContactFormData({ ...contactFormData, companyName: e.target.value })}
                  style={inputStyle} placeholder="Your company name"
                />
              </div>

              {/* Contact Name */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>
                  <Users size={14} style={iconStyle} /> Your Name *
                </label>
                <input
                  type="text" required value={contactFormData.contactName}
                  onChange={(e) => setContactFormData({ ...contactFormData, contactName: e.target.value })}
                  style={inputStyle} placeholder="Your full name"
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>
                  <Mail size={14} style={iconStyle} /> Email Address *
                </label>
                <input
                  type="email" required value={contactFormData.email}
                  onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                  style={inputStyle} placeholder="you@company.com"
                />
              </div>

              {/* Phone */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>
                  <Phone size={14} style={iconStyle} /> Phone Number
                </label>
                <input
                  type="tel" value={contactFormData.phone}
                  onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                  style={inputStyle} placeholder="(555) 123-4567"
                />
              </div>

              {/* Employee Count */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Number of Employees</label>
                <select
                  value={contactFormData.employeeCount}
                  onChange={(e) => setContactFormData({ ...contactFormData, employeeCount: e.target.value })}
                  style={{ ...inputStyle, background: 'white' }}
                >
                  <option value="">Select range...</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-500">201-500</option>
                  <option value="500+">500+</option>
                </select>
              </div>

              {/* Message */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>
                  <MessageSquare size={14} style={iconStyle} /> How can we help?
                </label>
                <textarea
                  value={contactFormData.message}
                  onChange={(e) => setContactFormData({ ...contactFormData, message: e.target.value })}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Tell us about your gifting needs..."
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  width: '100%', padding: '1rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white',
                  border: 'none', borderRadius: 'var(--radius-lg)', fontSize: '1rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)', fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                }}
              >
                Submit Request
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
