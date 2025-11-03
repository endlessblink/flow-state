#!/usr/bin/env node

import { SkillLogger } from './.claude/skill-logger.js';

async function testLogger() {
  console.log('Testing Skill Logger...');

  const logger = new SkillLogger();
  await logger.init();

  // Create a test log entry
  await logger.logSkillUsage(
    'test-skill',
    { test: true, message: 'Testing the skill logger' },
    'success',
    150
  );

  console.log('Test log entry created successfully!');

  // Test getting recent logs
  const recentLogs = await logger.getRecentLogs(5);
  console.log('Recent logs:', recentLogs.length);

  // Test getting metrics
  const metrics = await logger.getMetrics();
  console.log('Metrics:', Object.keys(metrics));

  console.log('Skill Logger test completed successfully!');
}

testLogger().catch(console.error);