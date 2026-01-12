const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Health scanner
const healthScanner = require('./scripts/health-scanner');

const app = express();
const PORT = process.env.PORT || 6010;

// Cache for health scan results
let healthCache = null;
let healthScanInProgress = false;

// Enable CORS
app.use(cors());

// Serve static files from current directory
app.use(express.static(__dirname));

// API Endpoint to get MASTER_PLAN.md content
app.get('/api/master-plan', (req, res) => {
    // Default to ../docs/MASTER_PLAN.md relative to this script
    const defaultPath = path.join(__dirname, '../docs/MASTER_PLAN.md');
    // Allow override via env var, resolving relative to CWD or using absolute path
    const masterPlanPath = process.env.MASTER_PLAN_PATH
        ? path.resolve(process.env.MASTER_PLAN_PATH)
        : defaultPath;

    console.log(`[API] Fetching MASTER_PLAN.md from: ${masterPlanPath}`);

    fs.readFile(masterPlanPath, 'utf8', (err, data) => {
        if (err) {
            console.error(`[API] Error reading MASTER_PLAN.md: ${err.message}`);
            return res.status(500).json({
                error: 'Failed to read MASTER_PLAN.md',
                details: err.message,
                path: masterPlanPath
            });
        }
        res.json({ content: data });
    });
});

// Middleware to parse JSON bodies
app.use(express.json());

// Helper to get Master Plan path
const getMasterPlanPath = () => {
    const defaultPath = path.join(__dirname, '../docs/MASTER_PLAN.md');
    return process.env.MASTER_PLAN_PATH
        ? path.resolve(process.env.MASTER_PLAN_PATH)
        : defaultPath;
};

// API Endpoint to update task status
app.post('/api/task/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const masterPlanPath = getMasterPlanPath();
    console.log(`[API] Updating task ${id} status to ${status}`);

    fs.readFile(masterPlanPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read file' });

        const lines = data.split('\n');
        let updated = false;
        let inTargetTask = false;
        let foundStatusLine = false;

        // Status map
        const statusMap = {
            'todo': '',
            'in-progress': '(🔄 IN PROGRESS)',
            'paused': '(⏸️ PAUSED)',
            'review': '(👀 REVIEW)',
            'done': '(✅ DONE)'
        };

        const humanStatusMap = {
            'todo': 'Todo',
            'in-progress': 'In Progress',
            'paused': 'Paused',
            'review': 'Review',
            'done': 'Done'
        };

        const newStatusStr = statusMap[status] || '';
        const newHumanStatus = humanStatusMap[status] || 'Todo';
        const isDone = status === 'done';

        // Regex to match the target task header
        const taskHeaderRegex = new RegExp(`^###\\s+(?:~~)?${id}(?:~~)?:\\s*(.+?)(?:\\s*\\(([^)]+)\\))?$`);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 1. Find and update Header
            const match = line.match(taskHeaderRegex);
            if (match) {
                const title = match[1].trim();
                const newId = isDone ? `~~${id}~~` : id;
                lines[i] = `### ${newId}: ${title} ${newStatusStr}`.trim();
                updated = true;
                inTargetTask = true;
                continue;
            }

            // Detect next task start (stop processing scope)
            if (inTargetTask && line.startsWith('### ')) {
                inTargetTask = false;
                // If we finished the task but didn't find a status line, we should insert it?
                // Logic below handles insertion if still in task.
            }

            // 2. Update Status Metadata Line if exists
            if (inTargetTask) {
                if (line.trim().startsWith('**Status**:')) {
                    lines[i] = `**Status**: ${newHumanStatus}`;
                    foundStatusLine = true;
                }
            }
        }

        // If we updated header but didn't find status line, we need to insert it
        // We'll have to re-scan or just do a second pass? 
        // Or better: Re-read to find insertion point. 
        // Let's refine the loop to insert on the fly if needed.
        // Actually, let's keep it simple: If we found header but not status line, 
        // we can identify the line index of the header + 1 or + 2 to insert.

        if (updated && !foundStatusLine) {
            // Find header index again
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(`###`) && lines[i].includes(id)) {
                    // Start looking for insertion point (after properties, before description)
                    let insertIdx = i + 1;
                    // Skip empty lines or Priority line
                    while (insertIdx < lines.length && (lines[insertIdx].trim() === '' || lines[insertIdx].trim().startsWith('**Priority**:'))) {
                        insertIdx++;
                    }
                    lines.splice(insertIdx, 0, `**Status**: ${newHumanStatus}`);
                    break;
                }
            }
        }

        if (updated) {
            fs.writeFile(masterPlanPath, lines.join('\n'), 'utf8', (err) => {
                if (err) return res.status(500).json({ error: 'Failed to write file' });
                res.json({ success: true, message: 'Status updated' });
            });
        } else {
            res.status(404).json({ error: 'Task not found or format not supported' });
        }
    });
});

