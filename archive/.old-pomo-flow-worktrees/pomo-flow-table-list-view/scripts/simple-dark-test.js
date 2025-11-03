import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5545', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take light mode screenshot
    await page.screenshot({ path: 'docs/debug/current-light.png', fullPage: true });
    console.log('📸 Light mode captured');

    // Find dark mode button by text content
    const darkButton = page.getByText('🌙 Dark Mode');
    const buttonExists = await darkButton.count();
    console.log('Dark mode button found:', buttonExists > 0);

    if (buttonExists > 0) {
      // Click to toggle dark mode
      await darkButton.click();
      await page.waitForTimeout(1500);

      // Take dark mode screenshot
      await page.screenshot({ path: 'docs/debug/current-dark.png', fullPage: true });
      console.log('📸 Dark mode captured');

      // Toggle back
      await page.getByText('☀️ Light Mode').click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'docs/debug/back-to-light.png', fullPage: true });
      console.log('📸 Back to light mode captured');

      console.log('✅ Dark mode functionality working!');
    } else {
      console.log('❌ Dark mode button not found');
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  await browser.close();
})();