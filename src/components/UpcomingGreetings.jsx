// src/components/UpcomingGreetings.jsx
import { useState, useEffect } from 'react';
import api from '../api/api';
import { getErrorMessage } from '../utils/errorMessages';
import { getOccasionIcon } from '../utils/helpers';

const STATUS_LABELS = {
  null: { text: 'Pending', color: '#7F8C8D', bg: '#F4F6F7' },
  scheduled: { text: 'Scheduled', color: '#2E86C1', bg: '#D6EAF8' },
  queued: { text: 'Processing', color: '#E67E22', bg: '#FDEBD0' },
  delivered: { text: 'Delivered', color: '#27AE60', bg: '#D5F5E3' },
  failed: { text: 'Failed', color: '#E74C3C', bg: '#FADBD8' }
};

export default function UpcomingGreetings() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const data = await api.get('/api/dashboard/upcoming?days=30');
        setEvents(data.data || []);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchUpcoming();
  }, []);

  if (loading) return <div style={{ padding: '1rem', textAlign: 'center' }}>Loading upcoming greetings...</div>;
  if (error) return <div style={{ padding: '1rem', color: '#E74C3C' }}>{error}</div>;

  if (events.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        background: '#F8F9FA',
        borderRadius: '12px',
        border: '1px dashed #CCC'
      }}>
        <p style={{ fontSize: '1.1rem', color: '#555', margin: 0 }}>
          No upcoming greetings scheduled.
        </p>
        <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '0.5rem' }}>
          Add occasions to your contacts to activate automatic Greet-Me™ greetings.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
      {events.slice(0, 10).map((event) => {
        const icon = getOccasionIcon(event.occasionType);
        const status = STATUS_LABELS[event.scheduleStatus] || STATUS_LABELS[null];
        const isUrgent = event.daysUntil <= 3;

        return (
          <div key={event.occasionId} style={{
            background: '#FFF',
            borderRadius: '12px',
            padding: '1.25rem',
            border: isUrgent ? '2px solid #E74C3C' : '1px solid #E0E0E0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'transform 0.2s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{icon}</span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '12px',
                color: status.color,
                background: status.bg,
              }}>
                {status.text}
              </span>
            </div>
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '1rem', color: '#1A1A2E' }}>
              {event.contactName}
            </h4>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#666', textTransform: 'capitalize' }}>
              {event.occasionType.replace(/_/g, ' ')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#888' }}>
                {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: isUrgent ? '#E74C3C' : '#3A7BD5',
              }}>
                {event.daysUntil === 0 ? 'Today!' : event.daysUntil === 1 ? 'Tomorrow' : `${event.daysUntil} days`}
              </span>
            </div>
            {event.autoSend && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#27AE60' }}>
                ⚡ Auto-send enabled
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
