#!/usr/bin/env node

/**
 * Documentation Reference Validator
 *
 * Validates all markdown links in documentation files:
 * - All markdown links in CLAUDE.md are valid
 * - All links in SKILL.md files resolve
 * - Reports broken links with suggested fixes
 *
 * Usage:
 *   node scripts/validate-doc-refs.cjs          # Validate all docs
 *   node scripts/validate-doc-refs.cjs --fix   # Suggest fixes for broken links
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
const SKILLS_DIR = path.join(PROJECT_ROOT, '.claude', 'skills');
const CLAUDE_MD = path.join(PROJECT_ROOT, 'CLAUDE.md');

// Files to validate
const TARGET_FILES = [
  CLAUDE_MD,
  ...findMarkdownFiles(DOCS_DIR),
  ...findMarkdownFiles(SKILLS_DIR),
];

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir) {
  const files = [];

  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract all markdown links from content
 */
function extractLinks(content) {
  const links = [];

  // Standard markdown links: [text](url)
  const linkMatches = content.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g);
  for (const match of linkMatches) {
    links.push({
      text: match[1],
      url: match[2],
      fullMatch: match[0],
      index: match.index
    });
  }

  return links;
}

/**
 * Validate a link and return result
 */
function validateLink(link, sourceFile) {
  const { url, text } = link;

  // Skip external URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { valid: true, type: 'external' };
  }

  // Skip anchors
  if (url.startsWith('#')) {
    return { valid: true, type: 'anchor' };
  }

  // Skip mailto links
  if (url.startsWith('mailto:')) {
    return { valid: true, type: 'mailto' };
  }

  // Handle URL with anchor (e.g., ./file.md#section)
  const urlWithoutAnchor = url.split('#')[0];
  if (!urlWithoutAnchor) {
    return { valid: true, type: 'anchor' };
  }

  // Resolve the path
  let resolvedPath;
  const sourceDir = path.dirname(sourceFile);

  if (url.startsWith('/')) {
    // Absolute path from project root
    resolvedPath = path.join(PROJECT_ROOT, urlWithoutAnchor);
  } else {
    // Relative path from source file
    resolvedPath = path.resolve(sourceDir, urlWithoutAnchor);
  }

  // Check if file exists
  if (fs.existsSync(resolvedPath)) {
    return { valid: true, type: 'local', resolvedPath };
  }

  // Try to find similar files for suggestions
  const suggestions = findSimilarFiles(urlWithoutAnchor, sourceDir);

  return {
    valid: false,
    type: 'broken',
    url: urlWithoutAnchor,
    resolvedPath,
    suggestions
  };
}

/**
 * Find similar files that might be the intended target
 */
function findSimilarFiles(brokenUrl, sourceDir) {
  const suggestions = [];
  const fileName = path.basename(brokenUrl);
  const fileNameLower = fileName.toLowerCase();

  // Search in docs/ for similar files
  const docsFiles = findMarkdownFiles(DOCS_DIR);
  for (const file of docsFiles) {
    const baseName = path.basename(file);
    if (baseName.toLowerCase().includes(fileNameLower.replace('.md', '')) ||
        fileNameLower.includes(baseName.toLowerCase().replace('.md', ''))) {
      const relativePath = path.relative(sourceDir, file);
      suggestions.push(relativePath.startsWith('.') ? relativePath : `./${relativePath}`);
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Get line number from content index
 */
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

/**
 * Validate all links in a file
 */
function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const links = extractLinks(content);

  const results = {
    file: filePath,
    relativePath: path.relative(PROJECT_ROOT, filePath),
    total: links.length,
    valid: 0,
    broken: []
  };

  for (const link of links) {
    const validation = validateLink(link, filePath);

    if (validation.valid) {
      results.valid++;
    } else {
      results.broken.push({
        text: link.text,
        url: link.url,
        line: getLineNumber(content, link.index),
        resolvedPath: validation.resolvedPath,
        suggestions: validation.suggestions
      });
    }
  }

  return results;
}

/**
 * Print results to console
 */
function printResults(allResults, showFixes) {
  console.log('=== Documentation Link Validator ===\n');

  let totalLinks = 0;
  let totalBroken = 0;

  const brokenFiles = allResults.filter(r => r.broken.length > 0);

  // Summary first
  for (const result of allResults) {
    totalLinks += result.total;
    totalBroken += result.broken.length;
  }

  console.log(`Files scanned: ${allResults.length}`);
  console.log(`Total links: ${totalLinks}`);
  console.log(`Broken links: ${totalBroken}`);
  console.log('');

  if (brokenFiles.length === 0) {
    console.log('✅ All links are valid!');
    return;
  }

  // Details for broken links
  console.log('--- Broken Links ---\n');

  for (const result of brokenFiles) {
    console.log(`📄 ${result.relativePath}`);

    for (const broken of result.broken) {
      console.log(`   Line ${broken.line}: [${broken.text}](${broken.url})`);

      if (showFixes && broken.suggestions.length > 0) {
        console.log(`   💡 Suggestions:`);
        broken.suggestions.forEach(s => console.log(`      → ${s}`));
      }
    }
    console.log('');
  }
}

/**
 * Generate markdown report
 */
function generateReport(allResults) {
  const timestamp = new Date().toISOString().split('T')[0];

  let totalLinks = 0;
  let totalBroken = 0;
  allResults.forEach(r => {
    totalLinks += r.total;
    totalBroken += r.broken.length;
  });

  let report = `# Documentation Link Validation Report

**Generated**: ${timestamp}

## Summary

| Metric | Count |
|--------|-------|
| Files Scanned | ${allResults.length} |
| Total Links | ${totalLinks} |
| Valid Links | ${totalLinks - totalBroken} |
| Broken Links | ${totalBroken} |

---

`;

  const brokenFiles = allResults.filter(r => r.broken.length > 0);

  if (brokenFiles.length === 0) {
    report += `## Status: ✅ All Links Valid\n\nNo broken links found.\n`;
    return report;
  }

  report += `## Broken Links by File\n\n`;

  for (const result of brokenFiles) {
    report += `### ${result.relativePath}\n\n`;
    report += `| Line | Link Text | Broken URL | Suggestions |\n`;
    report += `|------|-----------|------------|-------------|\n`;

    for (const broken of result.broken) {
      const suggestions = broken.suggestions.length > 0
        ? broken.suggestions.map(s => `\`${s}\``).join(', ')
        : '-';
      report += `| ${broken.line} | ${broken.text} | \`${broken.url}\` | ${suggestions} |\n`;
    }

    report += '\n';
  }

  return report;
}

// Main
if (require.main === module) {
  const showFixes = process.argv.includes('--fix');
  const generateReportFlag = process.argv.includes('--report');

  // Find all target files
  const targetFiles = [
    CLAUDE_MD,
    ...findMarkdownFiles(DOCS_DIR),
    ...findMarkdownFiles(SKILLS_DIR),
  ].filter(f => fs.existsSync(f));

  // Validate all files
  const allResults = targetFiles.map(f => validateFile(f));

  // Print results
  printResults(allResults, showFixes);

  // Generate report if requested
  if (generateReportFlag) {
    const reportsDir = path.join(PROJECT_ROOT, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const report = generateReport(allResults);
    const reportPath = path.join(reportsDir, 'doc-links-report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`\n[SUCCESS] Report saved to: ${reportPath}`);
  }

  // Exit with error code if broken links found
  const totalBroken = allResults.reduce((sum, r) => sum + r.broken.length, 0);
  process.exit(totalBroken > 0 ? 1 : 0);
}

module.exports = { validateFile, findMarkdownFiles, extractLinks };
