/**
 * Global teardown for User Flow Testing
 * Cleans up test environment and generates final reports
 */

const fs = require('fs');
const path = require('path');

async function globalTeardown(config) {
  console.log('🧹 Tearing down User Flow Testing environment...');

  const startTime = Date.now();

  try {
    // Generate comprehensive test report
    await generateFinalReport(config);

    // Clean up temporary test data
    await cleanupTempData();

    // Archive test results if needed
    await archiveTestResults();

    // Generate performance summary
    await generatePerformanceSummary();

    // Cleanup browser resources
    await cleanupBrowserResources();

    const teardownTime = Date.now() - startTime;
    console.log(`✅ Global teardown completed in ${teardownTime}ms`);

    // Return final summary
    return {
      teardownDuration: teardownTime,
      completedAt: new Date().toISOString(),
      cleanupPerformed: true
    };

  } catch (error) {
    console.error('❌ Global teardown failed:', error.message);
    throw error;
  }
}

/**
 * Generate final comprehensive test report
 */
async function generateFinalReport(config) {
  console.log('📊 Generating final test report...');

  const testResultsDir = path.join(process.cwd(), 'docs', 'reports');

  // Collect all test result files
  const reportData = {
    summary: {
      totalTestSuites: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalDuration: 0,
      generatedAt: new Date().toISOString()
    },
    testSuites: [],
    performanceMetrics: {},
    environment: config.globalConfig || {},
    recommendations: []
  };

  // Process Playwright JSON results if they exist
  const playwrightResultsPath = path.join(testResultsDir, 'user-flow-playwright-results.json');
  if (fs.existsSync(playwrightResultsPath)) {
    try {
      const playwrightResults = JSON.parse(fs.readFileSync(playwrightResultsPath, 'utf8'));
      processPlaywrightResults(playwrightResults, reportData);
    } catch (error) {
      console.warn('⚠️  Could not process Playwright results:', error.message);
    }
  }

  // Process custom skill results if they exist
  const skillResultsPath = path.join(testResultsDir, 'user-flow-report.json');
  if (fs.existsSync(skillResultsPath)) {
    try {
      const skillResults = JSON.parse(fs.readFileSync(skillResultsPath, 'utf8'));
      processSkillResults(skillResults, reportData);
    } catch (error) {
      console.warn('⚠️  Could not process skill results:', error.message);
    }
  }

  // Generate recommendations based on results
  generateRecommendations(reportData);

  // Write comprehensive report
  const comprehensiveReportPath = path.join(testResultsDir, 'comprehensive-test-report.json');
  fs.writeFileSync(comprehensiveReportPath, JSON.stringify(reportData, null, 2));

  // Generate human-readable summary
  await generateHumanReadableSummary(reportData);

  console.log('✅ Final test report generated');
}

/**
 * Process Playwright test results
 */
function processPlaywrightResults(playwrightResults, reportData) {
  if (playwrightResults.suites) {
    playwrightResults.suites.forEach(suite => {
      const suiteData = {
        name: suite.title,
        file: suite.file,
        tests: [],
        duration: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      };

      if (suite.specs) {
        suite.specs.forEach(spec => {
          spec.tests.forEach(test => {
            suiteData.tests.push({
              title: test.title,
              status: test.results[0]?.status || 'unknown',
              duration: test.results[0]?.duration || 0,
              error: test.results[0]?.error?.message || null
            });

            reportData.summary.totalTests++;
            suiteData.duration += test.results[0]?.duration || 0;

            switch (test.results[0]?.status) {
              case 'passed':
                reportData.summary.passedTests++;
                suiteData.passed++;
                break;
              case 'failed':
                reportData.summary.failedTests++;
                suiteData.failed++;
                break;
              case 'skipped':
                reportData.summary.skippedTests++;
                suiteData.skipped++;
                break;
            }
          });
        });
      }

      reportData.summary.totalDuration += suiteData.duration;
      reportData.testSuites.push(suiteData);
      reportData.summary.totalTestSuites++;
    });
  }
}

