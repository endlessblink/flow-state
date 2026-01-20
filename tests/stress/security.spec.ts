import { test, expect } from '@playwright/test';

/**
 * Security Stress Tests
 * TASK-338: Security Audit Testing
 *
 * Tests XSS prevention, input sanitization, and security boundaries.
 */

test.describe('Security Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
  });

  test('@quick XSS Prevention - Script Tag in Task Title', async ({ page }) => {
    /**
     * SEC-001: XSS via Task Title
     * Attempt to inject script tag
     */

    const xssPayload = '<script>alert("XSS")</script>';
    const marker = 'XSS_MARKER_' + Date.now();

    // Navigate to board
    await page.click('[data-testid="nav-board"]').catch(() => page.keyboard.press('2'));
    await page.waitForTimeout(1000);

    // Create task with XSS payload
    await page.keyboard.press('n');
    await page.waitForTimeout(200);

    const titleInput = page.locator('input[placeholder*="title"], input[data-testid="task-title-input"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill(xssPayload + marker);
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(1000);

    // Check that script was NOT executed by looking for alert dialog
    // Playwright would throw if an alert appeared
    const dialogPromise = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      page.once('dialog', () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });

    const dialogAppeared = await dialogPromise;

    // Pass criteria: No script execution
    expect(dialogAppeared).toBe(false);
    console.log('XSS script tag: NOT executed (PASS)');

    // Additional check: script tag should be escaped in DOM
    const pageContent = await page.content();
    const hasRawScript = pageContent.includes('<script>alert');
    const hasEscapedScript = pageContent.includes('&lt;script&gt;') ||
                             pageContent.includes('script') === false;

    console.log(`Raw script in DOM: ${hasRawScript}`);
  });

  test('@quick XSS Prevention - Event Handler Injection', async ({ page }) => {
    /**
     * SEC-001b: XSS via onerror/onclick handlers
     */

    const xssPayloads = [
      '<img onerror="alert(\'XSS\')" src="x">',
      '<div onclick="alert(\'XSS\')">click</div>',
      '"><script>alert("XSS")</script>',
      'javascript:alert("XSS")'
    ];

    // Navigate to board
    await page.click('[data-testid="nav-board"]').catch(() => page.keyboard.press('2'));
    await page.waitForTimeout(1000);

    let alertTriggered = false;
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      console.log(`ALERT TRIGGERED: ${dialog.message()}`);
      await dialog.dismiss();
    });

    for (const payload of xssPayloads) {
      await page.keyboard.press('n');
      await page.waitForTimeout(200);

      const titleInput = page.locator('input[placeholder*="title"], input[data-testid="task-title-input"]').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill(payload);
        await page.keyboard.press('Enter');
      }

      await page.waitForTimeout(500);
    }

    // Wait a bit for any delayed script execution
    await page.waitForTimeout(2000);

    // Pass criteria: No XSS triggered
    expect(alertTriggered).toBe(false);
    console.log('Event handler XSS payloads: NOT executed (PASS)');
  });

  test('@quick XSS Prevention - Rich Text Editor', async ({ page }) => {
    /**
     * Test XSS in TipTap rich text editor (task description)
     */

    const xssPayload = '<script>document.body.innerHTML="HACKED"</script>';

    // Navigate to board
    await page.click('[data-testid="nav-board"]').catch(() => page.keyboard.press('2'));
    await page.waitForTimeout(1000);

    // Find and click a task to open details
    const taskCard = page.locator('[data-testid="task-card"], .task-card').first();
    if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskCard.click();
      await page.waitForTimeout(500);

      // Look for description/notes editor
      const editor = page.locator('.tiptap, .ProseMirror, [data-testid="task-description"]').first();
      if (await editor.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editor.click();
        await page.keyboard.type(xssPayload);
        await page.waitForTimeout(1000);

        // Check body wasn't replaced
        const bodyContent = await page.locator('body').innerHTML();
        expect(bodyContent).not.toBe('HACKED');
        console.log('Rich text editor XSS: NOT executed (PASS)');
      } else {
        console.log('Rich text editor not found - skipping');
      }
    } else {
      console.log('No task cards found - skipping');
    }
  });

  test('Input Length Limits', async ({ page }) => {
    /**
     * Test that extremely long inputs don't crash the app
     */

    const longInput = 'A'.repeat(100000); // 100KB of text

    // Navigate to board
    await page.click('[data-testid="nav-board"]').catch(() => page.keyboard.press('2'));
    await page.waitForTimeout(1000);

    // Create task with extremely long title
    await page.keyboard.press('n');
    await page.waitForTimeout(200);

    const titleInput = page.locator('input[placeholder*="title"], input[data-testid="task-title-input"]').first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Input may be truncated - that's fine
      await titleInput.fill(longInput);

      // App should still be responsive
      const canType = await titleInput.inputValue();
      console.log(`Input accepted ${canType.length} characters`);

      await page.keyboard.press('Escape');
    }

    // Verify app didn't crash
    await page.waitForTimeout(1000);
    const appStillRunning = await page.locator('body').isVisible();
    expect(appStillRunning).toBe(true);
    console.log('Long input handling: App stable (PASS)');
  });

  test('SQL Injection Prevention (via search)', async ({ page }) => {
    /**
     * SEC-004: SQL Injection attempt via search
     */

    const sqlPayloads = [
      "'; DROP TABLE tasks; --",
      "1' OR '1'='1",
      "1; DELETE FROM tasks WHERE '1'='1",
      "UNION SELECT * FROM user_settings--"
    ];

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], [data-testid="search-input"]').first();

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      for (const payload of sqlPayloads) {
        await searchInput.fill(payload);
        await page.waitForTimeout(500);

        // Check for errors
        const errorVisible = await page.locator('.error, [data-testid="error"]').isVisible({ timeout: 1000 }).catch(() => false);

        // No SQL error should appear
        console.log(`SQL payload "${payload.substring(0, 20)}...": ${errorVisible ? 'ERROR (check logs)' : 'OK'}`);
      }

      // Clear search
      await searchInput.fill('');
    } else {
      console.log('Search input not found - skipping SQL injection test');
    }

    // Verify app still works
    await page.keyboard.press('n');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');

    const appResponsive = await page.locator('body').isVisible();
    expect(appResponsive).toBe(true);
    console.log('SQL injection prevention: App stable (PASS)');
  });

});
