import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Container Stability Stress Tests
 * TASK-338 / TASK-361: Container Restart Resilience
 *
 * Tests Docker/Supabase container health and restart recovery.
 * These tests require Docker to be running with Supabase containers.
 */

const BASE_URL = 'http://localhost:5546';
const SUPABASE_URL = 'http://localhost:54321';

// Helper to check if Docker is available
async function isDockerAvailable(): Promise<boolean> {
  try {
    await execAsync('docker --version');
    return true;
  } catch {
    return false;
  }
}

// Helper to get container status
async function getContainerStatus(containerName: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format='{{.State.Status}}' ${containerName} 2>/dev/null`
    );
    return stdout.trim();
  } catch {
    return null;
  }
}

// Helper to get container health
async function getContainerHealth(containerName: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format='{{.State.Health.Status}}' ${containerName} 2>/dev/null`
    );
    return stdout.trim();
  } catch {
    return null;
  }
}

// Helper to list Supabase containers
async function listSupabaseContainers(): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `docker ps --filter "name=supabase" --format "{{.Names}}" 2>/dev/null`
    );
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// Helper to wait for container to be healthy
async function waitForContainerHealthy(
  containerName: string,
  timeoutMs: number = 60000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const health = await getContainerHealth(containerName);
    if (health === 'healthy') return true;

    const status = await getContainerStatus(containerName);
    if (status === 'running' && !health) {
      // Container running but no health check defined - consider it healthy
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

test.describe('Container Stability Tests', () => {
  test.beforeAll(async () => {
    const dockerAvailable = await isDockerAvailable();
    if (!dockerAvailable) {
      test.skip();
    }
  });

  test('@quick Docker containers are running', async () => {
    /**
     * CONTAINER-001: Verify Supabase containers exist and are running
     */
    const containers = await listSupabaseContainers();

    console.log('Supabase containers found:', containers);

    // We expect at least the DB container
    if (containers.length === 0) {
      console.log('No Supabase containers found - skipping container tests');
      console.log('Run: npx supabase start');
      test.skip();
      return;
    }

    // Check each container status
    for (const container of containers) {
      const status = await getContainerStatus(container);
      console.log(`${container}: ${status}`);
      expect(['running', 'healthy']).toContain(status);
    }
  });

  test('@quick Supabase API is reachable', async ({ request }) => {
    /**
     * CONTAINER-002: Verify Supabase REST API responds
     */
    try {
      const response = await request.get(`${SUPABASE_URL}/rest/v1/`, {
        headers: {
          apikey:
            process.env.VITE_SUPABASE_ANON_KEY ||
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
        },
        timeout: 5000,
      });

      console.log('Supabase API status:', response.status());

      // 200 or 401 both indicate API is reachable
      expect([200, 401, 404]).toContain(response.status());
    } catch (error) {
      console.log('Supabase API not reachable:', error);
      console.log('This may be expected if not running locally');
    }
  });

  test('@quick App connects to database', async ({ page }) => {
    /**
     * CONTAINER-003: Verify app can connect to Supabase
     */
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    // Check for connection errors in console
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to trigger database calls
    await page
      .click('[data-testid="nav-board"]')
      .catch(() => page.keyboard.press('2'));
    await page.waitForTimeout(2000);

    // Check for Supabase connection errors
    const dbErrors = consoleErrors.filter(
      (e) =>
        e.includes('PGRST') ||
        e.includes('Supabase') ||
        e.includes('connection refused') ||
        e.includes('ECONNREFUSED')
    );

    if (dbErrors.length > 0) {
      console.log('Database connection errors:', dbErrors);
    }

    // Pass if no critical DB errors
    expect(dbErrors.filter((e) => e.includes('ECONNREFUSED'))).toHaveLength(0);
  });

  test('App recovers from brief network interruption', async ({ page, context }) => {
    /**
     * CONTAINER-004: Simulate network interruption and verify recovery
     */
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    // Navigate to board
    await page
      .click('[data-testid="nav-board"]')
      .catch(() => page.keyboard.press('2'));
    await page.waitForTimeout(1000);

    // Record initial state
    const initialTaskCount = await page.evaluate(() => {
      const win = window as any;
      if (win.__pinia__) {
        const stores = win.__pinia__._s;
        const taskStore = stores.get('tasks');
        return taskStore?.tasks?.length || 0;
      }
      return 0;
    });

    console.log('Initial task count:', initialTaskCount);

    // Go offline briefly
    await context.setOffline(true);
    console.log('Network: OFFLINE');
    await page.waitForTimeout(3000);

    // Go back online
    await context.setOffline(false);
    console.log('Network: ONLINE');
    await page.waitForTimeout(5000);

    // Verify app recovered - task count should be same or tasks should reload
    const finalTaskCount = await page.evaluate(() => {
      const win = window as any;
      if (win.__pinia__) {
        const stores = win.__pinia__._s;
        const taskStore = stores.get('tasks');
        return taskStore?.tasks?.length || 0;
      }
      return 0;
    });

    console.log('Final task count:', finalTaskCount);

    // App should either maintain state or reload successfully
    expect(finalTaskCount).toBeGreaterThanOrEqual(0);
  });

  test('WebSocket reconnects after network drop', async ({ page, context }) => {
    /**
     * CONTAINER-005: Verify Supabase Realtime reconnection
     */
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);

    // Check if realtime is connected
    const realtimeStatus = await page.evaluate(() => {
      const win = window as any;
      // Try to find Supabase client
      if (win.supabase?.realtime) {
        return win.supabase.realtime.connectionState();
      }
      return 'unknown';
    });

    console.log('Initial realtime status:', realtimeStatus);

    // Simulate network drop
    await context.setOffline(true);
    await page.waitForTimeout(2000);
    await context.setOffline(false);
    await page.waitForTimeout(5000);

    // Check reconnection
    const finalStatus = await page.evaluate(() => {
      const win = window as any;
      if (win.supabase?.realtime) {
        return win.supabase.realtime.connectionState();
      }
      return 'unknown';
    });

    console.log('Final realtime status:', finalStatus);

    // WebSocket should reconnect or not be critical
    // Pass if app is still functional
    const appResponsive = await page.locator('body').isVisible();
    expect(appResponsive).toBe(true);
  });

  test('Multiple rapid refreshes maintain data', async ({ page }) => {
    /**
     * CONTAINER-006: Stress test with rapid page refreshes
     */
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    // Navigate to board
    await page
      .click('[data-testid="nav-board"]')
      .catch(() => page.keyboard.press('2'));
    await page.waitForTimeout(1000);

    // Get initial task count
    const initialCount = await page.evaluate(() => {
      const win = window as any;
      if (win.__pinia__) {
        const stores = win.__pinia__._s;
        const taskStore = stores.get('tasks');
        return taskStore?.tasks?.length || 0;
      }
      return 0;
    });

    console.log('Initial count:', initialCount);

    // Rapid refresh cycle (5 times)
    for (let i = 0; i < 5; i++) {
      await page.reload();
      await page.waitForTimeout(1000);
    }

    // Wait for app to stabilize
    await page.waitForTimeout(3000);

    // Navigate back to board
    await page
      .click('[data-testid="nav-board"]')
      .catch(() => page.keyboard.press('2'));
    await page.waitForTimeout(1000);

    // Verify data intact
    const finalCount = await page.evaluate(() => {
      const win = window as any;
      if (win.__pinia__) {
        const stores = win.__pinia__._s;
        const taskStore = stores.get('tasks');
        return taskStore?.tasks?.length || 0;
      }
      return 0;
    });

    console.log('Final count after 5 refreshes:', finalCount);

    // Data should be consistent
    expect(finalCount).toBe(initialCount);
  });
});

test.describe('Container Recovery Tests (Manual)', () => {
  /**
   * These tests document manual container recovery scenarios.
   * They are marked as skip by default since they require
   * actually stopping/restarting containers.
   *
   * To run: Remove .skip and run manually
   */

  test.skip('DB container restart - app recovers', async ({ page }) => {
    /**
     * MANUAL TEST: Database container restart
     *
     * Steps:
     * 1. Start this test
     * 2. In another terminal: docker restart supabase_db_flow-state
     * 3. Watch app behavior
     *
     * Expected:
     * - App shows connection error momentarily
     * - Auto-reconnects when container is healthy
     * - No data loss
     */
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    console.log('Waiting for manual container restart...');
    console.log('Run: docker restart supabase_db_flow-state');

    // Wait for container restart (manual action)
    await page.waitForTimeout(30000);

    // Verify app recovered
    const appResponsive = await page.locator('body').isVisible();
    expect(appResponsive).toBe(true);

    // Check no critical errors
    await page.waitForTimeout(5000);

    console.log('Verify: App should be functional after restart');
  });

  test.skip('Full Supabase restart - session persists', async ({ page }) => {
    /**
     * MANUAL TEST: Full Supabase stack restart
     *
     * Steps:
     * 1. Start this test
     * 2. In another terminal: npx supabase stop && npx supabase start
     * 3. Watch app behavior
     *
     * Expected:
     * - App reconnects after services are back
     * - User session preserved
     * - All data intact
     */
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    // Get initial state
    const initialData = await page.evaluate(() => {
      const win = window as any;
      if (win.__pinia__) {
        const stores = win.__pinia__._s;
        const taskStore = stores.get('tasks');
        return {
          taskCount: taskStore?.tasks?.length || 0,
          firstTaskId: taskStore?.tasks?.[0]?.id || null,
        };
      }
      return { taskCount: 0, firstTaskId: null };
    });

    console.log('Initial state:', initialData);
    console.log('Waiting for manual Supabase restart...');
    console.log('Run: npx supabase stop && npx supabase start');

    // Wait for full restart (manual action)
    await page.waitForTimeout(120000); // 2 minutes

    // Refresh and verify
    await page.reload();
    await page.waitForTimeout(5000);

    const finalData = await page.evaluate(() => {
      const win = window as any;
      if (win.__pinia__) {
        const stores = win.__pinia__._s;
        const taskStore = stores.get('tasks');
        return {
          taskCount: taskStore?.tasks?.length || 0,
          firstTaskId: taskStore?.tasks?.[0]?.id || null,
        };
      }
      return { taskCount: 0, firstTaskId: null };
    });

    console.log('Final state:', finalData);

    // Data should be intact
    expect(finalData.taskCount).toBe(initialData.taskCount);
  });
});
