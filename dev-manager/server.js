/**
 * Dev Manager Server
 * Serves static files and provides API for editing MASTER_PLAN.md
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const http = require('http');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
const pty = require('node-pty');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 6010;

// SSE clients for live file sync
let sseClients = [];

// Paths
const DEV_MANAGER_DIR = __dirname;
const PROJECT_ROOT = path.join(__dirname, '..');
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

// Serve node_modules for xterm and socket.io-client
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// API: Get MASTER_PLAN.md content
app.get('/api/master-plan', async (req, res) => {
  try {
    const content = await fs.readFile(MASTER_PLAN_PATH, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get Git Diff
app.get('/api/diff', (req, res) => {
  const options = { cwd: PROJECT_ROOT, maxBuffer: 1024 * 1024 * 10 }; // 10MB buffer
  exec('git diff --color=always', options, (error, stdout, stderr) => {
    if (error) {
      // It's okay if it fails (e.g. not a git repo), but return empty
      // console.error(`exec error: ${error}`);
      return res.json({ diff: stdout || stderr || '' });
    }
    // Convert ANSI colors to HTML if needed, but xterm handles ANSI.
    // However, if we want a static diff view we might need a converter.
    // For now, let's return raw text and handle it on frontend or just rely on terminal.
    // Actually, let's use `git diff` without color for the text view, or with color for terminal view.
    // Let's return raw text for now.

    // Better: return diff of staged + unstaged changes
    exec('git diff HEAD', options, (err, out, serr) => {
       res.json({ diff: out || stdout || '' });
    });
  });
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

// ===== SOCKET.IO AGENT TERMINAL =====

io.on('connection', (socket) => {
  console.log('[Socket] Client connected', socket.id);
  let ptyProcess = null;

  socket.on('agent-start', ({ taskId, taskTitle, taskDescription }) => {
    if (ptyProcess) {
      socket.emit('agent-error', 'Agent already running');
      return;
    }

    const shell = process.env.SHELL || 'bash';
    const agentCommand = process.env.AGENT_COMMAND || 'claude';

    // Construct initial prompt
    // Note: This depends on how the CLI accepts input.
    // If it's `claude "prompt"`, we run that.
    // If it's interactive, we might just start `claude` and type into it.
    // Assuming `claude` CLI starts a REPL, and we want to feed it the task.
    // Or we run `claude -p "prompt"`.
    // Let's try running the command directly. If the user wants to pass the task context,
    // they can configure AGENT_COMMAND to be a wrapper script or we assume `claude`.

    // For now, let's spawn a shell and type the command for them, so they see it.

    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: PROJECT_ROOT,
      env: process.env
    });

    // Pipe pty output to socket
    ptyProcess.onData((data) => {
      socket.emit('agent-output', data);
    });

    ptyProcess.onExit((res) => {
      socket.emit('agent-exit', res);
      ptyProcess = null;
    });

    // Start the agent automatically
    // We construct a prompt based on the task
    const prompt = `I am working on task ${taskId}: "${taskTitle}".\n${taskDescription}\n\nPlease help me complete this task.`;
    // Escape prompt for shell
    const escapedPrompt = prompt.replace(/"/g, '\\"');

    // Send command to shell
    // We use echo to show what's happening, then run the agent
    // ptyProcess.write(`echo "Starting Agent for ${taskId}..."\r`);

    // If command is 'claude', we might want to pass the prompt as an argument if supported,
    // or just start it and let the user paste/type.
    // "Claude Code" (the beta CLI) typically works by `claude` -> interactive repl.
    // Or `claude "do this"` -> executes and returns (or enters interactive mode).
    // Let's try `claude "prompt"` strategy if the command looks like `claude`.

    const cmd = `${agentCommand} "${escapedPrompt}"`;
    ptyProcess.write(`${cmd}\r`);
  });

  socket.on('agent-input', (data) => {
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });

  socket.on('agent-resize', ({ cols, rows }) => {
    if (ptyProcess) {
      ptyProcess.resize(cols, rows);
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Client disconnected');
    if (ptyProcess) {
      ptyProcess.kill();
    }
  });
});

/**
 * Update a task's property in MASTER_PLAN.md
 * Handles both dependency table and task header sections
 */
