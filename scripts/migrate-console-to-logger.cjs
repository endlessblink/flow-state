#!/usr/bin/env node
/**
 * TASK-038: Console.log Migration Script (v2 - Fixed)
 *
 * Migrates console.log/warn/error statements to use the centralized logger utility.
 * This version fixes the import insertion bug from v1.
 *
 * Usage:
 *   node scripts/migrate-console-to-logger.cjs [--dry-run] [--file <path>]
 *
 * Options:
 *   --dry-run    Show what would be changed without making changes
 *   --file       Process a single file instead of all files
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_FILE = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : null;

// Files/patterns to skip
const SKIP_PATTERNS = [
  /logger\.ts$/,           // Don't modify the logger itself
  /consoleFilter\.ts$/,    // Don't modify console filter
  /productionLogger\.ts$/, // Don't modify production logger
  /\.test\.ts$/,           // Skip test files
  /\.spec\.ts$/,           // Skip spec files
  /node_modules/,          // Skip node_modules
  /\.stories\.ts$/,        // Skip storybook stories
];

// Stats tracking
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  consoleLogs: 0,
  consoleWarns: 0,
  consoleErrors: 0,
  importsAdded: 0,
  skippedFiles: [],
  modifiedFiles: [],
};

/**
 * Check if file should be skipped
 */
function shouldSkip(filePath) {
  return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Get all .ts and .vue files recursively
 */
function getFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        getFiles(fullPath, files);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.vue'))) {
      if (!shouldSkip(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Find the position to insert the logger import
 * Returns the character index where the import should be inserted
 * Also returns whether to insert at top (before content) or after last import
 */
function findImportInsertPosition(content, isVueFile) {
  if (isVueFile) {
    // For Vue files, find the <script> or <script setup> tag
    const scriptMatch = content.match(/<script[^>]*>/);
    if (scriptMatch) {
      // Insert right after the script tag on a new line
      return { position: scriptMatch.index + scriptMatch[0].length, atTop: false };
    }
    return { position: -1, atTop: false };
  }

  // For TypeScript files, find the last import statement
  // Also check if there's console usage BEFORE the first import
  const lines = content.split('\n');
  let lastImportEndPos = -1;
  let firstImportStartPos = -1;
  let firstConsolePos = -1;
  let currentPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Track first console usage (which will become logger usage)
    if (firstConsolePos === -1 && /console\.(log|warn|error)\s*\(/.test(line)) {
      firstConsolePos = currentPos;
    }

    // Check if this line starts an import statement
    if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('import{')) {
      if (firstImportStartPos === -1) {
        firstImportStartPos = currentPos;
      }

      // Find the end of this import (might span multiple lines)
      let importEnd = currentPos + line.length;

      // If the line doesn't end with a semicolon, look for it in subsequent lines
      if (!trimmedLine.endsWith(';')) {
        for (let j = i + 1; j < lines.length; j++) {
          importEnd += 1 + lines[j].length; // +1 for newline
          if (lines[j].includes(';')) {
            break;
          }
        }
      }

      lastImportEndPos = importEnd;
    }

    currentPos += line.length + 1; // +1 for newline
  }

  // If there's console usage BEFORE the first import, we need to add at the very top
  if (firstConsolePos !== -1 && (firstImportStartPos === -1 || firstConsolePos < firstImportStartPos)) {
    return { position: 0, atTop: true };
  }

  // If there are imports, insert after the last one
  if (lastImportEndPos >= 0) {
    return { position: lastImportEndPos, atTop: false };
  }

  // No imports found, insert at the very top
  return { position: 0, atTop: true };
}

/**
 * Check if the file already has a logger import
 */
function hasLoggerImport(content) {
  return /import\s*{\s*logger\s*}\s*from\s*['"]@\/utils\/logger['"]/.test(content);
}

/**
 * Process a single file
 */
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  let localStats = { log: 0, warn: 0, error: 0 };

  // Skip if already has logger import
  const alreadyHasImport = hasLoggerImport(content);

  // Find import position BEFORE doing replacements (so we can detect console.* positions)
  const isVueFile = filePath.endsWith('.vue');
  const { position: insertPos, atTop } = findImportInsertPosition(content, isVueFile);

  // Simple approach: replace console.log/warn/error with logger equivalents
  // Using a callback function to count replacements

  // Replace console.log -> logger.debug
  content = content.replace(/console\.log\s*\(/g, (match) => {
    localStats.log++;
    return 'logger.debug(';
  });

  // Replace console.warn -> logger.warn
  content = content.replace(/console\.warn\s*\(/g, (match) => {
    localStats.warn++;
    return 'logger.warn(';
  });

  // Replace console.error -> logger.error
  content = content.replace(/console\.error\s*\(/g, (match) => {
    localStats.error++;
    return 'logger.error(';
  });

  const totalReplacements = localStats.log + localStats.warn + localStats.error;
  const modified = content !== originalContent;

  // Add logger import if needed
  if (modified && !alreadyHasImport) {
    if (atTop) {
      // Insert at the very top of the file
      content = "import { logger } from '@/utils/logger'\n" + content;
      stats.importsAdded++;
    } else if (insertPos >= 0) {
      // Insert after the last import
      const importStatement = "\nimport { logger } from '@/utils/logger'";
      content = content.substring(0, insertPos) + importStatement + content.substring(insertPos);
      stats.importsAdded++;
    }
  }

  // Write changes if not dry run
  if (modified && !DRY_RUN) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  return { modified, localStats, totalReplacements };
}

/**
 * Main function
 */
function main() {
  console.log('🔄 TASK-038: Console.log Migration Script (v2)');
  console.log('===============================================');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '✏️ LIVE (making changes)'}`);
  console.log('');

  // Get files to process
  let files;
  if (SINGLE_FILE) {
    const fullPath = path.resolve(SINGLE_FILE);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ File not found: ${fullPath}`);
      process.exit(1);
    }
    files = [fullPath];
  } else {
    files = getFiles(SRC_DIR);
  }

  console.log(`📂 Found ${files.length} files to process`);
  console.log('');

  // Process each file
  for (const filePath of files) {
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);

    try {
      const result = processFile(filePath);
      stats.filesProcessed++;

      if (result.modified) {
        stats.filesModified++;
        stats.consoleLogs += result.localStats.log;
        stats.consoleWarns += result.localStats.warn;
        stats.consoleErrors += result.localStats.error;
        stats.modifiedFiles.push(relativePath);

        console.log(`✅ ${relativePath}`);
        console.log(`   log: ${result.localStats.log}, warn: ${result.localStats.warn}, error: ${result.localStats.error}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${relativePath}: ${error.message}`);
      stats.skippedFiles.push(relativePath);
    }
  }

  // Print summary
  console.log('');
  console.log('📊 Migration Summary');
  console.log('====================');
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Files modified:  ${stats.filesModified}`);
  console.log(`console.log:     ${stats.consoleLogs} → logger.debug`);
  console.log(`console.warn:    ${stats.consoleWarns} → logger.warn`);
  console.log(`console.error:   ${stats.consoleErrors} → logger.error`);
  console.log(`Imports added:   ${stats.importsAdded}`);
  console.log(`Total migrated:  ${stats.consoleLogs + stats.consoleWarns + stats.consoleErrors}`);

  if (stats.skippedFiles.length > 0) {
    console.log('');
    console.log('⚠️ Skipped files (errors):');
    stats.skippedFiles.forEach(f => console.log(`   - ${f}`));
  }

  if (DRY_RUN) {
    console.log('');
    console.log('ℹ️  This was a dry run. Run without --dry-run to apply changes.');
  }
}

main();
