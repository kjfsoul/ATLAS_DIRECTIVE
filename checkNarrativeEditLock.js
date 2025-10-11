// checkNarrativeEditLock.js
// Usage: node checkNarrativeEditLock.js [path-to-narrative-json]
// Example: node checkNarrativeEditLock.js ./data/narrative_tree_complete_120_nodes.json

const fs = require("fs");
const path = require("path");

const LOCK_FILE = path.resolve(__dirname, "narrative_edit.lock");

function checkLock() {
  if (fs.existsSync(LOCK_FILE)) {
    const lockInfo = fs.readFileSync(LOCK_FILE, "utf8").trim();
    console.error(`🚨 Narrative edit lock active! Locked by: ${lockInfo}`);
    process.exit(1);
  } else {
    console.log(
      "✅ Narrative edit lock NOT detected. Safe to edit narrative JSON."
    );
    process.exit(0);
  }
}

function main() {
  if (process.argv.length < 3) {
    console.error(
      "Usage: node checkNarrativeEditLock.js [path-to-narrative-json]"
    );
    process.exit(2);
  }

  const narrativePath = path.resolve(process.argv[2]);
  if (!fs.existsSync(narrativePath)) {
    console.error(`Narrative JSON file not found: ${narrativePath}`);
    process.exit(3);
  }

  // Check if lock file exists
  checkLock();
}

main();

//Kevin, run this each time: node checkNarrativeEditLock.js ./data/narrative_tree_complete_120_nodes.json
