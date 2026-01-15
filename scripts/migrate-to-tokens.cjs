#!/usr/bin/env node

/**
 * Design Token Migration Script
 *
 * Migrates hardcoded CSS values to design tokens across .vue and .css files.
 * Based on canonical styles from AppSidebar reference component.
 *
 * Usage:
 *   node scripts/migrate-to-tokens.cjs --analyze              # Report only
 *   node scripts/migrate-to-tokens.cjs --dry-run src/         # Preview changes
 *   node scripts/migrate-to-tokens.cjs --backup src/          # Migrate with backup
 *   node scripts/migrate-to-tokens.cjs src/components/canvas  # Migrate specific dir
 */

const fs = require('fs');
const path = require('path');

// Use sync glob for simplicity
const glob = require('glob');
function globSync(pattern, options) {
  return glob.sync(pattern, options);
}

// Load token mappings
const mappingsPath = path.join(__dirname, 'token-mappings.json');
const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));

// Configuration
const config = {
  dryRun: false,
  analyze: false,
  backup: false,
  verbose: false,
  targetPath: 'src/',
};

// Parse CLI arguments
const args = process.argv.slice(2);
args.forEach((arg, index) => {
  if (arg === '--dry-run') config.dryRun = true;
  else if (arg === '--analyze') config.analyze = true;
  else if (arg === '--backup') config.backup = true;
  else if (arg === '--verbose' || arg === '-v') config.verbose = true;
  else if (!arg.startsWith('-')) config.targetPath = arg;
});

// Statistics tracking
const stats = {
  filesScanned: 0,
  filesWithViolations: 0,
  filesModified: 0,
  totalViolations: 0,
  replacementsMade: 0,
  ambiguousCases: [],
  violationsByType: {
    backgrounds: 0,
    borders: 0,
    spacing: 0,
    radius: 0,
    typography: 0,
    transitions: 0,
    colors: 0,
  },
  violationsByFile: {},
};

/**
 * Normalize rgba values for consistent matching
 */
function normalizeRgba(value) {
  // Match rgba with various spacing
  const rgbaMatch = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i);
  if (rgbaMatch) {
    const [, r, g, b, a = '1'] = rgbaMatch;
    return `rgba(${r}, ${g}, ${b}, ${parseFloat(a)})`;
  }
  return value;
}

/**
 * Get the appropriate token for a value based on CSS property context
 */
function getTokenForValue(value, property) {
  const normalizedValue = normalizeRgba(value.trim());

  // Determine category based on property
  let category = null;
  if (/^background/.test(property)) category = 'backgrounds';
  else if (/^border(?!-radius)/.test(property)) category = 'borders';
  else if (/border-color/.test(property)) category = 'borders';
  else if (/^(padding|margin|gap|top|right|bottom|left)/.test(property)) category = 'spacing';
  else if (/border-radius/.test(property)) category = 'radius';
  else if (/font-size/.test(property)) category = 'typography';
  else if (/transition/.test(property)) category = 'transitions';
  else if (/color(?!:)/.test(property)) category = 'colors';

  // Try category-specific mapping first
  if (category && mappings[category] && mappings[category][normalizedValue]) {
    return {
      token: mappings[category][normalizedValue],
      category,
      confidence: 'high',
    };
  }

  // Fall back to searching all categories
  for (const [cat, values] of Object.entries(mappings)) {
    if (cat.startsWith('$') || cat === 'contextRules') continue;
    if (values[normalizedValue]) {
      return {
        token: values[normalizedValue],
        category: cat,
        confidence: category ? 'medium' : 'low',
      };
    }
  }

  return null;
}

/**
 * Check if a value is already tokenized
 */
