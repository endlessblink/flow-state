# Tauri v2 Testing Patterns Reference

Common test patterns for Tauri v2 applications with Playwright.

## E2E Test Patterns

### Form Submission with Validation

```typescript
test('submit form with validation', async ({ page }) => {
  // Fill required fields
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'SecurePass123!');

  // Submit form
  const submitPromise = page.waitForURL('**/dashboard');
  await page.click('button[type="submit"]');

  // Wait for navigation
  await submitPromise;
  expect(page.url()).toContain('/dashboard');
});

test('show validation errors', async ({ page }) => {
  // Submit empty form
  await page.click('button[type="submit"]');

  // Verify error messages
  await expect(page.getByText(/email is required/i)).toBeVisible();
  await expect(page.getByText(/password is required/i)).toBeVisible();
});
```

### Loading States

```typescript
test('show loading indicator during async operation', async ({ page }) => {
  // Mock slow command
  await page.addInitScript(() => {
    window.__TAURI_CORE__ = {
      invoke: async (cmd: string) => {
        if (cmd === 'fetch_data') {
          await new Promise(r => setTimeout(r, 1000));
          return { items: ['a', 'b', 'c'] };
        }
      },
    };
  });

  await page.goto('/');

  // Trigger action
  await page.click('button[name="fetch"]');

  // Verify loading state
  await expect(page.getByTestId('loading-spinner')).toBeVisible();

  // Verify loading completes
  await expect(page.getByTestId('loading-spinner')).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByText('a')).toBeVisible();
});
```

### Error Handling

```typescript
test('display error message on command failure', async ({ page }) => {
  await page.addInitScript(() => {
    window.__TAURI_CORE__ = {
      invoke: async (cmd: string) => {
        if (cmd === 'save_data') {
          throw new Error('Network error: Connection refused');
        }
      },
    };
  });

  await page.goto('/');
  await page.click('button[name="save"]');

  // Verify error message
  await expect(page.getByRole('alert')).toContainText(/network error/i);
});
```

### Navigation and Routing

```typescript
test('navigate between pages', async ({ page }) => {
  await page.goto('/');

  // Click navigation link
  await page.click('a[href="/settings"]');

  // Verify new page
  expect(page.url()).toContain('/settings');
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

  // Go back
  await page.goBack();
  expect(page.url()).not.toContain('/settings');
});
```

### Data Tables

```typescript
test('table operations', async ({ page }) => {
  await page.goto('/tasks');

  // Count rows
  const rows = page.locator('tbody tr');
  const initialCount = await rows.count();
  expect(initialCount).toBeGreaterThan(0);

  // Get cell value
  const firstRowEmail = rows.first().locator('td:nth-child(2)');
  await expect(firstRowEmail).toContainText('@');

  // Click action button
  await rows.first().getByRole('button', { name: /delete/i }).click();

  // Confirm deletion
  await page.getByRole('button', { name: /confirm/i }).click();

  // Verify row removed
  await expect(rows).toHaveCount(initialCount - 1);
});
```

### Modal Dialogs

```typescript
test('modal interactions', async ({ page }) => {
  await page.goto('/');

  // Open modal
  await page.click('button[name="open-modal"]');

  // Wait for modal
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible();

  // Fill modal form
  await modal.getByLabel(/name/i).fill('John Doe');
  await modal.getByLabel(/email/i).fill('john@example.com');

  // Submit modal
  await modal.getByRole('button', { name: /save/i }).click();

  // Verify modal closes
  await expect(modal).not.toBeVisible();

  // Verify data saved
  await expect(page.getByText('John Doe')).toBeVisible();
});
```

### localStorage Persistence

```typescript
test('persist state in localStorage', async ({ page }) => {
  await page.goto('/');

  // Change setting
  await page.click('[data-testid="theme-toggle"]');

  // Verify stored
  const theme = await page.evaluate(() => localStorage.getItem('theme'));
  expect(theme).toBe('dark');

  // Reload page
  await page.reload();

  // Verify persisted
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
```

### Keyboard Shortcuts

```typescript
test('keyboard shortcuts', async ({ page }) => {
  await page.goto('/');

  // Create task with shortcut
  await page.keyboard.press('Control+N');
  await expect(page.getByRole('dialog', { name: /new task/i })).toBeVisible();

  // Close with Escape
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // Save with Ctrl+S
  await page.fill('[data-testid="task-input"]', 'New Task');
  await page.keyboard.press('Control+S');
  await expect(page.getByText(/saved/i)).toBeVisible();
});
```

### Drag and Drop

```typescript
test('drag and drop task', async ({ page }) => {
  await page.goto('/board');

  const task = page.locator('[data-testid="task-card"]:has-text("Task 1")');
  const targetColumn = page.locator('[data-testid="column-done"]');

  // Drag task to Done column
  await task.dragTo(targetColumn);

  // Verify task moved
  await expect(targetColumn.locator('[data-testid="task-card"]:has-text("Task 1")')).toBeVisible();
});
```

### File Operations (Mocked)

```typescript
test('save and load file', async ({ page }) => {
  let savedContent = '';

  await page.addInitScript(() => {
    window.__TAURI_FS__ = {
      writeTextFile: async (path: string, content: string) => {
        (window as any).__savedFile__ = { path, content };
      },
      readTextFile: async (path: string) => {
        return (window as any).__savedFile__?.content || '';
      },
    };
  });

  await page.goto('/');

  // Type content
  await page.fill('textarea', 'Hello, World!');

  // Save file
  await page.click('button[name="save"]');
  await expect(page.getByText(/saved/i)).toBeVisible();

  // Clear and reload
  await page.fill('textarea', '');
  await page.click('button[name="open"]');

  // Verify content restored
  await expect(page.locator('textarea')).toHaveValue('Hello, World!');
});
```

