// src/components/personalization/VideoFilePicker.jsx
//
// LANE 3 — the one capability verified missing in the frontend: there is no existing component for
// choosing a greeting VIDEO file (PhotoUpload is image-only, VoiceRecorder is audio-only). This is
// the smallest picker that fits beside them: choose a file, see it, then use it. It hands the File
// to `onUse` and makes no request; where the file is stored is the caller's decision.

import { useEffect, useRef, useState } from "react";
import { VIDEO_TYPES, validateVideoFile } from "./videoFile";

export default function VideoFilePicker({ onUse, id = "pm-video", disabled = false }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => () => { if (url && typeof URL !== "undefined" && URL.revokeObjectURL) URL.revokeObjectURL(url); }, [url]);

  const pick = (f) => {
    const v = validateVideoFile(f);
    if (!v.valid) { setError(v.error); return; }
    setError(null);
    setFile(f);
    setUrl(typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(f) : null);
  };

  return (
    <div className="pm-video-picker" data-testid={`${id}-picker`}>
      <input
        ref={inputRef} id={id} type="file" accept={VIDEO_TYPES.join(",")} className="pm-visually-hidden"
        disabled={disabled} data-testid={`${id}-input`}
        onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) pick(f); }}
      />
      {/* Founder 2026-10-29: the Personal Video CTA reads exactly "Choose Video". */}
      {!file ? (
        <button type="button" className="pm-btn" data-testid={`${id}-choose`} disabled={disabled} onClick={() => inputRef.current && inputRef.current.click()}>
          Choose Video
        </button>
      ) : (
        <div className="pm-video-chosen">
          {url ? <video className="pm-video-thumb" src={url} controls preload="metadata" /> : null}
          <p className="pm-file-name">{file.name}</p>
          <div className="pm-row">
            <button type="button" className="pm-btn pm-btn--quiet" onClick={() => { setFile(null); setUrl(null); if (inputRef.current) inputRef.current.value = ""; }}>
              Cancel
            </button>
            <button type="button" className="pm-btn pm-btn--primary" data-testid={`${id}-use`}
              onClick={() => { onUse && onUse(file); setFile(null); setUrl(null); if (inputRef.current) inputRef.current.value = ""; }}>
              Use this video
            </button>
          </div>
        </div>
      )}
      {error ? <p className="pm-error" role="alert">{error}</p> : null}
    </div>
  );
}
