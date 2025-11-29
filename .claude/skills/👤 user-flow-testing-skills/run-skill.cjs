/**
 * CommonJS runner for User Flow Testing Skill
 * Handles ES module compatibility
 */

const { createRequire } = require('module');
const path = require('path');

// Create require function for ES modules
const require = createRequire(import.meta.url);

async function runSkill() {
  try {
    console.log('🚀 Initializing User Flow Testing Skill...');

    // Import the ES module skill
    const { default: UserFlowTestingSkill } = await import('./index.js');

    // Create and execute skill
    const skill = new UserFlowTestingSkill();

    console.log('📋 Available options:');
    console.log('  --quick     Run quick smoke tests only');
    console.log('  --full      Run comprehensive test suite (default)');
    console.log('  --debug     Run with debug output');
    console.log('  --report    Generate detailed HTML report');

    const options = process.argv.slice(2).reduce((acc, arg) => {
      if (arg.startsWith('--')) {
        acc[arg.replace('--', '')] = true;
      }
      return acc;
    }, {});

    console.log(`\n🧪 Running with options:`, Object.keys(options).join(', ') || 'default');

    const results = await skill.execute(options);

    console.log('\n✅ User Flow Testing completed successfully!');

    // Exit with appropriate code based on results
    const exitCode = results.failedTests > 0 ? 1 : 0;
    process.exit(exitCode);

  } catch (error) {
    console.error('❌ User Flow Testing failed:', error.message);

    if (options.debug) {
      console.error('\n🐛 Debug stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the skill
runSkill();