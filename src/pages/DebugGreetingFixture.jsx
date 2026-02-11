import { GreetingCard } from '../components/GreetingCardProto';

const FIXTURE_GREETING = {
  jobId: 'fixture-job',
  status: 'done',
  recipientName: 'Dan',
  senderName: 'Danny',
  occasionKey: 'birthday',
  relationshipKey: 'friend',
  // Body: 4 sentences, single paragraph, 127 chars (120–165 envelope), 26 words
  writtenIntroText: [
    'Happy Birthday!',
    '',
    'Wishing you joy and laughter today. You mean the world to me. Every year with you is a blessing. Here is to your best year yet.',
    'Danny',
  ].join('\n'),
  // Poem: exactly 4 lines, 24–42 chars each
  poemText: [
    'May your day be bright and true,',
    'With moments made for smiling too,',
    'And every wish you hold so near,',
    'Find its way to you this year.',
  ].join('\n'),
  // Finale: 4 body lines + birthday sign-off, \n\n delimited (~147 chars body, 120–180 envelope)
  finaleText: 'I hope today fills your heart with joy.\n\nEvery moment with you is a treasure.\n\nYou deserve the best life can offer.\n\nMay your day be filled with love.\n\nMay all your birthday wishes come true.',
  videoUrl: null,
  photos: [],
};

export default function DebugGreetingFixture() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <GreetingCard
        greeting={FIXTURE_GREETING}
        recipientName={FIXTURE_GREETING.recipientName}
        senderName={FIXTURE_GREETING.senderName}
        writtenIntroText={FIXTURE_GREETING.writtenIntroText}
        poemText={FIXTURE_GREETING.poemText}
      />
    </div>
  );
}
