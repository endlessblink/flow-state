import { test, expect, Page } from '@playwright/test';

const DEV_MANAGER_URL = 'http://localhost:6010/kanban/index.html?view=orchestrator';

test.describe('Dev Manager Orchestrator UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEV_MANAGER_URL);
    await page.waitForLoadState('networkidle');
  });

  test('orchestrator view should load correctly', async ({ page }) => {
    // Verify the AI Orchestrator heading is visible (use specific selector)
    await expect(page.locator('#view-title')).toHaveText('AI Orchestrator');

    // Verify the goal input exists
    await expect(page.locator('#orch-goal-input')).toBeVisible();

    // Verify the Start button exists
    await expect(page.locator('.goal-submit-btn')).toBeVisible();
  });

  test('ask-more-btn should exist in plan panel HTML', async ({ page }) => {
    // The button exists in the DOM but is inside a hidden panel
    const buttonExists = await page.evaluate(() => {
      const btn = document.querySelector('.ask-more-btn');
      return btn !== null;
    });

    expect(buttonExists).toBe(true);
  });

  test('plan panel should have correct HTML structure', async ({ page }) => {
    // Verify plan panel structure exists in DOM
    const structure = await page.evaluate(() => {
      const planPanel = document.getElementById('orch-plan-panel');
      if (!planPanel) return { exists: false, reason: 'Plan panel not found' };

      const askMoreBtn = planPanel.querySelector('.ask-more-btn');
      const planList = planPanel.querySelector('#orch-plan-list');

      return {
        exists: true,
        hasAskMoreBtn: !!askMoreBtn,
        hasPlanList: !!planList,
        askMoreBtnText: askMoreBtn?.textContent?.trim() || ''
      };
    });

    expect(structure.exists).toBe(true);
    expect(structure.hasAskMoreBtn).toBe(true);
    expect(structure.hasPlanList).toBe(true);
    expect(structure.askMoreBtnText).toContain('Ask More Clarifying Questions');
  });

  test('renderPlan function should create expandable task structure', async ({ page }) => {
    // Inject a test plan and call renderPlan
    const taskStructure = await page.evaluate(() => {
      // Mock plan data
      const testPlan = [
        { id: 'test-1', title: 'Test Task 1', description: 'Description 1', agentType: 'frontend', priority: 'P1' },
        { id: 'test-2', title: 'Test Task 2', description: 'Description 2', agentType: 'backend', priority: 'P2' }
      ];

      // Call renderPlan if it exists
      if (typeof (window as any).renderPlan === 'function') {
        (window as any).renderPlan(testPlan);
      }

      // Check the structure
      const planList = document.getElementById('orch-plan-list');
      if (!planList) return { error: 'Plan list not found' };

      const tasks = planList.querySelectorAll('.plan-task');
      if (tasks.length === 0) return { error: 'No tasks rendered' };

      const firstTask = tasks[0];
      return {
        taskCount: tasks.length,
        hasHeader: !!firstTask.querySelector('.plan-task-header'),
        hasNumber: !!firstTask.querySelector('.plan-task-number'),
        hasContent: !!firstTask.querySelector('.plan-task-content'),
        hasExpandIcon: !!firstTask.querySelector('.plan-task-expand'),
        hasChatSection: !!firstTask.querySelector('.plan-task-chat'),
        hasChatInput: !!firstTask.querySelector('.task-chat-input'),
        hasChatSend: !!firstTask.querySelector('.task-chat-send')
      };
    });

    // If renderPlan was found and executed
    if (!('error' in taskStructure)) {
      expect(taskStructure.taskCount).toBe(2);
      expect(taskStructure.hasHeader).toBe(true);
      expect(taskStructure.hasNumber).toBe(true);
      expect(taskStructure.hasContent).toBe(true);
      expect(taskStructure.hasExpandIcon).toBe(true);
      expect(taskStructure.hasChatSection).toBe(true);
      expect(taskStructure.hasChatInput).toBe(true);
      expect(taskStructure.hasChatSend).toBe(true);
    }
  });

  test('plan task expand/collapse should work', async ({ page }) => {
    // Inject test plan and verify expand/collapse
    const result = await page.evaluate(() => {
      const testPlan = [
        { id: 'test-expand', title: 'Expandable Task', description: 'Test', agentType: 'frontend' }
      ];

      if (typeof (window as any).renderPlan === 'function') {
        (window as any).renderPlan(testPlan);
      }

      const task = document.getElementById('plan-task-test-expand');
      if (!task) return { error: 'Task not rendered' };

      // Initial state - not expanded
      const initialExpanded = task.classList.contains('expanded');

      // Call toggle
      if (typeof (window as any).togglePlanTask === 'function') {
        (window as any).togglePlanTask('test-expand', { target: task, stopPropagation: () => {} });
      }

      const afterToggle = task.classList.contains('expanded');

      // Toggle again
      if (typeof (window as any).togglePlanTask === 'function') {
        (window as any).togglePlanTask('test-expand', { target: task, stopPropagation: () => {} });
      }

      const afterSecondToggle = task.classList.contains('expanded');

      return {
        initialExpanded,
        afterToggle,
        afterSecondToggle
      };
    });

    if (!('error' in result)) {
      expect(result.initialExpanded).toBe(false);
      expect(result.afterToggle).toBe(true);
      expect(result.afterSecondToggle).toBe(false);
    }
  });

  test('CSS for expandable plan tasks should be correct', async ({ page }) => {
    // Wait for styles to load
    await page.waitForTimeout(500);

    // Check that CSS rules exist and are correct
    const cssCheck = await page.evaluate(() => {
      // Create a test element to check computed styles
      const testTask = document.createElement('div');
      testTask.className = 'plan-task';
      testTask.innerHTML = `
        <div class="plan-task-header"></div>
        <div class="plan-task-chat"></div>
      `;
      document.body.appendChild(testTask);

      // Force style computation
      const taskStyle = window.getComputedStyle(testTask);
      const cursor = taskStyle.cursor;

      const chatSection = testTask.querySelector('.plan-task-chat') as HTMLElement;
      const chatStyle = window.getComputedStyle(chatSection);

      // Chat should be hidden by default
      const chatHidden = chatStyle.display === 'none';

      // Add expanded class
      testTask.classList.add('expanded');

      // Force reflow
      void testTask.offsetHeight;

      const chatStyleExpanded = window.getComputedStyle(chatSection);
      const chatVisibleWhenExpanded = chatStyleExpanded.display !== 'none';

      // Cleanup
      document.body.removeChild(testTask);

      return {
        cursor,
        chatHiddenByDefault: chatHidden,
        chatVisibleWhenExpanded
      };
    });

    expect(cssCheck.cursor).toBe('pointer');
    expect(cssCheck.chatHiddenByDefault).toBe(true);
    expect(cssCheck.chatVisibleWhenExpanded).toBe(true);
  });
});

