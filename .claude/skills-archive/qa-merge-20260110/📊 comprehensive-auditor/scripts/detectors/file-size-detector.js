/**
 * File Size & Token Limit Detector
 *
 * Detects files that exceed token limits for AI editing tools.
 * Suggests refactoring based on file type and size.
 *
 * Token estimation: ~4 characters per token (conservative estimate)
 *
 * Thresholds:
 * - WARNING: 15,000 tokens (~60KB) - Getting large
 * - CAUTION: 25,000 tokens (~100KB) - Needs attention
 * - CRITICAL: 35,000 tokens (~140KB) - Urgent refactoring
 * - BLOCKED: 50,000+ tokens (~200KB) - Blocks AI editing
 */

import { promises as fs } from 'fs';
import path from 'path';
import glob from 'glob';
const globSync = glob.sync;

// Token thresholds
const THRESHOLDS = {
  WARNING: 15000,   // ~60KB - getting large
  CAUTION: 25000,   // ~100KB - needs attention
  CRITICAL: 35000,  // ~140KB - urgent
  BLOCKED: 50000    // ~200KB - blocks AI editing
};

// Chars per token (conservative estimate)
const CHARS_PER_TOKEN = 4;

// File extensions to scan
const FILE_PATTERNS = [
  'src/**/*.ts',
  'src/**/*.vue',
  'src/**/*.js',
  'src/**/*.tsx',
  'src/**/*.jsx'
];

// Files to ignore
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.d.ts',
  '**/*.min.js',
  '**/*.bundle.js',
  '**/vendor/**'
];

/**
 * Estimate token count from file content
 */
function estimateTokens(content) {
  return Math.ceil(content.length / CHARS_PER_TOKEN);
}

/**
 * Estimate line count
 */
function countLines(content) {
  return content.split('\n').length;
}

/**
 * Get risk level based on token count
 */
