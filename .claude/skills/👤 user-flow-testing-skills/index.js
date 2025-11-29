/**
 * User Flow Testing Skill
 * Comprehensive testing for Pomo-Flow Vue.js application using Playwright
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class UserFlowTestingSkill {
  constructor() {
    this.name = 'User Flow Testing Skills';
    this.description = 'Comprehensive user flow testing with Playwright for Pomo-Flow application';
    this.version = '1.0.0';
    this.category = 'testing';

    this.testResults = [];
    this.reportData = {
      startTime: null,
      endTime: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      performanceMetrics: {},
      accessibilityIssues: [],
      recommendations: []
    };
  }

  /**
   * Execute the user flow testing skill
   */
  async execute(options = {}) {
    console.log('🚀 Starting User Flow Testing for Pomo-Flow...');

    try {
      this.reportData.startTime = new Date();

      // Ensure development server is running
      await this.ensureDevServer();

      // Run comprehensive test suites
      await this.runAllTestSuites(options);

      // Generate detailed report
      await this.generateReport();

      // Display summary
      this.displaySummary();

      return this.reportData;

    } catch (error) {
      console.error('❌ User flow testing failed:', error.message);
      throw error;
    }
  }

  /**
   * Ensure development server is running
   */
  async ensureDevServer() {
    console.log('🔧 Checking development server...');

    try {
      // Check if server is running on port 5546
      const response = await fetch('http://localhost:5546');
      if (response.ok) {
        console.log('✅ Development server is running');
        return;
      }
    } catch (error) {
      // Server not running, start it
      console.log('🚀 Starting development server...');
      execSync('npm run dev', { stdio: 'pipe' });

      // Wait for server to be ready
      await this.waitForServer();
    }
  }

  /**
   * Wait for development server to be ready
   */
  async waitForServer() {
    const maxWait = 30000; // 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        const response = await fetch('http://localhost:5546');
        if (response.ok) {
          console.log('✅ Development server is ready');
          return;
        }
      } catch (error) {
        // Server not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Development server failed to start within 30 seconds');
  }

  /**
   * Run all test suites
   */
  async runAllTestSuites(options) {
    console.log('🧪 Running comprehensive test suites...');

    const testSuites = [
      { name: 'Task Management Flows', command: 'npm run test:task-flows' },
      { name: 'Timer Workflows', command: 'npm run test:timer-flows' },
      { name: 'Navigation & Filtering', command: 'npm run test:navigation-flows' },
      { name: 'Canvas Interactions', command: 'npm run test:canvas-flows' },
      { name: 'Calendar Operations', command: 'npm run test:calendar-flows' },
      { name: 'Advanced Features', command: 'npm run test:advanced-flows' }
    ];

    for (const suite of testSuites) {
      console.log(`\n📋 Running ${suite.name}...`);

      try {
        const result = this.runTestSuite(suite);
        this.testResults.push(result);

        if (result.success) {
          console.log(`✅ ${suite.name} passed`);
        } else {
          console.log(`❌ ${suite.name} failed: ${result.error}`);
        }
      } catch (error) {
        console.error(`❌ ${suite.name} failed:`, error.message);
        this.testResults.push({
          name: suite.name,
          success: false,
          error: error.message,
          duration: 0
        });
      }
    }

    this.calculateTotals();
  }

  /**
   * Run a single test suite
   */
  runTestSuite(suite) {
    const startTime = Date.now();

    try {
      // Create test files if they don't exist
      this.createTestFiles();

      // Run the actual tests
      const output = execSync(suite.command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 120000 // 2 minutes timeout
      });

      const duration = Date.now() - startTime;

      return {
        name: suite.name,
        success: true,
        output: output,
        duration: duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        name: suite.name,
        success: false,
        error: error.message,
        output: error.stdout || '',
        duration: duration
      };
    }
  }

  /**
   * Create test files if they don't exist
   */
  createTestFiles() {
    const testDir = path.join(process.cwd(), 'tests', 'user-flows');

    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create task management tests
    this.createTaskManagementTests(testDir);

    // Create timer workflow tests
    this.createTimerWorkflowTests(testDir);

    // Create navigation tests
    this.createNavigationTests(testDir);

    // Create canvas interaction tests
    this.createCanvasTests(testDir);

    // Create calendar tests
    this.createCalendarTests(testDir);

    // Create advanced feature tests
    this.createAdvancedFeatureTests(testDir);
  }

  /**
   * Create task management test files
   */
  createTaskManagementTests(testDir) {
    const testContent = `
import { test, expect } from '@playwright/test';

test.describe('Task Management Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546');
    await page.waitForLoadState('networkidle');
  });

  test('quick task creation via sidebar', async ({ page }) => {
    // Click add task button
    await page.click('[data-testid="add-task-button"]');

    // Fill task title
    await page.fill('[data-testid="task-title-input"]', 'Test Task from Playwright');

    // Set priority
    await page.click('[data-testid="priority-medium"]');

    // Save task
    await page.click('[data-testid="save-task-button"]');

    // Verify task appears
    await expect(page.locator('[data-testid="task-card"]').first()).toContainText('Test Task from Playwright');
  });

  test('detailed task creation with all fields', async ({ page }) => {
    await page.click('[data-testid="add-task-button"]');

    // Fill all fields
    await page.fill('[data-testid="task-title-input"]', 'Detailed Test Task');
    await page.fill('[data-testid="task-description"]', 'This is a detailed test description');
    await page.fill('[data-testid="task-due-date"]', '2025-12-31');
    await page.selectOption('[data-testid="task-priority"]', 'high');

    await page.click('[data-testid="save-task-button"]');

    // Verify task details
    const taskCard = page.locator('[data-testid="task-card"]').first();
    await expect(taskCard).toContainText('Detailed Test Task');
    await expect(taskCard).toContainText('high');
  });

  test('task editing workflow', async ({ page }) => {
    // Create a task first
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Task to Edit');
    await page.click('[data-testid="save-task-button"]');

    // Edit the task
    await page.click('[data-testid="task-edit-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Edited Task Title');
    await page.click('[data-testid="save-task-button"]');

    // Verify changes
    await expect(page.locator('[data-testid="task-card"]').first()).toContainText('Edited Task Title');
  });

  test('task status changes', async ({ page }) => {
    // Create task
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Status Test Task');
    await page.click('[data-testid="save-task-button"]');

    // Change status to in progress
    await page.click('[data-testid="task-status-planned"]');
    await page.click('[data-testid="status-in-progress"]');

    // Verify status change
    const taskCard = page.locator('[data-testid="task-card"]').first();
    await expect(taskCard.locator('[data-testid="task-status"]')).toContainText('in_progress');
  });

  test('task deletion workflow', async ({ page }) => {
    // Create task
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Task to Delete');
    await page.click('[data-testid="save-task-button"]');

    // Delete task
    await page.click('[data-testid="task-delete-button"]');
    await page.click('[data-testid="confirm-delete"]');

    // Verify task is gone
    await expect(page.locator('[data-testid="task-card"]')).toHaveCount(0);
  });
});
`;

    fs.writeFileSync(path.join(testDir, 'task-management.spec.js'), testContent);
  }

  /**
   * Create timer workflow test files
   */
  createTimerWorkflowTests(testDir) {
    const testContent = `
import { test, expect } from '@playwright/test';

test.describe('Timer Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546');
    await page.waitForLoadState('networkidle');
  });

  test('start pomodoro session', async ({ page }) => {
    // Create a task first
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Timer Test Task');
    await page.click('[data-testid="save-task-button"]');

    // Start timer
    await page.click('[data-testid="timer-start-button"]');

    // Verify timer is running
    await expect(page.locator('[data-testid="timer-display"]')).toBeVisible();
    await expect(page.locator('[data-testid="timer-status"]')).toContainText('running');
  });

  test('pause and resume timer', async ({ page }) => {
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Pause Test Task');
    await page.click('[data-testid="save-task-button"]');

    // Start timer
    await page.click('[data-testid="timer-start-button"]');

    // Wait a bit then pause
    await page.waitForTimeout(2000);
    await page.click('[data-testid="timer-pause-button"]');

    // Verify paused state
    await expect(page.locator('[data-testid="timer-status"]')).toContainText('paused');

    // Resume
    await page.click('[data-testid="timer-resume-button"]');
    await expect(page.locator('[data-testid="timer-status"]')).toContainText('running');
  });

  test('complete pomodoro session', async ({ page }) => {
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Complete Test Task');
    await page.click('[data-testid="save-task-button"]');

    // Start and complete session (simulate completion)
    await page.click('[data-testid="timer-start-button"]');

    // Complete the session manually for testing
    await page.click('[data-testid="timer-complete-button"]');

    // Verify session completion
    await expect(page.locator('[data-testid="session-complete-message"]')).toBeVisible();
  });

  test('timer settings configuration', async ({ page }) => {
    // Open timer settings
    await page.click('[data-testid="timer-settings-button"]');

    // Change work duration
    await page.fill('[data-testid="work-duration-input"]', '30');

    // Save settings
    await page.click('[data-testid="save-settings-button"]');

    // Verify settings saved
    await expect(page.locator('[data-testid="settings-saved-message"]')).toBeVisible();
  });
});
`;

    fs.writeFileSync(path.join(testDir, 'timer-workflows.spec.js'), testContent);
  }

  /**
   * Create navigation test files
   */
  createNavigationTests(testDir) {
    const testContent = `
import { test, expect } from '@playwright/test';

test.describe('Navigation & Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546');
    await page.waitForLoadState('networkidle');
  });

  test('view switching between Board, Calendar, Canvas', async ({ page }) => {
    // Navigate to Calendar view
    await page.click('[data-testid="nav-calendar"]');
    await expect(page.locator('[data-testid="calendar-view"]')).toBeVisible();

    // Navigate to Canvas view
    await page.click('[data-testid="nav-canvas"]');
    await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible();

    // Navigate back to Board view
    await page.click('[data-testid="nav-board"]');
    await expect(page.locator('[data-testid="board-view"]')).toBeVisible();
  });

  test('search functionality', async ({ page }) => {
    // Create some test tasks
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Searchable Task One');
    await page.click('[data-testid="save-task-button"]');

    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Another Task');
    await page.click('[data-testid="save-task-button"]');

    // Use search
    await page.fill('[data-testid="search-input"]', 'Searchable');

    // Verify search results
    await expect(page.locator('[data-testid="task-card"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="task-card"]').first()).toContainText('Searchable Task One');
  });

  test('filter by status', async ({ page }) => {
    // Create tasks with different statuses
    await this.createTaskWithStatus(page, 'Planned Task', 'planned');
    await this.createTaskWithStatus(page, 'Done Task', 'done');

    // Filter by planned status
    await page.click('[data-testid="filter-status"]');
    await page.click('[data-testid="filter-planned"]');

    // Verify only planned tasks shown
    await expect(page.locator('[data-testid="task-card"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="task-card"]').first()).toContainText('Planned Task');
  });

  test('filter by priority', async ({ page }) => {
    // Create tasks with different priorities
    await this.createTaskWithPriority(page, 'High Priority Task', 'high');
    await this.createTaskWithPriority(page, 'Low Priority Task', 'low');

    // Filter by high priority
    await page.click('[data-testid="filter-priority"]');
    await page.click('[data-testid="filter-high"]');

    // Verify only high priority tasks shown
    await expect(page.locator('[data-testid="task-card"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="task-card"]').first()).toContainText('High Priority Task');
  });
});

// Helper functions
async function createTaskWithStatus(page, title, status) {
  await page.click('[data-testid="add-task-button"]');
  await page.fill('[data-testid="task-title-input"]', title);
  await page.selectOption('[data-testid="task-status"]', status);
  await page.click('[data-testid="save-task-button"]');
}

async function createTaskWithPriority(page, title, priority) {
  await page.click('[data-testid="add-task-button"]');
  await page.fill('[data-testid="task-title-input"]', title);
  await page.selectOption('[data-testid="task-priority"]', priority);
  await page.click('[data-testid="save-task-button"]');
}
`;

    fs.writeFileSync(path.join(testDir, 'navigation.spec.js'), testContent);
  }

  /**
   * Create canvas interaction test files
   */
  createCanvasTests(testDir) {
    const testContent = `
import { test, expect } from '@playwright/test';

test.describe('Canvas Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546');
    await page.waitForLoadState('networkidle');

    // Navigate to canvas view
    await page.click('[data-testid="nav-canvas"]');
    await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible();
  });

  test('create task node on canvas', async ({ page }) => {
    // Right click on canvas to create task
    await page.click('[data-testid="canvas-area"]', { button: 'right' });
    await page.click('[data-testid="create-task-here"]');

    // Fill task details
    await page.fill('[data-testid="canvas-task-title"]', 'Canvas Task');
    await page.click('[data-testid="canvas-task-save"]');

    // Verify task node appears
    await expect(page.locator('[data-testid="canvas-task-node"]')).toBeVisible();
    await expect(page.locator('[data-testid="canvas-task-node"]')).toContainText('Canvas Task');
  });

  test('drag task node on canvas', async ({ page }) => {
    // Create a task first
    await page.click('[data-testid="canvas-area"]', { button: 'right' });
    await page.click('[data-testid="create-task-here"]');
    await page.fill('[data-testid="canvas-task-title"]', 'Draggable Task');
    await page.click('[data-testid="canvas-task-save"]');

    // Get initial position
    const taskNode = page.locator('[data-testid="canvas-task-node"]');
    const initialBox = await taskNode.boundingBox();

    // Drag the task node
    await taskNode.dragTo(page.locator('[data-testid="canvas-area"]'), {
      targetPosition: { x: initialBox.x + 200, y: initialBox.y + 200 }
    });

    // Verify new position
    const newBox = await taskNode.boundingBox();
    expect(newBox.x).toBeGreaterThan(initialBox.x);
    expect(newBox.y).toBeGreaterThan(initialBox.y);
  });

  test('create connection between task nodes', async ({ page }) => {
    // Create two tasks
    await page.click('[data-testid="canvas-area"]', { button: 'right' });
    await page.click('[data-testid="create-task-here"]');
    await page.fill('[data-testid="canvas-task-title"]', 'Parent Task');
    await page.click('[data-testid="canvas-task-save"]');

    await page.click('[data-testid="canvas-area"]', { button: 'right' });
    await page.click('[data-testid="create-task-here"]');
    await page.fill('[data-testid="canvas-task-title"]', 'Child Task');
    await page.click('[data-testid="canvas-task-save"]');

    // Create connection
    const parentTask = page.locator('[data-testid="canvas-task-node"]').first();
    const childTask = page.locator('[data-testid="canvas-task-node"]').last();

    await parentTask.hover();
    await page.click('[data-testid="connection-handle"]');
    await childTask.click();

    // Verify connection created
    await expect(page.locator('[data-testid="task-connection"]')).toBeVisible();
  });

  test('section collapse and expand', async ({ page }) => {
    // Find a section and collapse it
    const section = page.locator('[data-testid="canvas-section"]').first();
    await section.locator('[data-testid="section-collapse-button"]').click();

    // Verify section is collapsed
    await expect(section.locator('[data-testid="section-content"]')).not.toBeVisible();

    // Expand section
    await section.locator('[data-testid="section-expand-button"]').click();

    // Verify section is expanded
    await expect(section.locator('[data-testid="section-content"]')).toBeVisible();
  });
});
`;

    fs.writeFileSync(path.join(testDir, 'canvas-interactions.spec.js'), testContent);
  }

  /**
   * Create calendar test files
   */
  createCalendarTests(testDir) {
    const testContent = `
import { test, expect } from '@playwright/test';

test.describe('Calendar Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546');
    await page.waitForLoadState('networkidle');

    // Navigate to calendar view
    await page.click('[data-testid="nav-calendar"]');
    await expect(page.locator('[data-testid="calendar-view"]')).toBeVisible();
  });

  test('navigate calendar dates', async ({ page }) => {
    // Get current date display
    const currentDate = await page.locator('[data-testid="current-date"]').textContent();

    // Navigate to next month
    await page.click('[data-testid="calendar-next-month"]');

    // Verify date changed
    const newDate = await page.locator('[data-testid="current-date"]').textContent();
    expect(newDate).not.toBe(currentDate);

    // Navigate back
    await page.click('[data-testid="calendar-prev-month"]');

    // Verify date restored
    const restoredDate = await page.locator('[data-testid="current-date"]').textContent();
    expect(restoredDate).toBe(currentDate);
  });

  test('schedule task on specific date', async ({ page }) => {
    // Create a task first
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Scheduled Task');
    await page.click('[data-testid="save-task-button"]');

    // Drag task to calendar date
    const taskCard = page.locator('[data-testid="task-card"]').first();
    const calendarDate = page.locator('[data-testid="calendar-date"]').first();

    await taskCard.dragTo(calendarDate);

    // Verify task appears on calendar
    await expect(calendarDate.locator('[data-testid="calendar-task"]')).toContainText('Scheduled Task');
  });

  test('click calendar date to schedule', async ({ page }) => {
    // Click on a calendar date
    const calendarDate = page.locator('[data-testid="calendar-date"]').first();
    await calendarDate.click();

    // Fill scheduling modal
    await page.fill('[data-testid="schedule-task-title"]', 'Click Scheduled Task');
    await page.fill('[data-testid="schedule-task-time"]', '14:00');
    await page.click('[data-testid="schedule-save-button"]');

    // Verify task on calendar
    await expect(calendarDate.locator('[data-testid="calendar-task"]')).toContainText('Click Scheduled Task');
  });

  test('recurring task creation', async ({ page }) => {
    // Create task with recurrence
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Recurring Task');
    await page.click('[data-testid="task-recurrence-toggle"]');
    await page.selectOption('[data-testid="recurrence-pattern"]', 'daily');
    await page.click('[data-testid="save-task-button"]');

    // Drag to calendar
    const taskCard = page.locator('[data-testid="task-card"]').first();
    const calendarDate = page.locator('[data-testid="calendar-date"]').first();

    await taskCard.dragTo(calendarDate);

    // Verify recurring indicator
    await expect(calendarDate.locator('[data-testid="calendar-task"]')).toHaveClass(/recurring/);
  });

  test('calendar view switching', async ({ page }) => {
    // Switch to week view
    await page.click('[data-testid="calendar-view-week"]');
    await expect(page.locator('[data-testid="week-view"]')).toBeVisible();

    // Switch to month view
    await page.click('[data-testid="calendar-view-month"]');
    await expect(page.locator('[data-testid="month-view"]')).toBeVisible();

    // Switch to day view
    await page.click('[data-testid="calendar-view-day"]');
    await expect(page.locator('[data-testid="day-view"]')).toBeVisible();
  });
});
`;

    fs.writeFileSync(path.join(testDir, 'calendar-operations.spec.js'), testContent);
  }

  /**
   * Create advanced feature test files
   */
  createAdvancedFeatureTests(testDir) {
    const testContent = `
import { test, expect } from '@playwright/test';

test.describe('Advanced Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546');
    await page.waitForLoadState('networkidle');
  });

  test('undo operation after task creation', async ({ page }) => {
    // Create a task
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Undo Test Task');
    await page.click('[data-testid="save-task-button"]');

    // Verify task exists
    await expect(page.locator('[data-testid="task-card"]')).toHaveCount(1);

    // Undo task creation
    await page.keyboard.press('Control+z');

    // Verify task is gone
    await expect(page.locator('[data-testid="task-card"]')).toHaveCount(0);
  });

  test('redo operation after undo', async ({ page }) => {
    // Create and undo a task
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Redo Test Task');
    await page.click('[data-testid="save-task-button"]');

    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-testid="task-card"]')).toHaveCount(0);

    // Redo task creation
    await page.keyboard.press('Control+y');

    // Verify task is back
    await expect(page.locator('[data-testid="task-card"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="task-card"]').first()).toContainText('Redo Test Task');
  });

  test('bulk task operations', async ({ page }) => {
    // Create multiple tasks
    for (let i = 1; i <= 3; i++) {
      await page.click('[data-testid="add-task-button"]');
      await page.fill('[data-testid="task-title-input"]', \`Bulk Task \${i}\`);
      await page.click('[data-testid="save-task-button"]');
    }

    // Select all tasks
    await page.click('[data-testid="select-all-tasks"]');

    // Change status for all selected
    await page.click('[data-testid="bulk-status-change"]');
    await page.click('[data-testid="bulk-status-done"]');

    // Verify all tasks have done status
    const taskCards = page.locator('[data-testid="task-card"]');
    const count = await taskCards.count();

    for (let i = 0; i < count; i++) {
      await expect(taskCards.nth(i).locator('[data-testid="task-status"]')).toContainText('done');
    }
  });

  test('cross-view consistency', async ({ page }) => {
    // Create task in board view
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Consistency Test Task');
    await page.click('[data-testid="save-task-button"]');

    // Navigate to canvas view
    await page.click('[data-testid="nav-canvas"]');

    // Verify task exists in canvas view
    await expect(page.locator('[data-testid="canvas-task-node"]')).toContainText('Consistency Test Task');

    // Navigate to calendar view
    await page.click('[data-testid="nav-calendar"]');

    // Search for task in calendar view
    await page.fill('[data-testid="search-input"]', 'Consistency Test Task');

    // Verify task appears in search results
    await expect(page.locator('[data-testid="search-result"]')).toContainText('Consistency Test Task');
  });

  test('data persistence across browser refresh', async ({ page }) => {
    // Create task
    await page.click('[data-testid="add-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'Persistence Test Task');
    await page.click('[data-testid="save-task-button"]');

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify task still exists
    await expect(page.locator('[data-testid="task-card"]')).toContainText('Persistence Test Task');
  });

  test('keyboard shortcuts and accessibility', async ({ page }) => {
    // Test keyboard shortcut for adding task (Cmd/Ctrl + K)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');

    // Verify quick add modal appears
    await expect(page.locator('[data-testid="quick-add-modal"]')).toBeVisible();

    // Add task using keyboard
    await page.fill('[data-testid="quick-add-input"]', 'Keyboard Shortcut Task');
    await page.keyboard.press('Enter');

    // Verify task created
    await expect(page.locator('[data-testid="task-card"]').first()).toContainText('Keyboard Shortcut Task');

    // Test tab navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="task-card"]').first()).toBeFocused();
  });
});
`;

    fs.writeFileSync(path.join(testDir, 'advanced-features.spec.js'), testContent);
  }

  /**
   * Calculate total test results
   */
  calculateTotals() {
    this.reportData.totalTests = this.testResults.length;
    this.reportData.passedTests = this.testResults.filter(r => r.success).length;
    this.reportData.failedTests = this.testResults.filter(r => !r.success).length;
    this.reportData.endTime = new Date();

    // Calculate total duration
    this.reportData.totalDuration = this.testResults.reduce((total, result) => total + result.duration, 0);

    // Analyze failures and create recommendations
    this.analyzeFailures();
  }

  /**
   * Analyze test failures and create recommendations
   */
  analyzeFailures() {
    const failures = this.testResults.filter(r => !r.success);

    failures.forEach(failure => {
      const recommendation = this.generateRecommendation(failure);
      if (recommendation) {
        this.reportData.recommendations.push(recommendation);
      }
    });
  }

  /**
   * Generate fix recommendation for a failure
   */
  generateRecommendation(failure) {
    const recommendations = {
      'timeout': {
        issue: 'Performance timeout detected',
        severity: 'high',
        fix: 'Consider optimizing performance or increasing timeout values',
        code: '// Increase timeout in test configuration\nnpx playwright test --timeout=60000'
      },
      'element not found': {
        issue: 'UI element not found',
        severity: 'medium',
        fix: 'Check if data-testid attributes are properly set on elements',
        code: '// Add data-testid to Vue component\n<button data-testid="add-task-button">Add Task</button>'
      },
      'network': {
        issue: 'Network connection issues',
        severity: 'medium',
        fix: 'Ensure development server is running and accessible',
        code: 'npm run dev  # Start development server before running tests'
      }
    };

    // Simple pattern matching for common issues
    for (const [pattern, rec] of Object.entries(recommendations)) {
      if (failure.error?.toLowerCase().includes(pattern)) {
        return {
          testSuite: failure.name,
          ...rec,
          error: failure.error
        };
      }
    }

    return {
      testSuite: failure.name,
      issue: 'Unknown test failure',
      severity: 'medium',
      fix: 'Review test logs and debug the specific failure scenario',
      error: failure.error,
      code: '// Debug with Playwright Inspector\nnpx playwright test --debug'
    };
  }

  /**
   * Generate detailed HTML report
   */
  async generateReport() {
    const reportDir = path.join(process.cwd(), 'docs', 'reports');

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const htmlReport = this.generateHTMLReport();
    const jsonReport = JSON.stringify(this.reportData, null, 2);

    const htmlFileName = `user-flow-report-${timestamp}.html`;
    const jsonFileName = `user-flow-report-${timestamp}.json`;

    fs.writeFileSync(path.join(reportDir, htmlFileName), htmlReport);
    fs.writeFileSync(path.join(reportDir, jsonFileName), jsonReport);

    // Also create latest symlinks/copies for easy access
    fs.writeFileSync(path.join(reportDir, 'user-flow-report-latest.html'), htmlReport);
    fs.writeFileSync(path.join(reportDir, 'user-flow-report-latest.json'), jsonReport);

    console.log(`\n📊 Reports generated:`);
    console.log(`   📄 HTML: ${path.join(reportDir, htmlFileName)}`);
    console.log(`   📄 JSON: ${path.join(reportDir, jsonFileName)}`);
    console.log(`   🔗 Latest: ${path.join(reportDir, 'user-flow-report-latest.html')}`);
  }

  /**
   * Generate HTML report content
   */
  generateHTMLReport() {
    const passRate = this.reportData.totalTests > 0
      ? Math.round((this.reportData.passedTests / this.reportData.totalTests) * 100)
      : 0;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Flow Testing Report - Pomo-Flow</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #667eea; }
        .metric-value { font-size: 2em; font-weight: bold; color: #667eea; }
        .metric-label { color: #666; margin-top: 5px; }
        .test-results { margin-top: 30px; }
        .test-item { background: #f8f9fa; margin-bottom: 15px; padding: 15px; border-radius: 8px; border-left: 4px solid #ddd; }
        .test-item.passed { border-left-color: #28a745; }
        .test-item.failed { border-left-color: #dc3545; }
        .test-name { font-weight: bold; margin-bottom: 10px; }
        .test-duration { color: #666; font-size: 0.9em; }
        .recommendations { margin-top: 30px; }
        .recommendation { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-bottom: 15px; }
        .recommendation.high { background: #f8d7da; border-color: #f5c6cb; }
        .recommendation.medium { background: #fff3cd; border-color: #ffeaa7; }
        .recommendation.low { background: #d1ecf1; border-color: #bee5eb; }
        .code-block { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 15px; font-family: 'Monaco', 'Consolas', monospace; font-size: 0.9em; overflow-x: auto; margin-top: 10px; }
        .severity-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; text-transform: uppercase; }
        .severity-high { background: #dc3545; color: white; }
        .severity-medium { background: #ffc107; color: black; }
        .severity-low { background: #17a2b8; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 User Flow Testing Report</h1>
            <p>Pomo-Flow Vue.js Application - Comprehensive User Flow Analysis</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="content">
            <div class="metrics">
                <div class="metric">
                    <div class="metric-value">${this.reportData.totalTests}</div>
                    <div class="metric-label">Total Test Suites</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${this.reportData.passedTests}</div>
                    <div class="metric-label">Passed</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${this.reportData.failedTests}</div>
                    <div class="metric-label">Failed</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${passRate}%</div>
                    <div class="metric-label">Pass Rate</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${Math.round(this.reportData.totalDuration / 1000)}s</div>
                    <div class="metric-label">Total Duration</div>
                </div>
            </div>

            <div class="test-results">
                <h2>📋 Test Results</h2>
                ${this.testResults.map(result => `
                    <div class="test-item ${result.success ? 'passed' : 'failed'}">
                        <div class="test-name">
                            ${result.success ? '✅' : '❌'} ${result.name}
                        </div>
                        <div class="test-duration">Duration: ${Math.round(result.duration / 1000)}s</div>
                        ${result.error ? `<div class="test-error">Error: ${result.error}</div>` : ''}
                    </div>
                `).join('')}
            </div>

            ${this.reportData.recommendations.length > 0 ? `
                <div class="recommendations">
                    <h2>🔧 Fix Recommendations</h2>
                    ${this.reportData.recommendations.map(rec => `
                        <div class="recommendation ${rec.severity}">
                            <div class="test-name">
                                <span class="severity-badge severity-${rec.severity}">${rec.severity}</span>
                                ${rec.issue}
                            </div>
                            <p><strong>Test Suite:</strong> ${rec.testSuite}</p>
                            <p><strong>Fix:</strong> ${rec.fix}</p>
                            ${rec.code ? `
                                <div class="code-block">${rec.code}</div>
                            ` : ''}
                            ${rec.error ? `<p><strong>Error Details:</strong> ${rec.error}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Display summary to console
   */
  displaySummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 USER FLOW TESTING SUMMARY');
    console.log('='.repeat(60));
    console.log(`📊 Total Test Suites: ${this.reportData.totalTests}`);
    console.log(`✅ Passed: ${this.reportData.passedTests}`);
    console.log(`❌ Failed: ${this.reportData.failedTests}`);
    console.log(`⏱️  Total Duration: ${Math.round(this.reportData.totalDuration / 1000)}s`);

    if (this.reportData.recommendations.length > 0) {
      console.log(`\n🔧 ${this.reportData.recommendations.length} Fix Recommendations Available`);
      console.log('📄 Check the HTML report for detailed fix instructions');
    }

    const passRate = this.reportData.totalTests > 0
      ? Math.round((this.reportData.passedTests / this.reportData.totalTests) * 100)
      : 0;

    console.log(`\n📈 Pass Rate: ${passRate}%`);

    if (passRate === 100) {
      console.log('🎉 All user flow tests passed! Your application is working perfectly.');
    } else if (passRate >= 80) {
      console.log('👍 Good results! A few issues to address for optimal performance.');
    } else {
      console.log('⚠️  Several issues detected. Review the recommendations for fixes.');
    }

    console.log('='.repeat(60));
  }
}

export default UserFlowTestingSkill;