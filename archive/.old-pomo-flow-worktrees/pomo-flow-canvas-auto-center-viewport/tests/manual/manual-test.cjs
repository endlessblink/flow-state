const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const page = await browser.newPage();

  try {
    console.log('🔍 Manual Storybook exploration...');
    await page.goto('http://localhost:6007/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    // Take screenshot of the main page
    await page.screenshot({ path: 'manual-main-page.png', fullPage: true });
    console.log('📸 Main page screenshot saved');

    console.log('🔍 Looking for sidebar navigation...');

    // Try to find sidebar elements with different selectors
    const sidebarSelectors = [
      '[data-testid="sidebar"]',
      '.sidebar',
      '[role="navigation"]',
      '.os-content',
      'nav',
      '[class*="sidebar"]',
      '[class*="nav"]'
    ];

    let sidebarFound = false;
    for (const selector of sidebarSelectors) {
      const sidebar = await page.$(selector);
      if (sidebar) {
        console.log(`✅ Found sidebar with selector: ${selector}`);
        sidebarFound = true;

        // Get all text content from sidebar
        const sidebarContent = await sidebar.evaluate(el => el.innerText);
        console.log('📋 Sidebar content preview:');
        console.log(sidebarContent.substring(0, 500) + '...');

        // Try to find links or clickable elements
        const clickableElements = await sidebar.$$eval('a, button, [role="treeitem"], [role="button"]', elements =>
          elements.map(el => ({
            text: el.textContent?.trim(),
            tagName: el.tagName,
            href: el.href,
            className: el.className
          })).filter(item => item.text && item.text.length > 0)
        );

        console.log(`🔗 Found ${clickableElements.length} clickable elements:`);
        clickableElements.slice(0, 10).forEach((el, i) => {
          console.log(`  ${i + 1}. ${el.text} (${el.tagName}) - ${el.href || 'no href'}`);
        });

        break;
      }
    }

    if (!sidebarFound) {
      console.log('❌ No sidebar found with common selectors');

      // Try to get all page text and look for component names
      const pageText = await page.evaluate(() => document.body.innerText);
      const componentNames = ['TimeDisplay', 'TaskCard', 'TaskNode', 'CustomSelect', 'ProjectTreeItem'];

      for (const name of componentNames) {
        if (pageText.includes(name)) {
          console.log(`✅ Found "${name}" mentioned in page`);
        }
      }
    }

    // Try to click on "Components" or similar
    console.log('🔍 Trying to navigate to component sections...');

    const possibleNavItems = [
      'Components', 'Base', 'UI', 'Board', 'Canvas', 'Modal', 'All'
    ];

    for (const navItem of possibleNavItems) {
      try {
        const element = await page.locator(`text=${navItem}`).first();
        if (await element.isVisible()) {
          console.log(`✅ Found "${navItem}" - clicking...`);
          await element.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: `manual-after-${navItem.toLowerCase()}.png`, fullPage: true });
          break;
        }
      } catch (error) {
        // Continue trying other options
      }
    }

    // Keep browser open for 30 seconds for manual inspection
    console.log('🔍 Keeping browser open for 30 seconds for manual inspection...');
    console.log('📝 Please manually navigate to components and note the URL patterns');

    await page.waitForTimeout(30000);

    // Get the current URL before closing
    const finalUrl = page.url();
    console.log(`📍 Final URL: ${finalUrl}`);

  } catch (error) {
    console.error('❌ Error during manual test:', error.message);
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
})();