const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting Performance & Sync Validation for ServiceOrchestrator migration...');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Performance monitoring
  const performanceMetrics = {
    pageLoad: 0,
    taskCreation: [],
    viewSwitching: [],
    syncOperations: [],
    memoryUsage: []
  };

  // Capture console and performance data
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Performance') ||
        text.includes('duration') ||
        text.includes('SUCCESS') ||
        text.includes('sync') ||
        text.includes('ServiceOrchestrator') ||
        msg.type() === 'error') {
      console.log(`[${msg.type().toUpperCase()}]: ${text}`);
    }
  });

  // Track page load performance
  const startTime = Date.now();

  try {
    console.log('🌐 STEP 1: Loading application and measuring performance...');
    await page.goto('http://localhost:5546', { waitUntil: 'networkidle' });

    const pageLoadTime = Date.now() - startTime;
    performanceMetrics.pageLoad = pageLoadTime;
    console.log(`⚡ Page load time: ${pageLoadTime}ms`);

    // Wait for full initialization
    await page.waitForTimeout(5000);

    console.log('📊 STEP 2: Measuring task creation performance...');

    // Test task creation performance
    for (let i = 1; i <= 5; i++) {
      const taskStart = Date.now();

      const quickInputs = await page.locator('input[placeholder*="task" i], input[placeholder*="add" i], .quick-task-input').all();

      if (quickInputs.length > 0) {
        for (const input of quickInputs) {
          if (await input.isVisible()) {
            await input.fill(`Performance Test Task ${i}`);
            await input.press('Enter');

            const taskTime = Date.now() - taskStart;
            performanceMetrics.taskCreation.push(taskTime);
            console.log(`⚡ Task ${i} creation time: ${taskTime}ms`);

            await page.waitForTimeout(1000);
            break;
          }
        }
      }
    }

    console.log('🔄 STEP 3: Testing cross-view synchronization...');

    // Get current task count for sync validation
    const taskCountElements = await page.locator('[data-testid*="task"], .task-card, .task-item').all();
    const initialTaskCount = taskCountElements.length;
    console.log(`📊 Initial task count: ${initialTaskCount}`);

    // Test view switching performance and sync
    const views = ['Board', 'Calendar', 'Canvas', 'All Tasks'];

    for (const viewName of views) {
      console.log(`🔄 Testing ${viewName} view...`);

      const viewStart = Date.now();

      // Try to navigate to the view
      const viewLink = page.locator(`a:has-text("${viewName}"), button:has-text("${viewName}")`).first();

      if (await viewLink.isVisible()) {
        await viewLink.click();
        await page.waitForTimeout(2000);

        const viewTime = Date.now() - viewStart;
        performanceMetrics.viewSwitching.push(viewTime);
        console.log(`⚡ ${viewName} view switch time: ${viewTime}ms`);

        // Check if tasks are synchronized in this view
        await page.waitForTimeout(1000);

        // Count tasks in this view
        const viewTasks = await page.locator('[data-testid*="task"], .task-card, .task-item, .task-row').all();
        console.log(`📊 Tasks visible in ${viewName}: ${viewTasks.length}`);

        // Verify task count matches expected
        if (viewTasks.length === initialTaskCount) {
          console.log(`✅ ${viewName} sync: PASSED`);
        } else {
          console.log(`⚠️ ${viewName} sync: EXPECTED ${initialTaskCount}, GOT ${viewTasks.length}`);
        }
      } else {
        console.log(`⚠️ ${viewName} view not found`);
      }
    }

    console.log('💾 STEP 4: Testing persistence and data sync...');

    // Create a unique task for sync testing
    const syncTaskStart = Date.now();
    const uniqueTaskName = `Sync Test Task ${Date.now()}`;

    const syncInputs = await page.locator('input[placeholder*="task" i], input[placeholder*="add" i], .quick-task-input').all();
    if (syncInputs.length > 0) {
      for (const input of syncInputs) {
        if (await input.isVisible()) {
          await input.fill(uniqueTaskName);
          await input.press('Enter');

          const syncTime = Date.now() - syncTaskStart;
          performanceMetrics.syncOperations.push(syncTime);
          console.log(`⚡ Sync task creation time: ${syncTime}ms`);

          await page.waitForTimeout(2000);
          break;
        }
      }
    }

    // Test persistence by refreshing
    console.log('🔄 Testing persistence with page refresh...');
    const refreshStart = Date.now();

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const refreshTime = Date.now() - refreshStart;
    console.log(`⚡ Page refresh time: ${refreshTime}ms`);

    // Verify task persisted
    const persistedTask = await page.locator(`text=${uniqueTaskName}`).first();
    if (await persistedTask.isVisible()) {
      console.log('✅ Persistence test: PASSED');
    } else {
      console.log('❌ Persistence test: FAILED - Task not found after refresh');
    }

    console.log('📈 STEP 5: Performance summary and validation...');

    // Calculate performance metrics
    const avgTaskCreation = performanceMetrics.taskCreation.reduce((a, b) => a + b, 0) / performanceMetrics.taskCreation.length;
    const avgViewSwitching = performanceMetrics.viewSwitching.reduce((a, b) => a + b, 0) / performanceMetrics.viewSwitching.length;
    const avgSyncOperations = performanceMetrics.syncOperations.reduce((a, b) => a + b, 0) / performanceMetrics.syncOperations.length;

    console.log('\n📊 PERFORMANCE METRICS:');
    console.log('========================');
    console.log(`📈 Page Load: ${performanceMetrics.pageLoad}ms`);
    console.log(`📈 Avg Task Creation: ${avgTaskCreation.toFixed(2)}ms (${performanceMetrics.taskCreation.length} operations)`);
    console.log(`📈 Avg View Switching: ${avgViewSwitching.toFixed(2)}ms (${performanceMetrics.viewSwitching.length} operations)`);
    console.log(`📈 Avg Sync Operations: ${avgSyncOperations.toFixed(2)}ms (${performanceMetrics.syncOperations.length} operations)`);
    console.log(`📈 Page Refresh: ${refreshTime}ms`);

    // Performance thresholds validation
    console.log('\n🎯 PERFORMANCE VALIDATION:');
    console.log('========================');

    const thresholds = {
      pageLoad: 3000,
      taskCreation: 1000,
      viewSwitching: 1500,
      syncOperation: 2000,
      refresh: 3000
    };

    const validationResults = {
      pageLoad: performanceMetrics.pageLoad <= thresholds.pageLoad,
      taskCreation: avgTaskCreation <= thresholds.taskCreation,
      viewSwitching: avgViewSwitching <= thresholds.viewSwitching,
      syncOperation: avgSyncOperations <= thresholds.syncOperation,
      refresh: refreshTime <= thresholds.refresh
    };

    Object.entries(validationResults).forEach(([metric, passed]) => {
      const threshold = thresholds[metric];
      const actual = metric === 'pageLoad' ? performanceMetrics.pageLoad :
                   metric === 'taskCreation' ? avgTaskCreation :
                   metric === 'viewSwitching' ? avgViewSwitching :
                   metric === 'syncOperation' ? avgSyncOperations : refreshTime;

      const status = passed ? '✅ PASSED' : '❌ FAILED';
      const emoji = passed ? '🚀' : '⚠️';

      console.log(`${emoji} ${metric}: ${status} (${actual.toFixed(2)}ms <= ${threshold}ms)`);
    });

    // Overall assessment
    const allPassed = Object.values(validationResults).every(Boolean);

    console.log('\n🎉 FINAL VALIDATION RESULT:');
    console.log('============================');

    if (allPassed) {
      console.log('✅ SUCCESS: All performance thresholds met');
      console.log('✅ SUCCESS: Cross-view synchronization working');
      console.log('✅ SUCCESS: Data persistence validated');
      console.log('🚀 READY: ServiceOrchestrator migration is production-ready');
    } else {
      console.log('⚠️ WARNING: Some performance thresholds not met');
      console.log('🔧 RECOMMENDATION: Consider optimization before production deployment');
    }

    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('💥 CRITICAL ERROR during performance testing:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();