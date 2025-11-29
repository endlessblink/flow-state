/**
 * Global setup for User Flow Testing
 * Prepares test environment and validates dependencies
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function globalSetup(config) {
  console.log('🚀 Setting up User Flow Testing environment...');

  const startTime = Date.now();

  try {
    // Validate development server
    await validateDevelopmentServer();

    // Clean up previous test results
    await cleanupTestResults();

    // Create test data fixtures
    await createTestDataFixtures();

    // Validate test dependencies
    await validateTestDependencies();

    // Setup performance monitoring
    await setupPerformanceMonitoring();

    const setupTime = Date.now() - startTime;
    console.log(`✅ Global setup completed in ${setupTime}ms`);

    // Return global configuration for tests
    return {
      testStartTime: new Date().toISOString(),
      setupDuration: setupTime,
      browserInfo: await getBrowserInfo()
    };

  } catch (error) {
    console.error('❌ Global setup failed:', error.message);
    throw error;
  }
}

/**
 * Validate that development server is running and accessible
 */
async function validateDevelopmentServer() {
  console.log('🔧 Validating development server...');

  const maxRetries = 30;
  const retryDelay = 1000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const browser = await chromium.launch();
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('http://localhost:5546', { timeout: 10000 });

      // Wait for Vue app to be ready
      await page.waitForSelector('#app', { timeout: 10000 });

      // Check for critical Pomo-Flow elements (using real selectors)
      await page.waitForSelector('a[href="/"]', { timeout: 5000 }); // Board link

      await browser.close();

      console.log('✅ Development server is ready');
      return;

    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Development server not ready after ${maxRetries} attempts: ${error.message}`);
      }

      console.log(`⏳ Waiting for server... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

/**
 * Clean up previous test results
 */
async function cleanupTestResults() {
  console.log('🧹 Cleaning up previous test results...');

  const testResultsDir = path.join(process.cwd(), 'docs', 'reports');

  if (fs.existsSync(testResultsDir)) {
    // Remove old artifacts but keep recent reports
    const files = fs.readdirSync(testResultsDir);

    files.forEach(file => {
      const filePath = path.join(testResultsDir, file);
      const stat = fs.statSync(filePath);

      // Remove files older than 24 hours (except reports)
      const isOlderThan24Hours = Date.now() - stat.mtime.getTime() > 24 * 60 * 60 * 1000;
      const isNotReport = !file.includes('.html') && !file.includes('.json');

      if (isOlderThan24Hours && isNotReport) {
        if (stat.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
    });
  }

  // Ensure required directories exist
  const requiredDirs = [
    'docs/reports/user-flows',
    'docs/reports/test-artifacts',
    'docs/reports/screenshots',
    'docs/reports/videos',
    'docs/reports/traces'
  ];

  requiredDirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });

  console.log('✅ Test results cleaned up');
}

/**
 * Create test data fixtures for consistent testing
 */
async function createTestDataFixtures() {
  console.log('📝 Creating test data fixtures...');

  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');

  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  // Sample task data
  const taskFixtures = {
    sampleTasks: [
      {
        title: 'Test Task 1',
        description: 'This is a sample test task',
        priority: 'medium',
        status: 'planned',
        estimatedDuration: 25
      },
      {
        title: 'Test Task 2',
        description: 'Another sample test task',
        priority: 'high',
        status: 'in_progress',
        estimatedDuration: 45
      },
      {
        title: 'Test Task 3',
        description: 'Completed test task',
        priority: 'low',
        status: 'done',
        estimatedDuration: 15
      }
    ],
    projects: [
      { name: 'Test Project 1', color: '#667eea' },
      { name: 'Test Project 2', color: '#f56565' }
    ],
    userSettings: {
      workDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsUntilLongBreak: 4
    }
  };

  // Write fixtures
  fs.writeFileSync(
    path.join(fixturesDir, 'tasks.json'),
    JSON.stringify(taskFixtures, null, 2)
  );

  // Create test data generation utilities
  const testDataUtils = `
/**
 * Test Data Generation Utilities
 * Provides consistent test data for user flow testing
 */

class TestDataGenerator {
  static generateTask(overrides = {}) {
    return {
      title: \`Test Task \${Math.random().toString(36).substr(2, 9)}\`,
      description: 'Auto-generated test task description',
      priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      status: 'planned',
      estimatedDuration: 25,
      ...overrides
    };
  }

  static generateProject(overrides = {}) {
    return {
      name: \`Test Project \${Math.random().toString(36).substr(2, 9)}\`,
      color: ['#667eea', '#f56565', '#48bb78', '#ed8936'][Math.floor(Math.random() * 4)],
      ...overrides
    };
  }

  static generateMultipleTasks(count, overrides = {}) {
    return Array.from({ length: count }, () => this.generateTask(overrides));
  }

  static generateTestData() {
    return {
      tasks: this.generateMultipleTasks(5),
      projects: [this.generateProject(), this.generateProject()],
      settings: {
        workDuration: 25,
        breakDuration: 5,
        theme: 'dark'
      }
    };
  }
}

module.exports = TestDataGenerator;
  `;

  fs.writeFileSync(
    path.join(fixturesDir, 'test-data-generator.js'),
    testDataUtils
  );

  console.log('✅ Test data fixtures created');
}

/**
 * Validate test dependencies and tools
 */
async function validateTestDependencies() {
  console.log('🔍 Validating test dependencies...');

  const requiredPackages = [
    '@playwright/test',
    'playwright',
    'expect',
    'chromium',
    'firefox',
    'webkit'
  ];

  const missingPackages = [];

  requiredPackages.forEach(pkg => {
    try {
      require.resolve(pkg);
    } catch (error) {
      missingPackages.push(pkg);
    }
  });

  if (missingPackages.length > 0) {
    console.warn('⚠️  Missing packages:', missingPackages.join(', '));
    console.log('💡 Run: npm install ' + missingPackages.join(' '));
  } else {
    console.log('✅ All test dependencies are available');
  }

  // Validate browser installation
  try {
    const { spawn } = require('child_process');

    await new Promise((resolve, reject) => {
      const install = spawn('npx', ['playwright', 'install', '--dry-run'], {
        stdio: 'pipe'
      });

      install.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Playwright browsers are installed');
          resolve();
        } else {
          reject(new Error('Playwright browsers not installed'));
        }
      });

      install.on('error', reject);
    });
  } catch (error) {
    console.warn('⚠️  Playwright browsers may not be installed');
    console.log('💡 Run: npx playwright install');
  }
}

