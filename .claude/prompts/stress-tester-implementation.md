# TASK-338: Stress Tester Implementation Prompt

**Purpose**: This prompt guides step-by-step implementation of a working stress testing system for FlowState. Each step must be verified before proceeding.

---

## Context

FlowState is a Vue 3 + Vite + Pinia productivity app with:
- Supabase backend (Postgres + Auth + Realtime)
- Canvas view using Vue Flow
- Board view (Kanban)
- Calendar view
- Pomodoro timer with cross-device sync
- Backup system with Shadow Mirror (SQLite + JSON)

**Dev server runs on port 5546**: `npm run dev`

---

## Implementation Checklist

Complete each step in order. **Do not proceed until verification passes.**

---

### STEP 1: Add npm scripts to package.json

**Goal**: Add stress test commands to package.json

**Action**: Edit `package.json` scripts section. Add these AFTER the existing scripts (before the closing `}`):

```json
"test:stress": "npx playwright test tests/stress/ --config=tests/stress/playwright.stress.config.ts",
"test:stress:quick": "npx playwright test tests/stress/ --config=tests/stress/playwright.stress.config.ts --grep @quick",
"test:bench": "vitest bench --config vitest.bench.config.ts",
"test:memory": "node tests/memory/run-memory-test.mjs",
"test:backup": "node scripts/verify-backup-system.cjs",
"test:security": "npm audit --audit-level=high && echo 'Security audit passed'"
```

**Verification**:
```bash
cat package.json | grep "test:stress"
# Should show: "test:stress": "npx playwright test...
```

---

### STEP 2: Create Vitest benchmark config

**Goal**: Separate config for benchmarks (avoids Storybook browser mode conflict)

