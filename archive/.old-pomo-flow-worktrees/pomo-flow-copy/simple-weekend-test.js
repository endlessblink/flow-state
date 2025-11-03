// Simple test to verify weekend counter sync fix
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🌐 Opening Pomo-Flow on port 5546...');
    await page.goto('http://localhost:5546');

    // Wait for app to load
    await page.waitForTimeout(5000);

    console.log('📸 Taking screenshot to see the UI...');
    await page.screenshot({ path: 'weekend-ui-screenshot.png', fullPage: false });

    // Set up console logging to capture sync validation
    const consoleMessages = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(text);
      if (text.includes('WEEKEND') || text.includes('Service Orchestrator') || text.includes('SYNC')) {
        console.log(`📝 Console: ${text}`);
      }
    });

    // Try to find and click the weekend element
    console.log('🔍 Looking for weekend navigation element...');

    // Try multiple selectors for weekend
    const weekendSelectors = [
      'text="This Weekend"',
      '[target-type="weekend"]',
      'button:has-text("Weekend")',
      '*:has-text("This Weekend")',
      '.nav-item:has-text("Weekend")'
    ];

    let weekendElement = null;
    for (const selector of weekendSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          console.log(`✅ Found weekend element with selector: ${selector}`);
          weekendElement = element;
          break;
        }
      } catch (error) {
        // Try next selector
      }
    }

    if (weekendElement) {
      console.log('🖱️ Clicking weekend element...');
      await weekendElement.click();
      await page.waitForTimeout(2000);

      // Count visible tasks
      const taskElements = page.locator('.sidebar-task, [class*="task"], .task-item');
      const taskCount = await taskElements.count();
      console.log(`📋 Tasks visible after clicking weekend: ${taskCount}`);

      // Take another screenshot
      await page.screenshot({ path: 'weekend-view-activated.png', fullPage: false });

      // Check for sync validation messages
      const syncMessages = consoleMessages.filter(msg =>
        msg.includes('WEEKEND SYNC') ||
        msg.includes('Service Orchestrator') ||
        msg.includes('weekend')
      );

      if (syncMessages.length > 0) {
        console.log('✅ Found sync validation messages:');
        syncMessages.forEach(msg => console.log(`  📝 ${msg}`));
      } else {
        console.log('⚠️ No sync validation messages found in console');
      }

    } else {
      console.log('❌ Could not find weekend element');

      // Take a screenshot to debug
      await page.screenshot({ path: 'weekend-not-found-debug.png', fullPage: true });

      // Look for any navigation elements
      console.log('🔍 Looking for navigation elements...');
      const navElements = page.locator('.nav-item, button, [class*="nav"]');
      const navCount = await navElements.count();
      console.log(`📊 Found ${navCount} navigation elements`);

      for (let i = 0; i < Math.min(navCount, 10); i++) {
        const element = navElements.nth(i);
        try {
          const text = await element.textContent();
          const isVisible = await element.isVisible();
          if (text && text.trim() && isVisible) {
            console.log(`  📍 Nav element ${i}: "${text.trim()}"`);
          }
        } catch (error) {
          // Skip elements that can't be accessed
        }
      }
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: false });
  } finally {
    await browser.close();
  }
})();