
import api from "./api";

export async function fetchOccasions() {
  const res = await api.get("/api/occasions");
  return res.data;
}

export async function createOccasion(payload) {
  const res = await api.post("/api/occasions", payload);
  return res.data;
}