/**
 * Process skill test results
 */
function processSkillResults(skillResults, reportData) {
  // Merge skill results with Playwright results
  if (skillResults.testResults) {
    skillResults.testResults.forEach(skillResult => {
      const existingSuite = reportData.testSuites.find(s => s.name === skillResult.name);

      if (existingSuite) {
        // Update existing suite with skill data
        existingSuite.skillTested = true;
        existingSuite.skillSuccess = skillResult.success;
        existingSuite.skillDuration = skillResult.duration;
        existingSuite.skillError = skillResult.error || null;
      } else {
        // Add new suite from skill results
        reportData.testSuites.push({
          name: skillResult.name,
          skillTested: true,
          success: skillResult.success,
          duration: skillResult.duration,
          error: skillResult.error || null,
          passed: skillResult.success ? 1 : 0,
          failed: skillResult.success ? 0 : 1,
          tests: [{
            title: skillResult.name,
            status: skillResult.success ? 'passed' : 'failed',
            duration: skillResult.duration,
            error: skillResult.error || null
          }]
        });

        reportData.summary.totalTestSuites++;
        reportData.summary.totalTests++;

        if (skillResult.success) {
          reportData.summary.passedTests++;
        } else {
          reportData.summary.failedTests++;
        }

        reportData.summary.totalDuration += skillResult.duration;
      }
    });
  }

  // Merge performance metrics
  if (skillResults.performanceMetrics) {
    Object.assign(reportData.performanceMetrics, skillResults.performanceMetrics);
  }

  // Merge recommendations
  if (skillResults.recommendations) {
    reportData.recommendations.push(...skillResults.recommendations);
  }
}

/**
 * Generate intelligent recommendations based on test results
 */
function generateRecommendations(reportData) {
  const { summary, testSuites } = reportData;
  const passRate = summary.totalTests > 0 ? (summary.passedTests / summary.totalTests) * 100 : 0;

  // Overall health recommendations
  if (passRate < 80) {
    reportData.recommendations.push({
      type: 'critical',
      category: 'test-health',
      title: 'Low Test Pass Rate',
      description: `Only ${passRate.toFixed(1)}% of tests are passing. Consider reviewing failing tests and fixing critical issues.`,
      priority: 'high',
      action: 'Review failing tests and prioritize fixes'
    });
  }

  // Performance recommendations
  if (summary.totalDuration > 300000) { // 5 minutes
    reportData.recommendations.push({
      type: 'performance',
      category: 'test-speed',
      title: 'Slow Test Execution',
      description: `Tests took ${Math.round(summary.totalDuration / 1000)}s to complete. Consider optimizing test performance.`,
      priority: 'medium',
      action: 'Review test performance and optimize slow tests'
    });
  }

  // Specific suite recommendations
  testSuites.forEach(suite => {
    if (suite.failed > 0 && suite.failed / (suite.passed + suite.failed) > 0.5) {
      reportData.recommendations.push({
        type: 'suite-specific',
        category: 'suite-health',
        title: `Issues in ${suite.name}`,
        description: `${suite.name} has ${suite.failed} failing tests out of ${suite.passed + suite.failed} total.`,
        priority: 'high',
        action: `Focus on fixing ${suite.name} test suite`,
        suite: suite.name
      });
    }
  });

  // Environment recommendations
  if (reportData.environment && reportData.environment.browserInfo) {
    const { browserInfo } = reportData.environment;
    if (browserInfo.error) {
      reportData.recommendations.push({
        type: 'environment',
        category: 'browser-setup',
        title: 'Browser Setup Issues',
        description: 'There may be issues with browser installation or configuration.',
        priority: 'medium',
        action: 'Run npx playwright install to ensure browsers are properly installed'
      });
    }
  }
}

/**
 * Generate human-readable summary report
 */
