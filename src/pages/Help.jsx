// src/pages/Help.jsx — W41 / checklist #20: static customer Help & Quick Start page (/help).
// Styled like Support.jsx. All copy lives in ./helpContent.js; the plans table is read from config/plans.js.
import GreetMeLogo from '../components/GreetMeLogo';
import {
  HELP_INTRO, QUICK_START_STEPS, FAQ, PLANS_INTRO, FOUNDERS_PRICING_NOTE, PLAN_COLUMNS, helpPlanRows,
} from './helpContent';

const card = { background: 'white', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
const h2 = { fontSize: '1.375rem', fontWeight: 700, color: '#1a1a2e', margin: '2rem 0 1rem' };
const h3 = { fontSize: '1.0625rem', fontWeight: 700, color: '#1a1a2e', margin: '0 0 0.5rem' };
const p = { fontSize: '0.9375rem', color: '#555', lineHeight: 1.6, margin: 0 };
const cell = { padding: '0.5rem 0.625rem', borderBottom: '1px solid #e5e7eb', textAlign: 'left', fontSize: '0.875rem', color: '#444', verticalAlign: 'top' };

// Renders `**label**` as bold; everything else as plain text.
function Rich({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ color: '#1a1a2e' }}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  ));
}

export default function Help() {
  const rows = helpPlanRows();
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f8f9fa' }}>
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem', textAlign: 'center' }}>
        <GreetMeLogo size="medium" clickable={true} variant="light" />
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '2rem 1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.5rem' }}>Greet-Me™ Help</h1>

        <section data-testid="help-quick-start">
          <h2 style={h2}>Quick Start</h2>
          <div style={card}>
            <h3 style={h3}>{HELP_INTRO.title}</h3>
            <p style={p}>{HELP_INTRO.body}</p>
          </div>
          {QUICK_START_STEPS.map((s, i) => (
            <div key={s.title} style={card} data-testid="help-step">
              <h3 style={h3}>{i + 1}. {s.title}</h3>
              <p style={p}><Rich text={s.body} /></p>
            </div>
          ))}
        </section>

        <section data-testid="help-faq">
          <h2 style={h2}>FAQ</h2>
          {FAQ.map((f) => (
            <div key={f.q} style={card} data-testid="help-faq-item">
              <h3 style={h3}>{f.q}</h3>
              <p style={p}><Rich text={f.a} /></p>
            </div>
          ))}
        </section>

        <section data-testid="help-plans">
          <h2 style={h2}>Plans at a glance</h2>
          <div style={card}>
            <p style={{ ...p, marginBottom: '1rem' }}>{PLANS_INTRO}</p>
            <div style={{ overflowX: 'auto' }}>
              <table data-testid="help-plans-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
                <thead>
                  <tr>{PLAN_COLUMNS.map(([key, label]) => <th key={key} style={{ ...cell, fontWeight: 700, color: '#1a1a2e' }}>{label}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.planTier} data-testid="help-plan-row">
                      {PLAN_COLUMNS.map(([key]) => <td key={key} style={cell}>{r[key] ?? '-'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ ...p, marginTop: '1rem', fontSize: '0.8125rem', fontStyle: 'italic' }}>{FOUNDERS_PRICING_NOTE}</p>
          </div>
        </section>
      </div>

      <footer style={{ textAlign: 'center', padding: '1.5rem', color: '#999', fontSize: '0.8125rem' }}>
        <p>&copy; 2026 Greet-Me™. All rights reserved. &middot; <a href="#/support" style={{ color: '#999', textDecoration: 'underline' }}>Support</a> &middot; <a href="#/legal" style={{ color: '#999', textDecoration: 'underline' }}>Legal</a></p>
      </footer>
    </div>
  );
}
