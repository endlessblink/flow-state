#!/usr/bin/env node

/**
 * PHASE 4 Test Suite 1: Application Foundation Testing
 *
 * CRITICAL REQUIREMENTS:
 * - Test on port 5546 ONLY (real database connection)
 * - Use Playwright for visual confirmation with screenshots
 * - Verify ServiceOrchestrator integration working
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:5546';
const SCREENSHOT_DIR = '.playwright-mcp/phase4-foundation-testing';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

console.log('🚀 Starting PHASE 4 Test Suite 1: Application Foundation Testing');
console.log('📌 Testing on port 5546 (REAL DATABASE CONNECTION)');

async function runFoundationTests() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Monitor console for errors
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });

      if (msg.type() === 'error') {
        console.log(`❌ Console Error: ${msg.text()}`);
      } else if (msg.type() === 'warning') {
        console.log(`⚠️  Console Warning: ${msg.text()}`);
      }
    });

    console.log('\n📋 Test 1: Application Loading');
    console.log('=' .repeat(50));

    // Step 1: Navigate to application
    console.log('🌐 Navigating to application...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Wait for app to fully load
    await page.waitForSelector('[data-testid="app-container"], .app-container, #app', { timeout: 10000 });
    console.log('✅ Application loaded successfully');

    // Take initial loading screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-initial-load.png'),
      fullPage: true
    });
    console.log('📸 Initial load screenshot captured');

    // Wait a bit for any async operations
    await page.waitForTimeout(2000);

    console.log('\n📋 Test 2: Board View Verification');
    console.log('=' .repeat(50));

    // Navigate to Board View
    await page.click('[data-testid="nav-board"], nav a[href*="/board"], .nav-board');
    await page.waitForTimeout(1000);

    // Verify Board View is loaded
    await page.waitForSelector('[data-testid="board-view"], .board-view, .kanban-board', { timeout: 8000 });
    console.log('✅ Board View loaded successfully');

    // Take Board View screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-board-view.png'),
      fullPage: true
    });
    console.log('📸 Board View screenshot captured');

    console.log('\n📋 Test 3: Calendar View Verification');
    console.log('=' .repeat(50));

    // Navigate to Calendar View
    await page.click('[data-testid="nav-calendar"], nav a[href*="/calendar"], .nav-calendar');
    await page.waitForTimeout(1000);

    // Verify Calendar View is loaded
    await page.waitForSelector('[data-testid="calendar-view"], .calendar-view, .calendar-container', { timeout: 8000 });
    console.log('✅ Calendar View loaded successfully');

    // Take Calendar View screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-calendar-view.png'),
      fullPage: true
    });
    console.log('📸 Calendar View screenshot captured');

    console.log('\n📋 Test 4: Canvas View Verification');
    console.log('=' .repeat(50));

    // Navigate to Canvas View
    await page.click('[data-testid="nav-canvas"], nav a[href*="/canvas"], .nav-canvas');
    await page.waitForTimeout(1000);

    // Verify Canvas View is loaded
    await page.waitForSelector('[data-testid="canvas-view"], .canvas-view, .vue-flow', { timeout: 8000 });
    console.log('✅ Canvas View loaded successfully');

    // Take Canvas View screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-canvas-view.png'),
      fullPage: true
    });
    console.log('📸 Canvas View screenshot captured');

    console.log('\n📋 Test 5: All Tasks View Verification');
    console.log('=' .repeat(50));

    // Navigate to All Tasks View
    await page.click('[data-testid="nav-all-tasks"], nav a[href*="/all"], .nav-all-tasks');
    await page.waitForTimeout(1000);

    // Verify All Tasks View is loaded
    await page.waitForSelector('[data-testid="all-tasks-view"], .all-tasks-view, .task-list', { timeout: 8000 });
    console.log('✅ All Tasks View loaded successfully');

    // Take All Tasks View screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-all-tasks-view.png'),
      fullPage: true
    });
    console.log('📸 All Tasks View screenshot captured');

    console.log('\n📋 Test 6: ServiceOrchestrator & Console Validation');
    console.log('=' .repeat(50));

    // Check for ServiceOrchestrator integration
    const serviceOrchestratorCheck = await page.evaluate(() => {
      // Look for ServiceOrchestrator in window or global scope
      if (window.ServiceOrchestrator) {
        return '✅ ServiceOrchestrator found in window scope';
      }

      // Check for service initialization messages
      const logs = Array.from(document.querySelectorAll('#console-logs .log-entry, .console-output'));
      const serviceLogs = logs.filter(log =>
        log.textContent && log.textContent.includes('ServiceOrchestrator')
      );

      if (serviceLogs.length > 0) {
        return '✅ ServiceOrchestrator logs detected';
      }

      // Check for service-related network requests
      return '⚠️  ServiceOrchestrator status unknown';
    });

    console.log('🔧', serviceOrchestratorCheck);

    // Analyze console messages
    const errors = consoleMessages.filter(msg => msg.type === 'error');
    const warnings = consoleMessages.filter(msg => msg.type === 'warning');

    console.log(`\n📊 Console Analysis:`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Warnings: ${warnings.length}`);
    console.log(`   Total Messages: ${consoleMessages.length}`);

    if (errors.length === 0 && warnings.length === 0) {
      console.log('🎉 CONSOLE IS CLEAN - Zero errors or warnings detected!');
    } else {
      console.log('\n⚠️  Console Issues Found:');
      errors.forEach(error => {
        console.log(`   ❌ Error: ${error.text}`);
      });
      warnings.forEach(warning => {
        console.log(`   ⚠️  Warning: ${warning.text}`);
      });
    }

    // Final application state screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-final-state.png'),
      fullPage: true
    });
    console.log('📸 Final state screenshot captured');

    // Generate test report
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      tests: {
        applicationLoad: 'PASSED',
        boardView: 'PASSED',
        calendarView: 'PASSED',
        canvasView: 'PASSED',
        allTasksView: 'PASSED',
        serviceOrchestrator: serviceOrchestratorCheck,
        consoleClean: errors.length === 0 && warnings.length === 0 ? 'PASSED' : 'FAILED'
      },
      consoleAnalysis: {
        totalMessages: consoleMessages.length,
        errors: errors.length,
        warnings: warnings.length,
        errorDetails: errors.map(e => ({ text: e.text, location: e.location })),
        warningDetails: warnings.map(w => ({ text: w.text, location: w.location }))
      },
      screenshots: [
        '01-initial-load.png',
        '02-board-view.png',
        '03-calendar-view.png',
        '04-canvas-view.png',
        '05-all-tasks-view.png',
        '06-final-state.png'
      ]
    };

    // Save test report
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'phase4-foundation-test-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n' + '='.repeat(60));
    console.log('🎯 PHASE 4 FOUNDATION TESTING COMPLETE');
    console.log('='.repeat(60));
    console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log(`📄 Test report saved to: ${SCREENSHOT_DIR}/phase4-foundation-test-report.json`);

    const allTestsPassed = Object.values(report.tests).every(result => result === 'PASSED' || result.includes('✅'));

    if (allTestsPassed) {
      console.log('🎉 ALL TESTS PASSED - Application foundation is SOLID!');
      console.log('✅ Ready for sync testing phase');
    } else {
      console.log('⚠️  Some tests require attention - check report for details');
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error);

    // Take error screenshot
    try {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'ERROR-state.png'),
        fullPage: true
      });
      console.log('📸 Error state screenshot captured');
    } catch (screenshotError) {
      console.log('Could not capture error screenshot:', screenshotError.message);
    }

    throw error;
  } finally {
    await browser.close();
  }
}

// Run the tests
runFoundationTests().catch(console.error);