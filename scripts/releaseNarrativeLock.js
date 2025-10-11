const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

const LOCK_FILE = path.resolve(process.cwd(), 'narrative_edit.lock');
const agent = argv.agent || argv.a || null;
const force = argv.force || argv.f || false;

if (!fs.existsSync(LOCK_FILE)) {
  console.log('No lock file present.');
  process.exit(0);
}

try {
  const raw = fs.readFileSync(LOCK_FILE, 'utf8');
  const data = JSON.parse(raw);
  if (!force && agent && data.agent !== agent) {
    console.error(`Lock held by ${data.agent}. Use --force to override.`);
    process.exit(2);
  }
  fs.unlinkSync(LOCK_FILE);
  console.log('Lock released.');
  process.exit(0);
} catch (err) {
  console.error('Failed to release lock:', err.message);
  process.exit(3);
}
