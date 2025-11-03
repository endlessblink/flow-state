const { chromium } = require('playwright');

async function debugTimerIndicator() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Enable console logging
  page.on('console', msg => {
    console.log('CONSOLE:', msg.type(), msg.text());
  });

  try {
    // Navigate to app
    await page.goto('http://localhost:5548/');
    console.log('✓ Navigated to app');

    // Wait for app to load
    await page.waitForTimeout(3000);

    // Look for Canvas view button or link
    let canvasFound = false;

    // Try different selectors for Canvas navigation
    const canvasSelectors = [
      'text=Canvas',
      '[data-testid="canvas-view"]',
      'button:has-text("Canvas")',
      'a:has-text("Canvas")',
      'nav button:has-text("Canvas")'
    ];

    for (const selector of canvasSelectors) {
      try {
        const canvasButton = page.locator(selector).first();
        if (await canvasButton.isVisible({ timeout: 1000 })) {
          await canvasButton.click();
          console.log('✓ Clicked Canvas view using selector:', selector);
          canvasFound = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!canvasFound) {
      console.log('Canvas view not found, checking current page...');
      // Maybe we're already on canvas or need to check URL
      const url = page.url();
      console.log('Current URL:', url);
    }

    await page.waitForTimeout(2000);

    // Look for tasks in the canvas
    const taskSelectors = [
      '.task-node',
      '[data-task-id]',
      '.task',
      '.task-card',
      '[class*="task"]'
    ];

    let tasks = [];
    for (const selector of taskSelectors) {
      tasks = await page.locator(selector).all();
      if (tasks.length > 0) {
        console.log(`✓ Found ${tasks.length} tasks using selector: ${selector}`);
        break;
      }
    }

    if (tasks.length === 0) {
      console.log('No tasks found, checking page structure...');
      const pageContent = await page.content();
      console.log('Page contains "Canvas":', pageContent.includes('Canvas'));
      console.log('Page contains "task":', pageContent.includes('task'));
    }

    if (tasks.length > 0) {
      const firstTask = tasks[0];

      // Get task info before interaction
      const taskId = await firstTask.getAttribute('data-task-id');
      const taskClasses = await firstTask.getAttribute('class');
      console.log('First task ID:', taskId);
      console.log('First task classes:', taskClasses);

      // Right-click on the first task to open context menu
      await firstTask.click({ button: 'right' });
      console.log('✓ Right-clicked on task to open context menu');

      await page.waitForTimeout(1000);

      // Look for "Start Timer" option in context menu
      const timerSelectors = [
        'text=Start Timer',
        'text=Start timer',
        '[data-action="start-timer"]',
        '.context-menu-item:has-text("Timer")'
      ];

      let timerFound = false;
      for (const selector of timerSelectors) {
        try {
          const startTimer = page.locator(selector).first();
          if (await startTimer.isVisible({ timeout: 1000 })) {
            await startTimer.click();
            console.log('✓ Clicked Start Timer using selector:', selector);
            timerFound = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!timerFound) {
        console.log('Start Timer option not found in context menu');
        // Let's check what context menu items are available
        const menuItems = await page.locator('.context-menu-item, [role="menuitem"]').all();
        console.log(`Found ${menuItems.length} context menu items:`);
        for (let i = 0; i < Math.min(menuItems.length, 10); i++) {
          const text = await menuItems[i].textContent();
          console.log(`  - ${text}`);
        }
      }

      await page.waitForTimeout(3000);

      // Check for timer indicator in DOM after starting timer
      console.log('\n--- Checking for timer indicator ---');

      const timerIndicatorSelectors = [
        '.timer-indicator',
        '.timer-badge',
        '.timer-active',
        '[class*="timer"]',
        '.timer-icon'
      ];

      let timerIndicatorFound = false;
      for (const selector of timerIndicatorSelectors) {
        const timerIndicator = firstTask.locator(selector).first();
        const count = await timerIndicator.count();
        if (count > 0) {
          const isVisible = await timerIndicator.isVisible();
          const text = await timerIndicator.textContent();
          const styles = await timerIndicator.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return {
              display: computed.display,
              visibility: computed.visibility,
              opacity: computed.opacity,
              zIndex: computed.zIndex
            };
          });

          console.log(`✓ Timer indicator found with selector "${selector}":`);
          console.log(`  - Count: ${count}`);
          console.log(`  - Visible: ${isVisible}`);
          console.log(`  - Text: "${text}"`);
          console.log(`  - Styles:`, styles);
          timerIndicatorFound = true;
        }
      }

      if (!timerIndicatorFound) {
        console.log('No timer indicator elements found');

        // Get the full HTML of the task element
        const taskHtml = await firstTask.innerHTML();
        console.log('Task HTML content (first 1000 chars):');
        console.log(taskHtml.substring(0, 1000));

        // Check for any timer-related text in the task
        const hasTimerText = taskHtml.toLowerCase().includes('timer');
        console.log('Task HTML contains "timer":', hasTimerText);
      }

      // Check for debug console messages
      console.log('\n--- Checking for debug messages in console ---');
      // Console messages are being captured above

    } else {
      console.log('No tasks found on canvas to test with');
    }

  } catch (error) {
    console.error('Error during debugging:', error);
  }

  console.log('\n--- Debug session completed ---');
  console.log('Browser will remain open for 10 seconds for manual inspection...');
  await page.waitForTimeout(10000);
  await browser.close();
}

debugTimerIndicator().catch(console.error);