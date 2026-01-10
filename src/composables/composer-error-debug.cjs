const { chromium } = require('playwright');

async function debugComposerError() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Enhanced error tracking
  const errorDetails = [];

  page.on('pageerror', (error) => {
    errorDetails.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    console.error('🚨 PAGE ERROR:', error.message);

    // Try to extract more context from the stack
    if (error.stack) {
      const lines = error.stack.split('\n');
      console.error('📍 Stack trace preview:');
      lines.slice(0, 5).forEach((line, i) => {
        console.error(`   ${i + 1}. ${line}`);
      });
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  try {
    console.log('🔍 Loading PomoFlow to catch composer error...');
    await page.goto('http://localhost:5547');

    // Wait longer for error to occur
    await page.waitForTimeout(10000);

    // Try to identify the component with the error
    const errorAnalysis = await page.evaluate(() => {
      const results = {
        vueComponents: [],
        composables: [],
        errorContext: null
      };

      // Try to identify Vue components
      try {
        if (window.__VUE__) {
          results.vueComponents = Object.keys(window.__VUE__).map(key => ({
            key,
            type: typeof window.__VUE__[key]
          }));
        }
      } catch (e) {
        console.error('Failed to get Vue components:', e);
      }

      // Check for custom composables in window
      Object.keys(window).forEach(key => {
        if (key.includes('composable') || key.includes('use') || key.includes('flow')) {
          try {
            const value = window[key];
            results.composables.push({
              key,
              type: typeof value,
              isFunction: typeof value === 'function',
              hasProperties: typeof value === 'object' && value !== null ? Object.keys(value).length : 0
            });
          } catch (e) {
            console.error('Error checking composables:', e);
          }
        }
      });

      // Look for any global error handlers or error state
      try {
        if (window.Vue && window.Vue.config && window.Vue.config.errorHandler) {
          results.errorContext = 'Vue has global error handler';
        }
      } catch (e) {
        console.error('Error checking Vue config:', e);
      }

      return results;
    });

    console.log('\n📊 Composer Error Analysis:');
    console.log('Vue Components Found:', errorAnalysis.vueComponents.length);
    console.log('Composables Found:', errorAnalysis.composables.length);
    console.log('Error Context:', errorAnalysis.errorContext);

    errorAnalysis.composables.forEach(comp => {
      console.log(`   📦 ${comp.key} (${comp.type}, ${comp.isFunction ? 'function' : 'object'}${comp.hasProperties > 0 ? `, ${comp.hasProperties} props` : ''})`);
    });

    // Take a screenshot to see the visual state
    await page.screenshot({ path: 'composer-error-debug.png', fullPage: true });
    console.log('\n📸 Screenshot saved: composer-error-debug.png');

    return {
      errorDetails,
      errorAnalysis
    };

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    return { error: error.message };
  } finally {
    await browser.close();
  }
}

debugComposerError().then(result => {
  console.log('\n🎯 Composer Error Debug Complete!');

  if (result.errorDetails && result.errorDetails.length > 0) {
    console.log('\n🚨 COMPONENT ERRORS DETECTED:');
    result.errorDetails.forEach((error, i) => {
      console.log(`\n${i + 1}. ${error.message}`);
      if (error.stack) {
        const stackLines = error.stack.split('\n');
        const relevantLine = stackLines.find(line =>
          line.includes('.vue') ||
          line.includes('composables') ||
          line.includes('use')
        );
        if (relevantLine) {
          console.log(`   📍 Likely source: ${relevantLine.trim()}`);
        }
      }
    });
  }

  if (result.errorAnalysis) {
    console.log('\n📋 ANALYSIS SUMMARY:');
    console.log('✅ Vue app is running but has composer errors');
    console.log('🔍 Check the error details above for the exact component location');
    console.log('💡 The "Unexpected return type in composer" error is likely in a composable function');
  }
}).catch(console.error);