
import api from "./api";

export async function uploadPhoto(file) {
  const form = new FormData();
  form.append("photo", file);

  const res = await api.post("/api/media/photo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}

export async function uploadVoice(file) {
  const form = new FormData();
  form.append("voice", file);

  const res = await api.post("/api/media/voice", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
}
