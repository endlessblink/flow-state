<template>
  <div class="page">
    <h1 class="page-title">UI Components</h1>
    <p class="page-description">Verified UI components from actual code</p>

    <ComponentShowcase
      title="View Navigation Tabs (App.vue:228-235)"
      :code="viewTabsCode"
    >
      <div class="nav-demo">
        <div class="view-tabs">
          <button class="view-tab">Board</button>
          <button class="view-tab">Calendar</button>
          <button class="view-tab active">Canvas</button>
          <button class="view-tab disabled" disabled>Table</button>
          <button class="view-tab disabled" disabled>List</button>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="View Tab - All States"
      :code="viewTabStatesCode"
    >
      <div class="states-demo">
        <div class="state-group">
          <span class="state-label">Default:</span>
          <button class="view-tab">Board</button>
        </div>
        <div class="state-group">
          <span class="state-label">Hover:</span>
          <button class="view-tab hover-state">Board</button>
        </div>
        <div class="state-group">
          <span class="state-label">Active:</span>
          <button class="view-tab active">Board</button>
        </div>
        <div class="state-group">
          <span class="state-label">Disabled:</span>
          <button class="view-tab disabled" disabled>Table</button>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="App Sidebar Header (App.vue:10-24)"
      :code="sidebarHeaderCode"
    >
      <div class="sidebar-demo">
        <div class="sidebar-section-demo">
          <div class="app-brand">
            <span class="brand-icon">🍅</span>
            <span class="brand-text">Pomo-Flow</span>
          </div>
          <BaseButton variant="secondary" size="md">
            <Plus :size="14" />
            Create project
          </BaseButton>
          <BaseButton variant="ghost" size="md">
            ☀️ Light
          </BaseButton>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Quick Add Input (App.vue:27-38)"
      :code="quickAddCode"
    >
      <div class="sidebar-demo">
        <div class="quick-add-input">
          <Plus :size="16" class="add-icon" />
          <input type="text" placeholder="Add a task..." class="task-input" />
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="BaseNavItem - Smart Views (BaseNavItem.vue)"
      :code="baseNavItemCode"
    >
      <div class="sidebar-demo">
        <div class="nav-items-demo">
          <BaseNavItem :count="3">
            <template #icon>
              <Inbox :size="16" />
            </template>
            All Projects
          </BaseNavItem>
          <BaseNavItem :active="true" :count="0">
            <template #icon>
              <Calendar :size="16" />
            </template>
            Today
          </BaseNavItem>
          <BaseNavItem :count="2">
            <template #icon>
              <BarChart3 :size="16" />
            </template>
            This Week
          </BaseNavItem>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="BaseNavItem - Project with Color Dot"
      :code="navItemProjectCode"
    >
      <div class="sidebar-demo">
        <div class="nav-items-demo">
          <BaseNavItem color-dot="#3b82f6" :count="3">
            My Tasks
          </BaseNavItem>
          <BaseNavItem color-dot="#8b5cf6" :count="0">
            buying things
          </BaseNavItem>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="BaseNavItem - All States"
      :code="navItemStatesCode"
    >
      <div class="states-demo">
        <div class="state-group">
          <span class="state-label">Default:</span>
          <BaseNavItem :count="5">
            <template #icon>
              <Inbox :size="16" />
            </template>
            All Projects
          </BaseNavItem>
        </div>
        <div class="state-group">
          <span class="state-label">Active:</span>
          <BaseNavItem :active="true" :count="0">
            <template #icon>
              <Calendar :size="16" />
            </template>
            Today
          </BaseNavItem>
        </div>
        <div class="state-group">
          <span class="state-label">Nested:</span>
          <BaseNavItem nested color-dot="#3b82f6" :count="2">
            Sub-project
          </BaseNavItem>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Search & Filter Toolbar (App.vue:237-249)"
      :code="searchFilterCode"
    >
      <div class="toolbar-demo">
        <div class="content-controls">
          <input type="text" placeholder="Search anything..." class="search-input" />
          <button class="filter-control">
            <Filter :size="14" />
            Filter
          </button>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Search Input - All States"
      :code="searchStatesCode"
    >
      <div class="states-demo">
        <div class="state-group">
          <span class="state-label">Default:</span>
          <input type="text" placeholder="Search anything..." class="search-input" />
        </div>
        <div class="state-group">
          <span class="state-label">Focus:</span>
          <input type="text" placeholder="Search anything..." class="search-input focus-state" value="typing..." />
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Timer Display - Inactive (App.vue:154-224)"
      :code="timerInactiveCode"
    >
      <div class="timer-demo">
        <div class="timer-display">
          <div class="timer-icon">
            <Circle :size="20" :stroke-width="1.5" class="timer-stroke" />
          </div>
          <div class="timer-info">
            <div class="timer-time">20:00</div>
            <div class="timer-task">&nbsp;</div>
          </div>
          <div class="timer-controls">
            <div class="timer-start-options">
              <button class="timer-btn timer-start" title="Start work timer">
                <Play :size="16" />
              </button>
              <button class="timer-btn timer-break" title="Short break">
                <Coffee :size="16" :stroke-width="1.5" />
              </button>
              <button class="timer-btn timer-break" title="Long break">
                <User :size="16" :stroke-width="1.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Timer Display - Active Work 🔥"
      :code="timerActiveCode"
    >
      <div class="timer-demo">
        <div class="timer-display timer-active">
          <div class="timer-icon">
            <span class="timer-emoticon active">🍅</span>
          </div>
          <div class="timer-info">
            <div class="timer-time">18:45</div>
            <div class="timer-task">Work on design system</div>
          </div>
          <div class="timer-controls">
            <button class="timer-btn timer-pause">
              <Pause :size="16" />
            </button>
            <button class="timer-btn timer-stop">
              <Square :size="16" />
            </button>
          </div>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Timer Display - Active Break"
      :code="timerBreakCode"
    >
      <div class="timer-demo">
        <div class="timer-display timer-active timer-break">
          <div class="timer-icon">
            <span class="timer-emoticon active">☕</span>
          </div>
          <div class="timer-info">
            <div class="timer-time">04:30</div>
            <div class="timer-task">Short break</div>
          </div>
          <div class="timer-controls">
            <button class="timer-btn timer-pause">
              <Pause :size="16" />
            </button>
            <button class="timer-btn timer-stop">
              <Square :size="16" />
            </button>
          </div>
        </div>
      </div>
    </ComponentShowcase>
  </div>
