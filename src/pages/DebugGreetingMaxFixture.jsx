import { GreetingCard } from '../components/GreetingCardProto';

/**
 * MAX EDGE CASE fixture — 120 char body (BODY_MAX_CHARS), 8 lines poem
 * Used to stress-test auto-fit and layout at portrait 390×844.
 */
const MAX_FIXTURE_GREETING = {
  jobId: 'fixture-max-edge',
  status: 'done',
  recipientName: 'Alexander',
  senderName: 'Danny',
  occasionKey: 'birthday',
  relationshipKey: 'friend',
  // Body = 119 chars (just under 120 limit)
  writtenIntroText: [
    'Dear Alexander,',
    '',
    'Happy Birthday!',
    '',
    'Today we celebrate another wonderful year. Every moment shared has been a treasure. Wishing you joy and happiness always.',
    '',
    'Danny',
  ].join('\n'),
  poemText: [
    'May your laughter fill the morning air,',
    'And sunshine warm your heart with care,',
    'Through every season, every year ahead,',
    'May blessings follow where you tread,',
    'With friends beside you, kind and true,',
    'The world shines brighter just for you,',
    'So celebrate this day with cheer,',
    'The best is yet to come, my dear.',
  ].join('\n'),
  videoUrl: null,
  photos: [],
};

export default function DebugGreetingMaxFixture() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <GreetingCard
        greeting={MAX_FIXTURE_GREETING}
        recipientName={MAX_FIXTURE_GREETING.recipientName}
        senderName={MAX_FIXTURE_GREETING.senderName}
        writtenIntroText={MAX_FIXTURE_GREETING.writtenIntroText}
        poemText={MAX_FIXTURE_GREETING.poemText}
      />
    </div>
  );
}
