import { GreetingCard } from '../components/GreetingCardProto';

/**
 * MAX OVERFLOW EDGE CASE — long name, 4 sentences near 260 char ceiling, 4-line poem near 42 chars/line
 * Tests: auto-fit shrink on message, poem char envelope, salutation nowrap
 */
const MAX_OVERFLOW_FIXTURE_GREETING = {
  jobId: 'fixture-max-overflow',
  status: 'done',
  recipientName: 'Christopher',
  senderName: 'Alexandria',
  occasionKey: 'birthday',
  relationshipKey: 'friend',
  // Body: 4 sentences, single paragraph, ~257 chars (near 260 max)
  writtenIntroText: [
    'Dear Christopher,',
    '',
    'Happy Birthday!',
    '',
    'Every year brings new adventures and cherished memories we hold dear. May this birthday be the start of your most wonderful chapter yet. The world is brighter because you are in it and I feel grateful every day. Wishing you nothing but joy and celebration.',
    '',
    'Alexandria',
  ].join('\n'),
  // Poem: exactly 4 lines, each near 42 char max
  poemText: [
    'Through winding paths and sunlit days,',
    'May fortune guide you in all your ways,',
    'With laughter echoing through the years,',
    'And warmth to chase away all fears.',
  ].join('\n'),
  // Finale: 3 body lines + birthday sign-off (~175 chars, 120–180 envelope)
  finaleText: 'Every year brings new joy and memories to cherish.\n\nThe world is brighter because of you.\n\nWishing you a day of love and celebration.\n\nMay all your birthday wishes come true.',
  videoUrl: null,
  photos: [],
};

export default function DebugGreetingMaxOverflowFixture() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <GreetingCard
        greeting={MAX_OVERFLOW_FIXTURE_GREETING}
        recipientName={MAX_OVERFLOW_FIXTURE_GREETING.recipientName}
        senderName={MAX_OVERFLOW_FIXTURE_GREETING.senderName}
        writtenIntroText={MAX_OVERFLOW_FIXTURE_GREETING.writtenIntroText}
        poemText={MAX_OVERFLOW_FIXTURE_GREETING.poemText}
      />
    </div>
  );
}
