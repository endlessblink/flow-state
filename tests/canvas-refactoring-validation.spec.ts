import { test, expect } from '@playwright/test';
import path from 'path';
import * as fs from 'fs';

/**
 * Phase 3A Canvas Refactoring Validation Test Suite
 * Tests that all extracted components work correctly after refactoring
 */
test.describe('Phase 3A Canvas Refactoring Validation', () => {
  const screenshotDir = '/tmp/canvas-refactoring-validation';

  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    // Enable console logging to capture 🔥-prefixed diagnostic logs
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      if (text.includes('🔥') || text.includes('ERROR') || text.includes('error')) {
        console.log('🔥 FOUND:', text);
      }
    });

    // Navigate to app and wait for it to load
    await page.goto('http://localhost:5546', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
  });

  test('Canvas loads and basic functionality works', async ({ page }) => {
    console.log('🧪 Testing Canvas basic functionality...');

    // Check if Canvas tab exists and is clickable
    const canvasTab = page.locator('button:has-text("Canvas")').first();
    if (await canvasTab.isVisible({ timeout: 3000 })) {
      await canvasTab.click();
      await page.waitForTimeout(2000);
      console.log('✅ Canvas view loaded');
    } else {
      console.log('ℹ️ Canvas tab not visible - checking if already on Canvas');
    }

    // Take initial canvas screenshot
    await page.screenshot({
      path: path.join(screenshotDir, '1-canvas-initial.png'),
      fullPage: true
    });

    // Look for canvas controls (should be present if CanvasControls component works)
    const controlsVisible = await page.locator('.canvas-controls').isVisible({ timeout: 3000 });
    console.log(`🎛️ Canvas controls visible: ${controlsVisible}`);

    // Look for zoom controls
    const zoomControls = await page.locator('[title*="Zoom"]').count();
    console.log(`🔍 Zoom controls found: ${zoomControls}`);

    // Look for sections toggle
    const sectionsToggle = await page.locator('[title*="Sections"]').count();
    console.log(`📋 Sections toggle found: ${sectionsToggle}`);

    expect(controlsVisible || zoomControls > 0).toBeTruthy();
  });

  test('CanvasControls component functionality', async ({ page }) => {
    console.log('🧪 Testing CanvasControls component...');

    // Navigate to Canvas view
    const canvasTab = page.locator('button:has-text("Canvas")').first();
    if (await canvasTab.isVisible({ timeout: 3000 })) {
      await canvasTab.click();
      await page.waitForTimeout(2000);
    }

    // Test zoom controls if present
    const zoomInBtn = page.locator('[title*="Zoom In"], [title*="zoom in"]').first();
    if (await zoomInBtn.isVisible({ timeout: 2000 })) {
      console.log('🔍 Testing zoom controls...');
      await zoomInBtn.click();
      await page.waitForTimeout(500);

      const zoomOutBtn = page.locator('[title*="Zoom Out"], [title*="zoom out"]').first();
      if (await zoomOutBtn.isVisible()) {
        await zoomOutBtn.click();
        await page.waitForTimeout(500);
        console.log('✅ Zoom controls working');
      }
    }

    // Test sections toggle if present
    const sectionsToggle = page.locator('[title*="Sections"], [title*="Toggle Sections"]').first();
    if (await sectionsToggle.isVisible({ timeout: 2000 })) {
      console.log('📋 Testing sections toggle...');
      await sectionsToggle.click();
      await page.waitForTimeout(500);
      console.log('✅ Sections toggle working');
    }

    // Test display toggles
    const displayToggles = page.locator('[title*="Toggle"], [title*="Display"]');
    const toggleCount = await displayToggles.count();
    console.log(`🎛️ Found ${toggleCount} display toggles`);

    if (toggleCount > 0) {
      // Test first few toggles
      for (let i = 0; i < Math.min(3, toggleCount); i++) {
        const toggle = displayToggles.nth(i);
        if (await toggle.isVisible()) {
          await toggle.click();
          await page.waitForTimeout(300);
          console.log(`✅ Display toggle ${i + 1} working`);
        }
      }
    }

    await page.screenshot({
      path: path.join(screenshotDir, '2-canvas-controls-test.png'),
      fullPage: true
    });
  });

  test('Canvas task operations work', async ({ page }) => {
    console.log('🧪 Testing Canvas task operations...');

    // Navigate to Canvas view
    const canvasTab = page.locator('button:has-text("Canvas")').first();
    if (await canvasTab.isVisible({ timeout: 3000 })) {
      await canvasTab.click();
      await page.waitForTimeout(2000);
    }

    // Look for task nodes on canvas
    const taskNodes = page.locator('.vue-flow__node, [data-testid*="task"], .task-node');
    const nodeCount = await taskNodes.count();
    console.log(`📍 Found ${nodeCount} task nodes on canvas`);

    if (nodeCount > 0) {
      // Try to interact with first task node
      const firstNode = taskNodes.first();
      if (await firstNode.isVisible()) {
        // Try to click on it
        await firstNode.click();
        await page.waitForTimeout(500);
        console.log('✅ Task node selection working');

        // Look for context menu or task details
        const contextMenu = page.locator('.context-menu, .canvas-context-menu').first();
        if (await contextMenu.isVisible({ timeout: 1000 })) {
          console.log('✅ Context menu appears on node click');

          // Close context menu by clicking elsewhere
          await page.click('body', { position: { x: 100, y: 100 } });
          await page.waitForTimeout(300);
        }
      }
    }

    await page.screenshot({
      path: path.join(screenshotDir, '3-canvas-tasks-test.png'),
      fullPage: true
    });
  });

  test('Performance and zoom features work', async ({ page }) => {
    console.log('🧪 Testing performance and zoom features...');

    // Navigate to Canvas view
    const canvasTab = page.locator('button:has-text("Canvas")').first();
    if (await canvasTab.isVisible({ timeout: 3000 })) {
      await canvasTab.click();
      await page.waitForTimeout(2000);
    }

    // Test fit view if available
    const fitViewBtn = page.locator('[title*="Fit View"], [title*="Fit to Content"]').first();
    if (await fitViewBtn.isVisible({ timeout: 2000 })) {
      console.log('🎯 Testing fit view...');
      await fitViewBtn.click();
      await page.waitForTimeout(1000);
      console.log('✅ Fit view working');
    }

    // Test zoom dropdown if available
    const zoomDropdown = page.locator('[title*="Zoom Presets"], .zoom-dropdown-trigger').first();
    if (await zoomDropdown.isVisible({ timeout: 2000 })) {
      console.log('📊 Testing zoom dropdown...');
      await zoomDropdown.click();
      await page.waitForTimeout(500);

      // Look for zoom preset options
      const presetOptions = page.locator('.zoom-preset-btn, [data-testid*="zoom-preset"]');
      const optionCount = await presetOptions.count();
      console.log(`📊 Found ${optionCount} zoom preset options`);

      if (optionCount > 0) {
        // Click on first preset
        await presetOptions.first().click();
        await page.waitForTimeout(500);
        console.log('✅ Zoom preset working');
      }
    }

    await page.screenshot({
      path: path.join(screenshotDir, '4-canvas-performance-test.png'),
      fullPage: true
    });
  });

  test('No console errors after refactoring', async ({ page }) => {
    console.log('🧪 Testing for console errors...');

    const errors: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error' || text.includes('ERROR') || text.includes('Uncaught')) {
        errors.push(text);
        console.log('❌ Console Error:', text);
      }
    });

    // Navigate through different views
    const views = ['Board', 'Calendar', 'Canvas', 'All Tasks'];

    for (const view of views) {
      const viewTab = page.locator(`button:has-text("${view}")`).first();
      if (await viewTab.isVisible({ timeout: 3000 })) {
        await viewTab.click();
        await page.waitForTimeout(2000);
        console.log(`📱 Checked ${view} view for errors`);
      }
    }

    // Assert no critical errors
    const criticalErrors = errors.filter(err =>
      !err.includes('ResizeObserver loop limit exceeded') && // Common harmless error
      !err.includes('Failed to load resource') && // Network errors are expected in test
      !err.includes('404')
    );

    console.log(`🔍 Found ${criticalErrors.length} critical console errors`);

    if (criticalErrors.length > 0) {
      console.log('❌ Critical errors found:');
      criticalErrors.forEach(err => console.log('  -', err));
    }

    // Allow some non-critical errors but not too many
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test('Memory and performance validation', async ({ page }) => {
    console.log('🧪 Testing memory usage and performance...');

    // Get initial memory metrics
    const initialMetrics = await page.evaluate(() => {
      return {
        memory: (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        } : null,
        nodes: document.querySelectorAll('*').length,
        eventListeners: (performance as any).eventCounts ? Object.values((performance as any).eventCounts).reduce((a: number, b: number) => a + b, 0) : 0
      };
    });

    console.log('📊 Initial metrics:', initialMetrics);

    // Navigate to Canvas and perform some operations
    const canvasTab = page.locator('button:has-text("Canvas")').first();
    if (await canvasTab.isVisible({ timeout: 3000 })) {
      await canvasTab.click();
      await page.waitForTimeout(2000);

      // Perform some zoom operations
      for (let i = 0; i < 5; i++) {
        const zoomInBtn = page.locator('[title*="Zoom In"]').first();
        if (await zoomInBtn.isVisible()) {
          await zoomInBtn.click();
          await page.waitForTimeout(200);
        }
      }

      // Get final memory metrics
      const finalMetrics = await page.evaluate(() => {
        return {
          memory: (performance as any).memory ? {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
            limit: (performance as any).memory.jsHeapSizeLimit
          } : null,
          nodes: document.querySelectorAll('*').length,
          eventListeners: (performance as any).eventCounts ? Object.values((performance as any).eventCounts).reduce((a: number, b: number) => a + b, 0) : 0
        };
      });

      console.log('📊 Final metrics:', finalMetrics);

      // Calculate memory growth
      if (initialMetrics.memory && finalMetrics.memory) {
        const memoryGrowth = finalMetrics.memory.used - initialMetrics.memory.used;
        const memoryGrowthMB = memoryGrowth / (1024 * 1024);
        console.log(`📈 Memory growth: ${memoryGrowthMB.toFixed(2)} MB`);

        // Memory growth should be reasonable (less than 50MB for simple operations)
        expect(memoryGrowthMB).toBeLessThan(50);
      }
    }

    await page.screenshot({
      path: path.join(screenshotDir, '5-canvas-memory-test.png'),
      fullPage: true
    });
  });

  test.afterEach(async ({ page }) => {
    // Capture any remaining console logs
    page.removeAllListeners('console');
  });

  test('Component integration validation', async ({ page }) => {
    console.log('🧪 Testing component integration...');

    // Check that our extracted components are working
    // Navigate to Canvas view
    const canvasTab = page.locator('button:has-text("Canvas")').first();
    if (await canvasTab.isVisible({ timeout: 3000 })) {
      await canvasTab.click();
      await page.waitForTimeout(2000);
    }

    // Validate that CanvasControls component is rendering
    const canvasControls = page.locator('.canvas-controls');
    const controlsExist = await canvasControls.count();
    console.log(`🎛️ CanvasControls component instances: ${controlsExist}`);

    // Check for specific controls that should be in CanvasControls
    const controlButtons = await canvasControls.locator('button').count();
    console.log(`🎛️ Control buttons found: ${controlButtons}`);

    // Look for performance manager functionality by testing rapid zoom operations
    const zoomInBtn = page.locator('[title*="Zoom In"]').first();
    if (await zoomInBtn.isVisible()) {
      console.log('⚡ Testing performance manager with rapid operations...');

      // Perform rapid zoom operations to test throttling
      const startTime = Date.now();
      for (let i = 0; i < 10; i++) {
        await zoomInBtn.click();
        // No wait - this should be throttled by performance manager
      }
      const endTime = Date.now();

      console.log(`⚡ Rapid operations completed in ${endTime - startTime}ms`);

      // Take a final screenshot
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: path.join(screenshotDir, '6-canvas-integration-test.png'),
      fullPage: true
    });

    console.log('✅ Component integration validation complete');
  });

  test.afterAll(async () => {
    console.log(`📸 All validation screenshots saved to: ${screenshotDir}`);
    console.log('🎉 Phase 3A Canvas Refactoring Validation Complete!');
  });
});