// API Endpoint to update task properties (priority, etc)
app.post('/api/task/:id', (req, res) => {
    const { id } = req.params;
    const { property, value } = req.body;
    const masterPlanPath = getMasterPlanPath();
    console.log(`[API] Updating task ${id} property ${property} to ${value}`);

    if (property !== 'priority') {
        return res.status(400).json({ error: 'Only priority updates supported currently' });
    }

    fs.readFile(masterPlanPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read file' });

        let content = data;
        const lines = content.split('\n');
        let updated = false;
        let inTargetTask = false;

        // streaming-like line processing
        for (let i = 0; i < lines.length; i++) {
            constline = lines[i];

            // Detect task start
            if (lines[i].match(new RegExp(`^###\\s+(?:~~)?${id}`))) {
                console.log(`[API] Found task header at line ${i}: ${lines[i]}`);
                inTargetTask = true;
                continue;
            }
            // Detect next task start (stop processing)
            if (inTargetTask && lines[i].startsWith('### ')) {
                console.log(`[API] End of task scope at line ${i}: ${lines[i]}`);
                inTargetTask = false;
                break;
            }

            if (inTargetTask) {
                // Look for **Priority**: line
                if (lines[i].trim().startsWith('**Priority**:')) {
                    console.log(`[API] Found priority line at ${i}: ${lines[i]}`);
                    const oldLine = lines[i];
                    lines[i] = `**Priority**: ${value}`;
                    console.log(`[API] Updated priority line to: ${lines[i]}`);
                    updated = true;
                    break;
                }
            }
        }

        if (!updated && inTargetTask) {
            console.log(`[API] logic finished task scope but didnt find Priority line to update.`);
            // Optional: Insert priority line if missing?
        }

        if (updated) {
            fs.writeFile(masterPlanPath, lines.join('\n'), 'utf8', (err) => {
                if (err) return res.status(500).json({ error: 'Failed to write file' });
                res.json({ success: true });
            });
        } else {
            res.status(404).json({ error: 'Task or Priority field not found' });
        }
    });
});

// Health API Endpoints

// GET /api/health - Full health scan (slow, ~30-60s)
app.get('/api/health', async (req, res) => {
    console.log('[API] Starting full health scan...');

    if (healthScanInProgress) {
        return res.status(429).json({
            error: 'Scan already in progress',
            cached: healthCache
        });
    }

    try {
        healthScanInProgress = true;
        const result = await healthScanner.runFullScan();
        healthCache = result;
        healthScanInProgress = false;

        console.log(`[API] Full scan completed: Score ${result.health.score}/100 (${result.health.grade})`);
        res.json(result);
    } catch (err) {
        healthScanInProgress = false;
        console.error(`[API] Health scan error: ${err.message}`);
        res.status(500).json({
            error: 'Health scan failed',
            details: err.message
        });
    }
});

// GET /api/health/quick - Quick scan (TS + ESLint only, ~5-10s)
app.get('/api/health/quick', async (req, res) => {
    console.log('[API] Starting quick health scan...');

    try {
        const result = await healthScanner.runQuickScan();
        console.log('[API] Quick scan completed');
        res.json(result);
    } catch (err) {
        console.error(`[API] Quick scan error: ${err.message}`);
        res.status(500).json({
            error: 'Quick scan failed',
            details: err.message
        });
    }
});

// GET /api/health/cached - Return last scan results (instant)
app.get('/api/health/cached', (req, res) => {
    if (!healthCache) {
        return res.status(404).json({
            error: 'No cached scan available',
            message: 'Run a full scan first with GET /api/health'
        });
    }

    res.json({
        ...healthCache,
        fromCache: true,
        cacheAge: Date.now() - new Date(healthCache.timestamp).getTime()
    });
});

// GET /api/health/status - Check if scan is in progress
app.get('/api/health/status', (req, res) => {
    res.json({
        scanning: healthScanInProgress,
        hasCachedResult: !!healthCache,
        lastScanTime: healthCache?.timestamp || null
    });
});

// POST /api/health/scan - Trigger background scan (non-blocking)
app.post('/api/health/scan', (req, res) => {
    if (healthScanInProgress) {
        return res.status(429).json({
            error: 'Scan already in progress'
        });
    }

    // Start scan in background
    healthScanInProgress = true;
    console.log('[API] Background scan triggered...');

    healthScanner.runFullScan()
        .then(result => {
            healthCache = result;
            healthScanInProgress = false;
            console.log(`[API] Background scan completed: Score ${result.health.score}/100`);
        })
        .catch(err => {
            healthScanInProgress = false;
            console.error(`[API] Background scan error: ${err.message}`);
        });

    res.json({
        message: 'Scan started in background',
        checkStatus: '/api/health/status',
        getResults: '/api/health/cached'
    });
});

