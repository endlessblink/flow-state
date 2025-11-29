/**
 * Fix Recommendation Engine
 * Analyzes test failures and provides intelligent fix recommendations
 */

class FixRecommendationEngine {
  constructor() {
    this.recommendationPatterns = this.initializeRecommendationPatterns();
    this.contextAnalyzers = this.initializeContextAnalyzers();
  }

  /**
   * Initialize recommendation patterns for common issues
   */
  initializeRecommendationPatterns() {
    return {
      // Element not found patterns
      elementNotFound: {
        patterns: [
          /selector.*not found/i,
          /element.*not visible/i,
          /no element matching/i,
          /timeout.*waiting for/i
        ],
        recommendations: [
          {
            priority: 'high',
            category: 'selector-issues',
            title: 'Element Not Found',
            description: 'Test selector is not finding the expected element',
            fixes: [
              'Verify data-testid attributes are properly set on Vue components',
              'Check if element is rendered conditionally and update test logic',
              'Add proper waiting for element to appear',
              'Verify selector syntax matches actual DOM structure'
            ],
            codeExamples: [
              {
                language: 'vue',
                code: `<!-- Add data-testid to Vue component -->
<button data-testid="add-task-button" @click="addTask">
  Add Task
</button>`
              },
              {
                language: 'javascript',
                code: `// Wait for element properly
await page.waitForSelector('[data-testid="add-task-button"]', {
  state: 'visible',
  timeout: 10000
});`
              }
            ],
            vueComponents: [
              'TaskCard.vue',
              'Button.vue',
              'Modal.vue'
            ]
          }
        ]
      },

      // Timeout patterns
      timeoutIssues: {
        patterns: [
          /timeout.*exceeded/i,
          /waiting.*timed out/i,
          /operation.*timeout/i,
          /navigation timeout/i
        ],
        recommendations: [
          {
            priority: 'high',
            category: 'performance',
            title: 'Performance Timeout',
            description: 'Operation is taking longer than expected timeout',
            fixes: [
              'Increase timeout values for slow operations',
              'Optimize application performance',
              'Add proper loading state indicators',
              'Check for infinite loops or blocked operations'
            ],
            codeExamples: [
              {
                language: 'javascript',
                code: `// Increase timeout in Playwright config
module.exports = defineConfig({
  timeout: 60000, // Increase from default 30s
  expect: {
    timeout: 10000
  }
});`
              },
              {
                language: 'javascript',
                code: `// Add custom timeout for specific operations
await page.click('[data-testid="slow-button"]', {
  timeout: 30000
});`
              }
            ],
            vueComponents: [
              'App.vue',
              'Router components'
            ]
          }
        ]
      },

      // Network request patterns
      networkIssues: {
        patterns: [
          /network error/i,
          /fetch failed/i,
          /connection refused/i,
          /server error/i
        ],
        recommendations: [
          {
            priority: 'high',
            category: 'api-issues',
            title: 'Network Connection Issues',
            description: 'Unable to connect to development server or API endpoints',
            fixes: [
              'Ensure development server is running (npm run dev)',
              'Check if IndexedDB is properly initialized',
              'Verify API endpoints are accessible',
              'Check for CORS or CSP issues'
            ],
            codeExamples: [
              {
                language: 'bash',
                code: `# Start development server
npm run dev

# Check if server is running
curl http://localhost:5546`
              },
              {
                language: 'javascript',
                code: `// Wait for server in test setup
async function waitForServer(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fetch('http://localhost:5546');
      return true;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Server not ready');
}`
              }
            ],
            vueComponents: [
              'Main API services',
              'Database initialization'
            ]
          }
        ]
      },

      // State management patterns
      stateManagementIssues: {
        patterns: [
          /state.*undefined/i,
          /store.*not initialized/i,
          /pinia.*error/i,
          /reactivity.*lost/i
        ],
        recommendations: [
          {
            priority: 'medium',
            category: 'state-management',
            title: 'Pinia Store Issues',
            description: 'State management store not properly initialized or accessed',
            fixes: [
              'Ensure Pinia stores are properly initialized before tests',
              'Check if composables are used correctly in Vue components',
              'Verify store injection in test environment',
              'Reset store state between tests'
            ],
            codeExamples: [
              {
                language: 'javascript',
                code: `// Initialize Pinia in test setup
import { createPinia, setActivePinia } from 'pinia';

beforeEach(() => {
  setActivePinia(createPinia());
});`
              },
              {
                language: 'javascript',
                code: `// Reset store state in tests
afterEach(() => {
  const taskStore = useTaskStore();
  taskStore.$reset();
});`
              }
            ],
            vueComponents: [
              'All components using stores',
              'Composables with state management'
            ]
          }
        ]
      },

      // Vue component mounting patterns
      componentMountingIssues: {
        patterns: [
          /component.*failed/i,
          /mount.*error/i,
          /vue.*render error/i,
          /template.*error/i
        ],
        recommendations: [
          {
            priority: 'medium',
            category: 'vue-components',
            title: 'Vue Component Rendering Issues',
            description: 'Component failed to render or mount properly',
            fixes: [
              'Check component props and required data',
              'Verify component dependencies are available',
              'Ensure template syntax is correct',
              'Check for missing imports or components'
            ],
            codeExamples: [
              {
                language: 'vue',
                code: `<template>
  <!-- Add proper error handling and props validation -->
  <div v-if="task" class="task-card">
    {{ task.title }}
  </div>
  <div v-else class="error">
    Task data not available
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
});
</script>`
              },
              {
                language: 'javascript',
                code: `// Provide test data for components
const wrapper = mount(TaskCard, {
  props: {
    task: {
      id: '1',
      title: 'Test Task',
      status: 'planned'
    }
  }
});`
              }
            ],
            vueComponents: [
              'TaskCard.vue',
              'BoardView.vue',
              'CanvasView.vue'
            ]
          }
        ]
      },

      // Database/persistence patterns
      databaseIssues: {
        patterns: [
          /indexeddb.*error/i,
          /localforage.*error/i,
          /storage.*error/i,
          /persistence.*failed/i
        ],
        recommendations: [
          {
            priority: 'medium',
            category: 'database',
            title: 'Database Persistence Issues',
            description: 'Unable to access or write to IndexedDB/local storage',
            fixes: [
              'Clear browser storage before tests',
              'Check browser permissions for storage',
              'Ensure database schema is up to date',
              'Handle database errors gracefully'
            ],
            codeExamples: [
              {
                language: 'javascript',
                code: `// Clear storage in test setup
beforeEach(async () => {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    indexedDB.deleteDatabase('pomo-flow-db');
  });
});`
              },
              {
                language: 'javascript',
                code: `// Mock database for tests
const mockDatabase = {
  tasks: [],
  projects: [],
  save: async (data) => { /* mock implementation */ },
  load: async (key) => { /* mock implementation */ }
};`
              }
            ],
            vueComponents: [
              'Database composables',
              'Persistence logic'
            ]
          }
        ]
      }
    };
  }

