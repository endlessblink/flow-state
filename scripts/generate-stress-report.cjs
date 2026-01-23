#!/usr/bin/env node

/**
 * Stress Test Report Generator
 * TASK-338: Generate comprehensive HTML report from stress test results
 *
 * Usage: node scripts/generate-stress-report.cjs [--json results.json]
 */

const fs = require('fs');
const path = require('path');

const REPORT_DIR = path.join(__dirname, '..', 'reports', 'stress-test-report');
const RESULTS_FILE = path.join(REPORT_DIR, 'results.json');

// Parse command line args
const args = process.argv.slice(2);
const jsonIndex = args.indexOf('--json');
const resultsPath = jsonIndex !== -1 ? args[jsonIndex + 1] : RESULTS_FILE;

// Default test results structure
const defaultResults = {
  timestamp: new Date().toISOString(),
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
  },
  categories: {
    'Data Integrity': { total: 0, passed: 0, failed: 0, tests: [] },
    Security: { total: 0, passed: 0, failed: 0, tests: [] },
    'Restore Verification': { total: 0, passed: 0, failed: 0, tests: [] },
    'Container Stability': { total: 0, passed: 0, failed: 0, tests: [] },
    Performance: { total: 0, passed: 0, failed: 0, tests: [] },
  },
  failures: [],
  warnings: [],
  recommendations: [],
};

// Load results if they exist
let results = defaultResults;
if (fs.existsSync(resultsPath)) {
  try {
    const data = fs.readFileSync(resultsPath, 'utf8');
    results = { ...defaultResults, ...JSON.parse(data) };
  } catch (e) {
    console.log('Could not parse results file, using defaults');
  }
}

// Check for Playwright JSON results
const playwrightResultsPath = path.join(REPORT_DIR, 'results.json');
if (fs.existsSync(playwrightResultsPath) && playwrightResultsPath !== resultsPath) {
  try {
    const pwData = JSON.parse(fs.readFileSync(playwrightResultsPath, 'utf8'));
    // Merge Playwright results if available
    if (pwData.suites) {
      parsePlaywrightResults(pwData, results);
    }
  } catch {
    // Ignore parsing errors
  }
}

// Parse Playwright JSON output format
function parsePlaywrightResults(pwData, results) {
  function processSuite(suite, category = 'Unknown') {
    if (suite.title) {
      // Determine category from suite title
      if (suite.title.includes('Data Integrity')) category = 'Data Integrity';
      else if (suite.title.includes('Security')) category = 'Security';
      else if (suite.title.includes('Restore')) category = 'Restore Verification';
      else if (suite.title.includes('Container')) category = 'Container Stability';
      else if (suite.title.includes('Performance')) category = 'Performance';
    }

    if (suite.specs) {
      for (const spec of suite.specs) {
        results.summary.total++;
        results.categories[category] = results.categories[category] || {
          total: 0,
          passed: 0,
          failed: 0,
          tests: [],
        };
        results.categories[category].total++;

        const test = {
          title: spec.title,
          status: spec.ok ? 'passed' : 'failed',
          duration: spec.tests?.[0]?.results?.[0]?.duration || 0,
        };

        if (spec.ok) {
          results.summary.passed++;
          results.categories[category].passed++;
        } else {
          results.summary.failed++;
          results.categories[category].failed++;
          results.failures.push({
            test: spec.title,
            category,
            error: spec.tests?.[0]?.results?.[0]?.error?.message || 'Unknown error',
          });
        }

        results.categories[category].tests.push(test);
      }
    }

    if (suite.suites) {
      for (const sub of suite.suites) {
        processSuite(sub, category);
      }
    }
  }

  for (const suite of pwData.suites || []) {
    processSuite(suite);
  }
}