</template>

<script setup lang="ts">
import ComponentShowcase from '../components/ComponentShowcase.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseNavItem from '@/components/base/BaseNavItem.vue'
import { Plus, Inbox, Calendar, BarChart3, Filter, Circle, Play, Pause, Square, Coffee, User } from 'lucide-vue-next'

const viewTabsCode = `<div class="view-tabs">
  <router-link to="/" class="view-tab" active-class="active">
    Board
  </router-link>
  <router-link to="/calendar" class="view-tab" active-class="active">
    Calendar
  </router-link>
  <router-link to="/canvas" class="view-tab" active-class="active">
    Canvas
  </router-link>
  <button class="view-tab disabled" disabled>Table</button>
  <button class="view-tab disabled" disabled>List</button>
</div>`

const viewTabStatesCode = `<!-- Default -->
<button class="view-tab">Board</button>

<!-- Hover (automatic) -->
<button class="view-tab">Board</button>

<!-- Active -->
<button class="view-tab active">Board</button>

<!-- Disabled -->
<button class="view-tab disabled" disabled>Table</button>`

const sidebarHeaderCode = `<div class="sidebar-header">
  <div class="app-brand">
    <span class="brand-icon">🍅</span>
    <span class="brand-text">Pomo-Flow</span>
  </div>
  <BaseButton variant="secondary" size="md" @click="openCreateProject">
    <Plus :size="14" />
    Create project
  </BaseButton>
  <BaseButton variant="ghost" size="md" @click="toggleDarkMode">
    {{ isDarkMode ? '☀️ Light' : '🌙 Dark' }}
  </BaseButton>
</div>`

const quickAddCode = `<div class="quick-add-input">
  <Plus :size="16" class="add-icon" />
  <input
    v-model="newTaskTitle"
    type="text"
    placeholder="Add a task..."
    class="task-input"
    @keyup.enter="createQuickTask"
  />
</div>`

