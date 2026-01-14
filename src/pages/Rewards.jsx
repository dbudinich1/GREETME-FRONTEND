// src/pages/Rewards.jsx
// Greet-Me Rewards™ - Full rewards page with balance, history, and redemption

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Heart, Clock, CheckCircle, Star, Trophy, Sparkles, Send, ExternalLink } from 'lucide-react';
import {
  getRewardsBalance,
  getRewardsHistory,
  redeemRewards,
  REWARD_ACTIONS,
  REDEMPTION_OPTIONS,
  getRemainingDailyHearts,
  isHeroMember,
  getAvailableDmTagActions,
  getDmTagRemainingHearts,
  startDmTagClaim,
  claimDmTagReward
} from '../utils/rewards';
import { pushInApp } from '../utils/notify';
import { COMMS_EVENTS } from '../utils/commsCatalog';

export default function Rewards() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [remainingDaily, setRemainingDaily] = useState(25);
  const [isHero, setIsHero] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [dmTagActions, setDmTagActions] = useState([]);
  const [dmTagRemaining, setDmTagRemaining] = useState(50);
  const [claimingAction, setClaimingAction] = useState(null);
  const [showDmTagSuccess, setShowDmTagSuccess] = useState(null);

  useEffect(() => {
    loadRewardsData();
  }, []);

  const loadRewardsData = () => {
    setBalance(getRewardsBalance());
    setHistory(getRewardsHistory());
    setRemainingDaily(getRemainingDailyHearts());
    setIsHero(isHeroMember());
    setDmTagActions(getAvailableDmTagActions());
    setDmTagRemaining(getDmTagRemainingHearts());
  };

  const handleRedeem = (option) => {
    setSelectedRedemption(option);
    setShowRedeemModal(true);
  };

  const confirmRedeem = () => {
    if (selectedRedemption && redeemRewards(selectedRedemption.cost, selectedRedemption.label)) {
      setRedeemSuccess(true);
      pushInApp(COMMS_EVENTS.REWARDS_REDEEMED, {
        cost: selectedRedemption.cost,
        rewardName: selectedRedemption.label,
        timestamp: Date.now()
      });
      setTimeout(() => {
        setShowRedeemModal(false);
        setRedeemSuccess(false);
        setSelectedRedemption(null);
        loadRewardsData();
      }, 2000);
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // DM+Tag handlers
  const handleOpenDm = (action) => {
    startDmTagClaim(action.id);
    setClaimingAction(action.id);
    window.open(action.dmLink, '_blank');
    loadRewardsData(); // Refresh to show "started" status
  };

  const handleConfirmDmTag = (actionId) => {
    const result = claimDmTagReward(actionId);
    if (result.success) {
      setShowDmTagSuccess({ actionId, hearts: result.hearts, message: result.message });
      pushInApp(COMMS_EVENTS.REWARDS_EARNED, {
        amount: result.hearts,
        reason: 'Social share reward'
      });
      setTimeout(() => {
        setShowDmTagSuccess(null);
        setClaimingAction(null);
        loadRewardsData();
      }, 2500);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--gray-100)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <ArrowLeft size={24} style={{ color: 'var(--text-primary)' }} />
        </button>
        <div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '2rem' }}>❤️</span> Greet-Me Rewards™
          </h1>
          <p style={{
            fontSize: '0.9375rem',
            color: 'var(--text-secondary)',
            margin: 0
          }}>
            Earn Hearts for every greeting you send
          </p>
        </div>
      </div>

      {/* Balance Card */}
      <div style={{
        background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '2rem',
        marginBottom: '2rem',
        color: 'white',
        boxShadow: '0 4px 20px rgba(236, 72, 153, 0.3)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <p style={{
              fontSize: '0.875rem',
              opacity: 0.9,
              marginBottom: '0.5rem'
            }}>Your Balance</p>
            <div style={{
              fontSize: '3.5rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              lineHeight: 1
            }}>
              {balance} <span style={{ fontSize: '2.5rem' }}>❤️</span>
            </div>
            <p style={{
              fontSize: '0.875rem',
              opacity: 0.8,
              marginTop: '0.75rem'
            }}>
              {remainingDaily > 0
                ? `${remainingDaily} more Hearts available today from greetings`
                : 'Daily greeting Hearts limit reached'
              }
            </p>
          </div>
          {isHero && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <Trophy size={32} style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Hero Member</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>+10% Bonus</div>
            </div>
          )}
        </div>
      </div>

      {/* How to Earn Section */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Sparkles size={20} style={{ color: '#ec4899' }} />
          How to Earn Hearts
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {Object.entries(REWARD_ACTIONS).map(([action, hearts]) => (
            <div
              key={action}
              style={{
                padding: '1rem',
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                fontWeight: 500
              }}>
                {action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              <span style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#ec4899',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                +{hearts} ❤️
              </span>
            </div>
          ))}
        </div>
        {isHero && (
          <p style={{
            fontSize: '0.8125rem',
            color: '#ec4899',
            marginTop: '1rem',
            fontStyle: 'italic',
            textAlign: 'center'
          }}>
            As a Hero member, you earn 10% bonus Hearts on all actions!
          </p>
        )}
      </div>

      {/* Share & Earn Hearts - DM+Tag Section */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid var(--border)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Send size={20} style={{ color: '#ec4899' }} />
            Share & Earn Hearts
          </h2>
          {dmTagRemaining < 50 && (
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              background: 'var(--gray-100)',
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)'
            }}>
              {dmTagRemaining} Hearts remaining
            </span>
          )}
        </div>
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.25rem'
        }}>
          Message us on social media and tag someone you care about to earn bonus Hearts!
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem'
        }}>
          {dmTagActions.map((action) => {
            const isClaimed = action.status === 'claimed';
            const isStarted = action.status === 'started' || claimingAction === action.id;
            const isExpired = action.expired;
            const canClaim = action.canClaim && !isExpired;

            return (
              <div
                key={action.id}
                style={{
                  padding: '1.25rem',
                  background: isClaimed
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.02) 100%)'
                    : isExpired
                    ? 'var(--gray-50)'
                    : action.campaign
                    ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%)'
                    : 'var(--gray-50)',
                  borderRadius: 'var(--radius-lg)',
                  border: isClaimed
                    ? '2px solid #22c55e'
                    : action.campaign && !isExpired
                    ? '2px solid #ec4899'
                    : '1px solid var(--border)',
                  opacity: isExpired && !isClaimed ? 0.6 : 1,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Campaign badge */}
                {action.campaign && !isExpired && !isClaimed && (
                  <div style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    background: 'linear-gradient(135deg, #ec4899, #a855f7)',
                    color: 'white',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Limited Time
                  </div>
                )}

                {/* Claimed badge */}
                {isClaimed && (
                  <div style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    color: '#22c55e',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    <CheckCircle size={14} /> Claimed
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  marginBottom: '0.75rem'
                }}>
                  <span style={{ fontSize: '2rem' }}>{action.icon}</span>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      margin: 0,
                      marginBottom: '0.25rem'
                    }}>
                      {action.platform}
                    </h3>
                    <p style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                      margin: 0,
                      lineHeight: 1.4
                    }}>
                      {action.description}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    color: isClaimed ? '#22c55e' : '#ec4899',
                    whiteSpace: 'nowrap'
                  }}>
                    {isClaimed ? `+${action.claimedHearts}` : `+${action.heartsToAward}`} ❤️
                  </span>
                </div>

                {/* Action buttons */}
                {!isClaimed && !isExpired && (
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginTop: '1rem'
                  }}>
                    {!isStarted ? (
                      <button
                        onClick={() => handleOpenDm(action)}
                        disabled={!canClaim}
                        style={{
                          flex: 1,
                          padding: '0.625rem',
                          background: canClaim ? '#ec4899' : 'var(--gray-300)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: canClaim ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s',
                          fontFamily: 'inherit',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                        onMouseEnter={(e) => {
                          if (canClaim) e.currentTarget.style.background = '#db2777';
                        }}
                        onMouseLeave={(e) => {
                          if (canClaim) e.currentTarget.style.background = '#ec4899';
                        }}
                      >
                        <ExternalLink size={16} />
                        Open {action.platform}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConfirmDmTag(action.id)}
                        style={{
                          flex: 1,
                          padding: '0.625rem',
                          background: '#22c55e',
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
                          gap: '0.5rem'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#16a34a';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#22c55e';
                        }}
                      >
                        <CheckCircle size={16} />
                        I've sent the message!
                      </button>
                    )}
                  </div>
                )}

                {/* Expired state */}
                {isExpired && !isClaimed && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-tertiary)',
                    margin: '0.75rem 0 0',
                    fontStyle: 'italic'
                  }}>
                    This campaign has ended
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {dmTagRemaining === 0 && (
          <p style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'var(--gray-50)',
            borderRadius: 'var(--radius-md)'
          }}>
            You've earned the maximum Hearts from social sharing. Thank you for spreading meaningful moments!
          </p>
        )}
      </div>

      {/* DM+Tag Success Toast */}
      {showDmTagSuccess && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 8px 32px rgba(34, 197, 94, 0.4)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <CheckCircle size={24} />
          <div>
            <div style={{ fontWeight: 700, marginBottom: '0.125rem' }}>
              +{showDmTagSuccess.hearts} Hearts Earned!
            </div>
            <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              {showDmTagSuccess.message}
            </div>
          </div>
        </div>
      )}

      {/* Redemption Options */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Gift size={20} style={{ color: '#ec4899' }} />
          Redeem Your Hearts
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem'
        }}>
          {REDEMPTION_OPTIONS.map((option) => {
            const canAfford = balance >= option.cost;
            return (
              <div
                key={option.id}
                style={{
                  padding: '1.25rem',
                  background: canAfford
                    ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.05) 0%, rgba(190, 24, 93, 0.02) 100%)'
                    : 'var(--gray-50)',
                  borderRadius: 'var(--radius-lg)',
                  border: canAfford ? '2px solid #ec4899' : '1px solid var(--border)',
                  transition: 'all 0.2s',
                  opacity: canAfford ? 1 : 0.6
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: '0.75rem'
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0
                  }}>
                    {option.label}
                  </h3>
                  <span style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#ec4899',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    whiteSpace: 'nowrap'
                  }}>
                    {option.cost} ❤️
                  </span>
                </div>
                <p style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1rem',
                  lineHeight: 1.5
                }}>
                  {option.description}
                </p>
                <button
                  onClick={() => handleRedeem(option)}
                  disabled={!canAfford}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    background: canAfford ? '#ec4899' : 'var(--gray-300)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit'
                  }}
                  onMouseEnter={(e) => {
                    if (canAfford) {
                      e.currentTarget.style.background = '#db2777';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (canAfford) {
                      e.currentTarget.style.background = '#ec4899';
                    }
                  }}
                >
                  {canAfford ? 'Redeem Now' : `Need ${option.cost - balance} more Hearts`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* History Section */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Clock size={20} style={{ color: '#ec4899' }} />
          Rewards History
        </h2>
        {history.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: 'var(--text-secondary)'
          }}>
            <Heart size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>No rewards activity yet</p>
            <p style={{ fontSize: '0.875rem' }}>Send a greeting to start earning Hearts!</p>
            <button
              onClick={() => navigate('/dashboard/send')}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1.5rem',
                background: '#ec4899',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#db2777';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ec4899';
              }}
            >
              Send a Greeting
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {history.slice(0, 20).map((entry, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.875rem 1rem',
                  background: entry.type === 'earned' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: `3px solid ${entry.type === 'earned' ? '#22c55e' : '#ef4444'}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    background: entry.type === 'earned' ? '#dcfce7' : '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {entry.type === 'earned' ? (
                      <Star size={14} style={{ color: '#22c55e' }} />
                    ) : (
                      <Gift size={14} style={{ color: '#ef4444' }} />
                    )}
                  </div>
                  <div>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'var(--text-primary)'
                    }}>
                      {entry.reason || (entry.type === 'earned' ? 'Hearts Earned' : 'Hearts Redeemed')}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)'
                    }}>
                      {formatDate(entry.timestamp)}
                    </div>
                  </div>
                </div>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: entry.type === 'earned' ? '#22c55e' : '#ef4444'
                }}>
                  {entry.type === 'earned' ? '+' : '-'}{entry.amount} ❤️
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Redemption Confirmation Modal */}
      {showRedeemModal && selectedRedemption && (
        <>
          <div
            onClick={() => !redeemSuccess && setShowRedeemModal(false)}
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
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            width: '90%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            {redeemSuccess ? (
              <>
                <div style={{
                  width: '4rem',
                  height: '4rem',
                  borderRadius: '50%',
                  background: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem'
                }}>
                  <CheckCircle size={32} style={{ color: '#22c55e' }} />
                </div>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  Success!
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: 'var(--text-secondary)'
                }}>
                  Your reward has been redeemed.
                </p>
              </>
            ) : (
              <>
                <div style={{
                  width: '4rem',
                  height: '4rem',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem'
                }}>
                  <Gift size={32} style={{ color: 'white' }} />
                </div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  Confirm Redemption
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1.5rem'
                }}>
                  Redeem <strong>{selectedRedemption.cost} Hearts</strong> for:
                </p>
                <div style={{
                  padding: '1rem',
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '0.25rem'
                  }}>
                    {selectedRedemption.label}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)'
                  }}>
                    {selectedRedemption.description}
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  gap: '0.75rem'
                }}>
                  <button
                    onClick={() => setShowRedeemModal(false)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: 'var(--gray-100)',
                      color: 'var(--text-primary)',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmRedeem}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: '#ec4899',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#db2777';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ec4899';
                    }}
                  >
                    Confirm
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
