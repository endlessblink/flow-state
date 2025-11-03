const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔍 Navigating to Storybook to explore available stories...');
    await page.goto('http://localhost:6007/', { waitUntil: 'networkidle' });

    // Wait for Storybook to load
    await page.waitForTimeout(5000);

    // Take screenshot of main page
    await page.screenshot({ path: 'storybook-explorer-main.png', fullPage: true });
    console.log('📸 Main page screenshot saved');

    // Try to find and click on components to explore
    console.log('🔍 Looking for component links...');

    // Try to find any links that contain our component names
    const componentLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, [role="treeitem"], [data-testid]'));
      return links.map(link => ({
        text: link.textContent?.trim() || '',
        href: link.href || '',
        id: link.id || '',
        testId: link.getAttribute('data-testid') || ''
      })).filter(item => item.text && (
        item.text.includes('TimeDisplay') ||
        item.text.includes('TaskCard') ||
        item.text.includes('TaskNode') ||
        item.text.includes('CustomSelect') ||
        item.text.includes('ProjectTreeItem') ||
        item.text.includes('TaskManagerSidebar') ||
        item.text.includes('ProjectDropZone') ||
        item.text.includes('EmojiPicker') ||
        item.text.includes('CommandPalette') ||
        item.text.includes('ErrorBoundary')
      ));
    });

    console.log('Found component links:', componentLinks);

    // Try to navigate to the first working component
    if (componentLinks.length > 0) {
      const firstLink = componentLinks[0];
      console.log(`🎯 Trying to navigate to: ${firstLink.text} (${firstLink.href})`);

      if (firstLink.href) {
        await page.goto(firstLink.href, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'storybook-component-found.png', fullPage: true });
        console.log('✅ Successfully navigated to a component!');
      }
    }

    // Try some simple URL patterns
    console.log('🔍 Trying simple URL patterns...');
    const simpleUrls = [
      'http://localhost:6007/?path=/story/timedisplay--default',
      'http://localhost:6007/?path=/story/taskcard--default',
      'http://localhost:6007/?path=/story/tasknode--default',
      'http://localhost:6007/?path=/story/customselect--default',
      'http://localhost:6007/?path=/story/projecttreeitem--default',
    ];

    for (const url of simpleUrls) {
      try {
        console.log(`Trying: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        const hasError = await page.evaluate(() => {
          return document.body.textContent.includes('Couldn\'t find story') ||
                 document.body.textContent.includes('NoStoryMatchError');
        });

        if (!hasError) {
          console.log(`✅ SUCCESS: ${url} works!`);
          await page.screenshot({ path: `success-${url.split('/').pop()}.png`, fullPage: true });
          break;
        } else {
          console.log(`❌ Failed: ${url}`);
        }
      } catch (error) {
        console.log(`❌ Error with ${url}: ${error.message}`);
      }
    }

    // Keep browser open for manual inspection
    console.log('🔍 Keeping browser open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();