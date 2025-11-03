import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log('BROWSER:', msg.type().toUpperCase(), msg.text());
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  try {
    console.log('=== ULTRA-DEEP DESIGN ANALYSIS ===');
    await page.goto('http://localhost:5545', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Take full page screenshot
    await page.screenshot({
      path: 'docs/debug/current-ultra-analysis.png',
      fullPage: true
    });

    // Analyze specific elements
    const analysis = await page.evaluate(() => {
      const results = {
        pageStructure: {},
        sidebar: {},
        mainContent: {},
        taskCards: {},
        typography: {},
        spacing: {},
        colors: {}
      };

      // Page structure analysis
      const app = document.querySelector('.app');
      if (app) {
        const appStyles = window.getComputedStyle(app);
        results.pageStructure = {
          background: appStyles.backgroundColor,
          display: appStyles.display,
          fontFamily: appStyles.fontFamily,
          layout: app.children.length + ' children'
        };
      }

      // Sidebar analysis
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        const sidebarStyles = window.getComputedStyle(sidebar);
        results.sidebar = {
          width: sidebarStyles.width,
          background: sidebarStyles.backgroundColor,
          borderRight: sidebarStyles.borderRight,
          exists: true,
          navItemCount: sidebar.querySelectorAll('.nav-item').length,
          projectCount: sidebar.querySelectorAll('.project-child').length
        };
      } else {
        results.sidebar = { exists: false };
      }

      // Main content analysis
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        const mainStyles = window.getComputedStyle(mainContent);
        results.mainContent = {
          background: mainStyles.backgroundColor,
          padding: mainStyles.padding,
          hasBreadcrumb: !!document.querySelector('.breadcrumb'),
          hasViewTabs: !!document.querySelector('.view-tabs'),
          hasSearch: !!document.querySelector('.search-input')
        };
      }

      // Task card analysis
      const taskCards = document.querySelectorAll('.task-card');
      if (taskCards.length > 0) {
        const firstCard = taskCards[0];
        const cardStyles = window.getComputedStyle(firstCard);
        results.taskCards = {
          count: taskCards.length,
          background: cardStyles.backgroundColor,
          border: cardStyles.border,
          borderRadius: cardStyles.borderRadius,
          padding: cardStyles.padding,
          boxShadow: cardStyles.boxShadow,
          hasProgressIndicators: !!document.querySelector('.progress-indicator'),
          hasDueDates: !!document.querySelector('.due-date'),
          hasAvatars: !!document.querySelector('.task-avatars')
        };
      }

      // Typography analysis
      const title = document.querySelector('.project-title');
      if (title) {
        const titleStyles = window.getComputedStyle(title);
        results.typography = {
          titleFontSize: titleStyles.fontSize,
          titleFontWeight: titleStyles.fontWeight,
          titleColor: titleStyles.color
        };
      }

      const taskTitle = document.querySelector('.task-title');
      if (taskTitle) {
        const taskTitleStyles = window.getComputedStyle(taskTitle);
        results.typography.taskTitle = {
          fontSize: taskTitleStyles.fontSize,
          fontWeight: taskTitleStyles.fontWeight,
          color: taskTitleStyles.color
        };
      }

      // Check for specific elements that should exist
      results.elementsCheck = {
        hasNotificationBadge: !!document.querySelector('.notification-badge'),
        hasProgressCircles: !!document.querySelector('.progress-circle'),
        hasFilterControls: !!document.querySelector('.filter-control'),
        hasProjectHierarchy: !!document.querySelector('.project-children'),
        hasActiveBreadcrumb: !!document.querySelector('.breadcrumb-item.current'),
        hasActiveTab: !!document.querySelector('.view-tab.active')
      };

      return results;
    });

    console.log('=== DETAILED ANALYSIS RESULTS ===');
    console.log(JSON.stringify(analysis, null, 2));

    // Measure specific elements for comparison
    const measurements = await page.evaluate(() => {
      const measurements = {};

      // Sidebar measurements
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        const rect = sidebar.getBoundingClientRect();
        measurements.sidebar = {
          width: rect.width,
          height: rect.height
        };
      }

      // Task card measurements
      const taskCard = document.querySelector('.task-card');
      if (taskCard) {
        const rect = taskCard.getBoundingClientRect();
        measurements.taskCard = {
          width: rect.width,
          height: rect.height,
          marginBottom: window.getComputedStyle(taskCard).marginBottom
        };
      }

      // Column measurements
      const columns = document.querySelectorAll('.kanban-column');
      if (columns.length > 0) {
        const firstColumn = columns[0];
        const rect = firstColumn.getBoundingClientRect();
        measurements.column = {
          width: rect.width,
          gap: 'measured from grid'
        };
      }

      return measurements;
    });

    console.log('=== ELEMENT MEASUREMENTS ===');
    console.log(JSON.stringify(measurements, null, 2));

    console.log('✅ Ultra-deep analysis complete');
    console.log('📸 Screenshot saved to docs/debug/current-ultra-analysis.png');

  } catch (error) {
    console.log('❌ Error during analysis:', error.message);
  }

  await browser.close();
})();