function isAlreadyTokenized(value) {
  return /var\(--/.test(value);
}

/**
 * Extract CSS from Vue SFC <style> blocks
 */
function extractVueStyles(content) {
  const styleBlocks = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;

  while ((match = styleRegex.exec(content)) !== null) {
    styleBlocks.push({
      start: match.index,
      end: match.index + match[0].length,
      css: match[1],
      fullMatch: match[0],
    });
  }

  return styleBlocks;
}

/**
 * Find all hardcoded values in CSS content
 */
function findViolations(css, filePath) {
  const violations = [];
  const lines = css.split('\n');

  lines.forEach((line, lineIndex) => {
    // Skip comments
    if (line.trim().startsWith('/*') || line.trim().startsWith('//')) return;
    if (line.trim().startsWith('*')) return;

    // Skip already tokenized
    if (isAlreadyTokenized(line)) return;

    // Match CSS declarations
    const declMatch = line.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
    if (!declMatch) return;

    const [, property, value] = declMatch;

    // Check for rgba/rgb values
    const rgbaMatches = value.matchAll(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+)?\s*\)/gi);
    for (const rgbaMatch of rgbaMatches) {
      const tokenInfo = getTokenForValue(rgbaMatch[0], property);
      if (tokenInfo) {
        violations.push({
          line: lineIndex + 1,
          property,
          originalValue: rgbaMatch[0],
          suggestedToken: tokenInfo.token,
          category: tokenInfo.category,
          confidence: tokenInfo.confidence,
          filePath,
        });
      }
    }

    // Check for hex colors
    const hexMatches = value.matchAll(/#[0-9a-fA-F]{3,8}\b/g);
    for (const hexMatch of hexMatches) {
      const tokenInfo = getTokenForValue(hexMatch[0], property);
      if (tokenInfo) {
        violations.push({
          line: lineIndex + 1,
          property,
          originalValue: hexMatch[0],
          suggestedToken: tokenInfo.token,
          category: tokenInfo.category,
          confidence: tokenInfo.confidence,
          filePath,
        });
      }
    }

    // Check for hardcoded px values (spacing, radius, font-size)
    if (/^(padding|margin|gap|border-radius|font-size|top|right|bottom|left|width|height)/.test(property)) {
      const pxMatches = value.matchAll(/\b(\d+)px\b/g);
      for (const pxMatch of pxMatches) {
        const tokenInfo = getTokenForValue(pxMatch[0], property);
        if (tokenInfo) {
          violations.push({
            line: lineIndex + 1,
            property,
            originalValue: pxMatch[0],
            suggestedToken: tokenInfo.token,
            category: tokenInfo.category,
            confidence: tokenInfo.confidence,
            filePath,
          });
        }
      }
    }

    // Check for hardcoded rem values
    if (/^(padding|margin|gap|font-size)/.test(property)) {
      const remMatches = value.matchAll(/\b([\d.]+)rem\b/g);
      for (const remMatch of remMatches) {
        const tokenInfo = getTokenForValue(remMatch[0], property);
        if (tokenInfo) {
          violations.push({
            line: lineIndex + 1,
            property,
            originalValue: remMatch[0],
            suggestedToken: tokenInfo.token,
            category: tokenInfo.category,
            confidence: tokenInfo.confidence,
            filePath,
          });
        }
      }
    }

    // Check for hardcoded transition timing
    if (/transition/.test(property)) {
      const timingMatches = value.matchAll(/\b(\d+(?:\.\d+)?)(s|ms)\b/g);
      for (const timingMatch of timingMatches) {
        const tokenInfo = getTokenForValue(timingMatch[0], property);
        if (tokenInfo) {
          violations.push({
            line: lineIndex + 1,
            property,
            originalValue: timingMatch[0],
            suggestedToken: tokenInfo.token,
            category: tokenInfo.category,
            confidence: tokenInfo.confidence,
            filePath,
          });
        }
      }

      // Check for easing functions
      const easingMatches = value.matchAll(/\b(ease(?:-in)?(?:-out)?|linear)\b/g);
      for (const easingMatch of easingMatches) {
        const tokenInfo = getTokenForValue(easingMatch[0], property);
        if (tokenInfo) {
          violations.push({
            line: lineIndex + 1,
            property,
            originalValue: easingMatch[0],
            suggestedToken: tokenInfo.token,
            category: tokenInfo.category,
            confidence: tokenInfo.confidence,
            filePath,
          });
        }
      }
    }
  });

  return violations;
}

/**
 * Apply replacements to CSS content
 */
function applyReplacements(css, violations) {
  let modified = css;
  let offset = 0;

  // Sort violations by position (reverse order for safe replacement)
  const sortedViolations = [...violations]
    .filter(v => v.confidence !== 'low')
    .sort((a, b) => b.line - a.line);

  const lines = modified.split('\n');

  sortedViolations.forEach(violation => {
    const lineIndex = violation.line - 1;
    if (lineIndex >= 0 && lineIndex < lines.length) {
      lines[lineIndex] = lines[lineIndex].replace(
        violation.originalValue,
        violation.suggestedToken
      );
    }
  });

  return lines.join('\n');
}

