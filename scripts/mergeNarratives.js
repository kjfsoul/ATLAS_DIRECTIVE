const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(process.cwd(), 'data');
const OUT_DIR = path.resolve(process.cwd(), 'dist');
const OUT_FILE = path.join(OUT_DIR, 'narrative_tree_complete.json');

if (!fs.existsSync(DATA_DIR)) {
  console.error('No data directory found. Aborting.');
  process.exit(1);
}

const files = fs.readdirSync(DATA_DIR).filter(f => f.match(/^narrative_tree_chunk.*\.json$/));
if (files.length === 0) {
  console.error('No chunk files found in data/. Aborting.');
  process.exit(1);
}

const merged = { meta: { total_nodes: 0 }, nodes: [] };
const idMap = new Map();
const issues = [];

for (const file of files) {
  const full = path.join(DATA_DIR, file);
  try {
    const raw = fs.readFileSync(full, 'utf8');
    const obj = JSON.parse(raw);
    const nodes = obj.nodes || [];
    for (const node of nodes) {
      if (!node.id) {
        issues.push({ type: 'missing_id', file, node });
        continue;
      }
      if (idMap.has(node.id)) {
        // trivial resolution: append chunk filename suffix to keep unique ids
        const newId = `${node.id}--${path.basename(file, '.json')}`;
        issues.push({ type: 'duplicate_id_renamed', original: node.id, renamed: newId, file });
        node.id = newId;
      }
      idMap.set(node.id, true);
      merged.nodes.push(node);
    }
    // merge meta totals if present
    if (obj.meta && typeof obj.meta.total_nodes === 'number') {
      merged.meta.total_nodes += obj.meta.total_nodes;
    } else {
      merged.meta.total_nodes = merged.nodes.length;
    }
  } catch (err) {
    console.error(`Failed to parse ${file}:`, err.message);
    process.exit(2);
  }
}

// final meta.total_nodes sanity
merged.meta.total_nodes = merged.nodes.length;

// ensure out dir
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(merged, null, 2), 'utf8');

console.log('Merge completed:', {
  out: OUT_FILE,
  chunks: files.length,
  nodes: merged.nodes.length,
  issuesCount: issues.length
});

if (issues.length) {
  console.warn('Issues detected during merge (first 10):', issues.slice(0, 10));
  console.warn('Please review merge and run the validator.');
}

process.exit(0);
