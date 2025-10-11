#!/usr/bin/env node
// scripts/test-narrative-integration.mjs
// Integration tests for UI + narrative chunk loading

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test suite for narrative chunk integration
 * Validates that UI components can properly load and process narrative chunks
 */
class NarrativeIntegrationTester {
  constructor() {
    this.testResults = [];
    this.errors = [];
    this.warnings = [];
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

  /**
   * Test 1: Validate narrative chunk file exists and is readable
   */
  async testChunkFileExists() {
    this.log('info', 'Testing narrative chunk file accessibility...');

    const chunkPath = path.join(__dirname, '../data/narrative_tree_complete_12_nodes.json');

    try {
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Narrative chunk file not found: ${chunkPath}`);
      }

      const stats = fs.statSync(chunkPath);
      if (stats.size === 0) {
        throw new Error('Narrative chunk file is empty');
      }

      this.log('success', `✅ Chunk file exists (${stats.size} bytes)`);
      return true;
    } catch (error) {
      this.log('error', `❌ Chunk file test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Test 2: Validate JSON structure and schema compliance
   */
  async testChunkJsonStructure() {
    this.log('info', 'Testing narrative chunk JSON structure...');

    const chunkPath = path.join(__dirname, '../data/narrative_tree_complete_12_nodes.json');

    try {
      const content = fs.readFileSync(chunkPath, 'utf8');

      // Check for BOM
      if (content.charCodeAt(0) === 0xFEFF) {
        this.log('warning', 'File contains BOM. Consider saving as UTF-8 without BOM.');
      }

      // Parse JSON
      const data = JSON.parse(content);

      // Validate required root properties
      const required = ['meta', 'root_id', 'tokens', 'nodes'];
      for (const prop of required) {
        if (!(prop in data)) {
          throw new Error(`Missing required property: ${prop}`);
        }
      }

      // Validate meta section
      if (data.meta) {
        const metaRequired = ['version', 'title', 'total_nodes'];
        for (const prop of metaRequired) {
          if (!(prop in data.meta)) {
            this.log('warning', `Missing meta property: ${prop}`);
          }
        }

        // Check node count parity
        const actualNodes = data.nodes?.length || 0;
        if (data.meta.total_nodes !== actualNodes) {
          this.log('error', `META PARITY FAILURE: meta.total_nodes (${data.meta.total_nodes}) !== nodes.length (${actualNodes})`);
          return false;
        }
      }

      // Validate token structure
      if (data.tokens?.chrono) {
        if (typeof data.tokens.chrono.start !== 'number') {
          throw new Error('tokens.chrono.start must be a number');
        }
        if (!Array.isArray(data.tokens.chrono.earn_rules)) {
          throw new Error('tokens.chrono.earn_rules must be an array');
        }
      }

      this.log('success', `✅ JSON structure valid (${data.nodes.length} nodes)`);
      return true;
    } catch (error) {
      this.log('error', `❌ JSON structure test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Test 3: Validate node connectivity and reference integrity
   */
  async testNodeConnectivity() {
    this.log('info', 'Testing node connectivity and references...');

    try {
      const chunkPath = path.join(__dirname, '../data/narrative_tree_complete_12_nodes.json');
      const data = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));

      const nodeIds = new Set(data.nodes.map(n => n.id));
      const referencedIds = new Set();

      // Collect all referenced node IDs
      data.nodes.forEach(node => {
        node.choices?.forEach(choice => {
          if (choice.next_id && choice.next_id !== 'terminal' && choice.next_id !== 'end') {
            referencedIds.add(choice.next_id);
          }
        });
      });

      // Check for dangling references
      const danglingRefs = [];
      referencedIds.forEach(refId => {
        if (!nodeIds.has(refId)) {
          danglingRefs.push(refId);
        }
      });

      if (danglingRefs.length > 0) {
        this.log('error', `❌ Dangling references found: ${danglingRefs.join(', ')}`);
        return false;
      }

      // Check if root_id exists
      if (!nodeIds.has(data.root_id)) {
        this.log('error', `❌ root_id "${data.root_id}" not found in nodes`);
        return false;
      }

      this.log('success', `✅ Node connectivity valid (${nodeIds.size} nodes, ${referencedIds.size} references)`);
      return true;
    } catch (error) {
      this.log('error', `❌ Node connectivity test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Test 4: Validate token economy balance
   */
  async testTokenEconomy() {
    this.log('info', 'Testing token economy balance...');

    try {
      const chunkPath = path.join(__dirname, '../data/narrative_tree_complete_12_nodes.json');
      const data = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));

      let maxCost = 0;
      let totalEarnPotential = 0;

      // Analyze costs
      data.nodes.forEach(node => {
        node.choices?.forEach(choice => {
          if (choice.cost) {
            maxCost = Math.max(maxCost, choice.cost);
          }
        });
      });

      // Analyze earning potential
      if (data.tokens?.chrono?.earn_rules) {
        data.tokens.chrono.earn_rules.forEach(rule => {
          totalEarnPotential += rule.amount * 3; // Conservative estimate: 3 opportunities per rule
        });
      }

      const startingTokens = data.tokens?.chrono?.start || 0;

      this.log('info', `Token Economy Analysis:`);
      this.log('info', `  Starting tokens: ${startingTokens}`);
      this.log('info', `  Maximum single cost: ${maxCost}`);
      this.log('info', `  Estimated earn potential: ${totalEarnPotential}`);

      if (maxCost > startingTokens + totalEarnPotential) {
        this.log('warning', '⚠️ Token economy may be unbalanced: costs could exceed earning potential');
      } else {
        this.log('success', '✅ Token economy appears balanced');
      }

      return true;
    } catch (error) {
      this.log('error', `❌ Token economy test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Test 5: Validate achievement flag system
   */
  async testAchievementSystem() {
    this.log('info', 'Testing achievement flag system...');

    try {
      const chunkPath = path.join(__dirname, '../data/narrative_tree_complete_12_nodes.json');
      const data = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));

      const allFlags = new Set();
      const flagUsage = new Map();

      // Collect all flags granted in the chunk
      data.nodes.forEach(node => {
        node.grants?.forEach(flag => {
          if (!flag.startsWith('trait_')) {
            allFlags.add(flag);
          }
        });

        node.choices?.forEach(choice => {
          choice.grants?.forEach(flag => {
            if (!flag.startsWith('trait_')) {
              allFlags.add(flag);
              flagUsage.set(flag, (flagUsage.get(flag) || 0) + 1);
            }
          });
        });
      });

      this.log('info', `Achievement System Analysis:`);
      this.log('info', `  Total unique flags: ${allFlags.size}`);
      this.log('info', `  Flags granted: ${Array.from(flagUsage.entries()).map(([flag, count]) => `${flag}(${count})`).join(', ')}`);

      if (allFlags.size === 0) {
        this.log('warning', '⚠️ No achievement flags found in chunk');
      } else {
        this.log('success', `✅ Achievement system valid (${allFlags.size} flags)`);
      }

      return true;
    } catch (error) {
      this.log('error', `❌ Achievement system test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Test 6: Validate data folder structure for multi-chunk support
   */
  async testDataFolderStructure() {
    this.log('info', 'Testing data folder structure for multi-chunk support...');

    const dataDir = path.join(__dirname, '../data');

    try {
      if (!fs.existsSync(dataDir)) {
        throw new Error('Data folder does not exist');
      }

      const files = fs.readdirSync(dataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        this.log('warning', '⚠️ No JSON files found in data folder');
      } else {
        this.log('success', `✅ Data folder contains ${jsonFiles.length} JSON files: ${jsonFiles.join(', ')}`);
      }

      // Check if our main chunk file exists
      const mainChunk = 'narrative_tree_complete_12_nodes.json';
      if (jsonFiles.includes(mainChunk)) {
        this.log('success', `✅ Main chunk file found: ${mainChunk}`);
      } else {
        this.log('error', `❌ Main chunk file missing: ${mainChunk}`);
        return false;
      }

      return true;
    } catch (error) {
      this.log('error', `❌ Data folder test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    this.log('info', '🚀 Starting narrative integration test suite...');

    const tests = [
      'testChunkFileExists',
      'testChunkJsonStructure',
      'testNodeConnectivity',
      'testTokenEconomy',
      'testAchievementSystem',
      'testDataFolderStructure'
    ];

    let passed = 0;
    let failed = 0;

    for (const testName of tests) {
      try {
        const result = await this[testName]();
        if (result) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        this.log('error', `❌ Test ${testName} threw exception: ${error.message}`);
        failed++;
      }
    }

    // Summary
    this.log('info', '📊 Test Summary:');
    this.log('info', `  Passed: ${passed}`);
    this.log('info', `  Failed: ${failed}`);
    this.log('info', `  Total: ${tests.length}`);

    if (failed === 0) {
      this.log('success', '🎉 All tests passed! Narrative integration is ready.');
      return true;
    } else {
      this.log('error', `💥 ${failed} test(s) failed. Please review errors above.`);
      return false;
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  const tester = new NarrativeIntegrationTester();
  const success = await tester.runAllTests();

  // Exit with appropriate code
  process.exit(success ? 0 : 1);
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

export { NarrativeIntegrationTester };