async function generateHumanReadableSummary(reportData) {
  const { summary, testSuites, recommendations } = reportData;
  const passRate = summary.totalTests > 0 ? (summary.passedTests / summary.totalTests) * 100 : 0;

  const markdownReport = `
# User Flow Testing Summary Report

**Generated:** ${new Date().toLocaleString()}
**Application:** Pomo-Flow Vue.js Application
**Test Environment:** User Flow Testing Suite

## 📊 Test Summary

| Metric | Value |
|--------|-------|
| Total Test Suites | ${summary.totalTestSuites} |
| Total Tests | ${summary.totalTests} |
| Passed | ${summary.passedTests} |
| Failed | ${summary.failedTests} |
| Skipped | ${summary.skippedTests} |
| Pass Rate | ${passRate.toFixed(1)}% |
| Total Duration | ${Math.round(summary.totalDuration / 1000)}s |

## 🧪 Test Suite Results

${testSuites.map(suite => `
### ${suite.name}

- **Status:** ${suite.failed === 0 ? '✅ PASSED' : '❌ FAILED'}
- **Tests:** ${suite.passed + suite.failed} (${suite.passed} passed, ${suite.failed} failed${suite.skipped > 0 ? `, ${suite.skipped} skipped` : ''})
- **Duration:** ${Math.round((suite.duration || 0) / 1000)}s
${suite.error ? `- **Error:** ${suite.error}` : ''}
`).join('')}

## 🔧 Recommendations

${recommendations.length > 0 ? recommendations.map(rec => `
### ${rec.title} (${rec.priority.toUpperCase()})

**Category:** ${rec.category}
**Type:** ${rec.type}

${rec.description}

**Action:** ${rec.action}
`).join('') : '🎉 No recommendations - all tests passed perfectly!'}

## 📈 Next Steps

1. **Fix High Priority Issues** - Address any critical recommendations first
2. **Review Failed Tests** - Investigate test failures and fix underlying issues
3. **Performance Optimization** - If tests are slow, consider optimization strategies
4. **Regular Testing** - Schedule regular user flow testing to catch regressions early

---

*This report was generated automatically by the User Flow Testing Skill for Pomo-Flow.*
`;

  const summaryPath = path.join(process.cwd(), 'docs', 'reports', 'user-flow-summary.md');
  fs.writeFileSync(summaryPath, markdownReport);
}

/**
 * Clean up temporary test data
 */
async function cleanupTempData() {
  console.log('🧹 Cleaning up temporary test data...');

  const tempDirs = [
    path.join(process.cwd(), 'tests', 'temp'),
    path.join(process.cwd(), 'docs', 'reports', 'temp'),
    path.join(process.cwd(), '.tmp')
  ];

  tempDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`⚠️  Could not remove temp directory ${dir}:`, error.message);
      }
    }
  });

  console.log('✅ Temporary test data cleaned up');
}

/**
 * Archive test results if they exceed size limits
 */
async function archiveTestResults() {
  console.log('📦 Archiving test results...');

  const testResultsDir = path.join(process.cwd(), 'docs', 'reports');
  const archiveDir = path.join(testResultsDir, 'archive');

  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  // Get total size of test results
  let totalSize = 0;
  const files = [];

  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        scanDirectory(itemPath);
      } else {
        totalSize += stat.size;
        files.push({
          path: itemPath,
          size: stat.size,
          mtime: stat.mtime
        });
      }
    });
  }

  try {
    scanDirectory(testResultsDir);

    // If total size exceeds 100MB, archive old files
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (totalSize > maxSize) {
      console.log(`📦 Test results size (${Math.round(totalSize / 1024 / 1024)}MB) exceeds limit, archiving old files...`);

      // Sort files by modification time (oldest first)
      files.sort((a, b) => a.mtime - b.mtime);

      // Archive files until we're under the limit
      const targetSize = maxSize * 0.7; // Target 70% of max size
      let currentSize = totalSize;

      for (const file of files) {
        if (currentSize <= targetSize) break;

        // Don't archive current reports
        if (file.path.includes('comprehensive-test-report.json') ||
            file.path.includes('user-flow-summary.md') ||
            file.path.includes('archive')) {
          continue;
        }

        try {
          const relativePath = path.relative(testResultsDir, file.path);
          const archivePath = path.join(archiveDir, relativePath);
          const archiveDirPath = path.dirname(archivePath);

          // Create archive directory if needed
          if (!fs.existsSync(archiveDirPath)) {
            fs.mkdirSync(archiveDirPath, { recursive: true });
          }

          // Move file to archive
          fs.renameSync(file.path, archivePath);
          currentSize -= file.size;

        } catch (error) {
          console.warn(`⚠️  Could not archive file ${file.path}:`, error.message);
        }
      }

      console.log(`✅ Archived ${Math.round((totalSize - currentSize) / 1024 / 1024)}MB of test results`);
    }
  } catch (error) {
    console.warn('⚠️  Could not archive test results:', error.message);
  }
}

