/**
 * runViewportTripwires.cjs
 * Sequentially runs all viewport tripwires. Stops on first failure.
 * Usage: npm run tripwire:all
 */

const { execSync } = require('child_process');

const TRIPWIRES = [
  { label: 'Mobile Gold', cmd: 'npm run tripwire:mobile' },
  { label: 'Desktop Gold', cmd: 'npm run tripwire:desktop' },
];

function banner(text) {
  const line = '='.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${text}`);
  console.log(`${line}\n`);
}

let passed = 0;

for (const { label, cmd } of TRIPWIRES) {
  banner(`Running: ${label}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    passed++;
  } catch {
    console.error(`\nFAILED: ${label}`);
    process.exit(1);
  }
}

banner(`ALL_TRIPWIRES_PASS (${passed}/${TRIPWIRES.length})`);
