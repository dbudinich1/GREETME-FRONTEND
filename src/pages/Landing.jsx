// src/pages/Landing.jsx
// Public entry screen for unauthenticated users; redirects logged-in users to dashboard.
//
// Layout (Team 3, founder-approved rendering, Report 75 rev 3): a purple page with ONE grouping panel
// behind three equal cards: headline card, intro-video card, sign-up card. Desktop uses the approved
// 75% composition; phones adapt spacing to their width. Intro-video behaviour is Team 2's
// (useIntroVideo): this file only renders the controls and calls its handlers.

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GreetMeLogo from '../components/GreetMeLogo';
import useIntroVideo from '../hooks/useIntroVideo';
import SampleCreditReveal from '../components/sample/SampleCreditReveal.jsx';
import useSampleMediaAvailable from '../components/sample/useSampleMediaAvailable';
import { SAMPLE_ENTRY_ENABLED, SAMPLE_TALKING_PHOTO_URL, SAMPLE_CHROME } from '../components/sample/sampleGreeting.js';
import { EXPERIENCE_CHROME } from '../components/experience/experienceFlow.js';

// The sample viewer (with the card player and its styles) loads only when the visitor opens it.
const SampleGreetingOverlay = lazy(() => import('../components/sample/SampleGreetingOverlay.jsx'));
// The Greet-Me Experience (the guided sample on the same player) also loads only when opened.
const GreetMeExperience = lazy(() => import('../components/experience/GreetMeExperience.jsx'));

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const SERIF = '"Playfair Display", Georgia, serif';

// Intro video. FAST_START is the same video (content, narration, music, length) re-encoded at 1080p
// with its playback index first, 5.3 MB instead of 114 MB. ORIGINAL is the file the page has always
// played; it stays untouched as the fallback and the rollback.
const INTRO_VIDEO_FAST_START = 'https://greetmedanny.blob.core.windows.net/public/greetme-intro-v2.mp4';
const INTRO_VIDEO_ORIGINAL = 'https://greetmedanny.blob.core.windows.net/public/greetme-demo.mp4.mp4';
const INTRO_VIDEO_PRELOAD = 'auto';

// "View Sample Greet-Me" (founder: required; Report 71 rev 2 sample, beneath the supporting line). It is
// rendered only when the sample is enabled AND its talking-photo video loads (see sampleGreeting.js), so it
// is never a dead button or a placeholder. Nothing shows while the video is being checked.

// Settled founder copy (2026-10-15).
const REGISTER_LABEL = 'Create your free account';

// Greet-Me purple treatment. WCAG contrast (computed): headline on white 16.84:1; italic line on white
// 9.05:1; white on button purple 7.37:1; page text on the page background >= 14.2:1; page vs panel
// >= 3.07:1; panel vs cards 4.54-5.44:1.
const C = {
  pageTop: '#1e1138', pageBottom: '#241443', panel: '#8164cc', panelBottom: '#7457bf', panelLine: 'rgba(255,255,255,.22)',
  ink: '#1f1640', body: '#4b4560', purple: '#5b3fb8', purpleDark: '#4a2f9e', muted: '#6b6480', onPage: '#efeaff',
  green: '#166534', greenSoft: '#15803d', greenBg: '#f0fdf4', greenLine: '#bbf7d0',
};

