import { GreetingCard } from '../components/GreetingCardProto';

/**
 * MAX OVERFLOW EDGE CASE — long name, 4 sentences near 165 char ceiling, 4-line poem near 42 chars/line
 * Tests: auto-fit shrink on message, poem char envelope, salutation nowrap
 */
const MAX_OVERFLOW_FIXTURE_GREETING = {
  jobId: 'fixture-max-overflow',
  status: 'done',
  recipientName: 'Christopher',
  senderName: 'Alexandria',
  occasionKey: 'birthday',
  relationshipKey: 'friend',
  // Body: 4 sentences, single paragraph, 163 chars (near 165 max), 28 words
  writtenIntroText: [
    'Happy Birthday!',
    '',
    'Every year brings new adventures to treasure. May this chapter be your most wonderful yet. The world is brighter because of you. Wishing you nothing but joy today.',
    'Alexandria',
  ].join('\n'),
  // Poem: exactly 4 lines, each near 42 char max
  poemText: [
    'Through winding paths and sunlit days,',
    'May fortune guide you in all your ways,',
    'With laughter echoing through the years,',
    'And warmth to chase away all fears.',
  ].join('\n'),
  // Finale: 4 body lines + birthday sign-off, \n\n delimited (~169 chars body, 120–180 envelope)
  finaleText: 'Every year brings new joy and memories to cherish.\n\nThe world is brighter because of you.\n\nWishing you a day of love and celebration.\n\nMay your new chapter be extraordinary.\n\nMay all your birthday wishes come true.',
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
