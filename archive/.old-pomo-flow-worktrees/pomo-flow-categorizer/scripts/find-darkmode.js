import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log('BROWSER:', msg.type().toUpperCase(), msg.text());
  });

  page.on('pageerror', error => {
    console.log('VUE ERROR:', error.message);
  });

  try {
    await page.goto('http://localhost:5545', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    console.log('=== SEARCHING FOR DARK MODE ELEMENTS ===');

    // Search for any dark mode related text
    const darkModeTexts = [
      '🌙 Dark Mode',
      'Dark Mode',
      'Dark',
      '🌙',
      '☀️',
      'Light Mode',
      'Theme'
    ];

    for (const text of darkModeTexts) {
      const count = await page.getByText(text).count();
      console.log(`"${text}" found: ${count} times`);
    }

    // Search for buttons by class names
    const buttonClasses = [
      '.theme-toggle',
      '.theme-toggle-alt',
      '.dark-mode-toggle',
      '[class*="theme"]',
      '[class*="dark"]'
    ];

    for (const selector of buttonClasses) {
      try {
        const count = await page.locator(selector).count();
        console.log(`${selector} found: ${count} times`);
      } catch (e) {
        console.log(`${selector}: selector error`);
      }
    }

    // List ALL buttons with their text and classes
    const allButtonInfo = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      return Array.from(buttons).map((btn, index) => ({
        index,
        className: btn.className,
        text: btn.textContent?.trim(),
        visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
        style: btn.getAttribute('style'),
        onclick: btn.onclick ? 'has click handler' : 'no click handler'
      }));
    });

    console.log('=== ALL BUTTONS ON PAGE ===');
    allButtonInfo.forEach(btn => {
      console.log(`${btn.index}: "${btn.text}" (class: ${btn.className}) visible: ${btn.visible}`);
    });

    // Check Vue component state
    const vueState = await page.evaluate(() => {
      // Try to access Vue component data
      const app = document.querySelector('.app');
      return {
        hasVueData: !!app?.__vueParentComponent,
        appElement: !!app,
        sidebarExists: !!document.querySelector('.sidebar'),
        mainContentExists: !!document.querySelector('.main-content')
      };
    });

    console.log('=== VUE STATE ===');
    console.log(vueState);

    // Take full page screenshot
    await page.screenshot({ path: 'docs/debug/darkmode-search.png', fullPage: true });
    console.log('📸 Dark mode search screenshot saved');

  } catch (error) {
    console.log('❌ Error during search:', error.message);
  }

  await browser.close();
})();