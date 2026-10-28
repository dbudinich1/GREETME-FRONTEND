// src/pages/fundraiser/organizations/InquiryDialog.jsx
// The organization inquiry form behind every "Let’s Grow Together" (founder handoff 2026-10-28). The supplied form's
// fields and copy are kept (name, organization, organization type, email, optional message). The Base44 call is replaced
// by the application's existing, authorized inquiry route: POST /api/contact-sales through api.contactSales, with the
// accepted source "fundraiser" — the same route the Fundraisers page's Contact Greet-Me used (request rules: inquiry.js).
// That route emails the inquiry to Greet-Me's sales inbox (reply-to the sender) and answers received:true only after the
// email is sent. Success is shown ONLY for a real 200 with received:true (utils/contactSales.js interpretResponse); a
// duplicate, a field error, a rate limit, an unavailable route or a network failure each keep what was typed and say so.
// Mounted only while open, so every opening starts with an empty form.
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import api from '../../../api/api';
import { interpretResponse, LIMITS, FIELD_MESSAGES } from '../../../utils/contactSales';
import { buildInquiryBody, validateInquiry } from './inquiry';
import { ORG_TYPES } from './content';

const EMPTY = { name: '', organization: '', orgType: ORG_TYPES[0].label, email: '', message: '' };

export default function InquiryDialog({ onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [phase, setPhase] = useState('form'); // form | sending | sent | duplicate
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const firstRef = useRef(null);

  // Focus the first field, keep the page behind still, and give focus back to the button that opened the form.
  useEffect(() => {
    const opener = document.activeElement;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => { if (firstRef.current) firstRef.current.focus(); }, 0);
    return () => {
      window.clearTimeout(t); document.body.style.overflow = prev;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  const sending = phase === 'sending';
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sending, onClose]);

  const update = (field) => (e) => { const v = e.target.value; setForm((f) => ({ ...f, [field]: v })); setErrors((x) => (x[field] ? { ...x, [field]: undefined } : x)); };

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const found = validateInquiry(form);
    if (Object.keys(found).length) {
      setErrors(found);
      setFormError('Please add your name, your organization and an email we can reply to.');
      return;
    }
    setErrors({}); setFormError(''); setPhase('sending');
    let outcome;
    try { outcome = interpretResponse(await api.contactSales(buildInquiryBody(form, honeypot))); }
    catch { outcome = interpretResponse({ networkError: true }); }
    if (outcome.kind === 'success') return setPhase('sent');
    if (outcome.kind === 'duplicate') return setPhase('duplicate');
    setPhase('form');
    if (outcome.kind === 'invalid') {
      const map = { name: 'name', email: 'email', organization: 'organization', message: 'message' };
      const f = map[outcome.field];
      if (f) setErrors({ [f]: FIELD_MESSAGES[outcome.field] });
      setFormError('That did not go through. Please check the highlighted field and try again.');
      return;
    }
    setFormError(outcome.message || 'That did not go through. Please try again.');
  };

  const field = (key, label, input) => (
    <div className="frp-field">
      <label htmlFor={`frp-inq-${key}`}>{label}</label>
      {input}
      {errors[key] ? <span className="frp-field-err" id={`frp-inq-${key}-err`} role="alert">{errors[key]}</span> : null}
    </div>
  );
  const aria = (key) => ({ id: `frp-inq-${key}`, 'aria-invalid': errors[key] ? 'true' : undefined, 'aria-describedby': errors[key] ? `frp-inq-${key}-err` : undefined });

  return (
    <>
      <div className="frp-backdrop" onClick={() => { if (!sending) onClose(); }} aria-hidden="true" />
      <div className="frp-dialog" role="dialog" aria-modal="true" aria-labelledby="frp-inq-title" data-testid="frp-inquiry">
        <button type="button" className="frp-x" aria-label="Close" onClick={onClose} disabled={sending} data-testid="frp-inquiry-close"><X size={16} /></button>
        {phase === 'sent' || phase === 'duplicate' ? (
          <div data-testid={phase === 'sent' ? 'frp-inquiry-sent' : 'frp-inquiry-duplicate'} style={{ padding: '8px 0' }}>
            <p className="frp-script">thank you</p>
            <h2 id="frp-inq-title" className="frp-dlg-title">
              {phase === 'sent' ? `${form.name.trim().split(/\s+/)[0]}, your inquiry has been received.` : 'We already have this inquiry.'}
            </h2>
            <p className="frp-dlg-desc" style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.75 }}>
              {phase === 'sent'
                ? `We have your note about ${form.organization.trim()}. Thank you for thinking about what your organization could make possible.`
                : 'You sent this same inquiry a moment ago and we received it then. Nothing more was sent, and you do not need to send it again.'}
            </p>
            <button type="button" className="frp-submit" style={{ marginTop: 24 }} onClick={onClose} data-testid="frp-inquiry-done">Close</button>
          </div>
        ) : (
          <>
            <p className="frp-script">let’s grow together</p>
            <h2 id="frp-inq-title" className="frp-dlg-title">Tell us about your organization.</h2>
            <p className="frp-dlg-desc">A few details so we can talk about what your organization could make possible.</p>
            <form onSubmit={submit} noValidate>
              <div className="frp-form-row">
                {field('name', 'Your name', <input ref={firstRef} type="text" autoComplete="name" value={form.name} onChange={update('name')} placeholder="Jordan Ellis" maxLength={LIMITS.name} {...aria('name')} />)}
                {field('organization', 'Organization', <input type="text" autoComplete="organization" value={form.organization} onChange={update('organization')} placeholder="Riverside High Boosters" maxLength={LIMITS.organization} {...aria('organization')} />)}
              </div>
              <div className="frp-form-row">
                {field('orgType', 'Organization type', (
                  <select value={form.orgType} onChange={update('orgType')} {...aria('orgType')}>
                    {ORG_TYPES.map((t) => <option key={t.key} value={t.label}>{t.label}</option>)}
                  </select>
                ))}
                {field('email', 'Email', <input type="email" autoComplete="email" value={form.email} onChange={update('email')} placeholder="you@organization.org" maxLength={LIMITS.email} {...aria('email')} />)}
              </div>
              {field('message', 'What would you like to make possible?', (
                <textarea rows={3} value={form.message} onChange={update('message')} placeholder="Scholarships, new uniforms, a spring production…" {...aria('message')} />
              ))}
              {/* Hidden honeypot: empty from a person; a bot that fills it is dropped by the route. */}
              <div className="frp-hp" aria-hidden="true">
                <label htmlFor="frp-inq-website">Website</label>
                <input id="frp-inq-website" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              </div>
              {formError ? <p className="frp-form-err" role="alert" data-testid="frp-inquiry-error">{formError}</p> : null}
              <button type="submit" className="frp-submit" disabled={sending} data-testid="frp-inquiry-submit">
                {sending ? 'Sending…' : <>Send my inquiry <ArrowRight size={16} aria-hidden="true" /></>}
              </button>
            </form>
          </>
        )}
      </div>
    </>
  );
}
