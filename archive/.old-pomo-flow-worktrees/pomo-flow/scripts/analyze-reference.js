import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('=== ANALYZING REFERENCE SITE ===');
    await page.goto('http://localhost:5173/dashboard');

    // Wait for page to load (different selector)
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Take screenshot of reference
    await page.screenshot({ path: 'docs/debug/reference-design.png', fullPage: true });
    console.log('📸 Reference design captured');

    // Analyze the design elements
    const styles = await page.evaluate(() => {
      const body = document.body;
      const computedStyle = window.getComputedStyle(body);

      return {
        backgroundColor: computedStyle.backgroundColor,
        color: computedStyle.color,
        fontFamily: computedStyle.fontFamily,
        fontSize: computedStyle.fontSize,
      };
    });

    console.log('Reference site styles:', styles);

  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  await browser.close();
})();