/**
 * Dev Manager Server
 * Serves static files and provides API for editing MASTER_PLAN.md
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 6010;

// SSE clients for live file sync
let sseClients = [];

// Paths
const DEV_MANAGER_DIR = __dirname;
const MASTER_PLAN_PATH = process.env.MASTER_PLAN_PATH
  ? path.resolve(process.env.MASTER_PLAN_PATH)
  : path.join(__dirname, '..', 'docs', 'MASTER_PLAN.md');
const LOCKS_DIR = path.join(__dirname, '..', '.claude', 'locks');

// Middleware
app.use(cors());
app.use(express.json());

// Aggressive cache-control - prevent stale data issues
app.use((req, res, next) => {
  // Disable caching for HTML and markdown files
  if (req.path.endsWith('.html') || req.path.endsWith('.md') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.static(DEV_MANAGER_DIR));

// API: Get MASTER_PLAN.md content
app.get('/api/master-plan', async (req, res) => {
  try {
    const content = await fs.readFile(MASTER_PLAN_PATH, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Update task property
app.post('/api/task/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { property, value } = req.body;

    if (!property || value === undefined) {
      return res.status(400).json({ error: 'Missing property or value' });
    }

    const content = await fs.readFile(MASTER_PLAN_PATH, 'utf-8');
    const updatedContent = updateTaskProperty(content, id, property, value);

    if (updatedContent === content) {
      // Return success even if nothing changed (idempotent operation)
      return res.json({ success: true, id, property, value, message: 'No change needed' });
    }

    await fs.writeFile(MASTER_PLAN_PATH, updatedContent, 'utf-8');
    res.json({ success: true, id, property, value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Update task status in dependency table
app.post('/api/task/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'todo', 'in-progress', 'review', 'done'

    const content = await fs.readFile(MASTER_PLAN_PATH, 'utf-8');
    const updatedContent = updateTaskStatus(content, id, status);

    await fs.writeFile(MASTER_PLAN_PATH, updatedContent, 'utf-8');
    res.json({ success: true, id, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Batch update (for drag-drop column changes)
app.post('/api/task/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const { fromColumn, toColumn } = req.body;

    const statusMap = {
      'todo': 'PLANNED',
      'in-progress': 'IN_PROGRESS',
      'review': 'IN REVIEW',
      'done': 'DONE'
    };

    const content = await fs.readFile(MASTER_PLAN_PATH, 'utf-8');
    const updatedContent = updateTaskStatus(content, id, statusMap[toColumn] || toColumn);

    await fs.writeFile(MASTER_PLAN_PATH, updatedContent, 'utf-8');
    res.json({ success: true, id, status: toColumn });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get active task locks
app.get('/api/locks', async (req, res) => {
  try {
    const locks = [];

    // Check if locks directory exists
    try {
      await fs.access(LOCKS_DIR);
    } catch {
      // Locks directory doesn't exist yet
      return res.json({ locks: [], count: 0 });
    }

    // Read all .lock files
    const files = await fs.readdir(LOCKS_DIR);
    const lockFiles = files.filter(f => f.endsWith('.lock'));

    for (const file of lockFiles) {
      try {
        const content = await fs.readFile(path.join(LOCKS_DIR, file), 'utf-8');
        const lockData = JSON.parse(content);

        // Extract just the filename from full paths
        const filesShort = (lockData.files_touched || []).map(f => path.basename(f));

        locks.push({
          task_id: lockData.task_id,
          session_id: lockData.session_id,
          session_short: lockData.session_id ? lockData.session_id.substring(0, 8) + '...' : 'unknown',
          locked_at: lockData.locked_at,
          timestamp: lockData.timestamp,
          files: filesShort,
          files_full: lockData.files_touched || []
        });
      } catch (parseError) {
        console.error(`[Locks] Failed to parse ${file}:`, parseError.message);
      }
    }

    // Sort by timestamp (most recent first)
    locks.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    res.json({ locks, count: locks.length });
  } catch (error) {
    console.error('[Locks] Error reading locks:', error.message);
    res.status(500).json({ error: error.message, locks: [], count: 0 });
  }
});

/**
 * Update a task's property in MASTER_PLAN.md
 * Handles both dependency table and task header sections
 */