/**
 * Setup performance monitoring for tests
 */
async function setupPerformanceMonitoring() {
  console.log('📊 Setting up performance monitoring...');

  const performanceConfig = {
    thresholds: {
      pageLoad: 3000,        // 3 seconds
      firstPaint: 1500,      // 1.5 seconds
      firstContentfulPaint: 2000, // 2 seconds
      largestContentfulPaint: 4000, // 4 seconds
      cumulativeLayoutShift: 0.1,
      firstInputDelay: 100   // 100ms
    },
    metrics: [
      'navigationStart',
      'fetchStart',
      'domainLookupStart',
      'domainLookupEnd',
      'connectStart',
      'connectEnd',
      'requestStart',
      'responseStart',
      'responseEnd',
      'domLoading',
      'domInteractive',
      'domContentLoadedEventStart',
      'domContentLoadedEventEnd',
      'domComplete',
      'loadEventStart',
      'loadEventEnd'
    ]
  };

  const performanceMonitorPath = path.join(process.cwd(), 'docs', 'reports', 'performance-config.json');
  fs.writeFileSync(performanceMonitorPath, JSON.stringify(performanceConfig, null, 2));

  console.log('✅ Performance monitoring configured');
}

/**
 * Get browser information for test reporting
 */
async function getBrowserInfo() {
  try {
    const browser = await chromium.launch();
    const version = browser.version();
    await browser.close();

    return {
      chromium: version,
      platform: process.platform,
      nodeVersion: process.version,
      testEnvironment: 'user-flow-testing'
    };
  } catch (error) {
    return {
      error: 'Could not retrieve browser info',
      platform: process.platform,
      nodeVersion: process.version
    };
  }
}

module.exports = globalSetup;