function updateTaskProperty(content, taskId, property, value) {
  // ... (Same as before)
  const lines = content.split('\n');
  let updated = false;
  let inTargetSection = false;
  const taskIdPattern = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const anyTaskHeader = line.match(/^### (?:~~)?([A-Z]+-\d+)(?:~~)?:/);
    if (anyTaskHeader) {
      inTargetSection = anyTaskHeader[1] === taskId;
    }
    if (line.startsWith('## ') || line === '---') {
      inTargetSection = false;
    }

    if (line.includes(`| ${taskId}`) || line.includes(`| ~~${taskId}~~`) ||
      line.includes(`|${taskId}`) || line.includes(`|~~${taskId}~~`)) {

      if (property === 'status') {
        lines[i] = updateTableRowStatus(line, taskId, value);
        updated = true;
      } else if (property === 'priority') {
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

    if (line.startsWith('**Status**:') && updated && property === 'status') {
      const statusEmoji = getStatusEmoji(value);
      const statusText = getStatusText(value);
      lines[i] = `**Status**: ${statusEmoji} ${statusText}`;
    }

    if (line.startsWith('**Priority**:') && property === 'priority' && inTargetSection) {
      lines[i] = `**Priority**: ${value}`;
      updated = true;
    }
  }

  if (!updated && (property === 'priority' || property === 'status')) {
    let insertIndex = -1;
    let foundTask = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const taskHeader = line.match(new RegExp(`^### (?:~~)?(${taskIdPattern})(?:~~)?:`));

      if (taskHeader && taskHeader[1] === taskId) {
        foundTask = true;
        insertIndex = i + 1;
        break;
      }
    }

    if (foundTask && insertIndex !== -1) {
      if (property === 'priority') {
        lines.splice(insertIndex, 0, `**Priority**: ${value}`);
        updated = true;
      } else if (property === 'status') {
        const statusEmoji = getStatusEmoji(value);
        const statusText = getStatusText(value);
        lines.splice(insertIndex, 0, `**Status**: ${statusEmoji} ${statusText}`);
        updated = true;
      }
    }
  }

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

    if (line.startsWith('|') && (line.includes(taskId) || line.includes(`~~${taskId}~~`))) {
      const cells = line.split('|').map(c => c.trim());
      let idCellIndex = -1;
      for (let j = 0; j < cells.length; j++) {
        if (cells[j].includes(taskId)) {
          idCellIndex = j;
          break;
        }
      }

      if (idCellIndex >= 0 && cells.length > idCellIndex + 1) {
        const statusCellIndex = idCellIndex + 1;
        if (newStatus === 'done') {
          cells[idCellIndex] = `~~**${taskId}**~~`;
          cells[statusCellIndex] = `${statusEmoji} **DONE**`;
        } else {
          cells[idCellIndex] = cells[idCellIndex].replace(/~~\*\*|\*\*~~|~~/g, '');
          if (!cells[idCellIndex].includes('**')) {
            cells[idCellIndex] = `**${taskId}**`;
          }
          cells[statusCellIndex] = `${statusEmoji} **${statusText}**`;
        }
        lines[i] = '| ' + cells.filter(c => c !== '').join(' | ') + ' |';
      }
    }

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

function updateTableRowStatus(line, taskId, status) {
  // Helper to update specific row if needed, logic is largely in updateTaskStatus
  // Reusing updateTaskStatus logic for simplicity or implementing detailed row update here
  // For now, let's just rely on the main updateTaskStatus logic which handles both
  return line;
}

function getStatusEmoji(status) {
  const emojiMap = {
    'todo': '📋', 'planned': '📋',
    'in-progress': '🔄', 'in_progress': '🔄',
    'review': '👀', 'in review': '👀', 'monitoring': '👀',
    'done': '✅', 'complete': '✅', 'completed': '✅'
  };
  return emojiMap[status.toLowerCase()] || '📋';
}

function getStatusText(status) {
  const textMap = {
    'todo': 'PLANNED', 'planned': 'PLANNED',
    'in-progress': 'IN PROGRESS', 'in_progress': 'IN PROGRESS',
    'review': 'IN REVIEW', 'in review': 'IN REVIEW', 'monitoring': 'MONITORING',
    'done': 'DONE', 'complete': 'DONE', 'completed': 'DONE'
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

  res.write('data: {"type":"connected"}\n\n');
  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

function broadcastFileChange() {
  const event = JSON.stringify({ type: 'file-changed', file: 'MASTER_PLAN.md', timestamp: Date.now() });
  sseClients.forEach(client => {
    client.write(`data: ${event}\n\n`);
  });
}

function broadcastLockChange() {
  const event = JSON.stringify({ type: 'locks-changed', timestamp: Date.now() });
  sseClients.forEach(client => {
    client.write(`data: ${event}\n\n`);
  });
}

// File watcher
let lastMtime = null;

function setupFileWatcher() {
  try {
    const stats = fsSync.statSync(MASTER_PLAN_PATH);
    lastMtime = stats.mtimeMs;
  } catch (error) {
    console.error('[FileWatcher] Failed to get initial file stats:', error.message);
  }

  setInterval(() => {
    try {
      const stats = fsSync.statSync(MASTER_PLAN_PATH);
      if (lastMtime && stats.mtimeMs !== lastMtime) {
        lastMtime = stats.mtimeMs;
        broadcastFileChange();
      } else if (!lastMtime) {
        lastMtime = stats.mtimeMs;
      }
    } catch (error) {}
  }, 2000);

  try {
    fsSync.watch(MASTER_PLAN_PATH, (eventType) => {
      if (eventType === 'change') {
        try {
          const stats = fsSync.statSync(MASTER_PLAN_PATH);
          if (stats.mtimeMs !== lastMtime) {
            lastMtime = stats.mtimeMs;
            broadcastFileChange();
          }
        } catch (e) { }
      }
    });
  } catch (error) {}
}

let lastLocksMtime = new Map();

function setupLocksWatcher() {
  try {
    fsSync.accessSync(LOCKS_DIR);
  } catch {
    setTimeout(setupLocksWatcher, 5000);
    return;
  }

  try {
    fsSync.watch(LOCKS_DIR, (eventType, filename) => {
      if (filename && filename.endsWith('.lock')) {
        broadcastLockChange();
      }
    });
  } catch (error) {}

  setInterval(() => {
    try {
      const files = fsSync.readdirSync(LOCKS_DIR);
      const currentLocks = new Set(files.filter(f => f.endsWith('.lock')));
      const previousLocks = new Set(lastLocksMtime.keys());
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
      if (changed) broadcastLockChange();
    } catch {}
  }, 3000);
}

// Start server
server.listen(PORT, () => {
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
║  Agent: socket.io enabled (port ${PORT})               ║
╚════════════════════════════════════════════════════════╝
  `);
  setupFileWatcher();
  setupLocksWatcher();
});
