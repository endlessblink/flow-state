const fs = require('fs');
const path = require('path');

const masterPlanPath = path.resolve('docs/MASTER_PLAN.md');
console.log(`Reading: ${masterPlanPath}`);
const content = fs.readFileSync(masterPlanPath, 'utf8');

const data = {
    activeWork: [],
    bugs: [],
    issues: [],
    roadmap: { nearTerm: [], later: [] }
};

const lines = content.split('\n');
let currentSection = '';
let currentItem = null;

console.log('--- Starting Parse ---');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Section Detection
    if (trimmed.startsWith('## Current Status')) { currentSection = 'activeWork'; console.log(`[Line ${i}] Entering ActiveWork (Current Status)`); continue; }
    if (trimmed.startsWith('## Active Work')) { currentSection = 'activeWork'; console.log(`[Line ${i}] Entering ActiveWork`); continue; }
    if (trimmed.startsWith('## ')) { currentSection = ''; continue; } // Any other section clears it

    // Task Header Detection
    if (currentSection === 'activeWork' && trimmed.match(/^###\s+(?:~~)?(?:.*?)((?:TASK|BUG|ISSUE)-\d+)(?:~~)?/)) {
        // Did we have a previous item?
        if (currentItem) {
            console.log(`[Item Finished] ${currentItem.id} - Subtasks: ${currentItem.subtasks.length}`);
            data.activeWork.push(currentItem);
        }

        const match = trimmed.match(/^###\s+(?:~~)?(?:.*?)((?:TASK|BUG|ISSUE)-\d+)(?:~~)?(?::| - | )?\s*(.+?)(?:\s*\(([^)]+)\))?$/);
        if (match) {
            const id = match[1];
            const title = match[2];
            console.log(`[Line ${i}] New Item: ${id}`);
            currentItem = {
                id: id,
                title: title,
                subtasks: [],
                completedSubtasks: 0,
                description: ''
            };
        } else {
            currentItem = null;
        }
        continue;
    }

    // Body content for current item
    if (currentSection === 'activeWork' && currentItem) {
        // Checkbox Subtasks
        if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
            currentItem.subtasks.push(trimmed);
            if (trimmed.toLowerCase().includes('[x]')) currentItem.completedSubtasks++;
            console.log(`   [Line ${i}] Added subtask to ${currentItem.id}: ${trimmed}`);
        }
        // Table Rows as Subtasks (simplified check)
        else if (trimmed.startsWith('|') && !trimmed.includes('---')) {
            const isHeader = trimmed.toLowerCase().includes('| step') || trimmed.toLowerCase().includes('| description');
            if (!isHeader) {
                currentItem.subtasks.push(trimmed);
                const upper = trimmed.toUpperCase();
                if (upper.includes('DONE') || upper.includes('✅')) currentItem.completedSubtasks++;
                console.log(`   [Line ${i}] Added TABLE subtask to ${currentItem.id}: ${trimmed}`);
            }
        }
    }
}
// Push last item
if (currentItem) {
    console.log(`[Item Finished] ${currentItem.id} - Subtasks: ${currentItem.subtasks.length}`);
    data.activeWork.push(currentItem);
}

console.log('--- Summary ---');
const bug214 = data.activeWork.find(t => t.id === 'BUG-214');
if (bug214) {
    console.log('BUG-214:', JSON.stringify(bug214, null, 2));
    const total = bug214.subtasks.length;
    const done = bug214.completedSubtasks;
    console.log(`Progress: ${done}/${total} = ${Math.round(done / total * 100)}%`);
} else {
    console.log('BUG-214 Not found in activeWork via header parsing.');
}
