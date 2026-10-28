// src/pages/fundraiser/organizations/sections.jsx
// The Fundraisers page sections, in the reference order (founder handoff 2026-10-28): Hero, Bridge, Possibilities,
// Growth, Supporter, How It Works, Who It's For, Closing. Copy is the supplied components' copy, verbatim; layout and
// styling follow 1348756a0_greetly-fundraising.html, translated to this app's plain CSS (fundraisingStyles.js).
// Both primary actions come in as props: onInquire opens the organization inquiry form, onExperience opens the existing
// sample Greet-Me. The voice waves are decorative only (never a playable control).
import { useState } from 'react';
import { ArrowRight, Play, Mic, Images, CalendarDays, Check } from 'lucide-react';
import { MEDIA, IMAGERY_NOTE } from './media';
import { POSSIBILITY_FEATURES, POSSIBILITY_ROWS, GROWTH_NODES, SUPPORTER_PILLARS, STEPS, ORG_TYPES } from './content';

const BARS = [0.34, 0.58, 0.86, 0.48, 0.72, 1, 0.55, 0.8, 0.4, 0.92, 0.62, 0.44, 0.84, 0.5, 0.68, 0.34, 0.58];

/** A quiet, decorative voice-note waveform: it represents the recording inside a Greet-Me, never a playable control. */
export function VoiceWave() {
  return (
    <div className="frp-wave" aria-hidden="true">
      {BARS.map((h, i) => <span key={i} style={{ height: `${Math.round(h * 100)}%` }} />)}
    </div>
  );
}

function PrimaryActions({ onInquire, onExperience, dark = false }) {
  return (
    <>
      <button type="button" onClick={onInquire} data-testid="frp-grow" className={`frp-btn ${dark ? 'frp-btn-gold' : 'frp-btn-primary'}`}>
        Let’s Grow Together <ArrowRight size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={onExperience} data-testid="frp-experience" className={`frp-btn ${dark ? 'frp-btn-ondark' : 'frp-btn-ghost'}`}>
        <span className="frp-play" aria-hidden="true"><Play size={12} fill="currentColor" /></span>
        See the Greet-Me Experience
      </button>
    </>
  );
}

