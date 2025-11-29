#!/usr/bin/env node

/**
 * View-by-View Filter Analyzer - Implementation Script
 *
 * Systematic analysis and fixing of duplicate filter controls across ALL views
 * with visual proof and comprehensive reporting.
 */

const fs = require('fs').promises;
const path = require('path');
const { chromium } = require('playwright');

class ViewByViewFilterAnalyzer {
  constructor() {
    this.projectRoot = process.cwd();
    this.srcDir = path.join(this.projectRoot, 'src');
    this.viewsDir = path.join(this.srcDir, 'views');
    this.componentsDir = path.join(this.srcDir, 'components');

    this.baseUrl = 'http://localhost:5546';
    this.browser = null;
    this.context = null;
    this.page = null;

    this.screenshotDir = path.join(this.projectRoot, 'view-by-view-filter-analysis');
    this.results = {
      views: {},
      duplicatesFound: [],
      fixesApplied: [],
      summary: {
        totalViews: 0,
        viewsWithDuplicates: 0,
        viewsFixed: 0,
        remainingIssues: 0
      }
    };

    // All views to analyze
    this.views = [
      { name: 'Board', path: '/', description: 'Kanban board view', component: 'BoardView.vue' },
      { name: 'Calendar', path: '/calendar', description: 'Calendar view', component: 'CalendarView.vue' },
      { name: 'Canvas', path: '/canvas', description: 'Canvas view', component: 'CanvasView.vue' },
      { name: 'All Tasks', path: '/tasks', description: 'All tasks view', component: 'AllTasksView.vue' },
      { name: 'Catalog', path: '/catalog', description: 'Catalog view', component: 'AllTasksView.vue' },
      { name: 'Today', path: '/today', description: 'Today mobile view', component: 'TodayView.vue' },
      { name: 'Quick Sort', path: '/quick-sort', description: 'Quick sort view', component: 'QuickSortView.vue' },
      { name: 'Focus', path: '/focus/test-task-id', description: 'Focus view', component: 'FocusView.vue' }
    ];
  }

  async execute() {
    console.log('🔍 VIEW-BY-VIEW FILTER ANALYZER - STARTING COMPREHENSIVE ANALYSIS\n');
    console.log('This will systematically analyze EVERY view for duplicate filter controls');
    console.log('and provide visual proof of the fixes.\n');

    try {
      await this.setup();
      await this.createAnalysisDirectory();
      await this.analyzeAllViews();
      await this.generateComprehensiveReport();
      await this.cleanup();

      console.log('\n✅ VIEW-BY-VIEW ANALYSIS COMPLETED!');
      console.log(`📁 Check the ${this.screenshotDir} directory for visual proof`);
      console.log(`📊 Summary: ${this.results.summary.viewsFixed} views fixed, ${this.results.summary.remainingIssues} issues remaining`);

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      throw error;
    }
  }

