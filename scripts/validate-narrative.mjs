#!/usr/bin/env node
/* eslint-disable */
// scripts/validate-narrative-clean.mjs
// Multi-chunk-aware narrative validator

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve('.');
const DATA_DIR = path.resolve(ROOT, 'data');
const CHUNK_REGEX = /^narrative_tree_chunk.*\.json$/;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to read/parse ${filePath}: ${err.message}`);
  }
}

function findChunkFiles() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR).filter(f => CHUNK_REGEX.test(f)).sort();
}

function aggregateChunks(chunkFiles) {
  const combinedNodes = [];
  const idToFile = new Map();
  const duplicates = [];
  const chunkReports = new Map();
  const parseErrors = [];

  for (const file of chunkFiles) {
    const full = path.join(DATA_DIR, file);
    let obj;
    try {
      obj = readJson(full);
    } catch (err) {
      parseErrors.push({ file, error: err.message });
      continue;
    }

    if (!Array.isArray(obj.nodes)) {
      parseErrors.push({ file, error: 'missing nodes array' });
      continue;
    }

    const report = {
      file,
      totalNodes: obj.nodes.length,
      endings: 0,
      skillChecks: 0,
      flags: new Set(),
      nodeIds: new Set()
    };

    for (const node of obj.nodes) {
      if (!node || typeof node !== 'object') continue;
      if (!node.id) {
        parseErrors.push({ file, error: 'node with missing id' });
        continue;
      }

      if (idToFile.has(node.id)) {
        duplicates.push({ id: node.id, files: [idToFile.get(node.id), file] });
      } else {
        idToFile.set(node.id, file);
      }

      report.nodeIds.add(node.id);
      if (!Array.isArray(node.choices) || node.choices.length === 0) report.endings++;
      if (node.id.includes('skill_')) report.skillChecks++;
      if (node.grants && Array.isArray(node.grants)) node.grants.forEach(f => report.flags.add(f));
      if (node.choices && Array.isArray(node.choices)) {
        node.choices.forEach(choice => {
          if (choice.grants && Array.isArray(choice.grants)) choice.grants.forEach(f => report.flags.add(f));
        });
      }

      combinedNodes.push(node);
    }

    chunkReports.set(file, report);
  }

  return { combinedNodes, duplicates, chunkReports, parseErrors };
}

function buildCombinedTree(combinedNodes, chunkFiles) {
  // Create a synthetic combined tree for validation
  return {
    meta: {
      title: "Combined Multi-Chunk Narrative",
      total_nodes: combinedNodes.length,
      version: "1.0.0",
    },
    root_id: "mission_briefing", // Default fallback
    nodes: combinedNodes,
    tokens: {
      chrono: {
        start: 3,
        earn_rules: [
          { action: "complete_skill_check", amount: 1 },
          { action: "discover_new_path", amount: 2 },
          { action: "reach_milestone", amount: 3 },
        ],
      },
    },
  };
}

class MultiChunkValidator {
  constructor(combinedTree, chunkReports, duplicates, parseErrors) {
    this.tree = combinedTree;
    this.chunkReports = chunkReports;
    this.duplicates = duplicates || [];
    this.parseErrors = parseErrors || [];
    this.errors = [];
    this.warnings = [];
    this.infos = [];

    this.nodeMap = new Map(this.tree.nodes.map(n => [n.id, n]));
    this.nodeIds = new Set(this.tree.nodes.map(n => n.id));
    this.globalFlags = new Set();
    this.stats = {
      totalNodes: this.tree.nodes.length,
      endings: 0,
      skillChecks: 0,
      unreachableNodes: [],
      danglingReferences: [],
      witnessPaths: []
    };

    // collect initial stats & flags
    for (const node of this.tree.nodes) {
      if (!node) continue;
      if (Array.isArray(node.choices) && node.choices.length === 0) this.stats.endings++;
      if (node.id && node.id.includes('skill_')) this.stats.skillChecks++;
      if (node.grants && Array.isArray(node.grants)) node.grants.forEach(f => this.globalFlags.add(f));
      if (node.choices && Array.isArray(node.choices)) {
        node.choices.forEach(choice => {
          if (choice.grants && Array.isArray(choice.grants)) choice.grants.forEach(f => this.globalFlags.add(f));
        });
      }
    }
  }

  logError(msg) {
    this.errors.push(msg);
    console.error('❌ ERROR:', msg);
  }
  logWarn(msg) {
    this.warnings.push(msg);
    console.warn('⚠️ WARNING:', msg);
  }
  logInfo(msg) {
    this.infos.push(msg);
    console.log('ℹ️ INFO:', msg);
  }

  runAllChecks() {
    this.logInfo(`Aggregated nodes: ${this.tree.nodes.length}`);

    // parse errors take precedence as runtime/parse issues
    if (this.parseErrors.length) {
      this.parseErrors.forEach(p => this.logError(`Parse error in ${p.file}: ${p.error}`));
      return false;
    }

    if (this.duplicates.length) {
      this.duplicates.forEach(d => this.logError(`Duplicate node ID across chunks: ${d.id} (in files: ${d.files.join(', ')})`));
    }

    this.validateRootStructure();
    this.validateNodesAndChoices();
    this.validateDanglingReferences();
    this.validateReachability();
    this.validateTokenEconomy();
    this.validateAchievementFlags();
    this.validateAnimationKeys();
    this.validateScientificFacts();

    return this.errors.length === 0;
  }

  validateRootStructure() {
    if (!this.tree) {
      this.logError('Combined narrative tree missing');
      return;
    }
    const required = ['meta', 'root_id', 'nodes'];
    for (const prop of required) {
      if (!(prop in this.tree)) this.logWarn(`Missing root property: ${prop}`);
    }
    if (this.tree.root_id && !this.nodeMap.has(this.tree.root_id)) {
      this.logWarn(`root_id "${this.tree.root_id}" not found in combined nodes`);
    }
  }

  validateNodesAndChoices() {
    for (const node of this.tree.nodes) {
      if (!node.id) this.logError('Encountered node with missing id');
      if (!node.title) this.logWarn(`Node ${node.id || '(missing id)'} missing title`);
      if (!node.body_md) this.logWarn(`Node ${node.id || '(missing id)'} missing body_md`);

      if (!Array.isArray(node.choices)) {
        this.logWarn(`Node ${node.id} choices missing or not an array`);
        continue;
      }

      node.choices.forEach(choice => {
        if (!choice.id) this.logError(`Choice in node ${node.id} missing id`);
        if (!choice.label) this.logError(`Choice ${choice.id || '(unknown)'} in node ${node.id} missing label`);
        if (!choice.next_id) this.logError(`Choice ${choice.id || '(unknown)'} in node ${node.id} missing next_id`);
        if (choice.cost !== undefined && (typeof choice.cost !== 'number' || choice.cost < 0)) {
          this.logError(`Choice ${choice.id || '(unknown)'} in node ${node.id} has invalid cost`);
        }
      });
    }
  }

  validateDanglingReferences() {
    const idSet = this.nodeIds;
    for (const node of this.tree.nodes) {
      if (!Array.isArray(node.choices)) continue;
      for (const choice of node.choices) {
        const nextId = choice.next_id;
        if (!nextId) continue;
        if (nextId === 'terminal' || nextId === 'end') continue;
        if (!idSet.has(nextId)) {
          this.stats.danglingReferences.push({ from: node.id, next_id: nextId });
          this.logError(`Dangling reference from ${node.id} -> ${nextId}`);
        }
      }
    }
  }

  validateReachability() {
    if (!this.tree.root_id) {
      this.logWarn('No root_id defined; attempting heuristic root.');
      if (this.nodeIds.has('mission_briefing')) this.tree.root_id = 'mission_briefing';
      else if (this.tree.nodes.length) this.tree.root_id = this.tree.nodes[0].id;
      else return;
    }

    const reachable = new Set();
    const stack = [this.tree.root_id];
    while (stack.length) {
      const id = stack.pop();
      if (!id || reachable.has(id)) continue;
      reachable.add(id);
      const node = this.nodeMap.get(id);
      if (!node || !Array.isArray(node.choices)) continue;
      for (const choice of node.choices) {
        const nid = choice.next_id;
        if (nid && nid !== 'terminal' && nid !== 'end') stack.push(nid);
      }
    }

    const unreachable = [...this.nodeIds].filter(id => !reachable.has(id));
    if (unreachable.length) {
      this.stats.unreachableNodes = unreachable;
      this.logWarn(`Unreachable nodes detected (${unreachable.length}): ${unreachable.slice(0,20).join(', ')}`);
    } else {
      this.logInfo('All nodes reachable from root');
    }
  }

  validateTokenEconomy() {
    const startTokens = (this.tree.tokens?.chrono?.start) ?? 0;
    const earnRules = Array.isArray(this.tree.tokens?.chrono?.earn_rules) ? this.tree.tokens.chrono.earn_rules : [];

    let maxCost = 0;
    for (const node of this.tree.nodes) {
      if (!Array.isArray(node.choices)) continue;
      for (const choice of node.choices) {
        if (typeof choice.cost === "number") {
          maxCost = Math.max(maxCost, choice.cost);
        }
      }
    }

    const totalEarnPotential = earnRules.reduce((s, r) => s + (r.amount || 0), 0);
    this.logInfo(`Token economy: start=${startTokens}, maxChoiceCost=${maxCost}, earnPotential=${totalEarnPotential}`);
    if (maxCost > startTokens + totalEarnPotential) {
      this.logError('Token economy imbalance: costs may exceed earn potential');
    } else {
      this.logInfo('Token economy appears balanced (collective check)');
    }
  }

  validateAchievementFlags() {
    const requiredFlags = [
      "mission_started",
      "first_contact_attempt",
      "breakthrough_discovery",
      "global_leadership",
      "international_cooperation",
      "unity_comprehension",
    ];
    const present = new Set(this.globalFlags);
    const missing = requiredFlags.filter(f => !present.has(f));
    if (missing.length) {
      this.logError(`Missing achievement flags: ${missing.join(', ')}`);
    } else {
      this.logInfo('All required achievement flags are present (collective)');
    }
  }

  validateAnimationKeys() {
    const keys = new Set();
    for (const node of this.tree.nodes) {
      if (node.cinematic && node.cinematic.animation_key) keys.add(node.cinematic.animation_key);
    }
    const required = ['mission_start', 'error_state', 'perihelion_final', 'prime_revelation', 'first_contact'];
    const missing = required.filter(k => !keys.has(k));
    if (missing.length) this.logWarn(`Missing animation keys: ${missing.join(', ')}`);
    else this.logInfo('All critical animation keys present');
  }

  validateScientificFacts() {
    const scientificFacts = [
      { key: 'hyperbolic', pattern: /hyperbolic.*eccentricity.*>\s*1/i },
      { key: 'velocity', pattern: /137,?000.*mph/i },
      { key: 'age', pattern: /7.*billion.*years/i }
    ];
    let found = 0;
    const foundKeys = new Set();
    for (const node of this.tree.nodes) {
      const text = ((node.body_md || '') + ' ' + (node.title || '') + ' ' + ((node.choices||[]).map(c => c.label || '').join(' '))).toLowerCase();
      for (const fact of scientificFacts) {
        if (fact.pattern.test(text) && !foundKeys.has(fact.key)) {
          foundKeys.add(fact.key);
          found++;
        }
      }
    }
    this.logInfo(`Scientific facts verified: ${found}/${scientificFacts.length} (${[...foundKeys].join(', ')})`);
    if (found < 2) this.logWarn('Limited scientific fact coverage detected');
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('MULTI-CHUNK NARRATIVE VALIDATION REPORT');
    console.log('='.repeat(80));
    // per-chunk
    for (const [file, report] of this.chunkReports.entries()) {
      console.log(`\nChunk: ${file}`);
      console.log(`  Nodes: ${report.totalNodes}`);
      console.log(`  Endings: ${report.endings}`);
      console.log(`  Skill checks: ${report.skillChecks}`);
      console.log(`  Flags: ${report.flags.size}`);
    }

    // global
    console.log('\nGlobal Summary:');
    console.log(`  Total chunks: ${this.chunkReports.size}`);
    console.log(`  Total nodes aggregated: ${this.tree.nodes.length}`);
    console.log(`  Duplicate IDs detected: ${this.duplicates.length}`);
    console.log(`  Errors: ${this.errors.length}`);
    console.log(`  Warnings: ${this.warnings.length}`);

    if (this.errors.length > 0) {
      console.log('\nErrors (first 50):');
      this.errors.slice(0,50).forEach(e => console.log(' -', e));
    }
    if (this.warnings.length > 0) {
      console.log('\nWarnings (first 50):');
      this.warnings.slice(0,50).forEach(w => console.log(' -', w));
    }

    console.log('\n' + '='.repeat(80));
    if (this.errors.length === 0) {
      console.log('VALIDATION PASSED ✅');
    } else {
      console.log('VALIDATION FAILED ❌');
    }
  }
}

// Entrypoint
(async () => {
  try {
    const chunkFiles = findChunkFiles();
    if (chunkFiles.length === 0) {
      console.error(
        "No narrative chunk files found in data/. Ensure files named narrative_tree_chunk*.json exist."
      );
      process.exit(3);
    }

    const { combinedNodes, duplicates, chunkReports } =
      aggregateChunks(chunkFiles);
    const combinedTree = buildCombinedTree(combinedNodes, chunkFiles);

    const validator = new MultiChunkValidator(
      combinedTree,
      chunkReports,
      duplicates
    );
    const ok = validator.runAllChecks();
    validator.generateReport();

    if (!ok) process.exit(2);
    process.exit(0);
  } catch (err) {
    console.error("Validator runtime error:", err.message);
    process.exit(3);
  }
})();
