# Tauri v2 Testing Troubleshooting Guide

Common issues and solutions when testing Tauri v2 applications.

## Test Setup Issues

### Issue: "Cannot find module '@tauri-apps/api'"

**Cause:** Tauri API is not available in Node.js environment during tests.

**Solution:** Mock the Tauri API in your test setup:

```typescript
// src/tests/unit/setup.ts
import { vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrent: vi.fn(() => ({
    label: 'main',
    listen: vi.fn(),
    emit: vi.fn(),
  })),
}));
```

### Issue: "WebSocket connection failed" during E2E tests

**Cause:** Tauri dev server not running or not accessible.

**Solution:**
1. Ensure `npm run tauri dev` is running
2. Check the port in `playwright.config.ts` matches your Tauri config
3. Increase the `webServer.timeout` in Playwright config:

```typescript
webServer: {
  command: 'npm run tauri dev',
  url: 'http://localhost:1430',
  timeout: 120 * 1000, // Increase for slow Rust compilation
}
```

### Issue: "Port already in use"

**Cause:** Previous dev server still running.

**Solution:**
```bash
# Kill existing processes
lsof -ti:1430 | xargs -r kill -9

# Or use a kill script in package.json
"scripts": {
  "kill": "lsof -ti:1430 | xargs -r kill -9 || true"
}
```

## E2E Test Failures

### Issue: "Element not found" or "Timeout waiting for selector"

**Cause:** Element hasn't appeared yet or selector is incorrect.

**Solutions:**

1. **Use auto-waiting assertions:**
```typescript
// Bad
const element = await page.locator('button');
expect(element).toBeDefined(); // Doesn't wait

// Good
await expect(page.locator('button')).toBeVisible(); // Waits automatically
```

2. **Wait for page load:**
```typescript
await page.goto('/');
await page.waitForLoadState('networkidle');
await page.waitForSelector('[data-v-app]'); // Wait for Vue app
```

3. **Use more specific selectors:**
```typescript
// Bad - too generic
await page.click('button');

// Good - specific and semantic
await page.getByRole('button', { name: /save/i }).click();
```

### Issue: Flaky tests (pass sometimes, fail sometimes)

**Cause:** Race conditions, animations, or timing issues.

**Solutions:**

1. **Never use hardcoded timeouts:**
```typescript
// Bad
await page.waitForTimeout(2000);

// Good
await page.waitForSelector('[data-loaded="true"]');
await expect(page.getByText(/loaded/i)).toBeVisible();
```

2. **Wait for network activity:**
```typescript
await page.waitForLoadState('networkidle');
```

3. **Wait for animations:**
```typescript
// Disable animations in tests
await page.addStyleTag({
  content: `
    *, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }
  `,
});
```

4. **Use retries in CI:**
```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
});
```

### Issue: "Cannot invoke Tauri command" in tests

**Cause:** Tauri API not mocked or mock not set up before navigation.

**Solution:** Set up mocks before `page.goto()`:

```typescript
test('test with mocked commands', async ({ page }) => {
  // Set up mocks FIRST
  await page.addInitScript(() => {
    window.__TAURI_CORE__ = {
      invoke: async (cmd: string, args?: any) => {
        if (cmd === 'greet') return `Hello, ${args.name}!`;
        throw new Error(`Unknown command: ${cmd}`);
      },
    };
  });

  // THEN navigate
  await page.goto('/');
});
```

### Issue: Screenshots differ between local and CI

**Cause:** Different fonts, rendering engines, or screen sizes.

**Solutions:**

1. **Use Docker for consistent environment:**
```yaml
# .github/workflows/test.yml
container:
  image: mcr.microsoft.com/playwright:v1.40.0-jammy
```

2. **Increase diff threshold:**
```typescript
await expect(page).toHaveScreenshot('page.png', {
  maxDiffPixels: 100,
  maxDiffPixelRatio: 0.01,
});
```

3. **Use specific viewport:**
```typescript
use: {
  viewport: { width: 1280, height: 720 },
},
```

## CI/CD Issues

### Issue: "libwebkit2gtk-4.1 not found" on Linux

**Cause:** Missing system dependencies.

**Solution:** Install Tauri dependencies:

```yaml
- name: Install Linux dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y \
      libwebkit2gtk-4.1-dev \
      libgtk-3-dev \
      libayatana-appindicator3-dev \
      librsvg2-dev
```

### Issue: Tests hang on Linux CI without display

**Cause:** No display server for GUI testing.

**Solution:** Use `xvfb-run`:

```yaml
- name: Run E2E tests
  run: xvfb-run --auto-servernum -- npm run test:e2e
```

### Issue: Rust compilation takes too long in CI

**Cause:** No caching of Rust build artifacts.

**Solution:** Use `swatinem/rust-cache`:

```yaml
- uses: swatinem/rust-cache@v2
  with:
    workspaces: './src-tauri -> target'
    cache-on-failure: true
```

### Issue: macOS tests fail with code signing errors

**Cause:** Missing or invalid code signing certificates.

**Solution:** For testing, disable signing or use ad-hoc signing:

```toml
# src-tauri/tauri.conf.json
{
  "bundle": {
    "macOS": {
      "signing_identity": "-"  // Ad-hoc signing
    }
  }
}
```

## Debugging Techniques

### Enable Playwright Debug Mode

```bash
# Interactive debugging with inspector
npm run test:e2e:debug

# Run specific test in debug mode
npx playwright test my-test.spec.ts --debug

# UI mode for visual debugging
npm run test:e2e:ui
```

### View Test Traces

```bash
# After test failure, view trace
npx playwright show-trace test-results/test-name/trace.zip
```

### Add Debug Logging

```typescript
test('debug test', async ({ page }) => {
  // Log all console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // Log all network requests
  page.on('request', req => console.log('REQUEST:', req.url()));

  // Take intermediate screenshots
  await page.screenshot({ path: 'step1.png' });

  // Pause for manual inspection
  await page.pause();
});
```

### Debug Tauri Commands

```typescript
await page.addInitScript(() => {
  const originalInvoke = window.__TAURI_CORE__?.invoke;
  window.__TAURI_CORE__ = {
    invoke: async (cmd: string, args?: any) => {
      console.log('[Tauri] invoke:', cmd, args);
      const result = await originalInvoke?.(cmd, args);
      console.log('[Tauri] result:', result);
      return result;
    },
  };
});
```

## Performance Issues

### Tests Running Slowly

1. **Run tests in parallel:**
```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
});
```

2. **Reuse browser context:**
```typescript
test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});
```

3. **Skip unnecessary waits:**
```typescript
// Use domcontentloaded instead of networkidle when possible
await page.goto('/', { waitUntil: 'domcontentloaded' });
```

### Large Test Artifacts

1. **Only capture on failure:**
```typescript
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'on-first-retry',
}
```

2. **Limit artifact retention:**
```yaml
- uses: actions/upload-artifact@v4
  with:
    retention-days: 7  # Delete after 7 days
```

## Checklist for Preventing Flaky Tests

- [ ] No hardcoded `waitForTimeout()` calls
- [ ] Using semantic selectors (`getByRole`, `getByLabel`)
- [ ] Mocks set up before navigation
- [ ] Proper cleanup in `afterEach`/`afterAll`
- [ ] Animations disabled or waited for
- [ ] Network requests mocked or awaited
- [ ] No shared mutable state between tests
- [ ] Consistent viewport size set
- [ ] Tests independent (can run in any order)
- [ ] CI environment matches local as closely as possible
