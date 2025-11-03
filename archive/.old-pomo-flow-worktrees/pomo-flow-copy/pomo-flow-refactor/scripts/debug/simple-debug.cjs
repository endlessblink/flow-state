const puppeteer = require('puppeteer');

async function debugPomoFlow() {
  let browser;
  try {
    console.log('🔍 Starting headless browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Capture console logs
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      console.error('🚨 PAGE ERROR:', error.message);
    });

    console.log('🌐 Navigating to http://localhost:5550...');
    await page.goto('http://localhost:5550', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for the app to initialize
    console.log('⏳ Waiting for app to load...');
    try {
      await page.waitForFunction(() => {
        return document.querySelector('#root') &&
               document.querySelector('#root').children.length > 0;
      }, { timeout: 10000 });
    } catch (e) {
      console.log('⚠️ Timeout waiting for root content');
    }

    // Check for IndexedDB data
    console.log('💾 Checking IndexedDB...');
    const indexedDBData = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const request = indexedDB.open('pomo-flow', 1.0);

        request.onerror = function() {
          resolve({ error: 'Failed to open database' });
        };

        request.onsuccess = function(event) {
          const db = event.target.result;

          if (!db.objectStoreNames.contains('pomo_flow_data')) {
            resolve({ error: 'Store not found' });
            return;
          }

          const transaction = db.transaction(['pomo_flow_data'], 'readonly');
          const store = transaction.objectStore('pomo_flow_data');
          const getAllRequest = store.getAll();

          getAllRequest.onerror = function() {
            resolve({ error: 'Failed to read data' });
          };

          getAllRequest.onsuccess = function() {
            const items = getAllRequest.result;
            const data = {};
            items.forEach(item => {
              if (item.key && item.value) {
                try {
                  data[item.key] = JSON.parse(item.value);
                } catch (e) {
                  data[item.key] = item.value;
                }
              }
            });
            resolve(data);
          };
        };
      });
    });

    console.log('📊 IndexedDB contents:');
    if (indexedDBData.error) {
      console.log('  ❌', indexedDBData.error);
    } else {
      Object.keys(indexedDBData).forEach(key => {
        const value = indexedDBData[key];
        if (Array.isArray(value)) {
          console.log(`  ${key}: ${value.length} items`);
        } else {
          console.log(`  ${key}:`, typeof value === 'object' ? Object.keys(value) : value);
        }
      });
    }

    // Check for task loading messages
    const taskLoadingMessages = consoleMessages.filter(m =>
      m.text.includes('Loaded') && m.text.includes('tasks')
    );

    if (taskLoadingMessages.length > 0) {
      console.log('\n📂 Task loading messages:');
      taskLoadingMessages.forEach(msg => {
        console.log(`  ${msg.text}`);
      });
    }

    // Check for error messages
    const errorMessages = consoleMessages.filter(m => m.type === 'error');
    if (errorMessages.length > 0) {
      console.log('\n🚨 Console errors found:');
      errorMessages.forEach(msg => {
        console.log(`  ${msg.text}`);
      });
    }

    // Check the UI
    console.log('\n👀 Checking UI...');
    const uiCheck = await page.evaluate(() => {
      const root = document.querySelector('#root');
      return {
        hasContent: root ? root.innerHTML.length > 0 : false,
        taskElements: document.querySelectorAll('[class*="task"]').length,
        hasErrorMessage: document.body.textContent.toLowerCase().includes('error'),
        bodyText: document.body.textContent.substring(0, 200)
      };
    });

    console.log('  UI has content:', uiCheck.hasContent);
    console.log('  Task elements:', uiCheck.taskElements);
    console.log('  Has error message:', uiCheck.hasErrorMessage);
    console.log('  Body text preview:', uiCheck.bodyText);

    // Look for Vue app initialization
    const vueCheck = await page.evaluate(() => {
      return {
        hasVueApp: !!document.querySelector('#root').__vue_app__,
        hasVNodes: document.querySelectorAll('[data-v-]').length > 0
      };
    });

    console.log('\n🖼️ Vue status:');
    console.log('  Vue app mounted:', vueCheck.hasVueApp);
    console.log('  Has VNodes:', vueCheck.hasVNodes);

    // Final summary
    console.log('\n📋 SUMMARY:');
    console.log('=============');
    console.log('✅ Page loaded');
    console.log(`📊 Console messages: ${consoleMessages.length}`);
    console.log(`💾 IndexedDB: ${indexedDBData.error ? 'ERROR' : 'OK'}`);
    console.log(`👀 UI elements: ${uiCheck.taskElements} task-related`);
    console.log(`🔍 Task loading: ${taskLoadingMessages.length > 0 ? 'YES' : 'NO MESSAGES'}`);
    console.log(`🚨 Errors: ${errorMessages.length}`);

  } catch (error) {
    console.error('💥 ERROR:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugPomoFlow();