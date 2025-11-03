#!/usr/bin/env node

import { LogAnalyzer } from './.claude/utils/log-analyzer.js';

async function testAnalyzer() {
  console.log('Testing Log Analyzer...');

  const analyzer = new LogAnalyzer();

  // Test usage patterns analysis
  const patterns = await analyzer.analyzeUsagePatterns(7);
  console.log('Usage patterns:', {
    totalCalls: patterns.totalCalls,
    uniqueSkills: patterns.uniqueSkills,
    successRate: patterns.successRate + '%'
  });

  // Test performance report
  const performance = await analyzer.generatePerformanceReport();
  console.log('Performance report generated:', performance ? 'Success' : 'Failed');

  console.log('Log Analyzer test completed successfully!');
}

testAnalyzer().catch(console.error);