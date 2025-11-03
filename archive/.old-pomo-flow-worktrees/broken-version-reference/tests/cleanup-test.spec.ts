import { test, expect } from '@playwright/test';

test('cleanup functionality preserves essential data', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:5546/');
  await page.waitForLoadState('networkidle');

  // Wait for app to initialize
  await page.waitForTimeout(3000);

  // Check for console logs related to cleanup
  let cleanupLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🧹') || text.includes('cleanup') || text.includes('cleanProjects')) {
      cleanupLogs.push(text);
      console.log('CLEANUP LOG:', text);
    }
  });

  // Check if essential projects are present in sidebar
  const sidebarProjects = page.locator('[data-testid="project-sidebar-item"]');
  await expect(sidebarProjects.first()).toBeVisible({ timeout: 10000 });

  // Look for essential projects
  const essentialProjects = ['work', 'home', 'lime', 'blink', 'my_projects'];
  let foundProjects = [];

  for (const project of essentialProjects) {
    const projectElement = page.locator(`[data-project-name*="${project}"]`).first();
    if (await projectElement.isVisible()) {
      foundProjects.push(project);
    }
  }

  console.log(`Found essential projects: ${foundProjects.join(', ')}`);

  // Check for task counts on projects
  const projectCounts = page.locator('.base-badge');
  if (await projectCounts.first().isVisible()) {
    const countText = await projectCounts.first().textContent();
    console.log(`Project task count visible: ${countText}`);
  }

  // Test project filtering by clicking on a project
  if (foundProjects.length > 0) {
    const firstProject = page.locator(`[data-project-name*="${foundProjects[0]}"]`).first();
    await firstProject.click();
    await page.waitForTimeout(1000);

    // Check if any tasks appear after filtering
    const tasks = page.locator('[data-testid="task-card"]');
    const taskCount = await tasks.count();
    console.log(`Tasks visible after filtering: ${taskCount}`);
  }

  // Verify cleanup didn't remove everything
  expect(foundProjects.length).toBeGreaterThan(0);

  // Check cleanup logs
  expect(cleanupLogs.length).toBeGreaterThan(0);

  console.log('✅ Cleanup test completed successfully');
  console.log(`Essential projects preserved: ${foundProjects.length}/${essentialProjects.length}`);
  console.log(`Cleanup operations detected: ${cleanupLogs.length}`);
});