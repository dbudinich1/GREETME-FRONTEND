// src/components/GiftSelectorModal.jsx
import Modal from './Modal';
import { DollarSign, Check } from 'lucide-react';

const GIFT_OPTIONS = [
  { value: 'none', label: 'None', description: 'No gift for this occasion' },
  { value: 'qrcash', label: 'QR Cash\u2122', description: 'Send digital cash they can redeem' },
  { value: 'curated', label: 'Let Greet-Me select', description: 'We\'ll pick a thoughtful gift' },
  { value: 'merch', label: 'Merch', description: 'Choose from our merchandise' },
  { value: 'marketplace', label: 'Browse Marketplace', description: 'Explore gift options' }
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
      title="Add Gift to Occasions"
      size="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Instructions */}
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
          Select a gift type for each occasion. Your selections will be saved when you close this modal.
        </p>

        {/* No occasions selected message */}
        {(!occasions || occasions.length === 0) && (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            background: 'rgba(107, 114, 128, 0.05)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border)'
          }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              No occasions selected yet. Add occasions first, then come back to configure gifts.
            </p>
          </div>
        )}

        {/* Occasion Gift Settings */}
        {occasions && occasions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {occasions.map((occ) => {
              const giftSetting = getGiftSetting(occ.type);

              return (
                <div
                  key={occ.type}
                  style={{
                    padding: '1rem',
                    background: 'white',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  {/* Occasion Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>{getOccasionEmoji(occ.type)}</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {getOccasionLabel(occ.type)}
                      </h4>
                      {occ.date && (
                        <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          {new Date(occ.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Gift Type Selection - Radio Buttons */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                      Gift Type
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {GIFT_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${giftSetting.type === option.value ? '#667eea' : 'var(--border)'}`,
                            background: giftSetting.type === option.value ? 'rgba(102, 126, 234, 0.05)' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <input
                            type="radio"
                            name={`gift-type-${occ.type}`}
                            value={option.value}
                            checked={giftSetting.type === option.value}
                            onChange={() => onGiftChange(occ.type, 'type', option.value)}
                            style={{ marginTop: '0.125rem', accentColor: '#667eea' }}
                          />
                          <div>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                              {option.label}
                            </span>
                            <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                              {option.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* QR Cash Amount Selector */}
                  {giftSetting.type === 'qrcash' && (
                    <div style={{
                      padding: '1rem',
                      background: '#fffbeb',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid #fbbf24'
                    }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <DollarSign size={14} />
                        Amount
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <select
                          value={giftSetting.amount || 25}
                          onChange={(e) => onGiftChange(occ.type, 'amount', parseInt(e.target.value))}
                          style={{
                            padding: '0.5rem 0.75rem',
                            border: '1px solid #fbbf24',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem',
                            fontFamily: 'inherit',
                            background: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          {QR_CASH_PRESETS.map((amt) => (
                            <option key={amt} value={amt}>${amt}</option>
                          ))}
                          <option value={0}>Custom</option>
                        </select>
                        {giftSetting.amount === 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ color: '#92400e' }}>$</span>
                            <input
                              type="number"
                              min="1"
                              placeholder="Enter amount"
                              value={giftSetting.customAmount || ''}
                              onChange={(e) => onGiftChange(occ.type, 'customAmount', parseInt(e.target.value))}
                              style={{
                                width: '100px',
                                padding: '0.5rem 0.75rem',
                                border: '1px solid #fbbf24',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.875rem',
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
                      padding: '1rem',
                      background: '#f0f4ff',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid #667eea'
                    }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4338ca', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <DollarSign size={14} />
                        Maximum Budget
                      </label>
                      <select
                        value={giftSetting.maxSpend || 50}
                        onChange={(e) => onGiftChange(occ.type, 'maxSpend', parseInt(e.target.value))}
                        style={{
                          padding: '0.5rem 0.75rem',
                          border: '1px solid #667eea',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.875rem',
                          fontFamily: 'inherit',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        {CURATED_MAX_TIERS.map((amt) => (
                          <option key={amt} value={amt}>${amt}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Auto-Gift Toggle */}
                  {giftSetting.type !== 'none' && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={giftSetting.autoGift === true}
                            onChange={(e) => onGiftChange(occ.type, 'autoGift', e.target.checked)}
                            style={{ width: '1rem', height: '1rem', accentColor: '#667eea' }}
                          />
                          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                            Enable Auto-Gift
                          </span>
                        </div>
                        <span style={{
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          padding: '0.25rem 0.5rem',
                          borderRadius: '9999px',
                          background: giftSetting.autoGift ? 'rgba(102, 126, 234, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                          color: giftSetting.autoGift ? '#667eea' : 'var(--text-tertiary)',
                          textTransform: 'uppercase'
                        }}>
                          {giftSetting.autoGift ? 'Auto' : 'Manual'}
                        </span>
                      </label>
                      <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                        margin: '0.5rem 0 0 1.5rem'
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
          gap: '0.75rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border)'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Check size={16} />
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