const baseNavItemCode = `<BaseNavItem :active="true" :count="3">
  <template #icon>
    <Inbox :size="16" />
  </template>
  All Projects
</BaseNavItem>

<BaseNavItem :count="0">
  <template #icon>
    <Calendar :size="16" />
  </template>
  Today
</BaseNavItem>`

const navItemProjectCode = `<BaseNavItem color-dot="#3b82f6" :count="3">
  My Tasks
</BaseNavItem>

<BaseNavItem color-dot="#8b5cf6" :count="0">
  buying things
</BaseNavItem>`

const navItemStatesCode = `<!-- Default -->
<BaseNavItem :count="5">
  <template #icon>
    <Inbox :size="16" />
  </template>
  All Projects
</BaseNavItem>

<!-- Active -->
<BaseNavItem :active="true" :count="0">
  Today
</BaseNavItem>

<!-- Nested -->
<BaseNavItem nested color-dot="#3b82f6" :count="2">
  Sub-project
</BaseNavItem>`

const searchFilterCode = `<div class="content-controls">
  <input
    type="text"
    placeholder="Search anything..."
    class="search-input"
  />
  <button class="filter-control">
    <Filter :size="14" />
    Filter
  </button>
</div>`

const searchStatesCode = `<!-- Default -->
<input type="text" placeholder="Search anything..." class="search-input" />

<!-- Focus (automatic) -->
<input type="text" placeholder="Search anything..." class="search-input" value="typing..." />`

const timerInactiveCode = `<div class="timer-display">
  <div class="timer-icon">
    <Circle :size="20" :stroke-width="1.5" class="timer-stroke" />
  </div>
  <div class="timer-info">
    <div class="timer-time">{{ displayTime }}</div>
    <div class="timer-task">{{ taskName || '&nbsp;' }}</div>
  </div>
  <div class="timer-controls">
    <div class="timer-start-options">
      <button class="timer-btn timer-start" @click="startWork">
        <Play :size="16" />
      </button>
      <button class="timer-btn timer-break" @click="startShortBreak">
        <Coffee :size="16" :stroke-width="1.5" />
      </button>
      <button class="timer-btn timer-break" @click="startLongBreak">
        <User :size="16" :stroke-width="1.5" />
      </button>
    </div>
  </div>
</div>`

const timerActiveCode = `<div class="timer-display timer-active">
  <div class="timer-icon">
    <span class="timer-emoticon active">🍅</span>
  </div>
  <div class="timer-info">
    <div class="timer-time">{{ displayTime }}</div>
    <div class="timer-task">{{ currentTaskName }}</div>
  </div>
  <div class="timer-controls">
    <button class="timer-btn timer-pause" @click="pauseTimer">
      <Pause :size="16" />
    </button>
    <button class="timer-btn timer-stop" @click="stopTimer">
      <Square :size="16" />
    </button>
  </div>
</div>`

const timerBreakCode = `<div class="timer-display timer-active timer-break">
  <div class="timer-icon">
    <span class="timer-emoticon active">☕</span>
  </div>
  <div class="timer-info">
    <div class="timer-time">{{ displayTime }}</div>
    <div class="timer-task">Short break</div>
  </div>
  <div class="timer-controls">
    <button class="timer-btn timer-pause">
      <Pause :size="16" />
    </button>
    <button class="timer-btn timer-stop">
      <Square :size="16" />
    </button>
  </div>
</div>`
</script>

<style scoped>
.page {
  max-width: 1400px;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-2);
}

.page-description {
  color: var(--text-muted);
  margin-bottom: var(--space-8);
}

/* Navigation Demo */
.nav-demo {
  padding: var(--space-8);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  display: flex;
  justify-content: center;
}

/* States Demo */
.states-demo {
  padding: var(--space-6);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.state-group {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.state-label {
  font-size: var(--text-sm);
  color: var(--text-muted);
  min-width: 80px;
  font-weight: var(--font-medium);
}

/* VERIFIED: View Tabs from App.vue:1481-1523 */
.view-tabs {
  display: flex;
  gap: 0.125rem;
}

.view-tab {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  text-decoration: none;
}

.view-tab:hover,
.view-tab.hover-state {
  color: var(--text-secondary);
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  box-shadow: var(--state-hover-shadow);
}

.view-tab.active {
  color: var(--state-active-text);
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  font-weight: var(--font-semibold);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.view-tab.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.view-tab.disabled:hover {
  background: transparent;
  color: var(--text-muted);
  box-shadow: none;
}

/* Sidebar Demo */
.sidebar-demo {
  padding: var(--space-6);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
}

.sidebar-section-demo {
  max-width: 260px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-6);
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-soft) 100%
  );
  backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
}

