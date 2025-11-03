const { chromium } = require('playwright');

async function verifyNestedTasksData() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🔍 Verifying nested tasks data structure...');

    // Navigate to the app
    await page.goto('http://localhost:5570');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Access the task store data through the browser console
    const taskData = await page.evaluate(() => {
      // Try to access the task store
      if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
        return { message: 'Vue DevTools available, but direct store access not possible from eval' };
      }

      // Try to find task data in the DOM or localStorage
      const tasks = [];
      const taskElements = document.querySelectorAll('[class*="task"], [data-task-id]');

      taskElements.forEach(element => {
        const taskId = element.getAttribute('data-task-id');
        const title = element.querySelector('[class*="title"]')?.textContent;
        const hasChevron = element.querySelector('[class*="chevron"]') !== null;
        const isNested = element.classList.contains('nested') || element.style.paddingLeft;

        if (title) {
          tasks.push({
            id: taskId,
            title: title.trim(),
            hasChevron,
            isNested,
            indent: element.style.paddingLeft || element.style.marginLeft
          });
        }
      });

      return { tasks, totalFound: taskElements.length };
    });

    console.log('📊 Task Data Analysis:');
    console.log(`Total task elements found: ${taskData.totalFound}`);
    console.log(`Tasks with titles: ${taskData.tasks.length}`);

    if (taskData.tasks.length > 0) {
      console.log('\n📋 Task Details:');
      taskData.tasks.forEach((task, index) => {
        console.log(`${index + 1}. "${task.title}"`);
        console.log(`   - Has chevron: ${task.hasChevron}`);
        console.log(`   - Is nested: ${task.isNested}`);
        console.log(`   - Indent: ${task.indent || 'none'}`);
        console.log(`   - ID: ${task.id || 'not found'}`);
        console.log('');
      });
    }

    // Look specifically for Work project tasks
    console.log('🔍 Looking specifically for Work project content...');
    const workProjectContent = await page.evaluate(() => {
      const workElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent || '';
        return text.includes('Project Setup') || text.includes('Feature Development') || text.includes('Documentation') ||
               text.includes('Initialize repository') || text.includes('Setup development environment') ||
               text.includes('Create project structure');
      });

      return workElements.map(el => ({
        tag: el.tagName,
        className: el.className,
        text: el.textContent?.trim().substring(0, 100),
        hasChevron: el.querySelector('[class*="chevron"]') !== null,
        hasBadge: el.querySelector('[class*="badge"]') !== null
      }));
    });

    if (workProjectContent.length > 0) {
      console.log('✅ Found Work project task content:');
      workProjectContent.forEach((item, index) => {
        console.log(`${index + 1}. ${item.tag}: "${item.text}"`);
        console.log(`   - Has chevron: ${item.hasChevron}`);
        console.log(`   - Has badge: ${item.hasBadge}`);
        console.log(`   - Class: ${item.className}`);
        console.log('');
      });
    } else {
      console.log('⚠️ No Work project task content found in DOM');
    }

    // Take a final screenshot
    await page.screenshot({ path: 'test-results/nested/data-verification.png', fullPage: true });
    console.log('📸 Screenshot saved for data verification');

    console.log('✅ Data verification completed!');

  } catch (error) {
    console.error('❌ Data verification failed:', error.message);
  } finally {
    await browser.close();
  }
}

verifyNestedTasksData();