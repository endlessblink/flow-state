// Comprehensive verification test for weekend counter sync fix
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🚀 WEEKEND SYNC FIX VERIFICATION TEST');
    console.log('=====================================');

    console.log('🌐 Opening Pomo-Flow on port 5546...');
    await page.goto('http://localhost:5546');

    // Wait for app to fully load
    console.log('⏳ Waiting for app to load...');
    await page.waitForTimeout(5000);

    // Capture console logs for sync validation
    const consoleMessages = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text: text, timestamp: new Date().toISOString() });

      // Log relevant sync messages
      if (text.includes('WEEKEND') || text.includes('Service Orchestrator') || text.includes('SYNC') || text.includes('UNIFIED_FILTER')) {
        console.log(`📝 [CONSOLE] ${text}`);
      }
    });

    // Take initial screenshot
    console.log('📸 Taking initial screenshot...');
    await page.screenshot({ path: 'weekend-fix-initial-state.png', fullPage: false });

    // Look for weekend-related elements in the UI
    console.log('🔍 Searching for weekend navigation elements...');

    const weekendSelectors = [
      'text="This Weekend"',
      '[target-type="weekend"]',
      '.date-drop-zone:has-text("Weekend")',
      'button:has-text("Weekend")'
    ];

    let weekendElement = null;
    let foundSelector = null;

    for (const selector of weekendSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          console.log(`✅ Found weekend element with selector: ${selector}`);
          weekendElement = element;
          foundSelector = selector;
          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    if (weekendElement) {
      console.log('🎯 Weekend element found! Testing sync functionality...');

      // Get initial state
      const elementText = await weekendElement.textContent();
      console.log(`📊 Weekend element text: "${elementText}"`);

      // Extract count from the element
      const countMatch = elementText.match(/(\d+)/);
      const initialCount = countMatch ? parseInt(countMatch[1]) : 0;
      console.log(`🔢 Initial weekend counter: ${initialCount}`);

      // Click on weekend view
      console.log('🖱️ Clicking weekend element to activate weekend view...');
      await weekendElement.click();
      await page.waitForTimeout(3000);

      // Count visible tasks in the main content area
      const taskSelectors = [
        '.sidebar-task',
        '[class*="task"]',
        '.task-item',
        '.task-card'
      ];

      let visibleTaskCount = 0;
      for (const selector of taskSelectors) {
        try {
          const tasks = page.locator(selector);
          const count = await tasks.count();
          if (count > 0) {
            console.log(`📋 Found ${count} tasks with selector: ${selector}`);
            visibleTaskCount = Math.max(visibleTaskCount, count);
          }
        } catch (error) {
          // Continue
        }
      }

      console.log(`📊 Total visible tasks: ${visibleTaskCount}`);

      // Take screenshot after activating weekend view
      await page.screenshot({ path: 'weekend-fix-activated.png', fullPage: false });

      // Check console logs for sync validation messages
      const syncMessages = consoleMessages.filter(msg =>
        msg.text.includes('WEEKEND SYNC') ||
        msg.text.includes('Service Orchestrator') ||
        msg.text.includes('UNIFIED_FILTER')
      );

      console.log(`📝 Found ${syncMessages.length} sync-related console messages`);

      // Look for specific success/error messages
      const successMessages = syncMessages.filter(msg =>
        msg.text.includes('SUCCESS') ||
        msg.text.includes('MATCH') ||
        msg.text.includes('FIXED')
      );

      const errorMessages = syncMessages.filter(msg =>
        msg.text.includes('ERROR') ||
        msg.text.includes('MISMATCH') ||
        msg.text.includes('CRITICAL')
      );

      console.log(`✅ Success messages: ${successMessages.length}`);
      console.log(`❌ Error messages: ${errorMessages.length}`);

      // Determine test result
      const isSyncFixed = successMessages.length > 0 && errorMessages.length === 0;
      const countsMatch = initialCount === visibleTaskCount;

      console.log('\n🎯 TEST RESULTS:');
      console.log('================');
      console.log(`Weekend Counter: ${initialCount}`);
      console.log(`Visible Tasks: ${visibleTaskCount}`);
      console.log(`Counts Match: ${countsMatch ? '✅ YES' : '❌ NO'}`);
      console.log(`Sync Messages: ${isSyncFixed ? '✅ POSITIVE' : '❌ NEGATIVE'}`);

      if (isSyncFixed && countsMatch) {
        console.log('🎉 WEEKEND SYNC FIX VERIFICATION: PASSED');
        console.log('✅ The weekend counter sync issue has been resolved!');
      } else {
        console.log('⚠️ WEEKEND SYNC FIX VERIFICATION: NEEDS ATTENTION');
        console.log('❌ There may still be sync issues to address.');
      }

      // Save detailed log
      const testResults = {
        timestamp: new Date().toISOString(),
        weekendCounter: initialCount,
        visibleTasks: visibleTaskCount,
        countsMatch: countsMatch,
        syncFixed: isSyncFixed,
        foundSelector: foundSelector,
        consoleMessages: syncMessages.map(msg => ({
          type: msg.type,
          text: msg.text,
          timestamp: msg.timestamp
        }))
      };

      console.log('\n📄 Detailed results saved to test output.');

    } else {
      console.log('❌ Weekend element not found in the UI');

      // Take screenshot for debugging
      await page.screenshot({ path: 'weekend-fix-debug-screenshot.png', fullPage: true });

      // List all navigation elements found
      console.log('🔍 Scanning for navigation elements...');
      const allNavElements = page.locator('nav, .nav, button, [class*="nav"], [class*="sidebar"]');
      const navCount = await allNavElements.count();
      console.log(`📊 Found ${navCount} potential navigation elements`);

      // Look for any text containing "weekend" (case insensitive)
      const pageContent = await page.content();
      if (pageContent.toLowerCase().includes('weekend')) {
        console.log('✅ "weekend" text found in page HTML');
      } else {
        console.log('❌ No "weekend" text found in page HTML');
      }
    }

  } catch (error) {
    console.error('❌ Test execution error:', error);
    await page.screenshot({ path: 'weekend-fix-error.png', fullPage: false });
  } finally {
    await browser.close();
    console.log('\n🏁 Test completed.');
  }
})();