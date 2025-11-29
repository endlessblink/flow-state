/**
 * Root Project Cleaner - Pomo-Flow Specific
 *
 * Simple, focused cleanup for Pomo-Flow Vue.js project.
 * Removes temporary files, build artifacts, and development clutter.
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

class RootProjectCleaner {
  constructor() {
    this.rootDir = process.cwd();
    this.stats = {
      filesDeleted: 0,
      spaceRecovered: 0,
      errors: []
    };
  }

  /**
   * Main clean function
   */
  async clean(options = {}) {
    const config = {
      dryRun: true,        // Always default to safe mode
      type: 'all',         // 'tests', 'builds', 'cache', or 'all'
      verbose: false,
      ...options
    };

    console.log(`🧹 Pomo-Flow Root Cleaner${config.dryRun ? ' (DRY RUN)' : ''}\n`);

    try {
      // Safety check: git status
      await this.checkGitStatus();

      // Define what to clean based on type
      const patterns = this.getCleanPatterns(config.type);

      // Find matching files
      const filesToClean = await this.findFilesToClean(patterns);

      if (filesToClean.length === 0) {
        console.log('✨ No files found for cleanup!\n');
        return { success: true, deleted: 0, size: 0 };
      }

      // Show what will be deleted
      this.showPreview(filesToClean, config.dryRun);

      // Execute cleanup
      if (!config.dryRun) {
        await this.deleteFiles(filesToClean, config.verbose);
      }

      const totalSize = filesToClean.reduce((sum, file) => sum + file.size, 0);

      console.log(`\n${config.dryRun ? 'Would delete' : 'Deleted'} ${filesToClean.length} files (${this.formatSize(totalSize)})`);

      return {
        success: true,
        deleted: filesToClean.length,
        size: totalSize,
        files: filesToClean
      };

    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
      this.stats.errors.push(error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get patterns to clean based on type
   */
  getCleanPatterns(type) {
    const patterns = {
      // Clean all the test files cluttering the root directory
      tests: [
        'test-*.js',
        'test-*.cjs',
        'test-*.mjs',
        'test-*.html',
        'test-*.json',
        'check-*.mjs',
        'run-*.mjs',
        'debug-*.js',
        'fix-*.mjs',
        'investigate-*.mjs',
        'quick-*.mjs',
        'deep-*.mjs',
        'calendar-drag-test-*',
        'verify-*.html',
        'test-results/',
        'firebase-debug.log'
      ],

      // Build artifacts
      builds: [
        'dist/',
        'storybook-static/',
        'android/',
        'ios/',
        '*.apk',
        '*.ipa'
      ],

      // Cache files
      cache: [
        'node_modules/.cache/',
        '.vite/',
        '*.tsbuildinfo',
        '.eslintcache'
      ],

      // Development clutter in root
      dev: [
        '*-backup.html',
        '*-debug.html',
        'temp-*.html',
        'current-ui-state.png',
        'calendar-debug.png',
        '*.sqlite',
        '*.sqlite-journal'
      ]
    };

    if (type === 'all') {
      return [...patterns.tests, ...patterns.builds, ...patterns.cache, ...patterns.dev];
    }

    return patterns[type] || [];
  }

  /**
   * Find files matching cleanup patterns
   */
  async findFilesToClean(patterns) {
    const filesToClean = [];

    for (const pattern of patterns) {
      try {
        const matches = await this.findMatches(pattern);
        filesToClean.push(...matches);
      } catch (error) {
        console.warn(`⚠️  Warning: Could not process pattern "${pattern}": ${error.message}`);
      }
    }

    // Remove duplicates and sort
    const uniqueFiles = filesToClean.filter((file, index, arr) =>
      arr.findIndex(f => f.path === file.path) === index
    ).sort((a, b) => a.path.localeCompare(b.path));

    return uniqueFiles;
  }

  /**
   * Find files matching a single pattern
   */
  async findMatches(pattern) {
    const matches = [];

    // Handle directory patterns (ending with /)
    if (pattern.endsWith('/')) {
      const dirPath = path.join(this.rootDir, pattern.slice(0, -1));
      if (await this.exists(dirPath)) {
        const size = await this.getDirectorySize(dirPath);
        matches.push({
          path: dirPath,
          relativePath: pattern,
          type: 'directory',
          size,
          reason: 'Build/Cache directory'
        });
      }
      return matches;
    }

    // Handle file patterns with wildcards
    const regex = new RegExp(
      '^' + pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') + '$',
      'i'
    );

    try {
      const entries = await fs.readdir(this.rootDir, { withFileTypes: true });

      for (const entry of entries) {
        if (regex.test(entry.name)) {
          const fullPath = path.join(this.rootDir, entry.name);

          // Skip important files/directories
          if (this.shouldSkip(entry.name)) {
            continue;
          }

          try {
            const stats = await fs.stat(fullPath);
            const fileObj = {
              path: fullPath,
              relativePath: entry.name,
              type: entry.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              reason: this.getFileReason(entry.name)
            };

            // For directories, calculate total size
            if (entry.isDirectory()) {
              fileObj.size = await this.getDirectorySize(fullPath);
            }

            matches.push(fileObj);
          } catch (error) {
            // Skip files we can't read
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }

    return matches;
  }

  /**
   * Check if file should be skipped
   */
  shouldSkip(filename) {
    const skipList = [
      // Source files
      'src', 'public', 'scripts', 'docs',
      // Config files
      'package.json', 'package-lock.json', 'yarn.lock',
      'vite.config.js', 'tailwind.config.js', 'tsconfig.json',
      // Important files
      'README.md', 'CHANGELOG.md', 'LICENSE',
      'CLAUDE.md', 'SKILL.md', 'plan.md',
      // Directories we never want to touch
      'node_modules', '.git', '.claude', '.vscode',
      // Build outputs that might be needed
      'dist', 'build'
    ];

    return skipList.includes(filename) ||
           filename.startsWith('.') && !filename.startsWith('.vite') ||
           filename.includes('config');
  }

  /**
   * Get reason for file deletion
   */
  getFileReason(filename) {
    if (filename.startsWith('test-')) return 'Test file';
    if (filename.includes('-test-')) return 'Test file';
    if (filename.includes('-debug-')) return 'Debug file';
    if (filename.includes('check-')) return 'Check script';
    if (filename.includes('run-')) return 'Run script';
    if (filename.includes('fix-')) return 'Fix script';
    if (filename.includes('investigate-')) return 'Investigation script';
    if (filename.includes('quick-')) return 'Quick script';
    if (filename.includes('deep-')) return 'Deep analysis script';
    if (filename.includes('-backup')) return 'Backup file';
    if (filename.includes('.sqlite')) return 'Database file';
    if (filename.includes('calendar-drag')) return 'Calendar test file';
    if (filename.includes('verify-')) return 'Verification file';
    if (filename.includes('firebase-debug')) return 'Firebase debug log';
    if (filename === 'test-results') return 'Test results directory';
    if (filename.includes('.tsbuildinfo')) return 'TypeScript build info';
    if (filename.includes('.eslintcache')) return 'ESLint cache';
    if (filename.endsWith('.log')) return 'Log file';
    return 'Development file';
  }

  /**
   * Check git status to ensure clean working directory
   */
  async checkGitStatus() {
    try {
      const gitStatus = execSync('git status --porcelain', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();

      if (gitStatus) {
        console.log('⚠️  Warning: You have uncommitted git changes.');
        console.log('   Consider committing or stashing changes before cleanup.\n');
      }
    } catch (error) {
      // Not a git repository or git not available
    }
  }

  /**
   * Show preview of what will be deleted
   */
  showPreview(files, dryRun) {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    console.log(`📋 Files to ${dryRun ? 'potentially ' : ''}delete (${files.length} files, ${this.formatSize(totalSize)}):`);
    console.log('');

    // Group by reason
    const grouped = {};
    files.forEach(file => {
      const reason = file.reason || 'Other';
      if (!grouped[reason]) grouped[reason] = [];
      grouped[reason].push(file);
    });

    // Show grouped files
    Object.entries(grouped).forEach(([reason, group]) => {
      const groupSize = group.reduce((sum, file) => sum + file.size, 0);
      console.log(`📂 ${reason} (${group.length} files, ${this.formatSize(groupSize)}):`);

      group.forEach(file => {
        const sizeStr = file.size > 0 ? ` (${this.formatSize(file.size)})` : '';
        console.log(`   ${file.relativePath}${sizeStr}`);
      });
      console.log('');
    });
  }

  /**
   * Delete the files
   */
  async deleteFiles(files, verbose = false) {
    for (const file of files) {
      try {
        if (file.type === 'directory') {
          await fs.rm(file.path, { recursive: true, force: true });
        } else {
          await fs.unlink(file.path);
        }

        this.stats.filesDeleted++;
        this.stats.spaceRecovered += file.size;

        if (verbose) {
          console.log(`   Deleted: ${file.relativePath}`);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to delete ${file.relativePath}: ${error.message}`);
        this.stats.errors.push(`Failed to delete ${file.relativePath}: ${error.message}`);
      }
    }
  }

  /**
   * Check if path exists
   */
  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get directory size recursively
   */
  async getDirectorySize(dirPath) {
    let totalSize = 0;

    async function calculateSize(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          } else if (entry.isDirectory()) {
            await calculateSize(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await calculateSize(dirPath);
    return totalSize;
  }

  /**
   * Format bytes to human readable format
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Quick clean methods for common use cases
   */
  async cleanTests() {
    return await this.clean({ type: 'tests', dryRun: false });
  }

  async cleanBuilds() {
    return await this.clean({ type: 'builds', dryRun: false });
  }

  async cleanCache() {
    return await this.clean({ type: 'cache', dryRun: false });
  }

  async cleanDev() {
    return await this.clean({ type: 'dev', dryRun: false });
  }

  async cleanAll() {
    return await this.clean({ type: 'all', dryRun: false });
  }
}

// Create and export instance
const cleaner = new RootProjectCleaner();

// Export instance as default
export default cleaner;

// Export class for testing
export { RootProjectCleaner };

// Export convenience functions
export const cleanTests = () => cleaner.cleanTests();
export const cleanBuilds = () => cleaner.cleanBuilds();
export const cleanCache = () => cleaner.cleanCache();
export const cleanDev = () => cleaner.cleanDev();
export const cleanAll = () => cleaner.cleanAll();