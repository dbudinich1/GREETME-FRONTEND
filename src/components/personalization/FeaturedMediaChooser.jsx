// src/components/personalization/FeaturedMediaChooser.jsx
//
// LANE 3 — SHARED PERSONALIZATION CONTROLS. One clear featured-media choice, reusable in any flow
// that shows the card's Featured Spread (a For Business campaign today; the individual composer is
// an integration follow-up). It is CONTROLLED: the caller owns the selection and where it is saved,
// so an individual send and a campaign each keep their own choice in their own context. No defaults,
// no inheritance.
//
// Reuses the existing capture components: PhotoUpload (photo), VoiceRecorder (voice) and the Media
// Library store (sender-owned photos only). VideoFilePicker is the one piece that did not exist.
// Captured files stay in this browser as the unsaved draft; this component makes NO request.

import { useMemo, useState } from "react";
import PhotoUpload from "../PhotoUpload";
import VoiceRecorder from "../VoiceRecorder";
import VideoFilePicker from "./VideoFilePicker";
import { ChoiceBubble, BubbleGroup } from "../corporateCampaign/Bubbles.jsx";
import { readSenderLibraryPhotos } from "./libraryPhotos";
import {
  MEDIA_CHOICES, MEDIA_MODES, CONTROL_INSTRUCTIONS, MESSAGE_MAX, VALIDATION_TEXT,
  controlsFor, setMode, setAsset, setMessage, validateSelection, emptySelection,
} from "./featuredMediaModel";
import "./personalization.css";

function localUrl(file) {
  try {
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") return URL.createObjectURL(file);
  } catch { /* fall through */ }
  return `local:${file && file.name ? file.name : "file"}`;
}

function fileFrom(formData, key) {
  return formData && typeof formData.get === "function" ? formData.get(key) : null;
}

