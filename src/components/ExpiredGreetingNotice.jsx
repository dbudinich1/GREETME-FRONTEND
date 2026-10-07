// Shown when the public greeting API answers 410 GREETING_EXPIRED (recipient window is 30 days).
// Gift and credit claims keep working after the greeting media expires, so the 410 body carries
// pointers to them; each link renders only when the server supplied it.
export const EXPIRED_GREETING_COPY = 'This greeting was available for 30 days and is no longer available.';

export default function ExpiredGreetingNotice({ claim }) {
  const giftClaimUrl = claim?.giftClaimUrl || null;
  const courtesyCreditCode = claim?.courtesyCreditCode || null;
  const linkStyle = {
    display: 'inline-block',
    margin: '0 6px 10px',
    padding: '10px 22px',
    background: '#1B2A4A',
    color: '#FFF',
    borderRadius: '8px',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '0.95rem',
  };
  return (
    <>
      <p data-testid="expired-copy" style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
        {EXPIRED_GREETING_COPY}
      </p>
      {(giftClaimUrl || courtesyCreditCode) && (
        <div style={{ margin: '0 0 1.25rem' }}>
          {giftClaimUrl && (
            <a data-testid="expired-claim-gift" href={giftClaimUrl} style={linkStyle}>Claim your gift</a>
          )}
          {courtesyCreditCode && (
            <a data-testid="expired-claim-credit" href={`/#/claim-credit/${encodeURIComponent(courtesyCreditCode)}`} style={linkStyle}>Claim your $5 credit</a>
          )}
        </div>
      )}
    </>
  );
}