/* VERIFIED: App Brand from App.vue:11-14 + 742-757 */
.app-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.brand-icon {
  font-size: var(--text-xl);
}

.brand-text {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

/* VERIFIED: Quick Add Input from App.vue:28-36 + 906-953 */
.quick-add-input {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
  max-width: 260px;
}

.quick-add-input:focus-within {
  border-color: var(--calendar-creating-border);
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  box-shadow:
    var(--calendar-creating-bg),
    var(--shadow-lg);
}

.add-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.task-input {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  width: 100%;
  outline: none;
}

.task-input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

/* Nav Items Demo Container */
.nav-items-demo {
  max-width: 260px;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

/* Toolbar Demo */
.toolbar-demo {
  padding: var(--space-8);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  display: flex;
  justify-content: center;
}

/* VERIFIED: Content Controls from App.vue:237-249 + 1525-1604 */
.content-controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.search-input {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-primary);
  width: 240px;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
  outline: none;
}

.search-input:focus,
.search-input.focus-state {
  border-color: var(--calendar-creating-border);
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  box-shadow:
    var(--calendar-creating-bg),
    var(--shadow-lg);
}

.search-input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.filter-control {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
}

.filter-control:hover {
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-medium) 100%
  );
  border-color: var(--glass-border-medium);
  transform: translateY(-2px);
  box-shadow:
    var(--shadow-lg),
    var(--calendar-today-glow);
}

/* Timer Demo */
.timer-demo {
  padding: var(--space-8);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  display: flex;
  justify-content: center;
}

/* VERIFIED: Timer Display from App.vue:1257-1437 */
.timer-display {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-3) var(--space-5);
  min-height: 60px;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 var(--glass-bg-heavy);
}

.timer-display.timer-active {
  background: linear-gradient(
    135deg,
    var(--timer-break-bg-start) 0%,
    var(--timer-break-bg-end) 100%
  );
  border-color: var(--timer-border-medium);
  box-shadow:
    var(--shadow-xl),
    0 0 24px var(--timer-break-bg-start),
    inset 0 1px 0 var(--border-medium);
}

.timer-display.timer-break {
  background: linear-gradient(
    135deg,
    var(--success-bg-start) 0%,
    var(--success-bg-end) 100%
  );
  border-color: var(--success-border);
  box-shadow:
    var(--shadow-xl),
    0 0 24px var(--success-bg-start),
    inset 0 1px 0 var(--border-medium);
}

.timer-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer-emoticon {
  font-size: var(--text-2xl);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.timer-emoticon.active {
  animation: emoticonBounce 1.5s ease-in-out infinite;
}

@keyframes emoticonBounce {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  25% {
    transform: translateY(-6px) scale(1.1);
  }
  50% {
    transform: translateY(0) scale(1);
  }
  75% {
    transform: translateY(-3px) scale(1.05);
  }
}

.timer-stroke {
  color: var(--color-work);
}

.timer-info {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
}

.timer-time {
  font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  min-width: 4rem;
  letter-spacing: 0.025em;
}

.timer-task {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: var(--font-medium);
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timer-controls {
  display: flex;
  gap: 0.25rem;
}

.timer-start-options {
  display: flex;
  gap: 0.25rem;
}

.timer-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius-6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
}

.timer-btn:hover {
  background: var(--surface-hover);
  color: var(--text-secondary);
}

.timer-start,
.timer-resume {
  color: var(--color-work);
}

.timer-start:hover,
.timer-resume:hover {
  background: var(--state-hover-bg);
  color: var(--color-work);
}

.timer-pause {
  color: var(--color-break);
}

.timer-pause:hover {
  background: var(--glass-bg-tint);
  color: var(--color-break);
}

.timer-stop {
  color: var(--color-danger);
}

.timer-stop:hover {
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
}
</style>
