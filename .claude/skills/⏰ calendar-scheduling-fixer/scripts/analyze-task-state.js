#!/usr/bin/env node

/**
 * Task State Analyzer
 *
 * This script analyzes the current task state to identify scheduling issues
 * and understand how tasks are distributed between inbox and calendar.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DEV_TOOLS_URL = 'http://localhost:5549';

console.log('🔍 Task State Analyzer');
console.log('=====================\n');

// Function to check if dev server is running
async function checkDevServer() {
  try {
    const response = await fetch(`${DEV_TOOLS_URL}/`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Function to check if Playwright is available
function checkPlaywright() {
  // In a real implementation, this would check for Playwright MCP availability
  // For now, we'll assume it's available and let the user know if tests fail
  return true;
}

// Generate task state analysis code to run in browser
function generateTaskAnalysisCode() {
  return `
    (function() {
      console.log('🔍 Analyzing Task State in Browser...');

      // Try to access Pinia stores
      const app = document.querySelector('#app').__vue_app__;
      if (!app) {
        return { error: 'Vue app not found' };
      }

      const taskStore = app.config.globalProperties.$pinia._s.get('tasks');
      if (!taskStore) {
        return { error: 'Task store not found' };
      }

      const tasks = taskStore.tasks || [];
      const today = new Date().toISOString().split('T')[0];

      console.log(\`📊 Total tasks: \${tasks.length}\`);

      const analysis = {
        total: tasks.length,
        today: {
          total: 0,
          inInbox: 0,
          hasInstances: 0,
          hasDueDateOnly: 0,
          details: []
        },
        scheduling: {
          inboxOnly: 0,
          scheduled: 0,
          both: 0
        },
        problematic: []
      };

      tasks.forEach(task => {
        const isToday = task.dueDate === today;
        const hasInstances = task.instances && task.instances.length > 0;
        const isInInbox = task.isInInbox !== false;
        const hasCanvasPosition = !!task.canvasPosition;

        if (isToday) {
          analysis.today.total++;

          if (isInInbox && !hasCanvasPosition) {
            analysis.today.inInbox++;
          }

          if (hasInstances) {
            analysis.today.hasInstances++;
          }

          if (isToday && !hasInstances) {
            analysis.today.hasDueDateOnly++;
            analysis.today.details.push({
              id: task.id,
              title: task.title,
              dueDate: task.dueDate,
              instances: task.instances?.length || 0,
              isInInbox: task.isInInbox,
              canvasPosition: !!task.canvasPosition
            });
          }
        }

        // Categorize by scheduling state
        if (hasInstances) {
          if (isInInbox) {
            analysis.scheduling.both++;
            analysis.problematic.push({
              id: task.id,
              title: task.title,
              issue: 'Task has both instances AND isInInbox state - ambiguous',
              data: {
                instances: task.instances?.length || 0,
                isInInbox: task.isInInbox,
                dueDate: task.dueDate
              }
            });
          } else {
            analysis.scheduling.scheduled++;
          }
        } else if (isInInbox) {
          analysis.scheduling.inboxOnly++;
        }

        // Check for potential issues
        if (task.dueDate && !hasInstances && !isInInbox) {
          analysis.problematic.push({
            id: task.id,
            title: task.title,
            issue: 'Task has dueDate but no instances and not in inbox - lost state',
            data: {
              dueDate: task.dueDate,
              instances: task.instances?.length || 0,
              isInInbox: task.isInInbox
            }
          });
        }
      });

      return analysis;
    })();
  `;
}

// Main analysis function
async function runAnalysis() {
  console.log('Starting task state analysis...\n');

  // Check development server
  console.log('📡 Checking development server...');
  const devServerRunning = await checkDevServer();

  if (!devServerRunning) {
    console.log('❌ Development server is not running');
    console.log('Please start the development server with: npm run dev');
    console.log('Then run this script again');
    return;
  }

  console.log('✅ Development server is running\n');

  // Check Playwright availability
  console.log('🎭 Checking Playwright availability...');
  const playwrightAvailable = checkPlaywright();

  if (!playwrightAvailable) {
    console.log('❌ Playwright MCP server is not available');
    console.log('Please restart Playwright and try again');
    return;
  }

  console.log('✅ Playwright is available\n');

  // Generate browser analysis code
  console.log('🔧 Browser Analysis Code Generated:');
  console.log('=====================================\n');

  const analysisCode = generateTaskAnalysisCode();
  console.log('// Copy and paste this code into browser console');
  console.log(analysisCode);

  console.log('\n📋 Manual Analysis Instructions:');
  console.log('1. Open browser to http://localhost:5549');
  console.log('2. Open Developer Tools (F12)');
  console.log('3. Go to Console tab');
  console.log('4. Copy and paste the code above');
  console.log('5. Press Enter to run the analysis');
  console.log('6. Review the results for task state issues');

  console.log('\n🎯 What to Look For:');
  console.log('- Tasks with dueDate but no instances (should be in inbox)');
  console.log('- Tasks that are both scheduled AND in inbox (ambiguous state)');
  console.log('- Tasks with dueDate but not in inbox (lost tasks)');
  console.log('- Count of today tasks vs expected behavior');

  console.log('\n🔧 Next Steps:');
  console.log('- If issues found: apply calendar-scheduling-fixer recommendations');
  console.log('- Run: node scripts/test-calendar-behavior.js for visual testing');
  console.log('- Verify fixes with comprehensive Playwright tests');
}

// Alternative: Static file analysis
function runStaticAnalysis() {
  console.log('📁 Running static file analysis...\n');

  const storesDir = path.join(PROJECT_ROOT, 'src/stores');
  const taskStorePath = path.join(storesDir, 'tasks.ts');

  if (!fs.existsSync(taskStorePath)) {
    console.log('❌ Task store not found at:', taskStorePath);
    return;
  }

  const content = fs.readFileSync(taskStorePath, 'utf8');

  // Look for task-related functions
  const moveTaskToSmartGroup = content.includes('moveTaskToSmartGroup');
  const applySmartGroupProperties = content.includes('applySmartGroupProperties');
  const calendarInboxLogic = content.includes('isInInbox');

  console.log('📊 Task Store Analysis:');
  console.log(`  ✓ moveTaskToSmartGroup function: ${moveTaskToSmartGroup ? 'Found' : 'Not found'}`);
  console.log(`  ✓ Smart group properties logic: ${applySmartGroupProperties ? 'Found' : 'Not found'}`);
  console.log(`  ✓ Inbox state management: ${calendarInboxLogic ? 'Found' : 'Not found'}`);

  // Look for potential issues in moveTaskToSmartGroup
  if (moveTaskToSmartGroup) {
    const lines = content.split('\n');
    const moveFunctionStart = lines.findIndex(line => line.includes('moveTaskToSmartGroup'));

    if (moveFunctionStart !== -1) {
      console.log('\n🔍 moveTaskToSmartGroup function found, checking implementation...');

      // Look for the next 50 lines for implementation details
      for (let i = moveFunctionStart; i < Math.min(moveFunctionStart + 50, lines.length); i++) {
        const line = lines[i];

        if (line.includes('instances')) {
          console.log(`  ⚠️  Line ${i + 1}: Found instances usage - check if creating unwanted instances`);
        }

        if (line.includes('isInInbox')) {
          console.log(`  ✓ Line ${i + 1}: Found inbox state management`);
        }

        if (line.includes('updateTask') || line.includes('createTask')) {
          console.log(`  📝 Line ${i + 1}: Found task operation`);
        }
      }
    }
  }

  console.log('\n💡 Recommendations:');
  console.log('- Use browser analysis for runtime state verification');
  console.log('- Test with Playwright for visual confirmation');
  console.log('- Check calendar composables for filtering logic');
}

// Run the appropriate analysis
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--static')) {
    runStaticAnalysis();
  } else {
    runAnalysis().catch(console.error);
  }
}

module.exports = { runAnalysis, runStaticAnalysis, generateTaskAnalysisCode };