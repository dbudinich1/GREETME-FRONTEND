import { GreetingCard } from '../components/GreetingCardProto';

const FIXTURE_GREETING = {
  jobId: 'fixture-job',
  status: 'done',
  recipientName: 'Dan',
  senderName: 'Danny',
  occasionKey: 'birthday',
  relationshipKey: 'friend',
  // Body: 4 sentences, single paragraph, ~195 chars (180–260 envelope)
  writtenIntroText: [
    'Dear Dan,',
    '',
    'Happy Birthday!',
    '',
    'Wishing you a day filled with joy, laughter, and love. You deserve nothing but the best today and always. Every moment we share means the world to me. Here is to another beautiful year ahead.',
    '',
    'Danny',
  ].join('\n'),
  // Poem: exactly 4 lines, 24–42 chars each
  poemText: [
    'May your day be bright and true,',
    'With moments made for smiling too,',
    'And every wish you hold so near,',
    'Find its way to you this year.',
  ].join('\n'),
  // Finale: 3 body lines + birthday sign-off (~158 chars, 120–180 envelope)
  finaleText: 'I hope today fills your heart with joy.\n\nEvery moment with you is a treasure.\n\nYou deserve the best life can offer.\n\nMay all your birthday wishes come true.',
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
