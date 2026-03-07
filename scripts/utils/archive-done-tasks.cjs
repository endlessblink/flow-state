#!/usr/bin/env node

/**
 * Archive completed tasks from MASTER_PLAN.md to MASTER_PLAN_ARCHIVE.md
 *
 * Moves detail blocks (### ~~TASK-XXX~~: ... sections) for tasks completed
 * more than N days ago. Keeps summary table rows in the main file.
 *
 * Usage:
 *   node scripts/utils/archive-done-tasks.cjs          # Archive tasks done >14 days ago
 *   node scripts/utils/archive-done-tasks.cjs --days=30 # Archive tasks done >30 days ago
 *   node scripts/utils/archive-done-tasks.cjs --dry-run  # Preview without writing
 */

const fs = require('fs');
const path = require('path');

const MASTER_PLAN_PATH = path.join(__dirname, '../../docs/MASTER_PLAN.md');
const ARCHIVE_PATH = path.join(__dirname, '../../docs/MASTER_PLAN_ARCHIVE.md');

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const daysArg = args.find(a => a.startsWith('--days='));
const DAYS_THRESHOLD = daysArg ? parseInt(daysArg.split('=')[1], 10) : 14;

const now = new Date();
const cutoffDate = new Date(now.getTime() - DAYS_THRESHOLD * 24 * 60 * 60 * 1000);

console.log(`\n📦 MASTER_PLAN Archive Tool`);
console.log(`─────────────────────────────`);
console.log(`Threshold: ${DAYS_THRESHOLD} days (before ${cutoffDate.toISOString().split('T')[0]})`);
console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '✏️  WRITE'}\n`);

// Read the master plan
const content = fs.readFileSync(MASTER_PLAN_PATH, 'utf8');
const lines = content.split('\n');

// Find all DONE detail sections (### ~~XXX~~: ... (DONE))
// A section starts at ### ~~ and ends at the next ### or ##
const sections = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  // Match done task headers: ### ~~TASK-XXX~~: Title (DONE)
  const headerMatch = line.match(/^### ~~((?:TASK|BUG|FEATURE|ISSUE|ROAD|IDEA|INQUIRY)-\d+)~~:.*\(.*(?:DONE|FIXED|COMPLETE|✅).*\)/i);

  if (headerMatch) {
    const taskId = headerMatch[1];
    const startLine = i;

    // Find section end (next ### or ## header, or EOF)
    let endLine = i + 1;
    while (endLine < lines.length) {
      if (/^#{2,3} /.test(lines[endLine]) && endLine > startLine) {
        break;
      }
      endLine++;
    }

    // Skip trailing blank lines at end of section
    while (endLine > startLine + 1 && lines[endLine - 1].trim() === '') {
      endLine--;
    }

    // Extract completion date from the status line
    // Patterns: (✅ DONE 2026-02-21), (2026-02-17), **Status**: ... (2026-02-14)
    const sectionText = lines.slice(startLine, endLine).join('\n');
    let completionDate = null;

    // Try to find a date in the section (first few lines)
    const dateSearchLines = lines.slice(startLine, Math.min(startLine + 5, endLine)).join('\n');
    const dateMatch = dateSearchLines.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      completionDate = new Date(dateMatch[1]);
    }

    sections.push({
      taskId,
      startLine,
      endLine,
      completionDate,
      text: sectionText,
      headerLine: line.trim()
    });

    i = endLine;
  } else {
    i++;
  }
}

console.log(`Found ${sections.length} DONE detail sections total.\n`);

// Filter to sections older than threshold
// If no date found, check git for last activity
const toArchive = [];
const kept = [];
const noDate = [];

for (const section of sections) {
  if (section.completionDate && section.completionDate < cutoffDate) {
    toArchive.push(section);
  } else if (section.completionDate && section.completionDate >= cutoffDate) {
    kept.push(section);
  } else {
    // No date found — be conservative, check if task ID is old enough by number
    // Tasks with lower IDs are older. Use a heuristic: if no date, archive anyway
    // since these are likely old tasks that predate date tracking
    noDate.push(section);
    toArchive.push(section);
  }
}

console.log(`📊 Breakdown:`);
console.log(`  Archiving (older than ${DAYS_THRESHOLD} days): ${toArchive.length - noDate.length}`);
console.log(`  Archiving (no date found):       ${noDate.length}`);
console.log(`  Keeping (recent):                ${kept.length}`);
console.log('');

if (toArchive.length === 0) {
  console.log('✅ Nothing to archive. All DONE tasks are recent.\n');
  process.exit(0);
}

// Show what will be archived
console.log(`📋 Tasks to archive:`);
for (const s of toArchive) {
  const dateStr = s.completionDate ? s.completionDate.toISOString().split('T')[0] : 'no date';
  const lineCount = s.endLine - s.startLine;
  console.log(`  ${s.taskId.padEnd(16)} ${dateStr.padEnd(12)} (${lineCount} lines)`);
}
console.log('');

if (dryRun) {
  console.log('🔍 DRY RUN — no files modified.\n');
  console.log(`Would archive ${toArchive.length} sections.`);
  console.log(`Would remove ~${toArchive.reduce((sum, s) => sum + (s.endLine - s.startLine), 0)} lines from MASTER_PLAN.md\n`);
  process.exit(0);
}

// Build archive content
const archiveHeader = `# MASTER_PLAN Archive

