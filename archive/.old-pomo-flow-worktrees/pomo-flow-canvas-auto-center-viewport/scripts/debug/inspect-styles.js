import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://localhost:5546/#/calendar', { waitUntil: 'networkidle0' });

  // Wait for sidebar task to be present
  await page.waitForSelector('.sidebar-task', { timeout: 5000 });

  // Get computed styles for the first sidebar task
  const styles = await page.evaluate(() => {
    const sidebarTask = document.querySelector('.sidebar-task');
    if (!sidebarTask) return { error: 'No sidebar task found' };

    const computed = window.getComputedStyle(sidebarTask);
    const root = document.documentElement;
    const rootStyles = window.getComputedStyle(root);

    return {
      element: {
        borderRadius: computed.borderRadius,
        borderTopLeftRadius: computed.borderTopLeftRadius,
        borderTopRightRadius: computed.borderTopRightRadius,
        borderBottomLeftRadius: computed.borderBottomLeftRadius,
        borderBottomRightRadius: computed.borderBottomRightRadius
      },
      cssVariables: {
        'radius-sm': rootStyles.getPropertyValue('--radius-sm').trim(),
        'radius-md': rootStyles.getPropertyValue('--radius-md').trim(),
        'radius-lg': rootStyles.getPropertyValue('--radius-lg').trim(),
        'radius-xl': rootStyles.getPropertyValue('--radius-xl').trim(),
        'radius-2xl': rootStyles.getPropertyValue('--radius-2xl').trim()
      },
      className: sidebarTask.className,
      innerHTML: sidebarTask.innerHTML.substring(0, 200)
    };
  });

  console.log('=== SIDEBAR TASK STYLES ===');
  console.log(JSON.stringify(styles, null, 2));

  await browser.close();
})();
