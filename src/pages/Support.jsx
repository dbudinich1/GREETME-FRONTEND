import GreetMeLogo from '../components/GreetMeLogo';

export default function Support() {
  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#f8f9fa'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <GreetMeLogo size="medium" clickable={true} variant="light" />
      </div>

      {/* Content */}
      <div style={{
        maxWidth: '700px',
        margin: '0 auto',
        padding: '2rem 1.5rem'
      }}>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: '#1a1a2e',
          marginBottom: '0.5rem'
        }}>
          Greet-Me™ Support
        </h1>

        <p style={{
          fontSize: '1rem',
          color: '#555',
          lineHeight: 1.6,
          marginBottom: '2rem'
        }}>
          Need help? Reach us at{' '}
          <a href="mailto:support@greet-me.com" style={{ color: '#667eea', fontWeight: 600 }}>
            support@greet-me.com
          </a>
          . We respond within 48 hours.
        </p>

        {/* Billing & Subscription */}
        <section style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1a1a2e', marginTop: 0 }}>
            Billing & Subscription
          </h2>
          <p style={{ fontSize: '0.9375rem', color: '#555', lineHeight: 1.6, margin: 0 }}>
            You can manage your subscription plan directly from your dashboard. For refund requests,
            billing questions, or plan changes that require assistance, contact us at{' '}
            <a href="mailto:support@greet-me.com" style={{ color: '#667eea' }}>support@greet-me.com</a>
            {' '}with your account email and a brief description.
          </p>
        </section>

        {/* Technical Issues */}
        <section style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1a1a2e', marginTop: 0 }}>
            Technical Issues
          </h2>
          <p style={{ fontSize: '0.9375rem', color: '#555', lineHeight: 1.6, margin: 0 }}>
            Experiencing a bug or something not working as expected? Please email us at{' '}
            <a href="mailto:support@greet-me.com" style={{ color: '#667eea' }}>support@greet-me.com</a>
            {' '}and include your account email, a description of the issue, and the device or browser
            you are using. Screenshots are always helpful.
          </p>
        </section>

        {/* General Inquiries */}
        <section style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1a1a2e', marginTop: 0 }}>
            General Inquiries
          </h2>
          <p style={{ fontSize: '0.9375rem', color: '#555', lineHeight: 1.6, margin: 0 }}>
            For partnerships, press inquiries, or general questions about Greet-Me™, reach out to{' '}
            <a href="mailto:support@greet-me.com" style={{ color: '#667eea' }}>support@greet-me.com</a>.
            We are happy to hear from you.
          </p>
        </section>
      </div>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '1.5rem',
        color: '#999',
        fontSize: '0.8125rem'
      }}>
        <p>&copy; 2026 Greet-Me™. All rights reserved.</p>
      </footer>
    </div>
  );
}
