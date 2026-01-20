// src/components/QRCashGiftModal.jsx
import { useState, useEffect } from 'react';
import { X, Copy, Download, QrCode, ChevronDown, Bell } from 'lucide-react';
import QRCode from 'qrcode';
import GreetMeLogo from './GreetMeLogo';

export default function QRCashGiftModal({ isOpen, onClose }) {
  const DEFAULT_GREETING = 'Just a little something for you — hope it makes your day a bit brighter.';

  const [amount, setAmount] = useState('10');
  const [customAmount, setCustomAmount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState(DEFAULT_GREETING);
  const [includeGreeting, setIncludeGreeting] = useState(true);
  // Default to 'auto' if email exists, 'manual' otherwise
  const [deliveryMethod, setDeliveryMethod] = useState('manual'); // Will update based on email
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [redeemUrl, setRedeemUrl] = useState(null);
  const [giftId, setGiftId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [autoSent, setAutoSent] = useState(false);
  const [savedRecipients, setSavedRecipients] = useState([]);
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

  const presetAmounts = ['5', '10', '25'];

  // Load saved recipients from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('greetme_recipients');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSavedRecipients(parsed);
      } catch (e) {
        console.error('Error loading recipients:', e);
      }
    }
  }, [isOpen]);

  // Auto-update delivery method when email changes
  useEffect(() => {
    if (recipientEmail && recipientEmail.trim() !== '') {
      setDeliveryMethod('auto');
    } else {
      setDeliveryMethod('manual');
    }
  }, [recipientEmail]);

  const handleGenerateQR = async () => {
    // Generate unique gift ID
    const id = `qr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get final amount
    const finalAmount = amount === 'custom' ? customAmount : amount;

    if (!finalAmount || parseFloat(finalAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    // Create redeem URL
    const url = `${window.location.origin}/redeem/qr-cash/${id}`;

    // Generate QR code
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#f59e0b',
          light: '#ffffff'
        }
      });

      // Store gift data in localStorage
      const existingGifts = JSON.parse(localStorage.getItem('greetme_qrcash_gifts') || '[]');
      const newGift = {
        id,
        amount: finalAmount,
        recipientName: recipientName || 'Anonymous',
        recipientEmail: recipientEmail || '',
        message: includeGreeting ? message : '',
        createdAt: new Date().toISOString(),
        redeemed: false
      };
      existingGifts.push(newGift);
      localStorage.setItem('greetme_qrcash_gifts', JSON.stringify(existingGifts));

      setQrCodeUrl(qrDataUrl);
      setRedeemUrl(url);
      setGiftId(id);

      // If auto-send is selected, simulate sending
      if (deliveryMethod === 'auto') {
        // Simulate email/SMS send delay
        setTimeout(() => {
          setAutoSent(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code. Please try again.');
    }
  };

  const handleCopyLink = () => {
    if (redeemUrl) {
      navigator.clipboard.writeText(redeemUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQR = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.download = `qr-cash-gift-${giftId}.png`;
      link.href = qrCodeUrl;
      link.click();
    }
  };

  const handleReset = () => {
    setAmount('10');
    setCustomAmount('');
    setRecipientName('');
    setRecipientEmail('');
    setMessage(DEFAULT_GREETING);
    setIncludeGreeting(true);
    setDeliveryMethod('manual');
    setQrCodeUrl(null);
    setRedeemUrl(null);
    setGiftId(null);
    setCopied(false);
    setAutoSent(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleToggleGreeting = (e) => {
    const checked = e.target.checked;
    setIncludeGreeting(checked);
    if (checked && message === '') {
      setMessage(DEFAULT_GREETING);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          backdropFilter: 'blur(4px)'
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderTopRightRadius: 'var(--radius-xl)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <GreetMeLogo size="small" clickable={false} />
            <div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                margin: 0,
                marginBottom: '0.25rem'
              }}>Send QR Cash</h2>
              <p style={{
                fontSize: '0.875rem',
                opacity: 0.9,
                margin: 0
              }}>Send · Scan · Spend</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '9999px',
              padding: '0.5rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              color: 'white',
              fontFamily: 'inherit',
              flexShrink: 0,
              fontSize: '0.875rem',
              fontWeight: 600
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            title="Close"
          >
            <X size={16} />
            Close
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {!qrCodeUrl ? (
            <>
              {/* Amount Selector */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  Amount
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.5rem',
                  marginBottom: '0.75rem'
                }}>
                  {presetAmounts.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setAmount(preset)}
                      style={{
                        padding: '0.75rem',
                        background: amount === preset ? '#f59e0b' : 'white',
                        color: amount === preset ? 'white' : 'var(--text-primary)',
                        border: `2px solid ${amount === preset ? '#f59e0b' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: 'inherit'
                      }}
                      onMouseEnter={(e) => {
                        if (amount !== preset) {
                          e.currentTarget.style.borderColor = '#f59e0b';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (amount !== preset) {
                          e.currentTarget.style.borderColor = 'var(--border)';
                        }
                      }}
                    >
                      ${preset}
                    </button>
                  ))}
                  <button
                    onClick={() => setAmount('custom')}
                    style={{
                      padding: '0.75rem',
                      background: amount === 'custom' ? '#f59e0b' : 'white',
                      color: amount === 'custom' ? 'white' : 'var(--text-primary)',
                      border: `2px solid ${amount === 'custom' ? '#f59e0b' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit'
                    }}
                    onMouseEnter={(e) => {
                      if (amount !== 'custom') {
                        e.currentTarget.style.borderColor = '#f59e0b';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (amount !== 'custom') {
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }
                    }}
                  >
                    Custom
                  </button>
                </div>
                {amount === 'custom' && (
                  <input
                    type="number"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    min="1"
                    step="1"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#f59e0b';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  />
                )}
              </div>

              {/* Recipient Name (Optional) */}
              <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  Recipient Name <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(Optional)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Who's this for?"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    onFocus={() => setShowRecipientDropdown(true)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      paddingRight: savedRecipients.length > 0 ? '2.5rem' : '0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                  {savedRecipients.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowRecipientDropdown(!showRecipientDropdown)}
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      <ChevronDown size={18} />
                    </button>
                  )}
                </div>
                {/* Saved Recipients Dropdown */}
                {showRecipientDropdown && savedRecipients.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 100,
                    maxHeight: '200px',
                    overflow: 'auto',
                    marginTop: '0.25rem'
                  }}>
                    <div style={{
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--gray-50)'
                    }}>
                      Saved Recipients
                    </div>
                    {savedRecipients.map((recipient, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setRecipientName(recipient.name || '');
                          setRecipientEmail(recipient.email || '');
                          setShowRecipientDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: index < savedRecipients.length - 1 ? '1px solid var(--border)' : 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontFamily: 'inherit'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--gray-50)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)'
                        }}>
                          {recipient.name}
                        </div>
                        {recipient.email && (
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            marginTop: '0.125rem'
                          }}>
                            {recipient.email}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Recipient Email (Optional) */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  Recipient Email <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#f59e0b';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                />
              </div>

              {/* Greeting Section */}
              <div style={{ marginBottom: '1.5rem' }}>
                {/* Include Greeting Toggle */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '0.75rem'
                }}>
                  <input
                    type="checkbox"
                    id="includeGreeting"
                    checked={includeGreeting}
                    onChange={handleToggleGreeting}
                    style={{
                      width: '18px',
                      height: '18px',
                      marginRight: '0.5rem',
                      cursor: 'pointer',
                      accentColor: '#f59e0b'
                    }}
                  />
                  <label
                    htmlFor="includeGreeting"
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Include a greeting
                  </label>
                </div>

                {/* Helper Microcopy */}
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.75rem',
                  marginLeft: '1.65rem',
                  marginTop: '-0.5rem'
                }}>
                  Most people include a short message when sending cash.
                </p>

                {/* Greeting Textarea - Only shown when includeGreeting is true */}
                {includeGreeting && (
                  <>
                    <textarea
                      placeholder="Add a personal note..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      maxLength={200}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        outline: 'none',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#f59e0b';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                    />
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      marginTop: '0.25rem',
                      textAlign: 'right'
                    }}>
                      {message.length}/200
                    </div>
                  </>
                )}
              </div>

              {/* Delivery Section */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.75rem'
                }}>
                  Delivery
                </label>

                {/* Auto Send Option */}
                <div
                  onClick={() => setDeliveryMethod('auto')}
                  style={{
                    padding: '1rem',
                    border: `2px solid ${deliveryMethod === 'auto' ? '#f59e0b' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: deliveryMethod === 'auto' ? 'rgba(251, 191, 36, 0.05)' : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (deliveryMethod !== 'auto') {
                      e.currentTarget.style.borderColor = '#f59e0b';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (deliveryMethod !== 'auto') {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                    <input
                      type="radio"
                      name="delivery"
                      checked={deliveryMethod === 'auto'}
                      onChange={() => setDeliveryMethod('auto')}
                      style={{
                        marginTop: '0.125rem',
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#f59e0b'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '0.25rem'
                      }}>
                        Send to recipient automatically
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5
                      }}>
                        We'll deliver it for you.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manual Delivery Option */}
                <div
                  onClick={() => setDeliveryMethod('manual')}
                  style={{
                    padding: '1rem',
                    border: `2px solid ${deliveryMethod === 'manual' ? '#f59e0b' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: deliveryMethod === 'manual' ? 'rgba(251, 191, 36, 0.05)' : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (deliveryMethod !== 'manual') {
                      e.currentTarget.style.borderColor = '#f59e0b';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (deliveryMethod !== 'manual') {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                    <input
                      type="radio"
                      name="delivery"
                      checked={deliveryMethod === 'manual'}
                      onChange={() => setDeliveryMethod('manual')}
                      style={{
                        marginTop: '0.125rem',
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#f59e0b'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '0.25rem'
                      }}>
                        I'll deliver it myself
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5
                      }}>
                        Perfect for printing or hand delivery.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Message */}
              {(!recipientName.trim() || !recipientEmail.trim()) && (
                <div style={{
                  padding: '0.75rem',
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  fontSize: '0.8125rem',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>⚠️</span>
                  Please provide both recipient name and email to send QR Cash.
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerateQR}
                disabled={!recipientName.trim() || !recipientEmail.trim()}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  background: (!recipientName.trim() || !recipientEmail.trim())
                    ? '#d1d5db'
                    : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: (!recipientName.trim() || !recipientEmail.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: (!recipientName.trim() || !recipientEmail.trim())
                    ? 'none'
                    : '0 2px 8px rgba(251, 191, 36, 0.3)',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  opacity: (!recipientName.trim() || !recipientEmail.trim()) ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (recipientName.trim() && recipientEmail.trim()) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (recipientName.trim() && recipientEmail.trim()) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.3)';
                  }
                }}
              >
                <QrCode size={18} />
                Generate QR Code
              </button>
            </>
          ) : deliveryMethod === 'auto' && autoSent ? (
            <>
              {/* Auto-Send Confirmation Screen */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '2rem 0'
              }}>
                <div style={{
                  width: '4rem',
                  height: '4rem',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.5rem',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}>
                  <span style={{ fontSize: '2rem' }}>✓</span>
                </div>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.75rem'
                }}>
                  QR Cash Sent
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1.5rem',
                  lineHeight: 1.6
                }}>
                  ${amount === 'custom' ? customAmount : amount} has been sent to {recipientEmail || recipientName || 'the recipient'}
                </p>
                {message && includeGreeting && (
                  <div style={{
                    padding: '1rem',
                    background: 'var(--gray-50)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                    maxWidth: '100%',
                    borderLeft: '4px solid #f59e0b'
                  }}>
                    <p style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                      margin: 0
                    }}>
                      "{message}"
                    </p>
                  </div>
                )}
                {/* Notification Instruction */}
                <div style={{
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.5rem',
                  maxWidth: '100%',
                  border: '1px solid #93c5fd',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <Bell size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#1e40af',
                    margin: 0,
                    textAlign: 'left',
                    lineHeight: 1.5
                  }}>
                    You will receive a notification when your greeting and QR Cash gift has been received by the recipient.
                  </p>
                </div>
              </div>

              {/* Done Button */}
              <button
                onClick={handleClose}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.3)';
                }}
              >
                Done
              </button>
            </>
          ) : (
            <>
              {/* Manual Delivery - QR Code Display */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  padding: '1rem',
                  background: 'white',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px solid #f59e0b',
                  marginBottom: '1rem',
                  boxShadow: '0 4px 12px rgba(251, 191, 36, 0.2)'
                }}>
                  <img
                    src={qrCodeUrl}
                    alt="QR Cash Gift Code"
                    style={{
                      width: '250px',
                      height: '250px',
                      display: 'block'
                    }}
                  />
                </div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  ${amount === 'custom' ? customAmount : amount} QR Cash Gift
                </h3>
                {recipientName && (
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.5rem'
                  }}>
                    For: {recipientName}
                  </p>
                )}
                {message && (
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: 'var(--gray-50)',
                    borderRadius: 'var(--radius-md)',
                    maxWidth: '100%'
                  }}>
                    "{message}"
                  </p>
                )}
              </div>

              {/* Redeem URL */}
              <div style={{
                padding: '0.75rem',
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                wordBreak: 'break-all',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                fontFamily: 'monospace'
              }}>
                {redeemUrl}
              </div>

              {/* Primary Actions for Manual Delivery */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                marginBottom: '1.5rem'
              }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: '0.875rem',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.3)';
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>🖨️</span>
                  Print QR Code
                </button>
                <button
                  onClick={handleDownloadQR}
                  style={{
                    padding: '0.875rem',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.3)';
                  }}
                >
                  <Download size={16} />
                  Download QR Code
                </button>
              </div>

              {/* Secondary Action - Copy Link */}
              <button
                onClick={handleCopyLink}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'white',
                  color: copied ? '#10b981' : '#f59e0b',
                  border: `2px solid ${copied ? '#10b981' : '#f59e0b'}`,
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  if (!copied) {
                    e.currentTarget.style.background = '#f59e0b';
                    e.currentTarget.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!copied) {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = '#f59e0b';
                  }
                }}
              >
                <Copy size={16} />
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
