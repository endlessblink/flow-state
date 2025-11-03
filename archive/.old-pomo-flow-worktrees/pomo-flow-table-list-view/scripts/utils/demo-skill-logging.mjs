#!/usr/bin/env node

import { SkillLogger } from './.claude/skill-logger.js';

async function demonstrateSkillLogging() {
  console.log('🚀 Demonstrating Claude Code Skill Logging System\n');

  const logger = new SkillLogger();
  await logger.init();

  // Demo skill calls with realistic parameters
  const demoSkills = [
    {
      name: 'comprehensive-testing',
      parameters: {
        testType: 'e2e',
        browser: 'chromium',
        timeout: 30000,
        headless: true
      },
      duration: 2500,
      outcome: 'success'
    },
    {
      name: 'port-manager',
      parameters: {
        action: 'check-port',
        port: 5546,
        service: 'productivity-app'
      },
      duration: 150,
      outcome: 'success'
    },
    {
      name: 'vue-development',
      parameters: {
        component: 'TaskCalendar',
        action: 'create',
        features: ['drag-drop', 'real-time-sync'],
        typescript: true
      },
      duration: 1800,
      outcome: 'success'
    },
    {
      name: 'comprehensive-testing',
      parameters: {
        testType: 'unit',
        coverage: true,
        threshold: 80
      },
      duration: 3200,
      outcome: 'success'
    },
    {
      name: 'port-manager',
      parameters: {
        action: 'kill-process',
        port: 5546,
        force: true
      },
      duration: 300,
      outcome: 'success'
    },
    {
      name: 'vue-development',
      parameters: {
        component: 'TaskModal',
        action: 'refactor',
        reason: 'performance-optimization'
      },
      duration: 4200,
      outcome: 'error',
      error: new Error('Build failed: Invalid prop type')
    }
  ];

  console.log('📝 Creating demo skill usage logs...\n');

  // Create log entries with some time variance
  for (let i = 0; i < demoSkills.length; i++) {
    const skill = demoSkills[i];

    console.log(`   • Logging ${skill.name}: ${skill.outcome} (${skill.duration}ms)`);

    await logger.logSkillUsage(
      skill.name,
      skill.parameters,
      skill.outcome,
      skill.duration,
      skill.error || null
    );

    // Small delay between logs
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n📊 Analyzing results...\n');

  // Get recent logs
  const recentLogs = await logger.getRecentLogs(10);
  console.log(`   • Recent log entries: ${recentLogs.length}`);

  // Get metrics
  const metrics = await logger.getMetrics();
  console.log('   • Skills with metrics:');
  for (const [skill, data] of Object.entries(metrics)) {
    const successRate = ((data.successfulCalls / data.totalCalls) * 100).toFixed(1);
    console.log(`     - ${skill}: ${data.totalCalls} calls, ${successRate}% success`);
  }

  console.log('\n✅ Demo completed successfully!');
  console.log('\n🎯 Next steps:');
  console.log('   1. View recent logs: npm run skill-logs:recent');
  console.log('   2. Check metrics: npm run skill-logs:metrics');
  console.log('   3. Analyze patterns: npm run skill-logs:analyze');
  console.log('   4. Launch dashboard: npm run skill-dashboard');
  console.log('   5. Open skill-usage-dashboard.html in your browser');
}

demonstrateSkillLogging().catch(console.error);