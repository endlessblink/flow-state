const puppeteer = require('puppeteer');
const path = require('path');

async function debugPomoFlow() {
  let browser;
  try {
    console.log('🔍 Starting browser...');
    browser = await puppeteer.launch({
      headless: false, // Show the browser
      devtools: true,  // Open devtools
      defaultViewport: null,
      args: ['--start-maximized']
    });

    const page = await browser.newPage();

    // Capture console logs
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Capture page errors
    page.on('pageerror', error => {
      console.error('🚨 PAGE ERROR:', error.message);
      console.error('Stack:', error.stack);
    });

    // Capture request failures
    page.on('requestfailed', request => {
      console.error('❌ REQUEST FAILED:', request.url());
      console.error('   Failure:', request.failure().errorText);
    });

    console.log('🌐 Navigating to http://localhost:5550...');
    await page.goto('http://localhost:5550', { waitUntil: 'networkidle2' });

    // Wait for the app to load
    console.log('⏳ Waiting for app to load...');
    await page.waitForSelector('#root', { timeout: 10000 });

    // Check for IndexedDB data
    console.log('💾 Checking IndexedDB data...');
    const indexedDBData = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const request = indexedDB.open('pomo-flow', 1.0);

        request.onsuccess = function(event) {
          const db = event.target.result;
          const data = {};

          if (db.objectStoreNames.contains('pomo_flow_data')) {
            const transaction = db.transaction(['pomo_flow_data'], 'readonly');
            const store = transaction.objectStore('pomo_flow_data');
            const getAllRequest = store.getAll();

            getAllRequest.onsuccess = function() {
              const items = getAllRequest.result;
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

            getAllRequest.onerror = function() {
              resolve({ error: 'Failed to read data' });
            };
          } else {
            resolve({ error: 'Store not found' });
          }
        };

        request.onerror = function() {
          resolve({ error: 'Failed to open database' });
        };
      });
    });

    console.log('📊 IndexedDB Data:', indexedDBData);

    // Check for tasks in the UI
    console.log('👀 Checking for tasks in UI...');
    const taskElements = await page.$$('[data-testid="task-card"], .task-card, [class*="task"]');
    console.log(`Found ${taskElements.length} task elements`);

    // Check the DOM for task-related content
    const hasTaskContent = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return {
        hasTasks: body.includes('Loaded') && body.includes('tasks from IndexedDB'),
        bodyTextLength: body.length,
        hasLoadMessage: body.includes('Loaded') && body.includes('IndexedDB'),
        hasErrorMessages: body.toLowerCase().includes('error'),
        hasTaskElements: document.querySelectorAll('[class*="task"]').length > 0
      };
    });

    console.log('📝 UI Content Analysis:', hasTaskContent);

    // Get the current state of the app
    const appState = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        hasRoot: !!document.querySelector('#root'),
        rootContent: document.querySelector('#root')?.textContent?.substring(0, 200) || 'No content'
      };
    });

    console.log('📱 App State:', appState);

    // Check for specific task store initialization
    const taskStoreState = await page.evaluate(() => {
      // Try to access Vue devtools or check if Vue is loaded
      const hasVue = typeof window.Vue !== 'undefined' ||
                     document.querySelector('[data-v-]') !== null;

      // Look for task-related data in scripts
      const scripts = Array.from(document.querySelectorAll('script'));
      const hasTaskScript = scripts.some(script =>
        script.textContent?.includes('loadFromDatabase') ||
        script.textContent?.includes('tasks')
      );

      return {
        hasVue,
        hasTaskScript,
        scriptCount: scripts.length
      };
    });

    console.log('🗄️ Task Store State:', taskStoreState);

    // Wait a bit more to see if anything loads
    console.log('⏳ Waiting 5 seconds to see if tasks load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Final check
    const finalState = await page.evaluate(() => {
      const root = document.querySelector('#root');
      return {
        rootHTML: root?.innerHTML.substring(0, 500) || 'No root element',
        taskCount: document.querySelectorAll('[class*="task"]').length,
        hasErrorMessage: document.body.textContent.toLowerCase().includes('error'),
        consoleLogs: Array.from(document.querySelectorAll('.console-message')).length
      };
    });

    console.log('🏁 Final State:', finalState);

    // Summary
    console.log('\n📋 DEBUG SUMMARY:');
    console.log('==================');
    console.log('✅ Page loaded successfully');
    console.log(`📊 Console messages: ${consoleMessages.length}`);
    console.log(`💾 IndexedDB data:`, indexedDBData);
    console.log(`👀 Task elements found: ${taskElements.length}`);
    console.log(`🔍 Has task content: ${hasTaskContent.hasTasks || hasTaskContent.hasTaskElements}`);

    if (consoleMessages.some(m => m.type === 'error')) {
      console.log('🚨 ERRORS FOUND:');
      consoleMessages.filter(m => m.type === 'error').forEach(msg => {
        console.log(`  - ${msg.text}`);
      });
    }

    // Keep browser open for manual inspection
    console.log('\n🔧 Browser is open for manual inspection. Press Ctrl+C to close.');
    await new Promise(() => {}); // Wait forever

  } catch (error) {
    console.error('💥 ERROR:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugPomoFlow();