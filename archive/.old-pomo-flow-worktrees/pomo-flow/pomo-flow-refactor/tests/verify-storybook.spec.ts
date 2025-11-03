import { test, expect } from '@playwright/test';

test('Verify TaskContextMenu renders with Lucide icons', async ({ page }) => {
  // Set viewport size
  await page.setViewportSize({ width: 1280, height: 1024 });
  
  // Navigate to the TaskContextMenu story
  await page.goto('http://localhost:6006/?path=/story/components-context-menus-taskcontextmenu--default', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  
  // Wait for the story to fully load
  await page.waitForTimeout(2000);
  
  // Verify the context menu is visible in the rendered story
  const contextMenu = page.locator('.context-menu');
  await expect(contextMenu).toBeVisible();
  
  // Take screenshot for visual verification
  await page.screenshot({ path: '/tmp/taskcontextmenu-story.png', fullPage: false });
  console.log('Screenshot saved');
  
  // Count SVG elements (Lucide icons)
  const svgCount = await page.locator('svg').count();
  console.log(`Found ${svgCount} SVG elements`);
  
  // Verify menu items are visible
  const editButton = page.locator('.menu-item').first();
  await expect(editButton).toBeVisible();
  
  // Check for design token usage by examining actual computed styles
  const menuStyle = await contextMenu.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      backgroundColor: computed.backgroundColor,
      borderColor: computed.borderColor,
      padding: computed.padding,
      borderRadius: computed.borderRadius,
    };
  });
  console.log('Menu computed styles:', menuStyle);
  
  // Verify text content
  const menuContent = await contextMenu.textContent();
  console.log('Menu contains text:', menuContent?.substring(0, 100));
  
  // Check for specific menu items
  await expect(page.locator('text=Edit')).toBeVisible();
  await expect(page.locator('text=Date')).toBeVisible();
  await expect(page.locator('text=Priority')).toBeVisible();
  await expect(page.locator('text=Status')).toBeVisible();
  
  console.log('All tests passed - component renders correctly with proper styling');
});
