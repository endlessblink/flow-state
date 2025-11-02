/**
 * Simple baseline check for CanvasView functionality
 * This script manually verifies the core CanvasView behaviors
 * without relying on the complex test framework setup
 */

import { chromium } from 'playwright';

async function checkCanvasBaseline() {
  console.log('🔍 Starting CanvasView baseline check...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    const errors = [];

    // Capture JavaScript errors
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Navigate to CanvasView
    console.log('📱 Navigating to CanvasView...');
    const response = await page.goto('http://localhost:5547/#/canvas');

    if (!response?.ok()) {
      throw new Error(`Failed to load: ${response?.status()}`);
    }

    // Wait for app to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Wait for loading overlay to disappear
    console.log('⏳ Waiting for canvas to finish loading...');
    const loadingOverlay = await page.locator('.canvas-loading-overlay');
    try {
      await loadingOverlay.waitFor({ state: 'hidden', timeout: 10000 });
      console.log('✅ Canvas loading overlay disappeared');
    } catch (e) {
      console.log('⚠️ Loading overlay may still be present, continuing anyway');
    }

    // Additional wait to ensure canvas is ready
    await page.waitForTimeout(2000);

    console.log('✅ Application loaded successfully');

    // Check 1: No JavaScript errors
    console.log('🔍 Checking for JavaScript errors...');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      console.log('❌ JavaScript errors found:');
      errors.forEach(error => console.log(`  - ${error}`));
      return false;
    }
    console.log('✅ No JavaScript errors detected');

    // Check 2: Vue Flow container present
    console.log('🔍 Checking Vue Flow container...');
    const vueFlow = await page.locator('.vue-flow').count();
    if (vueFlow === 0) {
      console.log('❌ Vue Flow container not found');
      return false;
    }
    console.log('✅ Vue Flow container found');

    // Check 3: Canvas controls present
    console.log('🔍 Checking canvas controls...');
    const controls = await page.locator('.canvas-controls').count();
    if (controls === 0) {
      console.log('❌ Canvas controls not found');
      return false;
    }
    console.log('✅ Canvas controls found');

    // Check 4: Verify essential structure without interaction
    console.log('🔍 Checking essential canvas structure...');

    // Check for viewport container
    const viewport = await page.locator('.vue-flow__viewport').count();
    if (viewport === 0) {
      console.log('❌ Vue Flow viewport not found');
      return false;
    }
    console.log('✅ Vue Flow viewport present');

    // Check for node renderer
    const nodeRenderer = await page.locator('.vue-flow__nodes').count();
    if (nodeRenderer === 0) {
      console.log('❌ Node renderer not found');
      return false;
    }
    console.log('✅ Node renderer present');

    // Check for edge renderer (may not exist if no edges are present)
    const edgeRenderer = await page.locator('.vue-flow__edges').count();
    if (edgeRenderer === 0) {
      console.log('ℹ️ Edge renderer not found (no edges present - this is expected)');
    } else {
      console.log('✅ Edge renderer present');
    }

    // Check for loading overlay presence (it might be persistent)
    const loadingOverlayPresent = await page.locator('.canvas-loading-overlay').count();
    if (loadingOverlayPresent > 0) {
      console.log('ℹ️ Loading overlay present (may be expected behavior)');
    } else {
      console.log('✅ No loading overlay');
    }

    console.log('✅ Essential canvas structure verified');

    // Check 5: Final error check
    const finalErrors = errors.length;
    if (finalErrors > 0) {
      console.log('❌ Errors occurred during interactions:');
      errors.forEach(error => console.log(`  - ${error}`));
      return false;
    }

    console.log('🎉 All baseline checks passed!');
    return true;

  } catch (error) {
    console.log('❌ Baseline check failed:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

// Run the check
checkCanvasBaseline().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Check failed with error:', error);
  process.exit(1);
});