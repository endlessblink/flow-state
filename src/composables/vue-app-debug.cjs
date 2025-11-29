const { chromium } = require('playwright');

async function debugVueApp() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture console output and errors
  const consoleMessages = [];
  const errors = [];

  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack
    });
    console.error('PAGE ERROR:', error.message);
  });

  try {
    console.log('🔍 Loading PomoFlow with debugging...');
    await page.goto('http://localhost:5547');

    // Wait for potential Vue initialization
    await page.waitForTimeout(5000);

    // Check Vue app state
    const vueAppState = await page.evaluate(() => {
      return {
        // DOM state
        hasRoot: !!document.querySelector('#root'),
        rootElement: document.querySelector('#root'),
        rootContent: document.querySelector('#root')?.innerHTML || '',
        rootChildren: document.querySelector('#root')?.children.length || 0,

        // Check if Vue is loaded
        vueDefined: typeof window.Vue !== 'undefined',
        vueCreateAppDefined: typeof window.createApp !== 'undefined',

        // Check for Vue app instance
        hasVueApp: !!document.querySelector('#root').__vue_app__,

        // Check for script loading
        scriptsLoaded: Array.from(document.scripts).map(s => s.src),

        // Global state
        windowKeys: Object.keys(window).filter(k => k.includes('vue') || k.includes('app') || k.includes('pomo')),

        // Check if main.ts executed
        hasPomoFlowBackup: !!window.pomoFlowBackup,
        hasAuthStore: !!window.useAuthStore,

        // Check for errors in console
        documentTitle: document.title,
        readyState: document.readyState
      };
    });

    console.log('\n📊 Vue App Debug Results:');
    console.log('✅ Has #root element:', vueAppState.hasRoot);
    console.log('📦 Root children count:', vueAppState.rootChildren);
    console.log('📄 Root content preview:', vueAppState.rootContent.substring(0, 200));
    console.log('🔧 Vue defined:', vueAppState.vueDefined);
    console.log('🚀 Vue createApp defined:', vueAppState.vueCreateAppDefined);
    console.log('🎯 Has Vue app instance:', vueAppState.hasVueApp);
    console.log('🛡️ Has PomoFlow backup API:', vueAppState.hasPomoFlowBackup);
    console.log('🔐 Auth store available:', vueAppState.hasAuthStore);
    console.log('📝 Document ready state:', vueAppState.readyState);
    console.log('🔑 Relevant window keys:', vueAppState.windowKeys);

    console.log('\n📜 Console Messages:', consoleMessages.length);
    consoleMessages.forEach((msg, i) => {
      console.log(`  ${i + 1}. [${msg.type}] ${msg.text}`);
    });

    console.log('\n❌ Page Errors:', errors.length);
    errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error.message}`);
      if (error.stack) {
        console.log(`     Stack: ${error.stack.split('\n')[0]}`);
      }
    });

    // Take screenshot
    await page.screenshot({ path: 'vue-app-debug.png', fullPage: true });
    console.log('\n📸 Screenshot saved: vue-app-debug.png');

    return {
      vueAppState,
      consoleMessages,
      errors
    };

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    return { error: error.message };
  } finally {
    await browser.close();
  }
}

debugVueApp().then(result => {
  console.log('\n🎯 Vue App Debug Complete!');

  if (result.error) {
    console.log('❌ Conclusion: Debug failed -', result.error);
  } else {
    const vueAppWorking = result.vueAppState.hasRoot &&
                         result.vueAppState.rootChildren > 0 &&
                         result.vueAppState.hasPomoFlowBackup;

    if (vueAppWorking) {
      console.log('✅ Conclusion: Vue app appears to be working');
    } else {
      console.log('❌ Conclusion: Vue app has serious initialization issues');
      if (!result.vueAppState.hasPomoFlowBackup) {
        console.log('   🔍 Main.ts may not have executed fully');
      }
      if (result.vueAppState.rootChildren === 0) {
        console.log('   🔍 Vue app failed to mount or render');
      }
      if (result.errors.length > 0) {
        console.log('   🔍 JavaScript errors detected during initialization');
      }
    }
  }
}).catch(console.error);