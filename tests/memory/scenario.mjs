/**
 * Memory Leak Detection Scenario for Fuite
 * TASK-338: Comprehensive stress testing
 *
 * This scenario navigates through all major views repeatedly
 * to detect memory leaks in Vue component lifecycle.
 *
 * Usage:
 *   fuite http://localhost:5546 --scenario tests/memory/scenario.mjs
 *
 * Or via npm script:
 *   npm run test:memory
 */

export async function setup(page) {
  // Wait for app to fully load
  await page.waitForSelector('#app', { timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('App loaded, starting memory test scenario');
}

export async function iteration(page) {
  /**
   * Each iteration navigates through all views
   * Fuite runs this multiple times and tracks memory growth
   */

  // 1. Canvas View
  console.log('  -> Canvas view');
  await page.keyboard.press('1');
  await page.waitForTimeout(500);

  // Interact with canvas
  await page.mouse.move(400, 300);
  await page.mouse.wheel({ deltaY: 100 }); // Zoom
  await page.mouse.wheel({ deltaY: -100 });

  // 2. Board View
  console.log('  -> Board view');
  await page.keyboard.press('2');
  await page.waitForTimeout(500);

  // Scroll through board
  await page.mouse.wheel({ deltaY: 200 });
  await page.mouse.wheel({ deltaY: -200 });

  // 3. Calendar View
  console.log('  -> Calendar view');
  await page.keyboard.press('3');
  await page.waitForTimeout(500);

  // Navigate calendar months
  const nextButton = await page.$('[data-testid="calendar-next"], .calendar-nav-next, button:has-text("next")');
  if (nextButton) {
    await nextButton.click();
    await page.waitForTimeout(300);
    await nextButton.click();
    await page.waitForTimeout(300);
  }

  const prevButton = await page.$('[data-testid="calendar-prev"], .calendar-nav-prev, button:has-text("prev")');
  if (prevButton) {
    await prevButton.click();
    await page.waitForTimeout(300);
    await prevButton.click();
    await page.waitForTimeout(300);
  }

  // 4. Settings (opens modal)
  console.log('  -> Settings modal');
  await page.keyboard.press('s');
  await page.waitForTimeout(500);

  // Switch tabs in settings
  const settingsTabs = await page.$$('[data-testid="settings-tab"], .settings-tab');
  for (const tab of settingsTabs.slice(0, 3)) {
    await tab.click();
    await page.waitForTimeout(200);
  }

  // Close settings
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 5. Task creation flow
  console.log('  -> Task creation');
  await page.keyboard.press('n');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // 6. Search modal
  console.log('  -> Search modal');
  await page.keyboard.down('Control');
  await page.keyboard.press('k');
  await page.keyboard.up('Control');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Return to starting view
  await page.keyboard.press('1');
  await page.waitForTimeout(300);

  console.log('  Iteration complete');
}

export async function teardown(page) {
  console.log('Memory test scenario complete');
}