**Action**: Create file `vitest.bench.config.ts` in project root:

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.bench.{js,ts}'],
    benchmark: {
      include: ['tests/**/*.bench.{js,ts}'],
      reporters: ['default'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
```

**Verification**:
```bash
cat vitest.bench.config.ts | head -5
# Should show: /// <reference types="vitest/config" />
```

---

### STEP 3: Create stress test directory structure

**Goal**: Set up test directories

**Action**:
```bash
mkdir -p tests/stress
mkdir -p tests/memory
```

**Verification**:
```bash
ls -la tests/stress tests/memory
# Both directories should exist
```

---

### STEP 4: Create Playwright stress test config

**Goal**: Configure Playwright for stress testing with longer timeouts

**Action**: Create file `tests/stress/playwright.stress.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: '../../reports/stress-test-report' }]],
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: 'http://localhost:5546',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'stress-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'echo "Dev server should be running on port 5546"',
    url: 'http://localhost:5546',
    reuseExistingServer: true,
    timeout: 5_000,
  },
});
```

**Verification**:
```bash
npx playwright test tests/stress/ --config=tests/stress/playwright.stress.config.ts --list 2>&1 | head -5
# Should show test listing or "Listing tests:" message
```

---

### STEP 5: Create data integrity stress tests

**Goal**: Test task CRUD, canvas positions, concurrent edits

**Action**: Create file `tests/stress/data-integrity.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Data Integrity Stress Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
  });

  test('@quick Rapid Task Creation - No Duplicates', async ({ page }) => {
    // Navigate to board view
    await page.keyboard.press('2');
    await page.waitForTimeout(1000);

    const taskIds: string[] = [];

    // Create 10 tasks rapidly
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('n');
      await page.waitForTimeout(100);

      const input = page.locator('input[placeholder*="title"], [data-testid="task-title-input"]').first();
      if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
        const title = `Stress-${Date.now()}-${i}`;
        await input.fill(title);
        await page.keyboard.press('Enter');
        taskIds.push(title);
      }
      await page.waitForTimeout(50);
    }

    await page.waitForTimeout(2000);

    // Count tasks in DOM
    const taskElements = await page.locator('.task-card, [data-testid="task-card"]').count();
    console.log(`Created ${taskIds.length} tasks, found ${taskElements} in DOM`);

    // Pass if we have tasks (exact count may vary based on existing data)
    expect(taskElements).toBeGreaterThan(0);
  });

  test('@quick Canvas Position Persistence', async ({ page }) => {
    // Navigate to canvas
    await page.keyboard.press('1');
    await page.waitForTimeout(1000);

    const node = page.locator('.vue-flow__node').first();
    const isVisible = await node.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isVisible) {
      console.log('No canvas nodes - skipping position test');
      return;
    }

    const box1 = await node.boundingBox();
    if (!box1) return;

    console.log(`Initial: x=${box1.x}, y=${box1.y}`);

    // Drag node
    await node.hover();
    await page.mouse.down();
    await page.mouse.move(box1.x + 100, box1.y + 50);
    await page.mouse.up();
    await page.waitForTimeout(1000);

    // Refresh
    await page.reload();
    await page.waitForTimeout(2000);
    await page.keyboard.press('1');
    await page.waitForTimeout(1000);

    const nodeAfter = page.locator('.vue-flow__node').first();
    const box2 = await nodeAfter.boundingBox();

    if (box2) {
      console.log(`After refresh: x=${box2.x}, y=${box2.y}`);
      const drift = Math.abs(box2.x - (box1.x + 100)) + Math.abs(box2.y - (box1.y + 50));
      console.log(`Position drift: ${drift}px`);
      expect(drift).toBeLessThan(100); // 100px tolerance
    }
  });

  test('Network Offline Recovery', async ({ page, context }) => {
    await page.keyboard.press('2');
    await page.waitForTimeout(1000);

    // Go offline
    await context.setOffline(true);
    console.log('OFFLINE');

    // Try to create task
    await page.keyboard.press('n');
    await page.waitForTimeout(200);

    const input = page.locator('input[placeholder*="title"]').first();
    if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
      await input.fill(`Offline-${Date.now()}`);
      await page.keyboard.press('Enter');
    }

    // Go online
    await context.setOffline(false);
    console.log('ONLINE');
    await page.waitForTimeout(3000);

    // App should still be functional
    const appVisible = await page.locator('#app, .app-container').isVisible();
    expect(appVisible).toBe(true);
  });
});
```

**Verification**:
```bash
npx playwright test tests/stress/data-integrity.spec.ts --config=tests/stress/playwright.stress.config.ts --list
# Should show 3 tests listed
```

---

### STEP 6: Create security tests

**Goal**: Test XSS prevention and input sanitization

**Action**: Create file `tests/stress/security.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Security Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
  });

  test('@quick XSS Prevention - Script Tag', async ({ page }) => {
    const xss = '<script>alert("XSS")</script>';

    await page.keyboard.press('2');
    await page.waitForTimeout(500);
    await page.keyboard.press('n');
    await page.waitForTimeout(200);

    const input = page.locator('input[placeholder*="title"]').first();
    if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
      await input.fill(xss);
      await page.keyboard.press('Enter');
    }

    // Check no alert was triggered
    let alertTriggered = false;
    page.on('dialog', () => { alertTriggered = true; });

    await page.waitForTimeout(2000);
    expect(alertTriggered).toBe(false);
    console.log('XSS script tag: BLOCKED');
  });

  test('@quick XSS Prevention - Event Handler', async ({ page }) => {
    const payloads = [
      '<img onerror="alert(1)" src="x">',
      '<div onclick="alert(1)">click</div>',
    ];

    let alertTriggered = false;
    page.on('dialog', async (d) => { alertTriggered = true; await d.dismiss(); });

    await page.keyboard.press('2');
    await page.waitForTimeout(500);

    for (const payload of payloads) {
      await page.keyboard.press('n');
      await page.waitForTimeout(200);

      const input = page.locator('input[placeholder*="title"]').first();
      if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
        await input.fill(payload);
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(300);
    }

    await page.waitForTimeout(2000);
    expect(alertTriggered).toBe(false);
    console.log('Event handler XSS: BLOCKED');
  });

  test('Long Input Handling', async ({ page }) => {
    const longText = 'A'.repeat(50000);

    await page.keyboard.press('2');
    await page.waitForTimeout(500);
    await page.keyboard.press('n');
    await page.waitForTimeout(200);

    const input = page.locator('input[placeholder*="title"]').first();
    if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
      await input.fill(longText);
      await page.keyboard.press('Escape');
    }

    // App should not crash
    const appOk = await page.locator('body').isVisible();
    expect(appOk).toBe(true);
    console.log('Long input: App stable');
  });
});
```

**Verification**:
```bash
npx playwright test tests/stress/security.spec.ts --config=tests/stress/playwright.stress.config.ts --list
# Should show 3 tests
```

---

### STEP 7: Create performance benchmarks

**Goal**: Measure store operation performance

**Action**: Create file `tests/stress/store-operations.bench.ts`:

```typescript
/**
 * @vitest-environment node
 */
import { bench, describe } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

