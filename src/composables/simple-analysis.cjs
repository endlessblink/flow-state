const { chromium } = require('playwright');

async function analyzePomoFlow() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('🔍 Navigating to PomoFlow...');
    await page.goto('http://localhost:5547');
    await page.waitForTimeout(5000);

    // Check if Vue app is mounted
    const appInfo = await page.evaluate(() => {
      const app = document.querySelector('#app');
      return {
        hasApp: !!app,
        appChildren: app ? app.children.length : 0,
        bodyClasses: document.body.className,
        title: document.title,
        pageContent: document.body.innerText.substring(0, 500)
      };
    });

    console.log('📊 App Analysis Results:');
    console.log('✅ Has #app element:', appInfo.hasApp);
    console.log('📦 App children count:', appInfo.appChildren);
    console.log('🎨 Body classes:', appInfo.bodyClasses);
    console.log('📝 Page title:', appInfo.title);
    console.log('📄 Content preview:', appInfo.pageContent);

    // Check for specific PomoFlow elements
    const pomoFlowElements = await page.evaluate(() => {
      return {
        hasNavigation: !!document.querySelector('nav, .navigation, .nav'),
        hasViewTabs: !!document.querySelector('[data-view], .view-tabs, .tab-nav'),
        hasTaskContainer: !!document.querySelector('.tasks, .task-container, .board'),
        hasTimer: !!document.querySelector('.timer, .pomodoro, [data-timer]'),
        hasCanvas: !!document.querySelector('.canvas, .vue-flow, [data-canvas]'),
        errorElements: document.querySelectorAll('.error, .exception, [data-error]').length
      };
    });

    console.log('\n🧩 PomoFlow Elements:');
    console.log('🧭 Navigation:', pomoFlowElements.hasNavigation);
    console.log('📑 View tabs:', pomoFlowElements.hasViewTabs);
    console.log('✅ Task container:', pomoFlowElements.hasTaskContainer);
    console.log('⏰ Timer:', pomoFlowElements.hasTimer);
    console.log('🎨 Canvas:', pomoFlowElements.hasCanvas);
    console.log('❌ Error elements:', pomoFlowElements.errorElements);

    // Take screenshot
    await page.screenshot({ path: 'pomoflow-analysis.png', fullPage: true });
    console.log('\n📸 Screenshot saved: pomoflow-analysis.png');

    return { appInfo, pomoFlowElements };

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    return { error: error.message };
  } finally {
    await browser.close();
  }
}

analyzePomoFlow().then(result => {
  console.log('\n🎯 Analysis complete!');
  if (result.error) {
    console.log('❌ Conclusion: App is broken -', result.error);
  } else {
    const isWorking = result.appInfo.hasApp && result.appInfo.appChildren > 0;
    console.log(isWorking ? '✅ Conclusion: App appears to be working' : '❌ Conclusion: App has mounting issues');
  }
}).catch(console.error);