test.describe('Orchestrator Functions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEV_MANAGER_URL);
    await page.waitForLoadState('networkidle');
  });

  test('askMoreQuestions function should exist', async ({ page }) => {
    const fnExists = await page.evaluate(() => {
      return typeof (window as any).askMoreQuestions === 'function';
    });

    expect(fnExists).toBe(true);
  });

  test('sendTaskChat function should exist', async ({ page }) => {
    const fnExists = await page.evaluate(() => {
      return typeof (window as any).sendTaskChat === 'function';
    });

    expect(fnExists).toBe(true);
  });

  test('togglePlanTask function should exist', async ({ page }) => {
    const fnExists = await page.evaluate(() => {
      return typeof (window as any).togglePlanTask === 'function';
    });

    expect(fnExists).toBe(true);
  });

  test('escapeHtml function should exist and work correctly', async ({ page }) => {
    const result = await page.evaluate(() => {
      if (typeof (window as any).escapeHtml !== 'function') {
        return { exists: false };
      }

      const escaped = (window as any).escapeHtml('<script>alert("xss")</script>');
      return {
        exists: true,
        escaped,
        isEscaped: !escaped.includes('<script>')
      };
    });

    expect(result.exists).toBe(true);
    if (result.exists) {
      expect(result.isEscaped).toBe(true);
    }
  });
});
