<template>
  <div class="page">
    <h1 class="page-title">Calendar Components</h1>
    <p class="page-description">Verified calendar components from actual code</p>

    <ComponentShowcase
      title="TaskManagerSidebar Header (TaskManagerSidebar.vue:3-11)"
      :code="sidebarHeaderCode"
    >
      <div class="sidebar-demo">
        <div class="sidebar-header">
          <div class="header-title">
            <ListTodo :size="16" :stroke-width="1.5" class="header-icon" />
            <span class="title-text">Tasks</span>
          </div>
          <button class="add-task-btn">
            <Plus :size="16" :stroke-width="1.5" />
          </button>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Search Box (TaskManagerSidebar.vue:15-23)"
      :code="searchBoxCode"
    >
      <div class="sidebar-demo">
        <div class="search-box">
          <Search :size="14" :stroke-width="1.5" class="search-icon" />
          <input type="text" placeholder="Search tasks..." class="search-input" />
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Filter Tabs (TaskManagerSidebar.vue:25-36)"
      :code="filterTabsCode"
    >
      <div class="sidebar-demo">
        <div class="filter-tabs">
          <button class="filter-tab active">All</button>
          <button class="filter-tab">Unscheduled</button>
          <button class="filter-tab">Scheduled</button>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Sidebar Task Card - Scheduled (TaskManagerSidebar.vue:47-107)"
      :code="sidebarTaskCode"
    >
      <div class="sidebar-demo">
        <div class="sidebar-task scheduled">
          <div class="task-header">
            <div class="task-title-row">
              <span class="task-title">עבודה על פרויקט חדש</span>
              <div class="task-badges">
                <span class="scheduled-badge">
                  <Clock :size="12" :stroke-width="1.5" />
                </span>
                <span class="instance-badge">2×</span>
                <span class="priority-badge high">
                  <Flag :size="12" :stroke-width="1.5" />
                </span>
              </div>
            </div>
            <div class="task-meta">
              <span class="pomodoro-count">
                <Timer :size="12" :stroke-width="1.5" />
                1
              </span>
              <span class="subtask-count">0/1</span>
            </div>
          </div>
          <div class="scheduled-time">
            <Calendar :size="12" :stroke-width="1.5" />
            <span>05/10/2025 12:00</span>
          </div>
          <div class="task-actions">
            <button class="action-btn start-timer">
              <Play :size="12" :stroke-width="1.5" />
            </button>
            <button class="action-btn edit-task">
              <Edit :size="12" :stroke-width="1.5" />
            </button>
          </div>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Calendar Date Navigation (CalendarView.vue:32-40)"
      :code="dateNavCode"
    >
      <div class="calendar-demo">
        <div class="date-navigation">
          <button class="nav-btn">
            <ChevronLeft :size="16" :stroke-width="1.5" />
          </button>
          <h2 class="current-date">Monday, October 6, 2025</h2>
          <button class="nav-btn">
            <ChevronRight :size="16" :stroke-width="1.5" />
          </button>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Today Button (CalendarView.vue:42-45)"
      :code="todayBtnCode"
    >
      <div class="calendar-demo">
        <button class="today-btn">
          <Calendar :size="16" :stroke-width="1.5" />
          Today
        </button>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Status Filters (CalendarView.vue:48-81)"
      :code="statusFiltersCode"
    >
      <div class="calendar-demo">
        <div class="status-filters">
          <button class="status-btn active">All</button>
          <button class="status-btn">Planned</button>
          <button class="status-btn">Active</button>
          <button class="status-btn">Done</button>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="View Selector (CalendarView.vue:83-106)"
      :code="viewSelectorCode"
    >
      <div class="calendar-demo">
        <div class="view-selector">
          <button class="view-btn active">Day</button>
          <button class="view-btn">Week</button>
          <button class="view-btn">Month</button>
        </div>
      </div>
    </ComponentShowcase>
  </div>
</template>

