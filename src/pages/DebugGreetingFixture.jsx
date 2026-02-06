import { GreetingCard } from '../components/GreetingCardProto';

const FIXTURE_GREETING = {
  jobId: 'fixture-job',
  status: 'done',
  recipientName: 'Dan',
  senderName: 'Danny',
  occasionKey: 'birthday',
  relationshipKey: 'friend',
  writtenIntroText: [
    'Dear Dan,',
    '',
    'Happy Birthday!',
    '',
    'Wishing you a day filled with joy, laughter, and everything you love.',
    'You deserve the very best today and always.',
    '',
    'Danny',
  ].join('\n'),
  poemText: [
    'May your day be bright and true,',
    'With moments made for smiling too,',
    'And every wish you hold so near,',
    'Find its way to you this year.',
  ].join('\n'),
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
