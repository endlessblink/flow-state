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

// SSE Clients
let clients = [];

// Helper to broadcast logs to SSE clients
const broadcastLog = (message) => {
    // Send log event
    const payload = JSON.stringify({ type: 'log', message });
    clients.forEach(client => {
        client.write(`data: ${payload}\n\n`);
    });
};

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

// Helper to scan for existing IDs and find the next available one
const getNextId = (content, prefix = 'TASK') => {
    const regex = new RegExp(`${prefix}-(\\d+)`, 'g');
    let maxId = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxId) {
            maxId = num;
        }
    }

    return `${prefix}-${maxId + 1}`;
};

// API Endpoint to get the next available ID
app.get('/api/next-id', (req, res) => {
    const prefix = req.query.prefix || 'TASK';
    const masterPlanPath = getMasterPlanPath();

    console.log(`[API] Calculating next ID for prefix: ${prefix}`);

    fs.readFile(masterPlanPath, 'utf8', (err, data) => {
        if (err) {
            console.error(`[API] Error reading MASTER_PLAN.md: ${err.message}`);
            return res.status(500).json({ error: 'Failed to read MASTER_PLAN.md' });
        }

        try {
            const nextId = getNextId(data, prefix);
            res.json({ prefix, nextId });
        } catch (error) {
            console.error(`[API] Error calculating next ID: ${error.message}`);
            res.status(500).json({ error: 'Failed to calculate next ID' });
        }
    });
});

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