<script setup lang="ts">
import ComponentShowcase from '../components/ComponentShowcase.vue'
import { ListTodo, Plus, Search, Clock, Flag, Timer, Calendar, Play, Edit, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const sidebarHeaderCode = `<div class="sidebar-header">
  <div class="header-title">
    <ListTodo :size="16" :stroke-width="1.5" />
    <span>Tasks</span>
  </div>
  <button class="add-task-btn" @click="addTask">
    <Plus :size="16" :stroke-width="1.5" />
  </button>
</div>`

const searchBoxCode = `<div class="search-box">
  <Search :size="14" :stroke-width="1.5" class="search-icon" />
  <input
    v-model="searchQuery"
    type="text"
    placeholder="Search tasks..."
    class="search-input"
  />
</div>`

const filterTabsCode = `<div class="filter-tabs">
  <button
    v-for="filter in filters"
    :key="filter.key"
    class="filter-tab"
    :class="{ active: activeFilter === filter.key }"
    @click="activeFilter = filter.key"
  >
    {{ filter.label }}
  </button>
</div>`

const sidebarTaskCode = `<div class="sidebar-task" :class="{ scheduled: task.scheduledDate }">
  <div class="task-header">
    <div class="task-title-row">
      <span class="task-title">{{ task.title }}</span>
      <div class="task-badges">
        <span v-if="task.scheduledDate" class="scheduled-badge">
          <Clock :size="12" :stroke-width="1.5" />
        </span>
        <span v-if="instances.length > 0" class="instance-badge">
          {{ instances.length }}×
        </span>
        <span class="priority-badge" :class="task.priority">
          <Flag :size="12" :stroke-width="1.5" />
        </span>
      </div>
    </div>
    <div class="task-meta">
      <span class="pomodoro-count">
        <Timer :size="12" :stroke-width="1.5" />
        {{ task.completedPomodoros }}
      </span>
    </div>
  </div>
  <div v-if="task.scheduledDate" class="scheduled-time">
    <Calendar :size="12" :stroke-width="1.5" />
    {{ formatScheduledTime(task) }}
  </div>
  <div class="task-actions">
    <button class="action-btn start-timer">
      <Play :size="12" :stroke-width="1.5" />
    </button>
    <button class="action-btn edit-task">
      <Edit :size="12" :stroke-width="1.5" />
    </button>
  </div>
</div>`

const dateNavCode = `<div class="date-navigation">
  <button class="nav-btn" @click="previousDay">
    <ChevronLeft :size="16" :stroke-width="1.5" />
  </button>
  <h2 class="current-date">{{ formatCurrentDate }}</h2>
  <button class="nav-btn" @click="nextDay">
    <ChevronRight :size="16" :stroke-width="1.5" />
  </button>
</div>`

const todayBtnCode = `<button class="today-btn" @click="goToToday">
  <Calendar :size="16" :stroke-width="1.5" />
  Today
</button>`

const statusFiltersCode = `<div class="status-filters">
  <button
    class="status-btn"
    :class="{ active: statusFilter === null }"
    @click="statusFilter = null"
  >
    All
  </button>
  <button
    class="status-btn"
    :class="{ active: statusFilter === 'planned' }"
    @click="statusFilter = 'planned'"
  >
    Planned
  </button>
  <button
    class="status-btn"
    :class="{ active: statusFilter === 'in-progress' }"
    @click="statusFilter = 'in-progress'"
  >
    Active
  </button>
  <button
    class="status-btn"
    :class="{ active: statusFilter === 'done' }"
    @click="statusFilter = 'done'"
  >
    Done
  </button>
</div>`

const viewSelectorCode = `<div class="view-selector">
  <button
    class="view-btn"
    :class="{ active: viewMode === 'day' }"
    @click="viewMode = 'day'"
  >
    Day
  </button>
  <button
    class="view-btn"
    :class="{ active: viewMode === 'week' }"
    @click="viewMode = 'week'"
  >
    Week
  </button>
  <button
    class="view-btn"
    :class="{ active: viewMode === 'month' }"
    @click="viewMode = 'month'"
  >
    Month
  </button>
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

/* Sidebar Demo */
.sidebar-demo {
  padding: var(--space-6);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
}

/* VERIFIED: Sidebar Header from TaskManagerSidebar.vue:267-314 */
.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  border-bottom: 1px solid var(--glass-bg-heavy);
  background: linear-gradient(
    180deg,
    var(--glass-bg-tint) 0%,
    transparent 100%
  );
  max-width: 300px;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon {
  color: var(--brand-primary);
}

.title-text {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  font-size: var(--text-base);
}

.add-task-btn {
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-sm);
}

.add-task-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: scale(1.05);
}

/* VERIFIED: Search Box from TaskManagerSidebar.vue:321-355 */
.search-box {
  position: relative;
  margin-bottom: var(--space-4);
  max-width: 300px;
}

.search-icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.search-input {
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-bg-heavy);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4) var(--space-3) calc(var(--space-4) + 2rem);
  border-radius: var(--radius-lg);
  width: 100%;
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
  outline: none;
}

.search-input:focus {
  border-color: var(--calendar-creating-border);
  background: var(--glass-bg-soft);
  box-shadow: var(--calendar-creating-bg);
}

.search-input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

/* VERIFIED: Filter Tabs from TaskManagerSidebar.vue:357-388 */
.filter-tabs {
  display: flex;
  gap: 0.25rem;
  max-width: 300px;
}

.filter-tab {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.filter-tab:hover {
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
}

.filter-tab.active {
  background: linear-gradient(
    135deg,
    var(--purple-bg-subtle) 0%,
    var(--purple-bg-subtle) 100%
  );
  color: white;
  box-shadow: var(--calendar-today-badge-shadow);
}

/* VERIFIED: Sidebar Task from TaskManagerSidebar.vue:407-550 */
.sidebar-task {
  background: var(--surface-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  cursor: move;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-sm);
  max-width: 300px;
}

.sidebar-task:hover {
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-medium) 100%
  );
  border-color: var(--glass-border-medium);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.sidebar-task.scheduled {
  border-left: 3px solid var(--color-success);
  box-shadow:
    var(--shadow-md),
    var(--calendar-current-time-glow);
}

.task-header {
  margin-bottom: 0.5rem;
}

.task-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.25rem;
}

.task-title {
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: var(--leading-tight);
  flex: 1;
}

.task-badges {
  display: flex;
  gap: var(--space-1);
  align-items: center;
}

.scheduled-badge {
  color: var(--color-success);
  display: flex;
  align-items: center;
}

.instance-badge {
  color: var(--brand-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  background: var(--calendar-creating-bg);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.priority-badge {
  display: flex;
  align-items: center;
}

.priority-badge.high {
  color: var(--color-priority-high);
}

.priority-badge.low {
  color: var(--color-priority-low);
}

.task-meta {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.pomodoro-count {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.subtask-count {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.scheduled-time {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-success);
  font-size: var(--text-xs);
  margin-bottom: var(--space-2);
}

.task-actions {
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 150ms ease;
}

.sidebar-task:hover .task-actions {
  opacity: 1;
}

.action-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.action-btn.start-timer:hover {
  background: var(--color-work);
  border-color: var(--color-work);
  color: var(--state-active-text);
}

.action-btn.edit-task:hover {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: var(--state-active-text);
}

/* Calendar Demo */
.calendar-demo {
  padding: var(--space-8);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  display: flex;
  justify-content: center;
}

/* VERIFIED: Date Navigation from CalendarView.vue:1353-1386 */
.date-navigation {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.nav-btn {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
}

.nav-btn:hover {
  background: linear-gradient(
    135deg,
    var(--border-medium) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-xl);
}

.current-date {
  color: var(--text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin: 0;
  text-shadow: var(--shadow-sm);
}

/* VERIFIED: Today Button from CalendarView.vue:1402-1425 */
.today-btn {
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.today-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

/* VERIFIED: Status Filters from CalendarView.vue:1468-1509 */
.status-filters {
  display: flex;
  gap: var(--space-1);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
  box-shadow: inset var(--shadow-sm);
}

.status-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.status-btn:hover {
  color: var(--text-primary);
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  box-shadow: var(--state-hover-shadow);
}

.status-btn.active {
  color: var(--state-active-text);
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

/* VERIFIED: View Selector from CalendarView.vue:1427-1465 */
.view-selector {
  display: flex;
  gap: var(--space-1);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
  box-shadow: inset var(--shadow-sm);
}

.view-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.view-btn:hover {
  color: var(--text-primary);
  background: var(--glass-bg-heavy);
}

.view-btn.active {
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}
</style>