/**
 * Generate performance summary
 */
async function generatePerformanceSummary() {
  console.log('📊 Generating performance summary...');

  const performanceData = {
    testExecution: {
      totalDuration: 0,
      averageSuiteDuration: 0,
      slowestSuite: null,
      fastestSuite: null
    },
    systemInfo: {
      platform: process.platform,
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    generatedAt: new Date().toISOString()
  };

  const testResultsDir = path.join(process.cwd(), 'docs', 'reports');
  const comprehensiveReportPath = path.join(testResultsDir, 'comprehensive-test-report.json');

  if (fs.existsSync(comprehensiveReportPath)) {
    try {
      const report = JSON.parse(fs.readFileSync(comprehensiveReportPath, 'utf8'));
      const { testSuites } = report;

      if (testSuites && testSuites.length > 0) {
        performanceData.testExecution.totalDuration = report.summary.totalDuration;
        performanceData.testExecution.averageSuiteDuration = report.summary.totalDuration / testSuites.length;

        const sortedSuites = testSuites
          .filter(suite => suite.duration)
          .sort((a, b) => b.duration - a.duration);

        if (sortedSuites.length > 0) {
          performanceData.testExecution.slowestSuite = {
            name: sortedSuites[0].name,
            duration: sortedSuites[0].duration
          };

          performanceData.testExecution.fastestSuite = {
            name: sortedSuites[sortedSuites.length - 1].name,
            duration: sortedSuites[sortedSuites.length - 1].duration
          };
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not read comprehensive report for performance summary:', error.message);
    }
  }

  const performanceSummaryPath = path.join(testResultsDir, 'performance-summary.json');
  fs.writeFileSync(performanceSummaryPath, JSON.stringify(performanceData, null, 2));

  console.log('✅ Performance summary generated');
}

/**
 * Cleanup browser resources and processes
 */
async function cleanupBrowserResources() {
  console.log('🧹 Cleaning up browser resources...');

  try {
    const { spawn } = require('child_process');

    // Kill any remaining browser processes started by tests
    const commands = [
      process.platform === 'win32' ? 'taskkill /F /IM chrome.exe' : 'pkill -f chrome',
      process.platform === 'win32' ? 'taskkill /F /IM firefox.exe' : 'pkill -f firefox',
      process.platform === 'win32' ? 'taskkill /F /IM webkit.exe' : 'pkill -f webkit',
      'pkill -f playwright'
    ];

    for (const command of commands) {
      try {
        await new Promise((resolve, reject) => {
          const process = spawn(command, { shell: true, stdio: 'pipe' });
          process.on('close', resolve);
          process.on('error', reject);
        });
      } catch (error) {
        // Commands may fail if processes don't exist - that's okay
      }
    }

    console.log('✅ Browser resources cleaned up');
  } catch (error) {
    console.warn('⚠️  Could not clean up browser resources:', error.message);
  }
}

module.exports = globalTeardown;