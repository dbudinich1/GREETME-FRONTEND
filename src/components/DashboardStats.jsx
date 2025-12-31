import { useEffect, useState } from "react";
import { fetchDashboardStats } from "../api/dashboardApi";

export default function DashboardStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchDashboardStats().then(setStats);
  }, []);

  if (!stats) return <p>Loading stats…</p>;

  return (
    <div>
      <h3>Dashboard Stats</h3>
      <ul>
        <li>Total Contacts: {stats.totalContacts}</li>
        <li>Total Events: {stats.totalEvents}</li>
        <li>Greetings Sent: {stats.greetingsSent}</li>
      </ul>
    </div>
  );
}