// GET /api/health/report - Generate AI-friendly markdown report
app.get('/api/health/report', async (req, res) => {
    const excludeArchive = req.query.includeArchive !== 'true';

    // Use cached results if available, otherwise run a scan
    let scanData = healthCache;

    if (!scanData) {
        console.log('[API] No cached results, running full scan for report...');
        try {
            scanData = await healthScanner.runFullScan();
            healthCache = scanData;
        } catch (err) {
            return res.status(500).json({
                error: 'Failed to generate report',
                details: err.message
            });
        }
    }

    const report = healthScanner.generateReport(scanData, { excludeArchive });

    // Return as markdown with proper content type
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="health-report.md"');
    res.send(report);
});

// GET /api/health/report/json - Return report data as JSON for programmatic use
app.get('/api/health/report/json', async (req, res) => {
    const excludeArchive = req.query.includeArchive !== 'true';

    let scanData = healthCache;

    if (!scanData) {
        console.log('[API] No cached results, running full scan for report...');
        try {
            scanData = await healthScanner.runFullScan();
            healthCache = scanData;
        } catch (err) {
            return res.status(500).json({
                error: 'Failed to generate report',
                details: err.message
            });
        }
    }

    // Filter archive files if requested
    if (excludeArchive && scanData.results?.typescript?.errors) {
        scanData = JSON.parse(JSON.stringify(scanData)); // Deep clone
        scanData.results.typescript.errors = scanData.results.typescript.errors.filter(
            e => !e.file?.includes('/archive/')
        );
        scanData.results.typescript.count = scanData.results.typescript.errors.length;
    }

    res.json({
        ...scanData,
        reportUrl: '/api/health/report'
    });
});

