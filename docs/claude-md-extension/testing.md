# Testing Strategy

## Playwright Testing (Mandatory)
**CRITICAL: Always verify with Playwright MCP before claiming functionality works**

```typescript
// Example test pattern
test('task creation workflow', async ({ page }) => {
  await page.goto('http://localhost:5546')

  // Create task via quick add
  await page.fill('[data-testid="quick-task-input"]', 'Test task')
  await page.press('[data-testid="quick-task-input"]', 'Enter')

  // Verify task appears
  await expect(page.locator('[data-testid="task-card"]')).toContainText('Test task')
})
```

## Vitest Unit Testing
```typescript
// Store testing example
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/stores/tasks'

describe('Task Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('creates task with default values', () => {
    const store = useTaskStore()
    const task = store.createTask({ title: 'Test' })

    expect(task.status).toBe('planned')
    expect(task.priority).toBe(null)
  })
})
```

## Development Workflow

### 1. Feature Development
```bash
# Start development
npm run dev

# Make changes following established patterns
# Test in browser at localhost:5546

# CRITICAL: Verify with Playwright
npm run test

# If tests pass, commit changes
git add .
git commit -m "feat: description"
```

### 2. Debugging Process
1. **Browser DevTools** - Check console for errors
2. **Vue DevTools** - Inspect component state and store data
3. **Playwright MCP** - Automated visual verification
4. **Network Tab** - Verify IndexedDB operations

### 3. Performance Monitoring
- **Lighthouse** - Check performance scores
- **Vue DevTools Performance** - Profile component updates
- **Bundle Analysis** - `npm run build` and analyze output
