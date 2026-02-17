<script setup lang="ts">
import { ref } from 'vue'
import { ChevronLeft, ChevronRight, Calendar, Eye, EyeOff, SlidersHorizontal, RefreshCw } from 'lucide-vue-next'
import ProjectFilterDropdown from '@/components/projects/ProjectFilterDropdown.vue'

defineProps<{
  formatCurrentDate: string
  hideCalendarDoneTasks: boolean
  viewMode: 'day' | 'week' | 'month'
  externalCalendarEnabled?: boolean
  externalCalendarLoading?: boolean
}>()

defineEmits<{
  (e: 'previousDay'): void
  (e: 'nextDay'): void
  (e: 'goToToday'): void
  (e: 'toggleDoneTasks'): void
  (e: 'update:viewMode', value: 'day' | 'week' | 'month'): void
  (e: 'syncExternalCalendar'): void
}>()

// TASK-157: Filters hidden by default for cleaner look
const showFilters = ref(false)
</script>

<template>
  <!-- TASK-157: Simplified Todoist-style calendar header -->
  <div class="calendar-header calendar-header--minimal">
    <div class="date-navigation">
      <button class="nav-btn" title="Previous Day" @click="$emit('previousDay')">
        <ChevronLeft :size="16" :stroke-width="1.5" />
      </button>
      <h2 class="current-date">
        {{ formatCurrentDate }}
      </h2>
      <button class="nav-btn" title="Next Day" @click="$emit('nextDay')">
        <ChevronRight :size="16" :stroke-width="1.5" />
      </button>
    </div>
    <div class="header-actions header-actions--minimal">
      <button class="today-btn today-btn--minimal" @click="$emit('goToToday')">
        <Calendar :size="18" :stroke-width="1.5" />
        Today
      </button>

      <!-- Filter Toggle (collapsed by default) -->
      <button
        class="filter-toggle"
        :class="{ active: showFilters }"
        title="Toggle filters"
        @click="showFilters = !showFilters"
      >
        <SlidersHorizontal :size="20" :stroke-width="1.5" />
      </button>

      <!-- BUG-1343: Hide/Show Done Tasks — always visible in header -->
      <button
        class="hide-done-toggle"
        :class="{ active: hideCalendarDoneTasks }"
        :title="hideCalendarDoneTasks ? 'Show completed tasks' : 'Hide completed tasks'"
        @click="$emit('toggleDoneTasks')"
      >
        <EyeOff v-if="hideCalendarDoneTasks" :size="16" :stroke-width="1.5" />
        <Eye v-else :size="16" :stroke-width="1.5" />
      </button>

      <!-- TASK-1317: External Calendar Sync Button -->
      <button
        v-if="externalCalendarEnabled"
        class="sync-btn"
        :class="{ syncing: externalCalendarLoading }"
        title="Sync external calendars"
        @click="$emit('syncExternalCalendar')"
      >
        <RefreshCw :size="16" :stroke-width="1.5" />
      </button>

      <div class="view-selector view-selector--minimal">
        <button
          class="view-btn"
          :class="{ active: viewMode === 'day' }"
          @click="$emit('update:viewMode', 'day')"
        >
          Day
        </button>
        <button
          class="view-btn"
          :class="{ active: viewMode === 'week' }"
          @click="$emit('update:viewMode', 'week')"
        >
          Week
        </button>
        <button
          class="view-btn"
          :class="{ active: viewMode === 'month' }"
          @click="$emit('update:viewMode', 'month')"
        >
          Month
        </button>
      </div>
    </div>
  </div>

  <!-- Collapsible Filter Bar -->
  <Transition name="slide-down">
    <div v-if="showFilters" class="filter-bar">
      <!-- Project Filter -->
      <ProjectFilterDropdown />
    </div>
  </Transition>
</template>

<style scoped>
.calendar-header {
  position: sticky;
  top: 0;
  z-index: 200; /* Above all calendar content and events */
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6) var(--space-8);
  /* Glassy background to ensure visibility when sticky but keep gradient */
  background: var(--glass-panel-bg);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-sm);
}

.date-navigation {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.nav-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.nav-btn:hover {
  background: var(--glass-bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.current-date {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  min-width: 240px;
  text-align: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.today-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.today-btn:hover {
  background: var(--glass-bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.hide-done-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.hide-done-toggle:hover {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
}

.hide-done-toggle.active {
  background: var(--color-indigo-bg-medium);
  color: var(--color-indigo);
}

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

/* TASK-157: Minimal Calendar Header Styles */
.calendar-header--minimal {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  backdrop-filter: none;
  border-bottom: none;
  box-shadow: none;
}

.header-actions--minimal {
  gap: var(--space-2);
}

.today-btn--minimal {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
  background: transparent;
  border: none;
}

.today-btn--minimal:hover {
  background: var(--glass-bg-heavy);
}

.filter-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.filter-toggle:hover {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
}

.filter-toggle.active {
  background: var(--color-indigo-bg-medium);
  color: var(--color-indigo);
}

/* TASK-1317: Sync button */
.sync-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.sync-btn:hover {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
}

.sync-btn.syncing {
  color: var(--accent-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.view-selector--minimal {
  background: transparent;
  backdrop-filter: none;
  border: none;
  box-shadow: none;
  padding: 0;
  gap: var(--space-1);
}

.view-selector--minimal .view-btn {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
}

.view-selector--minimal .view-btn.active {
  background: var(--color-indigo-bg-medium);
  border: none;
  box-shadow: none;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid var(--border-subtle);
}

/* Slide-down transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 60px;
}
</style>
