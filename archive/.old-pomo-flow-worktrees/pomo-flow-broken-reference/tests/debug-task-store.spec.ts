import { test, expect } from '@playwright/test';

test('debug task store state', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:5546/');
  await page.waitForLoadState('networkidle');

  // Wait for app to initialize
  await page.waitForTimeout(5000);

  // Check browser console for restoration logs
  let consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log('BROWSER CONSOLE:', text);
  });

  // Check if there are any projects in the DOM by looking for broader selectors
  const projectElements = page.locator('.base-nav-item');
  const projectCount = await projectElements.count();
  console.log(`Found ${projectCount} base-nav-item elements`);

  // Check if there are any tasks in the DOM
  const taskElements = page.locator('.task-card, .task-item, [data-testid*="task"]');
  const taskCount = await taskElements.count();
  console.log(`Found ${taskCount} task elements`);

  // Look for any sidebar content
  const sidebarContent = page.locator('.projects-list, .sidebar, [class*="project"]');
  const sidebarCount = await sidebarContent.count();
  console.log(`Found ${sidebarCount} sidebar elements`);

  // Check the actual page title and content
  const title = await page.title();
  console.log(`Page title: ${title}`);

  // Take a screenshot for debugging
  await page.screenshot({ path: 'debug-page-state.png' });

  // Try to get computed state directly from the page
  try {
    const hasProjects = await page.evaluate(() => {
      // Try to access window.__VUE_DEVTOOLS_GLOBAL_HOOK__ if available
      return !!(window as any).POMO_FLOW_STORES?.taskStore?.projects?.length;
    });
    console.log(`Has projects in global store: ${hasProjects}`);
  } catch (e) {
    console.log('Could not access global store:', e.message);
  }

  // Log all console messages that contain restoration info
  const restorationLogs = consoleLogs.filter(log =>
    log.includes('restoration') ||
    log.includes('restor') ||
    log.includes('🔄') ||
    log.includes('projects') ||
    log.includes('tasks') ||
    log.includes('loadFromDatabase')
  );

  console.log('Restoration-related logs:');
  restorationLogs.forEach(log => console.log('  -', log));

  expect(restorationLogs.length).toBeGreaterThan(0);
});