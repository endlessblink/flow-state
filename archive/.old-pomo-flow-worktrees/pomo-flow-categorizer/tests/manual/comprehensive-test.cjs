const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Enable console logging
  page.on('console', msg => {
    console.log('CONSOLE:', msg.type(), msg.text());
  });

  // Enable error logging
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  // Set up console error tracking
  await page.addInitScript(() => {
    window.consoleErrors = [];
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = function(...args) {
      window.consoleErrors.push(args.join(' '));
      originalError.apply(console, args);
    };

    console.warn = function(...args) {
      window.consoleErrors.push('WARN: ' + args.join(' '));
      originalWarn.apply(console, args);
    };
  });

  try {
    console.log('🚀 Starting comprehensive Storybook component testing...');
    console.log('Navigating to Storybook on port 6007...');
    await page.goto('http://localhost:6007/', { waitUntil: 'networkidle' });

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Take a screenshot of the main page
    await page.screenshot({ path: 'storybook-main.png', fullPage: true });
    console.log('✅ Storybook main page screenshot saved');

    console.log('\n🎯 Testing FIXED components...');
    console.log('=============================\n');

    // Test components with correct simple URL pattern
    const testComponents = [
      { name: 'TaskNode', category: 'Vue Flow integration fixes' },
      { name: 'TaskCard', category: 'injection issues fixes' },
      { name: 'TimeDisplay', category: 'fixed story ID' },
      { name: 'CustomSelect', category: 'fixed story ID' },
      { name: 'ProjectTreeItem', category: 'fixed story ID' },
      { name: 'TaskManagerSidebar', category: 'fixed story ID' },
      { name: 'ProjectDropZone', category: 'fixed story ID' },
      { name: 'EmojiPicker', category: 'fixed story ID' },
      { name: 'CommandPalette', category: 'fixed story ID' },
      { name: 'ErrorBoundary', category: 'fixed story ID' }
    ];

    let successCount = 0;
    let failureCount = 0;

    for (const component of testComponents) {
      console.log(`🧪 Testing ${component.name} (${component.category})...`);

      try {
        // Use simple lowercase URL pattern
        const url = `http://localhost:6007/?path=/story/${component.name.toLowerCase()}--default`;
        console.log(`   Navigating to: ${url}`);

        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);

        // Check if component loaded successfully (no story error)
        const hasStoryError = await page.evaluate(() => {
          return document.body.textContent.includes('Couldn\'t find story') ||
                 document.body.textContent.includes('NoStoryMatchError');
        });

        if (hasStoryError) {
          console.log(`   ❌ ${component.name} - Story not found`);
          failureCount++;
          continue;
        }

        // Check for console errors
        const hasConsoleErrors = await page.evaluate(() => {
          return window.consoleErrors && window.consoleErrors.length > 0;
        });

        if (!hasConsoleErrors) {
          console.log(`   ✅ ${component.name} loaded without console errors`);
        } else {
          console.log(`   ⚠️  ${component.name} has console errors`);
        }

        // Check if component rendered
        const componentElement = await page.$('#storybook-root');
        if (componentElement) {
          const isVisible = await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }, componentElement);

          if (isVisible) {
            console.log(`   ✅ ${component.name} is visible and rendered`);
            successCount++;

            // Try basic interaction
            await componentElement.hover();
            await page.waitForTimeout(500);
            console.log(`   🖱️  ${component.name} hover interaction successful`);
          } else {
            console.log(`   ⚠️  ${component.name} loaded but not visible`);
            failureCount++;
          }
        } else {
          console.log(`   ❌ ${component.name} failed to render`);
          failureCount++;
        }

        // Take screenshot
        await page.screenshot({ path: `storybook-${component.name.toLowerCase()}-test.png`, fullPage: true });
        console.log(`   📸 ${component.name} screenshot saved`);

        await page.waitForTimeout(1000);

      } catch (error) {
        console.log(`   ❌ ${component.name} failed:`, error.message);
        failureCount++;
      }

      console.log('');
    }

    // Summary
    console.log('📊 TESTING SUMMARY');
    console.log('==================');
    console.log(`✅ Successful components: ${successCount}/${testComponents.length}`);
    console.log(`❌ Failed components: ${failureCount}/${testComponents.length}`);
    console.log('📸 Screenshots saved for all tested components');
    console.log('🖱️  Basic interactions tested where components rendered');
    console.log('📝 Console errors monitored and logged');

    // Test some additional variations that might work
    console.log('\n🔍 Testing additional component variations...');
    const additionalUrls = [
      'http://localhost:6007/?path=/story/basebutton--default',
      'http://localhost:6007/?path=/story/baseinput--default',
      'http://localhost:6007/?path=/story/basecard--default',
      'http://localhost:6007/?path=/story/kanbancolumn--default',
      'http://localhost:6007/?path=/story/canvassection--default',
      'http://localhost:6007/?path=/story/inboxpanel--default',
    ];

    for (const url of additionalUrls) {
      try {
        const componentName = url.split('/').pop().split('--')[0];
        console.log(`Trying: ${componentName}`);

        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        const hasError = await page.evaluate(() => {
          return document.body.textContent.includes('Couldn\'t find story') ||
                 document.body.textContent.includes('NoStoryMatchError');
        });

        if (!hasError) {
          console.log(`✅ Additional component found: ${componentName}`);
          await page.screenshot({ path: `additional-${componentName}.png`, fullPage: true });
        } else {
          console.log(`❌ ${componentName} not found`);
        }
      } catch (error) {
        console.log(`❌ Error testing additional component: ${error.message}`);
      }
    }

    console.log('\n🎯 FINAL RESULTS:');
    console.log(`Main components tested: ${testComponents.length}`);
    console.log(`Successfully working: ${successCount}`);
    console.log(`Need fixes: ${failureCount}`);
    console.log('📸 All screenshots saved for review');

    // Keep browser open for manual inspection
    console.log('\n🔍 Keeping browser open for 60 seconds for manual inspection...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
})();