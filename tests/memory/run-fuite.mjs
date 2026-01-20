#!/usr/bin/env node

/**
 * Memory Leak Test Runner
 * TASK-338: Comprehensive stress testing
 *
 * Runs Fuite memory leak detection or provides manual instructions.
 */

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

// Check if Fuite is installed
function checkFuite() {
  try {
    execSync('npx fuite --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Check if dev server is running
async function checkDevServer() {
  try {
    const response = await fetch('http://localhost:5546', { method: 'HEAD' });
    return response.ok || response.status === 304;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🧠 FlowState Memory Leak Detection');
  console.log('='.repeat(50));

  // Check dev server
  const serverRunning = await checkDevServer();
  if (!serverRunning) {
    console.log('❌ Dev server not running!');
    console.log('   Start it with: npm run dev');
    console.log('   Then run this script again.');
    process.exit(1);
  }
  console.log('✅ Dev server running on port 5546');

  // Check Fuite
  const fuiteInstalled = checkFuite();
  if (!fuiteInstalled) {
    console.log('\n⚠️  Fuite not installed.');
    console.log('   Install globally with: npm install -g fuite');
    console.log('\n📋 Alternative: Manual Memory Testing');
    console.log('   1. Open Chrome DevTools > Memory tab');
    console.log('   2. Take heap snapshot');
    console.log('   3. Navigate through all views 10x:');
    console.log('      - Press 1 (Canvas)');
    console.log('      - Press 2 (Board)');
    console.log('      - Press 3 (Calendar)');
    console.log('      - Press S (Settings) then Escape');
    console.log('   4. Take another snapshot');
    console.log('   5. Compare: Memory growth should be < 50MB');
    process.exit(0);
  }

  console.log('✅ Fuite installed');
  console.log('\n🔍 Running memory leak detection...\n');

  // Run Fuite
  const scenarioPath = join(__dirname, 'scenario.mjs');
  const fuite = spawn('npx', [
    'fuite',
    'http://localhost:5546',
    '--scenario', scenarioPath,
    '--iterations', '5'
  ], {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  fuite.on('close', (code) => {
    console.log('\n' + '='.repeat(50));
    if (code === 0) {
      console.log('✅ Memory test completed');
    } else {
      console.log(`⚠️  Fuite exited with code ${code}`);
    }
  });
}

main();
