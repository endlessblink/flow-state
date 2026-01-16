const fs = require('fs');
const path = require('path');

const MASTER_PLAN_PATH = path.join(__dirname, '../docs/MASTER_PLAN.md');

function checkProgress() {
    if (!fs.existsSync(MASTER_PLAN_PATH)) {
        console.error('MASTER_PLAN.md not found at:', MASTER_PLAN_PATH);
        process.exit(1);
    }

    const content = fs.readFileSync(MASTER_PLAN_PATH, 'utf8');
    const taskRegex = /- \[([ x])\] (.*)/g;

    let total = 0;
    let completed = 0;
    let match;

    // Simple global progress check for now
    while ((match = taskRegex.exec(content)) !== null) {
        total++;
        if (match[1] === 'x') {
            completed++;
        }
    }

    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    console.log(`\n📊 Master Plan Progress Check`);
    console.log(`===========================`);
    console.log(`Total Tasks: ${total}`);
    console.log(`Completed:   ${completed}`);
    console.log(`Progress:    ${percentage}%`);
    console.log(`===========================\n`);
}

checkProgress();
