#!/usr/bin/env node

/**
 * Skills Config Sync Script
 *
 * Auto-discovers skills from .claude/skills/ and syncs them with skills.json
 *
 * Usage:
 *   node scripts/sync-skills-config.cjs         # Sync and report changes
 *   node scripts/sync-skills-config.cjs --dry-run   # Report only, no changes
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', '.claude', 'skills');
const CONFIG_PATH = path.join(__dirname, '..', '.claude', 'config', 'skills.json');

/**
 * Parse YAML frontmatter from SKILL.md file
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

      // Remove surrounding quotes if present
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
 * Handles emoji prefixes like "🐛 dev-debugging" -> "dev-debugging"
 */
function extractSkillId(dirName) {
  // Remove emoji prefix if present (emoji followed by space)
  const match = dirName.match(/^(?:[\p{Emoji}\p{Emoji_Component}]+\s+)?(.+)$/u);
  return match ? match[1] : dirName;
}

/**
 * Determine category from skill name or description
 */
function inferCategory(skillId, description) {
  const lowerDesc = (description || '').toLowerCase();
  const lowerId = skillId.toLowerCase();

  // Category inference rules
  if (lowerId.includes('debug') || lowerDesc.includes('debug')) return 'debug';
  if (lowerId.includes('fix') || lowerDesc.includes('fix')) return 'fix';
  if (lowerId.includes('test') || lowerId.includes('qa') || lowerDesc.includes('test')) return 'test';
  if (lowerId.includes('architect') || lowerId.includes('plan') || lowerDesc.includes('architect')) return 'design';
  if (lowerId.includes('audit') || lowerDesc.includes('audit')) return 'audit';
  if (lowerId.includes('create') || lowerId.includes('implement')) return 'create';
  if (lowerId.includes('doc') || lowerId.includes('manager')) return 'resolve';
  if (lowerId.includes('dev-') || lowerDesc.includes('develop')) return 'implement';

  return 'implement'; // Default category
}

/**
 * Extract triggers from description
 */
function extractTriggers(description) {
  const triggers = [];

  // Extract quoted phrases that look like triggers
  const triggerMatches = description.match(/["']([^"']+)["']/g);
  if (triggerMatches) {
    triggerMatches.forEach(match => {
      const clean = match.slice(1, -1).toLowerCase();
      if (clean.length < 30) {
        triggers.push(clean);
      }
    });
  }

  // Extract common action verbs/keywords
  const keywords = ['fix', 'debug', 'test', 'plan', 'audit', 'create', 'implement', 'optimize'];
  keywords.forEach(kw => {
    if (description.toLowerCase().includes(kw) && !triggers.includes(kw)) {
      triggers.push(kw);
    }
  });

  return triggers.slice(0, 10); // Limit to 10 triggers
}

/**
 * Extract keywords from skill ID and description
 */
function extractKeywords(skillId, description) {
  const keywords = [];

  // Add parts of the skill ID
  const idParts = skillId.split('-');
  keywords.push(...idParts.filter(p => p.length > 2));

  // Extract notable words from description
  const words = description.toLowerCase().split(/\s+/);
  const notableWords = words.filter(w =>
    w.length > 3 &&
    !['the', 'and', 'for', 'use', 'when', 'this', 'with', 'that'].includes(w)
  );

  keywords.push(...notableWords.slice(0, 5));

  // Deduplicate
  return [...new Set(keywords)].slice(0, 8);
}

/**
 * Discover all skills from filesystem
 */
function discoverSkills() {
  const discovered = {};

  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`Skills directory not found: ${SKILLS_DIR}`);
    return discovered;
  }

  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dir of dirs) {
    const skillMdPath = path.join(SKILLS_DIR, dir, 'SKILL.md');

    if (!fs.existsSync(skillMdPath)) {
      console.warn(`  [WARN] No SKILL.md in: ${dir}`);
      continue;
    }

    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const frontmatter = parseFrontmatter(content);

    if (!frontmatter || !frontmatter.name) {
      console.warn(`  [WARN] No frontmatter/name in: ${dir}/SKILL.md`);
      continue;
    }

    const skillId = extractSkillId(frontmatter.name || dir);
    const description = frontmatter.description || '';

    discovered[skillId] = {
      name: frontmatter.name,
      category: inferCategory(skillId, description),
      triggers: extractTriggers(description),
      keywords: extractKeywords(skillId, description),
      activation_count: 0,
      last_used: null,
      related_skills: [],
      description: description,
      _source: dir // Track source directory
    };
  }

  return discovered;
}

/**
 * Main sync function
 */
function syncSkillsConfig(dryRun = false) {
  console.log('=== Skills Config Sync ===\n');

  // Load existing config
  let config = {
    project: 'FlowState',
    version: '2.0.0',
    last_updated: new Date().toISOString().split('T')[0],
    skills: {},
    categories: {},
    usage_stats: {
      total_activations: 0,
      most_used_skill: null,
      last_skill_used: null,
      usage_by_category: {}
    }
  };

  if (fs.existsSync(CONFIG_PATH)) {
    const existing = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    config = { ...config, ...existing };
  }

  const existingSkills = Object.keys(config.skills);
  console.log(`Existing skills in config: ${existingSkills.length}`);

  // Discover skills from filesystem
  console.log(`\nScanning ${SKILLS_DIR}...`);
  const discovered = discoverSkills();
  const discoveredIds = Object.keys(discovered);
  console.log(`Discovered skills on filesystem: ${discoveredIds.length}`);

  // Find additions and removals
  const toAdd = discoveredIds.filter(id => !existingSkills.includes(id));
  const toRemove = existingSkills.filter(id => !discoveredIds.includes(id));
  const existing = discoveredIds.filter(id => existingSkills.includes(id));

  console.log(`\n--- Summary ---`);
  console.log(`  Skills to add: ${toAdd.length}`);
  console.log(`  Skills to flag as removed: ${toRemove.length}`);
  console.log(`  Skills already in config: ${existing.length}`);

  if (toAdd.length > 0) {
    console.log(`\n--- Skills to Add ---`);
    toAdd.forEach(id => {
      const skill = discovered[id];
      console.log(`  + ${id} (${skill.category})`);
      console.log(`    "${skill.description.slice(0, 80)}..."`);
    });
  }

  if (toRemove.length > 0) {
    console.log(`\n--- Skills in Config But Not on Filesystem ---`);
    console.log(`  (These are flagged for review, not auto-deleted)`);
    toRemove.forEach(id => {
      console.log(`  ? ${id}`);
    });
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] No changes made.`);
    return { added: toAdd, flagged: toRemove };
  }

  // Apply additions
  for (const id of toAdd) {
    const skill = discovered[id];
    // Don't include internal _source in config
    const { _source, ...skillData } = skill;
    config.skills[id] = skillData;
  }

  // Update timestamp
  config.last_updated = new Date().toISOString().split('T')[0];

  // Write updated config
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`\n[SUCCESS] Updated ${CONFIG_PATH}`);
  console.log(`  Added ${toAdd.length} skills`);

  return { added: toAdd, flagged: toRemove };
}

// Run if called directly
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  syncSkillsConfig(dryRun);
}

module.exports = { syncSkillsConfig, discoverSkills, parseFrontmatter };
