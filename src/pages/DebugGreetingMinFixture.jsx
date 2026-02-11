import { GreetingCard } from '../components/GreetingCardProto';

/**
 * MINIMAL CONTENT fixture — 3 sentences (min fallback), 4-line poem
 * Tests: variant +2px boost (<=3 sentences), LH expansion, poem fit
 */
const MIN_FIXTURE_GREETING = {
  jobId: 'fixture-min',
  status: 'done',
  recipientName: 'Amy',
  senderName: 'Dan',
  occasionKey: 'birthday',
  relationshipKey: 'friend',
  // Body: 3 sentences (min fallback), single paragraph, ~185 chars (180–260 envelope)
  writtenIntroText: [
    'Dear Amy,',
    '',
    'Happy Birthday!',
    '',
    'Thinking of you today and sending all my warmest wishes your way. You bring so much light and happiness to everyone around you. May this birthday be as wonderful and special as you are.',
    '',
    'Dan',
  ].join('\n'),
  // Poem: exactly 4 lines, 24–42 chars each
  poemText: [
    'A wish for you on this bright day,',
    'May joy follow you in every way,',
    'With love and laughter all around,',
    'And blessings waiting to be found.',
  ].join('\n'),
  // Finale: 3 body lines + birthday sign-off (~153 chars, 120–180 envelope)
  finaleText: 'Thinking of you today with a smile.\n\nYou bring light to everyone around you.\n\nHere is to another wonderful year.\n\nMay all your birthday wishes come true.',
  videoUrl: null,
  photos: [],
};

export default function DebugGreetingMinFixture() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <GreetingCard
        greeting={MIN_FIXTURE_GREETING}
        recipientName={MIN_FIXTURE_GREETING.recipientName}
        senderName={MIN_FIXTURE_GREETING.senderName}
        writtenIntroText={MIN_FIXTURE_GREETING.writtenIntroText}
        poemText={MIN_FIXTURE_GREETING.poemText}
      />
    </div>
  );
}