  async setup() {
    console.log('🚀 Setting up browser and analysis environment...');

    this.browser = await chromium.launch({
      headless: false, // Keep visible for debugging
      slowMo: 1000
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    this.page = await this.context.newPage();

    // Wait for server
    console.log('⏳ Waiting for development server...');
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(3000); // Allow full page load
    console.log('✅ Server ready for analysis');
  }

  async createAnalysisDirectory() {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      console.log(`📁 Created analysis directory: ${this.screenshotDir}`);
    } catch (error) {
      console.log('📁 Analysis directory already exists');
    }
  }

  async analyzeAllViews() {
    console.log('\n🔍 ANALYZING ALL VIEWS FOR DUPLICATE FILTER CONTROLS...\n');

    this.results.summary.totalViews = this.views.length;

    for (const view of this.views) {
      await this.analyzeView(view);
    }
  }

  async analyzeView(view) {
    console.log(`🔍 Analyzing ${view.name} View (${view.path})...`);

    const viewResult = {
      name: view.name,
      path: view.path,
      description: view.description,
      component: view.component,
      screenshots: [],
      duplicates: [],
      fixes: [],
      issues: []
    };

    try {
      // Navigate to view
      console.log(`  🌐 Navigating to ${view.path}`);
      await this.page.goto(`${this.baseUrl}${view.path}`, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(3000);

      // Take initial screenshot
      const initialScreenshot = `${view.name.toLowerCase()}-before.png`;
      await this.page.screenshot({
        path: path.join(this.screenshotDir, initialScreenshot),
        fullPage: true
      });
      viewResult.screenshots.push(initialScreenshot);
      console.log(`  📸 Initial screenshot: ${initialScreenshot}`);

      // Analyze filter controls in this view
      const filterAnalysis = await this.analyzeFilterControlsInView(view);
      viewResult.duplicates = filterAnalysis.duplicates;
      viewResult.issues = filterAnalysis.issues;

      // Highlight duplicates and take screenshot
      if (filterAnalysis.duplicates.length > 0) {
        await this.highlightDuplicateFilters(filterAnalysis.duplicates);
        const highlightedScreenshot = `${view.name.toLowerCase()}-duplicates-highlighted.png`;
        await this.page.screenshot({
          path: path.join(this.screenshotDir, highlightedScreenshot),
          fullPage: true
        });
        viewResult.screenshots.push(highlightedScreenshot);
        console.log(`  📸 Highlighted duplicates: ${highlightedScreenshot}`);

        // Fix the duplicates
        const fixResult = await this.fixViewDuplicates(view, filterAnalysis.duplicates);
        viewResult.fixes = fixResult.fixes;

        if (fixResult.success) {
          console.log(`  ✅ Fixed ${fixResult.fixes.length} duplicate issues`);
          this.results.summary.viewsFixed++;

          // Take after-fix screenshot
          const afterScreenshot = `${view.name.toLowerCase()}-after.png`;
          await this.page.goto(`${this.baseUrl}${view.path}`, { waitUntil: 'networkidle' });
          await this.page.waitForTimeout(3000);
          await this.page.screenshot({
            path: path.join(this.screenshotDir, afterScreenshot),
            fullPage: true
          });
          viewResult.screenshots.push(afterScreenshot);
          console.log(`  📸 After fix screenshot: ${afterScreenshot}`);
        } else {
          console.log(`  ❌ Failed to fix duplicates in ${view.name}`);
          this.results.summary.remainingIssues++;
        }

        this.results.summary.viewsWithDuplicates++;
      } else {
        console.log(`  ✅ No duplicate filters found in ${view.name}`);
      }

    } catch (error) {
      console.log(`  💥 Error analyzing ${view.name}: ${error.message}`);
      viewResult.error = error.message;
      this.results.summary.remainingIssues++;
    }

    this.results.views[view.name] = viewResult;
  }

  async analyzeFilterControlsInView(view) {
    const duplicates = [];
    const issues = [];

    try {
      // Find all filter elements using multiple selectors
      const filterSelectors = [
        '[class*="filter"]',
        '[class*="Filter"]',
        '[data-testid*="filter"]',
        '[class*="filter-controls"]',
        '[class*="filter-tab"]',
        '[class*="density"]',
        '[class*="hide-done"]',
        '[class*="status-filter"]'
      ];

      const allFilterElements = [];
      for (const selector of filterSelectors) {
        const elements = await this.page.$$(selector);
        allFilterElements.push(...elements);
      }

      console.log(`    📊 Found ${allFilterElements.length} potential filter elements`);

      // Remove duplicates from the list
      const uniqueElements = [...new Set(allFilterElements)];
      console.log(`    📊 ${uniqueElements.length} unique filter elements`);

      // Analyze each element for duplicates
      for (let i = 0; i < uniqueElements.length; i++) {
        const element = uniqueElements[i];
        const elementInfo = await this.analyzeFilterElement(element, i);

        if (elementInfo.isDuplicate) {
          duplicates.push(elementInfo);
        }

        if (elementInfo.hasIssues) {
          issues.push(...elementInfo.issues);
        }
      }

      // Check for specific view-level duplicate patterns
      await this.checkViewSpecificDuplicates(view, duplicates, issues);

    } catch (error) {
      issues.push({
        type: 'analysis_error',
        message: `Failed to analyze view: ${error.message}`,
        severity: 'critical'
      });
    }

    return { duplicates, issues };
  }

  async analyzeFilterElement(element, index) {
    const elementInfo = {
      index,
      isDuplicate: false,
      hasIssues: false,
      issues: [],
      className: '',
      textContent: '',
      position: null
    };

    try {
      elementInfo.className = await element.getAttribute('class') || '';
      elementInfo.textContent = await element.textContent() || '';
      const boundingBox = await element.boundingBox();
      elementInfo.position = boundingBox;

      // Check if this is a duplicate filter control
      if (this.isDuplicateFilterElement(elementInfo)) {
        elementInfo.isDuplicate = true;
        elementInfo.duplicateType = this.getDuplicateType(elementInfo);
      }

      // Check for other issues
      if (boundingBox && (boundingBox.width < 30 || boundingBox.height < 20)) {
        elementInfo.hasIssues = true;
        elementInfo.issues.push({
          type: 'size_issue',
          message: `Filter element too small: ${boundingBox.width}x${boundingBox.height}`,
          severity: 'warning'
        });
      }

    } catch (error) {
      elementInfo.hasIssues = true;
      elementInfo.issues.push({
        type: 'element_error',
        message: `Error analyzing element: ${error.message}`,
        severity: 'warning'
      });
    }

    return elementInfo;
  }

  isDuplicateFilterElement(elementInfo) {
    const { className, textContent } = elementInfo;
    const classNameLower = className.toLowerCase();
    const textLower = textContent.toLowerCase();

    // Patterns that indicate duplicate filter elements
    const duplicatePatterns = [
      { className: /filter-tab/, text: /all|planned|in progress|done|backlog/ },
      { className: /filter-controls/, text: null },
      { className: /density-/, text: /compact|comfortable|spacious|thin/ },
      { className: /hide-done/, text: /hide|show|done/ },
      { className: /status-filter/, text: /status|all|planned|progress|done/ },
      { className: /project-filter/, text: /project|all/ },
      { className: /today-filter/, text: /today/ },
      { className: /view-filter/, text: /view|all|today|weekend/ }
    ];

    return duplicatePatterns.some(pattern => {
      const classMatch = pattern.className && classNameLower.match(pattern.className);
      const textMatch = pattern.text && textLower.includes(pattern.text);
      return classMatch || textMatch;
    });
  }

  getDuplicateType(elementInfo) {
    const { className, textContent } = elementInfo;
    const classNameLower = className.toLowerCase();

    if (classNameLower.includes('filter-tab')) return 'filter-tab';
    if (classNameLower.includes('filter-controls')) return 'filter-controls';
    if (classNameLower.includes('density')) return 'density-selector';
    if (classNameLower.includes('hide-done')) return 'hide-done-toggle';
    if (classNameLower.includes('status-filter')) return 'status-filter';
    if (classNameLower.includes('project-filter')) return 'project-filter';
    if (classNameLower.includes('today-filter')) return 'today-filter';
    if (classNameLower.includes('view-filter')) return 'view-filter';

    return 'unknown';
  }

  async checkViewSpecificDuplicates(view, duplicates, issues) {
    // Board view specific checks
    if (view.name === 'Board') {
      const densityButtons = await this.page.$$('[class*="density-btn"]');
      if (densityButtons.length > 0) {
        duplicates.push({
          duplicateType: 'board-density-buttons',
          count: densityButtons.length,
          message: `Board view has ${densityButtons.length} density buttons (should use FilterControls)`,
          className: 'density-btn',
          textContent: 'Density buttons'
        });
      }

      const doneToggles = await this.page.$$('[class*="done-column-toggle"]');
      if (doneToggles.length > 1) {
        duplicates.push({
          duplicateType: 'board-done-toggles',
          count: doneToggles.length,
          message: `Board view has ${doneToggles.length} done column toggles`,
          className: 'done-column-toggle',
          textContent: 'Done toggles'
        });
      }
    }

    // Calendar view specific checks
    if (view.name === 'Calendar') {
      const calendarFilters = await this.page.$$('[class*="calendar-filter"]');
      if (calendarFilters.length > 0) {
        duplicates.push({
          duplicateType: 'calendar-filters',
          count: calendarFilters.length,
          message: `Calendar view has ${calendarFilters.length} calendar-specific filters`,
          className: 'calendar-filter',
          textContent: 'Calendar filters'
        });
      }
    }

    // TaskManagerSidebar checks (should NOT be in main views)
    const sidebarFilters = await this.page.$$('task-sidebar [class*="filter"]');
    if (sidebarFilters.length > 0) {
      duplicates.push({
        duplicateType: 'sidebar-filters',
        count: sidebarFilters.length,
        message: `TaskManagerSidebar has ${sidebarFilters.length} filter elements (should only be search)`,
        className: 'sidebar-filter',
        textContent: 'Sidebar filters'
      });
    }
  }

  async highlightDuplicateFilters(duplicates) {
    // Add CSS to highlight all filter elements
    await this.page.addStyleTag({
      content: `
        [class*="filter"], [class*="Filter"], [data-testid*="filter"],
        [class*="density"], [class*="hide-done"], [class*="status-filter"],
        [class*="filter-tab"], [class*="filter-controls"], [class*="project-filter"],
        [class*="today-filter"], [class*="view-filter"] {
          border: 3px solid red !important;
          background-color: rgba(255, 0, 0, 0.2) !important;
          box-shadow: 0 0 10px rgba(255, 0, 0, 0.5) !important;
        }
        [class*="filter"]:hover, [class*="Filter"]:hover, [data-testid*="filter"]:hover {
          background-color: rgba(255, 0, 0, 0.4) !important;
        }
      `
    });

    // Add labels to duplicates
    for (const duplicate of duplicates) {
      if (duplicate.position) {
        await this.page.addStyleTag({
          content: `
            body::after {
              content: "DUPLICATE: ${duplicate.duplicateType}";
              position: fixed;
              top: 20px;
              left: 50%;
              transform: translateX(-50%);
              background: red;
              color: white;
              padding: 10px 20px;
              border-radius: 5px;
              font-size: 16px;
              font-weight: bold;
              z-index: 10000;
              animation: pulse 1s infinite;
            }
            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.7; }
              100% { opacity: 1; }
            }
          `
        });
        break; // Only add one label
      }
    }
  }

  async fixViewDuplicates(view, duplicates) {
    console.log(`    🔧 Fixing duplicates in ${view.component}...`);

    const fixes = [];
    let success = true;

    try {
      const componentPath = path.join(this.viewsDir, view.component);
      let content = await fs.readFile(componentPath, 'utf-8');

      // Fix specific duplicate types
      for (const duplicate of duplicates) {
        const fixResult = await this.fixDuplicateType(content, duplicate, view);
        if (fixResult.fixed) {
          content = fixResult.content;
          fixes.push(fixResult.fix);
        } else {
          success = false;
          console.log(`      ⚠️  Could not fix: ${duplicate.message}`);
        }
      }

      // Write the fixed content back
      if (fixes.length > 0) {
        await fs.writeFile(componentPath, content);
        console.log(`    💾 Applied ${fixes.length} fixes to ${view.component}`);
      }

    } catch (error) {
      console.log(`    ❌ Error fixing ${view.name}: ${error.message}`);
      success = false;
    }

    return { success, fixes };
  }

  async fixDuplicateType(content, duplicate, view) {
    let fixed = false;
    const fix = {
      type: duplicate.duplicateType,
      message: '',
      originalElements: 0,
      removedElements: 0
    };

    switch (duplicate.duplicateType) {
      case 'board-density-buttons':
        // Remove density selector from BoardView
        const densityPattern = /<div[^>]*class="[^"]*density-selector[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
        const densityMatches = content.match(densityPattern);
        if (densityMatches) {
          fix.originalElements = densityMatches.length;
          content = content.replace(densityPattern, '');
          fix.removedElements = densityMatches.length;
          fix.message = `Removed ${densityMatches.length} density selectors`;
          fixed = true;
        }
        break;

      case 'filter-tab':
        // Remove filter tabs from views
        const filterTabPattern = /<button[^>]*class="[^"]*filter-tab[^"]*"[^>]*>[\s\S]*?<\/button>/gi;
        const filterTabMatches = content.match(filterTabPattern);
        if (filterTabMatches) {
          fix.originalElements = filterTabMatches.length;
          content = content.replace(filterTabPattern, '');
          fix.removedElements = filterTabMatches.length;
          fix.message = `Removed ${filterTabMatches.length} filter tabs`;
          fixed = true;
        }
        break;

      case 'sidebar-filters':
        // This should be fixed by removing FilterControls from TaskManagerSidebar
        fix.message = 'Sidebar filters need to be fixed in TaskManagerSidebar component';
        fixed = false; // This needs manual verification
        break;

      default:
        fix.message = `Unknown duplicate type: ${duplicate.duplicateType}`;
        fixed = false;
    }

    return { fixed, content, fix };
  }

  async generateComprehensiveReport() {
    console.log('\n📊 GENERATING COMPREHENSIVE REPORT...\n');

    // Generate JSON report
    const jsonPath = path.join(this.screenshotDir, 'view-by-view-analysis.json');
    await fs.writeFile(jsonPath, JSON.stringify(this.results, null, 2));

    // Generate HTML report
    const htmlReport = await this.generateHTMLReport();
    const htmlPath = path.join(this.screenshotDir, 'view-by-view-analysis.html');
    await fs.writeFile(htmlPath, htmlReport);

    console.log(`📄 JSON report: ${jsonPath}`);
    console.log(`🌐 HTML report: ${htmlPath}`);

    // Print summary
    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 VIEW-BY-VIEW FILTER ANALYSIS SUMMARY');
    console.log('='.repeat(80));

    console.log(`\n📈 Statistics:`);
    console.log(`  Total Views Analyzed: ${this.results.summary.totalViews}`);
    console.log(`  Views with Duplicates: ${this.results.summary.viewsWithDuplicates}`);
    console.log(`  Views Successfully Fixed: ${this.results.summary.viewsFixed}`);
    console.log(`  Remaining Issues: ${this.results.summary.remainingIssues}`);

    console.log(`\n🔍 View-by-View Results:`);
    for (const viewName in this.results.views) {
      const view = this.results.views[viewName];
      const status = view.error ? '❌ ERROR' :
                    view.duplicates.length === 0 ? '✅ CLEAN' :
                    view.fixes.length > 0 ? '🔧 FIXED' : '❌ DUPLICATES';

      console.log(`  ${status} ${viewName}: ${view.duplicates.length} duplicates, ${view.fixes.length} fixes`);
    }

    if (this.results.duplicatesFound.length > 0) {
      console.log(`\n❌ All Duplicates Found:`);
      this.results.duplicatesFound.forEach((dup, index) => {
        console.log(`  ${index + 1}. ${dup.view}: ${dup.message}`);
      });
    }

    if (this.results.fixesApplied.length > 0) {
      console.log(`\n🔧 All Fixes Applied:`);
      this.results.fixesApplied.forEach((fix, index) => {
        console.log(`  ${index + 1}. ${fix.view}: ${fix.message}`);
      });
    }

    const allFixed = this.results.summary.viewsWithDuplicates === this.results.summary.viewsFixed;
    if (allFixed && this.results.summary.remainingIssues === 0) {
      console.log(`\n✅ SUCCESS: All duplicate filter controls have been eliminated!`);
    } else {
      console.log(`\n⚠️  PARTIAL SUCCESS: Some issues remain that need manual attention.`);
    }

    console.log('\n' + '='.repeat(80));
  }

  async generateHTMLReport() {
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>View-by-View Filter Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .header { background: #2c3e50; color: white; padding: 30px; margin-bottom: 30px; border-radius: 8px; }
        .summary { background: white; padding: 30px; margin-bottom: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .view-section { background: white; margin-bottom: 30px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .view-header { background: #34495e; color: white; padding: 20px; font-weight: bold; font-size: 18px; }
        .view-content { padding: 20px; }
        .screenshot { max-width: 100%; height: auto; border: 2px solid #ddd; margin: 15px 0; border-radius: 4px; }
        .duplicate { background: #ffebee; padding: 15px; margin: 10px 0; border-left: 5px solid #f44336; border-radius: 4px; }
        .fix { background: #e8f5e8; padding: 15px; margin: 10px 0; border-left: 5px solid #4caf50; border-radius: 4px; }
        .success { background: #e3f2fd; padding: 15px; margin: 10px 0; border-left: 5px solid #2196f3; border-radius: 4px; }
        .warning { background: #fff3cd; padding: 15px; margin: 10px 0; border-left: 5px solid #ffc107; border-radius: 4px; }
        .error { background: #f8d7da; padding: 15px; margin: 10px 0; border-left: 5px solid #dc3545; border-radius: 4px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .stat h3 { margin: 0 0 10px 0; font-size: 24px; }
        .stat p { margin: 0; opacity: 0.9; }
        .screenshot-container { text-align: center; margin: 20px 0; }
        .screenshot-container h3 { color: #2c3e50; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 View-by-View Filter Analysis Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
        <p>Comprehensive analysis of duplicate filter controls across all views with visual proof</p>
    </div>

    <div class="summary">
        <h2>📊 Analysis Summary</h2>
        <div class="stats">
            <div class="stat">
                <h3>${this.results.summary.totalViews}</h3>
                <p>Total Views Analyzed</p>
            </div>
            <div class="stat">
                <h3>${this.results.summary.viewsWithDuplicates}</h3>
                <p>Views with Duplicates</p>
            </div>
            <div class="stat">
                <h3>${this.results.summary.viewsFixed}</h3>
                <p>Views Successfully Fixed</p>
            </div>
            <div class="stat">
                <h3>${this.results.summary.remainingIssues}</h3>
                <p>Remaining Issues</p>
            </div>
        </div>

        ${this.results.summary.viewsWithDuplicates === this.results.summary.viewsFixed && this.results.summary.remainingIssues === 0 ?
          '<div class="success">✅ SUCCESS: All duplicate filter controls have been eliminated!</div>' :
          `<div class="warning">⚠️  PARTIAL SUCCESS: ${this.results.summary.remainingIssues} issues remain that need manual attention.</div>`
        }
    </div>
`;

    // Add each view section
    for (const viewName in this.results.views) {
      const view = this.results.views[viewName];
      html += `
    <div class="view-section">
        <div class="view-header">
            ${view.name} View - ${view.description}
        </div>
        <div class="view-content">
            <p><strong>Component:</strong> ${view.component}</p>
            <p><strong>Path:</strong> ${view.path}</p>
`;

      // Add screenshots
      if (view.screenshots && view.screenshots.length > 0) {
        html += `            <div class="screenshot-container">`;
        view.screenshots.forEach(screenshot => {
          const description = screenshot.includes('before') ? 'Before Fix' :
                           screenshot.includes('after') ? 'After Fix' :
                           screenshot.includes('highlighted') ? 'Duplicates Highlighted' : 'Screenshot';
          html += `                <h3>${description}</h3>
                <img src="${screenshot}" class="screenshot" alt="${description}">
`;
        });
        html += `            </div>`;
      }

      // Add duplicates found
      if (view.duplicates && view.duplicates.length > 0) {
        html += `            <h3>❌ Duplicates Found:</h3>`;
        view.duplicates.forEach(duplicate => {
          html += `            <div class="duplicate">${duplicate.message}</div>`;
        });
      }

      // Add fixes applied
      if (view.fixes && view.fixes.length > 0) {
        html += `            <h3>🔧 Fixes Applied:</h3>`;
        view.fixes.forEach(fix => {
          html += `            <div class="fix">${fix.message}</div>`;
        });
      }

      // Add status
      if (view.error) {
        html += `            <div class="error">❌ Analysis Error: ${view.error}</div>`;
      } else if (view.duplicates.length === 0) {
        html += `            <div class="success">✅ No duplicate filters found</div>`;
      } else if (view.fixes.length > 0) {
        html += `            <div class="success">✅ Successfully fixed all duplicates</div>`;
      } else {
        html += `            <div class="warning">⚠️ Duplicates found but not fixed</div>`;
      }

      html += `        </div>
    </div>
`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      console.log('\n🧹 Browser closed');
    }
  }
}

// Execute if called directly
if (require.main === module) {
  const analyzer = new ViewByViewFilterAnalyzer();
  analyzer.execute()
    .then(() => {
      console.log('\n🏁 View-by-view filter analysis complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = ViewByViewFilterAnalyzer;