#!/usr/bin/env node
/**
 * sync-masterplan-to-beads.cjs
 *
 * One-way sync from MASTER_PLAN.md to beads for multi-agent coordination.
 *
 * Usage:
 *   npm run mp:sync           # Full sync
 *   npm run mp:sync:dry       # Dry run (preview changes)
 *   npm run mp:sync:force     # Force sync (ignore timestamps)
 *
 * MASTER_PLAN.md is the source of truth. Beads are created/updated/closed
 * to mirror the tasks defined there.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// Configuration
const MASTER_PLAN_PATH = path.resolve(__dirname, '../docs/MASTER_PLAN.md');
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// Status mapping: MASTER_PLAN → Beads
const STATUS_MAP = {
  'PLANNED': { status: 'open', label: 'planned' },
  'IN PROGRESS': { status: 'in_progress', label: null },
  'IN_PROGRESS': { status: 'in_progress', label: null },
  'REVIEW': { status: 'open', label: 'review' },
  'MONITORING': { status: 'open', label: 'review' },
  'PAUSED': { status: 'open', label: 'paused' },
  'DONE': { status: 'closed', label: null },
  'COMPLETE': { status: 'closed', label: null },
};

// Priority mapping: MASTER_PLAN → Beads (0-4, 0=critical)
const PRIORITY_MAP = {
  'P0': 0, 'P0-CRITICAL': 0, 'CRITICAL': 0,
  'P1': 1, 'P1-HIGH': 1, 'HIGH': 1,
  'P2': 2, 'P2-MEDIUM': 2, 'MEDIUM': 2,
  'P3': 3, 'P3-LOW': 3, 'LOW': 3,
  'P4': 4, 'P4-BACKLOG': 4, 'BACKLOG': 4,
};

// Type mapping: MASTER_PLAN prefix → Beads type
const TYPE_MAP = {
  'TASK': 'task',
  'BUG': 'bug',
  'FEATURE': 'feature',
  'ROAD': 'task',      // Roadmap items as tasks
  'IDEA': 'task',      // Ideas as tasks with label
  'ISSUE': 'bug',      // Issues as bugs
  'INQUIRY': 'task',   // Inquiries as tasks
};

/**
 * Parse MASTER_PLAN.md to extract tasks
 */
function parseMasterPlan(content) {
  const tasks = [];
  const lines = content.split('\n');

  // Match task headers like: ### TASK-123: Title (STATUS)
  // Also handles strikethrough: ### ~~TASK-123~~: Title (✅ DONE)
  const taskPattern = /^###\s+(~~)?((TASK|BUG|INQUIRY|FEATURE|ROAD|IDEA|ISSUE)-\d+)(~~)?:\s*(.+?)\s*\(([^)]+)\)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(taskPattern);

    if (match) {
      const [, strikeStart, id, prefix, strikeEnd, title, statusRaw] = match;
      const isDone = !!(strikeStart && strikeEnd);

      // Normalize status (remove emojis, whitespace)
      const statusClean = statusRaw.replace(/[🔄✅📋👀⏸️]/g, '').trim().toUpperCase();

      // Extract priority from the next few lines
      let priority = 'P2'; // Default
      let blockedBy = [];
      let dependsOn = [];

      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const scanLine = lines[j];

        // Stop if we hit another task header
        if (scanLine.match(/^###\s+/)) break;

        // Priority
        const priorityMatch = scanLine.match(/\*\*Priority\*\*:\s*(P[0-4](?:-[A-Z]+)?)/i);
        if (priorityMatch) {
          priority = priorityMatch[1].toUpperCase();
        }

        // Blocked By
        const blockedMatch = scanLine.match(/\*\*Blocked\s*By\*\*:\s*((?:(?:TASK|BUG|ROAD|FEATURE)-\d+(?:,\s*)?)+)/gi);
        if (blockedMatch) {
          const ids = scanLine.match(/(TASK|BUG|ROAD|FEATURE)-\d+/gi);
          if (ids) blockedBy.push(...ids);
        }

        // Depends On (may be strikethrough if completed)
        const dependsMatch = scanLine.match(/\*\*Depends\s*On\*\*:\s*(.+)/i);
        if (dependsMatch) {
          // Extract IDs, ignoring strikethrough ones (they're completed)
          const dependsText = dependsMatch[1];
          const activeIds = dependsText.match(/(?<!~~)(TASK|BUG|ROAD|FEATURE)-\d+(?!~~)/gi);
          if (activeIds) dependsOn.push(...activeIds);
        }
      }

      tasks.push({
        id,
        title: title.trim(),
        statusRaw: statusClean,
        priority,
        isDone: isDone || statusClean === 'DONE' || statusClean === 'COMPLETE',
        type: prefix,
        blockedBy: [...new Set(blockedBy)],
        dependsOn: [...new Set(dependsOn)],
      });
    }
  }

  return tasks;
}