const CSS = `
  .gm-landing { --col: 513px; --gap: .765rem; --panel-pad: .945rem; --panel-r: 20px; --card-r: 14.5px;
    --hc-pad: 1.53rem 1.71rem 1.35rem; --h1: 1.665rem; --sup: .958rem; --sup-w: 387px; --sup-mb: 1.035rem;
    --btn-pad: .675rem 1.35rem; --btn-h: 40px; --btn-fs: .855rem; --small: .75rem;
    --tile-pad: 1.17rem 1.53rem; --tile-btn-w: 297px; --tile-fs: .855rem; --note-w: 360px;
    --ctrl-pad: .405rem .72rem; --ctrl-h: 32px; --ctrl-fs: .75rem; --bar-pad: .54rem .72rem; --play: 58px;
    --top-fs: .85rem; --top-pad: .4rem .75rem; --page-pad: .9rem 1.25rem 2rem;
    position: relative; min-height: 100vh; box-sizing: border-box; font-family: ${FONT}; padding: var(--page-pad);
    background: radial-gradient(1200px 500px at 50% -15%, #34205f 0%, transparent 60%), linear-gradient(180deg, ${C.pageTop} 0%, ${C.pageBottom} 100%); }
  @media (max-width: 640px) {
    .gm-landing { --col: 100%; --gap: clamp(.7rem, 3vw, 1rem); --panel-pad: clamp(.5rem, 2.34vw, .81rem); --card-r: 16px;
      --hc-pad: clamp(1.08rem, 5.4vw, 1.44rem) clamp(.9rem, 4.5vw, 1.26rem); --h1: clamp(1.44rem, 6.84vw, 1.8rem); --sup: 1.01rem; --sup-w: 100%;
      --btn-pad: .81rem 1.26rem; --btn-h: 48px; --btn-fs: .95rem; --small: .78rem; --tile-pad: clamp(1rem, 4.5vw, 1.26rem) clamp(.9rem, 4.5vw, 1.26rem);
      --tile-btn-w: 100%; --tile-fs: .95rem; --note-w: 100%; --ctrl-pad: .5rem .81rem; --ctrl-h: 44px; --ctrl-fs: .85rem; --play: 65px;
      --top-fs: .92rem; --top-pad: .5rem .85rem; --page-pad: .6rem clamp(.5rem, 2.5vw, .9rem) 1.5rem; }
  }
  /* Menu (hamburger): wide screens in the screen's top-right corner; narrow screens inside the first card's corner,
     beside the centred logo, so it never covers content and reserves no row. */
  .gm-menu { position: absolute; z-index: 20; }
  .gm-menu-page { top: .9rem; right: 1.25rem; }
  .gm-menu-card { top: .55rem; right: .55rem; display: none; }
  @media (max-width: 699px) { .gm-menu-page { display: none; } .gm-menu-card { display: block; } }
  .gm-menu-btn { width: 44px; height: 44px; min-width: 44px; min-height: 44px; max-height: 44px; border-radius: 50%; padding: 0; cursor: pointer; display: inline-flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 4px; background: transparent; }
  .gm-menu-page .gm-menu-btn { border: 1.5px solid rgba(239,234,255,.55); }
  .gm-menu-page .gm-menu-btn span { background: ${C.onPage}; }
  .gm-menu-card .gm-menu-btn { border: 1.5px solid #e4dcf7; }
  .gm-menu-card .gm-menu-btn span { background: ${C.purple}; }
  .gm-menu-btn span { display: block; width: 18px; height: 2px; border-radius: 2px; }
  .gm-menu-list { position: absolute; right: 0; top: 52px; min-width: 248px; background: #fff; border-radius: 14px; padding: .45rem;
    box-shadow: 0 14px 36px rgba(10, 4, 30, .35); display: flex; flex-direction: column; gap: .2rem; text-align: left; }
  .gm-menu-item { display: flex; align-items: center; justify-content: flex-start; width: 100%; box-sizing: border-box; gap: .55rem; min-height: 44px; padding: .55rem .85rem; border-radius: 10px; border: 0; background: transparent;
    font: 600 .92rem ${FONT}; color: ${C.ink}; text-decoration: none; cursor: pointer; text-align: left; }
  .gm-menu-item:hover { background: #f3effc; }
  .gm-menu-item.primary { background: ${C.purple}; color: #fff; }
  .gm-menu-item.primary:hover { background: ${C.purpleDark}; }
  .gm-landing-head { position: relative; }
  /* Fit-to-screen: the whole panel scales (same proportions) so it sits inside the window on arrival. */
  .gm-landing-panel { zoom: var(--fit, 1); }
  .gm-menu-card { zoom: calc(1 / var(--fit, 1)); }
  .gm-landing-foot { zoom: 1; }
  .gm-landing-panel { width: 100%; max-width: calc(var(--col) + 2 * var(--panel-pad)); margin: 0 auto; box-sizing: border-box; padding: var(--panel-pad);
    background: linear-gradient(180deg, ${C.panel} 0%, ${C.panelBottom} 100%); border: 1px solid ${C.panelLine}; border-radius: var(--panel-r);
    box-shadow: 0 30px 80px rgba(8, 3, 25, .45), inset 0 1px 0 rgba(255,255,255,.12); display: grid; gap: var(--gap); }
  .gm-landing-card { background: #fff; border-radius: var(--card-r); box-shadow: 0 10px 28px rgba(10, 4, 30, .28); }
  .gm-landing-head { padding: var(--hc-pad); text-align: center; }
  .gm-landing-h1 { font-family: ${SERIF}; font-size: var(--h1); line-height: 1.18; font-weight: 700; color: ${C.ink}; margin: 0 0 .7rem; letter-spacing: -.01em; }
  .gm-landing-sup { font-family: ${SERIF}; font-style: italic; font-weight: 400; font-size: var(--sup); line-height: 1.5; color: ${C.body}; margin: 0 auto var(--sup-mb); max-width: var(--sup-w); }
  .gm-landing-primary { display: inline-flex; align-items: center; justify-content: center; gap: .55rem; padding: var(--btn-pad); min-height: var(--btn-h);
    background: ${C.purple}; color: #fff; border: 0; border-radius: 999px; font-size: var(--btn-fs); font-weight: 700; font-family: ${FONT}; cursor: pointer;
    box-shadow: 0 8px 20px rgba(91,63,184,.33); transition: background .12s, transform .12s; }
  .gm-landing-primary:hover { background: ${C.purpleDark}; transform: translateY(-1px); }
  .gm-landing-small { margin: .55rem 0 0; font-size: var(--small); color: ${C.muted}; line-height: 1.5; }
  .gm-landing-video { position: relative; background: #120a24; aspect-ratio: 1630 / 1080; cursor: pointer; overflow: hidden; border-radius: var(--card-r) var(--card-r) 0 0; }
  .gm-landing-video video { width: 100%; height: 100%; display: block; object-fit: contain; background: #120a24; }
  .gm-landing-cover { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .7rem;
    text-align: center; padding: 1rem; color: #fff; background: linear-gradient(135deg, #6c4fb8 0%, #3a2470 100%); }
  .gm-landing-play { width: var(--play); height: var(--play); min-width: var(--play); border-radius: 50%; border: 0; padding: 0; cursor: pointer;
    background: rgba(91,63,184,.94); color: #fff; font-size: calc(var(--play) * .38); box-shadow: 0 10px 30px rgba(0,0,0,.35);
    display: inline-flex; align-items: center; justify-content: center; }
  .gm-landing-bar { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; padding: var(--bar-pad); border-top: 1px solid #eee9f8; }
  .gm-landing-ctrl { display: inline-flex; align-items: center; gap: .4rem; padding: var(--ctrl-pad); min-height: var(--ctrl-h); border-radius: 999px;
    border: 1.5px solid #d9d2ef; background: #fff; color: ${C.ink}; font-family: ${FONT}; font-size: var(--ctrl-fs); font-weight: 600; cursor: pointer; }
  .gm-landing-ctrl.on { background: ${C.purple}; border-color: ${C.purple}; color: #fff; }
  .gm-landing-ctrl:disabled { opacity: .5; cursor: not-allowed; }
  .gm-landing-tile { padding: var(--tile-pad); text-align: center; }
  .gm-landing-tilebtn { width: 100%; max-width: var(--tile-btn-w); border-radius: 14px; font-size: var(--tile-fs); }
  .gm-landing-note { margin: 1rem auto 0; max-width: var(--note-w); padding: .85rem 1rem; background: ${C.greenBg}; border-radius: 12px; border: 1px solid ${C.greenLine}; }
  .gm-landing :focus-visible { outline: 3px solid #c4b5fd; outline-offset: 2px; }
  .gm-landing-foot { text-align: center; padding-top: 1rem; }
  .gm-landing-foot p { margin: 0; color: ${C.onPage}; font-size: .8rem; line-height: 1.6; }
`;

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  // Intro video: TAP TO PLAY, NO AUTOPLAY (founder, 2026-10-15). The first tap plays from the start
  // with sound; then the same tap pauses and resumes; after the end it replays.
  const intro = useIntroVideo();
  // The cover's Play disappears when playback starts; keep keyboard focus in the control bar
  // (Resume until the video is playing, then Pause) instead of letting it fall to the page.
  const barCtrlRef = useRef(null);
  const focusBarRef = useRef(false);
  useEffect(() => {
    if (!focusBarRef.current || !intro.started || intro.ended) return;
    barCtrlRef.current?.focus();
    if (intro.playing) focusBarRef.current = false;
  }, [intro.started, intro.ended, intro.playing]);
  const videoStatus = intro.status;

  // Sample Greet-Me: the entry, the viewer, and the reveal a scanned sample QR opens (#/?sample=credit).
  const sampleMedia = useSampleMediaAvailable(SAMPLE_TALKING_PHOTO_URL, SAMPLE_ENTRY_ENABLED);
  const SHOW_SAMPLE_ENTRY = SAMPLE_ENTRY_ENABLED && sampleMedia === 'available';
  const hashQuery = new URLSearchParams(window.location.hash.split('?')[1] || '');
  // A scanned sample QR asks for the reveal; it is honoured only when the sample itself is shown (same gate as
  // the button: enabled AND its video loads). While the video is being checked, nothing is shown yet.
  const sampleCreditRequested = SAMPLE_ENTRY_ENABLED && hashQuery.get('sample') === 'credit';
  const isSampleCreditView = sampleCreditRequested && SHOW_SAMPLE_ENTRY;
  const sampleCreditPending = sampleCreditRequested && sampleMedia === 'checking';
  const [sampleOpen, setSampleOpen] = useState(false);
  const [scanRevealOpen, setScanRevealOpen] = useState(sampleCreditRequested);
  const sampleBtnRef = useRef(null);
  const clearSampleQuery = () => { try { if (sampleCreditRequested) window.history.replaceState(null, '', window.location.pathname + '#/'); } catch { /* ignore */ } };
  const returnFocusRef = useRef(false);
  const [experienceOpen, setExperienceOpen] = useState(false); // The Greet-Me Experience (below)
  const closeSample = () => { setSampleOpen(false); setScanRevealOpen(false); clearSampleQuery(); returnFocusRef.current = true; };
  // After the sample closes, focus goes back to the button that opened it.
  useEffect(() => {
    if (sampleOpen || scanRevealOpen || experienceOpen || !returnFocusRef.current) return;
    returnFocusRef.current = false;
    sampleBtnRef.current?.focus();
  }, [sampleOpen, scanRevealOpen, experienceOpen]);

  // The Greet-Me Experience (entry CTA): the guided sample. Same gate as the sample (enabled AND its video loads).
  // On the way back the intro video starts from the beginning where the browser permits (useIntroVideo); when
  // it refuses, the Play cover stays with a short prompt, and keyboard focus goes to Play.
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const bigPlayRef = useRef(null);
  const openExperience = () => { intro.pause(); setScanRevealOpen(false); setAutoplayBlocked(false); setExperienceOpen(true); };
  const closeExperience = () => {
    setExperienceOpen(false);
    clearSampleQuery();
    videoCardRef.current?.scrollIntoView?.({ block: 'center' });
    // No intro to play: focus goes back to the entry button, after the dialog has closed and the landing is live again.
    if (videoStatus === 'failed') { returnFocusRef.current = true; return; }
    // Called from the visitor's Exit / Back press where there was one, so the browser can count that tap.
    focusBarRef.current = true;
    intro.autoplayFromStart().then((ok) => {
      if (ok) return;
      focusBarRef.current = false;
      setAutoplayBlocked(true);
    });
  };
  useEffect(() => { if (intro.playing) setAutoplayBlocked(false); }, [intro.playing]);
  useEffect(() => { if (autoplayBlocked) bigPlayRef.current?.focus(); }, [autoplayBlocked]);

  // Fit-to-screen (preview): scale = available height / natural panel height, between FIT_MIN and 1.
  const FIT_MIN = 0.75;
  const rootRef = useRef(null);
  useEffect(() => {
    const root = rootRef.current; if (!root) return undefined;
    const panel = root.querySelector('[data-testid="landing-panel"]'); if (!panel) return undefined;
    const fit = () => {
      const cur = parseFloat(window.getComputedStyle(root).getPropertyValue('--fit')) || 1;
      const rect = panel.getBoundingClientRect();
      const natural = rect.height / cur;                      // zoom scales width and height together
      if (!(natural > 0)) return;                             // not laid out (e.g. test DOM)
      const top = rect.top + window.scrollY;
      const avail = window.innerHeight - top - 12;
      let next = Math.max(FIT_MIN, Math.min(1, avail / natural));
      // Shrink-only after load: on phones the panel keeps full width, so wrapping makes height non-proportional
      // and a grow/shrink pair can alternate forever. A real window resize resets to 1 and fits again.
      if (next > cur) next = cur;
      if (Math.abs(next - cur) > 0.004) {
        root.style.setProperty('--fit', next.toFixed(3));
        // On phones the panel keeps full width while text shrinks, so height is not proportional: re-check until it settles.
        if ((fit.passes = (fit.passes || 0) + 1) < 8 && window.requestAnimationFrame) window.requestAnimationFrame(fit);
      } else { fit.passes = 0; }
    };
    fit();
    const ro = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(fit) : null; ro?.observe(panel);
    const onResize = () => { root.style.setProperty('--fit', '1'); fit.passes = 0; fit(); };
    window.addEventListener('resize', onResize);
    document.fonts?.ready?.then(fit).catch(() => {});
    // Layout settles for about a second after load (fonts, media metadata); re-check on animation frames meanwhile.
    // Layout only: playback is never started or delayed here.
    let frames = 0; let raf = 0;
    const settle = () => { fit(); if (++frames < 90 && window.requestAnimationFrame) raf = window.requestAnimationFrame(settle); };
    settle();
    return () => { ro?.disconnect(); window.removeEventListener('resize', onResize); if (raf && window.cancelAnimationFrame) window.cancelAnimationFrame(raf); };
  }, [SHOW_SAMPLE_ENTRY]);

  // Hamburger menu (one open state; only one of the two placements is visible at a time).
  const [menuOpen, setMenuOpen] = useState(null);   // 'page' | 'card' | null: only the tapped menu renders its items
  const menuRefs = useRef([]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (!menuRefs.current.some((el) => el && el.contains(e.target))) setMenuOpen(null); };
    const onKey = (e) => { if (e.key === 'Escape') { setMenuOpen(null); menuRefs.current.forEach((el) => el?.offsetParent && el.querySelector('button')?.focus()); } };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);
  const videoCardRef = useRef(null);
  const playDemo = () => {
    setMenuOpen(null);
    videoCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!intro.playing) { focusBarRef.current = true; intro.tap(); }
  };
  const renderMenu = (placement, i) => (
    <div className={`gm-menu gm-menu-${placement}`} ref={(el) => { menuRefs.current[i] = el; }} data-testid={`landing-menu-${placement}`}>
      <button type="button" className="gm-menu-btn" aria-label="Menu" aria-haspopup="true" aria-expanded={menuOpen === placement}
        aria-controls={`landing-menu-list-${placement}`} data-testid={`landing-menu-btn-${placement}`} onClick={() => setMenuOpen((o) => (o === placement ? null : placement))}>
        <span /><span /><span />
      </button>
      {menuOpen === placement ? (
        <nav className="gm-menu-list" id={`landing-menu-list-${placement}`} aria-label="Greet-Me menu">
          <Link to="/login" className="gm-menu-item" data-testid="landing-signin">Sign in</Link>
          <Link to="/register" className="gm-menu-item primary" data-testid="landing-register-top">{REGISTER_LABEL}</Link>
          {SHOW_SAMPLE_ENTRY ? (
            <button type="button" className="gm-menu-item" data-testid="landing-menu-experience" onClick={() => { setMenuOpen(null); openExperience(); }}>
              <span aria-hidden="true">✉</span> {EXPERIENCE_CHROME.ctaLabel}
            </button>
          ) : null}
          <button type="button" className="gm-menu-item" data-testid="landing-menu-play" onClick={playDemo} disabled={videoStatus === 'failed'}>
            <span aria-hidden="true">▶</span> Play demo
          </button>
        </nav>
      ) : null}
    </div>
  );

  // Demo mode: ?demo=1 prevents auth redirect so founder can show landing while logged in.
  // A scanned sample QR (?sample=credit) is exempt the same way, so a signed-in visitor sees the sample reveal,
  // but only when the sample is actually shown; if its video is missing, the usual redirect applies.
  const isDemoView = hashQuery.get('demo') === '1';
  useEffect(() => {
    if (!loading && isAuthenticated && !isDemoView && !isSampleCreditView && !sampleCreditPending) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate, isDemoView, isSampleCreditView, sampleCreditPending]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.pageTop }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (isAuthenticated && !isDemoView && !isSampleCreditView) return null;

  // Before the first tap, a branded cover with Play hides the not-yet-playing frame. After the end it
  // offers Replay. While playing or paused the video itself shows; the control bar stays visible.
  const showCover = videoStatus !== 'failed' && (!intro.started || intro.ended);
  const coverLabel = intro.ended ? 'Replay intro video from the start' : 'Play intro video';

  return (
    <div className="gm-landing" data-testid="landing-page" ref={rootRef}>
      <style>{CSS}</style>

      {/* Sign in, registration, sample and demo: one menu in the top-right corner */}
      {renderMenu('page', 0)}

      {/* One grouping panel behind the three cards */}
      <div className="gm-landing-panel" data-testid="landing-panel">
        <section className="gm-landing-card gm-landing-head" data-testid="landing-headcard">
          {renderMenu('card', 1)}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '.9rem' }}>
            <GreetMeLogo />
          </div>
          <h1 className="gm-landing-h1">Greetings and gifts that keep on giving.</h1>
          <p className="gm-landing-sup" data-testid="landing-support">Personalized, automatic moments. Truly unforgettable!</p>
          {SHOW_SAMPLE_ENTRY ? (
            <>
              <button type="button" ref={sampleBtnRef} className="gm-landing-primary" data-testid="landing-experience" onClick={openExperience}>
                <span aria-hidden="true">✉</span> {EXPERIENCE_CHROME.ctaLabel}
              </button>
              <p className="gm-landing-small">{SAMPLE_CHROME.ctaSubline}</p>
            </>
          ) : null}
        </section>

        {/* Intro video (content unchanged). Controls call useIntroVideo only. */}
        <section className="gm-landing-card" data-testid="landing-videocard" ref={videoCardRef}>
          <div className="gm-landing-video" onClick={intro.tap}>
            <video
              ref={intro.videoRef}
              preload={INTRO_VIDEO_PRELOAD}
              playsInline
              {...intro.videoEvents}
              aria-label="Greet-Me intro video"
              style={{ display: videoStatus === 'failed' ? 'none' : 'block' }}
            >
              {/* The same video, re-encoded with its playback index at the start, then the original as a
                  fallback: if the first cannot load (e.g. not uploaded yet), the browser moves to the
                  next source by itself. A <source> that cannot be fetched reports its own error, so that
                  case is driven by the LAST source. */}
              <source src={INTRO_VIDEO_FAST_START} type="video/mp4" />
              <source src={INTRO_VIDEO_ORIGINAL} type="video/mp4" onError={intro.lastSourceError} />
            </video>

            {showCover && (
              <div className="gm-landing-cover" data-testid="landing-video-cover">
                <button type="button" ref={bigPlayRef} className="gm-landing-play" data-testid="landing-big-play" aria-label={coverLabel}
                  onClick={(e) => { e.stopPropagation(); focusBarRef.current = true; intro.tap(); }}>
                  {intro.ended ? '↺' : '▶'}
                </button>
                {autoplayBlocked && !intro.ended ? (
                  <p data-testid="landing-autoplay-blocked" role="status" style={{ margin: 0, fontSize: '.9rem', fontWeight: 600, color: '#fff' }}>Press Play to start the intro video.</p>
                ) : null}
              </div>
            )}

            {/* Failure fallback — branded; safe link to the demo; never a black box */}
            {videoStatus === 'failed' && (
              <div className="gm-landing-cover" data-testid="landing-video-failed">
                <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.02em' }}>Greet&#8209;Me</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.95, maxWidth: '22rem' }}>See how a Greet-Me comes to life.</div>
                <a
                  href={INTRO_VIDEO_ORIGINAL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Open intro video"
                  style={{
                    marginTop: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    background: '#fff', color: C.purple, textDecoration: 'none',
                    borderRadius: '2rem', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 700,
                  }}
                >
                  ▶ Watch the demo
                </a>
              </div>
            )}
          </div>

          <div className="gm-landing-bar" data-testid="landing-video-controls">
            {intro.playing ? (
              <button type="button" ref={barCtrlRef} className="gm-landing-ctrl" onClick={intro.pause} aria-label="Pause intro video" data-testid="landing-pause"
                disabled={videoStatus === 'failed'}>❚❚ Pause</button>
            ) : (
              <button type="button" ref={barCtrlRef} className="gm-landing-ctrl on" onClick={intro.tap} aria-label={intro.started && !intro.ended ? 'Resume intro video' : 'Play intro video'}
                data-testid="landing-play" disabled={videoStatus === 'failed'}>▶ {intro.started && !intro.ended ? 'Resume' : 'Play'}</button>
            )}
            <button type="button" className="gm-landing-ctrl" onClick={intro.replay} aria-label="Replay intro video from the start" data-testid="landing-replay"
              disabled={videoStatus === 'failed'}>↺ Replay</button>
          </div>
        </section>

        {/* Sign-up card (the existing bottom tile, moved beneath the video; same width) */}
        <section className="gm-landing-card gm-landing-tile" data-testid="landing-tile">
          <button type="button" className="gm-landing-primary gm-landing-tilebtn" onClick={() => navigate('/register')} data-testid="landing-register-tile">
            {REGISTER_LABEL}
          </button>
          <p className="gm-landing-small" style={{ fontStyle: 'italic' }}>Takes less than a minute. No commitment.</p>
          <div className="gm-landing-note">
            <p style={{ fontSize: 'max(var(--small), .85rem)', fontWeight: 700, color: C.green, margin: '0 0 .25rem', lineHeight: 1.45 }}>
              New accounts include 5 free sends during your 7-day trial.
            </p>
            <p style={{ fontSize: 'var(--small)', color: C.greenSoft, margin: 0, lineHeight: 1.45 }}>
              Your first test Greet-Me is free and doesn&rsquo;t count against your five trial sends.
            </p>
          </div>
          <p className="gm-landing-small" style={{ color: C.body, marginTop: '1rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: C.purple, fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </section>
      </div>

      <footer className="gm-landing-foot">
        <p>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        <p>
          <a href="#/support" style={{ color: C.onPage, textDecoration: 'underline' }}>Support</a>
          {' · '}
          <a href="#/legal" style={{ color: C.onPage, textDecoration: 'underline' }}>Legal</a>
        </p>
      </footer>

      {SHOW_SAMPLE_ENTRY && sampleOpen ? (
        <Suspense fallback={null}>
          <SampleGreetingOverlay onClose={closeSample} />
        </Suspense>
      ) : null}
      {SHOW_SAMPLE_ENTRY && experienceOpen ? (
        <Suspense fallback={null}>
          <GreetMeExperience onExit={closeExperience} />
        </Suspense>
      ) : null}
      {SHOW_SAMPLE_ENTRY && scanRevealOpen && !sampleOpen ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, overflowY: 'auto' }} data-testid="landing-scan-reveal">
          <SampleCreditReveal onBack={() => { setScanRevealOpen(false); setSampleOpen(true); }} onClose={closeSample} />
        </div>
      ) : null}
    </div>
  );
}
