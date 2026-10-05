// src/components/ContactSalesModal.jsx
// Shared Contact Sales form modal (Hero, For Business, Pricing Enterprise, bundle interim). Self-contained and
// rendered in place, so it opens OVER whatever page mounts it; closing leaves the user on that same page.
// It sends a REAL request (POST /api/contact-sales, public) and tells the truth about the outcome:
//   - the success screen appears ONLY for a real 200 that says received (rules in utils/contactSales.js)
//   - 429 / 502 / 503 / network / an unexpected answer = a visible failure, the typed text is kept, "Try again"
//   - 400 puts the message on the named field; a repeat is told it was already received
//   - no timer closes it; the hidden honeypot field is sent empty by a person
import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import api from '../api/api';
import { EMPTY_FORM, FIELD_MESSAGES, buildBody, interpretResponse, validate } from '../utils/contactSales';

const labelStyle = { display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' };
const inputStyle = { width: '100%', padding: '0.7rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box' };
const errStyle = { color: '#b91c1c', fontSize: '0.8125rem', margin: '0.25rem 0 0' };

export default function ContactSalesModal({
  isOpen,
  onClose,
  title = 'Contact Sales',
  subtitle = 'Tell us what you are planning and our team will reply by email',
  source = 'general',
  pageContext = '',
  intro = null,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState({});
  const [phase, setPhase] = useState('form'); // form | sending | success | duplicate
  const [failure, setFailure] = useState(null);
  const lock = useRef(false);
  if (!isOpen) return null;

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined })); };
  const close = () => { setForm(EMPTY_FORM); setHoneypot(''); setErrors({}); setPhase('form'); setFailure(null); lock.current = false; onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return; // double-click guard
    const found = validate(form);
    setErrors(found); setFailure(null);
    if (Object.keys(found).length) return;
    lock.current = true; setPhase('sending');
    const outcome = interpretResponse(await api.contactSales(buildBody({ form, source, pageContext, website: honeypot })));
    lock.current = false;
    if (outcome.kind === 'success') return setPhase('success');
    if (outcome.kind === 'duplicate') return setPhase('duplicate');
    setPhase('form');
    if (outcome.kind === 'invalid') {
      if (outcome.field && FIELD_MESSAGES[outcome.field]) setErrors({ [outcome.field]: FIELD_MESSAGES[outcome.field] });
      else setFailure('Please check the details you entered and try again.');
      return;
    }
    setFailure(outcome.message);
  };

  const field = (k, label, props = {}) => (
    <div style={{ marginBottom: '0.9rem' }}>
      <label style={labelStyle} htmlFor={`cs-${k}`}>{label}</label>
      <input id={`cs-${k}`} data-testid={`cs-${k}`} value={form[k]} onChange={set(k)} style={inputStyle} aria-invalid={Boolean(errors[k])} {...props} />
      {errors[k] && <p data-testid={`cs-error-${k}`} style={errStyle}>{errors[k]}</p>}
    </div>
  );

  return (
    <>
      <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, backdropFilter: 'blur(4px)' }} />
      <div role="dialog" aria-modal="true" data-testid="cs-modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', borderRadius: 'var(--radius-xl)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', zIndex: 1000, width: '92%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '1.1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderTopLeftRadius: 'var(--radius-xl)', borderTopRightRadius: 'var(--radius-xl)' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>{title}</h2>
            <p style={{ fontSize: '0.8125rem', opacity: 0.92, margin: '0.2rem 0 0' }}>{subtitle}</p>
          </div>
          <button type="button" aria-label="Close" data-testid="cs-close-x" onClick={close} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '2.25rem', height: '2.25rem', color: 'white', cursor: 'pointer', padding: 0, flexShrink: 0 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '1.25rem' }}>
          {(phase === 'success' || phase === 'duplicate') ? (
            <div data-testid={phase === 'success' ? 'cs-success' : 'cs-duplicate'} style={{ textAlign: 'center', padding: '1.25rem 0' }}>
              <h3 style={{ fontSize: '1.3rem', margin: '0 0 0.6rem' }}>{phase === 'success' ? 'Message received' : 'We already have this message'}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 1rem' }}>
                {phase === 'success'
                  ? 'Thank you. Our team has your message and will reply to the email address you gave.'
                  : 'You sent this same message a moment ago and we received it then. Nothing more was sent, and you do not need to send it again.'}
              </p>
              <button type="button" data-testid="cs-done" onClick={close} style={{ padding: '0.7rem 1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'white', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              {intro && <p data-testid="cs-intro" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.8125rem', margin: '0 0 1rem', lineHeight: 1.5 }}>{intro}</p>}
              {failure && <div role="alert" data-testid="cs-failure" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.875rem', margin: '0 0 1rem' }}>{failure}</div>}
              {field('name', 'Your name *', { type: 'text', autoComplete: 'name' })}
              {field('email', 'Email address *', { type: 'email', autoComplete: 'email', placeholder: 'you@company.com' })}
              {field('organization', 'Company or organization', { type: 'text', autoComplete: 'organization' })}
              {field('phone', 'Phone (optional)', { type: 'tel', autoComplete: 'tel' })}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle} htmlFor="cs-message">How can we help? *</label>
                <textarea id="cs-message" data-testid="cs-message" value={form.message} onChange={set('message')} rows={4} style={{ ...inputStyle, resize: 'vertical' }} aria-invalid={Boolean(errors.message)} placeholder="Tell us about your gifting needs..." />
                {errors.message && <p data-testid="cs-error-message" style={errStyle}>{errors.message}</p>}
              </div>
              {/* Honeypot: a person never sees or fills this. Sent as-is; the server drops a filled one. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
                <label htmlFor="cs-website">Website</label>
                <input id="cs-website" data-testid="cs-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              </div>
              <button type="submit" data-testid="cs-submit" disabled={phase === 'sending'} style={{ width: '100%', padding: '0.9rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: '1rem', fontWeight: 600, cursor: phase === 'sending' ? 'wait' : 'pointer', opacity: phase === 'sending' ? 0.7 : 1, fontFamily: 'inherit' }}>
                {phase === 'sending' ? 'Sending...' : failure ? 'Try again' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