// Generate recommendations based on failures
function generateRecommendations(results) {
  const recs = [];

  // Data integrity issues
  const dataIntegrity = results.categories['Data Integrity'];
  if (dataIntegrity && dataIntegrity.failed > 0) {
    recs.push({
      priority: 'HIGH',
      category: 'Data Integrity',
      message: 'Data integrity tests failed. Check sync logic and persistence layer.',
      action: 'Review useSupabaseDatabase.ts and task store CRUD operations.',
    });
  }

  // Security issues
  const security = results.categories['Security'];
  if (security && security.failed > 0) {
    recs.push({
      priority: 'CRITICAL',
      category: 'Security',
      message: 'Security vulnerabilities detected!',
      action: 'Review XSS sanitization in all user inputs. Check SQL parameterization.',
    });
  }

  // Container issues
  const container = results.categories['Container Stability'];
  if (container && container.failed > 0) {
    recs.push({
      priority: 'MEDIUM',
      category: 'Container',
      message: 'Container stability issues detected.',
      action: 'Check Docker health checks and Supabase connection retry logic.',
    });
  }

  // Performance issues
  const perf = results.categories['Performance'];
  if (perf && perf.failed > 0) {
    recs.push({
      priority: 'MEDIUM',
      category: 'Performance',
      message: 'Performance benchmarks failed.',
      action: 'Profile slow operations and optimize hot paths.',
    });
  }

  // No failures - good job
  if (results.summary.failed === 0 && results.summary.total > 0) {
    recs.push({
      priority: 'INFO',
      category: 'Overall',
      message: 'All stress tests passed!',
      action: 'System is ready for release.',
    });
  }

  return recs;
}

