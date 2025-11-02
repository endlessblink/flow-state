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
    await page.waitForTimeout(2000);

    // Check if dark mode toggle exists
    const toggleExists = await page.locator('.theme-toggle').count();
    console.log('Dark mode toggle found:', toggleExists > 0);

    // Check all buttons in content controls
    const contentControls = await page.locator('.content-controls button').count();
    console.log('Content control buttons found:', contentControls);

    // List all buttons for debugging
    const allButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      return Array.from(buttons).map(btn => ({
        className: btn.className,
        text: btn.textContent?.trim(),
        innerHTML: btn.innerHTML
      }));
    });

    console.log('All buttons on page:', allButtons);

    // Take screenshot to see current state
    await page.screenshot({ path: 'docs/debug/darkmode-check.png', fullPage: true });
    console.log('📸 Dark mode check screenshot saved');

  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  await browser.close();
})();