// src/components/sample/useSampleMediaAvailable.js
//
// Is the sample's talking-photo video actually available? A detached <video> loads only its metadata
// ('available' on loadedmetadata, 'missing' on error). The landing offers "View Sample Greet-Me" only when this
// says 'available', so the entry can never point at a missing file and nothing is shown while checking.
// When the sample is not enabled no request is made ('off').
import { useEffect, useState } from 'react';

export default function useSampleMediaAvailable(url, enabled) {
  const [state, setState] = useState(enabled ? 'checking' : 'off');
  useEffect(() => {
    if (!enabled) { setState('off'); return undefined; }
    setState('checking');
    const v = document.createElement('video');
    let done = false;
    const finish = (s) => { if (!done) { done = true; setState(s); } };
    const onMeta = () => finish('available');
    const onError = () => finish('missing');
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('error', onError);
    v.preload = 'metadata';
    v.muted = true;
    v.src = url;
    return () => {
      done = true;
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('error', onError);
      v.removeAttribute('src');
    };
  }, [url, enabled]);
  return state;
}