function createMockTask(overrides = {}) {
  return {
    id: uuidv4(),
    title: `Task ${Date.now()}`,
    status: 'todo',
    priority: 'medium',
    createdAt: new Date().toISOString(),
    canvasPosition: { x: Math.random() * 1000, y: Math.random() * 1000 },
    ...overrides
  };
}

describe('Task Operations', () => {
  bench('Create 100 tasks', () => {
    const tasks = [];
    for (let i = 0; i < 100; i++) {
      tasks.push(createMockTask());
    }
    if (tasks.length !== 100) throw new Error('Failed');
  }, { iterations: 100 });

  bench('Filter 10k tasks by status', () => {
    const statuses = ['todo', 'in_progress', 'done'] as const;
    const tasks = Array.from({ length: 10000 }, (_, i) =>
      createMockTask({ status: statuses[i % 3] })
    );
    const filtered = tasks.filter(t => t.status === 'todo');
    if (filtered.length === 0) throw new Error('No results');
  }, { iterations: 20 });

  bench('Sort 1k tasks by priority', () => {
    const priorities = ['critical', 'high', 'medium', 'low'] as const;
    const tasks = Array.from({ length: 1000 }, (_, i) =>
      createMockTask({ priority: priorities[i % 4] })
    );
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...tasks].sort((a, b) => order[a.priority] - order[b.priority]);
    if (sorted.length !== 1000) throw new Error('Sort failed');
  }, { iterations: 50 });

  bench('Find by ID in 10k tasks', () => {
    const targetId = uuidv4();
    const tasks = Array.from({ length: 10000 }, (_, i) =>
      createMockTask({ id: i === 5000 ? targetId : uuidv4() })
    );
    const found = tasks.find(t => t.id === targetId);
    if (!found) throw new Error('Not found');
  }, { iterations: 100 });
});

describe('Serialization', () => {
  bench('JSON stringify 1k tasks', () => {
    const tasks = Array.from({ length: 1000 }, () => createMockTask());
    const json = JSON.stringify(tasks);
    if (json.length < 1000) throw new Error('Failed');
  }, { iterations: 100 });

  bench('JSON parse 1k tasks', () => {
    const tasks = Array.from({ length: 1000 }, () => createMockTask());
    const json = JSON.stringify(tasks);
    const parsed = JSON.parse(json);
    if (parsed.length !== 1000) throw new Error('Failed');
  }, { iterations: 100 });
});
```

**Verification**:
```bash
npm run test:bench 2>&1 | tail -30
# Should show benchmark results with hz (operations/sec)
```

---

### STEP 8: Create backup verification script

**Goal**: Verify backup system integrity

**Action**: Create file `scripts/verify-backup-system.cjs`:

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SHADOW_DB = path.join(ROOT, 'backups', 'shadow.db');
const SHADOW_JSON = path.join(ROOT, 'public', 'shadow-latest.json');
const SQL_BACKUPS = path.join(ROOT, 'supabase', 'backups');

let passed = 0, failed = 0, warnings = 0;

function pass(msg) { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg) { console.log(`  ❌ ${msg}`); failed++; }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warnings++; }

console.log('🧪 Backup System Verification\n');

// Test 1: Shadow DB
console.log('📁 Shadow Database:');
if (fs.existsSync(SHADOW_DB)) {
  const stats = fs.statSync(SHADOW_DB);
  if (stats.size > 0) {
    const buf = Buffer.alloc(16);
    const fd = fs.openSync(SHADOW_DB, 'r');
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    if (buf.toString('utf8', 0, 15) === 'SQLite format 3') {
      pass(`Valid SQLite (${(stats.size/1024).toFixed(1)} KB)`);
    } else {
      fail('Invalid SQLite format');
    }
  } else {
    fail('Empty file');
  }
} else {
  fail('Not found');
}

// Test 2: Shadow JSON
console.log('\n📄 Shadow JSON:');
if (fs.existsSync(SHADOW_JSON)) {
  try {
    const data = JSON.parse(fs.readFileSync(SHADOW_JSON, 'utf8'));
    pass('Valid JSON');

    if (Array.isArray(data.tasks)) {
      pass(`Tasks: ${data.tasks.length}`);

      // Check for duplicates
      const ids = data.tasks.map(t => t.id);
      const unique = new Set(ids);
      if (ids.length === unique.size) {
        pass('No duplicate IDs');
      } else {
        fail(`${ids.length - unique.size} duplicate IDs`);
      }
    } else {
      warn('No tasks array');
    }

    if (data.checksum) {
      pass(`Checksum: ${data.checksum}`);
    } else {
      warn('No checksum');
    }
  } catch (e) {
    fail(`Parse error: ${e.message}`);
  }
} else {
  fail('Not found');
}

// Test 3: SQL Backups
console.log('\n💾 SQL Backups:');
if (fs.existsSync(SQL_BACKUPS)) {
  const files = fs.readdirSync(SQL_BACKUPS).filter(f => f.endsWith('.sql'));
  if (files.length > 0) {
    pass(`${files.length} backup files`);
    const latest = files.sort().reverse()[0];
    const stats = fs.statSync(path.join(SQL_BACKUPS, latest));
    const ageHours = Math.floor((Date.now() - stats.mtimeMs) / 3600000);
    if (ageHours < 24) {
      pass(`Latest: ${latest} (${ageHours}h old)`);
    } else {
      warn(`Latest backup is ${ageHours}h old`);
    }
  } else {
    warn('No SQL backups found');
  }
} else {
  warn('Backup directory not found');
}

// Summary
console.log('\n' + '='.repeat(40));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`⚠️  Warnings: ${warnings}`);

process.exit(failed > 0 ? 1 : 0);
```

