// src/pages/QAInspector.jsx
// Internal QA Inspector — visual permutation viewer for founder review
// Route: /#/qa (not linked in customer-facing nav)

import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE;
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || '';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Centralized sample data — edit these to match real test records
const QA = {
  testJobId: localStorage.getItem('greetme_onboarding_test_jobId') || 'demo-job-id',
  validGiftCode: 'demo-valid-g1g1',
  invalidGiftCode: 'invalid-code-xyz',
  claimedGiftCode: 'demo-claimed-code',
  testCreditCode: 'demo-credit-code',
  senderName: 'Daniel Budinich',
  recipientName: 'Sarah Johnson',
};

const SECTIONS = [
  {
    title: 'Flow Scenarios',
    badge: 'Flow',
    color: '#6366f1',
    items: [
      { id: 1, name: 'Direct Signup', desc: 'Normal registration with name fields', actions: [{ label: 'Open', href: '/#/register' }] },
      { id: 2, name: 'Fast Signup', desc: 'Viral entry — email + password only', actions: [{ label: 'Open', href: '/#/register?fast=1' }] },
      { id: 3, name: 'G1G1 Claim Page', desc: 'Gift claim with valid code', actions: [{ label: 'Open', href: `/#/gift/g1g1/${QA.validGiftCode}` }] },
      { id: 4, name: 'Public Share Viewer', desc: 'Greeting card viewer (shared link)', actions: [{ label: 'Open', href: `/#/g/${QA.testJobId}` }] },
      { id: 5, name: 'Viewer → Create Yours CTA', desc: 'Below-card CTA on public viewer', actions: [{ label: 'Open Viewer', href: `/#/g/${QA.testJobId}` }] },
      { id: 6, name: 'Send Flow (Prefilled)', desc: 'Send page with occasion=just_because', actions: [{ label: 'Open', href: '/#/dashboard/send?occasion=just_because' }] },
      { id: 7, name: 'Post-Send Success', desc: '"You just made someone\'s day" screen', note: 'Requires completing a real send' },
      { id: 8, name: 'Thank-You Flow', desc: 'Prefilled thank-you with jobId', actions: [{ label: 'Open', href: `/#/thank-you?jobId=${QA.testJobId}` }] },
      { id: 9, name: 'Credit Claim Page', desc: 'QR credit landing page', actions: [{ label: 'Open', href: `/#/claim-credit/${QA.testCreditCode}` }] },
      { id: 10, name: 'Dashboard Send Entry', desc: 'Normal dashboard send page', actions: [{ label: 'Open', href: '/#/dashboard/send' }] },
    ],
  },
  {
    title: 'Email Previews',
    badge: 'Email',
    color: '#059669',
    items: [
      { id: 11, name: 'Greeting Delivery', desc: 'Parchment card with wax seal', email: 'greeting-delivery', note: 'Custom HTML in worker.js — not rendered via template endpoint. Send a real greeting to inspect.' },
      { id: 12, name: 'Greeting Opened (T6)', desc: '"They opened it" — to sender', email: 'greeting-opened' },
      { id: 13, name: 'G1G1 Gift Email (T5)', desc: 'Gift membership notification', email: 'g1g1-recipient' },
      { id: 14, name: 'Subscription Started (T4)', desc: '"You\'re all set" confirmation', email: 'subscription-started' },
      { id: 15, name: 'Credit Unlocked (T2)', desc: '$10 credit notification', email: 'credit-unlocked' },
      { id: 16, name: 'Credit Reminder 24h (R1)', desc: '48 hours left warning', email: 'credit-24h' },
      { id: 17, name: 'Credit Reminder 48h (R2)', desc: '24 hours left', email: 'credit-48h' },
      { id: 18, name: 'Credit Reminder Final (R3)', desc: 'Expires tonight', email: 'credit-final' },
      { id: 19, name: 'Complete the Moment (T7)', desc: 'Recovery — your turn to send', email: 'complete-the-moment' },
      { id: 20, name: 'Gift Delivered (T1)', desc: '"You just made someone\'s day"', email: 'gift-delivered' },
      { id: 21, name: 'Gift It Forward (T3)', desc: '"Pass it on"', email: 'gift-forward' },
      { id: 22, name: 'Milestone (1st send)', desc: '"Your first Greet-Me just landed"', email: 'milestone-1' },
      { id: 23, name: 'Milestone (5th send)', desc: '"Five people felt remembered"', email: 'milestone-5' },
      { id: 24, name: 'Recovery Post-Claim', desc: '"That gift you sent? It landed."', email: 'recovery-post-claim' },
      { id: 25, name: 'Recovery Post-ThankYou', desc: '"One more step"', email: 'recovery-post-thankyou' },
      { id: 26, name: 'Recovery Dismissed', desc: '"This moment is still waiting"', email: 'recovery-dismissed' },
      { id: 27, name: 'Claim Received', desc: 'Gift delivery confirmation', email: 'claim-received' },
      { id: 28, name: 'Claim Sent', desc: 'Gift payout confirmation', email: 'claim-sent' },
    ],
  },
  {
    title: 'Edge / State Scenarios',
    badge: 'Edge',
    color: '#dc2626',
    items: [
      { id: 29, name: 'Invalid Claim Token', desc: '404 — gift not found', actions: [{ label: 'Open', href: `/#/gift/g1g1/${QA.invalidGiftCode}` }] },
      { id: 30, name: 'Already Claimed Gift', desc: '409 — already claimed', actions: [{ label: 'Open', href: `/#/gift/g1g1/${QA.claimedGiftCode}` }], note: 'Requires a real claimed gift code' },
      { id: 31, name: 'Invalid Credit Code', desc: 'Credit not found', actions: [{ label: 'Open', href: '/#/claim-credit/invalid-credit-xyz' }] },
      { id: 32, name: 'Login Page', desc: 'Standard login', actions: [{ label: 'Open', href: '/#/login' }] },
      { id: 33, name: 'Forgot Password', desc: 'Password reset flow', actions: [{ label: 'Open', href: '/#/forgot-password' }] },
      { id: 34, name: 'Legal Page', desc: 'Terms + Privacy', actions: [{ label: 'Open', href: '/#/legal' }] },
      { id: 35, name: 'Founder Dashboard', desc: 'Admin health monitor', actions: [{ label: 'Open', href: '/#/admin' }] },
    ],
  },
];

