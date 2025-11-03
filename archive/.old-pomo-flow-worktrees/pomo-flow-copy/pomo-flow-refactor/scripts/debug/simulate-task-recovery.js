// Simulate the task recovery process for testing
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Simulating Task Recovery Process...\n');

// Check what's in localStorage-like storage (we'll simulate this)
const localStorageSimulation = {
    'pomo-flow-tasks': [
        {
            id: 'task-1',
            title: 'Fix calendar drag-drop functionality',
            description: 'Resolve the issue where tasks cannot be dragged to calendar slots',
            status: 'todo',
            priority: 'high',
            projectId: 'development',
            createdAt: new Date().toISOString(),
            tags: ['development', 'bug', 'calendar']
        },
        {
            id: 'task-2',
            title: 'Implement task completion animation',
            description: 'Add smooth animation when tasks are marked complete',
            status: 'todo',
            priority: 'medium',
            projectId: 'development',
            createdAt: new Date().toISOString(),
            tags: ['development', 'ui', 'animation']
        }
    ]
};

// Simulate checking for personal tasks
function findPersonalTasks(tasks) {
    const personalKeywords = [
        'buy', 'call', 'pay', 'exercise', 'walk', 'read', 'cook', 'clean',
        'groceries', 'dentist', 'doctor', 'appointment', 'bills', 'shopping',
        'personal', 'errands', 'health', 'fitness', 'home', 'family'
    ];

    return tasks.filter(task => {
        const title = (task.title || '').toLowerCase();
        const description = (task.description || '').toLowerCase();
        const project = (task.projectId || '').toLowerCase();

        return personalKeywords.some(keyword =>
            title.includes(keyword) || description.includes(keyword) || project.includes('personal')
        );
    });
}

// Check for existing tasks
console.log('📊 Checking localStorage for tasks...');
const existingTasks = localStorageSimulation['pomo-flow-tasks'] || [];
console.log(`Found ${existingTasks.length} total tasks`);

// Check for personal tasks
const personalTasks = findPersonalTasks(existingTasks);
console.log(`Found ${personalTasks.length} personal tasks`);

// Display existing tasks
existingTasks.forEach((task, index) => {
    const isPersonal = findPersonalTasks([task]).length > 0;
    const personalBadge = isPersonal ? ' [PERSONAL]' : '';
    console.log(`\n${index + 1}. ${task.title}${personalBadge}`);
    console.log(`   Status: ${task.status} | Priority: ${task.priority} | Project: ${task.projectId}`);
    console.log(`   Description: ${task.description}`);
});

// Sample personal tasks to add if none found
const samplePersonalTasks = [
    {
        id: 'personal-' + Date.now() + '-1',
        title: 'Buy groceries for the week',
        description: 'Milk, eggs, bread, vegetables, and fruits',
        status: 'todo',
        priority: 'high',
        projectId: 'personal',
        createdAt: new Date().toISOString(),
        tags: ['shopping', 'personal', 'errands'],
        estimatedDuration: 60
    },
    {
        id: 'personal-' + Date.now() + '-2',
        title: 'Call dentist for appointment',
        description: 'Schedule routine checkup for next month',
        status: 'todo',
        priority: 'medium',
        projectId: 'personal',
        createdAt: new Date().toISOString(),
        tags: ['health', 'appointment'],
        estimatedDuration: 15
    },
    {
        id: 'personal-' + Date.now() + '-3',
        title: 'Pay utility bills',
        description: 'Electricity, water, and internet bills due this week',
        status: 'todo',
        priority: 'urgent',
        projectId: 'personal',
        createdAt: new Date().toISOString(),
        tags: ['finance', 'bills'],
        estimatedDuration: 30
    },
    {
        id: 'personal-' + Date.now() + '-4',
        title: 'Exercise - 30 min walk',
        description: 'Evening walk in the park',
        status: 'todo',
        priority: 'medium',
        projectId: 'personal',
        createdAt: new Date().toISOString(),
        tags: ['health', 'exercise'],
        estimatedDuration: 30
    },
    {
        id: 'personal-' + Date.now() + '-5',
        title: 'Read for 20 minutes',
        description: 'Continue reading current book',
        status: 'todo',
        priority: 'low',
        projectId: 'personal',
        createdAt: new Date().toISOString(),
        tags: ['personal', 'learning', 'relaxation'],
        estimatedDuration: 20
    }
];

// Simulate adding sample tasks if no personal tasks found
if (personalTasks.length === 0) {
    console.log('\n🎯 No personal tasks found. Adding sample personal tasks...');

    samplePersonalTasks.forEach((task, index) => {
        console.log(`\n${index + 1}. ${task.title} [PERSONAL]`);
        console.log(`   Status: ${task.status} | Priority: ${task.priority} | Project: ${task.projectId}`);
        console.log(`   Description: ${task.description}`);
        console.log(`   Estimated Duration: ${task.estimatedDuration} minutes`);
    });

    // Save sample tasks to a file for import
    const importData = {
        tasks: samplePersonalTasks,
        metadata: {
            source: 'task-recovery-simulation',
            timestamp: new Date().toISOString(),
            totalTasks: samplePersonalTasks.length,
            personalTasks: samplePersonalTasks.length
        }
    };

    fs.writeFileSync(
        path.join(__dirname, 'personal-tasks-for-import.json'),
        JSON.stringify(importData, null, 2)
    );

    console.log('\n✅ Sample personal tasks saved to personal-tasks-for-import.json');
    console.log('📥 Ready to import into main application');
} else {
    console.log('\n✅ Personal tasks already exist in storage');
}

// Create a comprehensive recovery report
const recoveryReport = {
    timestamp: new Date().toISOString(),
    scanResults: {
        localStorage: {
            totalTasks: existingTasks.length,
            personalTasks: personalTasks.length,
            developmentTasks: existingTasks.length - personalTasks.length
        },
        sessionStorage: {
            totalTasks: 0,
            personalTasks: 0
        },
        indexedDB: {
            totalTasks: 0,
            personalTasks: 0
        }
    },
    personalTasksFound: personalTasks.length > 0,
    sampleTasksAdded: personalTasks.length === 0,
    recommendations: []
};

if (personalTasks.length === 0) {
    recoveryReport.recommendations.push('No personal tasks found - sample tasks have been added');
    recoveryReport.recommendations.push('Import sample tasks into main application');
    recoveryReport.recommendations.push('Review and customize sample tasks for personal use');
} else {
    recoveryReport.recommendations.push('Personal tasks found - ready for import');
    recoveryReport.recommendations.push('Verify tasks appear correctly in main application');
}

// Save recovery report
fs.writeFileSync(
    path.join(__dirname, 'task-recovery-report.json'),
    JSON.stringify(recoveryReport, null, 2)
);

console.log('\n📋 Recovery Summary:');
console.log(`- Total tasks found: ${recoveryReport.scanResults.localStorage.totalTasks}`);
console.log(`- Personal tasks: ${recoveryReport.scanResults.localStorage.personalTasks}`);
console.log(`- Development tasks: ${recoveryReport.scanResults.localStorage.developmentTasks}`);
console.log(`- Sample tasks added: ${recoveryReport.sampleTasksAdded ? 'Yes' : 'No'}`);

console.log('\n📄 Recovery report saved to task-recovery-report.json');
console.log('\n🚀 Next steps:');
recoveryReport.recommendations.forEach(rec => {
    console.log(`- ${rec}`);
});