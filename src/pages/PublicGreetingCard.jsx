// src/pages/PublicGreetingCard.jsx
// Public greeting card view using GreetingCardViewer - no auth required
// Route: /g/:jobId

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/api';
import GreetingCardViewer from '../components/GreetingCardViewer';
import { GreetingCard as GreetingCardProto } from '../components/GreetingCardProto';
export default function PublicGreetingCard() {
  const { jobId } = useParams();

  const [greeting, setGreeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadGreeting();
  }, [jobId]);

  const loadGreeting = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.getPublicGreeting(jobId);

      if (response?.ok && response?.greeting) {
        const g = response.greeting;
        setGreeting({
          jobId: g.jobId || jobId,
          recipientName: g.recipientName || 'Friend',
          senderName: g.senderName || 'Dan',
          greetingText: g.greetingText || '',
          writtenIntroText: g.writtenIntroText || '',
          poemText: g.poemText || '',
          finaleText: g.finaleText || '',
          occasionKey: g.occasionKey || 'general',
          relationshipKey: g.relationshipKey || '',
          videoUrl: g.videoUrl || null,
          photos: g.photos || [],
          status: g.status || 'done',
        });
      } else {
        setError('Greeting not found');
      }
    } catch (err) {
      console.error('Error loading greeting:', err);
      setError('Unable to load greeting');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f3f0',
      }}>
        <p style={{
          color: '#6b7280',
          fontSize: '1rem',
          fontFamily: 'Georgia, serif',
        }}>
          Loading...
        </p>
      </div>
    );
  }

  // Error state
  if (error || !greeting) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f3f0',
        padding: '2rem',
      }}>
        <div style={{
          maxWidth: '400px',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '1.125rem',
            color: '#374151',
            marginBottom: '1rem',
            fontFamily: 'Georgia, serif',
          }}>
            This greeting is unavailable
          </p>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            fontFamily: 'Georgia, serif',
          }}>
            The link may have expired or the greeting doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  // Failed state - show error instead of spinning forever
  if (greeting.status === 'failed') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f3f0',
        padding: '2rem',
      }}>
        <div style={{
          maxWidth: '400px',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '1.125rem',
            color: '#374151',
            marginBottom: '1rem',
            fontFamily: 'Georgia, serif',
          }}>
            This greeting couldn't be created
          </p>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            fontFamily: 'Georgia, serif',
          }}>
            Please contact the sender to request a new one.
          </p>
        </div>
      </div>
    );
  }

  // Still processing state
  if (greeting.status !== 'done') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f3f0',
        padding: '2rem',
      }}>
        <div style={{
          maxWidth: '400px',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '1.125rem',
            color: '#374151',
            marginBottom: '1rem',
            fontFamily: 'Georgia, serif',
          }}>
            Your greeting is being prepared...
          </p>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            fontFamily: 'Georgia, serif',
          }}>
            Please check back in a few minutes.
          </p>
        </div>
      </div>
    );
  }

  // Render the premium greeting card experience
  return (
  <GreetingCardProto greeting={greeting} />
  );
}
    