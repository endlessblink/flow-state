#!/usr/bin/env node
/**
 * Generate graph data for skills visualization
 * Scans /.claude/skills folder and creates JSON for force-graph
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', '.claude', 'skills');
const OUTPUT_FILE = path.join(__dirname, '..', 'dev-manager', 'skills', 'graph-data.json');
const METRICS_FILE = path.join(__dirname, '..', '.claude', 'logs', 'skill-metrics.json');

// Category colors (matching dark theme)
const CATEGORY_COLORS = {
  'debugging': '#ef4444',        // red
  'development': '#10b981',      // green
  'architecture': '#3b82f6',     // blue
  'operations': '#f59e0b',       // amber
  'documentation': '#8b5cf6',    // purple
  'testing': '#06b6d4',          // cyan
  'data': '#ec4899',             // pink
  'other': '#94a3b8'             // gray
};

function getCategory(skillName) {
  const name = skillName.toLowerCase();

  if (name.includes('debug') || name.includes('fix') || name.includes('crisis')) return 'debugging';
  if (name.includes('dev-') || name.includes('vue') || name.includes('pinia')) return 'development';
  if (name.includes('arch') || name.includes('plan') || name.includes('chief')) return 'architecture';
  if (name.includes('ops') || name.includes('port') || name.includes('sync')) return 'operations';
  if (name.includes('doc') || name.includes('smart-doc')) return 'documentation';
  if (name.includes('test') || name.includes('qa')) return 'testing';
  if (name.includes('data') || name.includes('backup') || name.includes('persistence')) return 'data';

  return 'other';
}

function extractSkillInfo(skillPath) {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  let title = path.basename(skillPath);
  let description = '';

  try {
    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const lines = content.split('\n');

      // Find title (first H1)
      for (const line of lines) {
        if (line.startsWith('# ')) {
          title = line.substring(2).trim();
          break;
        }
      }

      // Find description (first paragraph after title)
      let foundTitle = false;
      for (const line of lines) {
        if (line.startsWith('# ')) {
          foundTitle = true;
          continue;
        }
        if (foundTitle && line.trim() && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('**')) {
          description = line.trim().substring(0, 200);
          if (line.length > 200) description += '...';
          break;
        }
      }
    }
  } catch (e) {
    // Ignore read errors
  }

  return { title, description };
}

function loadUsageMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const content = fs.readFileSync(METRICS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.log('No metrics file found, using defaults');
  }
  return {};
}

function scanSkills() {
  const skills = [];

  try {
    const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(SKILLS_DIR, entry.name);
        const skillMdPath = path.join(skillPath, 'SKILL.md');

        // Only include folders with SKILL.md
        if (fs.existsSync(skillMdPath)) {
          skills.push({
            name: entry.name,
            path: skillPath
          });
        }
      }
    }
  } catch (e) {
    console.error('Error scanning skills:', e);
  }

  return skills;
}

function generateGraphData() {
  console.log('Scanning skills folder...');

  const skills = scanSkills();
  const metrics = loadUsageMetrics();
  console.log(`Found ${skills.length} skills with SKILL.md`);

  const nodes = [];
  const links = [];
  const categoryNodes = new Map();

  // Create skill nodes
  skills.forEach((skill, index) => {
    const { title, description } = extractSkillInfo(skill.path);
    const category = getCategory(skill.name);

    // Get usage from metrics - check both skill name and common variations
    const skillMetrics = metrics[skill.name] || metrics[skill.name.replace(/^🔧-|-skill$/g, '')] || {};
    const usage = skillMetrics.totalCalls || 0;

    const node = {
      id: `skill-${index}`,
      name: skill.name,
      title: title,
      description: description,
      category: category,
      color: CATEGORY_COLORS[category] || CATEGORY_COLORS.other,
      usage: usage
    };

    nodes.push(node);

    // Track category for linking
    if (!categoryNodes.has(category)) {
      categoryNodes.set(category, []);
    }
    categoryNodes.get(category).push(node.id);
  });

  // Create category hub nodes and links
  categoryNodes.forEach((nodeIds, category) => {
    if (nodeIds.length > 1) {
      const categoryNodeId = `category-${category}`;
      nodes.push({
        id: categoryNodeId,
        title: category.charAt(0).toUpperCase() + category.slice(1),
        category: category,
        isCategory: true,
        color: CATEGORY_COLORS[category] || CATEGORY_COLORS.other
      });

      // Link all skills to category node
      nodeIds.forEach(skillId => {
        links.push({
          source: categoryNodeId,
          target: skillId
        });
      });
    }
  });

  const graphData = {
    nodes: nodes,
    links: links,
    generated: new Date().toISOString(),
    stats: {
      totalSkills: skills.length,
      categories: Object.keys(Object.fromEntries(categoryNodes))
    }
  };

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(graphData, null, 2));

  console.log(`\nGraph data generated:`);
  console.log(`  Total skills: ${graphData.stats.totalSkills}`);
  console.log(`  Categories: ${graphData.stats.categories.join(', ')}`);
  console.log(`\nOutput: ${OUTPUT_FILE}`);
}

generateGraphData();