export default function FeaturedMediaChooser({
  idPrefix = "pm",
  selection,
  onChange,
  disabled = false,
  libraryPhotos, // optional override; defaults to the sender's own Media Library photos
  savedVoice = null, // optional { url, label } — e.g. the signed-in person's saved voice
  showMessage = true,
  title = "Featured media",
}) {
  const sel = selection || emptySelection();
  const id = (s) => `${idPrefix}-${s}`;
  const emit = (next) => { if (!disabled && onChange) onChange(next); };
  const controls = controlsFor(sel.mode);
  const instructions = CONTROL_INSTRUCTIONS[sel.mode] || {};
  const { errors } = validateSelection(sel);
  const library = useMemo(() => (Array.isArray(libraryPhotos) ? libraryPhotos : readSenderLibraryPhotos()), [libraryPhotos]);
  // Bumped after each capture so the reused capture component starts fresh for the next one.
  const [captureKey, setCaptureKey] = useState(0);
  const [showLibrary, setShowLibrary] = useState(false);

  const usePhotoFile = async (formData) => {
    const f = fileFrom(formData, "photo");
    if (!f) return;
    emit(setAsset(sel, "photo", { url: localUrl(f), source: "upload", name: f.name, file: f, durable: false }));
    setCaptureKey((k) => k + 1);
  };
  const useVoiceFile = async (formData) => {
    const f = fileFrom(formData, "voice");
    if (!f) return;
    emit(setAsset(sel, "voice", { url: localUrl(f), source: "recording", name: f.name, file: f, durable: false }));
    setCaptureKey((k) => k + 1);
  };
  const useVideoFile = (f) => {
    if (!f) return;
    emit(setAsset(sel, "video", { url: localUrl(f), source: "upload", name: f.name, file: f, durable: false }));
  };

  const errorFor = (key) => (errors.includes(`${key}_required`) ? VALIDATION_TEXT[`${key}_required`] : null);

  return (
    <div className="pm-chooser" data-testid={id("chooser")} data-mode={sel.mode}>
      <BubbleGroup label={title} role="radiogroup" testId={id("modes")}>
        {MEDIA_CHOICES.map((c) => (
          <ChoiceBubble key={c.value} id={id(`mode-${c.value}`)} name={id("mode-group")} value={c.value}
            label={c.label} note={c.note} checked={sel.mode === c.value} disabled={disabled}
            onChange={(v) => emit(setMode(sel, v))} />
        ))}
      </BubbleGroup>

      {controls.length > 0 ? (
        <div className="pm-controls" data-testid={id("controls")}>
          {controls.map((c) => (
            <section key={c.key} className="pm-control" data-testid={id(`control-${c.key}`)}>
              <h5 className="pm-control-title">
                {c.key === "photo" ? "Photo" : c.key === "voice" ? "Voice" : "Video"}
                <span className={c.required ? "pm-tag pm-tag--req" : "pm-tag"}>{c.required ? "Required" : "Optional"}</span>
              </h5>
              {instructions[c.key] ? <p className="pm-hint">{instructions[c.key]}</p> : null}

              {sel[c.key] ? (
                <div className="pm-chosen" data-testid={id(`chosen-${c.key}`)}>
                  {c.key === "photo" ? <img className="pm-thumb" src={sel.photo.url} alt="Chosen photo" /> : null}
                  {c.key === "voice" ? <audio className="pm-audio" src={sel.voice.url} controls preload="none" /> : null}
                  {c.key === "video" ? <video className="pm-video-thumb" src={sel.video.url} controls preload="metadata" /> : null}
                  <span className="pm-chosen-label">
                    {sel[c.key].source === "library" ? "From your Media Library" : sel[c.key].source === "saved" ? (sel[c.key].label || "Your saved voice") : (sel[c.key].name || "Chosen")}
                  </span>
                  <button type="button" className="pm-btn pm-btn--quiet" disabled={disabled}
                    data-testid={id(`clear-${c.key}`)} onClick={() => emit(setAsset(sel, c.key, null))}>
                    Remove
                  </button>
                </div>
              ) : (
                <div className="pm-capture pm-reuse">
                  {c.key === "photo" ? (
                    <>
                      <PhotoUpload key={`p${captureKey}`} compact onUpload={usePhotoFile} uploadLabel="Use this photo" />
                      {library.length > 0 ? (
                        <div className="pm-library">
                          <button type="button" className="pm-btn pm-btn--quiet" disabled={disabled}
                            data-testid={id("library-toggle")} aria-expanded={showLibrary}
                            onClick={() => setShowLibrary((v) => !v)}>
                            {showLibrary ? "Hide Media Library" : "Choose from your Media Library"}
                          </button>
                          {showLibrary ? (
                            <div className="pm-library-grid" data-testid={id("library")}>
                              {library.map((p) => (
                                <button key={p.id} type="button" className="pm-library-item" disabled={disabled}
                                  onClick={() => { emit(setAsset(sel, "photo", { url: p.url, source: "library", durable: false })); setShowLibrary(false); }}>
                                  <img src={p.url} alt="Library photo" />
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  {c.key === "voice" ? (
                    <>
                      {savedVoice && savedVoice.url ? (
                        <button type="button" className="pm-btn" disabled={disabled} data-testid={id("saved-voice")}
                          onClick={() => emit(setAsset(sel, "voice", { url: savedVoice.url, source: "saved", label: savedVoice.label || "Your saved voice", durable: true }))}>
                          Use {savedVoice.label || "your saved voice"}
                        </button>
                      ) : null}
                      <VoiceRecorder key={`v${captureKey}`} onUpload={useVoiceFile} existingVoice={null}
                        scriptText={sel.mode === MEDIA_MODES.STATIC ? null : undefined}
                        uploadLabel="Use this recording" />
                    </>
                  ) : null}
                  {c.key === "video" ? <VideoFilePicker id={id("video")} disabled={disabled} onUse={useVideoFile} /> : null}
                </div>
              )}
              {errorFor(c.key) ? <p className="pm-error" data-testid={id(`error-${c.key}`)}>{errorFor(c.key)}</p> : null}
            </section>
          ))}
        </div>
      ) : null}

      {showMessage ? (
        <section className="pm-control" data-testid={id("control-message")}>
          <h5 className="pm-control-title">Personal message <span className="pm-tag">Optional</span></h5>
          <p className="pm-hint" data-testid={id("message-hint")}>
            {sel.mode === MEDIA_MODES.ANIMATE
              ? "Your message shapes the greeting spoken in the animation."
              : "Shown on the Intro page, after the greeting."}
          </p>
          <textarea id={id("message")} className="pm-textarea" rows={3} maxLength={MESSAGE_MAX} disabled={disabled}
            value={sel.message || ""} data-testid={id("message")}
            onChange={(e) => emit(setMessage(sel, e.target.value))} />
          <p className="pm-count">{(sel.message || "").length}/{MESSAGE_MAX}</p>
        </section>
      ) : null}
    </div>
  );
}
