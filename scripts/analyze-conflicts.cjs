#!/usr/bin/env node
/**
 * Conflict Analysis Tool for Pomo-Flow
 * Scans codebase for competing implementations and conflict patterns
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

// Patterns to detect competing implementations
const CONFLICT_PATTERNS = {
  errorHandling: {
    name: 'Error Handling',
    patterns: [
      /catch\s*\(\s*\w+\s*\)/g,
      /\.catch\(/g,
      /try\s*{/g,
      /console\.(error|warn)/g
    ],
    severity: 'HIGH'
  },
  stateManagement: {
    name: 'State Management',
    patterns: [
      /ref\s*\(/g,
      /reactive\s*\(/g,
      /useState/g,
      /\.value\s*=/g
    ],
    severity: 'MEDIUM'
  },
  dragDrop: {
    name: 'Drag and Drop',
    patterns: [
      /draggable/gi,
      /ondrag/gi,
      /onDrop/g,
      /useDraggable/g,
      /@dragstart/g,
      /@drop/g
    ],
    severity: 'MEDIUM'
  },
  calendar: {
    name: 'Calendar Systems',
    patterns: [
      /useCalendar/g,
      /calendar/gi,
      /date-fns/g,
      /formatDate/g
    ],
    severity: 'HIGH'
  },
  database: {
    name: 'Database Operations',
    patterns: [
      /localforage/gi,
      /indexeddb/gi,
      /pouchdb/gi,
      /\.put\(/g,
      /\.get\(/g,
      /\.remove\(/g
    ],
    severity: 'HIGH'
  },
  validation: {
    name: 'Validation',
    patterns: [
      /validate/gi,
      /isValid/g,
      /schema/gi,
      /\.parse\(/g
    ],
    severity: 'MEDIUM'
  },
  undoRedo: {
    name: 'Undo/Redo',
    patterns: [
      /undo/gi,
      /redo/gi,
      /history/gi,
      /useManualRefHistory/g
    ],
    severity: 'HIGH'
  }
};

function getAllFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!item.startsWith('.') && item !== 'node_modules') {
        getAllFiles(fullPath, files);
      }
    } else if (/\.(ts|vue|js)$/.test(item)) {
      files.push(fullPath);
    }
  }

  return files;
}

function analyzeFile(filePath, patterns) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  const results = {};

  for (const [category, config] of Object.entries(patterns)) {
    let matchCount = 0;

    for (const pattern of config.patterns) {
      const matches = content.match(pattern);
      if (matches) {
        matchCount += matches.length;
      }
    }

    if (matchCount > 0) {
      results[category] = {
        count: matchCount,
        severity: config.severity,
        name: config.name
      };
    }
  }

  return Object.keys(results).length > 0 ? { file: relativePath, results } : null;
}

function generateReport(analyses) {
  const summary = {};
  const filesByCategory = {};

  for (const analysis of analyses) {
    if (!analysis) continue;

    for (const [category, data] of Object.entries(analysis.results)) {
      if (!summary[category]) {
        summary[category] = {
          total: 0,
          files: 0,
          severity: data.severity,
          name: data.name
        };
        filesByCategory[category] = [];
      }
      summary[category].total += data.count;
      summary[category].files++;
      filesByCategory[category].push({
        file: analysis.file,
        count: data.count
      });
    }
  }

  return { summary, filesByCategory };
}

function main() {
  console.log('\n=== Pomo-Flow Conflict Analysis ===\n');
  console.log(`Scanning: ${SRC_DIR}\n`);

  const files = getAllFiles(SRC_DIR);
  console.log(`Found ${files.length} source files\n`);

  const analyses = files.map(f => analyzeFile(f, CONFLICT_PATTERNS));
  const report = generateReport(analyses);

  // Sort by severity and count
  const sortedCategories = Object.entries(report.summary)
    .sort((a, b) => {
      const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const severityDiff = severityOrder[a[1].severity] - severityOrder[b[1].severity];
      if (severityDiff !== 0) return severityDiff;
      return b[1].total - a[1].total;
    });

  console.log('=== Summary by Category ===\n');
  console.log('| Category | Occurrences | Files | Severity |');
  console.log('|----------|-------------|-------|----------|');

  let totalOccurrences = 0;
  for (const [category, data] of sortedCategories) {
    console.log(`| ${data.name.padEnd(15)} | ${String(data.total).padStart(11)} | ${String(data.files).padStart(5)} | ${data.severity.padEnd(8)} |`);
    totalOccurrences += data.total;
  }

  console.log('');
  console.log(`Total occurrences: ${totalOccurrences}`);
  console.log(`Categories analyzed: ${Object.keys(report.summary).length}`);

  // Show top files per HIGH severity category
  console.log('\n=== HIGH Severity - Top Files ===\n');

  for (const [category, data] of sortedCategories.filter(([_, d]) => d.severity === 'HIGH')) {
    console.log(`\n${data.name}:`);
    const topFiles = report.filesByCategory[category]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    for (const { file, count } of topFiles) {
      console.log(`  ${count.toString().padStart(4)} occurrences - ${file}`);
    }
  }

  console.log('\n=== Recommendations ===\n');
  console.log('1. Focus on HIGH severity categories first');
  console.log('2. Consolidate files with highest occurrence counts');
  console.log('3. Create unified interfaces before refactoring');
  console.log('4. Test thoroughly after each consolidation');
  console.log('');
}

main();
