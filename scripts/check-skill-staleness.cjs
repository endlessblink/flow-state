#!/usr/bin/env node

/**
 * Skill Staleness Checker
 *
 * Flags skills as potentially stale based on:
 * - Last modified > 180 days AND activation_count = 0
 * - References to non-existent files
 * - Description mentions deprecated features
 *
 * Usage:
 *   node scripts/check-skill-staleness.cjs          # Check all skills
 *   node scripts/check-skill-staleness.cjs --report # Generate markdown report
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', '.claude', 'skills');
const CONFIG_PATH = path.join(__dirname, '..', '.claude', 'config', 'skills.json');
const SRC_DIR = path.join(__dirname, '..', 'src');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// Features/technologies that are deprecated or removed
const DEPRECATED_KEYWORDS = [
  'pouchdb',           // Removed, now using Supabase
  'couchdb',           // Removed, now using Supabase
  'electron',          // Removed, using Tauri
  'sqlite',            // Removed, using Supabase Postgres
  'localStorage',      // Mostly deprecated for Supabase
  'indexeddb',         // Deprecated
  'vue2',              // Vue 2 patterns
  'options api',       // Prefer Composition API
  'vuex',              // Using Pinia now
];

const STALENESS_THRESHOLD_DAYS = 180;

/**
 * Get file modification time in days ago
 */
function getFileAgeDays(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const now = new Date();
    const mtime = new Date(stats.mtime);
    return Math.floor((now - mtime) / (1000 * 60 * 60 * 24));
  } catch {
    return -1;
  }
}

/**
 * Parse YAML frontmatter from SKILL.md
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

/**
 * Extract skill ID from directory name
 */
function extractSkillId(dirName) {
  const match = dirName.match(/^(?:[\p{Emoji}\p{Emoji_Component}]+\s+)?(.+)$/u);
  return match ? match[1] : dirName;
}

/**
 * Check if skill content references non-existent files
 */
function findBrokenReferences(content, skillDir) {
  const broken = [];

  // Find file references in markdown
  const linkMatches = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
  for (const match of linkMatches) {
    const link = match[2];
    // Skip external URLs and anchors
    if (link.startsWith('http') || link.startsWith('#') || link.startsWith('mailto:')) {
      continue;
    }

    // Resolve relative to skill directory or project root
    let resolvedPath;
    if (link.startsWith('/')) {
      resolvedPath = path.join(__dirname, '..', link);
    } else if (link.startsWith('../')) {
      resolvedPath = path.join(skillDir, link);
    } else {
      resolvedPath = path.join(skillDir, link);
    }

    if (!fs.existsSync(resolvedPath)) {
      broken.push({ link, resolvedPath });
    }
  }

  // Find src/ file references (e.g., src/composables/useCanvasSync.ts)
  const srcMatches = content.matchAll(/src\/[\w\-./]+\.(?:ts|vue|js)/g);
  for (const match of srcMatches) {
    const srcPath = path.join(__dirname, '..', match[0]);
    if (!fs.existsSync(srcPath)) {
      broken.push({ link: match[0], resolvedPath: srcPath });
    }
  }

  return broken;
}

/**
 * Check for deprecated keywords in content
 */
function findDeprecatedReferences(content) {
  const found = [];
  const lowerContent = content.toLowerCase();

  for (const keyword of DEPRECATED_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      found.push(keyword);
    }
  }

  return found;
}

/**
 * Analyze all skills for staleness
 */
