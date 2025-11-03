const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function comprehensiveStorageCheck() {
    console.log('🔍 Starting comprehensive browser storage analysis...');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        // Check multiple potential origins where data might be stored
        const origins = [
            'http://localhost:5550',
            'http://localhost:3000',
            'http://localhost:5173',
            'http://127.0.0.1:5550',
            'http://127.0.0.1:3000'
        ];

        const allData = {
            timestamp: new Date().toISOString(),
            origins: {},
            summary: {
                totalDatabases: 0,
                totalTasks: 0,
                realTasks: 0,
                testTasks: 0
            }
        };

        for (const origin of origins) {
            console.log(`\n📱 Checking ${origin}...`);

            try {
                await page.goto(origin, { waitUntil: 'networkidle2', timeout: 5000 });
                await new Promise(resolve => setTimeout(resolve, 2000));

                const storageData = await page.evaluate(() => {
                    return new Promise((resolve) => {
                        const result = {
                            indexedDB: { databases: [], error: null },
                            localStorage: {},
                            sessionStorage: {}
                        };

                        // IndexedDB
                        if (window.indexedDB) {
                            indexedDB.databases().then(databases => {
                                result.indexedDB.databases = databases;
                                const promises = databases.map(async db => {
                                    try {
                                        const dbInstance = await new Promise((res, rej) => {
                                            const request = indexedDB.open(db.name);
                                            request.onsuccess = () => res(request.result);
                                            request.onerror = () => rej(request.error);
                                        });

                                        const stores = [];
                                        for (let i = 0; i < dbInstance.objectStoreNames.length; i++) {
                                            const storeName = dbInstance.objectStoreNames[i];
                                            const data = await new Promise((storeRes) => {
                                                try {
                                                    const transaction = dbInstance.transaction(storeName, 'readonly');
                                                    const store = transaction.objectStore(storeName);
                                                    const request = store.getAll();
                                                    request.onsuccess = () => storeRes(request.result);
                                                    request.onerror = () => storeRes([]);
                                                } catch (e) {
                                                    storeRes([]);
                                                }
                                            });
                                            stores.push({ name: storeName, data });
                                        }

                                        dbInstance.close();
                                        return { name: db.name, version: db.version, stores };
                                    } catch (error) {
                                        return { name: db.name, error: error.message, stores: [] };
                                    }
                                });

                                Promise.all(promises).then(dbResults => {
                                    result.indexedDB.databases = dbResults;

                                    // Local Storage
                                    for (let i = 0; i < localStorage.length; i++) {
                                        const key = localStorage.key(i);
                                        result.localStorage[key] = localStorage.getItem(key);
                                    }

                                    // Session Storage
                                    for (let i = 0; i < sessionStorage.length; i++) {
                                        const key = sessionStorage.key(i);
                                        result.sessionStorage[key] = sessionStorage.getItem(key);
                                    }

                                    resolve(result);
                                });
                            }).catch(error => {
                                result.indexedDB.error = error.message;
                                resolve(result);
                            });
                        } else {
                            result.indexedDB.error = 'IndexedDB not supported';
                            resolve(result);
                        }
                    });
                });

                allData.origins[origin] = storageData;
                console.log(`   ✅ Successfully analyzed ${origin}`);

            } catch (error) {
                console.log(`   ❌ Failed to access ${origin}: ${error.message}`);
                allData.origins[origin] = { error: error.message };
            }
        }

        // Analyze all collected data for tasks
        let allTasks = [];

        Object.entries(allData.origins).forEach(([origin, data]) => {
            if (data.indexedDB && data.indexedDB.databases) {
                data.indexedDB.databases.forEach(db => {
                    if (db.stores) {
                        db.stores.forEach(store => {
                            store.data.forEach(item => {
                                if (item && typeof item === 'object') {
                                    // Check if it's a JSON string containing tasks
                                    if (typeof item === 'string') {
                                        try {
                                            const parsed = JSON.parse(item);
                                            if (Array.isArray(parsed)) {
                                                parsed.forEach(task => {
                                                    if (task && typeof task === 'object' && task.title) {
                                                        allTasks.push({ ...task, _source: `${origin}:indexedDB:${db.name}:${store.name}` });
                                                    }
                                                });
                                            }
                                        } catch (e) {
                                            // Not valid JSON, skip
                                        }
                                    } else if (item.title || item.taskTitle || item.name) {
                                        allTasks.push({ ...item, _source: `${origin}:indexedDB:${db.name}:${store.name}` });
                                    }
                                }
                            });
                        });
                    }
                });
            }

            // Check localStorage for task data
            Object.entries(data.localStorage || {}).forEach(([key, value]) => {
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) {
                        parsed.forEach(item => {
                            if (item && typeof item === 'object' && (item.title || item.taskTitle || item.name)) {
                                allTasks.push({ ...item, _source: `${origin}:localStorage:${key}` });
                            }
                        });
                    }
                } catch (e) {
                    // Not JSON, skip
                }
            });
        });

        // Categorize tasks
        const realTasks = allTasks.filter(task => {
            const isTestTask = task.id && (
                task.id.includes('TEST') ||
                task.id.includes('TASK-') ||
                task.title.toLowerCase().includes('test') ||
                task.title.toLowerCase().includes('implement') ||
                task.title.toLowerCase().includes('add') ||
                task.title.toLowerCase().includes('fix') ||
                task.title.toLowerCase().includes('enhance')
            );
            return !isTestTask;
        });

        const testTasks = allTasks.filter(task => {
            const isTestTask = task.id && (
                task.id.includes('TEST') ||
                task.id.includes('TASK-') ||
                task.title.toLowerCase().includes('test') ||
                task.title.toLowerCase().includes('implement') ||
                task.title.toLowerCase().includes('add') ||
                task.title.toLowerCase().includes('fix') ||
                task.title.toLowerCase().includes('enhance')
            );
            return isTestTask;
        });

        // Update summary
        allData.summary.totalDatabases = Object.values(allData.origins)
            .filter(origin => origin.indexedDB && origin.indexedDB.databases)
            .reduce((sum, origin) => sum + origin.indexedDB.databases.length, 0);
        allData.summary.totalTasks = allTasks.length;
        allData.summary.realTasks = realTasks.length;
        allData.summary.testTasks = testTasks.length;

        // Save comprehensive analysis
        const outputDir = path.join(__dirname, 'storage-analysis');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const comprehensiveFile = path.join(outputDir, `comprehensive-analysis-${new Date().toISOString().split('T')[0]}.json`);
        fs.writeFileSync(comprehensiveFile, JSON.stringify(allData, null, 2));

        // Save all found tasks
        if (allTasks.length > 0) {
            const allTasksFile = path.join(outputDir, `all-found-tasks-${new Date().toISOString().split('T')[0]}.json`);
            fs.writeFileSync(allTasksFile, JSON.stringify(allTasks, null, 2));
            console.log(`💾 All tasks saved to: ${allTasksFile}`);
        }

        // Save real tasks if any found
        if (realTasks.length > 0) {
            const realTasksFile = path.join(outputDir, `real-user-tasks-comprehensive-${new Date().toISOString().split('T')[0]}.json`);
            fs.writeFileSync(realTasksFile, JSON.stringify(realTasks, null, 2));
            console.log(`💾 Real tasks saved to: ${realTasksFile}`);
        }

        // Display results
        console.log('\n📊 COMPREHENSIVE ANALYSIS RESULTS:');
        console.log(`   Origins checked: ${origins.length}`);
        console.log(`   Total databases found: ${allData.summary.totalDatabases}`);
        console.log(`   Total tasks found: ${allData.summary.totalTasks}`);
        console.log(`   Real user tasks: ${allData.summary.realTasks}`);
        console.log(`   Test/development tasks: ${allData.summary.testTasks}`);

        if (realTasks.length > 0) {
            console.log('\n🎯 REAL USER TASKS FOUND:');
            realTasks.forEach((task, index) => {
                console.log(`${index + 1}. "${task.title}" (${task._source})`);
                console.log(`   Status: ${task.status || 'unknown'}, Priority: ${task.priority || 'none'}`);
                console.log(`   Created: ${task.createdAt ? new Date(task.createdAt).toLocaleString() : 'unknown'}`);
                if (task.description && task.description.length > 0) {
                    console.log(`   Description: ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}`);
                }
                console.log('');
            });
        } else {
            console.log('\n❌ No real user tasks found across all origins');
            console.log('💡 All found tasks appear to be test/development tasks');
        }

        console.log(`\n📁 Full analysis saved to: ${comprehensiveFile}`);

    } catch (error) {
        console.error('❌ Error during comprehensive analysis:', error.message);
    } finally {
        await browser.close();
    }
}

// Run the analysis
comprehensiveStorageCheck().catch(console.error);