  /**
   * Initialize context analyzers
   */
  initializeContextAnalyzers() {
    return {
      fileAnalyzer: new FileContextAnalyzer(),
      vueAnalyzer: new VueComponentAnalyzer(),
      testAnalyzer: new TestContextAnalyzer(),
      performanceAnalyzer: new PerformanceAnalyzer()
    };
  }

  /**
   * Analyze test failure and generate recommendations
   */
  analyzeFailure(failure) {
    const recommendations = [];

    // Extract error information
    const errorInfo = this.extractErrorInfo(failure);

    // Match against patterns
    const patternMatches = this.matchErrorPatterns(errorInfo);

    // Generate recommendations for each pattern match
    patternMatches.forEach(match => {
      const baseRecommendation = match.recommendation;
      const contextualRecommendation = this.addContextualInfo(
        baseRecommendation,
        errorInfo,
        match.context
      );

      recommendations.push(contextualRecommendation);
    });

    // Add performance recommendations if needed
    const performanceRecs = this.analyzePerformanceContext(errorInfo);
    recommendations.push(...performanceRecs);

    // Add Vue-specific recommendations
    const vueRecs = this.analyzeVueContext(errorInfo);
    recommendations.push(...vueRecs);

    // Prioritize and sort recommendations
    return this.prioritizeRecommendations(recommendations);
  }