export function HeroSection({ onInquire, onExperience }) {
  return (
    <section className="frp-ivory" data-testid="frp-hero" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="frp-blob" style={{ right: -128, top: -160, width: 520, height: 520, background: 'rgba(237,228,248,.6)' }} />
      <div className="frp-blob" style={{ left: -112, top: 288, width: 380, height: 380, background: 'rgba(251,240,210,.5)' }} />
      <div className="frp-wrap">
        <div className="frp-hero-grid">
          <div>
            <p className="frp-eyebrow">Greet-Me™ for Organizations</p>
            <h1 className="frp-h1">
              Build more than a fundraiser.
              <span className="frp-em-block">Build a growing <span className="frp-gold">source of support.</span></span>
            </h1>
            <p className="frp-lead">
              Grow with Greet-Me. Turn the birthdays, holidays and everyday celebrations happening throughout your
              organization into an opportunity to support the work that matters most.
            </p>
            <p className="frp-sub">
              As more families, friends and supporters join through your organization, qualifying subscriptions can
              create a meaningful, recurring income stream, with the potential to grow year after year.
            </p>
            <div className="frp-actions"><PrimaryActions onInquire={onInquire} onExperience={onExperience} /></div>
            <p className="frp-for">
              For schools, sports teams, booster clubs, alumni associations, arts programs, community groups and nonprofits.
            </p>
          </div>
          <div className="frp-hero-media">
            <div className="frp-hero-img">
              <img src={MEDIA.hero} alt="A family gathered together watching a personalized Greet-Me message" loading="eager" />
            </div>
            <div className="frp-badge">Made to be opened</div>
            <div className="frp-hero-card">
              <p className="frp-script">Happy birthday, Mom</p>
              <p className="frp-card-note">A message in her daughter’s voice, with photos only family would have.</p>
              <div className="frp-wave-row"><VoiceWave /><span className="frp-time">0:18</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BridgeSection() {
  return (
    <section className="frp-plum" data-testid="frp-bridge">
      <div className="frp-blob" style={{ left: -96, top: 0, width: 420, height: 420, background: 'rgba(74,50,115,.4)' }} />
      <div className="frp-blob" style={{ right: -64, bottom: 0, width: 360, height: 360, background: 'rgba(212,175,55,.1)' }} />
      <div className="frp-bridge-inner">
        <p className="frp-script">the heart of it</p>
        <p className="frp-bridge-quote">
          Your supporters celebrate the people they love.{' '}
          <span>Those celebrations help support the organization they belong to.</span>
        </p>
        <div className="frp-bridge-cols">
          <div>
            <p className="frp-kicker">For the people they love</p>
            <p className="frp-ondark">A greeting with their voice, their photos and their memories is a gift that feels like being thought of, long after the day itself.</p>
          </div>
          <div>
            <p className="frp-kicker">For the place they call home</p>
            <p className="frp-ondark">The same greeting can help carry a program, a team or a classroom into the next season. Personal joy, with something lasting behind it.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, tall = false }) {
  return (
    <article className={`frp-feat${tall ? ' frp-tall' : ''}`}>
      <img src={MEDIA[feature.image]} alt={feature.label} loading="lazy" />
      <div className="frp-feat-text">
        <p className="frp-kicker">Possible use</p>
        <h3>{feature.label}</h3>
        <p>{feature.line}</p>
      </div>
    </article>
  );
}

export function PossibilitiesSection() {
  return (
    <section className="frp-sec frp-ivory" data-testid="frp-possibilities">
      <div className="frp-wrap">
        <div style={{ maxWidth: 700 }}>
          <p className="frp-eyebrow">What earnings can do</p>
          <h2 className="frp-h2">What could your organization <span className="frp-em">make possible?</span></h2>
          <p className="frp-p">
            Every organization is carrying something it is trying to make happen. The earnings your organization helps
            create can go where your mission needs them most.
          </p>
        </div>
        <div className="frp-feat-grid">
          <FeatureCard feature={POSSIBILITY_FEATURES[0]} tall />
          <FeatureCard feature={POSSIBILITY_FEATURES[1]} />
        </div>
        <div className="frp-rows">
          <div className="frp-rows-grid">
            {POSSIBILITY_ROWS.map((row, i) => (
              <div key={row.key} className="frp-row">
                <div className="frp-row-inner">
                  <span className="frp-num">{String(i + 1).padStart(2, '0')}</span>
                  <div><h3>{row.label}</h3><p>{row.line}</p></div>
                </div>
              </div>
            ))}
          </div>
          <p className="frp-note">These are possible uses of organizational earnings, not benefits automatically provided by Greet-Me.</p>
        </div>
      </div>
    </section>
  );
}

export function GrowthSection() {
  return (
    <section className="frp-sec frp-white" data-testid="frp-growth">
      <div className="frp-wrap">
        <div className="frp-growth-head">
          <div>
            <p className="frp-eyebrow">The growth opportunity</p>
            <h2 className="frp-h2">Start with your organization.<span className="frp-em-block">Build on every connection.</span></h2>
          </div>
          <div>
            <p className="frp-lede">
              Introduce Greet-Me to your members, families, alumni and supporters. Each celebration they create is a
              reason to come back, and as participation grows, qualifying subscriptions can help build a recurring
              source of funding for your organization.
            </p>
            <p className="frp-lede2">
              It is not a single campaign with an end date. It is a way for support to keep arriving as your organization
              keeps celebrating.
            </p>
          </div>
        </div>
        <div className="frp-band">
          <div className="frp-blob" style={{ right: -80, top: -96, width: 320, height: 320, background: 'rgba(212,175,55,.1)' }} />
          <div className="frp-nodes">
            {GROWTH_NODES.map((node, i) => (
              <div key={node.step} className="frp-node">
                <div className="frp-node-top">
                  <span className="frp-node-num">{node.step}</span>
                  <span className={`frp-node-line${i === GROWTH_NODES.length - 1 ? ' frp-last' : ''}`} />
                </div>
                <h3>{node.title}</h3>
                <p>{node.line}</p>
              </div>
            ))}
          </div>
          <div className="frp-band-foot">
            <p className="frp-big">Not a one-time event. <span>A relationship that can deepen.</span></p>
            <p className="frp-small">
              Fundraisers end. Celebrations keep happening: birthdays every month, holidays every year, milestones along
              the way. That continuity is what gives this the potential to become a significant recurring income stream,
              rather than a single moment of support. No two organizations grow the same way, and growth depends on how
              many supporters choose to join and stay.
            </p>
          </div>
        </div>
        <p className="frp-fine">Organization earnings depend on qualifying subscriptions and the terms of your fundraising agreement.</p>
      </div>
    </section>
  );
}

const PILLAR_ICONS = { mic: Mic, images: Images, calendar: CalendarDays };

export function SupporterSection() {
  return (
    <section className="frp-sec frp-ivory" data-testid="frp-supporter">
      <div className="frp-wrap">
        <div className="frp-sup">
          <div>
            <p className="frp-eyebrow">For your supporters</p>
            <h2 className="frp-h2 frp-h2-38">Something they’ll love giving.<span className="frp-em-block">A cause they’ll love supporting.</span></h2>
            <p className="frp-p" style={{ maxWidth: '52ch' }}>
              This is not another request for money. A Greet-Me is a gift people want to open, and one they will want to
              send again.
            </p>
            <div className="frp-pillars">
              {SUPPORTER_PILLARS.map((pillar) => {
                const Icon = PILLAR_ICONS[pillar.icon];
                return (
                  <div key={pillar.title} className="frp-pillar">
                    <span className="frp-icon40" aria-hidden="true"><Icon size={17} /></span>
                    <div><h3>{pillar.title}</h3><p>{pillar.line}</p></div>
                  </div>
                );
              })}
            </div>
            <p className="frp-aside">
              Gifts and QR Cash™ can be added when a supporter wants to send something extra. The earning opportunity
              described here is about qualifying subscriptions.
            </p>
          </div>
          <div className="frp-sup-media">
            <div className="frp-sup-card">
              <div className="frp-sup-img"><img src={MEDIA.voice} alt="A supporter recording a personal voice greeting" loading="lazy" /></div>
              <div className="frp-sup-body">
                <p className="frp-script">Happy anniversary, you two</p>
                <p className="frp-quote">
                  “Twenty-two years ago you danced in your aunt’s backyard and it rained the entire night. Somehow that is
                  still the best party I have ever been to.”
                </p>
                <div className="frp-voice">
                  <span className="frp-mic" aria-hidden="true"><Mic size={14} /></span>
                  <VoiceWave />
                  <span className="frp-time">0:24</span>
                </div>
                <div className="frp-sup-foot">
                  <span className="frp-caps">Delivered on their morning</span>
                  <span>Greet-Me<sup>™</sup></span>
                </div>
              </div>
            </div>
            <div className="frp-caption">A Greet-Me as your supporters would send it</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection({ onInquire }) {
  return (
    <section className="frp-sec frp-white" data-testid="frp-how">
      <div className="frp-wrap">
        <div className="frp-how-head">
          <div style={{ maxWidth: 560 }}>
            <p className="frp-eyebrow">How it works</p>
            <h2 className="frp-h2 frp-h2-38">Three steps, in your organization’s own rhythm.</h2>
          </div>
          <button type="button" className="frp-link" onClick={onInquire} data-testid="frp-start-conversation">
            Start the conversation <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="frp-steps">
          {STEPS.map((step) => (
            <div key={step.number} className="frp-step">
              <span className="frp-step-num">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.line}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WhoItsForSection() {
  const [active, setActive] = useState(ORG_TYPES[0].key);
  const selected = ORG_TYPES.find((t) => t.key === active) || ORG_TYPES[0];
  return (
    <section className="frp-sec frp-ivory-deep" data-testid="frp-who">
      <div className="frp-wrap">
        <div style={{ maxWidth: 640 }}>
          <p className="frp-eyebrow">Who this is for</p>
          <h2 className="frp-h2 frp-h2-38">Find your organization here.</h2>
          <p className="frp-p" style={{ maxWidth: '54ch' }}>Choose what you are closest to and see what supporters’ celebrations could help make possible.</p>
        </div>
        <div className="frp-chips" role="group" aria-label="Organization type">
          {ORG_TYPES.map((t) => (
            <button key={t.key} type="button" className="frp-chip" data-testid={`frp-org-${t.key}`}
              aria-pressed={t.key === active} aria-controls="frp-org-panel" onClick={() => setActive(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="frp-org" id="frp-org-panel" data-testid="frp-org-panel" aria-live="polite">
          <div>
            <p className="frp-script">{selected.label}</p>
            <p className="frp-org-line">{selected.line}</p>
          </div>
          <ul className="frp-uses">
            {selected.uses.map((use) => (
              <li key={use}><span className="frp-check" aria-hidden="true"><Check size={12} /></span><span className="frp-use">{use}</span></li>
            ))}
          </ul>
        </div>
        <p className="frp-fine" style={{ marginTop: 12 }}>Examples shown are possible uses of organizational earnings, not commitments by Greet-Me.</p>
      </div>
    </section>
  );
}

export function ClosingSection({ onInquire, onExperience, partnerNote = null }) {
  return (
    <section className="frp-plum" data-testid="frp-closing">
      <div className="frp-blob" style={{ left: -96, top: -80, width: 420, height: 420, background: 'rgba(74,50,115,.4)' }} />
      <div className="frp-blob" style={{ right: 0, bottom: -96, width: 420, height: 420, background: 'rgba(212,175,55,.1)' }} />
      <div className="frp-close-inner">
        <p className="frp-script">let’s grow together</p>
        <h2 className="frp-close-h">
          Your organization already has reasons to celebrate.
          <span>Give those moments another reason to matter.</span>
        </h2>
        <p className="frp-close-p">Let’s explore how Greet-Me can help your organization turn everyday celebrations into lasting possibilities.</p>
        <div className="frp-close-actions"><PrimaryActions onInquire={onInquire} onExperience={onExperience} dark /></div>
      </div>
      <footer className="frp-foot">
        <div className="frp-foot-inner">
          <div>
            <span className="frp-foot-brand">Greet-Me<span className="frp-tm">™</span> for Organizations</span>
            {partnerNote ? <p className="frp-partner">{partnerNote}</p> : null}
          </div>
          <span className="frp-foot-note">{IMAGERY_NOTE}</span>
        </div>
      </footer>
    </section>
  );
}
