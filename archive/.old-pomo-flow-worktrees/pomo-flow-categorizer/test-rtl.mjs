import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🚀 Navigating to app...');
  await page.goto('http://localhost:5546');

  // Wait for app to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('📸 Taking initial screenshot...');
  await page.screenshot({ path: 'screenshots/01-initial-load.png', fullPage: true });

  // Try to find Settings button
  console.log('🔍 Looking for Settings button...');

  // Check if sidebar is visible
  const sidebar = page.locator('.sidebar').first();
  const isSidebarVisible = await sidebar.isVisible().catch(() => false);

  console.log(`Sidebar visible: ${isSidebarVisible}`);

  // Look for settings button (could be icon or text)
  const settingsSelectors = [
    'button:has-text("Settings")',
    '[aria-label*="settings" i]',
    'button[title*="settings" i]',
    '.settings-btn',
    'button:has([data-lucide="settings"])'
  ];

  let settingsButton = null;
  for (const selector of settingsSelectors) {
    const button = page.locator(selector).first();
    if (await button.isVisible().catch(() => false)) {
      settingsButton = button;
      console.log(`✅ Found settings button with selector: ${selector}`);
      break;
    }
  }

  if (settingsButton) {
    // Highlight the settings button
    await settingsButton.evaluate(el => {
      el.style.border = '3px solid red';
      el.style.boxShadow = '0 0 10px red';
    });

    await page.screenshot({ path: 'screenshots/02-settings-button-highlighted.png', fullPage: true });

    console.log('🖱️  Clicking Settings button...');
    await settingsButton.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'screenshots/03-settings-modal-open.png', fullPage: true });

    // Find RTL button
    console.log('🔍 Looking for RTL toggle...');
    const rtlButton = page.locator('button:has-text("RTL")').first();

    if (await rtlButton.isVisible()) {
      console.log('✅ Found RTL button!');

      // Check current direction
      const htmlElement = await page.locator('html').first();
      const currentDir = await htmlElement.getAttribute('dir');
      console.log(`Current direction: ${currentDir || 'not set'}`);

      // Click RTL button
      console.log('🖱️  Clicking RTL button...');
      await rtlButton.click();
      await page.waitForTimeout(500);

      // Check new direction
      const newDir = await htmlElement.getAttribute('dir');
      console.log(`New direction: ${newDir}`);

      await page.screenshot({ path: 'screenshots/04-rtl-enabled.png', fullPage: true });

      if (newDir === 'rtl') {
        console.log('✅ SUCCESS: Direction changed to RTL!');
      } else {
        console.log('❌ FAILED: Direction did not change');
      }
    } else {
      console.log('❌ Could not find RTL button in settings');
    }
  } else {
    console.log('❌ Could not find Settings button');
    console.log('📋 Available buttons:');
    const buttons = await page.locator('button').all();
    for (const button of buttons.slice(0, 10)) {
      const text = await button.textContent();
      const title = await button.getAttribute('title');
      console.log(`  - "${text}" (title: ${title})`);
    }
  }

  console.log('\n📸 Screenshots saved to screenshots/ directory');
  console.log('Browser will close in 5 seconds...');
  await page.waitForTimeout(5000);

  await browser.close();
})();
