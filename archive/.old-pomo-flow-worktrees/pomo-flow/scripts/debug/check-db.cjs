const puppeteer = require('puppeteer');

async function checkIndexedDB() {
  let browser;
  try {
    console.log('🔍 Checking IndexedDB access...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Capture all console messages
    page.on('console', msg => {
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    page.on('pageerror', error => {
      console.error('🚨 PAGE ERROR:', error.message);
    });

    await page.goto('http://localhost:5550', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait a bit for the app to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check IndexedDB in detail
    const dbCheck = await page.evaluate(async () => {
      const results = {};

      // Check if IndexedDB is supported
      results.indexedDBSupported = 'indexedDB' in self;

      // Try to open the database
      try {
        const request = indexedDB.open('pomo-flow', 1.0);

        results.openStarted = true;

        const openResult = await new Promise((resolve) => {
          request.onsuccess = (event) => {
            resolve({ success: true, db: event.target.result });
          };
          request.onerror = (event) => {
            resolve({ success: false, error: event.target.error });
          };
          request.onupgradeneeded = (event) => {
            console.log('DB upgrade needed');
          };
          request.blocked = (event) => {
            console.log('DB blocked');
          };
        });

        results.openResult = openResult;

        if (openResult.success) {
          const db = openResult.db;
          results.dbName = db.name;
          results.version = db.version;
          results.objectStoreNames = Array.from(db.objectStoreNames);

          // Try to read from the store
          if (db.objectStoreNames.contains('pomo_flow_data')) {
            try {
              const transaction = db.transaction(['pomo_flow_data'], 'readonly');
              const store = transaction.objectStore('pomo_flow_data');

              // Get all keys
              const keys = await new Promise((resolve) => {
                const getAllKeysRequest = store.getAllKeys();
                getAllKeysRequest.onsuccess = () => resolve(getAllKeysRequest.result);
                getAllKeysRequest.onerror = () => resolve([]);
              });

              results.keys = keys;

              // Get all data
              const data = await new Promise((resolve) => {
                const getAllRequest = store.getAll();
                getAllRequest.onsuccess = () => {
                  const items = getAllRequest.result;
                  const parsed = {};
                  items.forEach(item => {
                    if (item.key && item.value) {
                      try {
                        parsed[item.key] = JSON.parse(item.value);
                      } catch (e) {
                        parsed[item.key] = item.value;
                      }
                    }
                  });
                  resolve(parsed);
                };
                getAllRequest.onerror = () => resolve({});
              });

              results.data = data;
            } catch (e) {
              results.readError = e.message;
            }
          } else {
            results.storeError = 'Store pomo_flow_data not found';
          }
        }

      } catch (e) {
        results.exception = e.message;
        results.stack = e.stack;
      }

      return results;
    });

    console.log('\n📊 IndexedDB Check Results:');
    console.log('===========================');
    console.log('IndexedDB supported:', dbCheck.indexedDBSupported);
    console.log('Open started:', dbCheck.openStarted);

    if (dbCheck.openResult) {
      console.log('Open success:', dbCheck.openResult.success);
      if (dbCheck.openResult.error) {
        console.log('Open error:', dbCheck.openResult.error);
      }
    }

    if (dbCheck.dbName) {
      console.log('Database name:', dbCheck.dbName);
      console.log('Version:', dbCheck.version);
      console.log('Object stores:', dbCheck.objectStoreNames);
    }

    if (dbCheck.keys) {
      console.log('Keys:', dbCheck.keys);
    }

    if (dbCheck.data) {
      console.log('\n📦 Data in IndexedDB:');
      Object.keys(dbCheck.data).forEach(key => {
        const value = dbCheck.data[key];
        if (Array.isArray(value)) {
          console.log(`  ${key}: ${value.length} items`);
          if (key === 'tasks' && value.length > 0) {
            console.log(`    First task:`, value[0]?.title || 'No title');
          }
        } else {
          console.log(`  ${key}:`, typeof value === 'object' ? 'Object' : value);
        }
      });
    }

    if (dbCheck.readError) {
      console.log('\n❌ Read error:', dbCheck.readError);
    }

    if (dbCheck.storeError) {
      console.log('\n❌ Store error:', dbCheck.storeError);
    }

    if (dbCheck.exception) {
      console.log('\n💥 Exception:', dbCheck.exception);
    }

  } catch (error) {
    console.error('💥 ERROR:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

checkIndexedDB();