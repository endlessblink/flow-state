import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log('BROWSER:', msg.type().toUpperCase(), msg.text());
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  try {
    await page.goto('http://localhost:5545', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check what's actually rendering
    const styles = await page.evaluate(() => {
      const app = document.querySelector('.app');
      const header = document.querySelector('.header');
      const statNumber = document.querySelector('.stat-number');

      if (!app || !header || !statNumber) {
        return { error: 'Elements not found', app: !!app, header: !!header, statNumber: !!statNumber };
      }

      const appStyles = window.getComputedStyle(app);
      const headerStyles = window.getComputedStyle(header);
      const numberStyles = window.getComputedStyle(statNumber);

      return {
        app: {
          background: appStyles.backgroundColor,
          color: appStyles.color,
          fontFamily: appStyles.fontFamily,
        },
        header: {
          background: headerStyles.backgroundColor,
          color: headerStyles.color,
        },
        statNumber: {
          fontSize: numberStyles.fontSize,
          fontWeight: numberStyles.fontWeight,
          color: numberStyles.color,
          fontFamily: numberStyles.fontFamily,
        }
      };
    });

    console.log('=== ACTUAL RENDERED STYLES ===');
    console.log(JSON.stringify(styles, null, 2));

    // Take screenshot
    await page.screenshot({ path: 'docs/debug/font-debug.png', fullPage: true });
    console.log('📸 Font debug screenshot saved');

  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  await browser.close();
})();