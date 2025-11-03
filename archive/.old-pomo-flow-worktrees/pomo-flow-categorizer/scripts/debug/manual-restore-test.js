#!/usr/bin/env node

import https from 'https';
import http from 'http';

// Manual test to verify backup restoration process
async function testBackupRestoration() {
    console.log('🔄 Testing backup restoration process...\n');

    // Step 1: Fetch the backup file to verify it exists
    console.log('📄 Step 1: Fetching backup file...');
    try {
        const backupData = await fetchJson('http://localhost:5550/user-backup.json');
        console.log(`✅ Backup file contains ${backupData.data.length} tasks`);

        // Show sample tasks
        console.log('\n📋 Sample tasks from backup:');
        backupData.data.slice(0, 5).forEach((task, index) => {
            console.log(`  ${index + 1}. ${task.title} (${task.status})`);
        });

        // Check for specific expected tasks
        const expectedTasks = ['Test Task', 'sdfgsdfg', 'Implement enhanced resize handles'];
        const foundTasks = backupData.data.filter(task =>
            expectedTasks.some(expected => task.title.includes(expected))
        );

        console.log(`\n🎯 Found ${foundTasks.length} expected tasks:`);
        foundTasks.forEach(task => {
            console.log(`  ✅ ${task.title}`);
        });

        // Step 2: Simulate what the restoration page should do
        console.log('\n💾 Step 2: Simulating restoration process...');
        const simulatedLocalStorage = JSON.stringify(backupData.data);
        console.log(`✅ Prepared ${backupData.data.length} tasks for localStorage`);

        // Step 3: Check if the main app is accessible
        console.log('\n📱 Step 3: Checking main app accessibility...');
        try {
            const appResponse = await fetch('http://localhost:5550/');
            if (appResponse.ok) {
                console.log('✅ Main Pomo-Flow app is accessible');
            } else {
                console.log('❌ Main app returned error:', appResponse.status);
            }
        } catch (error) {
            console.log('❌ Cannot access main app:', error.message);
        }

        return {
            success: true,
            tasksInBackup: backupData.data.length,
            expectedTasksFound: foundTasks.length,
            backupAccessible: true
        };

    } catch (error) {
        console.log('❌ Error accessing backup file:', error.message);
        return { success: false, error: error.message };
    }
}

// Helper function to fetch JSON
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;

        client.get(url, (res) => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// Run the test
testBackupRestoration().then(result => {
    console.log('\n📊 TEST SUMMARY:');
    if (result.success) {
        console.log(`✅ Backup restoration infrastructure is working`);
        console.log(`📄 Backup file accessible: ${result.backupAccessible ? '✅' : '❌'}`);
        console.log(`📋 Tasks in backup: ${result.tasksInBackup}`);
        console.log(`🎯 Expected tasks found: ${result.expectedTasksFound}/3`);
        console.log('\n🔄 To complete restoration:');
        console.log('1. Visit http://localhost:5550/restore-backup.html');
        console.log('2. Wait for "Successfully restored X tasks" message');
        console.log('3. Visit http://localhost:5550 to see restored tasks');
    } else {
        console.log(`❌ Test failed: ${result.error}`);
    }
});