### Screenshot Comparison

```typescript
test('visual regression', async ({ page }) => {
  await page.goto('/');

  // Wait for animations to complete
  await page.waitForTimeout(500);

  // Compare screenshot
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixels: 100,
  });
});
```

## Unit Test Patterns

### Vue Component Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TaskCard from '@/components/TaskCard.vue';

describe('TaskCard', () => {
  const defaultProps = {
    task: {
      id: '1',
      title: 'Test Task',
      completed: false,
    },
  };

  it('renders task title', () => {
    const wrapper = mount(TaskCard, { props: defaultProps });
    expect(wrapper.text()).toContain('Test Task');
  });

  it('emits complete event on checkbox click', async () => {
    const wrapper = mount(TaskCard, { props: defaultProps });
    await wrapper.find('input[type="checkbox"]').setValue(true);
    expect(wrapper.emitted('complete')).toBeTruthy();
    expect(wrapper.emitted('complete')![0]).toEqual(['1']);
  });

  it('shows completed styling when task is done', () => {
    const wrapper = mount(TaskCard, {
      props: {
        task: { ...defaultProps.task, completed: true },
      },
    });
    expect(wrapper.classes()).toContain('completed');
  });
});
```

### Composable Testing

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLocalStorage } from '@/composables/useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default value when key does not exist', () => {
    const { value } = useLocalStorage('key', 'default');
    expect(value.value).toBe('default');
  });

  it('saves value to localStorage', () => {
    const { value } = useLocalStorage('key', 'default');
    value.value = 'new value';
    expect(localStorage.getItem('key')).toBe('"new value"');
  });

  it('loads existing value from localStorage', () => {
    localStorage.setItem('key', '"existing"');
    const { value } = useLocalStorage('key', 'default');
    expect(value.value).toBe('existing');
  });
});
```

### Pinia Store Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTaskStore } from '@/stores/tasks';

describe('Task Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('adds task', () => {
    const store = useTaskStore();
    store.addTask({ title: 'New Task' });
    expect(store.tasks).toHaveLength(1);
    expect(store.tasks[0].title).toBe('New Task');
  });

  it('completes task', () => {
    const store = useTaskStore();
    store.addTask({ title: 'Task' });
    const taskId = store.tasks[0].id;
    store.completeTask(taskId);
    expect(store.tasks[0].completed).toBe(true);
  });

  it('filters active tasks', () => {
    const store = useTaskStore();
    store.addTask({ title: 'Active' });
    store.addTask({ title: 'Done', completed: true });
    expect(store.activeTasks).toHaveLength(1);
    expect(store.activeTasks[0].title).toBe('Active');
  });
});
```

## Page Object Pattern

### Base Page Object

```typescript
// src/tests/e2e/pages/BasePage.ts
import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('[data-v-app]');
  }

  async getNotification(): Promise<Locator> {
    return this.page.locator('[role="alert"]');
  }

  async expectNotification(text: string | RegExp): Promise<void> {
    await expect(this.page.locator('[role="alert"]')).toContainText(text);
  }
}
```

### Specific Page Object

```typescript
// src/tests/e2e/pages/TaskPage.ts
import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class TaskPage extends BasePage {
  private taskInput = 'input[placeholder="Enter task"]';
  private addButton = 'button:has-text("Add")';
  private taskList = '[data-testid="task-list"]';

  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/tasks');
    await this.waitForPageLoad();
  }

  async addTask(title: string): Promise<void> {
    await this.page.fill(this.taskInput, title);
    await this.page.click(this.addButton);
    await this.page.waitForSelector(`[data-testid="task"]:has-text("${title}")`);
  }

  async getTaskCount(): Promise<number> {
    return this.page.locator('[data-testid="task"]').count();
  }

  async completeTask(title: string): Promise<void> {
    const task = this.page.locator(`[data-testid="task"]:has-text("${title}")`);
    await task.getByRole('button', { name: /complete/i }).click();
  }

  async deleteTask(title: string): Promise<void> {
    const task = this.page.locator(`[data-testid="task"]:has-text("${title}")`);
    await task.getByRole('button', { name: /delete/i }).click();
  }

  async expectTaskExists(title: string): Promise<void> {
    await expect(
      this.page.locator(`[data-testid="task"]:has-text("${title}")`)
    ).toBeVisible();
  }

  async expectTaskNotExists(title: string): Promise<void> {
    await expect(
      this.page.locator(`[data-testid="task"]:has-text("${title}")`)
    ).not.toBeVisible();
  }
}
```

### Using Page Objects in Tests

```typescript
// src/tests/e2e/tasks.spec.ts
import { test, expect } from '@playwright/test';
import { TaskPage } from './pages/TaskPage';

test.describe('Task Management', () => {
  let taskPage: TaskPage;

  test.beforeEach(async ({ page }) => {
    taskPage = new TaskPage(page);
    await taskPage.goto();
  });

  test('create and complete task', async () => {
    await taskPage.addTask('Buy groceries');
    await taskPage.expectTaskExists('Buy groceries');

    await taskPage.completeTask('Buy groceries');
    await taskPage.expectNotification(/completed/i);
  });

  test('delete task', async () => {
    await taskPage.addTask('Temporary task');
    await taskPage.deleteTask('Temporary task');
    await taskPage.expectTaskNotExists('Temporary task');
  });
});
```
