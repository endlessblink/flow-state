#!/usr/bin/env node

/**
 * Find Hardcoded Values Script
 * Scans codebase for hardcoded colors and spacing values
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Color mapping from hex to token
const COLOR_MAP = {
  // Grayscale
  '#ffffff': 'var(--text-primary) or var(--surface-secondary)',
  '#f9fafb': 'var(--surface-tertiary)',
  '#f3f4f6': 'var(--border-subtle)',
  '#e5e7eb': 'var(--border-medium)',
  '#d1d5db': 'var(--border-strong)',
  '#9ca3af': 'var(--text-muted)',
  '#6b7280': 'var(--text-subtle)',
  '#374151': 'var(--surface-elevated)',
  '#111827': 'var(--text-primary) for dark theme',

  // Brand/Interactive
  '#4f46e5': 'var(--state-active-bg)',
  '#3b82f6': 'var(--color-navigation) or var(--brand-primary)',

  // Semantic
  '#10b981': 'var(--color-work)',
  '#059669': 'var(--color-work) darker variant',
  '#f59e0b': 'var(--color-break)',
  '#d97706': 'var(--color-break) darker variant',
  '#ef4444': 'var(--color-danger) or var(--color-priority-high)',
  '#dc2626': 'var(--color-danger) darker variant',
  '#8b5cf6': 'var(--color-focus)',
};

console.log('🔍 Scanning for hardcoded values...\n');

// Find hex colors
const hexColors = execSync(
  `grep -r "#[0-9a-fA-F]\\{6\\}\\|#[0-9a-fA-F]\\{3\\}" src/ --include="*.vue" --include="*.css" -n | grep -v "node_modules"`,
  { encoding: 'utf-8', cwd: process.cwd() }
).trim().split('\n');

console.log(`Found ${hexColors.length} hardcoded hex colors\n`);

// Group by file
const byFile = {};
hexColors.forEach(line => {
  const [filepath, ...rest] = line.split(':');
  if (!byFile[filepath]) byFile[filepath] = [];
  byFile[filepath].push(rest.join(':'));
});

// Display results
Object.entries(byFile).forEach(([file, lines]) => {
  console.log(`\n📄 ${file} (${lines.length} violations)`);
  console.log('─'.repeat(60));

  lines.slice(0, 5).forEach(line => {
    const match = line.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/);
    if (match) {
      const color = match[0].toLowerCase();
      const suggestion = COLOR_MAP[color] || 'Check design tokens';
      console.log(`  Line ${line}`);
      console.log(`  💡 Suggested token: ${suggestion}\n`);
    }
  });

  if (lines.length > 5) {
    console.log(`  ... and ${lines.length - 5} more\n`);
  }
});

console.log('\n\n📊 Summary by File:');
console.log('─'.repeat(60));
Object.entries(byFile)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([file, lines]) => {
    console.log(`${lines.length.toString().padStart(4)} violations - ${file}`);
  });

console.log('\n\n🎯 Action Items:');
console.log('1. Start with files that have most violations');
console.log('2. Replace each hex color with appropriate token');
console.log('3. Run this script again to verify');
console.log('4. Final test: Change tokens and verify cascade\n');
