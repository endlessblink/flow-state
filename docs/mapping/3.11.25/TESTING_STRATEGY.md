# Pomo-Flow - Testing Strategy and Quality Assurance

## Overview

This comprehensive testing strategy document outlines the complete testing approach for the Pomo-Flow Vue.js productivity application. It covers unit testing, integration testing, end-to-end testing, visual testing, performance testing, and quality assurance processes to ensure reliable, high-quality software delivery.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Testing Architecture](#testing-architecture)
- [Unit Testing Strategy](#unit-testing-strategy)
- [Integration Testing](#integration-testing)
- [End-to-End Testing](#end-to-end-testing)
- [Visual Testing](#visual-testing)
- [Performance Testing](#performance-testing)
- [Accessibility Testing](#accessibility-testing)
- [Mobile Testing](#mobile-testing)
- [Security Testing](#security-testing)
- [Quality Assurance Process](#quality-assurance-process)
- [Testing Tools and Configuration](#testing-tools-and-configuration)
- [Test Data Management](#test-data-management)
- [Continuous Integration](#continuous-integration)

---

## 🎯 Testing Philosophy

### 1. Testing Pyramid Approach

```
           E2E Tests (5%)
         ─────────────────
       Integration Tests (15%)
     ─────────────────────────
   Unit Tests (80%)
 ─────────────────────────────────
```

- **Unit Tests (80%)**: Fast, isolated tests for individual functions and components
- **Integration Tests (15%)**: Tests for component interactions and data flow
- **E2E Tests (5%)**: Critical user journey tests across the entire application

### 2. Quality Gates

| Gate Type | Criteria | Automation Level |
|-----------|----------|------------------|
| **Pre-commit** | Linting, TypeScript compilation, unit tests | 100% Automated |
| **Pre-push** | Integration tests, visual regression | 100% Automated |
| **Pre-deployment** | E2E tests, performance tests | 95% Automated |
| **Production** | Monitoring, smoke tests | 90% Automated |

### 3. Testing Principles

- **Test Early, Test Often**: Shift left testing approach
- **Comprehensive Coverage**: All critical paths must be tested
- **Maintainable Tests**: Tests should be readable and maintainable
- **Fast Feedback**: Test results should be available quickly
- **Realistic Scenarios**: Tests should reflect real user behavior

---

## 🏗️ Testing Architecture

### 1. Test Directory Structure

```
src/
├── __tests__/                # Unit tests near source code
│   ├── components/
│   ├── composables/
│   ├── stores/
│   └── utils/
tests/
├── e2e/                     # End-to-end tests
│   ├── auth/
│   ├── tasks/
│   ├── calendar/
│   └── canvas/
├── integration/             # Integration tests
│   ├── component-interactions/
│   ├── store-integration/
│   └── api-integration/
├── visual/                 # Visual regression tests
│   ├── components/
│   └── views/
├── performance/            # Performance tests
│   ├── load/
│   └── stress/
├── accessibility/          # Accessibility tests
├── fixtures/              # Test data and fixtures
│   ├── tasks.json
│   ├── projects.json
│   └── users.json
└── helpers/               # Test utilities and helpers
    ├── test-utils.ts
    ├── mock-data.ts
    └── custom-matchers.ts
```

### 2. Test Categories

| Category | Purpose | Tools | Frequency |
|----------|---------|-------|-----------|
| **Unit Tests** | Test individual functions/components | Vitest, Vue Test Utils | Every commit |
| **Component Tests** | Test component behavior | Vitest, Vue Test Utils | Every commit |
| **Integration Tests** | Test component interactions | Vitest, Vue Test Utils | Every PR |
| **E2E Tests** | Test user workflows | Playwright | Every build |
| **Visual Tests** | Test visual appearance | Playwright, Storybook | Every PR |
| **Performance Tests** | Test performance metrics | Lighthouse, Vitest | Weekly |
| **Accessibility Tests** | Test a11y compliance | Axe-core, Playwright | Every PR |

---

## 🧪 Unit Testing Strategy

### 1. Component Testing

#### TaskCard Component Tests

```typescript
// src/components/kanban/__tests__/TaskCard.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import TaskCard from '../TaskCard.vue'
import { useTaskStore } from '@/stores/tasks'

describe('TaskCard', () => {
  let wrapper: any
  let taskStore: any

  beforeEach(() => {
    const pinia = createPinia()
    taskStore = useTaskStore(pinia)

    wrapper = mount(TaskCard, {
      props: {
        task: {
          id: 'test-task-1',
          title: 'Test Task',
          description: 'Test Description',
          status: 'planned',
          priority: 'medium',
          progress: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      global: {
        plugins: [pinia]
      }
    })
  })

  it('renders task title correctly', () => {
    expect(wrapper.find('.task-title').text()).toBe('Test Task')
  })

  it('emits update event when task is edited', async () => {
    await wrapper.find('[data-testid="edit-button"]').trigger('click')
    await wrapper.find('[data-testid="task-input"]').setValue('Updated Task')
    await wrapper.find('[data-testid="save-button"]').trigger('click')

    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')[0][0]).toMatchObject({
      id: 'test-task-1',
      title: 'Updated Task'
    })
  })

  it('handles drag start correctly', async () => {
    await wrapper.find('[data-testid="task-card"]').trigger('dragstart', {
      dataTransfer: new DataTransfer()
    })

    expect(wrapper.emitted('dragstart')).toBeTruthy()
  })

  it('shows correct priority badge', () => {
    const priorityBadge = wrapper.find('.priority-badge')
    expect(priorityBadge.text()).toContain('Medium')
    expect(priorityBadge.classes()).toContain('priority-medium')
  })

  it('displays progress correctly', () => {
    const progressBar = wrapper.find('.progress-bar')
    expect(progressBar.attributes('style')).toContain('width: 0%')
  })
})
```

#### Timer Component Tests

```typescript
// src/components/timer/__tests__/PomodoroTimer.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PomodoroTimer from '../PomodoroTimer.vue'
import { useTimerStore } from '@/stores/timer'

// Mock audio context
global.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn().mockReturnValue({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    gain: { value: 1 }
  }),
  destination: {}
}))

describe('PomodoroTimer', () => {
  let wrapper: any
  let timerStore: any

  beforeEach(() => {
    vi.useFakeTimers()
    const pinia = createPinia()
    timerStore = useTimerStore(pinia)

    wrapper = mount(PomodoroTimer, {
      global: {
        plugins: [pinia]
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('displays initial time correctly', () => {
    expect(wrapper.find('.timer-display').text()).toBe('25:00')
  })

  it('starts timer when start button is clicked', async () => {
    await wrapper.find('[data-testid="start-button"]').trigger('click')

    expect(timerStore.isRunning).toBe(true)

    // Advance time by 1 second
    vi.advanceTimersByTime(1000)

    expect(wrapper.find('.timer-display').text()).toBe('24:59')
  })

  it('pauses timer when pause button is clicked', async () => {
    await wrapper.find('[data-testid="start-button"]').trigger('click')
    await wrapper.find('[data-testid="pause-button"]').trigger('click')

    expect(timerStore.isRunning).toBe(false)
  })

  it('completes pomodoro session correctly', async () => {
    await wrapper.find('[data-testid="start-button"]').trigger('click')

    // Advance time by 25 minutes
    vi.advanceTimersByTime(25 * 60 * 1000)

    expect(timerStore.isRunning).toBe(false)
    expect(timerStore.completedPomodoros).toBe(1)
  })

  it('plays sound when pomodoro completes', async () => {
    const playSoundSpy = vi.spyOn(wrapper.vm, 'playCompletionSound')

    await wrapper.find('[data-testid="start-button"]').trigger('click')
    vi.advanceTimersByTime(25 * 60 * 1000)

    expect(playSoundSpy).toHaveBeenCalled()
  })
})
```

### 2. Composable Testing

#### useDragAndDrop Tests

```typescript
// src/composables/__tests__/useDragAndDrop.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useDragAndDrop } from '../useDragAndDrop'

describe('useDragAndDrop', () => {
  let container: Ref<HTMLElement>
  let draggedItem: Ref<any>

  beforeEach(() => {
    container = ref(document.createElement('div'))
    draggedItem = ref(null)
  })

  it('initializes with correct default values', () => {
    const { isDragging, dragPosition } = useDragAndDrop(container, draggedItem)

    expect(isDragging.value).toBe(false)
    expect(dragPosition.value).toEqual({ x: 0, y: 0 })
  })

  it('updates drag position on mouse move', () => {
    const { isDragging, dragPosition, handleMouseDown } = useDragAndDrop(container, draggedItem)

    draggedItem.value = { id: 'test-item' }

    // Simulate mouse down
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100
    })
    handleMouseDown(mouseDownEvent)

    expect(isDragging.value).toBe(true)

    // Simulate mouse move
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 150,
      clientY: 120
    })
    document.dispatchEvent(mouseMoveEvent)

    expect(dragPosition.value).toEqual({ x: 150, y: 120 })
  })

  it('emits drop event when mouse is released', () => {
    const { isDragging, handleMouseDown, handleMouseUp } = useDragAndDrop(container, draggedItem)

    draggedItem.value = { id: 'test-item' }

    const dropSpy = vi.fn()
    window.addEventListener('drop', dropSpy)

    // Start drag
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100
    })
    handleMouseDown(mouseDownEvent)

    // End drag
    const mouseUpEvent = new MouseEvent('mouseup', {
      clientX: 150,
      clientY: 120
    })
    handleMouseUp(mouseUpEvent)

    expect(isDragging.value).toBe(false)
    window.removeEventListener('drop', dropSpy)
  })
})
```

### 3. Store Testing

#### Task Store Tests

```typescript
// src/stores/__tests__/tasks.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '../tasks'

describe('Task Store', () => {
  let taskStore: any

  beforeEach(() => {
    setActivePinia(createPinia())
    taskStore = useTaskStore()
  })

  it('creates task with correct default values', () => {
    const task = taskStore.createTask({ title: 'Test Task' })

    expect(task).toMatchObject({
      title: 'Test Task',
      status: 'planned',
      priority: null,
      progress: 0,
      completedPomodoros: 0,
      subtasks: []
    })
    expect(task.id).toBeDefined()
    expect(task.createdAt).toBeInstanceOf(Date)
  })

  it('updates task correctly', () => {
    const task = taskStore.createTask({ title: 'Test Task' })

    taskStore.updateTask(task.id, {
      status: 'in_progress',
      progress: 50
    })

    const updatedTask = taskStore.getTask(task.id)
    expect(updatedTask.status).toBe('in_progress')
    expect(updatedTask.progress).toBe(50)
  })

  it('deletes task correctly', () => {
    const task = taskStore.createTask({ title: 'Test Task' })
    const taskId = task.id

    taskStore.deleteTask(taskId)

    expect(taskStore.getTask(taskId)).toBeUndefined()
  })

  it('filters tasks correctly', () => {
    const task1 = taskStore.createTask({ title: 'Task 1', status: 'planned' })
    const task2 = taskStore.createTask({ title: 'Task 2', status: 'done' })
    const task3 = taskStore.createTask({ title: 'Task 3', status: 'in_progress' })

    const activeTasks = taskStore.activeTasks
    expect(activeTasks).toHaveLength(2)
    expect(activeTasks.map(t => t.id)).toContain(task1.id)
    expect(activeTasks.map(t => t.id)).toContain(task3.id)
    expect(activeTasks.map(t => t.id)).not.toContain(task2.id)
  })

  it('groups tasks by project correctly', () => {
    const project1 = 'project-1'
    const project2 = 'project-2'

    const task1 = taskStore.createTask({ title: 'Task 1', projectId: project1 })
    const task2 = taskStore.createTask({ title: 'Task 2', projectId: project1 })
    const task3 = taskStore.createTask({ title: 'Task 3', projectId: project2 })

    const tasksByProject = taskStore.tasksByProject

    expect(tasksByProject.get(project1)).toHaveLength(2)
    expect(tasksByProject.get(project2)).toHaveLength(1)
  })
})
```

---

## 🔗 Integration Testing

### 1. Component Integration Tests

#### Drag and Drop Integration

```typescript
// tests/integration/component-interactions/drag-drop.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import BoardView from '@/views/BoardView.vue'
import TaskCard from '@/components/kanban/TaskCard.vue'
import KanbanColumn from '@/components/kanban/KanbanColumn.vue'

describe('Drag and Drop Integration', () => {
  let wrapper: any
  let pinia: any

  beforeEach(() => {
    pinia = createPinia()
    wrapper = mount(BoardView, {
      global: {
        plugins: [pinia],
        stubs: ['font-awesome-icon']
      }
    })
  })

  it('can drag task between columns', async () => {
    // Wait for tasks to load
    await wrapper.vm.$nextTick()

    const sourceColumn = wrapper.find('[data-testid="column-planned"]')
    const targetColumn = wrapper.find('[data-testid="column-in-progress"]')
    const taskCard = sourceColumn.find('[data-testid="task-card"]')

    // Start drag
    await taskCard.trigger('dragstart', {
      dataTransfer: new DataTransfer()
    })

    // Drag over target column
    await targetColumn.trigger('dragover', {
      dataTransfer: new DataTransfer()
    })

    // Drop on target column
    await targetColumn.trigger('drop', {
      dataTransfer: new DataTransfer()
    })

    // Verify task moved
    expect(targetColumn.find('[data-testid="task-card"]').exists()).toBe(true)
    expect(sourceColumn.find('[data-testid="task-card"]').exists()).toBe(false)
  })

  it('updates task status when dropped in correct column', async () => {
    const taskStore = useTaskStore(pinia)
    const task = taskStore.createTask({ title: 'Test Task', status: 'planned' })

    const plannedColumn = wrapper.find('[data-testid="column-planned"]')
    const inProgressColumn = wrapper.find('[data-testid="column-in-progress"]')
    const taskCard = plannedColumn.find(`[data-task-id="${task.id}"]`)

    // Simulate drag and drop
    await taskCard.trigger('dragstart')
    await inProgressColumn.trigger('drop')

    // Verify task status updated
    const updatedTask = taskStore.getTask(task.id)
    expect(updatedTask.status).toBe('in_progress')
  })
})
```

### 2. Store Integration Tests

#### Firebase Integration Tests

```typescript
// tests/integration/store-integration/firebase.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'

// Mock Firebase
vi.mock('@/config/firebase', () => ({
  firestore: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      })),
      add: vi.fn(),
      where: vi.fn(),
      get: vi.fn()
    }))
  },
  auth: {
    currentUser: { uid: 'test-user-id' }
  }
}))

describe('Firebase Integration', () => {
  let taskStore: any
  let authStore: any

  beforeEach(async () => {
    setActivePinia(createPinia())
    authStore = useAuthStore()
    taskStore = useTaskStore()

    // Mock authenticated user
    authStore.user = { uid: 'test-user-id' }
  })

  it('saves task to Firebase', async () => {
    const task = taskStore.createTask({ title: 'Test Task' })

    expect(task).toBeDefined()
    expect(task.id).toBeDefined()
    // Verify Firebase save was called
    expect(firestore.collection).toHaveBeenCalledWith('users')
  })

  it('loads tasks from Firebase', async () => {
    await taskStore.loadTasks()

    expect(taskStore.tasks).toBeInstanceOf(Array)
    // Verify Firebase get was called
    expect(firestore.collection).toHaveBeenCalledWith('users')
  })

  it('handles Firebase errors gracefully', async () => {
    // Mock Firebase error
    vi.mocked(firestore.collection).mockImplementationOnce(() => {
      throw new Error('Firebase connection failed')
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await taskStore.saveTasks()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save tasks to Firebase'),
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })
})
```

---

## 🎭 End-to-End Testing

### 1. User Journey Tests

#### Task Management Workflow

```typescript
// tests/e2e/tasks/task-management.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Task Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546')

    // Login (if authentication is required)
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')

    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="board-view"]')
  })

  test('should create, edit, and delete a task', async ({ page }) => {
    // Create task
    await page.click('[data-testid="quick-add-button"]')
    await page.fill('[data-testid="task-title-input"]', 'E2E Test Task')
    await page.fill('[data-testid="task-description-input"]', 'This is a test task created by E2E test')
    await page.click('[data-testid="create-task-button"]')

    // Verify task created
    await expect(page.locator('[data-testid="task-card"]').filter({ hasText: 'E2E Test Task' })).toBeVisible()

    // Edit task
    await page.locator('[data-testid="task-card"]').filter({ hasText: 'E2E Test Task' }).hover()
    await page.click('[data-testid="edit-task-button"]')
    await page.fill('[data-testid="task-title-input"]', 'E2E Test Task - Edited')
    await page.click('[data-testid="save-task-button"]')

    // Verify task edited
    await expect(page.locator('[data-testid="task-card"]').filter({ hasText: 'E2E Test Task - Edited' })).toBeVisible()
    await expect(page.locator('[data-testid="task-card"]').filter({ hasText: 'E2E Test Task' })).not.toBeVisible()

    // Delete task
    await page.locator('[data-testid="task-card"]').filter({ hasText: 'E2E Test Task - Edited' }).hover()
    await page.click('[data-testid="delete-task-button"]')
    await page.click('[data-testid="confirm-delete-button"]')

    // Verify task deleted
    await expect(page.locator('[data-testid="task-card"]').filter({ hasText: 'E2E Test Task - Edited' })).not.toBeVisible()
  })

  test('should drag and drop task between columns', async ({ page }) => {
    // Create a test task
    await page.click('[data-testid="quick-add-button"]')
    await page.fill('[data-testid="task-title-input"]', 'Drag Test Task')
    await page.click('[data-testid="create-task-button"]')

    // Get initial column counts
    const plannedColumn = page.locator('[data-testid="column-planned"]')
    const inProgressColumn = page.locator('[data-testid="column-in-progress"]')

    const initialPlannedCount = await plannedColumn.locator('[data-testid="task-card"]').count()
    const initialInProgressCount = await inProgressColumn.locator('[data-testid="task-card"]').count()

    // Drag task from Planned to In Progress
    const taskCard = plannedColumn.locator('[data-testid="task-card"]').filter({ hasText: 'Drag Test Task' })

    await taskCard.dragTo(inProgressColumn)

    // Verify task moved
    await expect(plannedColumn.locator('[data-testid="task-card"]')).toHaveCount(initialPlannedCount - 1)
    await expect(inProgressColumn.locator('[data-testid="task-card"]')).toHaveCount(initialInProgressCount + 1)
    await expect(inProgressColumn.locator('[data-testid="task-card"]').filter({ hasText: 'Drag Test Task' })).toBeVisible()
  })

  test('should filter tasks correctly', async ({ page }) => {
    // Create tasks with different priorities
    await page.click('[data-testid="quick-add-button"]')
    await page.fill('[data-testid="task-title-input"]', 'High Priority Task')
    await page.selectOption('[data-testid="priority-select"]', 'high')
    await page.click('[data-testid="create-task-button"]')

    await page.click('[data-testid="quick-add-button"]')
    await page.fill('[data-testid="task-title-input"]', 'Low Priority Task')
    await page.selectOption('[data-testid="priority-select"]', 'low')
    await page.click('[data-testid="create-task-button"]')

    // Filter by high priority
    await page.click('[data-testid="filter-button"]')
    await page.click('[data-testid="filter-priority-high"]')

    // Verify only high priority task is visible
    await expect(page.locator('[data-testid="task-card"]').filter({ hasText: 'High Priority Task' })).toBeVisible()
    await expect(page.locator('[data-testid="task-card"]').filter({ hasText: 'Low Priority Task' })).not.toBeVisible()

    // Clear filter
    await page.click('[data-testid="clear-filter-button"]')

    // Verify both tasks are visible
    await expect(page.locator('[data-testid="task-card"]').filter({ hasText: 'High Priority Task' })).toBeVisible()
    await expect(page.locator('[data-testid="task-card"]').filter({ hasText: 'Low Priority Task' })).toBeVisible()
  })
})
```

#### Pomodoro Timer Workflow

```typescript
// tests/e2e/timer/pomodoro-workflow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Pomodoro Timer E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5546')

    // Navigate to timer view
    await page.click('[data-testid="timer-nav-button"]')
    await page.waitForSelector('[data-testid="pomodoro-timer"]')
  })

  test('should complete full pomodoro cycle', async ({ page }) => {
    // Start pomodoro
    await expect(page.locator('[data-testid="timer-display"]')).toHaveText('25:00')
    await page.click('[data-testid="start-timer-button"]')

    // Verify timer is running
    await expect(page.locator('[data-testid="timer-display"]')).not.toHaveText('25:00')
    await expect(page.locator('[data-testid="pause-timer-button"]')).toBeVisible()

    // Skip to end (for testing)
    await page.evaluate(() => {
      // Fast-forward timer
      window.dispatchEvent(new CustomEvent('skip-timer'))
    })

    // Verify pomodoro completed
    await expect(page.locator('[data-testid="timer-display"]')).toHaveText('05:00')
    await expect(page.locator('[data-testid="break-indicator"]')).toBeVisible()

    // Complete break
    await page.click('[data-testid="start-timer-button"]')
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('skip-timer'))
    })

    // Verify next pomodoro starts
    await expect(page.locator('[data-testid="timer-display"]')).toHaveText('25:00')
    await expect(page.locator('[data-testid="pomodoro-count"]')).toContainText('1')
  })

  test('should play sound when pomodoro completes', async ({ page }) => {
    // Mock audio
    await page.addInitScript(() => {
      window.Audio = class MockAudio {
        play() {
          window.dispatchEvent(new Event('audio-played'))
        }
      }
    })

    // Start and complete pomodoro
    await page.click('[data-testid="start-timer-button"]')
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('skip-timer'))
    })

    // Verify sound played
    await expect(page.locator('body')).toHaveAttribute('data-sound-played', 'true')
  })
})
```

### 2. Cross-Browser Tests

```typescript
// tests/e2e/cross-browser/cross-browser.spec.ts
import { test, devices } from '@playwright/test'

const devicesToTest = [
  devices['Desktop Chrome'],
  devices['Desktop Firefox'],
  devices['Desktop Safari'],
  devices['iPhone 13'],
  devices['iPad'],
  devices['Android Galaxy S9']
]

for (const device of devicesToTest) {
  test.describe(`Cross-browser tests on ${device.name}`, () => {
    test.use({ ...device })

    test('should work correctly on different devices', async ({ page }) => {
      await page.goto('http://localhost:5546')

      // Test basic functionality
      await expect(page.locator('[data-testid="app-title"]')).toBeVisible()
      await expect(page.locator('[data-testid="board-view"]')).toBeVisible()

      // Test touch interactions on mobile
      if (device.isMobile) {
        await page.tap('[data-testid="mobile-menu-button"]')
        await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
      }

      // Test drag and drop works
      const taskCard = page.locator('[data-testid="task-card"]').first()
      const targetColumn = page.locator('[data-testid="column-in-progress"]')

      if (await taskCard.isVisible()) {
        await taskCard.dragTo(targetColumn)
        await expect(targetColumn.locator('[data-testid="task-card"]').first()).toBeVisible()
      }
    })
  })
}
```

---

## 👁️ Visual Testing

### 1. Component Visual Tests

```typescript
// tests/visual/components/TaskCard.spec.ts
import { test, expect } from '@playwright/test'

test.describe('TaskCard Visual Tests', () => {
  test('should render task card correctly', async ({ page }) => {
    await page.goto('http://localhost:6006')
    await page.click('[data-testid="story-task-card--default"]')

    await expect(page.locator('[data-testid="storybook-preview"]')).toHaveScreenshot('task-card-default.png')
  })

  test('should render task card with high priority correctly', async ({ page }) => {
    await page.goto('http://localhost:6006')
    await page.click('[data-testid="story-task-card--high-priority"]')

    await expect(page.locator('[data-testid="storybook-preview"]')).toHaveScreenshot('task-card-high-priority.png')
  })

  test('should render task card in dragging state correctly', async ({ page }) => {
    await page.goto('http://localhost:6006')
    await page.click('[data-testid="story-task-card--dragging"]')

    await expect(page.locator('[data-testid="storybook-preview"]')).toHaveScreenshot('task-card-dragging.png')
  })
})
```

### 2. View Visual Tests

```typescript
// tests/visual/views/BoardView.spec.ts
import { test, expect } from '@playwright/test'

test.describe('BoardView Visual Tests', () => {
  test('should render board view correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('http://localhost:5546/#/board')

    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="board-view"]')).toHaveScreenshot('board-view-desktop.png')
  })

  test('should render board view correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('http://localhost:5546/#/board')

    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="board-view"]')).toHaveScreenshot('board-view-mobile.png')
  })

  test('should render board view correctly in dark mode', async ({ page }) => {
    await page.goto('http://localhost:5546/#/board')

    // Enable dark mode
    await page.click('[data-testid="theme-toggle"]')
    await page.waitForSelector('[data-theme="dark"]')

    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="board-view"]')).toHaveScreenshot('board-view-dark-mode.png')
  })
})
```

---

## ⚡ Performance Testing

### 1. Load Performance Tests

```typescript
// tests/performance/load/load-performance.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Load Performance Tests', () => {
  test('should load main page within performance budget', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('http://localhost:5546')
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    // Performance budget: 3 seconds
    expect(loadTime).toBeLessThan(3000)
  })

  test('should have good Core Web Vitals', async ({ page }) => {
    const response = await page.goto('http://localhost:5546')

    // Get performance metrics
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const vitals = {}

          entries.forEach((entry) => {
            if (entry.entryType === 'largest-contentful-paint') {
              vitals.lcp = entry.renderTime || entry.loadTime
            } else if (entry.entryType === 'first-input') {
              vitals.fid = entry.processingStart - entry.startTime
            } else if (entry.entryType === 'layout-shift') {
              vitals.cls = (vitals.cls || 0) + entry.value
            }
          })

          resolve(vitals)
        }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
      })
    })

    // Core Web Vitals thresholds
    expect(metrics.lcp).toBeLessThan(2500) // LCP < 2.5s
    expect(metrics.fid).toBeLessThan(100)   // FID < 100ms
    expect(metrics.cls).toBeLessThan(0.1)   // CLS < 0.1
  })
})
```

### 2. Stress Testing

```typescript
// tests/performance/stress/stress-test.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Stress Tests', () => {
  test('should handle large number of tasks efficiently', async ({ page }) => {
    await page.goto('http://localhost:5546')

    // Create many tasks
    for (let i = 0; i < 100; i++) {
      await page.click('[data-testid="quick-add-button"]')
      await page.fill('[data-testid="task-title-input"]', `Test Task ${i}`)
      await page.click('[data-testid="create-task-button"]')
    }

    // Measure render time
    const startTime = Date.now()
    await page.waitForSelector('[data-testid="task-card"]:nth-child(100)')
    const renderTime = Date.now() - startTime

    // Should render 100 tasks within 2 seconds
    expect(renderTime).toBeLessThan(2000)

    // Test scrolling performance
    const scrollStart = Date.now()
    await page.evaluate(() => {
      const container = document.querySelector('[data-testid="task-list"]')
      container.scrollTop = container.scrollHeight
    })
    const scrollTime = Date.now() - scrollStart

    // Should scroll smoothly within 500ms
    expect(scrollTime).toBeLessThan(500)
  })
})
```

---

## ♿ Accessibility Testing

### 1. Automated Accessibility Tests

```typescript
// tests/accessibility/automated-a11y.spec.ts
import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-playwright'

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await injectAxe(page)
  })

  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('http://localhost:5546')

    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'aria-labels': { enabled: true },
        'heading-order': { enabled: true }
      }
    })
  })

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('http://localhost:5546')

    // Test tab navigation
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toBeVisible()

    // Test task creation with keyboard
    await page.keyboard.press('Enter')
    await page.keyboard.type('Keyboard Task')
    await page.keyboard.press('Enter')

    // Verify task created
    await expect(page.locator('[data-testid="task-card"]').filter({ hasText: 'Keyboard Task' })).toBeVisible()
  })

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('http://localhost:5546')

    // Check for proper ARIA labels on interactive elements
    const buttons = await page.locator('button').all()

    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label')
      const text = await button.textContent()

      // Each button should have either aria-label or text content
      expect(ariaLabel || text).toBeTruthy()
    }
  })
})
```

---

## 📱 Mobile Testing

### 1. Touch Interaction Tests

```typescript
// tests/e2e/mobile/touch-interactions.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Mobile Touch Interactions', () => {
  test.use({
    viewport: { width: 375, height: 667 },
    hasTouch: true
  })

  test('should handle touch gestures correctly', async ({ page }) => {
    await page.goto('http://localhost:5546')

    // Test swipe navigation
    await page.locator('[data-testid="board-view"]').swipe('left', 100, 100)
    await expect(page.locator('[data-testid="calendar-view"]')).toBeVisible()

    // Test tap to select
    await page.tap('[data-testid="task-card"]')
    await expect(page.locator('[data-testid="task-detail-modal"]')).toBeVisible()

    // Test pinch to zoom (if implemented)
    await page.locator('[data-testid="canvas-view"]').pinch(200, 200, 100)
  })

  test('should work in different orientations', async ({ page }) => {
    // Test portrait
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('http://localhost:5546')
    await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible()

    // Test landscape
    await page.setViewportSize({ width: 667, height: 375 })
    await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible()
  })
})
```

---

## 🔒 Security Testing

### 1. Input Validation Tests

```typescript
// tests/e2e/security/input-validation.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Security Tests', () => {
  test('should sanitize user input correctly', async ({ page }) => {
    await page.goto('http://localhost:5546')

    // Try to inject XSS
    const xssPayload = '<script>alert("XSS")</script>'
    await page.click('[data-testid="quick-add-button"]')
    await page.fill('[data-testid="task-title-input"]', xssPayload)
    await page.click('[data-testid="create-task-button"]')

    // Verify script not executed
    await expect(page.locator('.alert')).not.toBeVisible()

    // Verify content is escaped
    const taskTitle = await page.locator('[data-testid="task-card"]').first().textContent()
    expect(taskTitle).not.toContain('<script>')
  })

  test('should handle long inputs gracefully', async ({ page }) => {
    await page.goto('http://localhost:5546')

    // Create very long title
    const longTitle = 'A'.repeat(1000)
    await page.click('[data-testid="quick-add-button"]')
    await page.fill('[data-testid="task-title-input"]', longTitle)
    await page.click('[data-testid="create-task-button"]')

    // Should not crash the application
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible()
  })
})
```

---

## 🔄 Quality Assurance Process

### 1. Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test:unit && npm run test:integration"
    }
  },
  "lint-staged": {
    "*.{js,ts,vue}": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ],
    "*.{css,scss,vue}": [
      "stylelint --fix",
      "prettier --write",
      "git add"
    ]
  }
}
```

### 2. Test Coverage Requirements

```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        // Critical files require higher coverage
        'src/stores/*.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'src/components/**/*.vue': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    }
  }
})
```

### 3. Quality Metrics Dashboard

```typescript
// tests/helpers/quality-metrics.ts
export interface QualityMetrics {
  testCoverage: {
    total: number
    covered: number
    percentage: number
  }
  performanceScore: {
    lighthouse: number
    loadTime: number
    bundleSize: number
  }
  accessibilityScore: {
    axeViolations: number
    wcagLevel: 'A' | 'AA' | 'AAA'
  }
  codeQuality: {
    eslintErrors: number
    typeScriptErrors: number
    duplication: number
  }
}

export function generateQualityReport(): QualityMetrics {
  // Implementation for generating quality metrics
  return {
    testCoverage: { total: 0, covered: 0, percentage: 0 },
    performanceScore: { lighthouse: 0, loadTime: 0, bundleSize: 0 },
    accessibilityScore: { axeViolations: 0, wcagLevel: 'A' },
    codeQuality: { eslintErrors: 0, typeScriptErrors: 0, duplication: 0 }
  }
}
```

---

## 🛠️ Testing Tools and Configuration

### 1. Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'src/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,ts,jsx,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### 2. Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:5546',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5546',
    reuseExistingServer: !process.env.CI
  }
})
```

### 3. Test Setup File

```typescript
// tests/setup.ts
import { vi } from 'vitest'
import { config } from '@vue/test-utils'

// Mock global objects
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock IndexedDB
const indexedDB = {
  open: vi.fn().mockReturnValue({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  })
}
global.indexedDB = indexedDB

// Vue Test Utils configuration
config.global.stubs = {
  'font-awesome-icon': true,
  'router-link': true,
  'router-view': true
}

// Mock Firebase
vi.mock('@/config/firebase', () => ({
  default: {
    auth: {
      currentUser: null,
      onAuthStateChanged: vi.fn()
    },
    firestore: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          set: vi.fn(),
          get: vi.fn(),
          update: vi.fn(),
          delete: vi.fn()
        })),
        add: vi.fn(),
        where: vi.fn(),
        get: vi.fn()
      }))
    }
  }
}))
```

---

## 📊 Test Data Management

### 1. Test Fixtures

```typescript
// tests/fixtures/task-fixtures.ts
import { Task } from '@/types'

export const createTaskFixture = (overrides: Partial<Task> = {}): Task => {
  return {
    id: 'test-task-' + Math.random().toString(36).substr(2, 9),
    title: 'Test Task',
    description: 'Test task description',
    status: 'planned',
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: null,
    projectId: 'test-project',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

export const createProjectFixture = (overrides: any = {}) => {
  return {
    id: 'test-project-' + Math.random().toString(36).substr(2, 9),
    name: 'Test Project',
    description: 'Test project description',
    color: '#3B82F6',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

export const testTasks = [
  createTaskFixture({ title: 'Task 1', priority: 'high' }),
  createTaskFixture({ title: 'Task 2', priority: 'medium' }),
  createTaskFixture({ title: 'Task 3', priority: 'low' }),
  createTaskFixture({ title: 'Task 4', status: 'in_progress' }),
  createTaskFixture({ title: 'Task 5', status: 'done' })
]
```

### 2. Mock Data Service

```typescript
// tests/helpers/mock-data-service.ts
export class MockDataService {
  private tasks: any[] = []
  private projects: any[] = []

  constructor() {
    this.seedData()
  }

  private seedData() {
    this.projects = [
      { id: 'project-1', name: 'Work', color: '#3B82F6' },
      { id: 'project-2', name: 'Personal', color: '#10B981' }
    ]

    this.tasks = [
      {
        id: 'task-1',
        title: 'Design new feature',
        status: 'planned',
        priority: 'high',
        projectId: 'project-1'
      },
      {
        id: 'task-2',
        title: 'Implement authentication',
        status: 'in_progress',
        priority: 'high',
        projectId: 'project-1'
      },
      {
        id: 'task-3',
        title: 'Write documentation',
        status: 'planned',
        priority: 'medium',
        projectId: 'project-2'
      }
    ]
  }

  getTasks() {
    return Promise.resolve(this.tasks)
  }

  getProjects() {
    return Promise.resolve(this.projects)
  }

  createTask(task: any) {
    const newTask = { ...task, id: 'task-' + Date.now() }
    this.tasks.push(newTask)
    return Promise.resolve(newTask)
  }

  updateTask(id: string, updates: any) {
    const index = this.tasks.findIndex(t => t.id === id)
    if (index !== -1) {
      this.tasks[index] = { ...this.tasks[index], ...updates }
    }
    return Promise.resolve(this.tasks[index])
  }

  deleteTask(id: string) {
    this.tasks = this.tasks.filter(t => t.id !== id)
    return Promise.resolve()
  }
}
```

---

## 🚀 Continuous Integration

### 1. GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  visual:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Storybook
        run: npm run build-storybook

      - name: Run visual tests
        run: npm run test:visual

      - name: Upload visual regression results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: visual-test-results
          path: visual-tests/
```

### 2. Quality Gates Configuration

```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates

on:
  pull_request:
    branches: [main]

jobs:
  quality-check:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run all tests
        run: |
          npm run lint
          npm run type-check
          npm run test:unit
          npm run test:integration

      - name: Check test coverage
        run: |
          COVERAGE=$(npm run test:coverage -- --silent | grep -o '[0-9]*\.[0-9]*' | head -1)
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Test coverage $COVERAGE% is below 80%"
            exit 1
          fi

      - name: Run performance audit
        run: |
          npm run build
          npm run start &
          sleep 10
          npx lighthouse http://localhost:5546 --output=json --output-path=lighthouse.json
          SCORE=$(cat lighthouse.json | jq '.categories.performance.score * 100')
          if (( $(echo "$SCORE < 90" | bc -l) )); then
            echo "Performance score $SCORE is below 90"
            exit 1
          fi

      - name: Security audit
        run: npm audit --audit-level moderate

      - name: Bundle size check
        run: |
          npm run build
          BUNDLE_SIZE=$(du -k dist/assets/index-*.js | cut -f1)
          if [ $BUNDLE_SIZE -gt 500 ]; then
            echo "Bundle size ${BUNDLE_SIZE}KB exceeds 500KB limit"
            exit 1
          fi
```

---

## 📋 Testing Checklist

### Pre-commit Checklist
- [ ] All linter rules pass
- [ ] TypeScript compilation succeeds
- [ ] Unit tests pass with coverage >80%
- [ ] Code formatted with Prettier
- [ ] No console errors in development

### Pre-merge Checklist
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Visual regression tests pass
- [ ] Accessibility tests pass
- [ ] Performance budgets met
- [ ] Security audit passes

### Pre-release Checklist
- [ ] All tests pass across all browsers
- [ ] E2E tests pass on mobile devices
- [ ] Load performance meets requirements
- [ ] Bundle size within limits
- [ ] No critical security vulnerabilities
- [ ] Documentation updated

### Production Monitoring
- [ ] Error tracking configured
- [ ] Performance monitoring active
- [ ] User analytics working
- [ ] Uptime monitoring configured
- [ ] Backup processes verified

---

**Last Updated**: November 2, 2025
**Testing Framework**: Vitest + Playwright + Vue Test Utils
**Coverage Target**: 80% global, 90% critical files
**Test Environments**: Chrome, Firefox, Safari, Mobile (iOS/Android)
**Quality Gates**: Automated linting, testing, and performance validation
**CI/CD**: GitHub Actions with multi-stage validation