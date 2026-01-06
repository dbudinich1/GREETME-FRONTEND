// src/components/UpcomingEvents.jsx
import { useEffect, useState } from "react";
import { fetchUpcomingEvents } from "../api/dashboardApi";

export default function UpcomingEvents() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetchUpcomingEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  return (
    
    <div>
      <h3>Upcoming Events</h3>

      {events.length === 0 && <p>No upcoming events.</p>}

      <ul>
        {events.map((e) => {
          if (!e?.date || String(e.date).trim() === "") return null;

          return (
            <li key={e.id}>
              {e.title} — {new Date(e.date).toLocaleDateString()}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
