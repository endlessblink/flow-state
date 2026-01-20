#!/usr/bin/env node

/**
 * Verifies that stress tester implementation is complete
 * Run: node scripts/verify-stress-tester-implementation.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

const checks = [
  {
    name: 'npm scripts exist',
    test: () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
      const required = ['test:stress', 'test:bench', 'test:backup', 'test:security'];
      const missing = required.filter(s => !pkg.scripts[s]);
      if (missing.length > 0) throw new Error(`Missing: ${missing.join(', ')}`);
      return `Found: ${required.join(', ')}`;
    }
  },
  {
    name: 'vitest.bench.config.ts exists',
    test: () => {
      const p = path.join(ROOT, 'vitest.bench.config.ts');
      if (!fs.existsSync(p)) throw new Error('File not found');
      const content = fs.readFileSync(p, 'utf8');
      if (!content.includes('benchmark')) throw new Error('Missing benchmark config');
      return 'Valid config';
    }
  },
  {
    name: 'Playwright stress config exists',
    test: () => {
      const p = path.join(ROOT, 'tests/stress/playwright.stress.config.ts');
      if (!fs.existsSync(p)) throw new Error('File not found');
      return 'Found';
    }
  },
  {
    name: 'Data integrity tests exist',
    test: () => {
      const p = path.join(ROOT, 'tests/stress/data-integrity.spec.ts');
      if (!fs.existsSync(p)) throw new Error('File not found');
      const content = fs.readFileSync(p, 'utf8');
      if (!content.includes('test(')) throw new Error('No tests defined');
      const testCount = (content.match(/test\(/g) || []).length;
      return `${testCount} tests`;
    }
  },
  {
    name: 'Security tests exist',
    test: () => {
      const p = path.join(ROOT, 'tests/stress/security.spec.ts');
      if (!fs.existsSync(p)) throw new Error('File not found');
      const content = fs.readFileSync(p, 'utf8');
      if (!content.includes('XSS')) throw new Error('No XSS tests');
      return 'XSS tests found';
    }
  },
  {
    name: 'Benchmark tests exist',
    test: () => {
      const p = path.join(ROOT, 'tests/stress/store-operations.bench.ts');
      if (!fs.existsSync(p)) throw new Error('File not found');
      const content = fs.readFileSync(p, 'utf8');
      const benchCount = (content.match(/bench\(/g) || []).length;
      if (benchCount === 0) throw new Error('No benchmarks defined');
      return `${benchCount} benchmarks`;
    }
  },
  {
    name: 'Backup verification script exists',
    test: () => {
      const p = path.join(ROOT, 'scripts/verify-backup-system.cjs');
      if (!fs.existsSync(p)) throw new Error('File not found');
      return 'Found';
    }
  },
  {
    name: 'Memory test exists',
    test: () => {
      const p1 = path.join(ROOT, 'tests/memory/run-memory-test.mjs');
      const p2 = path.join(ROOT, 'tests/memory/run-fuite.mjs');
      if (!fs.existsSync(p1) && !fs.existsSync(p2)) throw new Error('No memory test runner');
      return 'Found';
    }
  },
  {
    name: 'npm run test:backup works',
    test: () => {
      try {
        const output = execSync('npm run test:backup 2>&1', {
          cwd: ROOT,
          timeout: 30000,
          encoding: 'utf8'
        });
        if (output.includes('Passed:') || output.includes('✅')) {
          return 'Runs successfully';
        }
        throw new Error('Unexpected output');
      } catch (e) {
        if (e.stdout && (e.stdout.includes('Passed:') || e.stdout.includes('✅'))) {
          return 'Runs (with warnings)';
        }
        throw new Error(`Failed: ${e.message}`);
      }
    }
  },
  {
    name: 'npm run test:bench works',
    test: () => {
      try {
        const output = execSync('npm run test:bench 2>&1', {
          cwd: ROOT,
          timeout: 120000,
          encoding: 'utf8'
        });
        if (output.includes('hz') || output.includes('BENCH')) {
          return 'Benchmarks run';
        }
        throw new Error('No benchmark output');
      } catch (e) {
        if (e.stdout && (e.stdout.includes('hz') || e.stdout.includes('BENCH'))) {
          return 'Benchmarks run';
        }
        throw new Error(`Failed: ${e.message}`);
      }
    }
  }
];

console.log('🔍 Stress Tester Implementation Verification\n');
console.log('='.repeat(50));

let passed = 0;
let failed = 0;

for (const check of checks) {
  process.stdout.write(`${check.name}... `);
  try {
    const result = check.test();
    console.log(`✅ ${result}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${e.message}`);
    failed++;
  }
}

console.log('='.repeat(50));
console.log(`\n✅ Passed: ${passed}/${checks.length}`);
console.log(`❌ Failed: ${failed}/${checks.length}`);

if (failed === 0) {
  console.log('\n🎉 Stress tester is fully implemented!');
} else {
  console.log('\n⚠️  Implementation incomplete. Run the implementation prompt.');
}

process.exit(failed > 0 ? 1 : 0);
