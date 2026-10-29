// src/hooks/useIntroVideo.js
//
// Playback for the landing page's intro video. Founder decision (2026-10-15): TAP TO PLAY, NO
// AUTOPLAY. The first Play starts the video FROM THE BEGINNING WITH SOUND, so the opening welcome is
// heard; after that the same control pauses and resumes, and Replay starts it over.
// One exception (founder spec, 2026-10-29): on the way back from The Greet-Me Experience the landing calls
// autoplayFromStart(), which starts it the same way where the browser permits and otherwise leaves the Play cover.
//
// Owned by Team 2 (video behaviour). The landing layout (Team 3) renders the controls and calls these
// handlers; it does not re-implement them.

import { useCallback, useRef, useState } from 'react';

export default function useIntroVideo() {
  const videoRef = useRef(null);
  // 'loading' until the video can show a frame, 'ready' once it can, 'failed' when no source works.
  const [status, setStatus] = useState('loading');
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);

  // From the start, with sound. A tap is the interaction browsers require before sound, so this is
  // only ever called from a user's tap or click.
  const playFromStart = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    try { v.currentTime = 0; } catch { /* not seekable yet: playback begins at 0 anyway */ }
    setStarted(true);
    setEnded(false);
    v.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    const v = videoRef.current;
    if (v && !v.paused) v.pause();
  }, []);

  const resume = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {});
  }, []);

  const replay = playFromStart;

  // Returning from The Greet-Me Experience: the same start (from 0:00, with sound), but only where the browser
  // permits it. Resolves true once playback starts. When the browser refuses (play() rejects, e.g. no recent
  // tap), nothing is left half-started: `started` goes back to false so the landing shows its Play cover again,
  // and it resolves false. Never retried muted: the opening welcome is meant to be heard.
  const autoplayFromStart = useCallback(() => {
    const v = videoRef.current;
    if (!v) return Promise.resolve(false);
    v.muted = false;
    try { v.currentTime = 0; } catch { /* not seekable yet: playback begins at 0 anyway */ }
    setStarted(true);
    setEnded(false);
    let p;
    try { p = v.play(); } catch (err) { p = Promise.reject(err); }
    return Promise.resolve(p).then(() => true, () => { setStarted(false); setPlaying(false); return false; });
  }, []);

  // One tap target: the first tap plays from the start; then it pauses and resumes; after the end it
  // replays.
  const tap = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!started || ended) { playFromStart(); return; }
    if (v.paused) resume(); else pause();
  }, [started, ended, playFromStart, resume, pause]);

  const videoEvents = {
    onLoadedData: () => setStatus('ready'),
    onCanPlay: () => setStatus('ready'),
    onPlaying: () => { setStatus('ready'); setPlaying(true); },
    onPause: () => setPlaying(false),
    onEnded: () => { setPlaying(false); setEnded(true); },
    // A source that loads but cannot be played (e.g. it fails to decode) is reported on the <video>.
    onError: () => setStatus('failed'),
  };
  // A <source> that cannot be fetched reports its own error; only the LAST one means nothing works.
  const lastSourceError = () => setStatus('failed');

  return { videoRef, status, started, playing, ended, playFromStart, autoplayFromStart, pause, resume, replay, tap, videoEvents, lastSourceError };
}