/**
 * Process a single file
 */
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath);

  stats.filesScanned++;

  let allViolations = [];
  let modifiedContent = content;

  if (ext === '.vue') {
    const styleBlocks = extractVueStyles(content);

    styleBlocks.forEach(block => {
      const violations = findViolations(block.css, filePath);
      allViolations.push(...violations);

      if (!config.analyze && !config.dryRun && violations.length > 0) {
        const modifiedCss = applyReplacements(block.css, violations);
        modifiedContent = modifiedContent.replace(block.css, modifiedCss);
      }
    });
  } else if (ext === '.css') {
    const violations = findViolations(content, filePath);
    allViolations = violations;

    if (!config.analyze && !config.dryRun && violations.length > 0) {
      modifiedContent = applyReplacements(content, violations);
    }
  }

  if (allViolations.length > 0) {
    stats.filesWithViolations++;
    stats.totalViolations += allViolations.length;
    stats.violationsByFile[filePath] = allViolations.length;

    // Track by category
    allViolations.forEach(v => {
      if (stats.violationsByType[v.category]) {
        stats.violationsByType[v.category]++;
      }
      if (v.confidence === 'low') {
        stats.ambiguousCases.push(v);
      }
    });

    // Report violations
    if (config.verbose || config.analyze || config.dryRun) {
      console.log(`\n📁 ${path.relative(process.cwd(), filePath)} (${allViolations.length} violations)`);
      allViolations.slice(0, 10).forEach(v => {
        const confidence = v.confidence === 'high' ? '✅' : v.confidence === 'medium' ? '⚠️' : '❓';
        console.log(`  ${confidence} L${v.line}: ${v.property}: ${v.originalValue} → ${v.suggestedToken}`);
      });
      if (allViolations.length > 10) {
        console.log(`  ... and ${allViolations.length - 10} more`);
      }
    }

    // Write changes
    if (!config.analyze && !config.dryRun && modifiedContent !== content) {
      if (config.backup) {
        const backupPath = filePath + '.backup';
        fs.writeFileSync(backupPath, content);
      }
      fs.writeFileSync(filePath, modifiedContent);
      stats.filesModified++;
      stats.replacementsMade += allViolations.filter(v => v.confidence !== 'low').length;
    }
  }

  return allViolations;
}

/**
 * Main execution
 */
function main() {
  console.log('🎨 Design Token Migration Tool\n');
  console.log(`Mode: ${config.analyze ? 'ANALYZE' : config.dryRun ? 'DRY RUN' : 'MIGRATE'}`);
  console.log(`Target: ${config.targetPath}`);
  console.log(`Backup: ${config.backup ? 'Yes' : 'No'}\n`);

  // Find all .vue and .css files
  const targetDir = path.resolve(process.cwd(), config.targetPath);
  const pattern = path.join(targetDir, '**/*.{vue,css}');

  const files = globSync(pattern, {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.backup',
      '**/design-tokens.css',
      '**/*.stories.ts',
    ],
  });

  console.log(`Found ${files.length} files to scan...\n`);

  // Process each file
  for (const file of files) {
    processFile(file);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`Files scanned:        ${stats.filesScanned}`);
  console.log(`Files with violations: ${stats.filesWithViolations}`);
  console.log(`Total violations:     ${stats.totalViolations}`);

  if (!config.analyze) {
    console.log(`Files modified:       ${stats.filesModified}`);
    console.log(`Replacements made:    ${stats.replacementsMade}`);
  }

  console.log('\n📈 Violations by Category:');
  Object.entries(stats.violationsByType)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });

  if (stats.ambiguousCases.length > 0) {
    console.log(`\n⚠️ Ambiguous cases (require manual review): ${stats.ambiguousCases.length}`);
    const reportPath = path.join(process.cwd(), 'token-migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      stats,
      ambiguousCases: stats.ambiguousCases.slice(0, 100),
    }, null, 2));
    console.log(`  Report saved to: ${reportPath}`);
  }

  // Top files with violations
  const topFiles = Object.entries(stats.violationsByFile)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (topFiles.length > 0) {
    console.log('\n📁 Top files with violations:');
    topFiles.forEach(([file, count]) => {
      console.log(`  ${count.toString().padStart(3)} | ${path.relative(process.cwd(), file)}`);
    });
  }

  console.log('\n' + '='.repeat(60));

  if (config.analyze || config.dryRun) {
    console.log('\n💡 To apply changes, run without --analyze or --dry-run flag');
    console.log('   Add --backup to create .backup files before modifying');
  }
}

try {
  main();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
