// src/components/experience/GreetMeExperience.jsx
//
// THE GREET-ME EXPERIENCE: a guided, timed tour of the existing sample Greet-Me, opened from the landing CTA.
//   invitation email -> envelope -> spin and turn over -> open -> Intro -> Featured Spread video -> photos and
//   music -> finale -> simulated QR claim (the existing inert sample reveal) -> back to the landing.
// The card is the EXISTING, unchanged player (GreetingCard) fed the existing SAMPLE_GREETING, isOwner=false,
// with the existing `sample` input (sample QR + onCreditTap). This file wraps it: it never replaces or edits it.
// Step model and timing: experienceFlow.js. Driving the player through its own events: cardDriver.js.
//
// The visitor is always in control: any pointer, touch, wheel or key interaction with the page pauses automatic
// progression (a visible Paused state with Resume); Back / Next, Sound, Replay and Exit are keyboard-reachable
// buttons; Escape exits. Nothing is claimed, paid, sent or ordered, and no network request is made by this file.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GreetingCard from '../GreetingCardProto/GreetingCard';
import SampleCreditReveal from '../sample/SampleCreditReveal.jsx';
import { SAMPLE_GREETING } from '../sample/sampleGreeting.js';
import { sampleQrTarget } from '../sample/SampleGreetingOverlay.jsx';
import { buildSteps, createExperienceGuide, EXPERIENCE_CHROME, EXPERIENCE_TIMING } from './experienceFlow.js';
import { readCardScreen, stepCardToward, spinEnvelope, startFeaturedVideo, findFeaturedVideo, videoUnavailable,
  applyCardSound, tryVideoSound, clickSampleQr, isDriving, asDriver } from './cardDriver.js';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const SERIF = 'Georgia, serif';
const NON_INTERACTION_KEYS = new Set(['Tab', 'Shift', 'Alt', 'Control', 'Meta', 'Escape', 'CapsLock']);

