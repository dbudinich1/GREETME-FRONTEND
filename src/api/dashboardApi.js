import api from "./api";

export async function fetchDashboardStats() {
  const res = await api.get("/api/dashboard/stats");
  return res.data;
}

export async function fetchUpcomingEvents() {
  const res = await api.get("/api/dashboard/upcoming");
  return res.data;
}

export async function fetchRecentActivity() {
  const res = await api.get("/api/dashboard/recent");
  return res.data;
}
