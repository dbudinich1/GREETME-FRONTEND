import { GreetingCard } from '../components/GreetingCardProto';

/**
 * STANDARD 4-SENTENCE fixture — 4 sentences, 120–165 char envelope, 4-line poem
 * Tests: full content at target spec, no boost (4 sentences = token default)
 */
const MULTI_PARA_FIXTURE_GREETING = {
  jobId: 'fixture-multi-para',
  status: 'done',
  recipientName: 'Sarah',
  senderName: 'Mike',
  occasionKey: 'birthday',
  relationshipKey: 'friend',
  // Body: 4 sentences, single paragraph, 145 chars (120–165 envelope), 27 words
  writtenIntroText: [
    'Happy Birthday!',
    '',
    'What a wonderful year it has been. You make every day brighter for us all. Wishing you peace and happiness today. Cheering you on now and always.',
    'Mike',
  ].join('\n'),
  // Poem: exactly 4 lines, 24–42 chars each
  poemText: [
    'On this day we celebrate you,',
    'And all the wonderful things you do,',
    'Your kindness lights the darkest night,',
    'Your smile makes everything right.',
  ].join('\n'),
  // Finale: 4 body lines + birthday sign-off, \n\n delimited (~166 chars body, 120–180 envelope)
  finaleText: 'What a year of surprises and beautiful moments.\n\nYou make the world better just by being here.\n\nCheering you on today and every day.\n\nMay your heart be full of happiness.\n\nMay all your birthday wishes come true.',
  videoUrl: null,
  photos: [],
};

export default function DebugGreetingMultiParaFixture() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <GreetingCard
        greeting={MULTI_PARA_FIXTURE_GREETING}
        recipientName={MULTI_PARA_FIXTURE_GREETING.recipientName}
        senderName={MULTI_PARA_FIXTURE_GREETING.senderName}
        writtenIntroText={MULTI_PARA_FIXTURE_GREETING.writtenIntroText}
        poemText={MULTI_PARA_FIXTURE_GREETING.poemText}
      />
    </div>
  );
}
