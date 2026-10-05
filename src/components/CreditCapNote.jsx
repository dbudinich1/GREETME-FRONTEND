// src/components/CreditCapNote.jsx
//
// One plain, warm line shown next to an applied referral credit ONLY when the server says the credit was
// capped (referralCreditCapped === true, a strict boolean). The amount shown elsewhere is always the
// effective one; this line just explains why it is $5.
export const CREDIT_CAP_NOTE_TEXT = 'Credits are worth up to $5 each.';

export default function CreditCapNote({ capped, style }) {
  if (capped !== true) return null;
  return (
    <p data-testid="credit-cap-note" style={{ fontSize: '0.75rem', color: 'inherit', opacity: 0.85, margin: '0.25rem 0 0.5rem', lineHeight: 1.4, ...style }}>
      {CREDIT_CAP_NOTE_TEXT}
    </p>
  );
}
