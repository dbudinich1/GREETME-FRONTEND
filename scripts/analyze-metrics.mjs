import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('viewport-metrics-raw.json', 'utf8'));
const jobs = Object.keys(data);
const vps = ['390x844 portrait','844x390 landscape','667x375 landscape','1440x900 desktop'];

// Build scaling table per viewport (use Job1 for token reference, check all jobs for clipping)
console.log('=== TOKEN SCALING TABLE (from Job1) ===\n');
for (const vp of vps) {
  const m = data[jobs[0]].viewports[vp]?.metrics;
  if (!m) { console.log(vp + ': NO DATA\n'); continue; }
  console.log(`[${vp}]`);
  console.log(`  Token salutation:   ${m.tokens['--lock-salutation-font-size']}`);
  console.log(`  Token occasion:     ${m.tokens['--lock-occasion-font-size']}`);
  console.log(`  Token message:      ${m.tokens['--lock-message-font-size']}  lh: ${m.tokens['--lock-message-line-height']}`);
  console.log(`  Token signature:    ${m.tokens['--lock-signature-font-size']}`);
  console.log(`  Token poem:         ${m.tokens['--lock-poem-font-size']}  lh: ${m.tokens['--lock-poem-line-height']}`);
  console.log(`  Token warm-wishes:  ${m.tokens['--lock-warm-wishes-font-size']}`);
  console.log(`  Computed salutation: ${m.salutation?.fontSize || 'NOT FOUND'}`);
  console.log(`  Computed occasion:   ${m.occasion?.fontSize || 'NOT FOUND'}`);
  console.log(`  Computed message:    ${m.message?.fontSize || 'NOT FOUND'}`);
  console.log(`  Computed signature:  ${m.signature?.fontSize || 'NOT FOUND'}`);
  console.log(`  Computed poem:       ${m.poem?.fontSize || 'NOT FOUND'}`);
  console.log(`  Computed warmWishes: ${m.warmWishes?.fontSize || 'NOT FOUND'}`);
  console.log('');
}

// Check all jobs for clipping and collisions
console.log('\n=== CLIPPING / COLLISION CHECK (all jobs) ===\n');
let issues = [];
for (const jobId of jobs) {
  const label = data[jobId].label;
  for (const vp of vps) {
    const entry = data[jobId].viewports[vp];
    if (!entry || entry.error) { issues.push({ job: label, vp, issue: 'CAPTURE FAILED: ' + (entry?.error || 'no data') }); continue; }
    const m = entry.metrics;

    // Check element found
    const leftFound = m.salutation?.found && m.message?.found && m.signature?.found;
    const rightFound = m.poem?.found && m.warmWishes?.found;

    if (!leftFound) issues.push({ job: label, vp, issue: 'LEFT PAGE: elements not found (salutation/message/signature)' });
    if (!rightFound) issues.push({ job: label, vp, issue: 'RIGHT PAGE: elements not found (poem/warmWishes)' });

    // Clipping
    if (m.message?.clipped) issues.push({ job: label, vp, issue: `MESSAGE CLIPPED: scrollH=${m.message.scrollHeight} clientH=${m.message.clientHeight}` });
    if (m.poem?.clipped) issues.push({ job: label, vp, issue: `POEM CLIPPED: scrollH=${m.poem.scrollHeight} clientH=${m.poem.clientHeight}` });
    if (m.poemContent?.clipped) issues.push({ job: label, vp, issue: `POEM-CONTENT CLIPPED: scrollH=${m.poemContent.scrollHeight} clientH=${m.poemContent.clientHeight}` });

    // Collision
    if (m.messageSignatureCollision) issues.push({ job: label, vp, issue: `MSG/SIG COLLISION: gap=${m.messageSignatureGap}px` });

    // Warm wishes on left
    if (m.warmWishesLeftVisible === true) issues.push({ job: label, vp, issue: 'WARM WISHES VISIBLE ON LEFT PAGE' });

    // Poem last line
    if (m.poemLastLineVisible === false) issues.push({ job: label, vp, issue: `POEM LAST LINE HIDDEN: lastLine.bottom=${m.poemLastLineBottom} container.bottom=${m.poemContainerBottom}` });
  }
}

if (issues.length === 0) {
  console.log('NO ISSUES FOUND across all 5 jobs x 4 viewports.\n');
} else {
  console.log(`FOUND ${issues.length} ISSUES:\n`);
  for (const i of issues) {
    console.log(`  [${i.vp}] ${i.job}`);
    console.log(`    -> ${i.issue}`);
  }
}

// Token vs computed conformity (Job1 only for brevity)
console.log('\n=== TOKEN vs COMPUTED CONFORMITY (Job1) ===\n');
for (const vp of vps) {
  const m = data[jobs[0]].viewports[vp]?.metrics;
  if (!m) continue;
  console.log(`[${vp}]`);
  const checks = [
    { token: '--lock-salutation-font-size', computed: m.salutation?.fontSize },
    { token: '--lock-occasion-font-size', computed: m.occasion?.fontSize },
    { token: '--lock-message-font-size', computed: m.message?.fontSize },
    { token: '--lock-signature-font-size', computed: m.signature?.fontSize },
    { token: '--lock-poem-font-size', computed: m.poem?.fontSize },
    { token: '--lock-warm-wishes-font-size', computed: m.warmWishes?.fontSize },
  ];
  for (const c of checks) {
    const tokenVal = m.tokens[c.token];
    const match = c.computed === tokenVal ? 'Y' : 'N';
    console.log(`  ${c.token}: token=${tokenVal} computed=${c.computed || 'N/F'} match=${match}`);
  }
  console.log('');
}

// Summary stats
console.log('\n=== ELEMENT DIMENSIONS (Job1 per viewport) ===\n');
for (const vp of vps) {
  const m = data[jobs[0]].viewports[vp]?.metrics;
  if (!m) continue;
  console.log(`[${vp}]`);
  const els = { salutation: m.salutation, occasion: m.occasion, message: m.message, signature: m.signature, poem: m.poem, poemContent: m.poemContent, warmWishes: m.warmWishes, pageLeft: m.pageLeft, pageRight: m.pageRight, spread: m.spread };
  for (const [name, el] of Object.entries(els)) {
    if (!el?.found) { console.log(`  ${name}: NOT FOUND`); continue; }
    console.log(`  ${name}: ${el.width}x${el.height} top=${el.top} bottom=${el.bottom} scroll=${el.scrollHeight} client=${el.clientHeight} clipped=${el.clipped}`);
  }
  console.log('');
}