/**
 * Get current beads as a map by external_ref
 */
function getBeadsMap() {
  try {
    const result = spawnSync('bd', ['list', '--all', '--limit', '0', '--json'], {
      encoding: 'utf-8',
      timeout: 30000,
    });

    if (result.error) {
      console.error('Error running bd list:', result.error.message);
      return new Map();
    }

    // bd may output warnings before JSON, find the JSON array
    const output = result.stdout || '';
    const jsonStart = output.indexOf('[');
    if (jsonStart === -1) {
      if (VERBOSE) console.log('No beads found');
      return new Map();
    }

    const beads = JSON.parse(output.slice(jsonStart));
    const map = new Map();

    // Build map by external_ref
    for (const bead of beads) {
      if (bead.external_ref) {
        map.set(bead.external_ref, bead);
      }
    }

    // Also get full details for external_ref (bd list --json doesn't include it)
    // We need to query each bead individually or check the JSONL
    const jsonlPath = path.resolve(__dirname, '../.beads/issues.jsonl');
    if (fs.existsSync(jsonlPath)) {
      const jsonlContent = fs.readFileSync(jsonlPath, 'utf-8');
      const jsonlLines = jsonlContent.trim().split('\n').filter(l => l);

      for (const line of jsonlLines) {
        try {
          const issue = JSON.parse(line);
          if (issue.external_ref && issue.id) {
            // Update the map entry with external_ref
            const existing = Array.from(map.values()).find(b => b.id === issue.id);
            if (existing) {
              map.delete(existing.external_ref);
            }
            map.set(issue.external_ref, {
              ...beads.find(b => b.id === issue.id),
              external_ref: issue.external_ref,
            });
          }
        } catch (e) {
          // Skip invalid lines
        }
      }
    }

    return map;
  } catch (e) {
    console.error('Error getting beads:', e.message);
    return new Map();
  }
}

/**
 * Run a bd command
 */
function runBd(args, options = {}) {
  if (DRY_RUN && !options.allowInDryRun) {
    console.log(`  [DRY RUN] bd ${args.join(' ')}`);
    return { success: true, dryRun: true };
  }

  if (VERBOSE) {
    console.log(`  Running: bd ${args.join(' ')}`);
  }

  const result = spawnSync('bd', args, {
    encoding: 'utf-8',
    timeout: 30000,
  });

  if (result.error || result.status !== 0) {
    const error = result.error?.message || result.stderr || 'Unknown error';
    console.error(`  Error: ${error}`);
    return { success: false, error };
  }

  // Extract ID from output for create commands
  const idMatch = (result.stdout || '').match(/([a-z-]+-[a-z0-9]+)/);
  return {
    success: true,
    id: idMatch ? idMatch[1] : null,
    stdout: result.stdout,
  };
}

/**
 * Map MASTER_PLAN status to beads status
 */
function mapStatus(statusRaw, isDone) {
  if (isDone) return { status: 'closed', label: null };

  const mapping = STATUS_MAP[statusRaw];
  if (mapping) return mapping;

  // Default to open with original status as label
  return { status: 'open', label: statusRaw.toLowerCase().replace(/\s+/g, '-') };
}

/**
 * Map MASTER_PLAN priority to beads priority (0-4)
 */
function mapPriority(priority) {
  const mapped = PRIORITY_MAP[priority.toUpperCase()];
  return mapped !== undefined ? mapped : 2; // Default P2
}

/**
 * Map MASTER_PLAN type prefix to beads type
 */
function mapType(type) {
  return TYPE_MAP[type] || 'task';
}

/**
 * Main sync function
 */
