/**
 * PersonalizedFeaturedSpread.jsx
 *
 * LANE 3 — conditional presentation of screen 4 for a greeting that carries `personalization`
 * (built by components/personalization/featuredMediaModel.js). Chosen by GreetingCard ONLY when
 * greeting.personalization is present; every existing greeting (personal or corporate) renders
 * exactly as before. Reuses the existing VideoPlayer, PhotoAlbum (with its music) and card paper.
 *
 * Layouts:
 *   media_then_memories  greeting media on the left, the memory photos (with music) after it ends
 *   media_full           the featured media across the whole spread
 *   memories_full        the memory photos across the whole spread, with music
 * (No featured media and no memory photos omits this screen upstream — resolveScreenOrder.)
 */

import { useEffect, useRef, useState } from 'react';
import VideoPlayer from './VideoPlayer';
import PhotoAlbum from './PhotoAlbum';
import cardInteriorImg from '../../assets/card/card-interior.png';
import './personalizedFeaturedSpread.css';

function StaticPhoto({ photoUrl, voiceUrl, onEnded, hasEnded }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  // No voice: nothing to wait for, so the memory photos are not held back.
  useEffect(() => { if (!voiceUrl && !hasEnded && onEnded) onEnded(); }, [voiceUrl, hasEnded, onEnded]);
  const toggle = (e) => {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); } else { el.play().catch(() => {}); setPlaying(true); }
  };
  return (
    <div className="gc-pfs-media gc-pfs-static" data-testid="pfs-static">
      {photoUrl ? <img className="gc-pfs-photo" src={photoUrl} alt="Featured photo" /> : null}
      {voiceUrl ? (
        <>
          <audio ref={audioRef} src={voiceUrl} preload="auto"
            onEnded={() => { setPlaying(false); onEnded && onEnded(); }} />
          <button type="button" className="gc-pfs-voice-btn" data-testid="pfs-voice" onClick={toggle}>
            {playing ? 'Pause voice message' : 'Play voice message'}
          </button>
        </>
      ) : null}
    </div>
  );
}

function AnimationPlaceholder({ photoUrl, onEnded, hasEnded }) {
  // A preview never requests an animation; it shows the chosen photo and says what will happen.
  useEffect(() => { if (!hasEnded && onEnded) onEnded(); }, [hasEnded, onEnded]);
  return (
    <div className="gc-pfs-media gc-pfs-animate" data-testid="pfs-animate">
      {photoUrl ? <img className="gc-pfs-photo" src={photoUrl} alt="Photo to animate" /> : null}
      <p className="gc-pfs-note">Your photo is animated with your voice when the card is sent.</p>
    </div>
  );
}

function FeaturedMedia({ media, videoHasEnded, onVideoEnd }) {
  const m = media || {};
  if (m.mode === 'video') {
    return (
      <div className="gc-pfs-media gc-pfs-video" data-testid="pfs-video">
        <VideoPlayer videoUrl={m.videoUrl} onEnded={onVideoEnd} hasEnded={videoHasEnded} playbackRate={1} />
      </div>
    );
  }
  if (m.mode === 'animate') {
    if (m.animationUrl) {
      return (
        <div className="gc-pfs-media gc-pfs-video" data-testid="pfs-animation">
          <VideoPlayer videoUrl={m.animationUrl} onEnded={onVideoEnd} hasEnded={videoHasEnded} />
        </div>
      );
    }
    return <AnimationPlaceholder photoUrl={m.photoUrl} onEnded={onVideoEnd} hasEnded={videoHasEnded} />;
  }
  if (m.mode === 'static') {
    return <StaticPhoto photoUrl={m.photoUrl} voiceUrl={m.voiceUrl} onEnded={onVideoEnd} hasEnded={videoHasEnded} />;
  }
  return null;
}

export default function PersonalizedFeaturedSpread({ personalization, onClick, videoHasEnded, onVideoEnd }) {
  const p = personalization || {};
  const layout = p.layout;
  const photos = Array.isArray(p.memoryPhotos) ? p.memoryPhotos : [];
  const showMedia = layout === 'media_then_memories' || layout === 'media_full';
  const showMemories = layout === 'media_then_memories' || layout === 'memories_full';
  const full = layout === 'media_full' || layout === 'memories_full';

  return (
    <div
      className="gc-spread-wrapper"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Click to continue"
      onKeyDown={(e) => e.key === 'Enter' && onClick && onClick()}
    >
      <div
        className={`gc-spread gc-featured-spread gc-pfs gc-pfs--${layout || 'none'}`}
        data-testid="pfs"
        data-layout={layout || 'none'}
        style={{ backgroundImage: `url(${cardInteriorImg})` }}
      >
        {showMedia ? (
          <div className={`gc-page gc-page-left gc-video-page gc-pfs-media-page${full ? ' gc-pfs-full' : ''}`}
            onClick={(e) => e.stopPropagation()}>
            <FeaturedMedia media={p.media} videoHasEnded={videoHasEnded} onVideoEnd={onVideoEnd} />
          </div>
        ) : null}
        {showMemories ? (
          <div className={`gc-page gc-page-right gc-album-page${full ? ' gc-pfs-full' : ''}`}
            onClick={(e) => e.stopPropagation()} data-testid="pfs-memories">
            <h3 className="gc-album-title">Cherished Moments</h3>
            {/* Memory photos wait for the greeting when there is one; alone they play at once. */}
            <PhotoAlbum photos={photos} disabled={layout === 'media_then_memories' ? !videoHasEnded : false} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
