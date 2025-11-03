import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Listen for console messages
  page.on('console', msg => {
    console.log('BROWSER:', msg.type().toUpperCase(), msg.text());
  });

  // Listen for errors
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  try {
    // First analyze the reference site
    console.log('=== ANALYZING REFERENCE SITE ===');
    await page.goto('http://localhost:5173/dashboard');

    // Wait for React to load
    await page.waitForSelector('#root', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Get the actual HTML to debug
    const bodyContent = await page.locator('body').innerHTML();
    console.log('=== CURRENT HTML ===');
    console.log(bodyContent.substring(0, 500) + '...');

    // Check if our new layout classes exist
    const hasNewLayout = await page.locator('.min-h-screen.bg-slate-900').count();
    console.log('New layout classes found:', hasNewLayout);

    // Check for errors
    const errors = await page.evaluate(() => {
      return window.__errors || [];
    });

    console.log('React errors:', errors);

    // Take screenshot of reference
    await page.screenshot({ path: 'docs/debug/reference-design.png', fullPage: true });
    console.log('📸 Reference design saved');

    // Now check our site
    console.log('=== ANALYZING OUR SITE ===');
    await page.goto('http://localhost:5545');
    await page.waitForSelector('#root', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Take screenshot of our site
    await page.screenshot({ path: 'docs/debug/current-design.png', fullPage: true });

    console.log('✅ Both pages analyzed');
    console.log('📸 Screenshots saved');

  } catch (error) {
    console.log('❌ Error loading page:', error.message);
  }

  await browser.close();
})();