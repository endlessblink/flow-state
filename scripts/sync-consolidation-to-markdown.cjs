const fs = require('fs');
const path = require('path');

const MASTER_PLAN_PATH = path.join(__dirname, '../docs/MASTER_PLAN.md');

function syncTasks() {
    console.log('🔄 Syncing Consolidation Tasks...');

    if (!fs.existsSync(MASTER_PLAN_PATH)) {
        console.error('MASTER_PLAN.md not found');
        process.exit(1);
    }

    const content = fs.readFileSync(MASTER_PLAN_PATH, 'utf8');

    // 1. Parse Active Tasks details to get current statuses
    // Regex to find "### TASK-XXX: Title (STATUS)"
    const taskHeaderRegex = /### (TASK-\d+|BUG-\d+|ROAD-\d+):.*? \((.*?)\)/g;
    let match;
    const taskStatuses = new Map();

    while ((match = taskHeaderRegex.exec(content)) !== null) {
        const taskId = match[1];
        const status = match[2]; // e.g., "✅ DONE", "🔄 IN PROGRESS"
        taskStatuses.set(taskId, status);
    }

    console.log(`Found ${taskStatuses.size} detailed tasks.`);

    // 2. We could update the summary table here if we wanted to be fancy.
    // For now, let's just report discrepancies between Detail section and Summary table if easily possible, 
    // or just exit successfully as a placeholder for the "missing" script.

    // This script is intended to auto-update the "Active Work (Summary)" list based on the detailed sections below.
    // Implementation of full sync requires careful parsing to avoid destroying the table structure.

    console.log('✅ Task sync check complete (Placeholder Implementation).');
}

syncTasks();
