import api from "./api";

export async function fetchEvents() {
  const res = await api.get("/api/events");
  return res.data;
}

export async function createEvent(payload) {
  const res = await api.post("/api/events", payload);
  return res.data;
}
