import { useState } from "react";
import { uploadPhoto, uploadVoice } from "../api/mediaApi";

export default function MediaLibrary() {
  const [photo, setPhoto] = useState(null);
  const [voice, setVoice] = useState(null);
  const [status, setStatus] = useState("");

  async function handleUpload() {
    try {
      setStatus("Uploading...");
      if (photo) await uploadPhoto(photo);
      if (voice) await uploadVoice(voice);
      setStatus("Upload complete");
    } catch {
      setStatus("Upload failed");
    }
  }

  return (
    <div>
      <h3>Media Library</h3>

      <input
        type="file"
        accept="image/*"
        onChange={e => setPhoto(e.target.files[0])}
      />

      <input
        type="file"
        accept="audio/*"
        onChange={e => setVoice(e.target.files[0])}
      />

      <button onClick={handleUpload}>Upload</button>
      <p>{status}</p>
    </div>
  );
}