function updateTaskProperty(content, taskId, property, value) {
  console.log(`[updateTaskProperty] taskId=${taskId}, property=${property}, value=${value}`);
  const lines = content.split('\n');
  let updated = false;
  let updatedSection = false; // Specifically track if the detail section was updated
  let inTargetSection = false;  // Track if we're in the target task's section
  let foundPriorityLines = [];  // Debug: track all priority lines found

  // Patterns for different task ID formats
  const taskIdPattern = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we're entering a new task section (any ### TASK-XXX header)
    // Relaxed pattern to catch variations
    const anyTaskHeader = line.match(/^### (?:~~)?([A-Z]+-\d+)(?:~~)?(?:\:|\s|$)/);
    if (anyTaskHeader) {
      // Check if this is OUR target task
      inTargetSection = anyTaskHeader[1] === taskId;
    }
    // Also reset on major section dividers
    if (line.startsWith('## ') || line === '---') {
      inTargetSection = false;
    }

    // Update dependency table row
    // Format: | TASK-XXX | STATUS | files | depends | blocks |
    if (line.includes(`| ${taskId}`) || line.includes(`| ~~${taskId}~~`) ||
      line.includes(`|${taskId}`) || line.includes(`|~~${taskId}~~`)) {

      if (property === 'status') {
        lines[i] = updateTableRowStatus(line, taskId, value);
        updated = true;
      } else if (property === 'priority') {
        // Update priority in table if there's a priority column
        const cells = line.split('|');
        for (let j = 0; j < cells.length; j++) {
          if (cells[j].match(/P[1-3]|HIGH|MEDIUM|LOW|Priority/i) && !cells[j].includes(taskId)) {
            cells[j] = ` ${value} `;
            lines[i] = cells.join('|');
            updated = true;
            break;
          }
        }
      }
    }

    // Update task header section
    // Relaxed header match to be more robust
    if (inTargetSection && line.startsWith('### ')) {
      if (property === 'status') {
        const headerMatch = line.match(/^### (?:~~)?(.+?)(?:\s*:?\s*(.+?))?(?:\s*\(([^)]+)\))?$/);
        if (headerMatch) {
          const title = headerMatch[2] ? headerMatch[2].replace(/\s*[✅🔄⏳👀🕐🚧⏸️]+\s*(DONE|COMPLETE|IN PROGRESS|MONITORING|PENDING|PAUSED)?/gi, '').trim() : '';
          const statusEmoji = getStatusEmoji(value);
          const statusText = getStatusText(value);

          if (value === 'done') {
            lines[i] = `### ~~${taskId}~~: ${title} ${statusEmoji} ${statusText}`;
          } else {
            lines[i] = `### ${taskId}: ${title} (${statusEmoji} ${statusText})`;
          }
          updated = true;
          updatedSection = true;
        }
      }
    }

    // Update **Status**: line within task section
    if (line.startsWith('**Status**:') && property === 'status' && inTargetSection) {
      const statusEmoji = getStatusEmoji(value);
      const statusText = getStatusText(value);
      lines[i] = `**Status**: ${statusEmoji} ${statusText}`;
      updated = true;
      updatedSection = true;
    }

    // Update **Priority**: line within task section (only if we're in the target task)
    if (line.startsWith('**Priority**:') && property === 'priority' && inTargetSection) {
      console.log(`[updateTaskProperty] UPDATING priority at line ${i}: "${line}" -> "**Priority**: ${value}"`);
      lines[i] = `**Priority**: ${value}`;
      updated = true;
      updatedSection = true;
    }
  }

  // If priority wasn't updated in section but was requested, attempt insertion.
  if (property === 'priority' && !updatedSection) {
    console.log(`[updateTaskProperty] Priority not found in section for ${taskId}, attempting insertion...`);
    let insertIndex = -1;
    let foundTask = false;

    // Find the task header one more time to determine insertion point
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const taskHeader = line.match(new RegExp(`^### (?:~~)?(${taskIdPattern})(?:~~)?(?:\:|\s|$)`));

      if (taskHeader && taskHeader[1] === taskId) {
        foundTask = true;
        insertIndex = i + 1;
        break;
      }
    }

    if (foundTask && insertIndex !== -1) {
      lines.splice(insertIndex, 0, `**Priority**: ${value}`);
      updated = true;
      console.log(`[updateTaskProperty] INSERTED priority for ${taskId} at line ${insertIndex}`);
    }
  }

  console.log(`[updateTaskProperty] Result: updated=${updated}, foundPriorityLines=`, JSON.stringify(foundPriorityLines));
  return lines.join('\n');
}

/**
 * Update task status in dependency table
 */
function updateTaskStatus(content, taskId, newStatus) {
  const lines = content.split('\n');
  const statusText = getStatusText(newStatus);
  const statusEmoji = getStatusEmoji(newStatus);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match dependency table row containing this task ID
    if (line.startsWith('|') && (line.includes(taskId) || line.includes(`~~${taskId}~~`))) {
      const cells = line.split('|').map(c => c.trim());

      // Find the ID cell index (usually index 1)
      let idCellIndex = -1;
      for (let j = 0; j < cells.length; j++) {
        if (cells[j].includes(taskId)) {
          idCellIndex = j;
          break;
        }
      }

      if (idCellIndex >= 0 && cells.length > idCellIndex + 1) {
        // Status is typically the next cell after ID
        const statusCellIndex = idCellIndex + 1;

        // Format the new status cell
        if (newStatus === 'done') {
          cells[idCellIndex] = `~~**${taskId}**~~`;
          cells[statusCellIndex] = `${statusEmoji} **DONE**`;
        } else {
          // Remove strikethrough if moving back from done
          cells[idCellIndex] = cells[idCellIndex].replace(/~~\*\*|\*\*~~|~~/g, '');
          if (!cells[idCellIndex].includes('**')) {
            cells[idCellIndex] = `**${taskId}**`;
          }
          cells[statusCellIndex] = `${statusEmoji} **${statusText}**`;
        }

        lines[i] = '| ' + cells.filter(c => c !== '').join(' | ') + ' |';
      }
    }

    // Also update task header if exists
    const headerMatch = line.match(/^### (?:~~)?([A-Z]+-\d+)(?:~~)?:/);
    if (headerMatch && headerMatch[1] === taskId) {
      const restOfLine = line.substring(line.indexOf(':') + 1).trim();
      const title = restOfLine.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*[✅🔄⏳👀🕐🚧]+\s*(DONE|COMPLETE|IN PROGRESS|MONITORING)?/gi, '').trim();

      if (newStatus === 'done') {
        lines[i] = `### ~~${taskId}~~: ${title} (${statusEmoji} DONE)`;
      } else {
        lines[i] = `### ${taskId}: ${title} (${statusEmoji} ${statusText})`;
      }
    }
  }

  return lines.join('\n');
}

function getStatusEmoji(status) {
  const emojiMap = {
    'todo': '📋',
    'planned': '📋',
    'in-progress': '🔄',
    'in_progress': '🔄',
    'review': '👀',
    'in review': '👀',
    'monitoring': '👀',
    'done': '✅',
    'complete': '✅',
    'completed': '✅'
  };
  return emojiMap[status.toLowerCase()] || '📋';
}

function getStatusText(status) {
  const textMap = {
    'todo': 'PLANNED',
    'planned': 'PLANNED',
    'in-progress': 'IN PROGRESS',
    'in_progress': 'IN PROGRESS',
    'review': 'IN REVIEW',
    'in review': 'IN REVIEW',
    'monitoring': 'MONITORING',
    'done': 'DONE',
    'complete': 'DONE',
    'completed': 'DONE'
  };
  return textMap[status.toLowerCase()] || status.toUpperCase();
}

// ===== LIVE FILE SYNC (SSE) =====

// SSE endpoint for file change notifications
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection event
  res.write('data: {"type":"connected"}\n\n');

  // Add this client to the list
  sseClients.push(res);
  console.log(`[SSE] Client connected. Total clients: ${sseClients.length}`);

  // Remove client on disconnect
  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
    console.log(`[SSE] Client disconnected. Total clients: ${sseClients.length}`);
  });
});

// Broadcast file change to all connected clients
function broadcastFileChange() {
  const event = JSON.stringify({ type: 'file-changed', file: 'MASTER_PLAN.md', timestamp: Date.now() });
  sseClients.forEach(client => {
    client.write(`data: ${event}\n\n`);
  });
  console.log(`[SSE] Broadcasted file change to ${sseClients.length} clients`);
}

// Broadcast lock change to all connected clients
function broadcastLockChange() {
  const event = JSON.stringify({ type: 'locks-changed', timestamp: Date.now() });
  sseClients.forEach(client => {
    client.write(`data: ${event}\n\n`);
  });
  console.log(`[SSE] Broadcasted lock change to ${sseClients.length} clients`);
}

// File watcher using polling (more reliable than fs.watch for detecting all changes)
let lastMtime = null;
let pollInterval = null;

