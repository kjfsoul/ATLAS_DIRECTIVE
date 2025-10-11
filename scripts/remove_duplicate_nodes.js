// remove_duplicate_nodes.js
const fs = require("fs");
const path = require("path");

const dataDir = path.resolve(__dirname, "../data");
const nodeIdMap = new Map();

const chunkFiles = fs
  .readdirSync(dataDir)
  .filter((f) => f.startsWith("narrative_tree_chunk") && f.endsWith(".json"));

let duplicates = [];

chunkFiles.forEach((file) => {
  const filePath = path.join(dataDir, file);
  const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (!json.nodes || !Array.isArray(json.nodes)) {
    console.error(`${file} missing or invalid nodes array`);
    return;
  }
  json.nodes = json.nodes.filter((node) => {
    if (nodeIdMap.has(node.id)) {
      duplicates.push({ id: node.id, file });
      return false; // skip duplicate
    } else {
      nodeIdMap.set(node.id, file);
      return true;
    }
  });
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2), "utf-8");
});

if (duplicates.length) {
  console.log("Duplicates detected and removed:");
  duplicates.forEach((d) =>
    console.log(`Node ID ${d.id} duplicated in ${d.file}`)
  );
} else {
  console.log("No duplicate node IDs found across chunks.");
}