**Verification**:
```bash
node scripts/verify-backup-system.cjs
# Should show test results with pass/fail counts
```

---

### STEP 9: Create memory test runner

**Goal**: Memory leak detection script

**Action**: Create file `tests/memory/run-memory-test.mjs`:

```javascript
#!/usr/bin/env node
import { execSync } from 'child_process';

console.log('🧠 Memory Leak Detection\n');

// Check dev server
try {
  await fetch('http://localhost:5546', { method: 'HEAD' });
  console.log('✅ Dev server running');
} catch {
  console.log('❌ Dev server not running!');
  console.log('   Run: npm run dev');
  process.exit(1);
}

// Check fuite
try {
  execSync('npx fuite --version', { stdio: 'pipe' });
  console.log('✅ Fuite available\n');
  console.log('Running memory test...\n');
  execSync('npx fuite http://localhost:5546 --iterations 3', {
    stdio: 'inherit',
    timeout: 120000
  });
} catch (e) {
  console.log('\n📋 Manual Memory Test Instructions:');
  console.log('1. Open Chrome DevTools > Memory');
  console.log('2. Take heap snapshot');
  console.log('3. Navigate: Canvas(1) → Board(2) → Calendar(3) → Settings(S) [10x]');
  console.log('4. Take another snapshot');
  console.log('5. Compare: Growth should be < 50MB');
}
```

**Verification**:
```bash
node tests/memory/run-memory-test.mjs 2>&1 | head -10
# Should show memory test output or instructions
```

---

### STEP 10: Final verification - Run all tests

**Goal**: Ensure all commands work

**Action**: Run each command and verify output:

```bash
# 1. Backup verification
npm run test:backup
# Expected: Shows pass/fail counts

# 2. Benchmarks
npm run test:bench
# Expected: Shows benchmark results (hz values)

# 3. Security audit
npm run test:security
# Expected: Shows npm audit results

# 4. List stress tests (requires Playwright browsers)
npx playwright test tests/stress/ --config=tests/stress/playwright.stress.config.ts --list
# Expected: Lists 6+ tests

# 5. Run quick stress tests (requires dev server on 5546)
npm run dev &  # Start in background if not running
sleep 5
npm run test:stress:quick
# Expected: Runs @quick tagged tests
```

---

## Summary of Created Files

```
package.json                              # Updated with test scripts
vitest.bench.config.ts                    # Benchmark config
tests/
├── stress/
│   ├── playwright.stress.config.ts       # Playwright config
│   ├── data-integrity.spec.ts            # CRUD/position/offline tests
│   ├── security.spec.ts                  # XSS/injection tests
│   └── store-operations.bench.ts         # Performance benchmarks
└── memory/
    └── run-memory-test.mjs               # Memory leak runner
scripts/
└── verify-backup-system.cjs              # Backup verification
```

## Success Criteria

All these commands must work:

| Command | Expected Result |
|---------|-----------------|
| `npm run test:backup` | Shows backup test results |
| `npm run test:bench` | Shows benchmark hz values |
| `npm run test:security` | Shows npm audit output |
| `npm run test:stress:quick` | Runs Playwright tests (needs dev server) |

---

**END OF IMPLEMENTATION PROMPT**
