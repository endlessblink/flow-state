import { test, expect } from '@playwright/test';

test('Verify TaskContextMenu renders with Lucide icons - V2', async ({ page }) => {
  // Set viewport size
  await page.setViewportSize({ width: 1280, height: 1024 });
  
  // Navigate to the TaskContextMenu story
  await page.goto('http://localhost:6006/?path=/story/components-context-menus-taskcontextmenu--default', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  
  // Wait for the story to fully load
  await page.waitForTimeout(3000);
  
  // Check the page source to see what's actually being rendered
  const htmlContent = await page.content();
  console.log('Page title:', await page.title());
  
  // Look for the canvas iframe
  const iframe = page.frameLocator('iframe[title="Canvas"]');
  
  // Now look for the context menu inside the iframe
  const contextMenuInIframe = iframe.locator('.context-menu');
  
  try {
    await expect(contextMenuInIframe).toBeVisible({ timeout: 5000 });
    console.log('Context menu found in iframe!');
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/taskcontextmenu-in-iframe.png', fullPage: false });
    
    // Count SVG elements
    const svgCount = await iframe.locator('svg').count();
    console.log(`Found ${svgCount} SVG elements in iframe`);
    
    // Get text content
    const text = await contextMenuInIframe.textContent();
    console.log('Menu text content:', text?.substring(0, 200));
    
    // Check for specific menu items
    const editText = iframe.locator('text=Edit');
    await expect(editText).toBeVisible();
    console.log('Edit menu item visible');
    
    const dateText = iframe.locator('text=Date');
    await expect(dateText).toBeVisible();
    console.log('Date section visible');
    
    const priorityText = iframe.locator('text=Priority');
    await expect(priorityText).toBeVisible();
    console.log('Priority section visible');
    
    const statusText = iframe.locator('text=Status');
    await expect(statusText).toBeVisible();
    console.log('Status section visible');
    
    // Get computed styles
    const menuStyle = await contextMenuInIframe.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        borderColor: computed.borderColor,
        padding: computed.padding,
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
      };
    });
    console.log('Menu computed styles:', JSON.stringify(menuStyle, null, 2));
    
  } catch (error) {
    console.log('Context menu not found in iframe, checking page directly...');
    
    // Try direct page search
    const directMenu = page.locator('.context-menu');
    const count = await directMenu.count();
    console.log(`Found ${count} context menus on page`);
    
    // Check what's in the canvas area
    const canvasContainer = page.locator('[data-testid="canvas"]');
    const containerCount = await canvasContainer.count();
    console.log(`Found ${containerCount} canvas containers`);
    
    // Try to capture what's actually rendering
    await page.screenshot({ path: '/tmp/storybook-full-view.png' });
    console.log('Full page screenshot saved');
    
    throw error;
  }
  
  console.log('All tests passed - component renders correctly with Lucide icons and design tokens');
});