function getRiskLevel(tokens) {
  if (tokens >= THRESHOLDS.BLOCKED) return 'BLOCKED';
  if (tokens >= THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (tokens >= THRESHOLDS.CAUTION) return 'CAUTION';
  if (tokens >= THRESHOLDS.WARNING) return 'WARNING';
  return 'OK';
}

/**
 * Get risk score (0-100) for sorting/prioritization
 */
function getRiskScore(tokens) {
  if (tokens >= THRESHOLDS.BLOCKED) return 100;
  if (tokens >= THRESHOLDS.CRITICAL) return 80;
  if (tokens >= THRESHOLDS.CAUTION) return 60;
  if (tokens >= THRESHOLDS.WARNING) return 40;
  return 0;
}

/**
 * Get refactoring suggestion based on file type and size
 */
function getRefactoringSuggestion(filePath, tokens, lines) {
  const ext = path.extname(filePath);
  const fileName = path.basename(filePath);

  const suggestions = [];

  if (ext === '.vue') {
    if (lines > 500) {
      suggestions.push('Extract script logic into composables (src/composables/)');
    }
    if (lines > 1000) {
      suggestions.push('Split into smaller child components');
    }
    if (lines > 2000) {
      suggestions.push('URGENT: Major component decomposition needed');
      suggestions.push('Consider: extract state to Pinia store');
    }
  }

  if (ext === '.ts' || ext === '.js') {
    if (fileName.includes('store')) {
      suggestions.push('Split store into feature-specific modules');
      suggestions.push('Extract actions/getters into separate files');
    } else if (fileName.includes('composable') || fileName.startsWith('use')) {
      suggestions.push('Break into smaller, focused composables');
      suggestions.push('Apply single responsibility principle');
    } else {
      suggestions.push('Split into multiple modules by concern');
      suggestions.push('Extract utility functions to separate files');
    }
  }

  if (tokens >= THRESHOLDS.BLOCKED) {
    suggestions.unshift('⛔ BLOCKS AI EDITING - Immediate action required');
  } else if (tokens >= THRESHOLDS.CRITICAL) {
    suggestions.unshift('🔴 CRITICAL - High priority refactoring needed');
  }

  return suggestions;
}

/**
 * Scan a single file and return findings
 */
async function scanFile(filePath, projectRoot) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const tokens = estimateTokens(content);
    const lines = countLines(content);
    const bytes = Buffer.byteLength(content, 'utf-8');
    const riskLevel = getRiskLevel(tokens);

    if (riskLevel === 'OK') {
      return null; // Skip files under threshold
    }

    const relativePath = path.relative(projectRoot, filePath);

    return {
      path: relativePath,
      absolutePath: filePath,
      metrics: {
        bytes,
        lines,
        tokens,
        charsPerToken: CHARS_PER_TOKEN
      },
      risk: {
        level: riskLevel,
        score: getRiskScore(tokens),
        thresholds: THRESHOLDS
      },
      suggestions: getRefactoringSuggestion(filePath, tokens, lines),
      detector: 'file-size'
    };
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Main detection function
 */
export async function detect(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const patterns = options.patterns || FILE_PATTERNS;
  const ignore = options.ignore || IGNORE_PATTERNS;
  const minTokens = options.minTokens || THRESHOLDS.WARNING;

  console.log('\n📏 File Size & Token Limit Detector');
  console.log('━'.repeat(50));
  console.log(`Project: ${projectRoot}`);
  console.log(`Min tokens to report: ${minTokens.toLocaleString()}`);
  console.log('');

  // Find all matching files
  const files = [];
  for (const pattern of patterns) {
    const matches = globSync(pattern, {
      cwd: projectRoot,
      absolute: true,
      ignore
    });
    files.push(...matches);
  }

  console.log(`Scanning ${files.length} files...`);

  // Scan all files
  const findings = [];
  for (const file of files) {
    const finding = await scanFile(file, projectRoot);
    if (finding && finding.metrics.tokens >= minTokens) {
      findings.push(finding);
    }
  }

  // Sort by risk score (highest first)
  findings.sort((a, b) => b.risk.score - a.risk.score);

  // Generate summary
  const summary = {
    totalFilesScanned: files.length,
    filesOverThreshold: findings.length,
    byRiskLevel: {
      BLOCKED: findings.filter(f => f.risk.level === 'BLOCKED').length,
      CRITICAL: findings.filter(f => f.risk.level === 'CRITICAL').length,
      CAUTION: findings.filter(f => f.risk.level === 'CAUTION').length,
      WARNING: findings.filter(f => f.risk.level === 'WARNING').length
    },
    totalTokensOverThreshold: findings.reduce((sum, f) => sum + f.metrics.tokens, 0),
    totalLinesOverThreshold: findings.reduce((sum, f) => sum + f.metrics.lines, 0)
  };

  return {
    detector: 'file-size',
    timestamp: new Date().toISOString(),
    thresholds: THRESHOLDS,
    summary,
    findings
  };
}

/**
 * Format findings for console output
 */
export function formatConsoleOutput(results) {
  const { summary, findings } = results;

  let output = '\n📊 File Size Detection Results\n';
  output += '━'.repeat(50) + '\n\n';

  // Summary
  output += `Files scanned: ${summary.totalFilesScanned}\n`;
  output += `Files over threshold: ${summary.filesOverThreshold}\n\n`;

  if (summary.filesOverThreshold === 0) {
    output += '✅ No oversized files detected!\n';
    return output;
  }

  // Risk breakdown
  output += 'By Risk Level:\n';
  if (summary.byRiskLevel.BLOCKED > 0) {
    output += `  ⛔ BLOCKED:  ${summary.byRiskLevel.BLOCKED} files\n`;
  }
  if (summary.byRiskLevel.CRITICAL > 0) {
    output += `  🔴 CRITICAL: ${summary.byRiskLevel.CRITICAL} files\n`;
  }
  if (summary.byRiskLevel.CAUTION > 0) {
    output += `  🟡 CAUTION:  ${summary.byRiskLevel.CAUTION} files\n`;
  }
  if (summary.byRiskLevel.WARNING > 0) {
    output += `  🟠 WARNING:  ${summary.byRiskLevel.WARNING} files\n`;
  }

  output += '\n' + '─'.repeat(50) + '\n';
  output += 'Detailed Findings:\n\n';

  // Individual findings
  for (const finding of findings) {
    const icon = {
      BLOCKED: '⛔',
      CRITICAL: '🔴',
      CAUTION: '🟡',
      WARNING: '🟠'
    }[finding.risk.level];

    output += `${icon} ${finding.path}\n`;
    output += `   Tokens: ${finding.metrics.tokens.toLocaleString()} | `;
    output += `Lines: ${finding.metrics.lines.toLocaleString()} | `;
    output += `Size: ${(finding.metrics.bytes / 1024).toFixed(1)}KB\n`;

    if (finding.suggestions.length > 0) {
      output += '   Suggestions:\n';
      for (const suggestion of finding.suggestions) {
        output += `     • ${suggestion}\n`;
      }
    }
    output += '\n';
  }

  return output;
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const projectRoot = args[0] || process.cwd();

  try {
    const results = await detect({ projectRoot });
    console.log(formatConsoleOutput(results));

    // Exit with appropriate code
    if (results.summary.byRiskLevel.BLOCKED > 0) {
      process.exit(2); // Critical issues
    } else if (results.summary.byRiskLevel.CRITICAL > 0) {
      process.exit(1); // Issues found
    }
    process.exit(0);
  } catch (error) {
    console.error('Detection failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
