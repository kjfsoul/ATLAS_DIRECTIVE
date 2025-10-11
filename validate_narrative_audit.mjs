/* eslint-disable */
import fs from 'fs';
import path from 'path';
// NEW: robust dirname for ESM
import { fileURLToPath } from 'url';

class NarrativeAuditor {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.tree = null;
    this.nodeIds = new Set();
    this.nodeMap = new Map();
    this.allFlags = new Set();
    this.flagUsage = new Map();
    this.reachableNodes = new Set();
    this.stats = {
      totalNodes: 0,
      endings: 0,
      skillChecks: 0,
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
      // Resolve relative to this script to avoid issues when run from different CWDs
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const filePath = path.join(__dirname, 'narrative_tree_complete_120_nodes.json');
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for BOM and warn/error
      if (content.charCodeAt(0) === 0xFEFF) {
        this.log('warning', 'File contains BOM; consider saving as UTF-8 without BOM.');
      }

      try {
        this.tree = JSON.parse(content);
      } catch (parseError) {
        this.log('error', `JSON parsing failed: ${parseError.message}`);
        return false;
      }

      // Build fast lookup structures
      if (Array.isArray(this.tree.nodes)) {
        this.nodeIds = new Set(this.tree.nodes.map(n => n.id));
        this.nodeMap = new Map(this.tree.nodes.map(n => [n.id, n]));
      } else {
        this.log('error', 'Invalid narrative: nodes must be an array');
        return false;
      }

      this.log('info', `Loaded narrative tree: ${this.tree.nodes?.length || 0} nodes`);
      return true;

    } catch (error) {
      this.log('error', `File system error: ${error.message}`);
      return false;
    }
  }

  validateStructure() {
    if (!this.tree) return;

    // Check meta parity
    const actualNodes = this.tree.nodes?.length || 0;
    if (this.tree.meta.total_nodes !== actualNodes) {
      this.log('error', `META PARITY FAILURE: meta.total_nodes (${this.tree.meta.total_nodes}) !== nodes.length (${actualNodes})`);
    }

    // Validate root exists
    if (this.tree.root_id && !this.nodeMap.has(this.tree.root_id)) {
      this.log('error', `root_id "${this.tree.root_id}" not found in nodes`);
    }
  }

  validateNodes() {
    if (!this.tree?.nodes) return;

    // Check for duplicate IDs
    const seenIds = new Set();
    this.tree.nodes.forEach((node, index) => {
      if (!node.id) {
        this.log('error', `Node[${index}] missing required id`);
        return;
      }

      if (seenIds.has(node.id)) {
        this.log('error', `Duplicate node ID: ${node.id}`);
      }
      seenIds.add(node.id);
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

    // Validate choices
    node.choices.forEach((choice, choiceIndex) => {
      this.validateChoice(choice, choiceIndex, nodeRef);
    });

    // Collect flags
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
  }

  validateChoice(choice, choiceIndex, nodeRef) {
    const choiceRef = `${nodeRef} Choice[${choiceIndex}]`;

    if (!choice.id) this.log('error', `${choiceRef}: Missing id`);
    if (!choice.label) this.log('error', `${choiceRef}: Missing label`);
    if (!choice.next_id) this.log('error', `${choiceRef}: Missing next_id`);

    // Check next_id references
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
  }

  findUnreachableNodes() {
    if (!this.tree?.nodes || !this.tree.root_id) return;

    const toVisit = [this.tree.root_id];

    while (toVisit.length > 0) {
      const nodeId = toVisit.pop();
      if (this.reachableNodes.has(nodeId)) continue;

      this.reachableNodes.add(nodeId);
      const node = this.nodeMap.get(nodeId);

      if (node?.choices) {
        node.choices.forEach(choice => {
          if (choice.next_id &&
              choice.next_id !== 'terminal' &&
              choice.next_id !== 'end' &&
              !this.reachableNodes.has(choice.next_id)) {
            toVisit.push(choice.next_id);
          }
        });
      }
    }

    // Find unreachable nodes
    const unreachable = this.tree.nodes
      .map(n => n.id)
      .filter(id => !this.reachableNodes.has(id));

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
    const startingTokens = this.tree.tokens?.chrono?.start || 0;

    this.tree.nodes.forEach(node => {
      node.choices?.forEach(choice => {
        if (choice.cost) {
          maxCost = Math.max(maxCost, choice.cost);
        }
      });
    });

    this.log('info', `Token Economy:`);
    this.log('info', `  Starting tokens: ${startingTokens}`);
    this.log('info', `  Maximum single cost: ${maxCost}`);

    if (maxCost > startingTokens) {
      this.log('error', 'Token economy imbalance: costs exceed starting tokens');
    } else {
      this.log('success', 'Token economy appears balanced');
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

  validateAchievementFlags() {
    const requiredFlags = [
      'mission_started', 'first_contact_attempt', 'artificial_signals',
      'breakthrough_discovery', 'global_leadership', 'international_cooperation',
      'unity_comprehension', 'cosmic_citizenship', 'prime_discovery',
      'ending_common', 'ending_uncommon', 'perihelion_observed'
    ];

    const missingFlags = requiredFlags.filter(flag => !this.allFlags.has(flag));

    if (missingFlags.length > 0) {
      this.log('error', `Missing achievement flags: ${missingFlags.join(', ')}`);
      missingFlags.forEach(flag => {
        this.log('error', `  ${flag}: Required by achievement system but not granted anywhere`);
      });
    } else {
      this.log('success', 'All achievement flags are available in narrative');
    }

    this.log('info', `  Total unique flags: ${this.allFlags.size}`);
    this.log('info', `  Required flags: ${requiredFlags.length}`);
    this.log('info', `  Missing flags: ${missingFlags.length}`);
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🌌 THE ATLAS DIRECTIVE - NARRATIVE AUDIT REPORT');
    console.log('='.repeat(80));

    if (this.errors.length > 0) {
      console.log('\n🚨 CRITICAL ERRORS:');
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (this.tree) {
      console.log(`\n📊 NARRATIVE STATISTICS:`);
      console.log(`   📚 Total Nodes: ${this.stats.totalNodes}`);
      console.log(`   🎯 Ending Nodes: ${this.stats.endings}`);
      console.log(`   🎓 Skill Checks: ${this.stats.skillChecks}`);
      console.log(`   🚀 Root Node: ${this.tree.root_id}`);
      console.log(`   ⧗ Starting Tokens: ${this.tree.tokens?.chrono?.start || 0}`);
      console.log(`   🎮 Interactive Flags: ${this.allFlags.size}`);
      console.log(`   🎯 Unreachable Nodes: ${this.stats.unreachableNodes.length}`);
      console.log(`   🔗 Dangling References: ${this.stats.danglingReferences.length}`);
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`     ${warning}`));
    }

    console.log('\n' + '='.repeat(80));

    if (this.errors.length === 0) {
      console.log('🎉 AUDIT PASSED - Narrative structure is valid!');
    } else {
      console.log(`💥 AUDIT FAILED - ${this.errors.length} critical error(s) found`);
    }

    console.log('='.repeat(80));
  }

  async runAudit() {
    console.log('🔍 Starting narrative audit...\n');

    if (!await this.loadNarrativeTree()) {
      this.generateReport();
      return false;
    }

    this.log('info', 'Validating structure...');
    this.validateStructure();

    this.log('info', 'Validating nodes...');
    this.validateNodes();

    this.log('info', 'Checking reachability...');
    this.findUnreachableNodes();

    this.log('info', 'Validating token economy...');
    this.validateTokenEconomy();

    this.log('info', 'Validating scientific accuracy...');
    this.validateScientificAccuracy();

    this.log('info', 'Validating achievement flags...');
    this.validateAchievementFlags();

    this.generateReport();

    return this.errors.length === 0;
  }
}

// Allow import without executing; run only when invoked directly
export default NarrativeAuditor;

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const auditor = new NarrativeAuditor();
  (async () => {
    const success = await auditor.runAudit();
    // ensure graceful exit code for CI
    process.exit(success ? 0 : 1);
  })();
}