// API Endpoint to update task complexity
app.post('/api/task/:id/complexity', (req, res) => {
    const { id } = req.params;
    const { complexity } = req.body;
    const masterPlanPath = getMasterPlanPath();
    console.log(`[API] Updating task ${id} complexity to ${complexity}`);

    fs.readFile(masterPlanPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to read file' });

        const lines = data.split('\n');
        let updated = false;
        let inTargetTask = false;
        let foundComplexityLine = false;
        let headerLineIdx = -1;

        // Regex to match the target task header
        const taskHeaderRegex = new RegExp(`^###\\s+(?:~~)?${id}(?:~~)?:`);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Find task header
            if (line.match(taskHeaderRegex)) {
                headerLineIdx = i;
                updated = true;
                inTargetTask = true;
                continue;
            }

            // Detect next task start (stop processing scope)
            if (inTargetTask && line.startsWith('### ')) {
                inTargetTask = false;
            }

            // Update Complexity line if exists
            if (inTargetTask && line.trim().startsWith('**Complexity**:')) {
                lines[i] = `**Complexity**: ${complexity}`;
                foundComplexityLine = true;
            }
        }

        // If we found header but not complexity line, insert it after Priority or after header
        if (updated && !foundComplexityLine && headerLineIdx >= 0) {
            let insertIdx = headerLineIdx + 1;
            // Skip empty lines, Priority line, and Status line to find proper insertion point
            while (insertIdx < lines.length &&
                   (lines[insertIdx].trim() === '' ||
                    lines[insertIdx].trim().startsWith('**Priority**:') ||
                    lines[insertIdx].trim().startsWith('**Status**:'))) {
                insertIdx++;
            }
            // Insert before the next content line, but after Priority if it exists
            // Actually, let's insert right after Priority line if found, otherwise after header
            let priorityIdx = -1;
            for (let j = headerLineIdx + 1; j < lines.length && j < headerLineIdx + 10; j++) {
                if (lines[j].trim().startsWith('**Priority**:')) {
                    priorityIdx = j;
                    break;
                }
                if (lines[j].startsWith('### ')) break;
            }
            insertIdx = priorityIdx >= 0 ? priorityIdx + 1 : headerLineIdx + 1;
            lines.splice(insertIdx, 0, `**Complexity**: ${complexity}`);
        }

        if (updated) {
            fs.writeFile(masterPlanPath, lines.join('\n'), 'utf8', (err) => {
                if (err) return res.status(500).json({ error: 'Failed to write file' });
                res.json({ success: true, message: 'Complexity updated' });
            });
        } else {
            res.status(404).json({ error: 'Task not found' });
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
        const result = await healthScanner.runFullScan((msg) => broadcastLog(msg));
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

    healthScanner.runFullScan((msg) => broadcastLog(msg))
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

// ============== BEADS API ==============
const { execSync, spawn } = require('child_process');
const BD_PATH = process.env.BD_PATH || `${process.env.HOME}/go/bin/bd`;

// Track running agents
const runningAgents = new Map(); // id -> { process, task, startTime, outputBuffer, clients }

// SSE clients for agent output
const agentOutputClients = new Map(); // agentId -> [res, res, ...]

// Helper to run bd commands
const runBd = (args) => {
    try {
        const result = execSync(`${BD_PATH} ${args} --json`, {
            cwd: path.join(__dirname, '..'),
            encoding: 'utf8',
            timeout: 10000
        });
        return JSON.parse(result);
    } catch (err) {
        console.error(`[Beads] Error running bd ${args}:`, err.message);
        return null;
    }
};

// GET /api/beads/list - All issues
app.get('/api/beads/list', (req, res) => {
    const issues = runBd('list --limit 0');
    res.json({ issues: issues || [], error: issues ? null : 'Failed to fetch issues' });
});

// GET /api/beads/ready - Ready issues (unblocked)
app.get('/api/beads/ready', (req, res) => {
    const issues = runBd('ready');
    res.json({ issues: issues || [], error: issues ? null : 'Failed to fetch ready issues' });
});

// GET /api/beads/deps/:id - Dependencies for an issue
app.get('/api/beads/deps/:id', (req, res) => {
    const deps = runBd(`dep list ${req.params.id}`);
    res.json({ dependencies: deps || [], error: deps ? null : 'Failed to fetch dependencies' });
});

// GET /api/beads/graph - Full dependency graph for D3
app.get('/api/beads/graph', (req, res) => {
    const issues = runBd('list --limit 0');
    if (!issues) return res.json({ nodes: [], links: [] });

    const nodes = issues.map(issue => ({
        id: issue.id,
        title: issue.title,
        status: issue.status,
        priority: issue.priority,
        type: issue.issue_type,
        owner: issue.owner,
        dependencyCount: issue.dependency_count || 0,
        dependentCount: issue.dependent_count || 0
    }));

    // Build links from dependencies
    const links = [];
    for (const issue of issues) {
        if (issue.dependency_count > 0) {
            const deps = runBd(`dep list ${issue.id}`);
            if (deps) {
                for (const dep of deps) {
                    links.push({ source: dep.id, target: issue.id, type: dep.dependency_type });
                }
            }
        }
    }

    res.json({ nodes, links });
});

// Helper: Load supervisor template
const SUPERVISORS_DIR = path.join(__dirname, 'supervisors');

function loadSupervisorTemplate(supervisorType) {
    const templatePath = path.join(SUPERVISORS_DIR, `${supervisorType}-supervisor.md`);
    try {
        if (fs.existsSync(templatePath)) {
            return fs.readFileSync(templatePath, 'utf8');
        }
    } catch (err) {
        console.error(`[Agent] Error loading supervisor template: ${err.message}`);
    }
    return null;
}

// Helper: Create git worktree for agent isolation
function createAgentWorktree(taskId) {
    const projectRoot = path.join(__dirname, '..');
    const worktreePath = path.join(projectRoot, '.agent-worktrees', taskId);
    const branchName = `bd-${taskId}`;

    try {
        // Create worktrees directory if needed
        const worktreesDir = path.join(projectRoot, '.agent-worktrees');
        if (!fs.existsSync(worktreesDir)) {
            fs.mkdirSync(worktreesDir, { recursive: true });
        }

        // Check if worktree already exists
        if (fs.existsSync(worktreePath)) {
            console.log(`[Agent] Worktree already exists at ${worktreePath}`);
            return { worktreePath, branchName, created: false };
        }

        // Create branch if not exists
        try {
            execSync(`git branch ${branchName}`, { cwd: projectRoot, encoding: 'utf8', stdio: 'pipe' });
            console.log(`[Agent] Created branch ${branchName}`);
        } catch (e) {
            // Branch may already exist
            console.log(`[Agent] Branch ${branchName} already exists or error: ${e.message}`);
        }

        // Create worktree
        execSync(`git worktree add "${worktreePath}" ${branchName}`, {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: 'pipe'
        });

        console.log(`[Agent] Created worktree at ${worktreePath}`);
        return { worktreePath, branchName, created: true };
    } catch (err) {
        console.error(`[Agent] Error creating worktree: ${err.message}`);
        // Fallback to main project directory
        return { worktreePath: projectRoot, branchName: null, created: false };
    }
}

// Helper: Clean up worktree after agent completes
function cleanupWorktree(taskId) {
    const projectRoot = path.join(__dirname, '..');
    const worktreePath = path.join(projectRoot, '.agent-worktrees', taskId);

    try {
        if (fs.existsSync(worktreePath)) {
            execSync(`git worktree remove "${worktreePath}" --force`, {
                cwd: projectRoot,
                encoding: 'utf8',
                stdio: 'pipe'
            });
            console.log(`[Agent] Removed worktree at ${worktreePath}`);
        }
    } catch (err) {
        console.error(`[Agent] Error removing worktree: ${err.message}`);
    }
}

// GET /api/beads/supervisors - List available supervisors
app.get('/api/beads/supervisors', (req, res) => {
    try {
        const supervisors = [];
        if (fs.existsSync(SUPERVISORS_DIR)) {
            const files = fs.readdirSync(SUPERVISORS_DIR);
            for (const file of files) {
                if (file.endsWith('-supervisor.md')) {
                    const name = file.replace('-supervisor.md', '');
                    supervisors.push({ name, file });
                }
            }
        }
        res.json({ supervisors });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/beads/claim/:id - Claim a task AND spawn an agent with supervisor
app.post('/api/beads/claim/:id', (req, res) => {
    const taskId = req.params.id;
    const { supervisorType = 'worker', autoStart = true } = req.body;

    try {
        // First update status in beads
        execSync(`${BD_PATH} update ${taskId} --status in_progress`, {
            cwd: path.join(__dirname, '..'),
            encoding: 'utf8'
        });

        // Get task details
        const taskDetails = runBd(`show ${taskId}`);
        if (!taskDetails) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // If autoStart, spawn a Claude agent
        if (autoStart) {
            // Check if already running
            if (runningAgents.has(taskId)) {
                return res.json({
                    success: true,
                    claimed_by: 'agent',
                    agent_status: 'already_running',
                    message: 'Agent already working on this task'
                });
            }

            // Create isolated worktree for agent
            const { worktreePath, branchName, created: worktreeCreated } = createAgentWorktree(taskId);

            // Load supervisor template
            const supervisorTemplate = loadSupervisorTemplate(supervisorType);

            // Build the prompt for Claude
            let prompt;
            if (supervisorTemplate) {
                // Use supervisor template with placeholders replaced
                prompt = supervisorTemplate
                    .replace(/\{\{BEAD_ID\}\}/g, taskId)
                    .replace(/---[\s\S]*?---/, '') // Remove YAML frontmatter
                    + `\n\n## Current Task\n\nBEAD_ID: ${taskId}
Title: ${taskDetails.title || 'No title'}
Description: ${taskDetails.description || 'No description'}
Priority: ${taskDetails.priority || 'P3'}
Type: ${taskDetails.issue_type || 'task'}

${branchName ? `You are working on branch: ${branchName}` : ''}

Start working now. Follow the beads workflow.`;
            } else {
                // Fallback to basic prompt
                prompt = `You are working on Beads task: ${taskId}

Title: ${taskDetails.title || 'No title'}
Description: ${taskDetails.description || 'No description'}
Priority: ${taskDetails.priority || 'P3'}
Type: ${taskDetails.issue_type || 'task'}

${branchName ? `Working on branch: ${branchName}` : ''}

Instructions:
1. Read the task requirements carefully
2. Implement the requested changes
3. Test your changes
4. When complete: bd update ${taskId} --status inreview

Start working now. Be thorough and complete the task.`;
            }

            console.log(`[Agent] Spawning ${supervisorType}-supervisor for task ${taskId}...`);
            console.log(`[Agent] Working directory: ${worktreePath}`);

            // Spawn claude process with FIXED configuration
            // Critical: inherit stdin and set ANTHROPIC_API_KEY to empty string
            // Note: --verbose is required when using --print with --output-format stream-json
            const agentProcess = spawn('claude', [
                '--print',
                '--verbose',
                '--output-format', 'stream-json',
                '--dangerously-skip-permissions',
                '--max-turns', '50',
                '-p', prompt
            ], {
                cwd: worktreePath,
                stdio: ['inherit', 'pipe', 'pipe'],  // FIX: inherit stdin
                env: { ...process.env, ANTHROPIC_API_KEY: '' }  // FIX: empty API key
            });

            const agentData = {
                process: agentProcess,
                task: taskDetails,
                taskId: taskId,
                supervisorType: supervisorType,
                worktreePath: worktreePath,
                branchName: branchName,
                startTime: Date.now(),
                outputBuffer: [],
                status: 'running'
            };

            runningAgents.set(taskId, agentData);

            // Handle stdout
            agentProcess.stdout.on('data', (data) => {
                const output = data.toString();
                agentData.outputBuffer.push({ type: 'stdout', text: output, time: Date.now() });

                // Broadcast to SSE clients watching this agent
                broadcastAgentOutput(taskId, { type: 'stdout', text: output });

                // Also broadcast to main SSE for activity indicator
                broadcastLog(`[Agent ${taskId}] ${output.slice(0, 100)}...`);
            });

            // Handle stderr
            agentProcess.stderr.on('data', (data) => {
                const output = data.toString();
                agentData.outputBuffer.push({ type: 'stderr', text: output, time: Date.now() });
                broadcastAgentOutput(taskId, { type: 'stderr', text: output });
            });

            // Handle exit
            agentProcess.on('close', (code) => {
                console.log(`[Agent] Task ${taskId} agent exited with code ${code}`);
                agentData.status = code === 0 ? 'completed' : 'failed';
                agentData.exitCode = code;
                agentData.endTime = Date.now();

                broadcastAgentOutput(taskId, {
                    type: 'exit',
                    code: code,
                    message: code === 0 ? 'Task completed successfully' : 'Task failed'
                });

                // Clean up after a delay (keep for logs viewing)
                setTimeout(() => {
                    if (runningAgents.get(taskId)?.status !== 'running') {
                        runningAgents.delete(taskId);
                    }
                }, 300000); // 5 minutes
            });

            // Handle error
            agentProcess.on('error', (err) => {
                console.error(`[Agent] Error spawning agent for ${taskId}:`, err.message);
                agentData.status = 'error';
                agentData.error = err.message;
                broadcastAgentOutput(taskId, { type: 'error', message: err.message });
            });

            res.json({
                success: true,
                claimed_by: 'agent',
                agent_status: 'started',
                message: `Agent spawned and working on task ${taskId}`
            });
        } else {
            res.json({ success: true, claimed_by: agent || 'manual' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper to broadcast output to agent watchers
function broadcastAgentOutput(taskId, data) {
    const clients = agentOutputClients.get(taskId) || [];
    const payload = JSON.stringify({ taskId, ...data, timestamp: Date.now() });

    clients.forEach(client => {
        try {
            client.write(`data: ${payload}\n\n`);
        } catch (e) {
            // Client disconnected
        }
    });
}

// GET /api/beads/agents - List all running agents
app.get('/api/beads/agents', (req, res) => {
    const agents = [];

    for (const [taskId, data] of runningAgents.entries()) {
        agents.push({
            taskId,
            title: data.task?.title || 'Unknown',
            supervisorType: data.supervisorType || 'worker',
            branchName: data.branchName,
            status: data.status,
            startTime: data.startTime,
            runningFor: Date.now() - data.startTime,
            outputLines: data.outputBuffer.length,
            exitCode: data.exitCode
        });
    }

    res.json({ agents });
});

// POST /api/beads/merge/:id - Merge agent's branch to main
app.post('/api/beads/merge/:id', (req, res) => {
    const taskId = req.params.id;
    const projectRoot = path.join(__dirname, '..');
    const branchName = `bd-${taskId}`;

    try {
        // Check we're on main
        const currentBranch = execSync('git branch --show-current', {
            cwd: projectRoot,
            encoding: 'utf8'
        }).trim();

        if (currentBranch !== 'main' && currentBranch !== 'master') {
            // Switch to main
            execSync('git checkout main || git checkout master', {
                cwd: projectRoot,
                encoding: 'utf8',
                shell: true
            });
        }

        // Merge the branch
        execSync(`git merge ${branchName} --no-ff -m "Merge ${branchName}: Task completed"`, {
            cwd: projectRoot,
            encoding: 'utf8'
        });

        // Clean up worktree
        cleanupWorktree(taskId);

        // Delete the branch
        try {
            execSync(`git branch -d ${branchName}`, {
                cwd: projectRoot,
                encoding: 'utf8'
            });
        } catch (e) {
            console.log(`[Agent] Could not delete branch ${branchName}: ${e.message}`);
        }

        // Close the bead
        execSync(`${BD_PATH} close ${taskId} --reason "Merged to main"`, {
            cwd: projectRoot,
            encoding: 'utf8'
        });

        res.json({ success: true, message: `Merged ${branchName} to main and closed bead` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/beads/agents/:id/stream - SSE stream for agent output
app.get('/api/beads/agents/:id/stream', (req, res) => {
    const taskId = req.params.id;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send existing output buffer first
    const agentData = runningAgents.get(taskId);
    if (agentData) {
        for (const entry of agentData.outputBuffer) {
            res.write(`data: ${JSON.stringify({ taskId, ...entry })}\n\n`);
        }

        // If agent already finished, send exit event
        if (agentData.status !== 'running') {
            res.write(`data: ${JSON.stringify({
                taskId,
                type: 'exit',
                code: agentData.exitCode,
                status: agentData.status
            })}\n\n`);
        }
    }

    // Add to clients list for live updates
    if (!agentOutputClients.has(taskId)) {
        agentOutputClients.set(taskId, []);
    }
    agentOutputClients.get(taskId).push(res);

    console.log(`[Agent] SSE client connected for task ${taskId}`);

    // Keep alive
    const keepAlive = setInterval(() => {
        res.write(`: keep-alive\n\n`);
    }, 15000);

    req.on('close', () => {
        clearInterval(keepAlive);
        const clients = agentOutputClients.get(taskId) || [];
        agentOutputClients.set(taskId, clients.filter(c => c !== res));
        console.log(`[Agent] SSE client disconnected for task ${taskId}`);
    });
});

// POST /api/beads/agents/:id/stop - Stop a running agent
app.post('/api/beads/agents/:id/stop', (req, res) => {
    const taskId = req.params.id;
    const agentData = runningAgents.get(taskId);

    if (!agentData) {
        return res.status(404).json({ error: 'No agent running for this task' });
    }

    if (agentData.status !== 'running') {
        return res.json({ success: true, message: 'Agent already stopped' });
    }

    try {
        agentData.process.kill('SIGTERM');
        agentData.status = 'stopped';

        // Also update beads status back to ready
        execSync(`${BD_PATH} update ${taskId} --status todo`, {
            cwd: path.join(__dirname, '..'),
            encoding: 'utf8'
        });

        res.json({ success: true, message: 'Agent stopped' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/beads/agents/:id/command - Send a command to an agent (spawns follow-up)
app.post('/api/beads/agents/:id/command', (req, res) => {
    const taskId = req.params.id;
    const { command } = req.body;
    const agentData = runningAgents.get(taskId);

    if (!command) {
        return res.status(400).json({ error: 'Command is required' });
    }

    // Build context from previous output
    const recentOutput = agentData?.outputBuffer?.slice(-20).map(o => o.text).join('') || '';

    // Broadcast the user command to the UI
    broadcastAgentOutput(taskId, {
        type: 'user',
        text: `> ${command}`
    });

    console.log(`[Agent] Sending command to ${taskId}: ${command.slice(0, 50)}...`);

    // Spawn a new claude process with the command as context
    const prompt = `You are continuing work on Beads task: ${taskId}

${agentData?.task?.title ? `Task: ${agentData.task.title}` : ''}

The user has sent you this instruction:
${command}

Recent context from previous work:
${recentOutput.slice(-2000)}

Execute the user's instruction now.`;

    const followUpProcess = spawn('claude', [
        '--print',
        '-p', prompt
    ], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
    });

    // If there was a previous process, update reference
    if (agentData) {
        // Keep the old process running if it exists
        agentData.commandCount = (agentData.commandCount || 0) + 1;
    }

    // Track this follow-up process
    const followUpData = agentData || {
        task: { title: 'Follow-up command' },
        taskId: taskId,
        startTime: Date.now(),
        outputBuffer: [],
        status: 'running'
    };

    followUpData.process = followUpProcess;
    followUpData.status = 'running';
    runningAgents.set(taskId, followUpData);

    followUpProcess.stdout.on('data', (data) => {
        const output = data.toString();
        followUpData.outputBuffer.push({ type: 'stdout', text: output, time: Date.now() });
        broadcastAgentOutput(taskId, { type: 'stdout', text: output });
    });

    followUpProcess.stderr.on('data', (data) => {
        const output = data.toString();
        followUpData.outputBuffer.push({ type: 'stderr', text: output, time: Date.now() });
        broadcastAgentOutput(taskId, { type: 'stderr', text: output });
    });

    followUpProcess.on('close', (code) => {
        console.log(`[Agent] Follow-up for ${taskId} exited with code ${code}`);
        followUpData.status = code === 0 ? 'idle' : 'failed';
        followUpData.exitCode = code;
        broadcastAgentOutput(taskId, {
            type: 'status',
            status: 'idle',
            message: 'Ready for next command'
        });
    });

    followUpProcess.on('error', (err) => {
        console.error(`[Agent] Follow-up error for ${taskId}:`, err.message);
        broadcastAgentOutput(taskId, { type: 'error', message: err.message });
    });

    res.json({ success: true, message: 'Command sent' });
});

// POST /api/beads/close/:id - Close a task
app.post('/api/beads/close/:id', (req, res) => {
    const { reason } = req.body;
    try {
        execSync(`${BD_PATH} close ${req.params.id} --reason "${reason || 'Completed'}"`, {
            cwd: path.join(__dirname, '..'),
            encoding: 'utf8'
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
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

    // Add client to list
    clients.push(res);
    console.log(`[API] SSE Client connected. (Total: ${clients.length})`);

    // Keep connection open with heartbeat
    const keepAlive = setInterval(() => {
        res.write(`: keep-alive\n\n`);
    }, 15000);

    req.on('close', () => {
        console.log(`[API] SSE Client disconnected.`);
        clearInterval(keepAlive);
        clients = clients.filter(c => c !== res);
    });
});

app.listen(PORT, () => {
    console.log(`Dev Manager running at http://localhost:${PORT}`);
    console.log(`Serving static files from: ${__dirname}`);
});