  /**
   * Extract relevant error information
   */
  extractErrorInfo(failure) {
    return {
      message: failure.error || failure.message || '',
      stack: failure.stack || '',
      testSuite: failure.testSuite || failure.name || '',
      testName: failure.testName || '',
      duration: failure.duration || 0,
      timestamp: failure.timestamp || new Date().toISOString(),
      selector: this.extractSelector(failure.error || ''),
      component: this.extractComponent(failure.error || ''),
      view: this.extractView(failure.testSuite || '')
    };
  }

  /**
   * Extract selector from error message
   */
  extractSelector(errorMessage) {
    const selectorMatch = errorMessage.match(/selector[:\s]+([^\s\]]+)/);
    return selectorMatch ? selectorMatch[1] : null;
  }

  /**
   * Extract component name from error
   */
  extractComponent(errorMessage) {
    const componentMatch = errorMessage.match(/component[:\s]+([A-Z][a-zA-Z]+)/);
    return componentMatch ? componentMatch[1] : null;
  }

  /**
   * Extract view name from test suite
   */
  extractView(testSuite) {
    const viewMatch = testSuite.match(/(Board|Calendar|Canvas|Timer|Navigation)/i);
    return viewMatch ? viewMatch[1] : null;
  }

  /**
   * Match error against known patterns
   */
  matchErrorPatterns(errorInfo) {
    const matches = [];

    Object.entries(this.recommendationPatterns).forEach(([patternType, patternData]) => {
      patternData.patterns.forEach(pattern => {
        if (pattern.test(errorInfo.message)) {
          patternData.recommendations.forEach(rec => {
            matches.push({
              patternType,
              recommendation: { ...rec },
              context: {
                selector: errorInfo.selector,
                component: errorInfo.component,
                view: errorInfo.view,
                testSuite: errorInfo.testSuite
              }
            });
          });
        }
      });
    });

    return matches;
  }

  /**
   * Add contextual information to recommendations
   */
  addContextualInfo(recommendation, errorInfo, context) {
    const contextual = { ...recommendation };

    // Add view-specific information
    if (context.view) {
      contextual.viewContext = this.getViewSpecificContext(context.view);
    }

    // Add component-specific information
    if (context.component) {
      contextual.componentContext = this.getComponentSpecificContext(context.component);
    }

    // Add selector-specific fixes
    if (context.selector) {
      contextual.selectorFixes = this.getSelectorFixes(context.selector);
    }

    // Add file-specific recommendations
    if (errorInfo.testSuite) {
      contextual.fileRecommendations = this.getFileSpecificRecommendations(errorInfo.testSuite);
    }

    return contextual;
  }

  /**
   * Get view-specific context
   */
  getViewSpecificContext(view) {
    const viewContexts = {
      Board: {
        commonIssues: ['Kanban column rendering', 'Task card interactions', 'Drag and drop'],
        selectors: [
          '[data-testid="kanban-column"]',
          '[data-testid="task-card"]',
          '[data-testid="column-header"]'
        ],
        vueComponents: ['BoardView.vue', 'TaskCard.vue', 'KanbanColumn.vue']
      },
      Canvas: {
        commonIssues: ['Node positioning', 'Connection rendering', 'Section collapse'],
        selectors: [
          '[data-testid="canvas-task-node"]',
          '[data-testid="task-connection"]',
          '[data-testid="canvas-section"]'
        ],
        vueComponents: ['CanvasView.vue', 'TaskNode.vue', 'CanvasSection.vue']
      },
      Calendar: {
        commonIssues: ['Date navigation', 'Task scheduling', 'Recurring tasks'],
        selectors: [
          '[data-testid="calendar-date"]',
          '[data-testid="calendar-task"]',
          '[data-testid="date-navigation"]'
        ],
        vueComponents: ['CalendarView.vue', 'CalendarDay.vue', 'TaskScheduler.vue']
      },
      Timer: {
        commonIssues: ['Timer state management', 'Session tracking', 'Notifications'],
        selectors: [
          '[data-testid="timer-display"]',
          '[data-testid="timer-controls"]',
          '[data-testid="session-indicator"]'
        ],
        vueComponents: ['TimerView.vue', 'PomodoroTimer.vue', 'SessionTracker.vue']
      },
      Navigation: {
        commonIssues: ['View switching', 'Route handling', 'State preservation'],
        selectors: [
          '[data-testid="nav-board"]',
          '[data-testid="nav-canvas"]',
          '[data-testid="nav-calendar"]'
        ],
        vueComponents: ['App.vue', 'Navigation.vue', 'Router components']
      }
    };

    return viewContexts[view] || {};
  }

  /**
   * Get component-specific context
   */
  getComponentSpecificContext(component) {
    // This would analyze the specific Vue component file
    // and provide component-specific recommendations
    return {
      file: `src/components/${component}.vue`,
      issues: this.analyzeComponentIssues(component),
      fixes: this.getComponentFixes(component)
    };
  }

  /**
   * Get selector-specific fixes
   */
  getSelectorFixes(selector) {
    const fixes = [];

    if (selector && selector.includes('data-testid')) {
      fixes.push({
        type: 'selector-fix',
        description: 'Verify data-testid is properly set in Vue component',
        code: `<button data-testid="add-task-button">Add Task</button>`
      });
    }

    if (selector && selector.includes(':')) {
      fixes.push({
        type: 'css-selector-fix',
        description: 'Consider using data-testid instead of complex CSS selectors',
        code: `// Instead of: await page.click('.task-list > li:first-child > button')
// Use: await page.click('[data-testid="add-task-button"]')`
      });
    }

    return fixes;
  }

  /**
   * Get file-specific recommendations
   */
  getFileSpecificRecommendations(testSuite) {
    const fileRecs = [];

    if (testSuite.includes('canvas')) {
      fileRecs.push({
        type: 'canvas-specific',
        description: 'Canvas tests may need special setup for Vue Flow integration',
        code: `// Wait for Vue Flow to initialize
await page.waitForSelector('[data-testid="vue-flow-container"]');`
      });
    }

    if (testSuite.includes('timer')) {
      fileRecs.push({
        type: 'timer-specific',
        description: 'Timer tests should mock time for consistent results',
        code: `// Mock timer for tests
await page.evaluate(() => {
  Date.now = () => new Date('2025-01-01T00:00:00').getTime();
});`
      });
    }

    return fileRecs;
  }

  /**
   * Analyze performance context
   */
  analyzePerformanceContext(errorInfo) {
    const recommendations = [];

    if (errorInfo.duration > 30000) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        title: 'Slow Test Execution',
        description: `Test took ${Math.round(errorInfo.duration / 1000)}s to complete`,
        fixes: [
          'Optimize test logic to reduce execution time',
          'Use mocking for expensive operations',
          'Consider parallel test execution',
          'Add performance assertions'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Analyze Vue-specific context
   */
  analyzeVueContext(errorInfo) {
    const recommendations = [];

    // Add Vue-specific recommendations based on error patterns
    if (errorInfo.message.includes('reactivity')) {
      recommendations.push({
        priority: 'medium',
        category: 'vue-reactivity',
        title: 'Vue Reactivity Issues',
        description: 'Vue reactivity system not working as expected',
        fixes: [
          'Ensure reactive variables are properly defined with ref() or reactive()',
          'Check computed properties have proper dependencies',
          'Verify watch statements have correct syntax',
          'Use nextTick() for DOM updates after reactivity changes'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Prioritize recommendations by severity and relevance
   */
  prioritizeRecommendations(recommendations) {
    const priorityOrder = { high: 1, medium: 2, low: 3 };

    return recommendations
      .sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // Secondary sort by relevance score
        return (b.relevanceScore || 0) - (a.relevanceScore || 0);
      })
      .slice(0, 10); // Limit to top 10 recommendations
  }

  /**
   * Generate comprehensive report
   */
  generateReport(testResults) {
    const allRecommendations = [];

    testResults.forEach(result => {
      if (!result.success) {
        const recommendations = this.analyzeFailure(result);
        allRecommendations.push(...recommendations);
      }
    });

    // Remove duplicates and group by category
    const groupedRecommendations = this.groupRecommendations(allRecommendations);

    return {
      summary: this.generateSummary(groupedRecommendations),
      recommendations: groupedRecommendations,
          overallHealth: this.calculateOverallHealth(testResults, groupedRecommendations)
    };
  }

  /**
   * Group recommendations by category
   */
  groupRecommendations(recommendations) {
    const grouped = {};

    recommendations.forEach(rec => {
      const key = `${rec.category}-${rec.title}`;
      if (!grouped[key]) {
        grouped[key] = {
          ...rec,
          occurrences: 0,
          affectedTests: []
        };
      }
      grouped[key].occurrences++;
      grouped[key].affectedTests.push(rec.testSuite);
    });

    return Object.values(grouped);
  }

  /**
   * Generate summary of recommendations
   */
  generateSummary(groupedRecommendations) {
    const highPriority = groupedRecommendations.filter(r => r.priority === 'high').length;
    const mediumPriority = groupedRecommendations.filter(r => r.priority === 'medium').length;
    const lowPriority = groupedRecommendations.filter(r => r.priority === 'low').length;

    return {
      totalRecommendations: groupedRecommendations.length,
      highPriority,
      mediumPriority,
      lowPriority,
      categories: [...new Set(groupedRecommendations.map(r => r.category))]
    };
  }

  /**
   * Calculate overall application health score
   */
  calculateOverallHealth(testResults, recommendations) {
    const passRate = testResults.filter(r => r.success).length / testResults.length;
    const criticalIssues = recommendations.filter(r => r.priority === 'high').length;

    let healthScore = passRate * 100;

    // Deduct points for critical issues
    healthScore -= criticalIssues * 10;

    // Deduct points for medium issues
    const mediumIssues = recommendations.filter(r => r.priority === 'medium').length;
    healthScore -= mediumIssues * 5;

    return Math.max(0, Math.min(100, healthScore));
  }
}

// Helper analyzer classes
class FileContextAnalyzer {
  analyze(filePath) {
    // Analyze Vue component file and return context
    return {
      file: filePath,
      lines: 0,
      components: [],
      imports: [],
      exports: []
    };
  }
}

class VueComponentAnalyzer {
  analyze(componentName) {
    // Analyze Vue component structure
    return {
      name: componentName,
      props: [],
      emits: [],
      composables: [],
      templateElements: []
    };
  }

  analyzeComponentIssues(componentName) {
    // Return common issues for specific component
    return [];
  }

  getComponentFixes(componentName) {
    // Return specific fixes for component
    return [];
  }
}

class TestContextAnalyzer {
  analyze(testSuite) {
    // Analyze test file and return context
    return {
      testSuite,
      testCount: 0,
      assertions: [],
      fixtures: []
    };
  }
}

class PerformanceAnalyzer {
  analyze(testResults) {
    // Analyze performance across all tests
    return {
      averageDuration: 0,
      slowestTest: null,
      fastestTest: null,
      totalDuration: 0
    };
  }
}

module.exports = FixRecommendationEngine;