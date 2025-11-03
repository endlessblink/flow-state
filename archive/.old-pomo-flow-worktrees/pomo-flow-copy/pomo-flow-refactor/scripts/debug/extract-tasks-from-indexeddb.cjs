const fs = require('fs');
const path = require('path');

// Read the analysis file
const analysisFile = path.join(__dirname, 'storage-analysis', 'storage-analysis-2025-10-14.json');
const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));

console.log('🔍 Extracting tasks from IndexedDB analysis...\n');

// Find the pomo_flow_data store
const pomoFlowStore = analysis.indexedDB[0].stores.find(store => store.name === 'pomo_flow_data');

if (pomoFlowStore && pomoFlowStore.data.length > 0) {
    // The data is stored as a JSON string in the first element
    const tasksJsonString = pomoFlowStore.data[0];

    try {
        const tasks = JSON.parse(tasksJsonString);

        console.log(`✅ Found ${tasks.length} tasks in IndexedDB!\n`);

        // Separate real tasks from test/development tasks
        const realTasks = tasks.filter(task => {
            // Test tasks usually have specific patterns
            const isTestTask = task.id.includes('TEST') ||
                              task.id.includes('MODAL') ||
                              task.title.toLowerCase().includes('test') ||
                              task.title.toLowerCase().includes('implement') ||
                              task.title.toLowerCase().includes('add') ||
                              task.title.toLowerCase().includes('fix');

            return !isTestTask;
        });

        const testTasks = tasks.filter(task => {
            const isTestTask = task.id.includes('TEST') ||
                              task.id.includes('MODAL') ||
                              task.title.toLowerCase().includes('test') ||
                              task.title.toLowerCase().includes('implement') ||
                              task.title.toLowerCase().includes('add') ||
                              task.title.toLowerCase().includes('fix');

            return isTestTask;
        });

        console.log(`📊 Analysis:`);
        console.log(`   Total tasks: ${tasks.length}`);
        console.log(`   Real tasks: ${realTasks.length}`);
        console.log(`   Test/development tasks: ${testTasks.length}\n`);

        // Show test tasks
        if (testTasks.length > 0) {
            console.log('🧪 Test/Development Tasks found:');
            testTasks.forEach((task, index) => {
                console.log(`${index + 1}. "${task.title}" (${task.id})`);
            });
            console.log('');
        }

        // Show real tasks if any
        if (realTasks.length > 0) {
            console.log('🎯 Real User Tasks found:');
            realTasks.forEach((task, index) => {
                console.log(`${index + 1}. "${task.title}" (${task.id})`);
                console.log(`   Status: ${task.status}, Priority: ${task.priority || 'none'}`);
                console.log(`   Created: ${new Date(task.createdAt).toLocaleString()}`);
                if (task.description && task.description.length > 0) {
                    console.log(`   Description: ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}`);
                }
                console.log('');
            });

            // Save real tasks to a separate file
            const realTasksFile = path.join(__dirname, 'storage-analysis', 'real-user-tasks.json');
            fs.writeFileSync(realTasksFile, JSON.stringify(realTasks, null, 2));
            console.log(`💾 Real tasks saved to: ${realTasksFile}`);
        } else {
            console.log('❌ No real user tasks found - all tasks appear to be test/development tasks');
        }

        // Save all tasks for reference
        const allTasksFile = path.join(__dirname, 'storage-analysis', 'all-indexeddb-tasks.json');
        fs.writeFileSync(allTasksFile, JSON.stringify(tasks, null, 2));
        console.log(`💾 All tasks saved to: ${allTasksFile}`);

    } catch (error) {
        console.error('❌ Error parsing tasks JSON:', error.message);
    }
} else {
    console.log('❌ No task data found in IndexedDB analysis');
}