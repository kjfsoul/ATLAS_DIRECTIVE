const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

const LOCK_FILE = path.resolve(process.cwd(), 'narrative_edit.lock');
const agent = argv.agent || argv.a || 'unknown-agent';
const operation = argv.operation || argv.op || 'edit';

if (fs.existsSync(LOCK_FILE)) {
  console.error('Lock already acquired. Use lock:check to inspect.');
  process.exit(1);
}

const payload = {
  agent,
  operation,
  timestamp: new Date().toISOString(),
  pid: process.pid
};

fs.writeFileSync(LOCK_FILE, JSON.stringify(payload, null, 2), { encoding: 'utf8' });
console.log(`Lock acquired by ${agent}`);
process.exit(0);