function analyzeSkills() {
  const results = {
    stale: [],
    brokenRefs: [],
    deprecated: [],
    healthy: [],
    errors: []
  };

  // Load config for activation counts
  let config = { skills: {} };
  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  }

  if (!fs.existsSync(SKILLS_DIR)) {
    results.errors.push('Skills directory not found');
    return results;
  }

  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dir of dirs) {
    const skillDir = path.join(SKILLS_DIR, dir);
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    if (!fs.existsSync(skillMdPath)) {
      continue; // Skip non-skill directories
    }

    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const frontmatter = parseFrontmatter(content);
    const skillId = extractSkillId(frontmatter?.name || dir);

    const ageDays = getFileAgeDays(skillMdPath);
    const activationCount = config.skills[skillId]?.activation_count || 0;

    const skillInfo = {
      id: skillId,
      dir: dir,
      ageDays,
      activationCount
    };

    // Check for staleness (old + never used)
    if (ageDays > STALENESS_THRESHOLD_DAYS && activationCount === 0) {
      results.stale.push({
        ...skillInfo,
        reason: `Modified ${ageDays} days ago, never activated`
      });
    }

    // Check for broken references
    const broken = findBrokenReferences(content, skillDir);
    if (broken.length > 0) {
      results.brokenRefs.push({
        ...skillInfo,
        brokenLinks: broken
      });
    }

    // Check for deprecated references
    const deprecated = findDeprecatedReferences(content);
    if (deprecated.length > 0) {
      results.deprecated.push({
        ...skillInfo,
        deprecatedKeywords: deprecated
      });
    }

    // If none of the above, it's healthy
    if (
      !(ageDays > STALENESS_THRESHOLD_DAYS && activationCount === 0) &&
      broken.length === 0 &&
      deprecated.length === 0
    ) {
      results.healthy.push(skillInfo);
    }
  }

  return results;
}

/**
 * Generate markdown report
 */
function generateReport(results) {
  const timestamp = new Date().toISOString().split('T')[0];
  let report = `# Skill Staleness Report

**Generated**: ${timestamp}

---

## Summary

| Category | Count |
|----------|-------|
| Stale Skills | ${results.stale.length} |
| Broken References | ${results.brokenRefs.length} |
| Deprecated Keywords | ${results.deprecated.length} |
| Healthy Skills | ${results.healthy.length} |

---

`;

  if (results.stale.length > 0) {
    report += `## Stale Skills

Skills not modified in ${STALENESS_THRESHOLD_DAYS}+ days AND never activated:

| Skill | Days Old | Activations | Reason |
|-------|----------|-------------|--------|
`;
    for (const skill of results.stale) {
      report += `| \`${skill.id}\` | ${skill.ageDays} | ${skill.activationCount} | ${skill.reason} |\n`;
    }
    report += '\n---\n\n';
  }

  if (results.brokenRefs.length > 0) {
    report += `## Skills with Broken References

| Skill | Broken Links |
|-------|--------------|
`;
    for (const skill of results.brokenRefs) {
      const links = skill.brokenLinks.map(b => `\`${b.link}\``).join(', ');
      report += `| \`${skill.id}\` | ${links} |\n`;
    }
    report += '\n---\n\n';
  }

  if (results.deprecated.length > 0) {
    report += `## Skills Referencing Deprecated Features

| Skill | Deprecated Keywords |
|-------|---------------------|
`;
    for (const skill of results.deprecated) {
      report += `| \`${skill.id}\` | ${skill.deprecatedKeywords.join(', ')} |\n`;
    }
    report += '\n---\n\n';
  }

  if (results.healthy.length > 0) {
    report += `## Healthy Skills

${results.healthy.map(s => `- \`${s.id}\``).join('\n')}
`;
  }

  return report;
}

/**
 * Print console summary
 */
function printSummary(results) {
  console.log('=== Skill Staleness Check ===\n');

  console.log(`Stale Skills: ${results.stale.length}`);
  if (results.stale.length > 0) {
    results.stale.forEach(s => {
      console.log(`  ⚠️  ${s.id} - ${s.reason}`);
    });
  }

  console.log(`\nBroken References: ${results.brokenRefs.length}`);
  if (results.brokenRefs.length > 0) {
    results.brokenRefs.forEach(s => {
      console.log(`  🔗 ${s.id} - ${s.brokenLinks.length} broken link(s)`);
    });
  }

  console.log(`\nDeprecated References: ${results.deprecated.length}`);
  if (results.deprecated.length > 0) {
    results.deprecated.forEach(s => {
      console.log(`  📦 ${s.id} - mentions: ${s.deprecatedKeywords.join(', ')}`);
    });
  }

  console.log(`\nHealthy Skills: ${results.healthy.length}`);
}

// Main
if (require.main === module) {
  const results = analyzeSkills();
  const generateReportFlag = process.argv.includes('--report');

  printSummary(results);

  if (generateReportFlag) {
    const report = generateReport(results);

    // Ensure reports directory exists
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }

    const reportPath = path.join(REPORTS_DIR, 'stale-skills-report.md');
    fs.writeFileSync(reportPath, report);
    console.log(`\n[SUCCESS] Report saved to: ${reportPath}`);
  }
}

module.exports = { analyzeSkills, generateReport };
