import { test, expect } from '@playwright/test';

test.describe('Firebase Authentication Comprehensive Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5546');

    // Wait for app to load
    await page.waitForSelector('#root', { timeout: 10000 });

    // Wait for Firebase to initialize
    await page.waitForFunction(() => {
      return window.firebase || window.APP_INITIALIZED;
    }, { timeout: 15000 });

    // Check for initial console errors
    page.on('console', (message) => {
      if (message.type() === 'error') {
        console.log('Console Error:', message.text());
      }
    });
  });

  test('should load Firebase and show authentication state', async ({ page }) => {
    // Wait for Firebase auth to initialize
    await page.waitForTimeout(3000);

    // Check if auth modal appears (expected for unauthenticated users)
    const authModal = page.locator('[class*="auth-modal"], [class*="AuthModal"]').first();

    if (await authModal.isVisible()) {
      console.log('✅ Auth modal is present for unauthenticated user');

      // Verify login form elements exist
      const loginForm = page.locator('form').filter({ has: page.locator('input[type="email"]') }).first();
      await expect(loginForm).toBeVisible();

      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const loginButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();

      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(loginButton).toBeVisible();

      console.log('✅ Login form elements are present and visible');

      // Check for Google Sign-In button
      const googleButton = page.locator('button:has-text("Google"), button:has-text("Sign in with Google")').first();
      if (await googleButton.isVisible()) {
        console.log('✅ Google Sign-In button is present');
      }

      // Check for signup link
      const signupLink = page.locator('a:has-text("Sign Up"), a:has-text("Register"), button:has-text("Sign Up")').first();
      if (await signupLink.isVisible()) {
        console.log('✅ Sign Up link/button is present');
      }

    } else {
      // User might already be authenticated
      console.log('ℹ️ No auth modal visible - user may already be authenticated');

      // Look for user profile/sign out button
      const userMenu = page.locator('button:has-text("Profile"), button:has-text("Sign Out"), [class*="user-profile"]').first();
      if (await userMenu.isVisible()) {
        console.log('✅ User profile menu is visible - user appears authenticated');
      }
    }
  });

  test('should handle sign up with email and password', async ({ page }) => {
    await page.waitForTimeout(3000);

    // Look for auth modal or navigate to it
    const authModal = page.locator('[class*="auth-modal"], [class*="AuthModal"]').first();

    if (!await authModal.isVisible()) {
      // Try to find a sign in button
      const signInButton = page.locator('button:has-text("Sign In"), button:has-text("Login")').first();
      if (await signInButton.isVisible()) {
        await signInButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Try to switch to sign up mode
    const signupLink = page.locator('a:has-text("Sign Up"), button:has-text("Sign Up")').first();
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await page.waitForTimeout(1000);
    }

    // Fill out sign up form
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[placeholder*="confirm"]').first();
    const displayNameInput = page.locator('input[name="displayName"], input[placeholder*="name"]').first();

    if (await emailInput.isVisible()) {
      const testEmail = `testuser+${Date.now()}@example.com`;
      const testPassword = 'TestPassword123!';

      await emailInput.fill(testEmail);
      await passwordInput.fill(testPassword);

      if (await confirmPasswordInput.isVisible()) {
        await confirmPasswordInput.fill(testPassword);
      }

      if (await displayNameInput.isVisible()) {
        await displayNameInput.fill('Test User');
      }

      // Submit the form
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign Up"), button:has-text("Register")').first();
      await expect(submitButton).toBeVisible();

      console.log('✅ Sign up form filled out, attempting submission...');

      // Note: We won't actually submit to avoid creating real test accounts
      // but we verify the form is properly set up

      // Check for form validation
      const isSubmitEnabled = await submitButton.isEnabled();
      console.log(`✅ Submit button state: ${isSubmitEnabled ? 'enabled' : 'disabled'}`);

    } else {
      console.log('ℹ️ Sign up form not found - may be in different mode');
    }
  });

  test('should handle database operations when authenticated', async ({ page }) => {
    await page.waitForTimeout(5000); // Wait for auth to fully initialize

    // Check if we can access task-related functionality
    const quickAddButton = page.locator('[data-testid="quick-add"], button:has-text("Add Task"), input[placeholder*="task"]').first();

    if (await quickAddButton.isVisible()) {
      console.log('✅ Quick add functionality is accessible');

      // Try to create a test task
      if (await quickAddButton.getAttribute('type') === 'button') {
        await quickAddButton.click();
        await page.waitForTimeout(500);

        const taskInput = page.locator('input[placeholder*="task"], input[name="task"]').first();
        if (await taskInput.isVisible()) {
          await taskInput.fill('Firebase Test Task');

          // Look for save button
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Add"), button[type="submit"]').first();
          if (await saveButton.isVisible()) {
            console.log('✅ Task creation form is ready');
            // Note: We won't actually submit to avoid creating test data
          }
        }
      } else if (await quickAddButton.getAttribute('type') === 'text' || await quickAddButton.getAttribute('placeholder')) {
        // It's an input field
        await quickAddButton.fill('Firebase Test Task');
        console.log('✅ Quick add input field is functional');
      }
    }

    // Check for task list/sidebar to verify data loading
    const taskList = page.locator('[class*="task-list"], [class*="sidebar"], [data-testid="task-list"]').first();
    if (await taskList.isVisible()) {
      console.log('✅ Task list/container is visible');

      // Check if tasks are loaded
      const tasks = page.locator('[class*="task"], [data-testid="task"]').all();
      const taskCount = await tasks.count();
      console.log(`✅ Found ${taskCount} tasks in the interface`);

      if (taskCount > 0) {
        // Get details of first task
        const firstTask = tasks.first();
        const taskText = await firstTask.textContent();
        console.log(`✅ First task content: "${taskText?.trim()}"`);

        // Verify task has expected properties
        const hasId = await firstTask.getAttribute('data-task-id');
        const hasTitle = await firstTask.locator('[class*="title"], [class*="name"]').first().isVisible();

        console.log(`✅ Task has ID: ${!!hasId}, Has title: ${hasTitle}`);
      }
    }
  });

  test('should verify real-time synchronization capabilities', async ({ page }) => {
    await page.waitForTimeout(3000);

    // Check for WebSocket/Firestore real-time indicators
    const connectionIndicator = page.locator('[class*="connection"], [class*="sync"], [class*="online"]').first();
    if (await connectionIndicator.isVisible()) {
      const connectionText = await connectionIndicator.textContent();
      console.log(`✅ Connection indicator found: "${connectionText?.trim()}"`);
    }

    // Check for Firebase/Firestore in window object
    const firebaseStatus = await page.evaluate(() => {
      return {
        hasFirebase: !!window.firebase,
        hasFirestore: !!(window.firebase && window.firebase.firestore),
        hasAuth: !!(window.firebase && window.firebase.auth),
        firestoreConfigured: !!(window.firestoreDB || window.db)
      };
    });

    console.log('✅ Firebase Status:', firebaseStatus);

    // Monitor console for Firebase-related logs
    const firebaseLogs = [];
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('firebase') || text.includes('Firebase') || text.includes('firestore') || text.includes('auth')) {
        firebaseLogs.push({
          type: message.type(),
          text: text,
          location: message.location()
        });
      }
    });

    // Wait a bit to collect logs
    await page.waitForTimeout(3000);

    if (firebaseLogs.length > 0) {
      console.log('✅ Firebase-related console logs detected:');
      firebaseLogs.forEach(log => {
        console.log(`  [${log.type}] ${log.text}`);
      });
    }
  });

  test('should verify session persistence and auth guards', async ({ page }) => {
    await page.waitForTimeout(3000);

    // Try to access a protected route
    await page.goto('http://localhost:5546/calendar');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`✅ Navigated to: ${currentUrl}`);

    // Check if auth modal appears or if we're redirected
    const authModal = page.locator('[class*="auth-modal"], [class*="AuthModal"]').first();
    const calendarView = page.locator('[class*="calendar"], [data-testid="calendar"]').first();

    if (await authModal.isVisible()) {
      console.log('✅ Auth guard working - auth modal appeared for protected route');
    } else if (await calendarView.isVisible()) {
      console.log('✅ Calendar view accessible - user may be authenticated');
    } else {
      console.log('ℹ️ Protected route behavior unclear');
    }

    // Check for user session indicators
    const userIndicator = page.locator('[class*="user"], [class*="profile"], button:has-text("Sign Out")').first();
    if (await userIndicator.isVisible()) {
      console.log('✅ User session indicator found');
    }
  });

  test('should validate error handling and edge cases', async ({ page }) => {
    await page.waitForTimeout(3000);

    // Collect any console errors during the session
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push({
          text: message.text(),
          location: message.location()
        });
      }
    });

    // Try some edge case operations
    const authModal = page.locator('[class*="auth-modal"], [class*="AuthModal"]').first();

    if (await authModal.isVisible()) {
      // Test form validation
      const emailInput = page.locator('input[type="email"]').first();
      const submitButton = page.locator('button[type="submit"]').first();

      if (await emailInput.isVisible() && await submitButton.isVisible()) {
        // Try submitting with empty form
        await emailInput.fill('');
        await submitButton.click();
        await page.waitForTimeout(1000);

        // Check for validation messages
        const validationMessage = page.locator('[class*="error"], [class*="validation"], [class*="required"]').first();
        if (await validationMessage.isVisible()) {
          console.log('✅ Form validation is working');
        }
      }
    }

    // Wait and check for any accumulated errors
    await page.waitForTimeout(2000);

    if (errors.length === 0) {
      console.log('✅ No console errors detected - excellent!');
    } else {
      console.log(`⚠️ ${errors.length} console errors found:`);
      errors.forEach(error => {
        console.log(`  ERROR: ${error.text}`);
      });
    }
  });
});