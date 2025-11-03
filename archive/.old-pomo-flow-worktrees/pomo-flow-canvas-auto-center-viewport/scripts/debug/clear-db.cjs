const puppeteer = require('puppeteer');

async function clearAndTestDB() {
  let browser;
  try {
    console.log('🗑️ Clearing IndexedDB and testing...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Capture console messages
    page.on('console', msg => {
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    await page.goto('http://localhost:5550', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Clear IndexedDB and test again
    const result = await page.evaluate(async () => {
      const results = {};

      // First, try to delete existing database
      try {
        const deleteReq = indexedDB.deleteDatabase('pomo-flow');
        await new Promise((resolve) => {
          deleteReq.onsuccess = () => resolve(true);
          deleteReq.onerror = () => resolve(false);
          deleteReq.blocked = () => resolve(false);
        });
        results.deleted = true;
      } catch (e) {
        results.deleted = false;
        results.deleteError = e.message;
      }

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now try to open fresh
      try {
        const request = indexedDB.open('pomo-flow', 1.0);

        const openResult = await new Promise((resolve) => {
          request.onsuccess = (event) => {
            const db = event.target.result;

            // Create the store if it doesn't exist
            if (!db.objectStoreNames.contains('pomo_flow_data')) {
              console.log('Creating object store...');
              const store = db.createObjectStore('pomo_flow_data');
              console.log('Object store created');
            }

            resolve({ success: true, db: db.name });
          };
          request.onerror = (event) => {
            resolve({ success: false, error: event.target.error?.message || 'Unknown error' });
          };
          request.onupgradeneeded = (event) => {
            console.log('Database upgrade needed');
            const db = event.target.result;

            // Create the store
            if (!db.objectStoreNames.contains('pomo_flow_data')) {
              const store = db.createObjectStore('pomo_flow_data');
              console.log('Object store created during upgrade');
            }
          };
        });

        results.openResult = openResult;

        // Now test writing and reading
        if (openResult.success) {
          try {
            const request = indexedDB.open('pomo-flow', 1.0);

            const testResult = await new Promise((resolve) => {
              request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['pomo_flow_data'], 'readwrite');
                const store = transaction.objectStore('pomo_flow_data');

                // Test write
                const writeReq = store.put({ key: 'test', value: JSON.stringify({ test: true }) });
                writeReq.onsuccess = () => {
                  // Test read
                  const readReq = store.get('test');
                  readReq.onsuccess = () => {
                    resolve({
                      success: true,
                      data: readReq.result ? JSON.parse(readReq.result.value) : null
                    });
                  };
                  readReq.onerror = () => resolve({ success: false, error: 'Read failed' });
                };
                writeReq.onerror = () => resolve({ success: false, error: 'Write failed' });
              };
              request.onerror = () => resolve({ success: false, error: 'DB open failed for test' });
            });

            results.testResult = testResult;
          } catch (e) {
            results.testError = e.message;
          }
        }

      } catch (e) {
        results.openError = e.message;
      }

      return results;
    });

    console.log('\n📊 Clear and Test Results:');
    console.log('==========================');
    console.log('Database deleted:', result.deleted);
    if (result.deleteError) {
      console.log('Delete error:', result.deleteError);
    }

    if (result.openResult) {
      console.log('Open success:', result.openResult.success);
      if (result.openResult.error) {
        console.log('Open error:', result.openResult.error);
      }
    }

    if (result.testResult) {
      console.log('Test success:', result.testResult.success);
      console.log('Test data:', result.testResult.data);
    }

    if (result.testError) {
      console.log('Test error:', result.testError);
    }

    if (result.openError) {
      console.log('Open exception:', result.openError);
    }

  } catch (error) {
    console.error('💥 ERROR:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

clearAndTestDB();