> Completed tasks archived from [MASTER_PLAN.md](./MASTER_PLAN.md).
> Summary table entries remain in the main file.
>
> Last archived: ${now.toISOString().split('T')[0]}

---

`;

let existingArchive = '';
if (fs.existsSync(ARCHIVE_PATH)) {
  existingArchive = fs.readFileSync(ARCHIVE_PATH, 'utf8');
  // Remove the header if it exists (we'll regenerate it)
  const firstSection = existingArchive.indexOf('\n### ');
  if (firstSection !== -1) {
    existingArchive = existingArchive.slice(firstSection);
  } else {
    existingArchive = '';
  }
}

// Append new archived sections
const newArchiveContent = toArchive.map(s => s.text).join('\n\n');
const fullArchive = archiveHeader + newArchiveContent + (existingArchive ? '\n\n' + existingArchive : '') + '\n';

// Remove archived sections from MASTER_PLAN.md
// Work backwards to preserve line numbers
const linesToRemove = new Set();
for (const section of toArchive.sort((a, b) => b.startLine - a.startLine)) {
  // Also remove trailing blank lines after the section
  let removeEnd = section.endLine;
  while (removeEnd < lines.length && lines[removeEnd].trim() === '') {
    removeEnd++;
  }
  for (let j = section.startLine; j < removeEnd; j++) {
    linesToRemove.add(j);
  }
}

const newLines = lines.filter((_, idx) => !linesToRemove.has(idx));

// Clean up consecutive blank lines (more than 2)
const cleanedLines = [];
let blankCount = 0;
for (const line of newLines) {
  if (line.trim() === '') {
    blankCount++;
    if (blankCount <= 2) cleanedLines.push(line);
  } else {
    blankCount = 0;
    cleanedLines.push(line);
  }
}

// Write files
fs.writeFileSync(ARCHIVE_PATH, fullArchive, 'utf8');
fs.writeFileSync(MASTER_PLAN_PATH, cleanedLines.join('\n'), 'utf8');

const originalSize = Buffer.byteLength(content, 'utf8');
const newSize = Buffer.byteLength(cleanedLines.join('\n'), 'utf8');
const reduction = ((1 - newSize / originalSize) * 100).toFixed(1);

console.log(`✅ Archived ${toArchive.length} sections to docs/MASTER_PLAN_ARCHIVE.md`);
console.log(`📉 MASTER_PLAN.md: ${(originalSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB (${reduction}% reduction)`);
console.log(`📁 Archive: ${(Buffer.byteLength(fullArchive, 'utf8') / 1024).toFixed(0)}KB\n`);
