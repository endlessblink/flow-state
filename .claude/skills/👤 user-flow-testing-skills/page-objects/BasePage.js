/**
 * Base Page Object Model
 * Provides common functionality for all Pomo-Flow page objects
 */

class BasePage {
  constructor(page) {
    this.page = page;
    this.baseURL = 'http://localhost:5546';
  }

  /**
   * Navigate to a specific URL
   */
  async navigate(url = this.baseURL) {
    await this.page.goto(url);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('#app', { timeout: 10000 });
  }

  /**
   * Wait for Vue app to be ready
   */
  async waitForVueApp() {
    await this.page.waitForFunction(() => {
      return window.Vue && window.Vue.config && window.Vue.config.devtools;
    }, { timeout: 15000 });
  }

  /**
   * Get element with automatic waiting
   */
  async getElement(selector, options = {}) {
    return await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout: 10000,
      ...options
    });
  }

  /**
   * Click element with automatic waiting
   */
  async click(selector, options = {}) {
    const element = await this.getElement(selector);
    await element.click(options);
  }

  /**
   * Fill input field with automatic waiting
   */
  async fill(selector, value, options = {}) {
    const element = await this.getElement(selector);
    await element.fill(value, options);
  }

  /**
   * Get text content of element
   */
  async getText(selector) {
    const element = await this.getElement(selector);
    return await element.textContent();
  }

  /**
   * Check if element is visible
   */
  async isVisible(selector) {
    try {
      await this.getElement(selector, { timeout: 2000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for element to disappear
   */
  async waitForElementToDisappear(selector, timeout = 10000) {
    await this.page.waitForSelector(selector, {
      state: 'hidden',
      timeout: timeout
    });
  }

  /**
   * Take screenshot with automatic naming
   */
  async takeScreenshot(name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    await this.page.screenshot({
      path: `test-results/screenshots/${filename}`,
      fullPage: true
    });
    return filename;
  }

  /**
   * Wait for API request to complete
   */
  async waitForApiResponse(urlPattern) {
    return await this.page.waitForResponse(response => {
      return response.url().includes(urlPattern);
    });
  }

  /**
   * Get current URL
   */
  async getCurrentUrl() {
    return this.page.url();
  }

  /**
   * Get page title
   */
  async getTitle() {
    return await this.page.title();
  }

  /**
   * Hover over element
   */
  async hover(selector) {
    const element = await this.getElement(selector);
    await element.hover();
  }

  /**
   * Drag and drop
   */
  async dragAndDrop(sourceSelector, targetSelector, options = {}) {
    const source = await this.getElement(sourceSelector);
    const target = await this.getElement(targetSelector);

    await source.dragTo(target, options);
  }

  /**
   * Select dropdown option
   */
  async selectOption(selector, value) {
    const element = await this.getElement(selector);
    await element.selectOption(value);
  }

  /**
   * Check checkbox
   */
  async check(selector) {
    const element = await this.getElement(selector);
    await element.check();
  }

  /**
   * Uncheck checkbox
   */
  async uncheck(selector) {
    const element = await this.getElement(selector);
    await element.uncheck();
  }

  /**
   * Get element attribute
   */
  async getAttribute(selector, attribute) {
    const element = await this.getElement(selector);
    return await element.getAttribute(attribute);
  }

  /**
   * Press keyboard key
   */
  async press(key, options = {}) {
    await this.page.keyboard.press(key, options);
  }

  /**
   * Type text with keyboard
   */
  async type(text, options = {}) {
    await this.page.keyboard.type(text, options);
  }

  /**
   * Wait for timeout
   */
  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Execute JavaScript in page context
   */
  async evaluate(func, ...args) {
    return await this.page.evaluate(func, ...args);
  }

  /**
   * Get console messages
   */
  async getConsoleMessages() {
    const messages = [];
    this.page.on('console', msg => {
      messages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });
    return messages;
  }

  /**
   * Check for JavaScript errors
   */
  async checkForErrors() {
    const errors = [];
    this.page.on('pageerror', error => {
      errors.push({
        message: error.message,
        stack: error.stack
      });
    });
    return errors;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    const metrics = await this.page.evaluate(() => {
      if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        return {
          domInteractive: timing.domInteractive - timing.navigationStart,
          loadEventEnd: timing.loadEventEnd - timing.navigationStart,
          firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime,
          firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime
        };
      }
      return {};
    });
    return metrics;
  }

  /**
   * Scroll element into view
   */
  async scrollIntoView(selector) {
    const element = await this.getElement(selector);
    await element.scrollIntoViewIfNeeded();
  }

  /**
   * Get bounding box of element
   */
  async getBoundingBox(selector) {
    const element = await this.getElement(selector);
    return await element.boundingBox();
  }

  /**
   * Is element enabled
   */
  async isEnabled(selector) {
    const element = await this.getElement(selector);
    return await element.isEnabled();
  }

  /**
   * Is element disabled
   */
  async isDisabled(selector) {
    const element = await this.getElement(selector);
    return await element.isDisabled();
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(options = {}) {
    await this.page.waitForNavigation({
      timeout: 15000,
      ...options
    });
  }

  /**
   * Reload page
   */
  async reload() {
    await this.page.reload();
    await this.waitForPageLoad();
  }

  /**
   * Go back in browser history
   */
  async goBack() {
    await this.page.goBack();
    await this.waitForPageLoad();
  }

  /**
   * Go forward in browser history
   */
  async goForward() {
    await this.page.goForward();
    await this.waitForPageLoad();
  }

  /**
   * Get all text content of matching elements
   */
  async getAllText(selector) {
    const elements = await this.page.$$(selector);
    const texts = [];
    for (const element of elements) {
      texts.push(await element.textContent());
    }
    return texts;
  }

  /**
   * Count elements matching selector
   */
  async countElements(selector) {
    const elements = await this.page.$$(selector);
    return elements.length;
  }

  /**
   * Wait for element count to match expected
   */
  async waitForElementCount(selector, expectedCount, timeout = 10000) {
    await this.page.waitForFunction(
      ({ selector, expectedCount }) => {
        return document.querySelectorAll(selector).length === expectedCount;
      },
      { selector, expectedCount },
      { timeout }
    );
  }

  /**
   * Right click on element
   */
  async rightClick(selector, options = {}) {
    const element = await this.getElement(selector);
    await element.click({ button: 'right', ...options });
  }

  /**
   * Double click on element
   */
  async doubleClick(selector, options = {}) {
    const element = await this.getElement(selector);
    await element.dblclick(options);
  }

  /**
   * Focus element
   */
  async focus(selector) {
    const element = await this.getElement(selector);
    await element.focus();
  }

  /**
   * Blur element
   */
  async blur(selector) {
    const element = await this.getElement(selector);
    await element.blur();
  }

  /**
   * Upload file
   */
  async uploadFile(selector, filePath) {
    const element = await this.getElement(selector);
    await element.setInputFiles(filePath);
  }
}

module.exports = BasePage;