// Generate HTML report
function generateHTML(results) {
  results.recommendations = generateRecommendations(results);

  const passRate =
    results.summary.total > 0
      ? ((results.summary.passed / results.summary.total) * 100).toFixed(1)
      : 0;

  const statusColor = results.summary.failed === 0 ? '#4CAF50' : '#f44336';
  const statusText = results.summary.failed === 0 ? 'PASSED' : 'FAILED';

  let categoryHTML = '';
  for (const [name, data] of Object.entries(results.categories)) {
    if (data.total === 0) continue;

    const catPassRate = ((data.passed / data.total) * 100).toFixed(0);
    const catColor = data.failed === 0 ? '#4CAF50' : data.failed > data.passed ? '#f44336' : '#ff9800';

    let testsHTML = '';
    for (const test of data.tests || []) {
      const icon = test.status === 'passed' ? '✓' : '✗';
      const color = test.status === 'passed' ? '#4CAF50' : '#f44336';
      testsHTML += `
        <div class="test-item">
          <span style="color: ${color}">${icon}</span>
          <span>${test.title}</span>
          <span class="duration">${test.duration}ms</span>
        </div>
      `;
    }

    categoryHTML += `
      <div class="category">
        <div class="category-header">
          <h3>${name}</h3>
          <div class="category-stats">
            <span style="color: ${catColor}">${data.passed}/${data.total}</span>
            <span class="pass-rate">(${catPassRate}%)</span>
          </div>
        </div>
        <div class="tests-list">
          ${testsHTML || '<div class="no-tests">No test results available</div>'}
        </div>
      </div>
    `;
  }

  let failuresHTML = '';
  for (const failure of results.failures) {
    failuresHTML += `
      <div class="failure-item">
        <div class="failure-test">${failure.test}</div>
        <div class="failure-category">${failure.category}</div>
        <div class="failure-error">${failure.error}</div>
      </div>
    `;
  }

  let recommendationsHTML = '';
  for (const rec of results.recommendations) {
    const priorityClass = rec.priority.toLowerCase();
    recommendationsHTML += `
      <div class="recommendation ${priorityClass}">
        <div class="rec-header">
          <span class="rec-priority">${rec.priority}</span>
          <span class="rec-category">${rec.category}</span>
        </div>
        <div class="rec-message">${rec.message}</div>
        <div class="rec-action"><strong>Action:</strong> ${rec.action}</div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlowState Stress Test Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      padding: 20px;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      color: #fff;
      margin-bottom: 10px;
      font-size: 2rem;
    }
    .timestamp {
      color: #888;
      margin-bottom: 30px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .summary-card {
      background: #16213e;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .summary-card h2 {
      font-size: 2.5rem;
      margin-bottom: 5px;
    }
    .summary-card p {
      color: #888;
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 1px;
    }
    .status-badge {
      display: inline-block;
      padding: 8px 24px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 1.2rem;
      background: ${statusColor};
      color: white;
    }
    .section {
      background: #16213e;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .section h2 {
      color: #fff;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #2a2a4a;
    }
    .category {
      margin-bottom: 20px;
      background: #1a1a3e;
      border-radius: 8px;
      padding: 16px;
    }
    .category-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .category h3 {
      color: #fff;
      font-size: 1.1rem;
    }
    .category-stats {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .pass-rate { color: #888; }
    .tests-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .test-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: #16213e;
      border-radius: 6px;
    }
    .duration {
      margin-left: auto;
      color: #666;
      font-size: 0.85rem;
    }
    .no-tests {
      color: #666;
      font-style: italic;
      text-align: center;
      padding: 20px;
    }
    .failure-item {
      background: #2a1a1a;
      border-left: 4px solid #f44336;
      padding: 16px;
      margin-bottom: 12px;
      border-radius: 4px;
    }
    .failure-test {
      color: #fff;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .failure-category {
      color: #888;
      font-size: 0.85rem;
      margin-bottom: 8px;
    }
    .failure-error {
      color: #f44336;
      font-family: monospace;
      font-size: 0.9rem;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .recommendation {
      padding: 16px;
      margin-bottom: 12px;
      border-radius: 8px;
      border-left: 4px solid;
    }
    .recommendation.critical {
      background: #2a1a1a;
      border-color: #f44336;
    }
    .recommendation.high {
      background: #2a2a1a;
      border-color: #ff9800;
    }
    .recommendation.medium {
      background: #1a2a2a;
      border-color: #00bcd4;
    }
    .recommendation.info {
      background: #1a2a1a;
      border-color: #4CAF50;
    }
    .rec-header {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
    }
    .rec-priority {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 0.85rem;
    }
    .critical .rec-priority { color: #f44336; }
    .high .rec-priority { color: #ff9800; }
    .medium .rec-priority { color: #00bcd4; }
    .info .rec-priority { color: #4CAF50; }
    .rec-category {
      color: #888;
      font-size: 0.85rem;
    }
    .rec-message {
      color: #fff;
      margin-bottom: 8px;
    }
    .rec-action {
      color: #aaa;
      font-size: 0.9rem;
    }
    .footer {
      text-align: center;
      color: #666;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #2a2a4a;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>FlowState Stress Test Report</h1>
    <div class="timestamp">Generated: ${results.timestamp}</div>

    <div class="summary">
      <div class="summary-card">
        <h2 style="color: ${statusColor}">${statusText}</h2>
        <p>Overall Status</p>
      </div>
      <div class="summary-card">
        <h2>${results.summary.total}</h2>
        <p>Total Tests</p>
      </div>
      <div class="summary-card">
        <h2 style="color: #4CAF50">${results.summary.passed}</h2>
        <p>Passed</p>
      </div>
      <div class="summary-card">
        <h2 style="color: ${results.summary.failed > 0 ? '#f44336' : '#4CAF50'}">${results.summary.failed}</h2>
        <p>Failed</p>
      </div>
      <div class="summary-card">
        <h2>${passRate}%</h2>
        <p>Pass Rate</p>
      </div>
    </div>

    <div class="section">
      <h2>Test Results by Category</h2>
      ${categoryHTML || '<div class="no-tests">No test results available. Run npm run test:stress first.</div>'}
    </div>

    ${
      results.failures.length > 0
        ? `
    <div class="section">
      <h2>Failures</h2>
      ${failuresHTML}
    </div>
    `
        : ''
    }

    <div class="section">
      <h2>Recommendations</h2>
      ${recommendationsHTML || '<div class="no-tests">Run tests to generate recommendations.</div>'}
    </div>

    <div class="footer">
      <p>TASK-338: Comprehensive Stress Testing Suite</p>
      <p>FlowState Productivity App</p>
    </div>
  </div>
</body>
</html>`;
}

// Ensure report directory exists
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

// Generate and write report
const html = generateHTML(results);
const outputPath = path.join(REPORT_DIR, 'index.html');
fs.writeFileSync(outputPath, html);

console.log(`Stress Test Report generated: ${outputPath}`);
console.log(`Summary: ${results.summary.passed}/${results.summary.total} passed`);

if (results.summary.failed > 0) {
  console.log(`\nFailures:`);
  for (const f of results.failures) {
    console.log(`  - ${f.test}: ${f.error.substring(0, 60)}...`);
  }
}

// Exit with error code if tests failed
process.exit(results.summary.failed > 0 ? 1 : 0);
