const fs = require('fs');
const path = require('path');

const LOCK_FILE = path.resolve(process.cwd(), 'narrative_edit.lock');

function status() {
  if (!fs.existsSync(LOCK_FILE)) {
    console.log(JSON.stringify({ locked: false }));
    process.exit(0);
  }
  try {
    const raw = fs.readFileSync(LOCK_FILE, 'utf8');
    const data = JSON.parse(raw);
    console.log(JSON.stringify({ locked: true, lock: data }, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({ locked: true, error: 'invalid_lock_file', message: err.message }));
    process.exit(2);
  }
}

status();
