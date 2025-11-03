import { chromium } from 'playwright';

async function debugTimerIndicator() {
  console.log('🔍 Starting Timer Indicator Debug Test...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 200
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to Canvas
    await page.goto('http://localhost:5546/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const canvasLink = await page.$('a[href*="canvas"]');
    if (canvasLink) {
      await canvasLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }

    // Find first task
    const tasks = await page.$$('.task-node');
    if (tasks.length === 0) {
      console.log('❌ No tasks found');
      return;
    }

    const firstTask = tasks[0];
    console.log('✅ Found task, examining timer state...');

    // Get task ID from the Vue Flow node data
    const taskId = await firstTask.evaluate((el) => {
      // Try to find the Vue component data
      const vueComponent = el.__vueParentComponent?.ctx;
      if (vueComponent?.task?.id) {
        return vueComponent.task.id;
      }

      // Try to get from DOM attributes
      const nodeId = el.getAttribute('data-node-id');
      if (nodeId) return nodeId;

      return null;
    });

    console.log(`Task ID: ${taskId}`);

    // Check initial timer state
    const initialTimerState = await page.evaluate(() => {
      // Try to access timer store
      try {
        const timerStore = window.__VUE_DEVTOOLS_GLOBAL_HOOK__?.Vue?.config?.globalProperties?.$timerStore;
        if (timerStore) {
          return {
            isTimerActive: timerStore.isTimerActive,
            currentTaskId: timerStore.currentTaskId,
            displayTime: timerStore.displayTime
          };
        }
      } catch (e) {
        // Continue
      }
      return null;
    });

    console.log('Initial timer state:', initialTimerState);

    // Check if task has timer indicator initially
    const initialIndicator = await firstTask.$('.timer-indicator');
    console.log('Initial timer indicator:', !!initialIndicator);

    // Right-click and start timer
    await firstTask.click({ button: 'right' });
    await page.waitForTimeout(1000);

    const timerMenuButton = await page.$('.pomodoro-action, [class*="timer"]');
    if (timerMenuButton) {
      console.log('Clicking timer menu item...');
      await timerMenuButton.click();
      await page.waitForTimeout(3000);

      // Check timer state after starting
      const activeTimerState = await page.evaluate(() => {
        try {
          const timerStore = window.__VUE_DEVTOOLS_GLOBAL_HOOK__?.Vue?.config?.globalProperties?.$timerStore;
          if (timerStore) {
            return {
              isTimerActive: timerStore.isTimerActive,
              currentTaskId: timerStore.currentTaskId,
              displayTime: timerStore.displayTime,
              currentTaskName: timerStore.currentTaskName
            };
          }
        } catch (e) {
          // Continue
        }
        return null;
      });

      console.log('Active timer state:', activeTimerState);

      // Check task classes
      const taskClasses = await firstTask.getAttribute('class');
      console.log('Task classes after timer start:', taskClasses);

      // Check for timer indicator
      const activeIndicator = await firstTask.$('.timer-indicator');
      console.log('Timer indicator after start:', !!activeIndicator);

      // Check all child elements that might be timer-related
      const allChildren = await firstTask.$$('*');
      console.log(`Task has ${allChildren.length} child elements`);

      for (let i = 0; i < Math.min(allChildren.length, 10); i++) {
        const child = allChildren[i];
        const childTag = await child.evaluate(el => el.tagName);
        const childClass = await child.getAttribute('class');
        const childText = await child.evaluate(el => el.textContent?.trim());
        console.log(`  Child ${i}: ${childTag} class="${childClass}" text="${childText}"`);
      }

      // Look for timer-related styles
      const computedStyle = await firstTask.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
          border: style.border
        };
      });

      console.log('Task computed style:', computedStyle);

      await page.screenshot({ path: 'debug-timer-active.png', fullPage: true });

      // Try to stop the timer
      const stopButton = await page.$('.timer-stop');
      if (stopButton) {
        await stopButton.click();
        await page.waitForTimeout(2000);

        const finalIndicator = await firstTask.$('.timer-indicator');
        console.log('Timer indicator after stop:', !!finalIndicator);
      }
    } else {
      console.log('❌ No timer menu item found');
    }

    await page.screenshot({ path: 'debug-final.png', fullPage: true });

  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
    await page.screenshot({ path: 'debug-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

debugTimerIndicator().catch(console.error);