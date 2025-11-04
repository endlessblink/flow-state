import { test } from '@playwright/test';
import path from 'path';
import * as fs from 'fs';

test('Simple Kanban Board Check', async ({ page }) => {
  const screenshotDir = '/tmp/simple-kanban-check';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Enable console logging to capture 🔥-prefixed diagnostic logs
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    if (text.includes('🔥')) {
      console.log('🔥 FOUND:', text);
    }
  });

  // Navigate to app
  await page.goto('http://localhost:5546', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Take initial screenshot
  await page.screenshot({
    path: path.join(screenshotDir, '1-initial-state.png'),
    fullPage: true
  });
  console.log('Screenshot 1: Initial state taken');

  // Look for common UI elements
  const elements = [
    { name: 'Board tab', selector: 'button:has-text("Board")' },
    { name: 'Today filter', selector: 'button:has-text("Today")' },
    { name: 'All Tasks filter', selector: 'button:has-text("All Tasks")' },
    { name: 'Project filter', selector: 'button:has-text("All Projects")' },
    { name: 'Any swimlanes', selector: '.swimlane, .kanban-column, .task-column' },
    { name: 'Task cards', selector: '.task-card, [data-testid*="task"]' }
  ];

  for (const element of elements) {
    try {
      const found = await page.locator(element.selector).isVisible({ timeout: 2000 });
      console.log(`${element.name}: ${found ? 'FOUND' : 'NOT FOUND'}`);
    } catch (e) {
      console.log(`${element.name}: NOT FOUND (error)`);
    }
  }

  // Try to find and click Board view
  try {
    const boardBtn = page.locator('button:has-text("Board")').first();
    if (await boardBtn.isVisible({ timeout: 2000 })) {
      await boardBtn.click();
      await page.waitForTimeout(2000);
      console.log('Board view clicked');

      await page.screenshot({
        path: path.join(screenshotDir, '2-board-view.png'),
        fullPage: true
      });
      console.log('Screenshot 2: Board view taken');
    }
  } catch (e) {
    console.log('Board view not found or not clickable');
  }

  // Check for 🔥 logs
  const fireLogs = consoleMessages.filter(msg => msg.includes('🔥'));
  console.log(`\n🔥 Diagnostic logs found: ${fireLogs.length}`);
  fireLogs.forEach(log => console.log('  ', log));

  console.log(`Screenshots saved to: ${screenshotDir}`);
});