const CSS = `
  .gx-root { position: fixed; inset: 0; z-index: 100; background: #1a1a2e; font-family: ${FONT}; overflow: hidden; }
  .gx-stage { position: absolute; inset: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; }
  /* Phones in portrait: the card stacks its Featured Spread taller than the screen and the page scrolls, as on the
     real recipient page; the spacer keeps the end of it clear of the controls. */
  .gx-stage-end { height: 64px; }
  @media (orientation: landscape) { .gx-stage { overflow-y: hidden; } .gx-stage-end { display: none; } }
  .gx-top, .gx-bottom { position: absolute; left: 0; right: 0; z-index: 30; display: flex; align-items: center; gap: .5rem;
    padding: .3rem max(16px, env(safe-area-inset-left)); box-sizing: border-box; background: rgba(15, 10, 32, .78);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); color: #efeaff; }
  .gx-top { top: 0; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.12); }
  .gx-bottom { bottom: 0; justify-content: center; flex-wrap: wrap; border-top: 1px solid rgba(255,255,255,.12);
    padding-bottom: max(.3rem, env(safe-area-inset-bottom)); }
  .gx-title { min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
  .gx-title strong { font-size: .86rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gx-title span { font-size: .74rem; color: rgba(239,234,255,.78); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gx-btn { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; min-height: 36px; min-width: 40px;
    padding: .3rem .8rem; border-radius: 999px; border: 1.5px solid rgba(239,234,255,.45); background: transparent; color: #fff;
    font: 600 .8rem ${FONT}; cursor: pointer; white-space: nowrap; }
  .gx-btn:hover { background: rgba(255,255,255,.1); }
  .gx-btn.primary { background: #5b3fb8; border-color: #5b3fb8; }
  .gx-btn.primary:hover { background: #4a2f9e; }
  .gx-btn:disabled { opacity: .45; cursor: not-allowed; }
  .gx-root :focus-visible { outline: 3px solid #c4b5fd; outline-offset: 2px; }
  .gx-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(255,255,255,.12); overflow: hidden; }
  .gx-progress i { display: block; height: 100%; width: 100%; background: #c4b5fd; transform-origin: left center;
    animation: gx-fill linear forwards; }
  @keyframes gx-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .gx-paused { position: absolute; left: 50%; transform: translateX(-50%); z-index: 31; display: flex; align-items: center; gap: .5rem;
    padding: .35rem .45rem .35rem .85rem; border-radius: 999px; background: #fde68a; color: #78350f; font: 700 .8rem ${FONT};
    box-shadow: 0 6px 18px rgba(0,0,0,.3); max-width: calc(100% - 32px); box-sizing: border-box; }
  .gx-paused .gx-btn { border-color: #78350f; color: #78350f; min-height: 32px; padding: .25rem .7rem; }
  .gx-note { position: absolute; left: 50%; transform: translateX(-50%); z-index: 31; max-width: calc(100% - 32px); box-sizing: border-box;
    padding: .35rem .8rem; border-radius: 999px; background: rgba(15,10,32,.86); color: #efeaff; font-size: .76rem; text-align: center; }
  .gx-screen { position: absolute; inset: 0; overflow-y: auto; display: flex; align-items: center; justify-content: center;
    box-sizing: border-box; padding: 72px 16px 96px; }
  .gx-mail { width: 100%; max-width: 560px; background: #fffdf8; border: 1px solid #ddd5c8; border-radius: 10px; overflow: hidden;
    font-family: ${SERIF}; color: #3d2314; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
  .gx-mail-head { font-family: ${FONT}; font-size: .78rem; color: #5b5146; background: #f3eee6; border-bottom: 1px solid #ddd5c8;
    padding: .7rem 1rem; display: grid; gap: .15rem; }
  .gx-mail-head b { color: #3d2314; }
  .gx-mail-body { padding: 32px clamp(20px, 6vw, 40px) 32px; }
  .gx-mail-seal { display: block; width: 160px; max-width: 60%; height: auto; margin: 0 auto 16px; }
  .gx-mail-sup { text-align: center; font-size: 13px; color: #7b6a59; letter-spacing: 1.6px; text-transform: uppercase;
    padding-bottom: 20px; border-bottom: 1px solid #ddd5c8; margin: 0 0 24px; }
  .gx-mail-open { display: block; margin: 28px auto 0; background: #6b3a2a; color: #fff; border: 0; border-radius: 10px;
    padding: 14px 28px; font: 500 19px ${SERIF}; cursor: pointer; }
  .gx-end { max-width: 460px; text-align: center; color: #efeaff; }
  .gx-end h2 { font: 700 1.6rem "Playfair Display", ${SERIF}; margin: 0 0 .75rem; color: #fff; }
  .gx-end p { margin: 0 0 1.5rem; line-height: 1.55; color: rgba(239,234,255,.85); }
  .gx-end-actions { display: grid; gap: .6rem; justify-items: center; }
  @media (max-width: 480px) {
    .gx-btn { min-height: 40px; padding: .3rem .5rem; font-size: .74rem; gap: .25rem; }
    .gx-btn .gx-lbl-long { display: none; }
    .gx-bottom { gap: .3rem; flex-wrap: nowrap; padding-left: 8px; padding-right: 8px; }
  }
  @media (max-width: 359px) {
    .gx-bottom .gx-btn .gx-lbl { display: none; }
    .gx-bottom .gx-btn { min-width: 44px; }
  }
  @media (prefers-reduced-motion: reduce) { .gx-progress i { animation: none; transform: scaleX(0); } }
`;

const prefersReducedMotion = () => {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; }
};

function Invitation({ onOpen }) {
  const name = SAMPLE_GREETING.recipientName; const from = SAMPLE_GREETING.senderName;
  return (
    <div className="gx-screen" data-testid="experience-invite" style={{ background: '#4a4743' }}>
      <article className="gx-mail" aria-label="Sample invitation email">
        <div className="gx-mail-head">
          <span><b>From:</b> {from} via Greet-Me</span>
          <span><b>To:</b> {name}</span>
          <span><b>Subject:</b> {from} sent you a Greet-Me</span>
        </div>
        <div className="gx-mail-body">
          <img className="gx-mail-seal" src="/assets/email/red-wax-seal.jpeg" alt="Greet-Me seal" />
          <p className="gx-mail-sup">A personal Greet-Me awaits you</p>
          <p style={{ fontSize: 19, margin: 0 }}>Hi {name},</p>
          <button type="button" className="gx-mail-open" data-exp-controls="" data-testid="experience-open-invite" onClick={onOpen}>Open Your Greet-Me</button>
          <p style={{ textAlign: 'right', fontSize: 18, margin: '28px 0 0' }}>&mdash; {from}</p>
        </div>
      </article>
    </div>
  );
}

