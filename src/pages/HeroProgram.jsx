// src/pages/HeroProgram.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Heart, ChevronDown, ChevronUp, Gift } from 'lucide-react';

export default function HeroProgram() {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState(null);

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  // Mock leaderboard data - Top 5 for preview
  const topHeroes = [
    { rank: 1, name: 'TechCorp Solutions', type: 'Company', totalGifted: 450, isHallOfFame: true },
    { rank: 2, name: 'Sarah Johnson', type: 'Individual', totalGifted: 380, isHallOfFame: true },
    { rank: 3, name: 'Blue Sky Enterprises', type: 'Company', totalGifted: 320, isHallOfFame: true },
    { rank: 4, name: 'Michael Rodriguez', type: 'Individual', totalGifted: 275, isHallOfFame: true },
    { rank: 5, name: 'GreenLeaf Industries', type: 'Company', totalGifted: 240, isHallOfFame: true }
  ];

  const faqItems = [
    {
      question: 'What is the Hero Program?',
      answer: 'The Hero Program is our initiative where we give back — 10% of proceeds support veterans and first responders. Every subscription includes "Greet One, Give One™" allowing you to gift an additional subscription or donate it through the Hero Program.'
    },
    {
      question: 'How does the 10% donation work?',
      answer: '10% of our proceeds are automatically donated to support veterans or first responder organizations. You can choose which cause to support when you participate in the Hero Program.'
    },
    {
      question: 'Who receives the donations?',
      answer: 'Depending on your selection, donations go to verified veteran support organizations or first responder family assistance programs. We partner with established charities with proven track records.'
    },
    {
      question: 'How does the Hall of Fame work?',
      answer: 'The Hall of Fame recognizes the Top 25 sponsors (individuals and companies combined) based on total gifted subscriptions sponsored. Members receive a special Hall of Fame Hero™ badge. If you drop out of the Top 25, you become a Hall of Fame Alumni and retain your badge.'
    }
  ];

  return (
    <div>
      {/* Hero Header Card */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '3rem 2rem',
        marginBottom: '2rem',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            fontWeight: 600
          }}>
            🏅 10% donated
          </div>

          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            marginBottom: '1rem',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            Greet-Me Hero™
          </h1>

          <p style={{
            fontSize: '1.25rem',
            opacity: 0.95,
            marginBottom: '1rem',
            lineHeight: 1.6
          }}>
            Greet-Me Hero™ is our B2B program for companies who want to distribute Greet-Me subscriptions as customer value-adds, employee benefits, or white-label services.
          </p>
          <p style={{
            fontSize: '1rem',
            opacity: 0.9,
            marginBottom: '2rem',
            lineHeight: 1.6
          }}>
            10% of qualifying corporate program proceeds support veterans and first responders. Scale your impact while building meaningful connections.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/dashboard/merch')}
              style={{
                padding: '0.875rem 2rem',
                background: 'white',
                color: '#667eea',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
            >
              <Gift size={20} />
              Shop Merch Store
            </button>
            <button
              onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
              style={{
                padding: '0.875rem 2rem',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '2px solid white',
                borderRadius: 'var(--radius-lg)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              View Hall of Honor
            </button>
            <button
              onClick={() => alert('Become a Hero Sponsor form - Integration coming soon')}
              style={{
                padding: '0.875rem 2rem',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '2px solid white',
                borderRadius: 'var(--radius-lg)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              Become a Hero Sponsor
            </button>
          </div>
        </div>
      </div>

      {/* Corporate Focus Section */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '3rem 2rem',
        margin: '0 0 2rem',
        textAlign: 'center',
        color: 'white',
        boxShadow: '0 10px 30px rgba(30, 58, 138, 0.3)'
      }}>
        <h2 style={{
          fontSize: '2.5rem',
          fontWeight: 800,
          marginBottom: '1rem'
        }}>
          Built for Business Scale
        </h2>
        <p style={{
          fontSize: '1.25rem',
          opacity: 0.95,
          maxWidth: '700px',
          margin: '0 auto 1.5rem',
          lineHeight: 1.6
        }}>
          Corporate subscription bundles, white-label services, and customer value distribution.
        </p>
        <p style={{
          fontSize: '1rem',
          opacity: 0.9,
          maxWidth: '650px',
          margin: '0 auto',
          lineHeight: 1.6
        }}>
          Whether you're rewarding customers, engaging employees, or offering Greet-Me as part of your platform —
          Hero™ gives you the infrastructure to deliver meaningful connections at scale.
        </p>
        <div style={{ marginTop: '2rem' }}>
          <button
            onClick={() => navigate('/pricing')}
            style={{
              padding: '1rem 2rem',
              background: 'white',
              color: '#1e3a8a',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
          >
            View Business Pricing
          </button>
        </div>
      </div>

      {/* How It Works Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>How It Works</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* Card 1: Greet One, Give One */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Gift size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Corporate Bundles</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Purchase subscription bundles to gift to customers, employees, or partners. White-label options available for enterprise clients.
            </p>
          </div>

          {/* Card 2: Hero Impact */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Heart size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Recognition & Impact</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              10% of qualifying corporate program proceeds support veterans and first responders. Track your impact with leaderboard rankings and earn permanent Hall of Fame recognition.
            </p>
          </div>

          {/* Card 3: Make It Meaningful */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem'
            }}>
              <Award size={28} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>Make It Meaningful</h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Add gifts from our American Marketplace to your greetings, supporting American makers while spreading joy.
            </p>
          </div>
        </div>
      </div>

      {/* Impact Snapshot */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>Impact Snapshot</h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2rem',
            textAlign: 'center'
          }}>
            <div>
              <div style={{
                fontSize: '3rem',
                fontWeight: 700,
                color: '#667eea',
                marginBottom: '0.5rem'
              }}>1,250</div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>Subscriptions Gifted</div>
            </div>
            <div>
              <div style={{
                fontSize: '3rem',
                fontWeight: 700,
                color: '#f093fb',
                marginBottom: '0.5rem'
              }}>$18,750</div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>Total Donated (10%)</div>
            </div>
            <div>
              <div style={{
                fontSize: '3rem',
                fontWeight: 700,
                color: '#4facfe',
                marginBottom: '0.5rem'
              }}>340</div>
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>Active Hero Sponsors</div>
            </div>
          </div>
        </div>
      </div>

      {/* Hall of Honor Preview */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>Hall of Honor - Top 5</h2>
        <p style={{
          textAlign: 'center',
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem',
          fontSize: '0.875rem'
        }}>
          Recognizing our top sponsors by total gifted subscriptions
        </p>

        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden'
        }}>
          {topHeroes.map((hero, index) => (
            <div
              key={hero.rank}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 1.5rem',
                borderBottom: index < topHeroes.length - 1 ? '1px solid var(--border)' : 'none',
                background: hero.rank <= 3 ? 'rgba(102, 126, 234, 0.05)' : 'transparent'
              }}
            >
              {/* Rank */}
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                background: hero.rank === 1 ? '#fbbf24' : hero.rank === 2 ? '#94a3b8' : hero.rank === 3 ? '#cd7f32' : 'var(--gray-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1rem',
                color: hero.rank <= 3 ? 'white' : 'var(--text-primary)'
              }}>
                {hero.rank}
              </div>

              {/* Name and Type */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {hero.name}
                  {hero.isHallOfFame && (
                    <span style={{
                      fontSize: '0.75rem',
                      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                      color: 'white',
                      padding: '0.125rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600
                    }}>
                      🏆 Hall of Fame
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)'
                }}>
                  {hero.type}
                </div>
              </div>

              {/* Total Gifted */}
              <div style={{
                textAlign: 'right'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#667eea'
                }}>
                  {hero.totalGifted}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)'
                }}>
                  gifted
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={() => alert('Full leaderboard - Integration coming soon')}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s'
            }}
          >
            View Full Hall of Honor →
          </button>
        </div>
      </div>

      {/* Hall of Fame vs Leaderboard Section */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{
            width: '5rem',
            height: '5rem',
            margin: '0 auto 1rem',
            fontSize: '4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            🏆
          </div>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 700,
            marginBottom: '1rem'
          }}>Hall of Fame™</h2>
          <p style={{
            fontSize: '1.125rem',
            marginBottom: '1rem',
            opacity: 0.95,
            lineHeight: 1.6
          }}>
            Permanent, invite-only recognition for corporate sponsors who achieve benchmark impact milestones.
          </p>
          <p style={{
            fontSize: '1rem',
            opacity: 0.9,
            marginBottom: '1.5rem'
          }}>
            Hall of Fame status is <strong>permanent and badge-worthy</strong> — once earned, you keep it forever. This is separate from the dynamic leaderboard rankings.
          </p>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            marginBottom: '1rem'
          }}>
            <strong>Hall of Honor Leaderboard:</strong> Dynamic rankings updated in real-time based on total subscriptions distributed. Compete for recognition and visibility.
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            fontSize: '0.875rem',
            lineHeight: 1.6
          }}>
            <strong>Hall of Fame:</strong> Benchmark-based permanent recognition. Invitation only. Badge displayed forever across your profile and marketing materials.
          </div>
        </div>
      </div>

      {/* Corporate Callout */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          color: 'white',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '2rem',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              marginBottom: '0.75rem'
            }}>
              Corporate Hero Sponsorship
            </h2>
            <p style={{
              fontSize: '1.125rem',
              opacity: 0.95,
              marginBottom: '1.5rem',
              lineHeight: 1.6
            }}>
              Amplify your impact and climb the Hall of Honor by sponsoring gifted subscriptions for clients, employees, or charitable causes.
            </p>
            <button
              onClick={() => navigate('/pricing')}
              style={{
                padding: '0.875rem 2rem',
                background: 'white',
                color: '#1e3a8a',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
              }}
            >
              View Business Pricing →
            </button>
          </div>
          <div style={{
            width: '6rem',
            height: '6rem',
            background: 'white',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3rem'
          }}>
            🏢
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>Frequently Asked Questions</h2>

        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {faqItems.map((item, index) => (
            <div
              key={index}
              style={{
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                overflow: 'hidden'
              }}
            >
              <button
                onClick={() => toggleFaq(index)}
                style={{
                  width: '100%',
                  padding: '1.5rem',
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit'
                }}
              >
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0
                }}>{item.question}</h3>
                {expandedFaq === index ? (
                  <ChevronUp size={20} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                ) : (
                  <ChevronDown size={20} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                )}
              </button>

              {expandedFaq === index && (
                <div style={{
                  padding: '0 1.5rem 1.5rem 1.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6
                }}>
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Greet One, Give One™ Prominent Section */}
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: '3rem 2rem',
        margin: '3rem 0 2rem',
        textAlign: 'center',
        color: 'white',
        boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)'
      }}>
        <h2 style={{
          fontSize: '2.5rem',
          fontWeight: 800,
          marginBottom: '1rem'
        }}>
          Greet One, Give One™
        </h2>
        <p style={{
          fontSize: '1.25rem',
          opacity: 0.95,
          maxWidth: '700px',
          margin: '0 auto 1.5rem',
          lineHeight: 1.6
        }}>
          Every greeting helps support veterans and first responders.
        </p>
        <p style={{
          fontSize: '1rem',
          opacity: 0.9,
          maxWidth: '650px',
          margin: '0 auto',
          lineHeight: 1.6
        }}>
          With every subscription, you get to make an impact.
          Gift your extra subscription to a loved one, or donate it through
          our <strong>Greet-Me Hero™</strong> program to ensure those who serve
          and protect us stay connected to the ones they love.
        </p>
        <div style={{ marginTop: '2rem' }}>
          <button
            onClick={() => navigate('/pricing')}
            style={{
              padding: '1rem 2rem',
              background: 'white',
              color: '#10b981',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
          >
            View Pricing & Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
