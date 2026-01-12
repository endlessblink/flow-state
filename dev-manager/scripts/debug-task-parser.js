const fs = require('fs');
const path = require('path');

const masterPlanPath = path.join(__dirname, '../../docs/MASTER_PLAN.md');
const content = fs.readFileSync(masterPlanPath, 'utf8');

console.log('--- START PARSE ---');

function parseTaskStatus(statusText) {
    if (!statusText) return 'todo';
    const text = statusText.toUpperCase();
    if (text.includes('DONE') || text.includes('✅') || text.includes('[X]')) return 'done';
    if (text.includes('REVIEW') || text.includes('👀')) return 'review';
    if (text.includes('IN PROGRESS') || text.includes('🔄') || text.includes('🚧')) return 'in-progress';
    return 'todo';
}

const data = {
    activeWork: [],
    ideas: []
};

const lines = content.split('\n');
let currentSection = '';
let currentItem = null;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect main sections
    if (trimmed.startsWith('## Active Work')) {
        currentSection = 'activeWork';
        console.log(`Switched to section: Active Work at line ${i + 1}`);
        continue;
    }
    if (trimmed.startsWith('## Ideas')) {
        currentSection = 'ideas';
        continue;
    }
    if (trimmed.startsWith('## ')) {
        // Any other H2
        if (!trimmed.startsWith('## Active Work')) {
            currentSection = 'other';
        }
    }


    // Parse TASK- headers in Active Work section
    const taskHeaderRegex = /^###\s+(?:~~)?((?:TASK|BUG|ISSUE)-[\w-]+)(?:~~)?:\s*(.+?)(?:\s*\(([^)]+)\))?$/;
    const match = trimmed.match(taskHeaderRegex);

    if (currentSection === 'activeWork' && match) {
        const id = match[1];
        const title = match[2];
        const statusText = match[3] || '';
        const status = parseTaskStatus(statusText);

        currentItem = {
            id,
            title,
            status,
            subtasks: [],
            completedSubtasks: 0
        };
        data.activeWork.push(currentItem);
        console.log(`Found Task: ${id} at line ${i + 1}`);
        continue;
    }

    // Parse ONLY checkbox-style bullet points as subtasks
    if (currentSection === 'activeWork' && currentItem && trimmed.startsWith('- ')) {
        const isCheckbox = trimmed.match(/^- \[[x ]\]/i);

        if (isCheckbox) {
            if (currentItem.id === 'TASK-157') {
                console.log(`[TASK-157] Found subtask at line ${i + 1}: ${trimmed}`);
            }

            currentItem.subtasks.push(trimmed.substring(2));

            // Check if subtask is completed
            const isCheckedCheckbox = trimmed.match(/^- \[x\]/i);
            if (isCheckedCheckbox) {
                if (currentItem.id === 'TASK-157') {
                    console.log(`[TASK-157] -> Marked as COMPLETED`);
                }
                currentItem.completedSubtasks = (currentItem.completedSubtasks || 0) + 1;
            } else {
                if (currentItem.id === 'TASK-157') {
                    console.log(`[TASK-157] -> Marked as INCOMPLETE`);
                }
            }
        } else {
            if (currentItem.id === 'TASK-157') {
                console.log(`[TASK-157] Ignored bullet at line ${i + 1}: ${trimmed}`);
            }
        }
    }
}

// Check TASK-157 specifically
const task157 = data.activeWork.find(t => t.id === 'TASK-157');
if (task157) {
    console.log('\n--- TASK-157 REPORT ---');
    console.log(`Total Subtasks: ${task157.subtasks.length}`);
    console.log(`Completed: ${task157.completedSubtasks}`);
    console.log(`Progress: ${(task157.completedSubtasks / task157.subtasks.length) * 100}%`);
} else {
    console.log('TASK-157 Not Found');
}
