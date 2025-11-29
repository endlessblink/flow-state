#!/usr/bin/env node

/**
 * Calendar Leak Diagnostic Script
 *
 * This script analyzes the calendar system to identify where tasks with due dates
 * are incorrectly leaking into calendar grid instead of staying in inbox.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const COMPOSABLES_DIR = path.join(PROJECT_ROOT, 'src/composables/calendar');
const COMPONENTS_DIR = path.join(PROJECT_ROOT, 'src/components');
const STORES_DIR = path.join(PROJECT_ROOT, 'src/stores');

console.log('🔍 Calendar Scheduling Diagnostic Tool');
console.log('=====================================\n');

// Find all calendar-related files
function findCalendarFiles() {
  const files = [];

  // Check calendar composables
  if (fs.existsSync(COMPOSABLES_DIR)) {
    const composableFiles = fs.readdirSync(COMPOSABLES_DIR)
      .filter(file => file.endsWith('.ts'))
      .map(file => path.join(COMPOSABLES_DIR, file));
    files.push(...composableFiles);
  }

  // Check calendar components
  if (fs.existsSync(COMPONENTS_DIR)) {
    const findVueFiles = (dir) => {
      const results = [];
      if (!fs.existsSync(dir)) return results;

      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          results.push(...findVueFiles(fullPath));
        } else if (item.endsWith('.vue') && item.toLowerCase().includes('calendar')) {
          results.push(fullPath);
        }
      }
      return results;
    };

    files.push(...findVueFiles(COMPONENTS_DIR));
  }

  // Check task store
  const taskStorePath = path.join(STORES_DIR, 'tasks.ts');
  if (fs.existsSync(taskStorePath)) {
    files.push(taskStorePath);
  }

  return files;
}

// Analyze a file for calendar scheduling patterns
function analyzeFile(filePath) {
  console.log(`📁 Analyzing: ${path.relative(PROJECT_ROOT, filePath)}`);

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const issues = [];
  const patterns = [];

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for problematic patterns
    if (line.includes('dueDate') && line.includes('today')) {
      issues.push({
        line: lineNum,
        type: 'dueDate_today_pattern',
        message: 'Using dueDate for today filtering - may cause calendar leaks',
        code: line.trim()
      });
    }

    if (line.includes('isDueToday') && line.includes('||')) {
      issues.push({
        line: lineNum,
        type: 'broad_today_condition',
        message: 'Broad today condition may include tasks that should stay in inbox',
        code: line.trim()
      });
    }

    if (line.includes('if (') && line.includes('dueDate') && !line.includes('instances')) {
      issues.push({
        line: lineNum,
        type: 'dueDate_without_instances',
        message: 'Checking dueDate without instances check may create unwanted calendar events',
        code: line.trim()
      });
    }

    // Track important patterns
    if (line.includes('hasInstanceForToday') || line.includes('hasLegacyScheduleToday')) {
      patterns.push({
        line: lineNum,
        type: 'proper_scheduling_check',
        message: 'Proper scheduling check found',
        code: line.trim()
      });
    }

    if (line.includes('useCalendarDayView') || line.includes('useCalendarWeekView') || line.includes('useCalendarMonthView')) {
      patterns.push({
        line: lineNum,
        type: 'calendar_composable',
        message: 'Calendar composable usage',
        code: line.trim()
      });
    }

    if (line.includes('moveTaskToSmartGroup') || line.includes('applySmartGroupProperties')) {
      patterns.push({
        line: lineNum,
        type: 'smart_group_logic',
        message: 'Smart group logic found',
        code: line.trim()
      });
    }
  });

  if (issues.length > 0) {
    console.log('  ⚠️  Issues Found:');
    issues.forEach(issue => {
      console.log(`    Line ${issue.line}: ${issue.message}`);
      console.log(`    Code: ${issue.code}`);
      console.log('');
    });
  }

  if (patterns.length > 0) {
    console.log('  ✅ Good Patterns Found:');
    patterns.forEach(pattern => {
      console.log(`    Line ${pattern.line}: ${pattern.message}`);
      console.log(`    Code: ${pattern.code}`);
      console.log('');
    });
  }

  if (issues.length === 0 && patterns.length === 0) {
    console.log('  ℹ️  No calendar scheduling patterns detected');
  }

  console.log('');

  return { issues, patterns };
}

// Check for specific problematic patterns in calendar views
function checkCalendarViews() {
  console.log('🎯 Checking Calendar View Files:');
  console.log('--------------------------------\n');

  const calendarFiles = findCalendarFiles();
  let totalIssues = 0;
  let totalPatterns = 0;

  calendarFiles.forEach(file => {
    const result = analyzeFile(file);
    totalIssues += result.issues.length;
    totalPatterns += result.patterns.length;
  });

  console.log(`📊 Summary:`);
  console.log(`  Files analyzed: ${calendarFiles.length}`);
  console.log(`  Issues found: ${totalIssues}`);
  console.log(`  Good patterns: ${totalPatterns}`);

  return totalIssues;
}

// Main diagnostic function
function runDiagnostic() {
  console.log('Starting calendar scheduling diagnostic...\n');

  const issueCount = checkCalendarViews();

  if (issueCount > 0) {
    console.log('\n🚨 DIAGNOSTIC RESULT: Issues detected that may cause calendar leaks');
    console.log('\nRecommended actions:');
    console.log('1. Review the issues listed above');
    console.log('2. Apply fixes using the calendar-scheduling-fixer skill');
    console.log('3. Test thoroughly with Playwright');
    console.log('4. Verify tasks stay in inbox, not calendar grid');
  } else {
    console.log('\n✅ DIAGNOSTIC RESULT: No obvious calendar leak patterns detected');
    console.log('\nIf issues persist:');
    console.log('1. Test with Playwright to verify actual behavior');
    console.log('2. Check for runtime state issues');
    console.log('3. Review task data models for inconsistencies');
  }

  console.log('\n🔧 Next steps:');
  console.log('- Run: node scripts/analyze-task-state.js');
  console.log('- Test with: node scripts/test-calendar-behavior.js');
}

// Run the diagnostic
if (import.meta.url === `file://${process.argv[1]}`) {
  runDiagnostic();
}

export { runDiagnostic, findCalendarFiles, analyzeFile };