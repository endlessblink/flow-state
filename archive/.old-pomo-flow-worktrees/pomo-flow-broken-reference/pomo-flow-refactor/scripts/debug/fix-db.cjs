const puppeteer = require('puppeteer');

async function fixDB() {
  let browser;
  try {
    console.log('🔧 Fixing IndexedDB issue...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Clear all storage
    await page.evaluateOnNewDocument(() => {
      // Clear IndexedDB
      if ('indexedDB' in self) {
        indexedDB.deleteDatabase('pomo-flow');
      }
    });

    // Capture console messages
    const logs = [];
    page.on('console', msg => {
      logs.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      console.error('🚨 PAGE ERROR:', error.message);
    });

    console.log('🌐 Navigating to app...');
    await page.goto('http://localhost:5550', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for app to initialize
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for task loading messages
    const taskMessages = logs.filter(l =>
      l.text.includes('Loaded') && l.text.includes('tasks')
    );

    const errorMessages = logs.filter(l => l.type === 'error');

    // Check IndexedDB directly
    const dbStatus = await page.evaluate(async () => {
      try {
        const request = indexedDB.open('pomo-flow', 3);
        return new Promise((resolve) => {
          request.onsuccess = (event) => {
            const db = event.target.result;
            resolve({
              success: true,
              name: db.name,
              version: db.version,
              stores: Array.from(db.objectStoreNames)
            });
          };
          request.onerror = (event) => {
            resolve({
              success: false,
              error: event.target.error?.message || 'Unknown error'
            });
          };
          request.onupgradeneeded = (event) => {
            resolve({
              success: false,
              error: 'Database needs upgrade'
            });
          };
        });
      } catch (e) {
        return {
          success: false,
          error: e.message
        };
      }
    });

    console.log('\n📊 Results:');
    console.log('=============');
    console.log('IndexedDB:', dbStatus.success ? '✅ OPEN' : '❌ FAILED');
    if (dbStatus.error) {
      console.log('  Error:', dbStatus.error);
    }
    if (dbStatus.stores) {
      console.log('  Stores:', dbStatus.stores);
    }

    console.log('\nTask loading messages:', taskMessages.length);
    taskMessages.forEach(msg => {
      console.log(`  ${msg.text}`);
    });

    console.log('\nConsole errors:', errorMessages.length);
    errorMessages.forEach(msg => {
      console.log(`  ${msg.text}`);
    });

    // Check UI
    const uiCheck = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return {
        hasLoadedMessage: body.includes('Loaded') && body.includes('IndexedDB'),
        hasErrorText: body.toLowerCase().includes('error'),
        taskCount: document.querySelectorAll('[class*="task"]').length
      };
    });

    console.log('\nUI Check:');
    console.log('  Has loaded message:', uiCheck.hasLoadedMessage);
    console.log('  Has error text:', uiCheck.hasErrorText);
    console.log('  Task elements:', uiCheck.taskCount);

  } catch (error) {
    console.error('💥 ERROR:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

fixDB();