function setupFileWatcher() {
  // Get initial mtime
  try {
    const stats = fsSync.statSync(MASTER_PLAN_PATH);
    lastMtime = stats.mtimeMs;
  } catch (error) {
    console.error('[FileWatcher] Failed to get initial file stats:', error.message);
  }

  // Poll every 2 seconds for changes
  pollInterval = setInterval(() => {
    try {
      const stats = fsSync.statSync(MASTER_PLAN_PATH);
      if (lastMtime && stats.mtimeMs !== lastMtime) {
        console.log(`[FileWatcher] MASTER_PLAN.md changed (mtime: ${new Date(stats.mtimeMs).toISOString()})`);
        lastMtime = stats.mtimeMs;
        broadcastFileChange();
      } else if (!lastMtime) {
        lastMtime = stats.mtimeMs;
      }
    } catch (error) {
      // File might be temporarily unavailable during write
      console.log('[FileWatcher] File temporarily unavailable, will retry...');
    }
  }, 2000); // Check every 2 seconds

  console.log('[FileWatcher] Polling MASTER_PLAN.md for changes (every 2s)');

  // Also try fs.watch as a faster backup (works for some editors)
  try {
    fsSync.watch(MASTER_PLAN_PATH, (eventType) => {
      if (eventType === 'change') {
        // Update mtime check immediately
        try {
          const stats = fsSync.statSync(MASTER_PLAN_PATH);
          if (stats.mtimeMs !== lastMtime) {
            console.log(`[FileWatcher] MASTER_PLAN.md changed (fs.watch)`);
            lastMtime = stats.mtimeMs;
            broadcastFileChange();
          }
        } catch (e) { /* ignore */ }
      }
    });
    console.log('[FileWatcher] Also using fs.watch for faster detection');
  } catch (error) {
    console.log('[FileWatcher] fs.watch not available, using polling only');
  }
}

// Setup locks directory watcher
let lastLocksMtime = new Map(); // Track individual lock file mtimes

function setupLocksWatcher() {
  // Check if locks directory exists
  try {
    fsSync.accessSync(LOCKS_DIR);
  } catch {
    console.log('[LocksWatcher] Locks directory not found, will retry...');
    // Retry after 5 seconds
    setTimeout(setupLocksWatcher, 5000);
    return;
  }

  // Watch the locks directory for changes
  try {
    fsSync.watch(LOCKS_DIR, (eventType, filename) => {
      if (filename && filename.endsWith('.lock')) {
        console.log(`[LocksWatcher] Lock ${eventType}: ${filename}`);
        broadcastLockChange();
      }
    });
    console.log('[LocksWatcher] Watching locks directory for changes');
  } catch (error) {
    console.error('[LocksWatcher] Failed to watch locks directory:', error.message);
  }

  // Also poll for changes (more reliable for some filesystems)
  setInterval(() => {
    try {
      const files = fsSync.readdirSync(LOCKS_DIR);
      const currentLocks = new Set(files.filter(f => f.endsWith('.lock')));
      const previousLocks = new Set(lastLocksMtime.keys());

      // Check for new or removed locks
      let changed = false;
      for (const lock of currentLocks) {
        if (!previousLocks.has(lock)) {
          changed = true;
          lastLocksMtime.set(lock, Date.now());
        }
      }
      for (const lock of previousLocks) {
        if (!currentLocks.has(lock)) {
          changed = true;
          lastLocksMtime.delete(lock);
        }
      }

      if (changed) {
        console.log('[LocksWatcher] Lock files changed (polling)');
        broadcastLockChange();
      }
    } catch {
      // Directory might not exist yet
    }
  }, 3000); // Poll every 3 seconds
}

// ===== END LIVE FILE SYNC =====

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║           DEV MANAGER SERVER RUNNING                   ║
╠════════════════════════════════════════════════════════╣
║  URL: http://localhost:${PORT}                          ║
║  API: http://localhost:${PORT}/api/master-plan          ║
║  SSE: http://localhost:${PORT}/api/events               ║
║                                                        ║
║  Editing tasks will update MASTER_PLAN.md directly    ║
║  Live sync: Changes to MASTER_PLAN.md auto-refresh UI ║
║  Locks: http://localhost:${PORT}/api/locks              ║
╚════════════════════════════════════════════════════════╝
  `);

  // Start file watcher for live sync
  setupFileWatcher();

  // Start locks directory watcher
  setupLocksWatcher();
});
