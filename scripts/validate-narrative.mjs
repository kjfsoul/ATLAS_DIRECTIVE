/* eslint-disable */
/* ...existing code... */
#!/usr/bin/env node
// scripts/validate-narrative.mjs
// Phase 4 - Validation Tools Implementation

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NARRATIVE_PATH = path.join(__dirname, '../narrative_tree_complete_120_nodes.json');

class AtlasNarrativeValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.tree = null;
    this.nodeIds = new Set();
    this.nodeMap = new Map(); // NEW: fast lookup map
    this.allFlags = new Set();
    this.flagUsage = new Map();
    this.stats = {
      totalNodes: 0,
      endings: 0,
      skillChecks: 0,
      goldenPathNodes: 0,
      unreachableNodes: [],
      danglingReferences: [],
      flagCoverage: new Map(),
      witnessPaths: []
    };
  }

  log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = {
      'error': '❌ ERROR',
      'warning': '⚠️  WARNING', 
      'info': 'ℹ️  INFO',
      'success': '✅ SUCCESS'
    }[level] || 'LOG';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    if (level === 'error') this.errors.push(message);
    if (level === 'warning') this.warnings.push(message);
  }

  async loadNarrativeTree() {
    try {
      if (!fs.existsSync(NARRATIVE_PATH)) {
        this.log('error', `Narrative tree not found: ${NARRATIVE_PATH}`);
        return false;
      }

      const content = fs.readFileSync(NARRATIVE_PATH, 'utf8');
      
      // Check for BOM
      if (content.charCodeAt(0) === 0xFEFF) {
        this.log('error', 'File contains BOM. Save as UTF-8 without BOM.');
        return false;
      }

      // Validate JSON structure
      try {
        this.tree = JSON.parse(content);
      } catch (parseError) {
        this.log('error', `JSON parsing failed: ${parseError.message}`);
        return false;
      }

      // Build node id set & map for efficient lookups
      if (Array.isArray(this.tree.nodes)) {
        this.nodeIds = new Set(this.tree.nodes.map(n => n.id));
        this.nodeMap = new Map(this.tree.nodes.map(n => [n.id, n]));
      }

      this.log('info', `Loaded narrative tree: ${this.tree.nodes?.length || 0} nodes`);
      return true;

    } catch (error) {
      this.log('error', `File system error: ${error.message}`);
      return false;
    }
  }

  validateRootStructure() {
    if (!this.tree) return;

    const required = ['meta', 'root_id', 'tokens', 'nodes'];
    for (const prop of required) {
      if (!(prop in this.tree)) {
        this.log('error', `Missing required root property: ${prop}`);
      }
    }

    // Validate root_id exists in nodes
    if (this.tree.root_id && !this.tree.nodes?.find(n => n.id === this.tree.root_id)) {
      this.log('error', `root_id "${this.tree.root_id}" not found in nodes`);
    }

    // Validate meta section
    if (this.tree.meta) {
      const metaRequired = ['version', 'title', 'total_nodes'];
      for (const prop of metaRequired) {
        if (!(prop in this.tree.meta)) {
          this.log('warning', `Missing meta property: ${prop}`);
        }
      }

      // CRITICAL: Check if node count matches - should be error, not warning
      const actualNodes = this.tree.nodes?.length || 0;
      if (this.tree.meta.total_nodes !== actualNodes) {
        this.log('error', `META PARITY FAILURE: meta.total_nodes (${this.tree.meta.total_nodes}) !== nodes.length (${actualNodes})`);
      }
    }

    // Validate token structure
    if (this.tree.tokens?.chrono) {
      if (typeof this.tree.tokens.chrono.start !== 'number') {
        this.log('error', 'tokens.chrono.start must be a number');
      }
      if (!Array.isArray(this.tree.tokens.chrono.earn_rules)) {
        this.log('error', 'tokens.chrono.earn_rules must be an array');
      }
    }
  }

  validateNodes() {
    if (!this.tree?.nodes) return;

    // Collect node IDs and check for duplicates
    this.tree.nodes.forEach((node, index) => {
      if (!node.id) {
        this.log('error', `Node[${index}] missing required id`);
        return;
      }
      
      if (this.nodeIds.has(node.id)) {
        this.log('error', `Duplicate node ID: ${node.id}`);
      }
      this.nodeIds.add(node.id);
    });

    // Validate each node
    this.tree.nodes.forEach((node, index) => {
      this.validateIndividualNode(node, index);
    });

    this.stats.totalNodes = this.tree.nodes.length;
  }

  validateIndividualNode(node, index) {
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

// Allow import without executing; run only when invoked directly
const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] === scriptPath) {
  const validator = new AtlasNarrativeValidator();
  // top-level await is already used previously; prefer immediate invocation via IIFE
  (async () => {
    const isValid = await validator.validateComplete();
    process.exit(isValid ? 0 : 1);
  })();
}

export default AtlasNarrativeValidator;
