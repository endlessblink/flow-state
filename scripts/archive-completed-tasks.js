import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remark } from 'remark';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { remove } from 'unist-util-remove';
import writeFileAtomic from 'write-file-atomic';
import { execSync } from 'node:child_process';

// Configuration
const CONFIG = {
    sourceFile: 'docs/MASTER_PLAN.md',
    archiveDir: 'docs/archive',
    backupDir: 'backups/master-plan',
    taskPattern: /~~(TASK|BUG|ROAD)-(\d+)~~.*\(✅\s*DONE\)/,
    dryRun: process.argv.includes('--dry-run'),
    verbose: process.argv.includes('--verbose'),
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ABS_SOURCE_PATH = path.join(ROOT_DIR, CONFIG.sourceFile);
const ABS_ARCHIVE_DIR = path.join(ROOT_DIR, CONFIG.archiveDir);
const ABS_BACKUP_DIR = path.join(ROOT_DIR, CONFIG.backupDir);

// Helpers
const log = {
    info: (...args) => console.log('ℹ️ ', ...args),
    success: (...args) => console.log('✅', ...args),
    warn: (...args) => console.warn('⚠️ ', ...args),
    error: (...args) => console.error('❌', ...args),
    debug: (...args) => CONFIG.verbose && console.log('🔍', ...args),
};

async function main() {
    log.info(`Starting Archival System ${CONFIG.dryRun ? '(DRY RUN)' : ''}`);

    // 1. Pre-flight Checks
    await preFlightChecks();

    // 2. Read Source
    const sourceContent = await fs.readFile(ABS_SOURCE_PATH, 'utf8');

    // 3. Parse AST
    const processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkStringify, {
            bullet: '-',
            fences: true,
            listItemIndent: 'one',
            rule: '-'
        });

    const ast = processor.parse(sourceContent);

    // 4. Identify Completed Tasks
    const tasksToArchive = findCompletedTasks(ast, sourceContent);

    if (tasksToArchive.length === 0) {
        log.info('No completed tasks found to archive.');
        return;
    }

    log.success(`Found ${tasksToArchive.length} completed tasks to archive.`);
    tasksToArchive.forEach(t => log.debug(`- ${t.id}: ${t.title}`));

    // 5. Prepare Archive Content
    const archiveContent = generateArchiveContent(tasksToArchive, processor);
    const archiveFilename = getArchiveFilename();
    const absArchivePath = path.join(ABS_ARCHIVE_DIR, archiveFilename);

    // 6. Execution (or Dry Run)
    if (CONFIG.dryRun) {
        log.info('--- DRY RUN SUMMARY ---');
        log.info(`Would archive ${tasksToArchive.length} tasks to: ${CONFIG.archiveDir}/${archiveFilename}`);
        log.info(`Would create backup in: ${CONFIG.backupDir}`);
        log.info(`Would remove tasks from: ${CONFIG.sourceFile}`);
        return;
    }

    // 7. Create Backup
    await createBackup(sourceContent);

    // 8. Update Archive File
    await appendToArchive(absArchivePath, archiveContent);

    // 9. Update Master Plan
    const newMasterContent = removeTasksFromMaster(ast, tasksToArchive, processor);

    // Write using atomic write
    await writeFileAtomic(ABS_SOURCE_PATH, newMasterContent);
    log.success(`Updated ${CONFIG.sourceFile}`);

    log.success('Archival Complete!');
}

async function preFlightChecks() {
    // Check file existence
    try {
        await fs.access(ABS_SOURCE_PATH);
    } catch {
        throw new Error(`Source file not found: ${ABS_SOURCE_PATH}`);
    }

    // Ensure directories exist
    await fs.mkdir(ABS_ARCHIVE_DIR, { recursive: true });
    await fs.mkdir(ABS_BACKUP_DIR, { recursive: true });

    // Check git status (optional warning)
    try {
        const status = execSync('git status --porcelain', { cwd: ROOT_DIR }).toString();
        if (status.includes(CONFIG.sourceFile)) {
            log.warn(`${CONFIG.sourceFile} has uncommitted changes. Proceeding, but backup is recommended.`);
        }
    } catch (e) {
        log.warn('Could not check git status.');
    }
}

function findCompletedTasks(ast, sourceContent) {
    const tasks = [];
    let currentTask = null;

    // We need to group headers with their content
    // A task starts at an H3 (depth 3) matching the pattern
    // It ends at the next H3 or higher (H1, H2)

    const nodes = ast.children;

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        if (node.type === 'heading' && node.depth === 3) {
            // Check if this is a completed task header
            const text = unified()
                .use(remarkStringify)
                .use(remarkGfm)
                .stringify({ type: 'root', children: node.children })
                .trim();

            const match = text.match(CONFIG.taskPattern);

            if (match) {
                // Found a task start
                const taskId = `${match[1]}-${match[2]}`;
                currentTask = {
                    id: taskId,
                    title: text,
                    nodes: [node],
                    index: i
                };
                tasks.push(currentTask);
            } else {
                // Another H3, closes previous task if any
                currentTask = null;
            }
        } else if (currentTask) {
            // Check if we hit a boundary (H1, H2, or new H3)
            if (node.type === 'heading' && node.depth <= 3) {
                currentTask = null;
            } else {
                // Add node to current task
                currentTask.nodes.push(node);
            }
        }
    }

    return tasks;
}

function getArchiveFilename() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `MASTER_PLAN_${year}-${month}.md`;
}

function generateArchiveContent(tasks, processor) {
    const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    let content = `\n\n## ${today}\n\n`;

    tasks.forEach(task => {
        // Convert AST nodes back to string
        const taskContent = processor.stringify({ type: 'root', children: task.nodes });
        content += taskContent + '\n---\n';
    });

    return content;
}

async function appendToArchive(filePath, content) {
    let finalContent = content;

    try {
        const exists = await fs.readFile(filePath, 'utf8');
        // Append to existing
        finalContent = exists + content;
    } catch (e) {
        if (e.code === 'ENOENT') {
            // Create new file with header
            const header = `# Archived Tasks - ${new Date().toISOString().slice(0, 7)}\n\n> **Source**: Archived from ${CONFIG.sourceFile}\n> **Last Updated**: ${new Date().toLocaleDateString()}\n\n---\n`;
            finalContent = header + content;
        } else {
            throw e;
        }
    }

    await writeFileAtomic(filePath, finalContent);
    log.success(`Written to archive: ${path.basename(filePath)}`);
}

function removeTasksFromMaster(ast, tasksToRemove, processor) {
    // Filter out nodes that belong to archived tasks
    // We need a Set of node objects to remove
    const nodesToRemove = new Set();
    tasksToRemove.forEach(task => {
        task.nodes.forEach(node => nodesToRemove.add(node));
    });

    const newChildren = ast.children.filter(node => !nodesToRemove.has(node));

    const newAst = {
        ...ast,
        children: newChildren
    };

    return processor.stringify(newAst);
}

async function createBackup(content) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `MASTER_PLAN.backup-${timestamp}.md`;
    const backupPath = path.join(ABS_BACKUP_DIR, filename);

    await writeFileAtomic(backupPath, content);
    log.info(`Backup created: ${filename}`);
}

// Run
main().catch(err => {
    log.error('Fatal Error:', err);
    process.exit(1);
});
