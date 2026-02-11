import { GreetingCard } from '../components/GreetingCardProto';

/**
 * MINIMAL CONTENT fixture — 4 sentences (short), 4-line poem
 * Tests: variant +2px boost (<=3 sentences), LH expansion, poem fit
 */
const MIN_FIXTURE_GREETING = {
  jobId: 'fixture-min',
  status: 'done',
  recipientName: 'Amy',
  senderName: 'Dan',
  occasionKey: 'birthday',
  relationshipKey: 'friend',
  // Body: 4 sentences, single paragraph, 133 chars (120–165 envelope), 28 words
  writtenIntroText: [
    'Happy Birthday!',
    '',
    'Sending warmth and love your way. You light up every room you enter. May today bring you pure happiness. You are truly one of a kind.',
    'Dan',
  ].join('\n'),
  // Poem: exactly 4 lines, 24–42 chars each
  poemText: [
    'A wish for you on this bright day,',
    'May joy follow you in every way,',
    'With love and laughter all around,',
    'And blessings waiting to be found.',
  ].join('\n'),
  // Finale: 4 body lines + birthday sign-off, \n\n delimited (~145 chars body, 120–180 envelope)
  finaleText: 'Thinking of you today with a smile.\n\nYou bring light to everyone around you.\n\nHere is to another wonderful year.\n\nEvery day with you is a blessing.\n\nMay all your birthday wishes come true.',
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