export default function GreetMeExperience({ onExit }) {
  const steps = useMemo(() => buildSteps({ introText: `${SAMPLE_GREETING.writtenIntroText} ${SAMPLE_GREETING.poemText}` }), []);
  const [st, setSt] = useState(null);
  const [cardKey, setCardKey] = useState(0);
  const [cardScreen, setCardScreen] = useState(null);
  const [sound, setSound] = useState(true);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [videoMissing, setVideoMissing] = useState(false);
  const rootRef = useRef(null);
  const hostRef = useRef(null);
  const stageRef = useRef(null);
  const guideRef = useRef(null);
  const pendingRef = useRef(null);       // { target, until }: the screen the guide just asked the card for
  const subRef = useRef([]);             // cancel functions of the current step's sub-actions
  const soundRef = useRef({ on: true, blocked: false });
  const tryingSoundRef = useRef(false);
  const exitRef = useRef(onExit); exitRef.current = onExit;
  const reducedMotion = useRef(prefersReducedMotion()).current;

  useEffect(() => { soundRef.current = { on: sound, blocked: soundBlocked }; }, [sound, soundBlocked]);

  const clearSub = () => { subRef.current.forEach((c) => { try { c(); } catch { /* done */ } }); subRef.current = []; };
  const later = (fn, ms) => { const t = window.setTimeout(fn, ms); subRef.current.push(() => window.clearTimeout(t)); };

  const exit = useCallback(() => { guideRef.current?.destroy(); clearSub(); exitRef.current?.(); }, []);

  // Move the card one screen towards the step's screen, through the player's own controls.
  const driveCard = (target) => {
    const did = stepCardToward(hostRef.current, window, target);
    if (did === 'remount') { setCardKey((k) => k + 1); return; }
    if (did !== 'none') pendingRef.current = { target, until: Date.now() + EXPERIENCE_TIMING.cardSyncGraceMs };
  };

  // The guide: created once. onStep performs the card action for guide-initiated moves only; when the visitor
  // moved the card ('card') or its video ended ('media'), the card is already there.
  useEffect(() => {
    const onStep = (to, from, how) => {
      clearSub();
      setVideoMissing(false);
      if (how === 'card' || how === 'media') return;
      if (how === 'replay') { setCardKey((k) => k + 1); setSoundBlocked(false); return; }
      if (to.id === 'envelope' && from && (from.id === 'reverse' || from.id === 'cover')) { setCardKey((k) => k + 1); return; }
      if (to.id === 'claim') { if (from?.id === 'finale') clickSampleQr(hostRef.current); return; }
      if (to.screen && hostRef.current) driveCard(to.screen);
    };
    const guide = createExperienceGuide({ steps, onChange: setSt, onStep, onFinish: () => exit() });
    guideRef.current = guide;
    guide.start();
    return () => { guide.destroy(); clearSub(); };
  }, [steps, exit]);

  const stepId = st?.step?.id;
  const cardMounted = !!st && st.index >= 1;

  // Follow the card: its screen, sound, and the video's events.
  useEffect(() => {
    const host = hostRef.current;
    if (!cardMounted || !host) { setCardScreen(null); return undefined; }
    const look = () => {
      const s = soundRef.current;
      applyCardSound(host, s.on, { allowVideoSound: !s.blocked });
      const screen = readCardScreen(host);
      setCardScreen(screen);
      if (!screen) return;
      const p = pendingRef.current;
      if (p) {
        if (screen === p.target || Date.now() > p.until) pendingRef.current = null;
        else return; // the card has not caught up with the guide yet
      }
      guideRef.current?.syncScreen(screen);
    };
    const mo = new MutationObserver(look);
    mo.observe(host, { childList: true, subtree: true });
    look();
    const isCardVideo = (e) => e.target?.matches?.('video.gc-video');
    const onEnded = (e) => { if (isCardVideo(e)) guideRef.current?.mediaEnd(); };
    const onPlaying = (e) => {
      if (!isCardVideo(e)) return;
      const g = guideRef.current; const v = e.target;
      if (g?.state().step.id === 'video' && Number.isFinite(v.duration) && v.duration > 0 && v.currentTime < 0.5) {
        g.setStepTimer(Math.round((v.duration / (v.playbackRate || 1)) * 1000) + EXPERIENCE_TIMING.videoTailMs);
      }
      const s = soundRef.current;
      if (s.on && !s.blocked && v.muted && !tryingSoundRef.current) {
        tryingSoundRef.current = true; // the muted re-play below fires 'playing' again: do not try twice
        tryVideoSound(host, window).then((r) => {
          tryingSoundRef.current = false;
          if (r === 'blocked') { soundRef.current = { ...soundRef.current, blocked: true }; setSoundBlocked(true); }
        });
      }
    };
    const onError = (e) => {
      if (!isCardVideo(e)) return;
      if (guideRef.current?.state().step.id === 'video') { setVideoMissing(true); guideRef.current.setStepTimer(EXPERIENCE_TIMING.noVideoDwellMs); }
    };
    host.addEventListener('ended', onEnded, true);
    host.addEventListener('playing', onPlaying, true);
    host.addEventListener('error', onError, true);
    return () => { mo.disconnect(); host.removeEventListener('ended', onEnded, true); host.removeEventListener('playing', onPlaying, true); host.removeEventListener('error', onError, true); };
  }, [cardMounted, cardKey]);

  // Step content that needs the card on screen: the spin, and starting the video.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (stepId === 'reverse' && cardScreen === 'envelope') {
      const cancel = spinEnvelope(host, window, { durationMs: EXPERIENCE_TIMING.spinMs, reducedMotion });
      subRef.current.push(cancel);
    }
    // When the card is taller than the screen (phones in portrait), bring the step's part into view. A
    // programmatic scroll is not a visitor interaction, so it does not pause the tour.
    const stage = stageRef.current;
    if (stage && stage.scrollHeight > stage.clientHeight + 4) {
      const part = stepId === 'video' ? host.querySelector('.gc-video-page') : stepId === 'photos' ? host.querySelector('.gc-album-page') : null;
      const behavior = reducedMotion ? 'auto' : 'smooth';
      if (part && cardScreen === 'featured') part.scrollIntoView?.({ block: 'center', behavior });
      else if (!part && stage.scrollTop) stage.scrollTo?.({ top: 0, behavior });
    }
    if (stepId === 'video' && cardScreen === 'featured') {
      later(() => {
        if (guideRef.current?.state().paused) return; // the visitor is looking around: they start it themselves
        if (startFeaturedVideo(host)) return;
        if (!findFeaturedVideo(host) || videoUnavailable(host)) { setVideoMissing(true); guideRef.current?.setStepTimer(EXPERIENCE_TIMING.noVideoDwellMs); }
      }, EXPERIENCE_TIMING.videoStartDelayMs);
    }
    if (stepId === 'claim') {
      later(() => {
        if (guideRef.current?.state().paused) return;
        const b = rootRef.current?.querySelector('[data-testid="sample-claim-inert"]');
        if (b) asDriver(() => b.click());
      }, EXPERIENCE_TIMING.claimTapMs);
    }
    // only when the step or the card's screen changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, cardScreen === 'envelope' || cardScreen === 'featured' ? cardScreen : null, cardKey]);

  // The visitor interacting pauses automatic progression; Escape exits. The guide's own synthetic events and
  // presses on the guide's controls do not count.
  useEffect(() => {
    const onAny = (e) => {
      if (isDriving()) return;
      if (e.type === 'keydown') {
        if (e.key === 'Escape') { e.preventDefault(); exit(); return; }
        if (NON_INTERACTION_KEYS.has(e.key)) return;
      }
      if (e.target?.closest?.('[data-exp-controls]')) return;
      guideRef.current?.interact();
    };
    const types = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'wheel'];
    types.forEach((t) => document.addEventListener(t, onAny, true));
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    rootRef.current?.focus?.();
    return () => { types.forEach((t) => document.removeEventListener(t, onAny, true)); document.body.style.overflow = prev; };
  }, [exit]);

  // What the visitor hears: off when they turned it off, or while the browser keeps the video muted.
  const soundOn = sound && !soundBlocked;
  const toggleSound = () => {
    const on = !soundOn;
    setSound(on); setSoundBlocked(false);
    soundRef.current = { on, blocked: false };
    const host = hostRef.current;
    applyCardSound(host, on);
    // This press is a tap, so the browser now allows the video's sound.
    const v = findFeaturedVideo(host);
    if (v && on && v.paused && !v.ended && v.currentTime > 0) v.play().catch(() => {});
  };

  if (!st) return null;
  const g = guideRef.current;
  const { step, paused, index, total, timerMs, remainingMs } = st;
  const showClaim = stepId === 'claim';
  const showEnd = stepId === 'return';
  const showInvite = stepId === 'invite';

  return (
    <div className="gx-root" ref={rootRef} role="dialog" aria-modal="true" aria-label={EXPERIENCE_CHROME.title} tabIndex={-1}
      data-testid="experience-overlay" data-step={stepId} data-paused={paused ? 'true' : 'false'}>
      <style>{CSS}</style>

      <div className="gx-stage" ref={stageRef}>
        {cardMounted ? (
          <div ref={hostRef} className="gc-public-wrapper" data-testid="experience-card">
            <GreetingCard key={cardKey} greeting={SAMPLE_GREETING} isOwner={false} onRetryVideo={null}
              sample={{ qrTarget: sampleQrTarget(), onCreditTap: () => guideRef.current?.goTo('claim', 'card') }} />
          </div>
        ) : null}
        {cardMounted ? <div className="gx-stage-end" aria-hidden="true" /> : null}
        {showInvite ? <Invitation onOpen={() => g.next()} /> : null}
        {showClaim ? (
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, overflowY: 'auto', paddingTop: 56, paddingBottom: 72, background: '#1B2A4A', boxSizing: 'border-box' }}
            data-testid="experience-claim">
            <SampleCreditReveal onBack={() => g.goTo('finale')} onClose={exit} />
          </div>
        ) : null}
        {showEnd ? (
          <div className="gx-screen" data-testid="experience-end" style={{ zIndex: 20, background: 'linear-gradient(160deg, #1B2A4A 0%, #2d1b4e 50%, #1B2A4A 100%)' }}>
            <div className="gx-end">
              <h2>That was a Greet-Me.</h2>
              <p>Next, the intro video on the Greet-Me page.</p>
              <div className="gx-end-actions" data-exp-controls="">
                <button type="button" className="gx-btn primary" data-testid="experience-back-to-landing" onClick={exit}>Back to Greet-Me</button>
                <button type="button" className="gx-btn" onClick={() => g.replay()}>↺ Watch it again</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="gx-top" data-exp-controls="">
        <div className="gx-title">
          <strong>{EXPERIENCE_CHROME.title}</strong>
          <span data-testid="experience-step-label" aria-live="polite">{index + 1} of {total} · {step.label}</span>
        </div>
        <button type="button" className="gx-btn" data-testid="experience-exit" onClick={exit} aria-label="Exit The Greet-Me Experience">
          ✕ <span className="gx-lbl">Exit</span>
        </button>
        {timerMs && !paused ? (
          <div className="gx-progress" aria-hidden="true">
            <i key={`${index}-${timerMs}-${cardKey}`} style={{ animationDuration: `${timerMs}ms`, animationDelay: `-${Math.max(0, timerMs - (remainingMs ?? timerMs))}ms` }} />
          </div>
        ) : null}
      </div>

      {paused ? (
        <div className="gx-paused" style={{ top: 54 }} role="status" data-testid="experience-paused" data-exp-controls="">
          <span>{EXPERIENCE_CHROME.pausedNote}</span>
          <button type="button" className="gx-btn" onClick={() => g.resume()} data-testid="experience-resume-pill">▶ Resume</button>
        </div>
      ) : null}
      {!paused && (soundBlocked || videoMissing) ? (
        <div className="gx-note" style={{ top: 54 }} role="status" data-testid="experience-note">
          {videoMissing ? 'The video could not be shown here. The tour continues with the rest of the card.'
            : 'Your browser started the video without sound. Press Sound on to hear it.'}
        </div>
      ) : null}

      <div className="gx-bottom" data-exp-controls="" data-testid="experience-controls">
        <button type="button" className="gx-btn" onClick={() => g.back()} disabled={index === 0} data-testid="experience-back" aria-label="Previous step">
          ◀ <span className="gx-lbl">Back</span>
        </button>
        {paused ? (
          <button type="button" className="gx-btn primary" onClick={() => g.resume()} data-testid="experience-resume" aria-label="Resume the tour">
            ▶ <span className="gx-lbl">Resume</span>
          </button>
        ) : (
          <button type="button" className="gx-btn" onClick={() => g.pause()} data-testid="experience-pause" aria-label="Pause the tour">
            ❚❚ <span className="gx-lbl">Pause</span>
          </button>
        )}
        <button type="button" className="gx-btn" onClick={() => g.next()} data-testid="experience-next" aria-label="Next step">
          <span className="gx-lbl">Next</span> ▶
        </button>
        <button type="button" className="gx-btn" onClick={toggleSound} data-testid="experience-sound" aria-pressed={soundOn}
          aria-label={soundOn ? 'Sound is on. Turn sound off' : 'Sound is off. Turn sound on'}>
          {soundOn ? '🔊' : '🔇'} <span className="gx-lbl">Sound<span className="gx-lbl-long">{soundOn ? ' on' : ' off'}</span></span>
        </button>
        <button type="button" className="gx-btn" onClick={() => g.replay()} data-testid="experience-replay" aria-label="Replay The Greet-Me Experience from the start">
          ↺ <span className="gx-lbl">Replay</span>
        </button>
      </div>
    </div>
  );
}
