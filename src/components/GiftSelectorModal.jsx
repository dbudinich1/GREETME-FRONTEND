// src/components/GiftSelectorModal.jsx
import Modal from './Modal';
import { DollarSign } from 'lucide-react';

const GIFT_OPTIONS = [
  { value: 'none', label: 'None', description: 'No gift for now' },
  { value: 'qrcash', label: 'QR Cash\u2122', description: 'Send cash they can scan and spend' },
  { value: 'curated', label: 'Let Greet-Me Select', description: 'We\'ll select something thoughtful within your limit' },
  { value: 'merch', label: 'Merch', description: 'Greet-Me merch & keepsakes' },
  { value: 'marketplace', label: 'American Marketplace', description: 'Browse made-in-USA gifts' }
];

const QR_CASH_PRESETS = [10, 25, 50, 100];
const CURATED_MAX_TIERS = [25, 50, 75, 100, 150];

export default function GiftSelectorModal({
  isOpen,
  onClose,
  occasions,
  occasionGiftSettings,
  onGiftChange,
  getOccasionLabel,
  getOccasionEmoji
}) {
  const getGiftSetting = (occasionValue) => {
    return occasionGiftSettings?.[occasionValue] || { type: 'none', autoGift: false };
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose a Gift (Optional)"
      size="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Subtitle */}
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          margin: 0,
          lineHeight: 1.5
        }}>
          Pick one option for each occasion. You can edit later.
        </p>

        {/* No occasions selected message */}
        {(!occasions || occasions.length === 0) && (
          <div style={{
            padding: '2.5rem 2rem',
            textAlign: 'center',
            background: 'var(--bg-secondary, #f9fafb)',
            borderRadius: '0.75rem',
            border: '1px dashed var(--border, #e5e7eb)'
          }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              No occasions selected yet. Add occasions first, then come back to configure gifts.
            </p>
          </div>
        )}

        {/* Occasion Gift Settings */}
        {occasions && occasions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {occasions.map((occ) => {
              const giftSetting = getGiftSetting(occ.type);

              return (
                <div
                  key={occ.type}
                  style={{
                    padding: '1.25rem',
                    background: 'var(--bg-primary, white)',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border, #e5e7eb)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  {/* Occasion Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1.25rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid var(--border, #e5e7eb)'
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>{getOccasionEmoji(occ.type)}</span>
                    <div>
                      <h4 style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--text-primary, #111827)'
                      }}>
                        {getOccasionLabel(occ.type)}
                      </h4>
                      {occ.date && (
                        <p style={{
                          margin: '0.25rem 0 0 0',
                          fontSize: '0.8125rem',
                          color: 'var(--text-tertiary, #9ca3af)'
                        }}>
                          {new Date(occ.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Gift Type Selection - Card-style Radio Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {GIFT_OPTIONS.map((option) => {
                      const isSelected = giftSetting.type === option.value;
                      return (
                        <label
                          key={option.value}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.875rem',
                            padding: '1rem 1.125rem',
                            borderRadius: '0.625rem',
                            border: isSelected
                              ? '2px solid #667eea'
                              : '1px solid var(--border, #e5e7eb)',
                            background: isSelected
                              ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.06) 0%, rgba(102, 126, 234, 0.02) 100%)'
                              : 'var(--bg-primary, white)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            marginLeft: isSelected ? '-1px' : '0',
                            marginRight: isSelected ? '-1px' : '0'
                          }}
                        >
                          <input
                            type="radio"
                            name={`gift-type-${occ.type}`}
                            value={option.value}
                            checked={isSelected}
                            onChange={() => onGiftChange(occ.type, 'type', option.value)}
                            style={{
                              width: '1.125rem',
                              height: '1.125rem',
                              accentColor: '#667eea',
                              flexShrink: 0
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{
                              fontSize: '0.9375rem',
                              fontWeight: isSelected ? 600 : 500,
                              color: isSelected ? '#667eea' : 'var(--text-primary, #111827)',
                              display: 'block'
                            }}>
                              {option.label}
                            </span>
                            <p style={{
                              margin: '0.25rem 0 0 0',
                              fontSize: '0.8125rem',
                              color: 'var(--text-tertiary, #9ca3af)',
                              lineHeight: 1.4
                            }}>
                              {option.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* QR Cash Amount Selector */}
                  {giftSetting.type === 'qrcash' && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1.125rem',
                      background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                      borderRadius: '0.625rem',
                      border: '1px solid #fcd34d'
                    }}>
                      <label style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#92400e',
                        marginBottom: '0.625rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem'
                      }}>
                        <DollarSign size={14} />
                        Select Amount
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                        <select
                          value={giftSetting.amount || 25}
                          onChange={(e) => onGiftChange(occ.type, 'amount', parseInt(e.target.value))}
                          style={{
                            padding: '0.625rem 1rem',
                            border: '1px solid #fbbf24',
                            borderRadius: '0.5rem',
                            fontSize: '0.9375rem',
                            fontFamily: 'inherit',
                            fontWeight: 500,
                            background: 'white',
                            cursor: 'pointer',
                            minWidth: '120px'
                          }}
                        >
                          {QR_CASH_PRESETS.map((amt) => (
                            <option key={amt} value={amt}>${amt}</option>
                          ))}
                          <option value={0}>Custom</option>
                        </select>
                        {giftSetting.amount === 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span style={{ color: '#92400e', fontWeight: 500 }}>$</span>
                            <input
                              type="number"
                              min="1"
                              placeholder="Amount"
                              value={giftSetting.customAmount || ''}
                              onChange={(e) => onGiftChange(occ.type, 'customAmount', parseInt(e.target.value))}
                              style={{
                                width: '100px',
                                padding: '0.625rem 0.75rem',
                                border: '1px solid #fbbf24',
                                borderRadius: '0.5rem',
                                fontSize: '0.9375rem',
                                fontFamily: 'inherit',
                                background: 'white'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Curated Gift Max Spend Selector */}
                  {giftSetting.type === 'curated' && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1.125rem',
                      background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecff 100%)',
                      borderRadius: '0.625rem',
                      border: '1px solid #a5b4fc'
                    }}>
                      <label style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#4338ca',
                        marginBottom: '0.625rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem'
                      }}>
                        <DollarSign size={14} />
                        Maximum Budget
                      </label>
                      <select
                        value={giftSetting.maxSpend || 50}
                        onChange={(e) => onGiftChange(occ.type, 'maxSpend', parseInt(e.target.value))}
                        style={{
                          padding: '0.625rem 1rem',
                          border: '1px solid #818cf8',
                          borderRadius: '0.5rem',
                          fontSize: '0.9375rem',
                          fontFamily: 'inherit',
                          fontWeight: 500,
                          background: 'white',
                          cursor: 'pointer',
                          minWidth: '120px'
                        }}
                      >
                        {CURATED_MAX_TIERS.map((amt) => (
                          <option key={amt} value={amt}>Up to ${amt}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Auto-Gift Toggle */}
                  {giftSetting.type !== 'none' && (
                    <div style={{
                      marginTop: '1.25rem',
                      paddingTop: '1rem',
                      borderTop: '1px dashed var(--border, #e5e7eb)'
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <input
                            type="checkbox"
                            checked={giftSetting.autoGift === true}
                            onChange={(e) => onGiftChange(occ.type, 'autoGift', e.target.checked)}
                            style={{
                              width: '1.125rem',
                              height: '1.125rem',
                              accentColor: '#667eea',
                              borderRadius: '0.25rem'
                            }}
                          />
                          <span style={{
                            fontSize: '0.9375rem',
                            fontWeight: 500,
                            color: 'var(--text-primary, #111827)'
                          }}>
                            Enable Auto-Gift
                          </span>
                        </div>
                        <span style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '0.3125rem 0.625rem',
                          borderRadius: '9999px',
                          background: giftSetting.autoGift
                            ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(102, 126, 234, 0.1) 100%)'
                            : 'rgba(107, 114, 128, 0.1)',
                          color: giftSetting.autoGift ? '#667eea' : 'var(--text-tertiary, #9ca3af)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em'
                        }}>
                          {giftSetting.autoGift ? 'Auto' : 'Manual'}
                        </span>
                      </label>
                      <p style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-tertiary, #9ca3af)',
                        margin: '0.625rem 0 0 1.75rem',
                        lineHeight: 1.4
                      }}>
                        {giftSetting.autoGift
                          ? 'Gift will be sent automatically on the occasion date.'
                          : 'You\'ll receive a reminder 10 days before to confirm.'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '0.875rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border, #e5e7eb)'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'transparent',
              color: 'var(--text-secondary, #6b7280)',
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: '0.5rem',
              fontSize: '0.9375rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary"
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #5a67d8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit',
              boxShadow: '0 2px 4px rgba(102, 126, 234, 0.25)'
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </Modal>
  );
}
