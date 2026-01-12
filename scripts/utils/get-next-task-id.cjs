#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const MASTER_PLAN_PATH = path.join(__dirname, '../../docs/MASTER_PLAN.md');

try {
    const content = fs.readFileSync(MASTER_PLAN_PATH, 'utf8');
    const regex = /(?:TASK|BUG|IDEA|ISSUE)-(\d+)/g;
    let match;
    let maxId = 0;
    const ids = new Set();

    while ((match = regex.exec(content)) !== null) {
        const id = parseInt(match[1], 10);
        if (!isNaN(id)) {
            if (id > maxId) maxId = id;
            ids.add(id);
        }
    }

    const nextId = maxId + 1;

    console.log(`\n📊 Task ID Analysis:`);
    console.log(`---------------------`);
    console.log(`Highest ID Found: TASK-${maxId}`);
    console.log(`Total IDs Found:  ${ids.size}`);
    console.log(`---------------------`);
    console.log(`✅ NEXT AVAILABLE ID: TASK-${nextId}\n`);

    // Optional: Check for gaps or duplicates if run with --audit
    if (process.argv.includes('--audit')) {
        console.log(`Audit Report:`);
        // Check duplicates in definition lines (simplified check)
        const lines = content.split('\n');
        const definitionRegex = /###\s*(?:~~)?TASK-(\d+)/;
        const definedIds = {};

        lines.forEach((line, index) => {
            const match = line.match(definitionRegex);
            if (match) {
                const id = match[1];
                if (definedIds[id]) {
                    console.log(`⚠️  DUPLICATE DEFINITION: TASK-${id} defined on lines ${definedIds[id]} and ${index + 1}`);
                } else {
                    definedIds[id] = index + 1;
                }
            }
        });
    }

} catch (err) {
    console.error('Error reading MASTER_PLAN.md:', err);
    process.exit(1);
}
