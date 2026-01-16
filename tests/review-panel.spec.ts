import { test, expect } from '@playwright/test';

test('Review panel has enhanced elements', async ({ page }) => {
  await page.goto('http://localhost:6010/kanban/index.html?view=orchestrator');
  await page.waitForLoadState('networkidle');

  // Check HTML elements exist
  const elements = await page.evaluate(() => ({
    statsGrid: !!document.getElementById('review-stats-grid'),
    branchesList: !!document.getElementById('review-branches-list'),
    commandsList: !!document.getElementById('review-commands-list'),
    totalTasks: !!document.getElementById('review-total-tasks'),
    pendingMerge: !!document.getElementById('review-pending-merge'),
  }));

  console.log('HTML Elements:', JSON.stringify(elements, null, 2));

  // Check JavaScript functions exist (core merge/discard/view functionality)
  const functions = await page.evaluate(() => ({
    mergeTask: typeof (window as any).mergeTask === 'function',
    discardTask: typeof (window as any).discardTask === 'function',
    viewTaskDiff: typeof (window as any).viewTaskDiff === 'function',
    updateExecutionStats: typeof (window as any).updateExecutionStats === 'function',
    addOrUpdateAgentCard: typeof (window as any).addOrUpdateAgentCard === 'function',
    addTaskReviewCard: typeof (window as any).addTaskReviewCard === 'function',
    copyCommand: typeof (window as any).copyCommand === 'function',
  }));

  console.log('Functions:', JSON.stringify(functions, null, 2));

  // All HTML elements should exist
  expect(elements.statsGrid).toBe(true);
  expect(elements.branchesList).toBe(true);
  expect(elements.commandsList).toBe(true);
  expect(elements.totalTasks).toBe(true);
  expect(elements.pendingMerge).toBe(true);

  // Core functions should exist
  expect(functions.mergeTask).toBe(true);
  expect(functions.discardTask).toBe(true);
  expect(functions.viewTaskDiff).toBe(true);
  expect(functions.addTaskReviewCard).toBe(true);
});

test('Execution panel has task tracking elements', async ({ page }) => {
  await page.goto('http://localhost:6010/kanban/index.html?view=orchestrator');
  await page.waitForLoadState('networkidle');

  // Check execution panel elements
  const elements = await page.evaluate(() => ({
    agentsGrid: !!document.getElementById('orch-agents-grid'),
    completedCount: !!document.getElementById('orch-completed-count'),
    runningCount: !!document.getElementById('orch-running-count'),
    pendingCount: !!document.getElementById('orch-pending-count'),
    taskReviewList: !!document.getElementById('task-review-list'),
  }));

  console.log('Execution Elements:', JSON.stringify(elements, null, 2));

  expect(elements.agentsGrid).toBe(true);
  expect(elements.completedCount).toBe(true);
  expect(elements.runningCount).toBe(true);
  expect(elements.taskReviewList).toBe(true);
});
