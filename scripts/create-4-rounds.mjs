/**
 * Create 4 rounds of 5 test jobs each (20 total) for comprehensive fit-safe testing
 *
 * MUTATING seed script — fail-closed (Team F). Production is ALWAYS rejected.
 * Requires ALLOW_ISOLATED_TEST=1 and API_BASE pointed at localhost / an exact
 * allow-listed non-production host. The guard runs at module top-level so any
 * rejection throws BEFORE a single network request is made.
 *   ALLOW_ISOLATED_TEST=1 API_BASE=http://127.0.0.1:8099 node scripts/create-4-rounds.mjs <token>
 */
import { requireSafeApiBase } from '../safety/apiTarget.mjs';

const API = requireSafeApiBase({ requireIsolatedOptIn: true, context: 'create-4-rounds.mjs' });
const TOKEN = process.argv[2];
if (!TOKEN) { console.error('Usage: ALLOW_ISOLATED_TEST=1 API_BASE=http://127.0.0.1:PORT node create-4-rounds.mjs <token>'); process.exit(1); }

const PHOTO = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400';

const jobTemplates = [
  { recipientName: 'Amy', occasionKey: 'birthday', tone: 'warm', relationshipKey: 'sister', personalSentiment: 'Happy birthday!' },
  { recipientName: 'Ben', occasionKey: 'thank_you', tone: 'heartfelt', relationshipKey: 'friend', personalSentiment: 'Thanks for everything.' },
  { recipientName: 'Catherine', occasionKey: 'congratulations', tone: 'warm', relationshipKey: 'cousin', personalSentiment: 'So proud of you!' },
  { recipientName: 'Grandma Rose', occasionKey: 'just_because', tone: 'heartfelt', relationshipKey: 'close_family', personalSentiment: 'Thinking of you always.' },
  { recipientName: 'Alexander Christopher', occasionKey: 'birthday', tone: 'heartfelt', relationshipKey: 'close_friend', personalSentiment: 'Another amazing year of friendship.' },
];

async function createJob(payload) {
  const res = await fetch(`${API}/api/jobs/send-greeting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function main() {
  const allRounds = [];

  for (let round = 1; round <= 4; round++) {
    console.log(`\n=== ROUND ${round} ===`);
    const roundJobs = [];
    for (const tmpl of jobTemplates) {
      const payload = {
        ...tmpl,
        recipientEmail: `r${round}-${tmpl.recipientName.toLowerCase().replace(/\s+/g, '')}@greetme.test`,
        photoUrl: PHOTO,
      };
      const result = await createJob(payload);
      const label = `R${round}-${tmpl.recipientName} (${tmpl.occasionKey})`;
      console.log(`  ${label}: ${result.ok ? 'OK' : 'FAIL'} jobId=${result.jobId || 'N/A'}`);
      if (result.jobId) roundJobs.push({ id: result.jobId, label });
    }
    allRounds.push(roundJobs);
  }

  // Output as JSON for easy consumption
  console.log('\n=== ALL JOB IDS (JSON) ===');
  console.log(JSON.stringify(allRounds, null, 2));
}

main().catch(console.error);
