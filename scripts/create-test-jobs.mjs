/**
 * Create 5 test jobs for viewport metrics testing (fit-safe round)
 */
const API = 'https://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net';
const TOKEN = process.argv[2];
if (!TOKEN) { console.error('Usage: node create-test-jobs.mjs <token>'); process.exit(1); }

const PHOTO = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400';

const jobs = [
  { recipientName: 'Amy', recipientEmail: 'r1@greetme.test', occasionKey: 'birthday', tone: 'warm', relationshipKey: 'sister', personalSentiment: 'Happy birthday!', photoUrl: PHOTO },
  { recipientName: 'Ben', recipientEmail: 'r2@greetme.test', occasionKey: 'thank_you', tone: 'heartfelt', relationshipKey: 'friend', personalSentiment: 'Thanks for everything.', photoUrl: PHOTO },
  { recipientName: 'Catherine', recipientEmail: 'r3@greetme.test', occasionKey: 'congratulations', tone: 'warm', relationshipKey: 'cousin', personalSentiment: 'So proud of you!', photoUrl: PHOTO },
  { recipientName: 'Grandma Rose', recipientEmail: 'r4@greetme.test', occasionKey: 'just_because', tone: 'heartfelt', relationshipKey: 'close_family', personalSentiment: 'Thinking of you always.', photoUrl: PHOTO },
  { recipientName: 'Alexander Christopher', recipientEmail: 'r5@greetme.test', occasionKey: 'birthday', tone: 'heartfelt', relationshipKey: 'close_friend', personalSentiment: 'Another amazing year of friendship.', photoUrl: PHOTO },
];

async function createJob(payload) {
  const res = await fetch(`${API}/api/jobs/send-greeting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return data;
}

async function main() {
  const results = [];
  for (const job of jobs) {
    const result = await createJob(job);
    console.log(`${job.recipientName}: ${result.ok ? 'OK' : 'FAIL'} jobId=${result.jobId || 'N/A'}`);
    if (result.jobId) results.push({ name: job.recipientName, jobId: result.jobId });
  }
  console.log('\n--- Job IDs for viewport-metrics.mjs ---');
  results.forEach(r => console.log(`  { id: '${r.jobId}', label: '${r.name}' },`));
}

main().catch(console.error);
