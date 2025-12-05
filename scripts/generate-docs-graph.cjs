#!/usr/bin/env node
/**
 * Generate graph data for documentation visualization
 * Scans /docs folder and creates JSON for force-graph
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OUTPUT_FILE = path.join(__dirname, '..', 'dev-manager', 'docs', 'graph-data.json');

// Category colors (matching dark theme)
const CATEGORY_COLORS = {
  'reports': '#f59e0b',           // amber
  'conflict-systems-resolution': '#8b5cf6', // purple
  'archive': '#64748b',           // slate (muted)
  'debug': '#ef4444',             // red
  'guides': '#10b981',            // green
  'planning': '#3b82f6',          // blue
  'reference': '#06b6d4',         // cyan
  'other': '#94a3b8'              // gray
};

function getCategory(filePath) {
  const relativePath = path.relative(DOCS_DIR, filePath);
  const parts = relativePath.split(path.sep);

  // Check for archive anywhere in path
  if (parts.includes('archive')) {
    return 'archive';
  }

  // Use first folder as category
  if (parts.length > 1) {
    const folder = parts[0].toLowerCase();
    if (CATEGORY_COLORS[folder]) {
      return folder;
    }
    // Map common folder names
    if (folder.includes('report')) return 'reports';
    if (folder.includes('debug')) return 'debug';
    if (folder.includes('guide')) return 'guides';
    if (folder.includes('plan')) return 'planning';
    if (folder.includes('ref')) return 'reference';
  }

  return 'other';
}

function extractTitleAndDescription(filePath) {
  let title = path.basename(filePath, '.md')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  let description = '';

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Try to find H1 heading
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      title = h1Match[1].trim();
    }

    // Find first paragraph after title (skip empty lines and headers)
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
  } catch (e) {
    // Ignore read errors
  }

  return { title, description };
}

function scanDocs(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and hidden folders
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanDocs(fullPath, files);
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function generateGraphData() {
  console.log('Scanning docs folder...');

  const files = scanDocs(DOCS_DIR);
  console.log(`Found ${files.length} markdown files`);

  const nodes = [];
  const links = [];
  const categoryNodes = new Map();

  // Create document nodes
  files.forEach((file, index) => {
    const relativePath = path.relative(DOCS_DIR, file);
    const category = getCategory(file);
    const { title, description } = extractTitleAndDescription(file);
    const isArchived = category === 'archive';

    const node = {
      id: `doc-${index}`,
      path: relativePath,
      title: title,
      description: description,
      category: category,
      isArchived: isArchived,
      color: CATEGORY_COLORS[category] || CATEGORY_COLORS.other
    };

    nodes.push(node);

    // Track category for linking
    if (!categoryNodes.has(category)) {
      categoryNodes.set(category, []);
    }
    categoryNodes.get(category).push(node.id);
  });

  // Create links between docs in same category (for clustering)
  categoryNodes.forEach((nodeIds, category) => {
    // Create a central node for each category if more than 2 docs
    if (nodeIds.length > 2) {
      const categoryNodeId = `category-${category}`;
      nodes.push({
        id: categoryNodeId,
        title: category.charAt(0).toUpperCase() + category.slice(1),
        category: category,
        isCategory: true,
        isArchived: category === 'archive',
        color: CATEGORY_COLORS[category] || CATEGORY_COLORS.other
      });

      // Link all docs to category node
      nodeIds.forEach(docId => {
        links.push({
          source: categoryNodeId,
          target: docId
        });
      });
    } else {
      // For small categories, link docs directly
      for (let i = 0; i < nodeIds.length - 1; i++) {
        links.push({
          source: nodeIds[i],
          target: nodeIds[i + 1]
        });
      }
    }
  });

  const graphData = {
    nodes: nodes,
    links: links,
    generated: new Date().toISOString(),
    stats: {
      totalDocs: files.length,
      archivedDocs: nodes.filter(n => n.isArchived && !n.isCategory).length,
      activeDocs: nodes.filter(n => !n.isArchived && !n.isCategory).length,
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
  console.log(`  Total docs: ${graphData.stats.totalDocs}`);
  console.log(`  Active docs: ${graphData.stats.activeDocs}`);
  console.log(`  Archived docs: ${graphData.stats.archivedDocs}`);
  console.log(`  Categories: ${graphData.stats.categories.join(', ')}`);
  console.log(`\nOutput: ${OUTPUT_FILE}`);
}

generateGraphData();
