/**
 * Dev Manager Server
 * Serves static files and provides API for editing MASTER_PLAN.md
 */

const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 6010;

// SSE clients for live file sync
let sseClients = [];

// Paths
const DEV_MANAGER_DIR = __dirname;
const MASTER_PLAN_PATH = path.join(__dirname, '..', 'docs', 'MASTER_PLAN.md');

// Middleware
app.use(cors());
app.use(express.json());

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

/**
 * Update a task's property in MASTER_PLAN.md
 * Handles both dependency table and task header sections
 */
function updateTaskProperty(content, taskId, property, value) {
  console.log(`[updateTaskProperty] taskId=${taskId}, property=${property}, value=${value}`);
  const lines = content.split('\n');
  let updated = false;
  let inTargetSection = false;  // Track if we're in the target task's section
  let foundPriorityLines = [];  // Debug: track all priority lines found

  // Patterns for different task ID formats
  const taskIdPattern = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we're entering a new task section (any ### TASK-XXX header)
    const anyTaskHeader = line.match(/^### (?:~~)?([A-Z]+-\d+)(?:~~)?:/);
    if (anyTaskHeader) {
      const wasInTarget = inTargetSection;
      // Check if this is OUR target task
      inTargetSection = anyTaskHeader[1] === taskId;
      if (inTargetSection) {
        console.log(`[updateTaskProperty] FOUND target section at line ${i}: "${line.substring(0, 60)}..."`);
      }
    }
    // Also reset on major section dividers
    if (line.startsWith('## ') || line === '---') {
      if (inTargetSection) {
        console.log(`[updateTaskProperty] EXITED target section at line ${i}: "${line.substring(0, 40)}"`);
      }
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
    // Format: ### TASK-XXX: Title (STATUS)
    // Or: ### ~~TASK-XXX~~: Title (STATUS)
    const headerMatch = line.match(new RegExp(`^### (?:~~)?(${taskIdPattern})(?:~~)?:\\s*(.+?)(?:\\s*\\(([^)]+)\\))?$`));
    if (headerMatch) {
      if (property === 'status') {
        const title = headerMatch[2].replace(/\s*[✅🔄⏳👀🕐🚧⏸️]+\s*(DONE|COMPLETE|IN PROGRESS|MONITORING|PENDING|PAUSED)?/gi, '').trim();
        const statusEmoji = getStatusEmoji(value);
        const statusText = getStatusText(value);

        if (value === 'done') {
          lines[i] = `### ~~${taskId}~~: ${title} ${statusEmoji} ${statusText}`;
        } else {
          lines[i] = `### ${taskId}: ${title} (${statusEmoji} ${statusText})`;
        }
        updated = true;
      }
    }

    // Update **Status**: line within task section
    if (line.startsWith('**Status**:') && updated && property === 'status') {
      const statusEmoji = getStatusEmoji(value);
      const statusText = getStatusText(value);
      lines[i] = `**Status**: ${statusEmoji} ${statusText}`;
    }

    // Update **Priority**: line within task section (only if we're in the target task)
    // Check for any line containing **Priority** for debugging
    if (line.includes('**Priority**')) {
      foundPriorityLines.push({ lineNum: i, line: line.substring(0, 50), inTargetSection });
    }

    if (line.startsWith('**Priority**:') && property === 'priority' && inTargetSection) {
      console.log(`[updateTaskProperty] UPDATING priority at line ${i}: "${line}" -> "**Priority**: ${value}"`);
      lines[i] = `**Priority**: ${value}`;
      updated = true;
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

// File watcher with debounce
let fileChangeTimeout = null;
function setupFileWatcher() {
  try {
    fsSync.watch(MASTER_PLAN_PATH, (eventType, filename) => {
      if (eventType === 'change') {
        // Debounce rapid changes (e.g., editor saves multiple times)
        if (fileChangeTimeout) clearTimeout(fileChangeTimeout);
        fileChangeTimeout = setTimeout(() => {
          console.log(`[FileWatcher] MASTER_PLAN.md changed`);
          broadcastFileChange();
        }, 500); // 500ms debounce
      }
    });
    console.log('[FileWatcher] Watching MASTER_PLAN.md for changes');
  } catch (error) {
    console.error('[FileWatcher] Failed to watch file:', error.message);
  }
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
╚════════════════════════════════════════════════════════╝
  `);

  // Start file watcher for live sync
  setupFileWatcher();
});