export default function QAInspector() {
  const [emailPreview, setEmailPreview] = useState(null);
  const [filter, setFilter] = useState('');

  const openEmail = (type) => {
    setEmailPreview(`${API_BASE}/api/admin/email-preview/${type}?_k=${ADMIN_KEY}`);
  };

  const filtered = filter.trim()
    ? SECTIONS.map(s => ({ ...s, items: s.items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()) || i.desc.toLowerCase().includes(filter.toLowerCase())) })).filter(s => s.items.length > 0)
    : SECTIONS;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: FONT, padding: '2rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>QA Inspector</h1>
            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>
              {SECTIONS.reduce((n, s) => n + s.items.length, 0)} scenarios · Click to inspect
            </p>
          </div>
          <input
            type="text"
            placeholder="Filter scenarios..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem', background: '#1e293b', color: '#e2e8f0',
              border: '1px solid #334155', borderRadius: '6px', fontSize: '0.875rem',
              fontFamily: FONT, width: '220px',
            }}
          />
        </div>

        {/* Sections */}
        {filtered.map((section) => (
          <div key={section.title} style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', background: section.color, borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>{section.badge}</span>
              {section.title} ({section.items.length})
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
              {section.items.map((item) => (
                <div key={item.id} style={{
                  background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
                  padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
                        <span style={{ color: '#64748b', marginRight: '0.5rem' }}>#{item.id}</span>{item.name}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>{item.desc}</p>
                    </div>
                  </div>
                  {item.note && (
                    <p style={{ fontSize: '0.6875rem', color: '#f59e0b', margin: 0, fontStyle: 'italic' }}>{item.note}</p>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                    {item.actions?.map((action, ai) => (
                      <a key={ai} href={action.href} target="_blank" rel="noopener noreferrer" style={{
                        padding: '4px 12px', background: '#334155', color: '#e2e8f0',
                        border: '1px solid #475569', borderRadius: '4px', fontSize: '0.75rem',
                        textDecoration: 'none', fontFamily: FONT, cursor: 'pointer',
                      }}>
                        {action.label}
                      </a>
                    ))}
                    {item.email && (
                      <button onClick={() => openEmail(item.email)} style={{
                        padding: '4px 12px', background: '#065f46', color: '#d1fae5',
                        border: '1px solid #059669', borderRadius: '4px', fontSize: '0.75rem',
                        fontFamily: FONT, cursor: 'pointer',
                      }}>
                        Preview Email
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Email Preview Modal */}
        {emailPreview && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '2rem',
          }} onClick={() => setEmailPreview(null)}>
            <div style={{
              background: '#fff', borderRadius: '12px', width: '100%',
              maxWidth: '640px', maxHeight: '90vh', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{
                padding: '0.75rem 1rem', background: '#f1f5f9', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0',
              }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>Email Preview</span>
                <button onClick={() => setEmailPreview(null)} style={{
                  background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b',
                }}>
                  &times;
                </button>
              </div>
              <iframe
                src={emailPreview}
                title="Email Preview"
                style={{ width: '100%', flex: 1, minHeight: '500px', border: 'none' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