// GET /api/skills - Dynamically scan .claude/skills/ directory
app.get('/api/skills', (req, res) => {
    const skillsDir = path.join(__dirname, '../.claude/skills');

    try {
        if (!fs.existsSync(skillsDir)) {
            return res.json({ nodes: [], links: [] });
        }

        const nodes = [];
        const links = [];
        const categoryColors = {
            'debugging': '#ef4444',
            'architecture': '#3b82f6',
            'workflow': '#10b981',
            'review': '#f59e0b',
            'research': '#8b5cf6',
            'design': '#ec4899',
            'default': '#6b7280'
        };

        const dirs = fs.readdirSync(skillsDir, { withFileTypes: true })
            .filter(d => d.isDirectory());

        for (let i = 0; i < dirs.length; i++) {
            const dir = dirs[i];
            const skillPath = path.join(skillsDir, dir.name, 'SKILL.md');

            if (!fs.existsSync(skillPath)) continue;

            try {
                const content = fs.readFileSync(skillPath, 'utf8');
                const lines = content.split('\n');

                // Extract title from first # heading
                const titleLine = lines.find(l => l.startsWith('# '));
                const title = titleLine ? titleLine.replace('# ', '').trim() : dir.name;

                // Extract description from first paragraph
                const descStart = lines.findIndex(l => l.trim() && !l.startsWith('#'));
                const description = descStart >= 0 ? lines[descStart].slice(0, 150) : '';

                // Detect category from name or content
                let category = 'default';
                const nameLower = dir.name.toLowerCase();
                if (nameLower.includes('debug') || nameLower.includes('fix')) category = 'debugging';
                else if (nameLower.includes('arch') || nameLower.includes('plan')) category = 'architecture';
                else if (nameLower.includes('workflow') || nameLower.includes('ops')) category = 'workflow';
                else if (nameLower.includes('review')) category = 'review';
                else if (nameLower.includes('research') || nameLower.includes('doc')) category = 'research';
                else if (nameLower.includes('design') || nameLower.includes('ui')) category = 'design';

                nodes.push({
                    id: `skill-${i}`,
                    name: dir.name,
                    title,
                    description,
                    category,
                    color: categoryColors[category] || categoryColors.default,
                    usage: 0
                });

                // Find dependencies (skills that reference each other)
                const refs = content.match(/skill[s]?[:\s]+["']?([a-z-]+)["']?/gi) || [];
                for (const ref of refs) {
                    const targetName = ref.replace(/skill[s]?[:\s]+["']?/i, '').replace(/["']$/, '');
                    const targetIdx = dirs.findIndex(d => d.name.toLowerCase().includes(targetName.toLowerCase()));
                    if (targetIdx >= 0 && targetIdx !== i) {
                        links.push({ source: `skill-${i}`, target: `skill-${targetIdx}` });
                    }
                }
            } catch (e) {
                // Skip invalid skill files
            }
        }

        // Compute stats for frontend
        const uniqueCategories = [...new Set(nodes.map(n => n.category))];
        const stats = {
            totalSkills: nodes.length,
            categories: uniqueCategories
        };

        res.json({ nodes, links, stats });
    } catch (err) {
        res.json({ nodes: [], links: [], stats: { totalSkills: 0, categories: [] }, error: err.message });
    }
});

// GET /api/docs - Dynamically scan docs/ directory
app.get('/api/docs', (req, res) => {
    const docsDir = path.join(__dirname, '../docs');

    try {
        if (!fs.existsSync(docsDir)) {
            return res.json({ nodes: [], links: [] });
        }

        const nodes = [];
        const links = [];
        const categoryColors = {
            'architecture': '#3b82f6',
            'process': '#10b981',
            'reference': '#f59e0b',
            'guide': '#8b5cf6',
            'plan': '#ec4899',
            'default': '#6b7280'
        };

        function scanDir(dir, parentId = null, depth = 0) {
            if (depth > 3) return; // Max depth

            const items = fs.readdirSync(dir, { withFileTypes: true });

            for (const item of items) {
                if (item.name.startsWith('.')) continue;

                const fullPath = path.join(dir, item.name);
                const relativePath = path.relative(docsDir, fullPath);
                const nodeId = `doc-${relativePath.replace(/[/\\]/g, '-')}`;

                if (item.isDirectory()) {
                    // Detect category
                    let category = 'default';
                    const nameLower = item.name.toLowerCase();
                    if (nameLower.includes('arch')) category = 'architecture';
                    else if (nameLower.includes('process') || nameLower.includes('sop')) category = 'process';
                    else if (nameLower.includes('ref')) category = 'reference';
                    else if (nameLower.includes('guide')) category = 'guide';
                    else if (nameLower.includes('plan')) category = 'plan';

                    nodes.push({
                        id: nodeId,
                        name: item.name,
                        title: item.name,
                        type: 'folder',
                        category,
                        color: categoryColors[category] || categoryColors.default
                    });

                    if (parentId) {
                        links.push({ source: parentId, target: nodeId });
                    }

                    scanDir(fullPath, nodeId, depth + 1);
                } else if (item.name.endsWith('.md')) {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        const lines = content.split('\n');
                        const titleLine = lines.find(l => l.startsWith('# '));
                        const title = titleLine ? titleLine.replace('# ', '').trim() : item.name;

                        nodes.push({
                            id: nodeId,
                            name: item.name,
                            title,
                            type: 'file',
                            path: relativePath,
                            category: 'default',
                            color: '#6b7280'
                        });

                        if (parentId) {
                            links.push({ source: parentId, target: nodeId });
                        }
                    } catch (e) {
                        // Skip unreadable files
                    }
                }
            }
        }

        scanDir(docsDir);
        res.json({ nodes, links });
    } catch (err) {
        res.json({ nodes: [], links: [], error: err.message });
    }
});

// GET /api/locks - List active task locks
app.get('/api/locks', (req, res) => {
    const locksDir = path.join(__dirname, '../.claude/locks');

    try {
        if (!fs.existsSync(locksDir)) {
            return res.json({ locks: [] });
        }

        const files = fs.readdirSync(locksDir).filter(f => f.endsWith('.lock'));
        const locks = [];

        for (const file of files) {
            try {
                const content = fs.readFileSync(path.join(locksDir, file), 'utf8');
                const lock = JSON.parse(content);
                const taskId = file.replace('.lock', '');

                locks.push({
                    task_id: taskId,
                    session_id: lock.session_id || 'unknown',
                    session_short: (lock.session_id || '').slice(0, 8),
                    locked_at: lock.locked_at || new Date(lock.timestamp * 1000).toLocaleString(),
                    files: lock.files || []
                });
            } catch (e) {
                // Skip invalid lock files
            }
        }

        res.json({ locks });
    } catch (err) {
        res.json({ locks: [], error: err.message });
    }
});

// SSE Endpoint for live updates
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial ping
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Keep connection open (simple placeholder)
    // In a real app, we'd add this client to a list and send updates
    // when file watcher detects changes. For now, this stops the client errors.
    const keepAlive = setInterval(() => {
        res.write(`: keep-alive\n\n`);
    }, 15000);

    req.on('close', () => {
        clearInterval(keepAlive);
    });
});

app.listen(PORT, () => {
    console.log(`Dev Manager running at http://localhost:${PORT}`);
    console.log(`Serving static files from: ${__dirname}`);
});
