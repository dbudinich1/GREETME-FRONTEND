import { GreetingCard } from '../components/GreetingCardProto';

/**
 * MAX EDGE CASE fixture — 4 sentences near 120 char floor, 8-line poem
 * Used to stress-test auto-fit and layout at portrait 390×844.
 */
const MAX_FIXTURE_GREETING = {
  jobId: 'fixture-max-edge',
  status: 'done',
  recipientName: 'Alexander',
  senderName: 'Danny',
  occasionKey: 'birthday',
  relationshipKey: 'friend',
  // Body: 4 sentences, single paragraph, 123 chars (120–165 envelope), 24 words
  writtenIntroText: [
    'Happy Birthday!',
    '',
    'Today we celebrate another wonderful year. Every moment shared has been a treasure. Wishing you joy and happiness always. Here is to many more.',
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
  // Finale: 4 body lines + birthday sign-off, \n\n delimited (~148 chars body, 120–180 envelope)
  finaleText: 'Today we celebrate you and all you bring.\n\nEvery moment with you has been special.\n\nWishing you a year of new adventures.\n\nMay joy follow you wherever you go.\n\nMay all your birthday wishes come true.',
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
