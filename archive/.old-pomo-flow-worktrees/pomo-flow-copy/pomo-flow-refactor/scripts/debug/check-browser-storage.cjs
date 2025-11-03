const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function checkBrowserStorage() {
    console.log('🔍 Starting browser storage analysis for Pomo-Flow tasks...');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        // Open the Pomo-Flow application
        console.log('📱 Opening Pomo-Flow application at http://localhost:5550...');
        await page.goto('http://localhost:5550', { waitUntil: 'networkidle2' });

        // Wait for the app to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get IndexedDB data
        console.log('📊 Checking IndexedDB...');
        const indexedDBData = await page.evaluate(() => {
            return new Promise((resolve) => {
                if (!window.indexedDB) {
                    resolve({ error: 'IndexedDB not supported' });
                    return;
                }

                indexedDB.databases().then(databases => {
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
                                    const transaction = dbInstance.transaction(storeName, 'readonly');
                                    const store = transaction.objectStore(storeName);
                                    const request = store.getAll();
                                    request.onsuccess = () => storeRes(request.result);
                                    request.onerror = () => storeRes([]);
                                });
                                stores.push({ name: storeName, data });
                            }

                            dbInstance.close();
                            return { name: db.name, version: db.version, stores };
                        } catch (error) {
                            return { name: db.name, error: error.message };
                        }
                    });

                    Promise.all(promises).then(resolve);
                }).catch(error => {
                    resolve({ error: error.message });
                });
            });
        });

        // Get Local Storage data
        console.log('💾 Checking Local Storage...');
        const localStorageData = await page.evaluate(() => {
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                data[key] = value;
            }
            return data;
        });

        // Get Session Storage data
        console.log('🔄 Checking Session Storage...');
        const sessionStorageData = await page.evaluate(() => {
            const data = {};
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                const value = sessionStorage.getItem(key);
                data[key] = value;
            }
            return data;
        });

        // Analyze and extract task data
        const analysis = {
            timestamp: new Date().toISOString(),
            url: 'http://localhost:5550',
            indexedDB: indexedDBData,
            localStorage: localStorageData,
            sessionStorage: sessionStorageData,
            foundTasks: []
        };

        // Extract task-like data from IndexedDB
        if (indexedDBData.databases) {
            indexedDBData.databases.forEach(db => {
                if (db.stores) {
                    db.stores.forEach(store => {
                        store.data.forEach(item => {
                            if (item && typeof item === 'object' && (
                                item.title ||
                                item.taskTitle ||
                                item.name ||
                                (item.id && (item.status || item.priority || item.projectId))
                            )) {
                                analysis.foundTasks.push({
                                    ...item,
                                    _source: `indexedDB:${db.name}:${store.name}`
                                });
                            }
                        });
                    });
                }
            });
        }

        // Extract task-like data from Local Storage
        Object.entries(localStorageData).forEach(([key, value]) => {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    parsed.forEach(item => {
                        if (item && typeof item === 'object' && (
                            item.title ||
                            item.taskTitle ||
                            item.name ||
                            (item.id && (item.status || item.priority || item.projectId))
                        )) {
                            analysis.foundTasks.push({
                                ...item,
                                _source: `localStorage:${key}`
                            });
                        }
                    });
                } else if (parsed && typeof parsed === 'object' && (
                    parsed.title ||
                    parsed.taskTitle ||
                    parsed.name ||
                    (parsed.id && (parsed.status || parsed.priority || parsed.projectId))
                )) {
                    analysis.foundTasks.push({
                        ...parsed,
                        _source: `localStorage:${key}`
                    });
                }
            } catch (e) {
                // Not JSON, skip
            }
        });

        // Extract task-like data from Session Storage
        Object.entries(sessionStorageData).forEach(([key, value]) => {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    parsed.forEach(item => {
                        if (item && typeof item === 'object' && (
                            item.title ||
                            item.taskTitle ||
                            item.name ||
                            (item.id && (item.status || item.priority || item.projectId))
                        )) {
                            analysis.foundTasks.push({
                                ...item,
                                _source: `sessionStorage:${key}`
                            });
                        }
                    });
                } else if (parsed && typeof parsed === 'object' && (
                    parsed.title ||
                    parsed.taskTitle ||
                    parsed.name ||
                    (parsed.id && (parsed.status || parsed.priority || parsed.projectId))
                )) {
                    analysis.foundTasks.push({
                        ...parsed,
                        _source: `sessionStorage:${key}`
                    });
                }
            } catch (e) {
                // Not JSON, skip
            }
        });

        // Save the analysis
        const outputDir = path.join(__dirname, 'storage-analysis');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const analysisFile = path.join(outputDir, `storage-analysis-${new Date().toISOString().split('T')[0]}.json`);
        fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));

        // Save just the tasks if any were found
        if (analysis.foundTasks.length > 0) {
            const tasksFile = path.join(outputDir, `recovered-tasks-${new Date().toISOString().split('T')[0]}.json`);
            fs.writeFileSync(tasksFile, JSON.stringify(analysis.foundTasks, null, 2));

            console.log(`✅ SUCCESS: Found ${analysis.foundTasks.length} tasks!`);
            console.log(`📁 Analysis saved to: ${analysisFile}`);
            console.log(`📋 Tasks saved to: ${tasksFile}`);

            // Show first few tasks
            console.log('\n📋 Sample of recovered tasks:');
            analysis.foundTasks.slice(0, 5).forEach((task, index) => {
                console.log(`${index + 1}. "${task.title || 'Untitled'}" (${task._source})`);
                console.log(`   Status: ${task.status || 'unknown'}, Priority: ${task.priority || 'unknown'}`);
                if (task.description) {
                    console.log(`   Description: ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}`);
                }
                console.log('');
            });

            if (analysis.foundTasks.length > 5) {
                console.log(`... and ${analysis.foundTasks.length - 5} more tasks`);
            }
        } else {
            console.log('❌ No personal task data found in browser storage');
            console.log('📁 Analysis saved to: ' + analysisFile);

            // Show what was found
            if (indexedDBData.databases) {
                console.log(`\n📊 Found ${indexedDBData.databases.length} IndexedDB databases:`);
                indexedDBData.databases.forEach(db => {
                    console.log(`   - ${db.name} (version ${db.version})`);
                });
            }

            const localStorageKeys = Object.keys(localStorageData);
            if (localStorageKeys.length > 0) {
                console.log(`\n💾 Found ${localStorageKeys.length} items in Local Storage:`);
                localStorageKeys.forEach(key => {
                    console.log(`   - ${key}`);
                });
            }

            const sessionStorageKeys = Object.keys(sessionStorageData);
            if (sessionStorageKeys.length > 0) {
                console.log(`\n🔄 Found ${sessionStorageKeys.length} items in Session Storage:`);
                sessionStorageKeys.forEach(key => {
                    console.log(`   - ${key}`);
                });
            }
        }

    } catch (error) {
        console.error('❌ Error during browser storage analysis:', error.message);
    } finally {
        await browser.close();
    }
}

// Check if Puppeteer is available
try {
    require.resolve('puppeteer');
    checkBrowserStorage().catch(console.error);
} catch (e) {
    console.log('❌ Puppeteer not found. Installing...');
    const { execSync } = require('child_process');
    execSync('npm install puppeteer', { stdio: 'inherit' });
    console.log('✅ Puppeteer installed. Running analysis...');
    checkBrowserStorage().catch(console.error);
}