function sync() {
  console.log('\n🔄 MASTER_PLAN.md → Beads Sync\n');

  // Read MASTER_PLAN.md
  if (!fs.existsSync(MASTER_PLAN_PATH)) {
    console.error(`Error: ${MASTER_PLAN_PATH} not found`);
    process.exit(1);
  }

  const content = fs.readFileSync(MASTER_PLAN_PATH, 'utf-8');
  const tasks = parseMasterPlan(content);

  console.log(`📋 Found ${tasks.length} tasks in MASTER_PLAN.md`);

  // Get current beads
  const beadsMap = getBeadsMap();
  console.log(`📦 Found ${beadsMap.size} beads with external refs\n`);

  // Track changes
  const stats = {
    created: 0,
    updated: 0,
    closed: 0,
    unchanged: 0,
    errors: 0,
  };

  // Process each task
  for (const task of tasks) {
    const { id, title, statusRaw, priority, isDone, type, blockedBy, dependsOn } = task;
    const { status, label } = mapStatus(statusRaw, isDone);
    const beadType = mapType(type);
    const beadPriority = mapPriority(priority);

    const existing = beadsMap.get(id);

    if (existing) {
      // Update existing bead if changed
      const needsUpdate =
        existing.status !== status ||
        existing.priority !== beadPriority ||
        existing.title !== `${id}: ${title}`;

      if (needsUpdate || FORCE) {
        console.log(`📝 Updating ${id}: ${title.substring(0, 40)}...`);

        const args = ['update', existing.id, '--status', status, '--priority', String(beadPriority)];

        // Update title if changed
        if (existing.title !== `${id}: ${title}`) {
          args.push('--title', `${id}: ${title}`);
        }

        // Add/update label if needed
        if (label && (!existing.labels || !existing.labels.includes(label))) {
          args.push('--add-label', label);
        }

        const result = runBd(args);
        if (result.success) {
          stats.updated++;
        } else {
          stats.errors++;
        }
      } else {
        if (VERBOSE) console.log(`✓ ${id}: unchanged`);
        stats.unchanged++;
      }

      // Remove from map (to track orphans later)
      beadsMap.delete(id);
    } else {
      // Create new bead
      console.log(`➕ Creating ${id}: ${title.substring(0, 40)}...`);

      // Collect all labels
      const labels = [];
      if (label) labels.push(label);
      if (type === 'IDEA') labels.push('idea');
      if (type === 'ROAD') labels.push('roadmap');

      const args = [
        'create',
        `${id}: ${title}`,
        '--external-ref', id,
        '--type', beadType,
        '--priority', String(beadPriority),
      ];

      // Add labels if any
      if (labels.length > 0) {
        args.push('--labels', labels.join(','));
      }

      const result = runBd(args);

      if (result.success) {
        stats.created++;

        // Update status if not 'open' (bd create defaults to open)
        if (result.id && !DRY_RUN) {
          if (status === 'in_progress') {
            runBd(['update', result.id, '--status', 'in_progress']);
          } else if (status === 'closed') {
            runBd(['close', result.id, '--reason', 'Marked done in MASTER_PLAN.md']);
          }
        }
      } else {
        stats.errors++;
      }
    }
  }

  // Handle dependencies in a second pass (after all beads exist)
  if (!DRY_RUN) {
    console.log('\n🔗 Processing dependencies...');

    for (const task of tasks) {
      const allDeps = [...task.blockedBy, ...task.dependsOn];
      if (allDeps.length === 0) continue;

      // Get the bead ID for this task
      const taskBeadResult = spawnSync('bd', ['list', '--json', '--limit', '0'], {
        encoding: 'utf-8',
      });

      if (taskBeadResult.error) continue;

      const jsonStart = (taskBeadResult.stdout || '').indexOf('[');
      if (jsonStart === -1) continue;

      // Read JSONL to find beads by external_ref
      const jsonlPath = path.resolve(__dirname, '../.beads/issues.jsonl');
      if (!fs.existsSync(jsonlPath)) continue;

      const jsonlContent = fs.readFileSync(jsonlPath, 'utf-8');
      const beadsByRef = new Map();

      for (const line of jsonlContent.trim().split('\n').filter(l => l)) {
        try {
          const issue = JSON.parse(line);
          if (issue.external_ref) {
            beadsByRef.set(issue.external_ref, issue.id);
          }
        } catch (e) {}
      }

      const taskBeadId = beadsByRef.get(task.id);
      if (!taskBeadId) continue;

      for (const depId of allDeps) {
        const depBeadId = beadsByRef.get(depId);
        if (depBeadId && depBeadId !== taskBeadId) {
          if (VERBOSE) console.log(`  ${task.id} depends on ${depId}`);
          runBd(['dep', 'add', taskBeadId, depBeadId]);
        }
      }
    }
  }

  // Report orphaned beads (exist in beads but not in MASTER_PLAN)
  if (beadsMap.size > 0) {
    console.log(`\n⚠️  ${beadsMap.size} orphaned beads (not in MASTER_PLAN.md):`);
    for (const [ref, bead] of beadsMap) {
      console.log(`   - ${ref}: ${bead.title} (${bead.status})`);
    }
    console.log('   These beads have external refs that don\'t match any MASTER_PLAN task.');
    console.log('   They may have been manually created or the task was archived.');
  }

  // Summary
  console.log('\n' + '─'.repeat(50));
  console.log('📊 Sync Summary:');
  console.log(`   Created: ${stats.created}`);
  console.log(`   Updated: ${stats.updated}`);
  console.log(`   Unchanged: ${stats.unchanged}`);
  console.log(`   Errors: ${stats.errors}`);

  if (DRY_RUN) {
    console.log('\n🔍 This was a dry run. No changes were made.');
    console.log('   Run without --dry-run to apply changes.');
  }

  console.log('');

  // Run bd sync at the end
  if (!DRY_RUN && (stats.created > 0 || stats.updated > 0)) {
    console.log('🔄 Running bd sync...');
    runBd(['sync'], { allowInDryRun: false });
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

// Run
sync();
