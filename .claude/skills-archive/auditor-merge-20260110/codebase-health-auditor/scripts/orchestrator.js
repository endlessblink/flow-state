#!/usr/bin/env node

/**
 * Codebase Health Auditor - Orchestrator
 *
 * Unified CLI for running all codebase health detectors.
 *
 * Usage:
 *   node orchestrator.js audit              # Run all detectors
 *   node orchestrator.js detect --detector file-size   # Run specific detector
 *   node orchestrator.js detect --detector file-size --min-tokens 20000
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Available detectors
const DETECTORS = {
  'file-size': {
    name: 'File Size & Token Limit Detector',
    description: 'Detects files exceeding token limits for AI editing',
    module: './detectors/file-size-detector.js'
  }
  // Future detectors can be added here:
  // 'unused-exports': { ... },
  // 'unused-deps': { ... },
  // 'vue-dead-code': { ... },
  // 'legacy-patterns': { ... }
};

/**
 * Load and run a detector
 */
async function runDetector(name, options) {
  const detector = DETECTORS[name];
  if (!detector) {
    console.error(`Unknown detector: ${name}`);
    console.error(`Available: ${Object.keys(DETECTORS).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n🔍 Running: ${detector.name}`);
  console.log(`   ${detector.description}\n`);

  try {
    const modulePath = path.join(__dirname, detector.module);
    const { detect, formatConsoleOutput } = await import(modulePath);

    const results = await detect({
      projectRoot: options.path || process.cwd(),
      minTokens: options.minTokens ? parseInt(options.minTokens) : undefined
    });

    // Console output
    if (formatConsoleOutput) {
      console.log(formatConsoleOutput(results));
    }

    // Save report if requested
    if (options.output) {
      const outputPath = path.resolve(options.output);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
      console.log(`\n📄 Report saved to: ${outputPath}`);
    }

    return results;
  } catch (error) {
    console.error(`Failed to run detector ${name}:`, error);
    throw error;
  }
}

/**
 * Run all detectors (audit mode)
 */
async function runAudit(options) {
  console.log('\n🏥 Codebase Health Audit');
  console.log('═'.repeat(50));
  console.log(`Project: ${options.path || process.cwd()}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  const allResults = {
    timestamp: new Date().toISOString(),
    projectRoot: options.path || process.cwd(),
    detectors: {}
  };

  let hasErrors = false;
  let hasCritical = false;

  for (const [name, detector] of Object.entries(DETECTORS)) {
    try {
      const results = await runDetector(name, options);
      allResults.detectors[name] = results;

      // Track severity
      if (results.summary?.byRiskLevel?.BLOCKED > 0) {
        hasCritical = true;
      }
      if (results.summary?.byRiskLevel?.CRITICAL > 0) {
        hasErrors = true;
      }
    } catch (error) {
      console.error(`Detector ${name} failed:`, error.message);
      allResults.detectors[name] = { error: error.message };
    }
  }

  // Save combined report if requested
  if (options.output) {
    const outputPath = path.resolve(options.output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(allResults, null, 2));
    console.log(`\n📄 Combined report saved to: ${outputPath}`);
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('Audit Complete');
  console.log('═'.repeat(50));

  // Exit codes for CI
  if (options.ci) {
    if (hasCritical) {
      console.log('\n⛔ Critical issues found - exiting with code 2');
      process.exit(2);
    }
    if (hasErrors) {
      console.log('\n🔴 Issues found - exiting with code 1');
      process.exit(1);
    }
    console.log('\n✅ No critical issues found');
  }

  return allResults;
}

/**
 * List available detectors
 */
function listDetectors() {
  console.log('\n📋 Available Detectors\n');
  console.log('─'.repeat(50));

  for (const [name, detector] of Object.entries(DETECTORS)) {
    console.log(`\n  ${name}`);
    console.log(`    ${detector.name}`);
    console.log(`    ${detector.description}`);
  }

  console.log('\n' + '─'.repeat(50));
  console.log('\nUsage: node orchestrator.js detect --detector <name>');
  console.log('');
}

// CLI setup
const program = new Command();

program
  .name('codebase-health-auditor')
  .description('Unified codebase health detection and cleanup tool')
  .version('1.0.0');

program
  .command('audit')
  .description('Run all detectors for comprehensive audit')
  .option('-p, --path <path>', 'Project root directory', process.cwd())
  .option('-o, --output <file>', 'Save JSON report to file')
  .option('--ci', 'CI mode with exit codes')
  .action(runAudit);

program
  .command('detect')
  .description('Run a specific detector')
  .requiredOption('-d, --detector <name>', 'Detector to run')
  .option('-p, --path <path>', 'Project root directory', process.cwd())
  .option('-o, --output <file>', 'Save JSON report to file')
  .option('--min-tokens <number>', 'Minimum tokens to report (file-size detector)')
  .action((options) => runDetector(options.detector, options));

program
  .command('list')
  .description('List available detectors')
  .action(listDetectors);

// Parse and run
program.parse(process.argv);
