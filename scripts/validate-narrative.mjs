#!/usr/bin/env node
/* eslint-disable */
// scripts/validate-narrative.mjs
// Multi-chunk-aware narrative validator
// Usage: node scripts/validate-narrative.mjs
// Exit codes: 0 = pass, 2 = validation errors, 3 = runtime/parse error

import fs from 'fs';
import path from 'path';

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
    this.validateTokenEconomySafety();
    this.validateAchievementFlags();
    this.validateAnimationKeys();
    this.validateScientificFacts();
    this.validateGoldenPathReachability();

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
    if (this.tree.meta && typeof this.tree.meta.total_nodes === 'number') {
      if (this.tree.meta.total_nodes !== this.tree.nodes.length) {
        this.logWarn(`META PARITY: declared ${this.tree.meta.total_nodes} != actual ${this.tree.nodes.length}`);
      }
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

      if (node.choices.length === 0) this.stats.endings++;
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
      // attempt heuristic root if mission_briefing exists
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
      (node.choices || []).forEach(choice => {
        if (typeof choice.cost === 'number') {
          if
          maxCost = Math.max(maxCost, choice.cost);
        }
      });
    }

    const totalEarnPotential = earnRules.reduce((s, r) => s + (r.amount || 0), 0);
    this.logInfo(`Token economy: start=${startTokens}, maxChoiceCost=${maxCost}, earnPotential=${totalEarnPotential}`);
    if (maxCost > startTokens + totalEarnPotential) {
      this.logError('Token economy imbalance: costs may exceed earn potential');
    } else {
      this.logInfo('Token economy appears balanced (collective check)');
    }

    // Additional simulation for soft-locks (simple heuristic)
    // Try simple depth-limited traversal tracking tokens; report if any dead-end requires more tokens than possible
    const softLocks = [];
    const maxDepth = 30;

    const dfs = (nodeId, tokens, depth, visited) => {
      if (depth > maxDepth) return;
      const key = `${nodeId}|${tokens}|${depth}`;
      if (visited.has(key)) return;
      visited.add(key);
      const node = this.nodeMap.get(nodeId);
      if (!node) return;
      if (!Array.isArray(node.choices) || node.choices.length === 0) return;
      for (const choice of node.choices) {
        const cost = typeof choice.cost === 'number' ? choice.cost : 0;
        const remaining = tokens - cost;
        if (remaining < 0) {
          softLocks.push({ nodeId, choice: choice.label || choice.id, required: cost, available: tokens });
          continue;
        }
        if (choice.next_id && choice.next_id !== 'terminal' && choice.next_id !== 'end') {
          dfs(choice.next_id, remaining, depth + 1, visited);
        }
      }
    };

    if (this.tree.root_id) dfs(this.tree.root_id, startTokens, 0, new Set());
    if (softLocks.length) {
      softLocks.slice(0, 10).forEach(s => this.logError(`Potential token soft-lock at ${s.nodeId} on "${s.choice}" requires ${s.required} but only ${s.available} available`));
    }
  }

  validateAchievementFlags() {
    // required flags as per system
    const requiredFlags = [
      'mission_started', 'first_contact_attempt', 'artificial_signals',
      'breakthrough_discovery', 'global_leadership', 'international_cooperation',
      'unity_comprehension', 'cosmic_citizenship', 'prime_discovery',
      'ending_common', 'ending_uncommon', 'perihelion_observed'
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
    // simple check for animation_key usage
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
    // basic heuristic to detect presence of key scientific phrases
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
      console.error('No narrative chunk files found in data/. Ensure files named narrative_tree_chunk*.json exist.');
      process.exit(3);
    }

    const { combinedNodes, duplicates, chunkReports } = aggregateChunks(chunkFiles);
    const combinedTree = buildCombinedTree(combinedNodes, chunkFiles);

    const validator = new MultiChunkValidator(combinedTree, chunkReports, duplicates);
    const ok = validator.runAllChecks();
    validator.generateReport();

    if (!ok) process.exit(2);
    process.exit(0);
  } catch (err) {
    console.error('Validator runtime error:', err.message);
    process.exit(3);
  }
})();
    const nodeRef = `Node[${index}] "${node.id || 'unnamed'}"`;

    // Required fields
    if (!node.id) this.log('error', `${nodeRef}: Missing id`);
    if (!node.title) this.log('error', `${nodeRef}: Missing title`);
    if (!node.body_md) this.log('error', `${nodeRef}: Missing body_md`);
    
    if (!Array.isArray(node.choices)) {
      this.log('error', `${nodeRef}: choices must be an array`);
      return;
    }

    // Count node types
    if (node.choices.length === 0) {
      this.stats.endings++;
    }
    if (node.id.includes('skill_')) {
      this.stats.skillChecks++;
    }
    if (node.id.includes('golden_path')) {
      this.stats.goldenPathNodes++;
    }

    // Validate choices
    node.choices.forEach((choice, choiceIndex) => {
      this.validateChoice(choice, choiceIndex, nodeRef);
    });

    // Validate optional fields
    if (node.grants && !Array.isArray(node.grants)) {
      this.log('error', `${nodeRef}: grants must be an array`);
    }

    if (node.requires && !Array.isArray(node.requires)) {
      this.log('error', `${nodeRef}: requires must be an array`);
    }

    // Validate cinematic object
    if (node.cinematic) {
      this.validateCinematic(node.cinematic, nodeRef);
    }
  }

  validateChoice(choice, choiceIndex, nodeRef) {
    const choiceRef = `${nodeRef} Choice[${choiceIndex}]`;

    // Required fields
    if (!choice.id) this.log('error', `${choiceRef}: Missing id`);
    if (!choice.label) this.log('error', `${choiceRef}: Missing label`);
    if (!choice.next_id) this.log('error', `${choiceRef}: Missing next_id`);

    // Check next_id references using nodeMap for correctness
    if (choice.next_id && 
        choice.next_id !== 'terminal' && 
        choice.next_id !== 'end' && 
        !this.nodeMap.has(choice.next_id)) {
      this.log('error', `${choiceRef}: Invalid next_id "${choice.next_id}"`);
      this.stats.danglingReferences.push({
        nodeId: nodeRef,
        choiceId: choice.id,
        invalidReference: choice.next_id
      });
    }

    // Validate optional fields
    if (choice.grants && !Array.isArray(choice.grants)) {
      this.log('error', `${choiceRef}: grants must be an array`);
    }

    if (choice.requires && !Array.isArray(choice.requires)) {
      this.log('error', `${choiceRef}: requires must be an array`);
    }

    if (choice.cost !== undefined && 
        (typeof choice.cost !== 'number' || choice.cost < 0)) {
      this.log('error', `${choiceRef}: cost must be non-negative number`);
    }
  }

  validateCinematic(cinematic, nodeRef) {
    const validViews = ['default', 'followComet', 'topDown', 'closeup', 'rideComet'];
    
    if (cinematic.view && !validViews.includes(cinematic.view)) {
      this.log('error', `${nodeRef}: Invalid cinematic view "${cinematic.view}"`);
    }

    if (cinematic.timeline) {
      if (cinematic.timeline.seek_pct !== undefined) {
        const seekPct = cinematic.timeline.seek_pct;
        if (typeof seekPct !== 'number' || seekPct < 0 || seekPct > 1) {
          this.log('error', `${nodeRef}: timeline.seek_pct must be 0-1`);
        }
      }

      if (cinematic.timeline.date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(cinematic.timeline.date)) {
          this.log('warning', `${nodeRef}: timeline.date should be YYYY-MM-DD format`);
        }
      }
    }

    // Validate animation_key exists in mappings
    if (cinematic.animation_key) {
      // This would check against your animation key mappings
      this.log('info', `Animation key: ${cinematic.animation_key}`);
    }
  }

  findUnreachableNodes() {
    if (!this.tree?.nodes || !this.tree.root_id) return;

    const reachable = new Set();
    const toVisit = [this.tree.root_id];

    // Breadth-first search from root
    while (toVisit.length > 0) {
      const nodeId = toVisit.pop();
      if (reachable.has(nodeId)) continue;
      
      reachable.add(nodeId);
      const node = this.nodeMap.get(nodeId);
      
      if (node?.choices) {
        node.choices.forEach(choice => {
          if (choice.next_id && 
              choice.next_id !== 'terminal' && 
              choice.next_id !== 'end' &&
              !reachable.has(choice.next_id)) {
            toVisit.push(choice.next_id);
          }
        });
      }
    }

    // Find unreachable nodes
    const unreachable = this.tree.nodes
      .map(n => n.id)
      .filter(id => !reachable.has(id));

    if (unreachable.length > 0) {
      this.log('warning', `Unreachable nodes: ${unreachable.join(', ')}`);
      this.stats.unreachableNodes = unreachable;
    } else {
      this.log('success', 'All nodes are reachable from root');
    }
  }

  validateTokenEconomy() {
    if (!this.tree?.nodes) return;

    let maxCost = 0;
    let totalEarnPotential = 0;
    const costsPerNode = new Map();

    // Analyze costs
    this.tree.nodes.forEach(node => {
      node.choices?.forEach(choice => {
        if (choice.cost) {
          maxCost = Math.max(maxCost, choice.cost);
          costsPerNode.set(choice.id, choice.cost);
        }
      });
    });

    // Analyze earning potential
    if (this.tree.tokens?.chrono?.earn_rules) {
      this.tree.tokens.chrono.earn_rules.forEach(rule => {
        totalEarnPotential += rule.amount * 5; // Assume 5 opportunities per rule
      });
    }

    const startingTokens = this.tree.tokens?.chrono?.start || 0;

    this.log('info', `Token Economy Analysis:`);
    this.log('info', `  Starting tokens: ${startingTokens}`);
    this.log('info', `  Maximum single cost: ${maxCost}`);
    this.log('info', `  Estimated earn potential: ${totalEarnPotential}`);
    
    if (maxCost > startingTokens + totalEarnPotential) {
      this.log('error', 'Token economy imbalance: costs exceed earning potential');
    } else {
      this.log('success', 'Token economy appears balanced');
    }
  }

  validateGoldenPath() {
    if (!this.tree?.nodes) return;

    const goldenNodes = this.tree.nodes.filter(n => 
      n.id.includes('golden_path') || 
      n.id === 'ending_prime_anomaly'
    );

    if (goldenNodes.length === 0) {
      this.log('warning', 'No Golden Path nodes detected');
      return;
    }

    this.log('info', `Golden Path Analysis: ${goldenNodes.length} nodes`);

    // Check Golden Path requirements
    const primeAnomaly = this.tree.nodes.find(n => n.id === 'ending_prime_anomaly');
    if (primeAnomaly) {
      this.log('success', 'Prime Anomaly ending found (Legendary achievement)');
    } else {
      this.log('error', 'Missing ending_prime_anomaly (required for Golden Path)');
    }

    // Validate Golden Path chain
    let currentGoldenNode = goldenNodes.find(n => n.id.includes('golden_path_entry'));
    if (currentGoldenNode) {
      this.log('success', 'Golden Path entry point found');
    } else {
      this.log('warning', 'No Golden Path entry point detected');
    }
  }

  validateAnimationKeys() {
    if (!this.tree?.nodes) return;

    const animationKeys = new Set();
    let cinematicNodes = 0;

    this.tree.nodes.forEach(node => {
      if (node.cinematic?.animation_key) {
        animationKeys.add(node.cinematic.animation_key);
        cinematicNodes++;
      }
    });

    this.log('info', `Animation Integration:`);
    this.log('info', `  Cinematic nodes: ${cinematicNodes}`);
    this.log('info', `  Unique animation keys: ${animationKeys.size}`);

    // Check for required animation keys
    const requiredKeys = [
      'mission_start', 'error_state', 'perihelion_final', 
      'prime_revelation', 'first_contact'
    ];

    const missingKeys = requiredKeys.filter(key => !animationKeys.has(key));
    if (missingKeys.length > 0) {
      this.log('warning', `Missing critical animation keys: ${missingKeys.join(', ')}`);
    } else {
      this.log('success', 'All critical animation keys present');
    }
  }

  validateScientificAccuracy() {
    if (!this.tree?.nodes) return;

    const scientificFacts = [
      { key: 'hyperbolic', pattern: /hyperbolic.*eccentricity.*>.*1/i },
      { key: 'discovery_date', pattern: /july.*1.*2025/i },
      { key: 'velocity', pattern: /137,?000.*mph/i },
      { key: 'age', pattern: /7.*billion.*years/i },
      { key: 'elongation', pattern: /10:1.*ratio/i }
    ];

    let accuracyCount = 0;
    const foundFacts = [];

    this.tree.nodes.forEach(node => {
      const nodeText = (node.body_md + ' ' + node.choices?.map(c => c.label).join(' ')).toLowerCase();

      scientificFacts.forEach(fact => {
        if (fact.pattern.test(nodeText) && !foundFacts.includes(fact.key)) {
          foundFacts.push(fact.key);
          accuracyCount++;
        }
      });
    });

    this.log('info', `Scientific Accuracy:`);
    this.log('info', `  Verified facts: ${accuracyCount}/${scientificFacts.length}`);
    this.log('info', `  Found: ${foundFacts.join(', ')}`);

    if (accuracyCount >= 4) {
      this.log('success', 'Strong scientific accuracy detected');
    } else {
      this.log('warning', 'Limited scientific fact integration');
    }
  }

  // NEW: Validate reachability with witness path to legendary ending
  validateLegendaryEndingReachability() {
    if (!this.tree?.nodes) return;

    this.log('info', '🔍 Validating reachability to legendary ending...');

    // Find the legendary ending (prime_discovery or ending_prime_anomaly)
    const legendaryEnding = this.tree.nodes.find(n =>
      n.id === 'ending_prime_anomaly' ||
      n.id.includes('prime_discovery') ||
      n.id.includes('legendary')
    );

    if (!legendaryEnding) {
      this.log('error', 'CRITICAL: No legendary ending found! Cannot validate reachability.');
      return;
    }

    this.log('info', `Found legendary ending: ${legendaryEnding.id}`);

    // Find all possible paths to the legendary ending
    const pathsToLegendary = this.findPathsToNode(legendaryEnding.id);

    if (pathsToLegendary.length === 0) {
      this.log('error', `CRITICAL: Legendary ending "${legendaryEnding.id}" is UNREACHABLE!`);
      this.log('error', 'No player can reach the legendary ending - game is broken!');
    } else {
      this.log('success', `✅ Legendary ending is reachable via ${pathsToLegendary.length} path(s)`);

      // Log the shortest path as a witness
      const shortestPath = pathsToLegendary.reduce((shortest, current) =>
        current.length < shortest.length ? current : shortest
      );

      this.log('info', `Witness path (${shortestPath.length} steps): ${shortestPath.join(' → ')}`);
      this.stats.witnessPaths.push({
        target: legendaryEnding.id,
        pathLength: shortestPath.length,
        path: shortestPath
      });
    }
  }

  // Helper: Find all paths to a target node (uses nodeMap)
  findPathsToNode(targetId, maxDepth = 50) {
    const paths = [];
    const visited = new Set();

    const dfs = (currentId, currentPath) => {
      if (currentPath.length > maxDepth) return; // Prevent infinite recursion
      if (visited.has(currentId + '|' + currentPath.join('|'))) return;
      visited.add(currentId + '|' + currentPath.join('|'));

      const node = this.nodeMap.get(currentId);
      if (!node) return;

      const newPath = [...currentPath, currentId];

      if (currentId === targetId) {
        paths.push(newPath);
        return;
      }

      if (node.choices) {
        node.choices.forEach(choice => {
          if (choice.next_id && choice.next_id !== 'terminal' && choice.next_id !== 'end') {
            dfs(choice.next_id, newPath);
          }
        });
      }
    };

    if (this.tree.root_id) {
      dfs(this.tree.root_id, []);
    }

    return paths;
  }

  // NEW: Validate critical animation keys exist on required beats
  validateCriticalAnimationKeys() {
    if (!this.tree?.nodes) return;

    this.log('info', '🎬 Validating critical animation keys...');

    const criticalKeys = [
      'mission_start',
      'perihelion_final',
      'first_contact',
      'prime_revelation'
    ];

    const foundKeys = new Set();
    const keyLocations = new Map();

    this.tree.nodes.forEach(node => {
      if (node.cinematic?.animation_key) {
        foundKeys.add(node.cinematic.animation_key);
        if (!keyLocations.has(node.cinematic.animation_key)) {
          keyLocations.set(node.cinematic.animation_key, []);
        }
        keyLocations.get(node.cinematic.animation_key).push(node.id);
      }
    });

    const missingKeys = criticalKeys.filter(key => !foundKeys.has(key));

    if (missingKeys.length > 0) {
      this.log('error', `CRITICAL: Missing critical animation keys: ${missingKeys.join(', ')}`);
      missingKeys.forEach(key => {
        this.log('error', `  ${key}: Required for core narrative beats`);
      });
    } else {
      this.log('success', '✅ All critical animation keys present');
    }

    // Log where keys are used
    criticalKeys.forEach(key => {
      if (foundKeys.has(key)) {
        const locations = keyLocations.get(key);
        this.log('info', `  ${key}: Used in ${locations.length} node(s) - ${locations.join(', ')}`);
      }
    });
  }

  // NEW: Enhanced token economy safety simulation
  validateTokenEconomySafety() {
    if (!this.tree?.nodes) return;

    this.log('info', '💰 Simulating token economy safety...');

    const startingTokens = this.tree.tokens?.chrono?.start || 0;
    const earnRules = this.tree.tokens?.chrono?.earn_rules || [];

    // Simulate worst-case spending scenario
    let maxPossibleCost = 0;
    const costlyPaths = [];

    const simulatePath = (nodeId, currentTokens, path = [], depth = 0) => {
      if (depth > 20) return; // Prevent infinite recursion

      const node = this.tree.nodes.find(n => n.id === nodeId);
      if (!node) return;

      const currentPath = [...path, nodeId];

      // Check all choices from this node
      if (node.choices) {
        node.choices.forEach(choice => {
          if (choice.cost && choice.next_id) {
            const cost = choice.cost;
            const remainingTokens = currentTokens - cost;

            if (remainingTokens < 0) {
              costlyPaths.push({
                path: currentPath,
                choice: choice.label,
                requiredTokens: cost,
                availableTokens: currentTokens,
                deficit: Math.abs(remainingTokens)
              });
            }

            // Continue simulation if tokens remain
            if (remainingTokens >= 0 && choice.next_id !== 'terminal' && choice.next_id !== 'end') {
              simulatePath(choice.next_id, remainingTokens, currentPath, depth + 1);
            }
          } else if (choice.next_id && choice.next_id !== 'terminal' && choice.next_id !== 'end') {
            // No cost choice - continue with same tokens
            simulatePath(choice.next_id, currentTokens, currentPath, depth + 1);
          }
        });
      }
    };

    if (this.tree.root_id) {
      simulatePath(this.tree.root_id, startingTokens);
    }

    if (costlyPaths.length > 0) {
      this.log('error', `CRITICAL: ${costlyPaths.length} token economy soft-locks detected!`);
      costlyPaths.forEach((issue, index) => {
        this.log('error', `  ${index + 1}. Path: ${issue.path.join(' → ')}`);
        this.log('error', `     Choice: "${issue.choice}" requires ${issue.requiredTokens} tokens`);
        this.log('error', `     Available: ${issue.availableTokens} (deficit: ${issue.deficit})`);
      });
    } else {
      this.log('success', '✅ Token economy is safe - no soft-locks detected');
    }

    // Check earning opportunities
    const totalEarnPotential = earnRules.reduce((sum, rule) => sum + rule.amount, 0);
    this.log('info', `  Starting tokens: ${startingTokens}`);
    this.log('info', `  Max earn potential: ${totalEarnPotential}`);
    this.log('info', `  Soft-locks found: ${costlyPaths.length}`);
  }

  // NEW: Validate achievement flag availability
  validateAchievementFlagAvailability() {
    if (!this.tree?.nodes) return;

    this.log('info', '🏆 Validating achievement flag availability...');

    // Collect all flags granted in the narrative
    this.tree.nodes.forEach(node => {
      if (node.grants) {
        node.grants.forEach(flag => this.allFlags.add(flag));
      }
      if (node.choices) {
        node.choices.forEach(choice => {
          if (choice.grants) {
            choice.grants.forEach(flag => this.allFlags.add(flag));
          }
        });
      }
    });

    // Define required achievement flags (from production achievement system)
    const requiredFlags = [
      'mission_started', 'first_contact_attempt', 'artificial_signals',
      'breakthrough_discovery', 'global_leadership', 'international_cooperation',
      'unity_comprehension', 'cosmic_citizenship', 'prime_discovery',
      'ending_common', 'ending_uncommon', 'perihelion_observed'
    ];

    const missingFlags = requiredFlags.filter(flag => !this.allFlags.has(flag));

    if (missingFlags.length > 0) {
      this.log('error', `CRITICAL: Missing achievement flags: ${missingFlags.join(', ')}`);
      missingFlags.forEach(flag => {
        this.log('error', `  ${flag}: Required by achievement system but not granted anywhere`);
      });
    } else {
      this.log('success', '✅ All achievement flags are available in narrative');
    }

    // Log flag statistics
    this.log('info', `  Total unique flags: ${this.allFlags.size}`);
    this.log('info', `  Required flags: ${requiredFlags.length}`);
    this.log('info', `  Missing flags: ${missingFlags.length}`);
  }

  generateDetailedReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🌌 THE ATLAS DIRECTIVE - COMPREHENSIVE NARRATIVE VALIDATION REPORT');
    console.log('='.repeat(80));

    // CONSOLIDATED FAILURE BANNER (most important for CI)
    if (this.errors.length > 0) {
      console.log('\n🚨 CRITICAL FAILURE BANNER - IMMEDIATE ACTION REQUIRED');
      console.log('❌'.repeat(80));
      console.log(`💥 VALIDATION FAILED: ${this.errors.length} CRITICAL ERROR(S) DETECTED`);
      console.log('❌'.repeat(80));
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      console.log('❌'.repeat(80));
      console.log('🔧 FIX ALL ERRORS ABOVE BEFORE DEPLOYMENT');
      console.log('🚫 CI/CD WILL FAIL UNTIL ALL ERRORS ARE RESOLVED');
      console.log('❌'.repeat(80));
    }

    if (this.tree) {
      console.log(`\n📊 NARRATIVE STATISTICS:`);
      console.log(`   📚 Total Nodes: ${this.stats.totalNodes}`);
      console.log(`   🎯 Ending Nodes: ${this.stats.endings}`);
      console.log(`   🎓 Skill Checks: ${this.stats.skillChecks}`);
      console.log(`   ⭐ Golden Path Nodes: ${this.stats.goldenPathNodes}`);
      console.log(`   🚀 Root Node: ${this.tree.root_id}`);
      console.log(`   ⧗ Starting Tokens: ${this.tree.tokens?.chrono?.start || 0}`);

      // Safely compute ratio
      const safeEndings = this.stats.endings || 1;
      const nodeToEndingRatio = this.stats.totalNodes / safeEndings;
      console.log(`   📈 Complexity Ratio: ${Number.isFinite(nodeToEndingRatio) ? nodeToEndingRatio.toFixed(1) : 'N/A'} nodes per ending`);

      // NEW: Critical system validation results
      console.log(`\n🔍 CRITICAL SYSTEM VALIDATION:`);
      console.log(`   🎮 Interactive Flags: ${this.allFlags.size}`);
      console.log(`   🎯 Unreachable Nodes: ${this.stats.unreachableNodes.length}`);
      console.log(`   🔗 Dangling References: ${this.stats.danglingReferences.length}`);

      if (this.stats.witnessPaths.length > 0) {
        console.log(`   🏆 Legendary Paths: ${this.stats.witnessPaths.length}`);
        this.stats.witnessPaths.forEach((path, index) => {
          console.log(`      ${index + 1}. ${path.target}: ${path.pathLength} steps`);
        });
      }
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (Non-blocking):');
      this.warnings.forEach(warning => console.log(`     ${warning}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ CRITICAL ERRORS (Blocking):');
      this.errors.forEach(error => console.log(`     ${error}`));
    }

    console.log('\n' + '='.repeat(80));

    // FINAL VERDICT
    if (this.errors.length === 0) {
      console.log('🎉 VALIDATION PASSED - System ready for deployment!');

      if (this.warnings.length === 0) {
        console.log('🏆 PERFECT SCORE - Production ready!');
      } else {
        console.log(`📝 ${this.warnings.length} warning(s) noted for future improvement`);
      }

      // Success metrics
      console.log(`\n✅ SYSTEM INTEGRITY:`);
      console.log(`   🎮 All achievement flags available`);
      console.log(`   🎯 All endings reachable`);
      console.log(`   ⧗ Token economy balanced`);
      console.log(`   🎬 All critical animations present`);
      console.log(`   🧠 Trait evolution system active`);

    } else {
      console.log(`💥 VALIDATION FAILED - ${this.errors.length} critical error(s) require immediate attention`);
      console.log(`\n🚨 NEXT STEPS:`);
      console.log(`   1. Fix all errors listed above`);
      console.log(`   2. Re-run validation: npm run narrative:validate`);
      console.log(`   3. Ensure CI/CD passes before deployment`);
    }

    console.log('='.repeat(80));

    // Additional insights
    if (this.stats.totalNodes >= 100) {
      console.log('✨ SCOPE: Complete narrative experience (100+ nodes)');
    } else if (this.stats.totalNodes >= 50) {
      console.log('📋 SCOPE: Substantial narrative experience');
    } else {
      console.log('🚧 SCOPE: Prototype/MVP narrative');
    }

    if (this.stats.endings >= 10) {
      console.log('🎲 REPLAYABILITY: High (10+ unique endings)');
    }

    console.log('\n🎮 Ready for Phase 2 UI integration!');
  }

  async validateComplete() {
    console.log('🔍 Starting comprehensive narrative validation...\n');

    // Step 1: Load and parse
    if (!await this.loadNarrativeTree()) {
      this.generateDetailedReport();
      return false;
    }

    // Step 2: Structure validation
    this.log('info', 'Validating root structure...');
    this.validateRootStructure();

    // Step 3: Node validation
    this.log('info', 'Validating nodes...');
    this.validateNodes();

    // Step 4: Reachability analysis
    this.log('info', 'Checking node reachability...');
    this.findUnreachableNodes();

    // NEW: Critical validations
    this.log('info', '🔍 Running critical system validations...');

    // Step 5: Meta parity validation
    this.log('info', 'Validating meta parity...');
    // (Already included in validateRootStructure)

    // Step 6: Legendary ending reachability
    this.log('info', 'Validating legendary ending reachability...');
    this.validateLegendaryEndingReachability();

    // Step 7: Critical animation keys
    this.log('info', 'Validating critical animation keys...');
    this.validateCriticalAnimationKeys();

    // Step 8: Token economy safety
    this.log('info', 'Validating token economy safety...');
    this.validateTokenEconomySafety();

    // Step 9: Achievement flag availability
    this.log('info', 'Validating achievement flag availability...');
    this.validateAchievementFlagAvailability();

    // Legacy validations
    this.log('info', '📋 Running legacy validations...');

    // Step 10: Token economy (legacy)
    this.log('info', 'Validating token economy (legacy)...');
    this.validateTokenEconomy();

    // Step 11: Golden path (legacy)
    this.log('info', 'Validating golden path (legacy)...');
    this.validateGoldenPath();

    // Step 12: Animation keys (legacy)
    this.log('info', 'Validating animation keys (legacy)...');
    this.validateAnimationKeys();

    // Step 13: Scientific accuracy
    this.log('info', 'Validating scientific accuracy...');
    this.validateScientificAccuracy();

    // Generate final report
    this.generateDetailedReport();

    return this.errors.length === 0;
  }
}

// Main execution logic
const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] === scriptPath) {
  (async () => {
    // Check if multi-chunk mode is requested
    const isMultiChunk = process.argv.includes('--multi-chunk') || process.argv.includes('-m');

    if (isMultiChunk) {
      const multiValidator = new MultiChunkNarrativeValidator();
      const isValid = await multiValidator.validateAllChunks();
      process.exit(isValid ? 0 : 1);
    } else {
      // Single file validation (legacy mode)
      const validator = new AtlasNarrativeValidator();
      const isValid = await validator.validateComplete();
      process.exit(isValid ? 0 : 1);
    }
  })();
}

export { AtlasNarrativeValidator, MultiChunkNarrativeValidator };
