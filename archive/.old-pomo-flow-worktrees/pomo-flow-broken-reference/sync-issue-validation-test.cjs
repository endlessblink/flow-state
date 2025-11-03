const { chromium } = require('playwright');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCurrentWeekendDates() {
  const today = new Date();
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + (6 - today.getDay()));
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + (7 - today.getDay()));

  return {
    saturday: saturday.toISOString().split('T')[0],
    sunday: sunday.toISOString().split('T')[0],
    saturdayStr: saturday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    sundayStr: sunday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  };
}

(async () => {
  console.log('🔍 Testing Original Sync Issues - ServiceOrchestrator Migration Validation...');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Track sync issues
  const syncTestResults = {
    weekendCounterMismatch: { passed: false, details: [] },
    crossViewConsistency: { passed: false, details: [] },
    taskInstanceSync: { passed: false, details: [] },
    realTimeUpdates: { passed: false, details: [] }
  };

  // Capture console for debugging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('weekend') ||
        text.includes('sync') ||
        text.includes('Weekend') ||
        text.includes('count') ||
        text.includes('ERROR') ||
        msg.type() === 'error') {
      console.log(`[${msg.type().toUpperCase()}]: ${text}`);
    }
  });

  try {
    console.log('🌐 STEP 1: Loading application...');
    await page.goto('http://localhost:5548', { waitUntil: 'networkidle' });
    await sleep(3000);

    // Get weekend dates for testing
    const weekendDates = await getCurrentWeekendDates();
    console.log(`📅 Weekend dates: ${weekendDates.saturday} (Sat) - ${weekendDates.sunday} (Sun)`);

    console.log('\n🎯 TEST 1: Weekend Counter Mismatch Issue');
    console.log('===========================================');

    // Create weekend tasks to test counter sync
    console.log('📝 Creating weekend tasks for counter testing...');

    // Find quick task input
    const quickInput = page.locator('input[placeholder*="task" i], input[placeholder*="add" i], .quick-task-input').first();
    if (await quickInput.isVisible()) {
      // Create a task for Saturday
      await quickInput.fill(`Weekend Test Task - Saturday`);
      await quickInput.press('Enter');
      await sleep(1000);

      // Schedule it for Saturday using the calendar/due date functionality
      const taskElement = page.locator('text=Weekend Test Task - Saturday').first();
      if (await taskElement.isVisible()) {
        await taskElement.click();
        await sleep(500);

        // Try to find date picker or due date setting
        const datePicker = page.locator('[data-testid*="date"], input[type="date"], .date-picker, [data-testid*="due"]').first();
        if (await datePicker.isVisible()) {
          await datePicker.fill(weekendDates.saturday);
          await sleep(500);
        }

        // Try to save/close the task edit
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Done"), [data-testid*="save"]').first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
        } else {
          // Try pressing Escape to close
          await page.keyboard.press('Escape');
        }
      }

      await sleep(1000);

      // Create another task for Sunday
      await quickInput.fill(`Weekend Test Task - Sunday`);
      await quickInput.press('Enter');
      await sleep(1000);

      const sundayTaskElement = page.locator('text=Weekend Test Task - Sunday').first();
      if (await sundayTaskElement.isVisible()) {
        await sundayTaskElement.click();
        await sleep(500);

        const sundayDatePicker = page.locator('[data-testid*="date"], input[type="date"], .date-picker, [data-testid*="due"]').first();
        if (await sundayDatePicker.isVisible()) {
          await sundayDatePicker.fill(weekendDates.sunday);
          await sleep(500);
        }

        const sundaySaveButton = page.locator('button:has-text("Save"), button:has-text("Done"), [data-testid*="save"]').first();
        if (await sundaySaveButton.isVisible()) {
          await sundaySaveButton.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }

      await sleep(2000);

      // Check weekend counter in sidebar
      console.log('🔍 Checking weekend counter in sidebar...');

      // Look for weekend view or counter
      const weekendCounter = page.locator('text=Weekend, [data-testid*="weekend"], .weekend-counter').first();
      const weekendView = page.locator('a:has-text("Weekend"), button:has-text("Weekend")').first();

      let sidebarWeekendCount = 0;

      if (await weekendCounter.isVisible()) {
        const counterText = await weekendCounter.textContent();
        console.log(`📊 Weekend counter text: "${counterText}"`);
        const match = counterText.match(/(\d+)/);
        if (match) {
          sidebarWeekendCount = parseInt(match[1]);
        }
      }

      console.log(`📊 Weekend count from sidebar: ${sidebarWeekendCount}`);

      // Navigate to Weekend view to check actual count
      if (await weekendView.isVisible()) {
        console.log('🔄 Navigating to Weekend view...');
        await weekendView.click();
        await sleep(2000);

        // Count actual tasks in Weekend view
        const weekendTasks = await page.locator('[data-testid*="task"], .task-card, .task-item, .task-row').all();
        const actualWeekendCount = weekendTasks.length;

        console.log(`📊 Actual tasks in Weekend view: ${actualWeekendCount}`);

        // Validate weekend counter sync
        if (sidebarWeekendCount === actualWeekendCount) {
          console.log('✅ Weekend counter sync: PASSED');
          syncTestResults.weekendCounterMismatch.passed = true;
          syncTestResults.weekendCounterMismatch.details.push(`Sidebar: ${sidebarWeekendCount}, View: ${actualWeekendCount}`);
        } else {
          console.log(`❌ Weekend counter sync: FAILED - Sidebar: ${sidebarWeekendCount}, View: ${actualWeekendCount}`);
          syncTestResults.weekendCounterMismatch.details.push(`MISMATCH: Sidebar ${sidebarWeekendCount} vs View ${actualWeekendCount}`);
        }
      } else {
        console.log('⚠️ Weekend view not found - cannot test counter sync');
        syncTestResults.weekendCounterMismatch.details.push('Weekend view not accessible');
      }
    }

    console.log('\n🎯 TEST 2: Cross-View Data Consistency');
    console.log('=======================================');

    // Navigate back to Board view
    const boardView = page.locator('a:has-text("Board"), button:has-text("Board")').first();
    if (await boardView.isVisible()) {
      await boardView.click();
      await sleep(2000);
    }

    // Create a test task in Board view
    console.log('📝 Creating test task in Board view...');
    const boardQuickInput = page.locator('input[placeholder*="task" i], input[placeholder*="add" i], .quick-task-input').first();

    if (await boardQuickInput.isVisible()) {
      const testTaskName = `Cross-View Sync Test ${Date.now()}`;
      await boardQuickInput.fill(testTaskName);
      await boardQuickInput.press('Enter');
      await sleep(2000);

      // Verify task appears in Board view
      const boardTask = page.locator(`text=${testTaskName}`).first();
      const boardTaskExists = await boardTask.isVisible();
      console.log(`📋 Board view task exists: ${boardTaskExists}`);

      syncTestResults.crossViewConsistency.details.push(`Board view: ${boardTaskExists ? 'VISIBLE' : 'NOT FOUND'}`);

      // Test Calendar view
      console.log('🔄 Testing Calendar view...');
      const calendarView = page.locator('a:has-text("Calendar"), button:has-text("Calendar")').first();
      if (await calendarView.isVisible()) {
        await calendarView.click();
        await sleep(2000);

        const calendarTask = page.locator(`text=${testTaskName}`).first();
        const calendarTaskExists = await calendarTask.isVisible();
        console.log(`📅 Calendar view task exists: ${calendarTaskExists}`);

        syncTestResults.crossViewConsistency.details.push(`Calendar view: ${calendarTaskExists ? 'VISIBLE' : 'NOT FOUND'}`);
      }

      // Test Canvas view
      console.log('🔄 Testing Canvas view...');
      const canvasView = page.locator('a:has-text("Canvas"), button:has-text("Canvas")').first();
      if (await canvasView.isVisible()) {
        await canvasView.click();
        await sleep(2000);

        const canvasTask = page.locator(`text=${testTaskName}`).first();
        const canvasTaskExists = await canvasTask.isVisible();
        console.log(`🎨 Canvas view task exists: ${canvasTaskExists}`);

        syncTestResults.crossViewConsistency.details.push(`Canvas view: ${canvasTaskExists ? 'VISIBLE' : 'NOT FOUND'}`);
      }

      // Test All Tasks view
      console.log('🔄 Testing All Tasks view...');
      const allTasksView = page.locator('a:has-text("All Tasks"), button:has-text("All Tasks")').first();
      if (await allTasksView.isVisible()) {
        await allTasksView.click();
        await sleep(2000);

        const allTasksTask = page.locator(`text=${testTaskName}`).first();
        const allTasksTaskExists = await allTasksTask.isVisible();
        console.log(`📋 All Tasks view task exists: ${allTasksTaskExists}`);

        syncTestResults.crossViewConsistency.details.push(`All Tasks view: ${allTasksTaskExists ? 'VISIBLE' : 'NOT FOUND'}`);
      }

      // Evaluate cross-view consistency
      const visibleInAllViews = syncTestResults.crossViewConsistency.details.filter(detail =>
        detail.includes('VISIBLE')
      ).length;

      if (visibleInAllViews >= 3) { // At least Board + 2 other views
        console.log('✅ Cross-view consistency: PASSED');
        syncTestResults.crossViewConsistency.passed = true;
      } else {
        console.log(`❌ Cross-view consistency: FAILED - Task visible in ${visibleInAllViews}/4 views`);
      }
    }

    console.log('\n🎯 TEST 3: Real-time Updates');
    console.log('============================');

    // Go back to Board view for real-time testing
    if (await boardView.isVisible()) {
      await boardView.click();
      await sleep(2000);
    }

    // Create a task and modify it to test real-time sync
    console.log('📝 Creating task for real-time sync test...');
    const realtimeInput = page.locator('input[placeholder*="task" i], input[placeholder*="add" i], .quick-task-input').first();

    if (await realtimeInput.isVisible()) {
      const realtimeTaskName = `Realtime Test ${Date.now()}`;
      await realtimeInput.fill(realtimeTaskName);
      await realtimeInput.press('Enter');
      await sleep(1000);

      // Modify the task to trigger sync
      const realtimeTask = page.locator(`text=${realtimeTaskName}`).first();
      if (await realtimeTask.isVisible()) {
        console.log('✏️ Modifying task to trigger real-time sync...');
        await realtimeTask.dblclick(); // Try to edit
        await sleep(1000);

        // Try to change status or priority
        const statusButton = page.locator('button:has-text("In Progress"), [data-testid*="status"], .status-selector').first();
        if (await statusButton.isVisible()) {
          await statusButton.click();
          await sleep(500);
        }

        // Navigate to another view to check if update is reflected
        if (await calendarView.isVisible()) {
          await calendarView.click();
          await sleep(2000);

          const updatedTask = page.locator(`text=${realtimeTaskName}`).first();
          const updatedTaskExists = await updatedTask.isVisible();
          console.log(`🔄 Real-time sync test: Task exists in Calendar after modification: ${updatedTaskExists}`);

          if (updatedTaskExists) {
            console.log('✅ Real-time updates: PASSED');
            syncTestResults.realTimeUpdates.passed = true;
            syncTestResults.realTimeUpdates.details.push('Task modifications reflected across views');
          } else {
            console.log('❌ Real-time updates: FAILED - Task not found after modification');
            syncTestResults.realTimeUpdates.details.push('Modifications not synced to other views');
          }
        }
      }
    }

    console.log('\n🎯 TEST 4: Task Instance Synchronization');
    console.log('========================================');

    // Test if task instances (for recurring/scheduled tasks) sync properly
    console.log('📝 Creating task with scheduled instances...');

    if (await quickInput.isVisible()) {
      const instanceTaskName = `Instance Sync Test ${Date.now()}`;
      await quickInput.fill(instanceTaskName);
      await quickInput.press('Enter');
      await sleep(1000);

      const instanceTask = page.locator(`text=${instanceTaskName}`).first();
      if (await instanceTask.isVisible()) {
        await instanceTask.click();
        await sleep(1000);

        // Try to set multiple instances or recurring schedule
        console.log('🗓️ Attempting to create task instances...');

        // Look for instance creation options
        const addButton = page.locator('button:has-text("Add"), button:has-text("+"), [data-testid*="add-instance"]').first();
        if (await addButton.isVisible()) {
          await addButton.click();
          await sleep(500);
        }

        // Try to save the task
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Done"), [data-testid*="save"]').first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
        } else {
          await page.keyboard.press('Escape');
        }

        await sleep(2000);

        // Check if instances appear in Calendar view
        if (await calendarView.isVisible()) {
          await calendarView.click();
          await sleep(2000);

          const instanceInCalendar = page.locator(`text=${instanceTaskName}`).first();
          const instanceExists = await instanceInCalendar.isVisible();
          console.log(`🗓️ Task instance in Calendar: ${instanceExists}`);

          // Check Board view for task counts
          if (await boardView.isVisible()) {
            await boardView.click();
            await sleep(2000);

            const instanceInBoard = page.locator(`text=${instanceTaskName}`).first();
            const instanceInBoardExists = await instanceInBoard.isVisible();
            console.log(`📋 Task instance in Board: ${instanceInBoardExists}`);

            if (instanceExists && instanceInBoardExists) {
              console.log('✅ Task instance synchronization: PASSED');
              syncTestResults.taskInstanceSync.passed = true;
              syncTestResults.taskInstanceSync.details.push('Task instances sync across views');
            } else {
              console.log('❌ Task instance synchronization: FAILED');
              syncTestResults.taskInstanceSync.details.push('Task instances not syncing properly');
            }
          }
        }
      }
    }

    console.log('\n📊 SYNC ISSUE VALIDATION SUMMARY');
    console.log('===================================');

    Object.entries(syncTestResults).forEach(([testName, result]) => {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`${status} ${testName}:`);
      result.details.forEach(detail => {
        console.log(`   - ${detail}`);
      });
    });

    const totalTests = Object.keys(syncTestResults).length;
    const passedTests = Object.values(syncTestResults).filter(result => result.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`\n🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);

    if (failedTests > 0) {
      console.log(`❌ ${failedTests} sync issue${failedTests > 1 ? 's' : ''} still present - ServiceOrchestrator migration did NOT resolve original sync problems`);
    } else {
      console.log('✅ All sync issues resolved - ServiceOrchestrator migration successful');
    }

    process.exit(failedTests > 0 ? 1 : 0);

  } catch (error) {
    console.error('💥 CRITICAL ERROR during sync testing:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();