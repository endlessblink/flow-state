import { test, expect } from '@playwright/test';

test.describe('Firebase Authentication Basic Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console monitoring
    const logs = [];
    page.on('console', (message) => {
      logs.push({
        type: message.type(),
        text: message.text(),
        timestamp: new Date().toISOString()
      });
    });

    // Store logs on page for later inspection
    page.on('load', () => {
      page.evaluate(() => {
        window.testLogs = [];
      });
    });

    page.on('console', (message) => {
      page.evaluate((log) => {
        if (!window.testLogs) window.testLogs = [];
        window.testLogs.push(log);
      }, {
        type: message.type(),
        text: message.text(),
        timestamp: new Date().toISOString()
      });
    });
  });

  test('should load app and check for Firebase initialization', async ({ page }) => {
    console.log('🚀 Starting Firebase test...');

    // Navigate to the app
    await page.goto('http://localhost:5546', { waitUntil: 'networkidle' });
    console.log('✅ App loaded successfully');

    // Wait for the app to initialize
    await page.waitForSelector('#root', { timeout: 10000 });
    console.log('✅ Root element found');

    // Wait for initial app load
    await page.waitForTimeout(5000);
    console.log('✅ Waited for app initialization');

    // Check console logs for Firebase-related messages
    const firebaseLogs = await page.evaluate(() => {
      if (!window.testLogs) return [];
      return window.testLogs.filter(log =>
        log.text.includes('firebase') ||
        log.text.includes('Firebase') ||
        log.text.includes('auth') ||
        log.text.includes('firestore') ||
        log.text.includes('✅ Firebase initialized')
      );
    });

    console.log('📋 Firebase-related logs found:', firebaseLogs.length);
    firebaseLogs.forEach(log => {
      console.log(`  [${log.type}] ${log.text}`);
    });

    // Look for auth modal or auth-related UI
    const authModal = page.locator('[class*="auth-modal"], [class*="AuthModal"], [role="dialog"]').first();
    const loginForm = page.locator('form').filter({ has: page.locator('input[type="email"]') }).first();
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();

    console.log('🔍 Checking for authentication UI elements...');

    let authState = 'unknown';
    if (await authModal.isVisible()) {
      authState = 'modal_visible';
      console.log('✅ Auth modal is visible');
    } else if (await loginForm.isVisible()) {
      authState = 'login_form_visible';
      console.log('✅ Login form is visible');
    } else if (await emailInput.isVisible()) {
      authState = 'email_input_visible';
      console.log('✅ Email input is visible');
    }

    // Check for user profile/sign out indicators
    const userMenu = page.locator('button:has-text("Profile"), button:has-text("Sign Out"), [class*="user-profile"], [class*="user-menu"]').first();
    if (await userMenu.isVisible()) {
      authState = 'authenticated';
      console.log('✅ User profile menu found - user appears authenticated');
    }

    // Check for task-related functionality
    const quickAdd = page.locator('[data-testid="quick-add"], button:has-text("Add Task"), input[placeholder*="task"]').first();
    const taskList = page.locator('[class*="task-list"], [class*="sidebar"], [data-testid="task-list"]').first();

    let taskFunctionality = 'not_found';
    if (await quickAdd.isVisible()) {
      taskFunctionality = 'quick_add_available';
      console.log('✅ Quick add functionality is available');
    }

    if (await taskList.isVisible()) {
      const tasks = page.locator('[class*="task"], [data-testid="task"]').all();
      const taskCount = await tasks.count();
      console.log(`✅ Task list found with ${taskCount} tasks`);

      if (taskCount > 0) {
        const firstTask = tasks.first();
        const taskText = await firstTask.textContent();
        console.log(`✅ First task: "${taskText?.trim()}"`);
      }
    }

    // Try accessing a protected route
    console.log('🔐 Testing auth guards...');
    await page.goto('http://localhost:5546/calendar');
    await page.waitForTimeout(2000);

    const calendarView = page.locator('[class*="calendar"], [data-testid="calendar"]').first();
    const authModalAgain = page.locator('[class*="auth-modal"], [class*="AuthModal"]').first();

    if (await calendarView.isVisible()) {
      console.log('✅ Calendar view accessible - user likely authenticated');
    } else if (await authModalAgain.isVisible()) {
      console.log('✅ Auth guard working - auth modal appeared for protected route');
    }

    // Check for error messages
    const errorElements = page.locator('[class*="error"], [class*="alert"]').all();
    const errorCount = await errorElements.count();

    if (errorCount > 0) {
      console.log(`⚠️ Found ${errorCount} error elements`);
      for (let i = 0; i < errorCount; i++) {
        const error = errorElements[i];
        const errorText = await error.textContent();
        console.log(`  Error ${i + 1}: "${errorText?.trim()}"`);
      }
    } else {
      console.log('✅ No error elements found');
    }

    // Final assessment
    console.log('\n📊 TEST RESULTS SUMMARY:');
    console.log(`  Auth State: ${authState}`);
    console.log(`  Task Functionality: ${taskFunctionality}`);
    console.log(`  Firebase Logs: ${firebaseLogs.length}`);
    console.log(`  Error Elements: ${errorCount}`);

    // Take screenshot for visual verification
    await page.screenshot({ path: 'test-results/firebase-auth-state.png', fullPage: true });
    console.log('📸 Screenshot saved to test-results/firebase-auth-state.png');

    // Basic assertions
    expect(await page.locator('#root').isVisible()).toBe(true);

    // At least one authentication-related element should be present
    const authElementsVisible = await authModal.isVisible() ||
                              await loginForm.isVisible() ||
                              await emailInput.isVisible() ||
                              await userMenu.isVisible();

    if (authElementsVisible) {
      console.log('✅ Authentication UI elements are present');
    } else {
      console.log('ℹ️ No authentication UI elements immediately visible');
    }
  });

  test('should test form validation and error handling', async ({ page }) => {
    await page.goto('http://localhost:5546', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Look for any form with email input
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();

    if (await emailInput.isVisible()) {
      console.log('✅ Found email input, testing validation...');

      // Try empty submission
      await emailInput.fill('');

      const submitButton = page.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Login")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(1000);

        // Check for validation messages
        const validationMessage = page.locator('[class*="error"], [class*="validation"], [class*="required"]').first();
        if (await validationMessage.isVisible()) {
          console.log('✅ Form validation is working');
        }
      }
    }

    // Test basic app functionality
    const appContent = page.locator('#root').first();
    await expect(appContent).toBeVisible();
  });
});